import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_BUILD_ATTEMPTS, advanceLeadDemonstration } from '../electron/orchestrator/run-demonstration'
import { appendValidatedLeadStatus, readLeadState } from '../electron/orchestrator/lead-store'
import type { DomainEventRecord, HorusStore } from '../electron/persistence'
import type { AgentRunOutcome, BoundedAgentTask, LocalAgentRuntime } from '../electron/agent/runtime'

const DISCOVERY_PAYLOAD = {
  local_results: [
    {
      title: 'Tuff Lawn',
      data_id: 'lead_1',
      rating: 4.6,
      reviews: 314,
      type: 'Landscaper',
      address: '1 Main St, Stamford, CT',
      phone: '(203) 555-0100',
      website: 'https://tufflawn.example',
    },
  ],
}

let scratchRoot: string

beforeEach(() => {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-demo-test-'))
})

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true })
})

function fakeStore(): HorusStore & { snapshots: { id: string; source: string; payload: unknown }[] } {
  const events: DomainEventRecord[] = []
  const snapshots: { id: string; source: string; payload: unknown }[] = []
  let counter = 0
  const store = {
    snapshots,
    appendRawSnapshot: (input: { source: string; payload: unknown }) => {
      const id = `raw_demo_${snapshots.length + 1}`
      snapshots.push({ id, source: input.source, payload: input.payload })
      return { id, path: `/tmp/${id}.json`, payloadHash: 'hash' }
    },
    appendEvent: (input: Omit<DomainEventRecord, 'id'>) => {
      const id = `event_${counter++}`
      events.push({ id, ...input } as DomainEventRecord)
      return id
    },
    getWorkflowState: () => null,
    saveWorkflowState: () => {},
    getFoundationStatus: () => {
      throw new Error('not used in these tests')
    },
    listRawSnapshots: () => [],
    listRawSnapshotsBySource: (source: string) =>
      source === 'serpapi.google_maps'
        ? [{ id: 'raw_discovery_1', retrievedAt: '2026-08-10T00:00:00.000Z', request: {}, payload: DISCOVERY_PAYLOAD }]
        : [],
    findLatestRawSnapshot: () => null,
    saveAgentDraft: () => {
      throw new Error('not used in these tests')
    },
    listAgentDrafts: () => [],
    listEvents: (aggregateTypes?: readonly string[]) =>
      aggregateTypes && aggregateTypes.length > 0
        ? events.filter((event) => aggregateTypes.includes(event.aggregateType))
        : events,
    close: () => {},
  }
  return store as unknown as HorusStore & { snapshots: { id: string; source: string; payload: unknown }[] }
}

function qualified(store: HorusStore) {
  appendValidatedLeadStatus(store, 'lead_1', 'QUALIFYING', { occurredAt: '2026-08-11T11:00:00.000Z' })
  appendValidatedLeadStatus(store, 'lead_1', 'QUALIFIED', { occurredAt: '2026-08-11T11:00:01.000Z' })
}

function fakeRecord(task: BoundedAgentTask): AgentRunOutcome['record'] {
  return {
    taskId: task.taskId,
    role: task.role,
    instructionVersion: task.instructionVersion,
    runtimeId: 'fake-runtime',
    startedAt: '2026-08-11T12:00:00.000Z',
    completedAt: '2026-08-11T12:00:05.000Z',
    evidenceIds: task.evidence.map((reference) => reference.snapshotId),
    toolsOffered: [...task.allowedTools],
    turnsUsed: 1,
    sessionId: 'session_1',
    totalCostUsd: 0.01,
  }
}

function composition(overrides: Record<string, unknown> = {}) {
  return {
    sectionOrder: ['services'],
    tone: 'minimal',
    tagline: null,
    aboutParagraph: null,
    reviewHighlights: [],
    rationale: 'A plain, direct look suits a landscaping business with a long record.',
    palette: 'forest',
    fontPairing: 'grotesque',
    ...overrides,
  }
}

/**
 * Serves both agent roles from one runtime, exactly as `main.ts` does. `qa`
 * decides what the QA reviewer says on each successive call, so a test can
 * drive the correction loop round by round.
 */
function runtimeFor(options: {
  qa: Array<{ status: 'QA_PASSED' | 'QA_FAILED'; issues?: string[] }>
  composerFails?: boolean
}): LocalAgentRuntime & { composerInstructions: string[] } {
  const composerInstructions: string[] = []
  let qaCall = 0
  const runtime = {
    runtimeId: 'fake-runtime',
    checkAvailability: async () => ({ available: true, runtimeId: 'fake-runtime', version: '0.0.0' }),
    composerInstructions,
    run: async (task: BoundedAgentTask): Promise<AgentRunOutcome> => {
      if (task.role === 'concept_composer') {
        composerInstructions.push(task.instruction)
        if (options.composerFails) {
          return { status: 'failed', record: fakeRecord(task), reason: 'timeout', detail: 'ran out of time' }
        }
        return { status: 'awaiting_operator_review', record: fakeRecord(task), output: composition() }
      }
      const next = options.qa[Math.min(qaCall, options.qa.length - 1)]!
      qaCall += 1
      return {
        status: 'awaiting_operator_review',
        record: fakeRecord(task),
        output: {
          status: next.status,
          issues: next.issues ?? [],
          severity: next.status === 'QA_FAILED' ? 'medium' : 'low',
          demoEvidenceSnapshotId: task.evidence[task.evidence.length - 1]!.snapshotId,
        },
      }
    },
  }
  return runtime as unknown as LocalAgentRuntime & { composerInstructions: string[] }
}

describe('advanceLeadDemonstration', () => {
  it('builds, passes both checks, and stops at QA_PASSED without touching any approval', async () => {
    const store = fakeStore()
    qualified(store)

    const result = await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_PASSED' }] }),
      dataId: 'lead_1',
      scratchRoot,
    })

    expect(result.status).toBe('qa_passed')
    if (result.status !== 'qa_passed') return
    expect(result.attempts).toHaveLength(1)
    expect(result.html).toContain('Tuff Lawn')
    // DEC-024's conditions survive the whole loop.
    expect(result.html).toContain('meta name="robots" content="noindex, nofollow"')
    expect(result.html).toContain('HORUS concept demonstration, not')
    // QA_PASSED is the terminal state of the loop — never APPROVED, never SENT.
    expect(readLeadState(store, 'lead_1').status).toBe('QA_PASSED')
  })

  it('retains every attempt as its own immutable snapshot rather than overwriting', async () => {
    const store = fakeStore()
    qualified(store)

    await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_FAILED', issues: ['The about copy is generic.'] }, { status: 'QA_PASSED' }] }),
      dataId: 'lead_1',
      scratchRoot,
    })

    const drafts = store.snapshots.filter((snapshot) => snapshot.source === 'horus.demonstration_draft')
    expect(drafts).toHaveLength(2)
    expect(new Set(drafts.map((draft) => draft.id)).size).toBe(2)
  })

  it('feeds the QA reviewer’s own issues back into the correction pass', async () => {
    const store = fakeStore()
    qualified(store)
    const runtime = runtimeFor({ qa: [{ status: 'QA_FAILED', issues: ['The hours table repeats Monday twice.'] }, { status: 'QA_PASSED' }] })

    const result = await advanceLeadDemonstration({ store, runtime, dataId: 'lead_1', scratchRoot })

    expect(result.status).toBe('qa_passed')
    // The first composer run must not carry fix notes; the second must carry
    // exactly the finding the reviewer raised.
    expect(runtime.composerInstructions[0]).not.toContain('previous attempt')
    expect(runtime.composerInstructions[1]).toContain('The hours table repeats Monday twice.')
  })

  it('stops at QA_FAILED after the attempt ceiling instead of forcing the lead through', async () => {
    const store = fakeStore()
    qualified(store)

    const result = await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_FAILED', issues: ['Still generic.'] }] }),
      dataId: 'lead_1',
      scratchRoot,
    })

    expect(result.status).toBe('qa_failed')
    if (result.status !== 'qa_failed') return
    expect(result.attempts).toHaveLength(MAX_BUILD_ATTEMPTS)
    expect(result.reason).toContain(`${MAX_BUILD_ATTEMPTS} attempts`)
    // Flagged for the operator, never advanced and never silently dropped.
    expect(readLeadState(store, 'lead_1').status).toBe('QA_FAILED')
  })

  it('records FAILED when the composer itself fails, without publishing a partial result', async () => {
    const store = fakeStore()
    qualified(store)

    const result = await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_PASSED' }], composerFails: true }),
      dataId: 'lead_1',
      scratchRoot,
    })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') return
    expect(result.reason).toBe('timeout')
    expect(readLeadState(store, 'lead_1').status).toBe('FAILED')
    expect(store.snapshots).toHaveLength(0)
  })

  it('does nothing to a lead that is not QUALIFIED or QA_FAILED', async () => {
    const store = fakeStore()

    const result = await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_PASSED' }] }),
      dataId: 'lead_1',
      scratchRoot,
    })

    expect(result.status).toBe('skipped')
    // DISCOVERED, i.e. nothing was written at all.
    expect(readLeadState(store, 'lead_1').history).toHaveLength(0)
  })

  // The deterministic gate's own branches. These use an injected detector
  // because the real one can no longer be made to fail from here — the closed
  // palette and font sets mean the generator cannot emit a page that trips a
  // rule. `tests/impeccable-gate.test.ts` proves the real detector fails on a
  // real bad page; these prove the Orchestrator does the right thing when it
  // does.
  it('sends a detector rejection back for correction without spending a QA agent run on it', async () => {
    const store = fakeStore()
    qualified(store)
    const runtime = runtimeFor({ qa: [{ status: 'QA_PASSED' }] })
    let detectCalls = 0

    const result = await advanceLeadDemonstration({
      store,
      runtime,
      dataId: 'lead_1',
      scratchRoot,
      detect: async () => {
        detectCalls += 1
        // Fails the first round only, so the loop must recover on the second.
        return detectCalls === 1
          ? [{ antipattern: 'cream-palette', name: 'Cream / beige palette', description: 'Choose a deliberate background.', severity: 'warning', category: 'slop', snippet: 'rgb(245, 241, 234)' }]
          : []
      },
    })

    expect(result.status).toBe('qa_passed')
    if (result.status !== 'qa_passed') return
    expect(result.attempts[0]!.outcome).toBe('detector_rejected')
    expect(result.attempts[0]!.detectorFindings[0]).toContain('cream-palette')
    // The rejected round never reached the QA agent — deterministic first.
    expect(result.attempts[0]!.agentIssues).toEqual([])
    // The correction pass was told the rule id that failed.
    expect(runtime.composerInstructions[1]).toContain('cream-palette')
  })

  it('stops on an unavailable detector rather than recording an unchecked page as passed', async () => {
    const store = fakeStore()
    qualified(store)

    const result = await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_PASSED' }] }),
      dataId: 'lead_1',
      scratchRoot,
      detect: async () => {
        throw new Error('detector module missing')
      },
    })

    expect(result.status).toBe('qa_failed')
    if (result.status !== 'qa_failed') return
    expect(result.attempts).toHaveLength(1)
    expect(result.attempts[0]!.outcome).toBe('unchecked')
    // No point retrying a check that cannot run — it stops after one round.
    expect(result.reason).toContain('could not be checked')
    expect(readLeadState(store, 'lead_1').status).toBe('QA_FAILED')
  })

  it('lets the operator retry a QA_FAILED lead', async () => {
    const store = fakeStore()
    qualified(store)
    await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_FAILED', issues: ['Generic.'] }] }),
      dataId: 'lead_1',
      scratchRoot,
    })
    expect(readLeadState(store, 'lead_1').status).toBe('QA_FAILED')

    const retry = await advanceLeadDemonstration({
      store,
      runtime: runtimeFor({ qa: [{ status: 'QA_PASSED' }] }),
      dataId: 'lead_1',
      scratchRoot,
    })

    expect(retry.status).toBe('qa_passed')
    expect(readLeadState(store, 'lead_1').status).toBe('QA_PASSED')
  })
})
