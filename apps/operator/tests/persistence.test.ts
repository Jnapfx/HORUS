import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHorusStore } from '../electron/persistence'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }))
})

describe('local evidence store', () => {
  it('stores raw responses immutably and tracks append-only events separately', () => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-store-'))
    temporaryDirectories.push(dataDirectory)
    const store = createHorusStore(dataDirectory)

    const snapshot = store.appendRawSnapshot({
      source: 'serpapi',
      request: { engine: 'google_maps' },
      retrievedAt: '2026-08-06T12:00:00.000Z',
      payload: { rating: 4.8, reviews: 120 },
    })
    store.appendEvent({
      aggregateType: 'search_run',
      aggregateId: 'run_1',
      eventType: 'search.created',
      payload: { category: 'plumbing' },
      occurredAt: '2026-08-06T12:01:00.000Z',
    })

    expect(fs.existsSync(snapshot.path)).toBe(true)
    expect(JSON.parse(fs.readFileSync(snapshot.path, 'utf8'))).toEqual({ rating: 4.8, reviews: 120 })
    expect(store.getFoundationStatus()).toMatchObject({ rawSnapshotCount: 1, eventCount: 1 })
    store.close()
  })

  it('resumes a workflow snapshot while retaining its append-only history', () => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-store-'))
    temporaryDirectories.push(dataDirectory)
    const store = createHorusStore(dataDirectory)
    const state = { step: 'demo_review', demoApproved: false }

    store.saveWorkflowState({ workflowId: 'representative-local-v1', state, updatedAt: '2026-08-06T12:02:00.000Z' })

    expect(store.getWorkflowState('representative-local-v1')).toEqual(state)
    expect(store.getFoundationStatus().eventCount).toBe(1)
    store.close()
  })
})
