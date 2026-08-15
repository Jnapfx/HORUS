import { describe, expect, it } from 'vitest'
import { runConceptComposer } from '../electron/agent/concept-composer-ipc'
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
  sectionOrder: ['about', 'reviews'],
  tone: 'warm',
  tagline: 'Family-run since day one',
  aboutParagraph: 'A neighborhood restaurant with a loyal following, drawn from its own public listing.',
  reviewHighlights: [{ quote: 'Best pasta in town, hands down.', evidenceSnapshotId: 'raw_2' }],
  rationale: 'This business has strong reviews worth quoting and enough detail for a short about paragraph.',
  // DEC-140. Both required since the composer gained design authority.
  palette: 'olive_brick',
  fontPairing: 'editorial',
}

describe('runConceptComposer', () => {
  it('returns a parsed, schema-validated composition for a well-formed run', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: wellFormedOutput,
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-1' })

    expect(result.status).toBe('awaiting_operator_review')
    if (result.status !== 'awaiting_operator_review') throw new Error('unreachable')
    expect(result.output.sectionOrder).toEqual(['about', 'reviews'])
    expect(result.output.reviewHighlights).toHaveLength(1)
    expect(result.record.taskId).toBe('composer-test-1')
  })

  it('passes a runtime failure straight through', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'failed',
      record: fakeRecord(task),
      reason: 'timeout',
      detail: 'The runtime exceeded its time limit.',
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-2' })

    expect(result).toMatchObject({ status: 'failed', reason: 'timeout' })
  })

  it('rejects a review quote citing evidence never supplied to the task, rather than trusting it', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: {
        ...wellFormedOutput,
        reviewHighlights: [{ quote: 'Fabricated quote.', evidenceSnapshotId: 'raw_never_supplied' }],
      },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-3' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.reason).toBe('invalid_output')
    expect(result.detail).toContain('raw_never_supplied')
  })

  it('rejects reviewHighlights when "reviews" is not in sectionOrder — content must match the sections that claim to hold it', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: {
        ...wellFormedOutput,
        sectionOrder: ['about'],
        // reviewHighlights left populated despite "reviews" being dropped from sectionOrder.
      },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-4' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/reviewHighlights must be empty/i)
  })

  it('rejects aboutParagraph left populated when "about" is not in sectionOrder', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, sectionOrder: ['reviews'] },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-5' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/aboutParagraph must be null/i)
  })

  it('rejects a duplicated section in sectionOrder', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, sectionOrder: ['about', 'about'] },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-6' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/repeats "about"/i)
  })

  it('rejects an attempt to report a score-like field, same guard as the analyst', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, sectionOrder: [], aboutParagraph: null, reviewHighlights: [], confidenceScore: 0.9 },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-7' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/confidenceScore/i)
  })

  it('rejects an empty evidence list before contacting the runtime at all', async () => {
    let contacted = false
    const runtime = runtimeThatReturns((task) => {
      contacted = true
      return { status: 'failed', record: fakeRecord(task), reason: 'evidence_missing', detail: 'unreachable' }
    })

    await expect(
      runConceptComposer({ runtime, evidence: [], taskId: 'composer-test-8' }),
    ).rejects.toThrow(/evidence/i)
    expect(contacted).toBe(false)
  })

  // DEC-140. The agent's design authority is a choice among verified sets, so
  // the boundary of that authority has to be a real edge: a value outside the
  // set is rejected outright rather than silently replaced with a default,
  // which would make an agent's design choice impossible to audit.
  it('rejects a palette outside the verified set rather than falling back to a default', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, palette: 'cream_beige' },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-9' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/palette must be one of/i)
  })

  it('rejects a font pairing outside the verified set', async () => {
    const runtime = runtimeThatReturns((task) => ({
      status: 'awaiting_operator_review',
      record: fakeRecord(task),
      output: { ...wellFormedOutput, fontPairing: 'inter' },
    }))

    const result = await runConceptComposer({ runtime, evidence, taskId: 'composer-test-10' })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') throw new Error('unreachable')
    expect(result.detail).toMatch(/fontPairing must be one of/i)
  })
})
