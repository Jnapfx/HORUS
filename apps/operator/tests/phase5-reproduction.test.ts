import { describe, expect, it } from 'vitest'
import { readFinescape, readSeasonsEats, reproducePhase5, scoreCase } from '../scripts/phase5-harness'

/**
 * DEC-087. The Phase 5 companion to DEC-086's calibration reproduction.
 *
 * Both published Phase 5 figures were computed before `reputation-scoring-v1`
 * existed as code, and both carry real consequences: Finescape's 48.1 is why a
 * published concept was retired, and SEASONS EATS' 73.06 is why the project's
 * only real prospect was approved for a public concept and outreach. Those are
 * the two most consequential numbers the project has ever produced, and until
 * now no running code had produced either.
 *
 * Reads only retained evidence in `cache/phase5/`. Spends nothing.
 */

const scored = reproducePhase5()

describe('DEC-087 — the Phase 5 figures reproduce', () => {
  it('Finescape and Sons reproduces its published 48.1', () => {
    const hit = scored.find(({ input }) => input.name.startsWith('Finescape'))!
    expect(hit.result.scoreLowerBound).toBeCloseTo(48.1, 1)
  })

  it('SEASONS EATS reproduces its published 73.06', () => {
    const hit = scored.find(({ input }) => input.name === 'SEASONS EATS')!
    // Matches to the hundredth, not merely to the tenth.
    expect(hit.result.scoreLowerBound).toBeCloseTo(73.06, 2)
  })
})

describe('DEC-087 — two AGENT_ARCHITECTURE §11 acceptance criteria, on the deterministic side', () => {
  /**
   * §11 lists these among the conditions for completing the agent evaluation.
   * They are stated there about the shadow replay; what is asserted here is
   * only their deterministic half — that the scoring model itself produces the
   * outcome the criterion depends on. The agent-behaviour half was exercised
   * live in DEC-064 and is not re-checked here.
   */

  it('"Finescape remains below qualification and cannot advance to outreach"', () => {
    const hit = scored.find(({ input }) => input.name.startsWith('Finescape'))!
    expect(hit.result.scoreLowerBound).toBeLessThan(hit.result.qualificationThreshold)
    expect(hit.result.qualified).toBe(false)
  })

  it('"the SEASONS EATS replay preserves the recorded qualification uncertainty"', () => {
    const hit = scored.find(({ input }) => input.name === 'SEASONS EATS')!
    // Above the threshold on points, and still not qualified — because G4, G5
    // and G6 need an operator, not a model (charter 9.5, DEC-008). This is the
    // same shape DEC-073 confirmed live with TwoGen at 71.1, and it is the
    // single most important behaviour in the scoring module: a high number is
    // never on its own an approval.
    expect(hit.result.scoreLowerBound).toBeGreaterThan(hit.result.qualificationThreshold)
    expect(hit.result.qualified).toBe(false)
    const judgmentGates = hit.result.gates.filter((gate) => ['G4', 'G5', 'G6'].some((id) => gate.id.startsWith(id)))
    expect(judgmentGates).toHaveLength(3)
    for (const gate of judgmentGates) {
      expect(gate.status, gate.id).toBe('insufficient_data')
    }
  })
})

describe('DEC-087 — the evidence is read as retained, not as convenient', () => {
  it('scores each case against its own stored retrieval timestamp', () => {
    // Charter 9.7. Both timestamps come from `raw_snapshots.retrieved_at`; the
    // SEASONS EATS artifact does not carry one in the file at all.
    expect(readFinescape().retrievedAt).toBe('2026-08-06T23:48:43.000Z')
    expect(readSeasonsEats().retrievedAt).toBe('2026-08-07T02:37:55.856Z')
  })

  it('treats an unexhausted history as partial rather than complete', () => {
    // Hard rule 6: neither retrieval ran out of history, so neither may be
    // reported as a full picture, however good the number looks.
    for (const { input, result } of scored) {
      expect(input.paginationExhausted, input.name).toBe(false)
      expect(result.status, input.name).toBe('partial_data')
    }
  })

  it('is a pure function of the retained evidence', () => {
    // Same input, same answer — no clock, no network, no ambient state.
    for (const { input, result } of scored) {
      expect(scoreCase(input).scoreLowerBound).toBe(result.scoreLowerBound)
    }
  })
})
