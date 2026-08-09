import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export type RawSnapshotInput = {
  source: string
  request: unknown
  retrievedAt: string
  payload: unknown
}

export type FoundationStatus = {
  databasePath: string
  dataDirectory: string
  rawSnapshotCount: number
  eventCount: number
}

export type RawSnapshotSummary = { id: string; source: string; retrievedAt: string }

/**
 * DEC-067. What `save_agent_draft` (one of the 4 `ANALYST_TOOLS` DEC-049
 * named with no implementation) resolves to: not a live write tool available
 * to the Claude Code subprocess mid-run — that would let unvalidated output
 * reach storage before `parseAnalystOutput` ever runs — but a save performed
 * by HORUS's own main-process code, only after a run's output has already
 * passed that validation. The draft is exactly what the analyst returned:
 * inert data for the operator to review, never a score, never an approval,
 * never a state transition (DEC-045).
 */
export type AgentDraftInput = { taskId: string; createdAt: string; output: unknown }
export type AgentDraftSummary = { id: string; taskId: string; createdAt: string; output: unknown }

/** DEC-082. What `listEvents` returns — the full append-only record `appendEvent` already wrote, read back for the first time by anything other than a test. */
export type DomainEventRecord = { id: string; aggregateType: string; aggregateId: string; eventType: string; payload: unknown; occurredAt: string }

export type HorusStore = {
  appendRawSnapshot: (input: RawSnapshotInput) => { id: string; path: string; payloadHash: string }
  appendEvent: (input: { aggregateType: string; aggregateId: string; eventType: string; payload: unknown; occurredAt: string }) => string
  getWorkflowState: (workflowId: string) => unknown | null
  saveWorkflowState: (input: { workflowId: string; state: unknown; updatedAt: string }) => void
  getFoundationStatus: () => FoundationStatus
  /**
   * Read-only listing, most recent first. Exists so a caller — the analyst IPC
   * wiring, in particular — can offer the operator a real choice of retained
   * evidence instead of requiring snapshot ids to already be known. Never
   * exposes payload content: that stays behind `read_evidence_snapshot`
   * (DEC-059), which enforces its own read-only guarantee independently.
   */
  listRawSnapshots: (limit?: number) => readonly RawSnapshotSummary[]
  /**
   * DEC-107. Every retained snapshot of one source, with its payload, so the
   * main process can rebuild a working session from evidence it already holds.
   *
   * Distinct from `listRawSnapshots`, which deliberately never exposes payload
   * content because that is the agent's `read_evidence_snapshot` boundary
   * (DEC-059). This is main-process only and reaches no agent: it exists so
   * closing the application stops discarding a search the operator paid for.
   */
  listRawSnapshotsBySource: (source: string) => readonly { id: string; retrievedAt: string; request: unknown; payload: unknown }[]
  /**
   * DEC-077. The read side of DEC-020's caching rule for structured requests:
   * scans this source's snapshots, most recent first, and returns the first
   * one whose stored `request` object satisfies `matches`, payload included.
   * Returns `null` rather than throwing when nothing matches — an empty
   * cache is a normal, expected state, not an error.
   */
  findLatestRawSnapshot: (input: { source: string; matches: (request: unknown) => boolean }) => { id: string; retrievedAt: string; payload: unknown } | null
  /** DEC-067. Persists an already-validated analyst output. See `AgentDraftInput`. */
  saveAgentDraft: (input: AgentDraftInput) => { id: string }
  /** Most recent first. */
  listAgentDrafts: (limit?: number) => readonly AgentDraftSummary[]
  /**
   * DEC-082. Read-only, oldest first (a tracker reads as a timeline).
   * `aggregateTypes`, when given, restricts to those types only — the
   * tracker only ever wants `demonstration`/`outreach`/`follow_up`, not
   * every `workflow_session` event this table also holds.
   */
  listEvents: (aggregateTypes?: readonly string[]) => readonly DomainEventRecord[]
  close: () => void
}

function stablePayload(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

const SCHEMA_VERSION = 1

/**
 * DEC-047. The original `raw_snapshots` made `payload_hash` UNIQUE, derived the
 * row id from that hash, and inserted with `INSERT OR IGNORE`. Retrieving
 * identical content a second time was therefore discarded in silence: no second
 * row, and no second `retrieved_at`.
 *
 * That contradicts the storage rule that a later retrieval creates a new
 * snapshot beside the old one, and it can starve the 30-day freshness rule
 * (DEC-021) of the current retrieval timestamp it depends on.
 *
 * A retrieval is now its own record. Content remains stored once on disk,
 * addressed by hash, because deduplicating bytes is not the same as
 * deduplicating retrievals.
 */
function migrateRawSnapshots(database: Database.Database) {
  const existing = database
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'raw_snapshots'`)
    .get() as { sql: string } | undefined

  if (existing && existing.sql.includes('payload_hash TEXT NOT NULL UNIQUE')) {
    database.exec(`
      BEGIN;
      CREATE TABLE raw_snapshots_migrated (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        request_json TEXT NOT NULL,
        retrieved_at TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO raw_snapshots_migrated
        (id, source, request_json, retrieved_at, payload_hash, storage_path, created_at)
        SELECT id, source, request_json, retrieved_at, payload_hash, storage_path, created_at
        FROM raw_snapshots;
      DROP TABLE raw_snapshots;
      ALTER TABLE raw_snapshots_migrated RENAME TO raw_snapshots;
      COMMIT;
    `)
  }

  database.pragma(`user_version = ${SCHEMA_VERSION}`)
}

export function createHorusStore(dataDirectory: string): HorusStore {
  const rawDirectory = path.join(dataDirectory, 'raw')
  fs.mkdirSync(rawDirectory, { recursive: true })

  const databasePath = path.join(dataDirectory, 'horus.sqlite')
  const database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS raw_snapshots (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      request_json TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS domain_events (
      id TEXT PRIMARY KEY,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_sessions (
      workflow_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_drafts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      output_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  migrateRawSnapshots(database)

  database.exec(`
    CREATE INDEX IF NOT EXISTS raw_snapshots_payload_hash ON raw_snapshots (payload_hash);
    CREATE INDEX IF NOT EXISTS raw_snapshots_source_retrieved_at ON raw_snapshots (source, retrieved_at);
  `)

  const appendSnapshot = database.prepare(`
    INSERT INTO raw_snapshots
      (id, source, request_json, retrieved_at, payload_hash, storage_path, created_at)
    VALUES (@id, @source, @requestJson, @retrievedAt, @payloadHash, @storagePath, @createdAt)
  `)
  const appendEvent = database.prepare(`
    INSERT INTO domain_events
      (id, aggregate_type, aggregate_id, event_type, payload_json, occurred_at)
    VALUES (@id, @aggregateType, @aggregateId, @eventType, @payloadJson, @occurredAt)
  `)
  const listSnapshots = database.prepare(
    'SELECT id, source, retrieved_at FROM raw_snapshots ORDER BY retrieved_at DESC LIMIT ?',
  )
  const insertDraft = database.prepare(`
    INSERT INTO agent_drafts (id, task_id, output_json, created_at)
    VALUES (@id, @taskId, @outputJson, @createdAt)
  `)
  const listDrafts = database.prepare(
    'SELECT id, task_id, output_json, created_at FROM agent_drafts ORDER BY created_at DESC LIMIT ?',
  )
  const getWorkflowState = database.prepare('SELECT state_json FROM workflow_sessions WHERE workflow_id = ?')
  const saveWorkflowState = database.prepare(`
    INSERT INTO workflow_sessions (workflow_id, state_json, updated_at)
    VALUES (@workflowId, @stateJson, @updatedAt)
    ON CONFLICT(workflow_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `)

  return {
    appendRawSnapshot(input) {
      const body = stablePayload(input.payload)
      const payloadHash = hash(body)
      const sourceDirectory = path.join(rawDirectory, input.source.replaceAll(/[^a-z0-9_-]/gi, '_'))
      const storagePath = path.join(sourceDirectory, `${payloadHash}.json`)
      // One row per retrieval. Identical content retrieved again is a second
      // piece of evidence about time, even when the bytes have not changed.
      const id = `raw_${crypto.randomUUID()}`

      fs.mkdirSync(sourceDirectory, { recursive: true })
      try {
        fs.writeFileSync(storagePath, body, { encoding: 'utf8', flag: 'wx' })
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
      }

      appendSnapshot.run({
        id,
        source: input.source,
        requestJson: stablePayload(input.request),
        retrievedAt: input.retrievedAt,
        payloadHash,
        storagePath,
        createdAt: new Date().toISOString(),
      })

      return { id, path: storagePath, payloadHash }
    },
    appendEvent(input) {
      const id = `event_${crypto.randomUUID()}`
      appendEvent.run({
        id,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payloadJson: stablePayload(input.payload),
        occurredAt: input.occurredAt,
      })
      return id
    },
    getWorkflowState(workflowId) {
      const result = getWorkflowState.get(workflowId) as { state_json: string } | undefined
      return result ? JSON.parse(result.state_json) : null
    },
    saveWorkflowState(input) {
      saveWorkflowState.run({ workflowId: input.workflowId, stateJson: stablePayload(input.state), updatedAt: input.updatedAt })
      this.appendEvent({
        aggregateType: 'workflow_session',
        aggregateId: input.workflowId,
        eventType: 'workflow.snapshot_saved',
        payload: input.state,
        occurredAt: input.updatedAt,
      })
    },
    listRawSnapshotsBySource(source: string) {
      const rows = database
        .prepare('SELECT id, retrieved_at, request_json, storage_path FROM raw_snapshots WHERE source = ? ORDER BY retrieved_at ASC')
        .all(source) as { id: string; retrieved_at: string; request_json: string; storage_path: string }[]
      return rows.flatMap((row) => {
        try {
          return [{
            id: row.id,
            retrievedAt: row.retrieved_at,
            request: JSON.parse(row.request_json) as unknown,
            payload: JSON.parse(fs.readFileSync(row.storage_path, 'utf8')) as unknown,
          }]
        } catch {
          // A snapshot whose file is gone is skipped, never guessed at.
          return []
        }
      })
    },

    listRawSnapshots(limit = 50) {
      const rows = listSnapshots.all(limit) as { id: string; source: string; retrieved_at: string }[]
      return rows.map((row) => ({ id: row.id, source: row.source, retrievedAt: row.retrieved_at }))
    },
    findLatestRawSnapshot(input) {
      const rows = database
        .prepare('SELECT id, request_json, retrieved_at, storage_path FROM raw_snapshots WHERE source = ? ORDER BY retrieved_at DESC')
        .all(input.source) as { id: string; request_json: string; retrieved_at: string; storage_path: string }[]
      for (const row of rows) {
        let request: unknown
        try {
          request = JSON.parse(row.request_json)
        } catch {
          continue
        }
        if (!input.matches(request)) continue
        const payload = JSON.parse(fs.readFileSync(row.storage_path, 'utf8'))
        return { id: row.id, retrievedAt: row.retrieved_at, payload }
      }
      return null
    },
    saveAgentDraft(input) {
      const id = `draft_${crypto.randomUUID()}`
      insertDraft.run({ id, taskId: input.taskId, outputJson: stablePayload(input.output), createdAt: input.createdAt })
      return { id }
    },
    listAgentDrafts(limit = 50) {
      const rows = listDrafts.all(limit) as { id: string; task_id: string; output_json: string; created_at: string }[]
      return rows.map((row) => ({ id: row.id, taskId: row.task_id, output: JSON.parse(row.output_json), createdAt: row.created_at }))
    },
    listEvents(aggregateTypes) {
      const rows = (
        aggregateTypes && aggregateTypes.length > 0
          ? database
              .prepare(`SELECT id, aggregate_type, aggregate_id, event_type, payload_json, occurred_at FROM domain_events WHERE aggregate_type IN (${aggregateTypes.map(() => '?').join(',')}) ORDER BY occurred_at ASC`)
              .all(...aggregateTypes)
          : database.prepare('SELECT id, aggregate_type, aggregate_id, event_type, payload_json, occurred_at FROM domain_events ORDER BY occurred_at ASC').all()
      ) as { id: string; aggregate_type: string; aggregate_id: string; event_type: string; payload_json: string; occurred_at: string }[]
      return rows.map((row) => ({
        id: row.id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        payload: JSON.parse(row.payload_json),
        occurredAt: row.occurred_at,
      }))
    },
    getFoundationStatus() {
      const rawSnapshotCount = (database.prepare('SELECT COUNT(*) AS count FROM raw_snapshots').get() as { count: number }).count
      const eventCount = (database.prepare('SELECT COUNT(*) AS count FROM domain_events').get() as { count: number }).count
      return { databasePath, dataDirectory, rawSnapshotCount, eventCount }
    },
    close() {
      database.close()
    },
  }
}
