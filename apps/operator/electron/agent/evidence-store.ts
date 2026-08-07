/**
 * DEC-059. Read-only access to the evidence `better-sqlite3` already writes in
 * `electron/persistence.ts`. Deliberately a separate module and a separate
 * database connection, opened with `readonly: true` — a physical guarantee
 * from the SQLite driver, not a promise kept by convention. This is the
 * dependency the evidence MCP server (`evidence-mcp-server.ts`) uses; nothing
 * in HORUS's write path imports from here, and nothing here can write.
 */

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export type StoredEvidence = {
  snapshotId: string
  source: string
  retrievedAt: string
  payload: unknown
}

export type ReadOnlyEvidenceStore = {
  getSnapshot: (snapshotId: string) => StoredEvidence | null
  close: () => void
}

type SnapshotRow = {
  id: string
  source: string
  retrieved_at: string
  storage_path: string
}

/**
 * DEC-062. `electron/persistence.ts`'s write path always records an absolute
 * `storage_path` — `path.join(dataDirectory, 'raw', ...)` where `dataDirectory`
 * is itself absolute — so for every snapshot HORUS's own code has ever written,
 * `basePath` is never consulted.
 *
 * It exists for evidence retained by something other than that write path: the
 * Phase 5 SEASONS EATS and Finescape and Sons snapshots in `cache/phase5/`
 * record `storage_path` relative to the repository root (in two different
 * spellings, depending on which directory the original retrieval ran from —
 * both resolve correctly from the repository root and nowhere else). The
 * server that reads evidence for an agent task (`evidence-mcp-server.ts`) runs
 * from an isolated working directory that is deliberately never the repository
 * (DEC-057), so resolving a relative path against `process.cwd()` there would
 * fail — loudly, as a missing file, never as a silently wrong read, but it
 * would still be a failure `basePath` is meant to prevent.
 */
export type EvidenceStoreOptions = {
  /** Only consulted for a relative storage_path. Defaults to `process.cwd()`. */
  basePath?: string
}

/**
 * `databasePath` must already exist — `fileMustExist: true` means this never
 * creates a database, only reads one already written by HORUS or retained
 * separately as evidence.
 */
export function openReadOnlyEvidenceStore(
  databasePath: string,
  options: EvidenceStoreOptions = {},
): ReadOnlyEvidenceStore {
  const basePath = options.basePath ?? process.cwd()
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  const getById = database.prepare(
    'SELECT id, source, retrieved_at, storage_path FROM raw_snapshots WHERE id = ?',
  )

  return {
    getSnapshot(snapshotId: string): StoredEvidence | null {
      const row = getById.get(snapshotId) as SnapshotRow | undefined
      if (!row) return null

      const resolvedPath = path.isAbsolute(row.storage_path)
        ? row.storage_path
        : path.resolve(basePath, row.storage_path)
      const payload: unknown = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
      return { snapshotId: row.id, source: row.source, retrievedAt: row.retrieved_at, payload }
    },
    close() {
      database.close()
    },
  }
}
