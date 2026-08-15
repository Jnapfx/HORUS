import { describe, expect, it } from 'vitest'
import { runQualificationAgent } from '../electron/agent/qualification-ipc'
import type { AgentRunOutcome, BoundedAgentTask, LocalAgentRuntime } from '../electron/agent/runtime'

const evidence = [
  { snapshotId: 'raw_1', source: 'serpapi.google_maps', retrievedAt: '2026-08-11T12:00:00.000Z' },
  { snapshotId: 'raw_2', source: 'serpapi.google_maps_reviews', retrievedAt: '2026-08-11T12:00:00.000Z' },
]

function fakeRecord(task: BoundedAgentTask, overrides: Partial<AgentRunOutcome['record']> = {}) {
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

const wellFormedOutput = {
  opportunityScore: 78,
  qualified: true,
  reasons: [{ text: 'No website on file, strong review reputation.', evidenceSnapshotIds: ['raw_1'] }],
}

describe('runQualificationAgent', () => {
  it('returns a parsed, schema-validated result for a well-formed run', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: wellFormedOutput,
    }))

    const result = await runQualificationAgent({ runtime, evidence, taskId: 'qualification-test-1' })

    expect(result.status).toBe('awaiting_operator_review')
    if (result.status !== 'awaiting_operator_review') throw new Error('unreachable')
    expect(result.output.opportunityScore).toBe(78)
    expect(result.output.qualified).toBe(true)
  })

  it('passes a runtime failure straight through', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'The runtime exceeded its time limit.',
    }))

    const result = await runQualificationAgent({ runtime, evidence, taskId: 'qualification-test-2' })
    expect(result).toMatchObject({ status: 'failed', reason: 'timeout' })
  })

  it('rejects a score outside 0-100', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, opportunityScore: 142 },
    }))

    const result = await runQualificationAgent({ runtime, evidence, taskId: 'qualification-test-3' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/between 0 and 100/i)
  })

  it('rejects a reason citing evidence never supplied to the task', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, reasons: [{ text: 'x', evidenceSnapshotIds: ['raw_never_supplied'] }] },
    }))

    const result = await runQualificationAgent({ runtime, evidence, taskId: 'qualification-test-4' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toContain('raw_never_supplied')
  })

  it('rejects an empty reasons array — a decision with no stated reasoning is not accepted', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, reasons: [] },
    }))

    const result = await runQualificationAgent({ runtime, evidence, taskId: 'qualification-test-5' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/non-empty array/i)
  })

  it('rejects an empty evidence list before contacting the runtime at all', async () => {
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    await expect(
      runQualificationAgent({ runtime, evidence: [], taskId: 'qualification-test-6' }),
    ).rejects.toThrow(/evidence/i)
    expect(contacted).toBe(false)
  })
})
