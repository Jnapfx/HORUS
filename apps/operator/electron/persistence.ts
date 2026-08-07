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

export type HorusStore = {
  appendRawSnapshot: (input: RawSnapshotInput) => { id: string; path: string; payloadHash: string }
  appendEvent: (input: { aggregateType: string; aggregateId: string; eventType: string; payload: unknown; occurredAt: string }) => string
  getWorkflowState: (workflowId: string) => unknown | null
  saveWorkflowState: (input: { workflowId: string; state: unknown; updatedAt: string }) => void
  getFoundationStatus: () => FoundationStatus
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
