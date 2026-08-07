/**
 * DEC-059. Read-only access to the evidence `better-sqlite3` already writes in
 * `electron/persistence.ts`. Deliberately a separate module and a separate
 * database connection, opened with `readonly: true` — a physical guarantee
 * from the SQLite driver, not a promise kept by convention. This is the
 * dependency the evidence MCP server (`evidence-mcp-server.ts`) uses; nothing
 * in HORUS's write path imports from here, and nothing here can write.
 */

import fs from 'node:fs'
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
 * `databasePath` must already exist — `fileMustExist: true` means this never
 * creates a database, only reads one `electron/persistence.ts` already wrote.
 */
export function openReadOnlyEvidenceStore(databasePath: string): ReadOnlyEvidenceStore {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  const getById = database.prepare(
    'SELECT id, source, retrieved_at, storage_path FROM raw_snapshots WHERE id = ?',
  )

  return {
    getSnapshot(snapshotId: string): StoredEvidence | null {
      const row = getById.get(snapshotId) as SnapshotRow | undefined
      if (!row) return null

      const payload: unknown = JSON.parse(fs.readFileSync(row.storage_path, 'utf8'))
      return { snapshotId: row.id, source: row.source, retrievedAt: row.retrieved_at, payload }
    },
    close() {
      database.close()
    },
  }
}
