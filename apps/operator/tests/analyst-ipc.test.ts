import { describe, expect, it } from 'vitest'
import { runOpportunityAnalyst } from '../electron/agent/analyst-ipc'
import type { AgentRunOutcome, BoundedAgentTask, LocalAgentRuntime } from '../electron/agent/runtime'

const evidence = [{ snapshotId: 'raw_1', source: 'serpapi', retrievedAt: '2026-08-07T12:00:00.000Z' }]

function fakeRecord(task: BoundedAgentTask, overrides: Partial<AgentRunOutcome['record']> = {}) {
  return {
    taskId: task.taskId,
    role: task.role,
    instructionVersion: task.instructionVersion,
    runtimeId: 'fake-runtime',
    startedAt: '2026-08-07T12:00:00.000Z',
    completedAt: '2026-08-07T12:00:05.000Z',
    evidenceIds: task.evidence.map((e) => e.snapshotId),
    toolsOffered: [...task.allowedTools],
    turnsUsed: 1,
    sessionId: 'session_1',
    totalCostUsd: 0.01,
    ...overrides,
  }
}

function runtimeThatReturns(build: (task: BoundedAgentTask) => AgentRunOutcome): LocalAgentRuntime {
  return {
    runtimeId: 'fake-runtime',
    checkAvailability: async () => ({ available: true, runtimeId: 'fake-runtime', version: '0.0.0' }),
    run: async (task) => build(task),
  }
}

describe('runOpportunityAnalyst', () => {
  it('returns a parsed, schema-validated result for a well-formed run', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: {
        observations: [
          { candidateId: 'c1', signal: 'Rated 4.8 with 120 reviews.', kind: 'observed', evidenceSnapshotIds: ['raw_1'] },
        ],
        proposedForReview: [],
        missingInformation: ['No website snapshot was retrieved.'],
      },
    }))

    const result = await runOpportunityAnalyst({ runtime, evidence, taskId: 'ipc-test-1' })

    expect(result.status).toBe('awaiting_operator_review')
    if (result.status !== 'awaiting_operator_review') throw new Error('unreachable')
    expect(result.output.observations).toHaveLength(1)
    expect(result.record.taskId).toBe('ipc-test-1')
  })

  it('passes a runtime failure straight through', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'The runtime exceeded its time limit.',
    }))

    const result = await runOpportunityAnalyst({ runtime, evidence, taskId: 'ipc-test-2' })

    expect(result).toMatchObject({ status: 'failed', reason: 'timeout' })
  })

  it('turns an output that fails parseAnalystOutput into a failed result rather than throwing', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      // Cites evidence that was never supplied to the task — parseAnalystOutput
      // must reject this (section 11), and the IPC wiring must not let a
      // thrown AgentTaskRejected reach the renderer as an unhandled rejection.
      output: {
        observations: [
          { candidateId: 'c1', signal: 'x', kind: 'observed', evidenceSnapshotIds: ['raw_never_supplied'] },
        ],
        proposedForReview: [],
        missingInformation: [],
      },
    }))

    const result = await runOpportunityAnalyst({ runtime, evidence, taskId: 'ipc-test-3' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.reason).toBe('invalid_output')
    expect(result.detail).toContain('raw_never_supplied')
  })

  it('persists a draft only after the output has passed parseAnalystOutput (DEC-067)', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: {
        observations: [{ candidateId: 'c1', signal: 'Rated 4.8.', kind: 'observed', evidenceSnapshotIds: ['raw_1'] }],
        proposedForReview: [],
        missingInformation: [],
      },
    }))
    const saved: unknown[] = []
    const saveDraft = (draft: unknown) => {
      saved.push(draft)
      return { id: 'draft_1' }
    }

    const result = await runOpportunityAnalyst({
      runtime,
      evidence,
      taskId: 'ipc-test-draft',
      saveDraft,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    })

    expect(result.status).toBe('awaiting_operator_review')
    if (result.status !== 'awaiting_operator_review') throw new Error('unreachable')
    expect(result.draftId).toBe('draft_1')
    expect(saved).toEqual([
      {
        taskId: 'ipc-test-draft',
        createdAt: '2026-08-07T12:00:00.000Z',
        output: result.output,
      },
    ])
  })

  it('never calls saveDraft when the run failed or the output was invalid', async () => {
    let called = false
    const saveDraft = () => { called = true; return { id: 'should-not-happen' } }

    const failedRuntime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'x',
    }))
    await runOpportunityAnalyst({ runtime: failedRuntime, evidence, taskId: 'ipc-test-nosave-1', saveDraft })
    expect(called).toBe(false)

    const invalidOutputRuntime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { observations: 'not an array', proposedForReview: [], missingInformation: [] },
    }))
    await runOpportunityAnalyst({ runtime: invalidOutputRuntime, evidence, taskId: 'ipc-test-nosave-2', saveDraft })
    expect(called).toBe(false)
  })

  it('rejects an empty evidence list before contacting the runtime at all', async () => {
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    await expect(
      runOpportunityAnalyst({ runtime, evidence: [], taskId: 'ipc-test-4' }),
    ).rejects.toThrow(/evidence/i)
    expect(contacted).toBe(false)
  })
})
