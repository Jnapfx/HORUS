import { describe, expect, it } from 'vitest'
import { runQaReviewer } from '../electron/agent/qa-ipc'
import type { AgentRunOutcome, BoundedAgentTask, LocalAgentRuntime } from '../electron/agent/runtime'

const evidence = [
  { snapshotId: 'raw_1', source: 'serpapi.google_maps', retrievedAt: '2026-08-11T12:00:00.000Z' },
  { snapshotId: 'demo_1', source: 'horus.demonstration_draft', retrievedAt: '2026-08-11T12:00:00.000Z' },
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

const passedOutput = {
  status: 'QA_PASSED',
  issues: [],
  severity: 'low',
  demoEvidenceSnapshotId: 'demo_1',
}

const failedOutput = {
  status: 'QA_FAILED',
  issues: ['Hero heading is cut off on mobile width.'],
  severity: 'medium',
  demoEvidenceSnapshotId: 'demo_1',
}

describe('runQaReviewer', () => {
  it('returns a parsed, schema-validated QA_PASSED result for a well-formed run', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: passedOutput,
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-1' })

    expect(result.status).toBe('awaiting_operator_review')
    if (result.status !== 'awaiting_operator_review') throw new Error('unreachable')
    expect(result.output.status).toBe('QA_PASSED')
    expect(result.output.issues).toHaveLength(0)
  })

  it('returns a parsed QA_FAILED result with issues for a well-formed failing run', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: failedOutput,
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-2' })

    expect(result.status).toBe('awaiting_operator_review')
    if (result.status !== 'awaiting_operator_review') throw new Error('unreachable')
    expect(result.output.status).toBe('QA_FAILED')
    expect(result.output.issues.length).toBeGreaterThan(0)
  })

  it('passes a runtime failure straight through', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'The runtime exceeded its time limit.',
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-3' })
    expect(result).toMatchObject({ status: 'failed', reason: 'timeout' })
  })

  it('rejects an invalid status enum value', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...passedOutput, status: 'QA_MAYBE' },
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-4' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/status must be/i)
  })

  it('rejects an invalid severity enum value', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...passedOutput, severity: 'catastrophic' },
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-5' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/severity must be/i)
  })

  it('rejects QA_FAILED with an empty issues array', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...failedOutput, issues: [] },
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-6' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/issues must be non-empty/i)
  })

  it('rejects a demoEvidenceSnapshotId citing evidence never supplied to the task', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...passedOutput, demoEvidenceSnapshotId: 'demo_never_supplied' },
    }))

    const result = await runQaReviewer({ runtime, evidence, taskId: 'qa-test-7' })
    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toContain('demo_never_supplied')
  })

  it('rejects an empty evidence list before contacting the runtime at all', async () => {
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    await expect(
      runQaReviewer({ runtime, evidence: [], taskId: 'qa-test-8' }),
    ).rejects.toThrow(/evidence/i)
    expect(contacted).toBe(false)
  })
})
