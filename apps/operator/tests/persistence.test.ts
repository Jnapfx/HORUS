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

  it('records a later retrieval of identical content as a separate snapshot', () => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-store-'))
    temporaryDirectories.push(dataDirectory)
    const store = createHorusStore(dataDirectory)
    const retrieval = { source: 'serpapi', request: { engine: 'google_maps' }, payload: { rating: 4.8, reviews: 120 } }

    const first = store.appendRawSnapshot({ ...retrieval, retrievedAt: '2026-07-01T12:00:00.000Z' })
    const second = store.appendRawSnapshot({ ...retrieval, retrievedAt: '2026-08-07T12:00:00.000Z' })

    // Two retrievals, two records: the second proves the evidence was still
    // current on 7 August, which is what the freshness gate reads.
    expect(second.id).not.toBe(first.id)
    expect(store.getFoundationStatus().rawSnapshotCount).toBe(2)

    // Identical bytes are still stored once.
    expect(second.payloadHash).toBe(first.payloadHash)
    expect(second.path).toBe(first.path)
    expect(fs.readdirSync(path.dirname(first.path))).toHaveLength(1)
    store.close()
  })

  it('lists raw snapshots newest first without exposing payload content', () => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-store-'))
    temporaryDirectories.push(dataDirectory)
    const store = createHorusStore(dataDirectory)

    const older = store.appendRawSnapshot({
      source: 'serpapi',
      request: {},
      retrievedAt: '2026-08-01T00:00:00.000Z',
      payload: { secret: 'should not appear in the listing' },
    })
    const newer = store.appendRawSnapshot({
      source: 'pagespeed',
      request: {},
      retrievedAt: '2026-08-07T00:00:00.000Z',
      payload: { performanceScore: 41 },
    })

    const listed = store.listRawSnapshots()

    expect(listed).toEqual([
      { id: newer.id, source: 'pagespeed', retrievedAt: '2026-08-07T00:00:00.000Z' },
      { id: older.id, source: 'serpapi', retrievedAt: '2026-08-01T00:00:00.000Z' },
    ])
    expect(JSON.stringify(listed)).not.toContain('secret')
    store.close()
  })

  it('honors the limit passed to listRawSnapshots', () => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-store-'))
    temporaryDirectories.push(dataDirectory)
    const store = createHorusStore(dataDirectory)
    for (let i = 0; i < 5; i += 1) {
      store.appendRawSnapshot({
        source: 'serpapi',
        request: {},
        retrievedAt: `2026-08-0${i + 1}T00:00:00.000Z`,
        payload: { i },
      })
    }

    expect(store.listRawSnapshots(2)).toHaveLength(2)
    store.close()
  })

  it('saves and lists agent drafts, newest first (DEC-067)', () => {
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-store-'))
    temporaryDirectories.push(dataDirectory)
    const store = createHorusStore(dataDirectory)

    const older = store.saveAgentDraft({
      taskId: 'task_1',
      createdAt: '2026-08-01T00:00:00.000Z',
      output: { observations: [], proposedForReview: [], missingInformation: ['no website snapshot'] },
    })
    const newer = store.saveAgentDraft({
      taskId: 'task_2',
      createdAt: '2026-08-07T00:00:00.000Z',
      output: { observations: [{ candidateId: 'c1', signal: 's', kind: 'observed', evidenceSnapshotIds: ['raw_1'] }], proposedForReview: [], missingInformation: [] },
    })

    const listed = store.listAgentDrafts()

    expect(listed).toHaveLength(2)
    expect(listed[0]).toMatchObject({ id: newer.id, taskId: 'task_2' })
    expect(listed[1]).toMatchObject({ id: older.id, taskId: 'task_1' })
    expect(listed[0]!.output).toMatchObject({ observations: [{ candidateId: 'c1' }] })
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
