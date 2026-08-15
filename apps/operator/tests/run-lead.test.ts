import { describe, expect, it } from 'vitest'
import { advanceLeadQualification, retryLeadQualification } from '../electron/orchestrator/run-lead'
import { readLeadState } from '../electron/orchestrator/lead-store'
import type { DomainEventRecord, HorusStore } from '../electron/persistence'
import type { AgentRunOutcome, BoundedAgentTask, LocalAgentRuntime } from '../electron/agent/runtime'

const DISCOVERY_PAYLOAD = {
  local_results: [
    { title: 'Chiwa Bistro', data_id: 'lead_1', rating: 4.6, reviews: 120, website: 'https://chiwabistro.example.com' },
    { title: 'Other Business', data_id: 'lead_2', rating: 3.2, reviews: 8 },
  ],
}

function fakeStore(snapshotsBySource: Record<string, { id: string; source: string; retrievedAt: string; request: unknown; payload: unknown }[]> = {}): HorusStore {
  const events: DomainEventRecord[] = []
  let counter = 0
  return {
    appendRawSnapshot: () => {
      throw new Error('not used in these tests')
    },
    appendEvent: (input) => {
      const id = `event_${counter++}`
      events.push({ id, ...input })
      return id
    },
    getWorkflowState: () => null,
    saveWorkflowState: () => {},
    getFoundationStatus: () => {
      throw new Error('not used in these tests')
    },
    listRawSnapshots: () => [],
    listRawSnapshotsBySource: (source) => snapshotsBySource[source] ?? [],
    findLatestRawSnapshot: () => null,
    saveAgentDraft: () => {
      throw new Error('not used in these tests')
    },
    listAgentDrafts: () => [],
    listEvents: (aggregateTypes) =>
      aggregateTypes && aggregateTypes.length > 0
        ? events.filter((event) => aggregateTypes.includes(event.aggregateType))
        : events,
    close: () => {},
  }
}

function storeWithDiscovery() {
  return fakeStore({
    'serpapi.google_maps': [
      { id: 'raw_discovery_1', source: 'serpapi.google_maps', retrievedAt: '2026-08-10T00:00:00.000Z', request: {}, payload: DISCOVERY_PAYLOAD },
    ],
  })
}

function fakeRecord(task: BoundedAgentTask): AgentRunOutcome['record'] {
  return {
    taskId: task.taskId,
    role: task.role,
    instructionVersion: task.instructionVersion,
    runtimeId: 'fake-runtime',
    startedAt: '2026-08-11T12:00:00.000Z',
    completedAt: '2026-08-11T12:00:05.000Z',
    evidenceIds: task.evidence.map((e) => e.snapshotId),
    toolsOffered: [...task.allowedTools],
    turnsUsed: 1,
    sessionId: 'session_1',
    totalCostUsd: 0.01,
  }
}

function runtimeThatReturns(build: (task: BoundedAgentTask) => AgentRunOutcome): LocalAgentRuntime {
  return {
    runtimeId: 'fake-runtime',
    checkAvailability: async () => ({ available: true, runtimeId: 'fake-runtime', version: '0.0.0' }),
    run: async (task) => build(task),
  }
}

describe('advanceLeadQualification', () => {
  it('moves a DISCOVERED lead to QUALIFIED when the agent qualifies it', async () => {
    const store = storeWithDiscovery()
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { opportunityScore: 82, qualified: true, reasons: [{ text: 'No website on file.', evidenceSnapshotIds: ['raw_discovery_1'] }] },
    }))

    const result = await advanceLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result.status).toBe('qualified')
    expect(readLeadState(store, 'lead_1').status).toBe('QUALIFIED')
    expect(readLeadState(store, 'lead_1').history.map((e) => e.status)).toEqual(['QUALIFYING', 'QUALIFIED'])
  })

  it('moves a DISCOVERED lead to REJECTED when the agent does not qualify it', async () => {
    const store = storeWithDiscovery()
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { opportunityScore: 12, qualified: false, reasons: [{ text: 'Already has a strong website.', evidenceSnapshotIds: ['raw_discovery_1'] }] },
    }))

    const result = await advanceLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result.status).toBe('rejected')
    expect(readLeadState(store, 'lead_1').status).toBe('REJECTED')
  })

  it('moves a DISCOVERED lead to FAILED when the agent run fails, and reports the failure', async () => {
    const store = storeWithDiscovery()
    const runtime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'The runtime exceeded its time limit.',
    }))

    const result = await advanceLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result).toMatchObject({ status: 'failed', reason: 'timeout' })
    expect(readLeadState(store, 'lead_1').status).toBe('FAILED')
  })

  it('skips a lead that is not DISCOVERED, without contacting the runtime or writing anything', async () => {
    const store = storeWithDiscovery()
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    // Advance once to move the lead past DISCOVERED, then try again.
    await advanceLeadQualification({
      store,
      runtime: runtimeThatReturns((task) => ({
        status: 'awaiting_operator_review',
        record: fakeRecord(task),
        output: { opportunityScore: 80, qualified: true, reasons: [{ text: 'x', evidenceSnapshotIds: ['raw_discovery_1'] }] },
      })),
      dataId: 'lead_1',
    })

    const result = await advanceLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result.status).toBe('skipped')
    expect(contacted).toBe(false)
    expect(readLeadState(store, 'lead_1').status).toBe('QUALIFIED')
  })

  it('skips a lead with no retained discovery evidence at all, without writing anything', async () => {
    const store = fakeStore()
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    const result = await advanceLeadQualification({ store, runtime, dataId: 'lead_unknown' })

    expect(result.status).toBe('skipped')
    expect(contacted).toBe(false)
    expect(readLeadState(store, 'lead_unknown').status).toBe('DISCOVERED')
  })
})

describe('retryLeadQualification', () => {
  async function failOnce(store: HorusStore) {
    await advanceLeadQualification({
      store,
      runtime: runtimeThatReturns((task) => ({
        status: 'failed',
        record: fakeRecord(task),
        reason: 'timeout',
        detail: 'The runtime exceeded its time limit.',
      })),
      dataId: 'lead_1',
    })
  }

  it('moves a FAILED lead to QUALIFIED when a retry succeeds, going through QUALIFYING again', async () => {
    const store = storeWithDiscovery()
    await failOnce(store)
    expect(readLeadState(store, 'lead_1').status).toBe('FAILED')

    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { opportunityScore: 82, qualified: true, reasons: [{ text: 'No website on file.', evidenceSnapshotIds: ['raw_discovery_1'] }] },
    }))

    const result = await retryLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result.status).toBe('qualified')
    expect(readLeadState(store, 'lead_1').status).toBe('QUALIFIED')
    expect(readLeadState(store, 'lead_1').history.map((e) => e.status)).toEqual(['QUALIFYING', 'FAILED', 'QUALIFYING', 'QUALIFIED'])
  })

  it('moves a FAILED lead back to FAILED when the retry fails again', async () => {
    const store = storeWithDiscovery()
    await failOnce(store)

    const runtime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'The runtime exceeded its time limit, again.',
    }))

    const result = await retryLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result).toMatchObject({ status: 'failed', reason: 'timeout' })
    expect(readLeadState(store, 'lead_1').status).toBe('FAILED')
  })

  it('skips a lead that is not FAILED, without contacting the runtime or writing anything', async () => {
    const store = storeWithDiscovery()
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    const result = await retryLeadQualification({ store, runtime, dataId: 'lead_1' })

    expect(result.status).toBe('skipped')
    expect(contacted).toBe(false)
    expect(readLeadState(store, 'lead_1').status).toBe('DISCOVERED')
  })
})
