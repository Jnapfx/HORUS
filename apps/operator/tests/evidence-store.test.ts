import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createHorusStore } from '../electron/persistence'
import { openReadOnlyEvidenceStore } from '../electron/agent/evidence-store'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }))
})

/** Seeds a real HORUS store the same way the write path does, then hands back its database path. */
function seedStore() {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-evidence-store-'))
  temporaryDirectories.push(dataDirectory)
  const writeStore = createHorusStore(dataDirectory)
  const written = writeStore.appendRawSnapshot({
    source: 'serpapi',
    request: { engine: 'google_maps' },
    retrievedAt: '2026-08-07T12:00:00.000Z',
    payload: { rating: 4.8, reviews: 120 },
  })
  writeStore.close()
  return { databasePath: path.join(dataDirectory, 'horus.sqlite'), snapshotId: written.id }
}

describe('read-only evidence store', () => {
  it('reads back a snapshot written by the real store', () => {
    const { databasePath, snapshotId } = seedStore()
    const readStore = openReadOnlyEvidenceStore(databasePath)

    const snapshot = readStore.getSnapshot(snapshotId)

    expect(snapshot).toMatchObject({
      snapshotId,
      source: 'serpapi',
      retrievedAt: '2026-08-07T12:00:00.000Z',
      payload: { rating: 4.8, reviews: 120 },
    })
    readStore.close()
  })

  it('returns null rather than throwing for an id that does not exist', () => {
    const { databasePath } = seedStore()
    const readStore = openReadOnlyEvidenceStore(databasePath)

    expect(readStore.getSnapshot('raw_does_not_exist')).toBeNull()
    readStore.close()
  })

  it('exposes no write method at all', () => {
    const { databasePath } = seedStore()
    const readStore = openReadOnlyEvidenceStore(databasePath)

    expect(readStore).not.toHaveProperty('appendRawSnapshot')
    expect(readStore).not.toHaveProperty('appendEvent')
    readStore.close()
  })

  it('proves the underlying guarantee: better-sqlite3 readonly:true rejects a write at the driver level', () => {
    // This is what `openReadOnlyEvidenceStore` relies on for its safety property.
    // It doesn't test the wrapper — it tests the assumption the wrapper is built
    // on, against a real database file, so a change to better-sqlite3's readonly
    // behavior would fail here rather than surface later as a silent write.
    const { databasePath } = seedStore()
    const rawReadOnlyHandle = new Database(databasePath, { readonly: true, fileMustExist: true })

    expect(() => rawReadOnlyHandle.exec("INSERT INTO domain_events (id, aggregate_type, aggregate_id, event_type, payload_json, occurred_at) VALUES ('x','x','x','x','x','x')"))
      .toThrow(/readonly/i)

    rawReadOnlyHandle.close()
  })

  it('refuses to open a database that does not exist rather than creating one', () => {
    const missingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-evidence-store-missing-'))
    temporaryDirectories.push(missingDirectory)
    const missingPath = path.join(missingDirectory, 'never-created.sqlite')

    expect(() => openReadOnlyEvidenceStore(missingPath)).toThrow()
    expect(fs.existsSync(missingPath)).toBe(false)
  })
})
