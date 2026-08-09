import { describe, expect, it, vi } from 'vitest'
import { createClaudeCodeRuntime, type SpawnResult } from '../electron/agent/runtime'
import { runOpportunityAnalyst } from '../electron/agent/analyst-ipc'

/**
 * DEC-100. Phase 6's exit criterion, made executable.
 *
 * `ROADMAP.md` requires that "Claude unavailability is recoverable without
 * corrupting state". `classifyFailure` was already well covered for
 * *classifying* a failure (DEC-049), but nothing asserted the property the
 * exit criterion actually names: that a failed run leaves nothing behind and
 * that the next run can still succeed.
 *
 * The distinction matters because the failure modes here are ordinary and
 * expected — a laptop offline, a subscription limit reached, an operator
 * logged out — not exotic. A run that half-wrote a draft on the way down
 * would leave the operator reading agent output that no completed run ever
 * produced.
 */

const EVIDENCE = [{ snapshotId: 'raw_1', source: 'serpapi.google_maps', retrievedAt: '2026-08-09T00:00:00.000Z' }]

const SUCCESS_OUTPUT = JSON.stringify({
  structured_output: { observations: [], proposedForReview: [], missingInformation: [] },
  session_id: 's1',
  total_cost_usd: 0,
  num_turns: 1,
})

/** Every way the runtime can be unavailable, as `classifyFailure` reads them. */
const FAILURES: ReadonlyArray<{ label: string; result: SpawnResult }> = [
  { label: 'not installed', result: { code: 127, stdout: '', stderr: 'command not found: claude' } },
  { label: 'not logged in', result: { code: 1, stdout: '', stderr: 'You are not logged in' } },
  { label: 'usage limit reached', result: { code: 1, stdout: '', stderr: 'Usage limit reached' } },
  { label: 'timed out', result: { code: null as unknown as number, stdout: '', stderr: '', timedOut: true } },
  { label: 'cancelled', result: { code: 143, stdout: '', stderr: '' } },
]

function runtimeReturning(results: SpawnResult[]) {
  let call = 0
  const prepared: string[] = []
  return {
    prepared,
    runtime: createClaudeCodeRuntime({
      spawnImpl: async () => results[Math.min(call++, results.length - 1)],
      prepareWorkingDirectory: async (label: string) => {
        prepared.push(label)
        return `/tmp/horus-test-${label}`
      },
    }),
  }
}

describe('DEC-100 — an unavailable runtime writes nothing', () => {
  it.each(FAILURES)('leaves no draft behind when the runtime is $label', async ({ result }) => {
    const saveDraft = vi.fn(() => ({ id: 'should-never-happen' }))
    const { runtime } = runtimeReturning([result])

    const outcome = await runOpportunityAnalyst({
      runtime,
      evidence: EVIDENCE,
      taskId: 'task-1',
      saveDraft,
    })

    expect(outcome.status).toBe('failed')
    expect(saveDraft, 'a failed run persisted a draft').not.toHaveBeenCalled()
  })

  it('reports the reason rather than a generic error, so the operator can act on it', async () => {
    for (const failure of FAILURES) {
      const { runtime } = runtimeReturning([failure.result])
      const outcome = await runOpportunityAnalyst({ runtime, evidence: EVIDENCE, taskId: 't' })
      expect(outcome.status, failure.label).toBe('failed')
      expect(outcome.status === 'failed' && outcome.reason, failure.label).toBeTruthy()
    }
  })

  it('never returns output alongside a failure', async () => {
    // A partially-populated result is how a failed run turns into a claim
    // nobody made.
    const { runtime } = runtimeReturning([FAILURES[0].result])
    const outcome = await runOpportunityAnalyst({ runtime, evidence: EVIDENCE, taskId: 't' })
    expect(outcome).not.toHaveProperty('output')
  })
})

describe('DEC-100 — recovery', () => {
  it('succeeds on the next run after a failure, with no residue from it', async () => {
    // The whole exit criterion in one test: unavailable, then available, and
    // the second run behaves as if the first had never happened.
    const saveDraft = vi.fn(() => ({ id: 'draft-1' }))
    const { runtime } = runtimeReturning([
      { code: 1, stdout: '', stderr: 'You are not logged in' },
      { code: 0, stdout: SUCCESS_OUTPUT, stderr: '' },
    ])

    const first = await runOpportunityAnalyst({ runtime, evidence: EVIDENCE, taskId: 'task-1', saveDraft })
    expect(first.status).toBe('failed')
    expect(saveDraft).not.toHaveBeenCalled()

    const second = await runOpportunityAnalyst({ runtime, evidence: EVIDENCE, taskId: 'task-2', saveDraft })
    expect(second.status).toBe('awaiting_operator_review')
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('does not poison the runtime — availability is re-checked, not remembered', async () => {
    const { runtime } = runtimeReturning([
      { code: 127, stdout: '', stderr: 'command not found: claude' },
      { code: 0, stdout: 'claude 1.0.0', stderr: '' },
    ])
    expect((await runtime.checkAvailability()).available).toBe(false)
    expect((await runtime.checkAvailability()).available).toBe(true)
  })

  it('isolates each attempt in its own working directory', async () => {
    // DEC-057: the agent never runs in the repository. A failed run must not
    // leave the next one sharing its directory either.
    const { runtime, prepared } = runtimeReturning([
      { code: 1, stdout: '', stderr: 'You are not logged in' },
      { code: 0, stdout: SUCCESS_OUTPUT, stderr: '' },
    ])
    await runOpportunityAnalyst({ runtime, evidence: EVIDENCE, taskId: 'task-1' })
    await runOpportunityAnalyst({ runtime, evidence: EVIDENCE, taskId: 'task-2' })
    expect(new Set(prepared).size).toBe(prepared.length)
  })
})
