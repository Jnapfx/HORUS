import { describe, expect, it } from 'vitest'
import {
  PUBLISHED,
  SCORED_WITH_FACTOR_4_FLOORED,
  findByName,
  reproduce,
} from '../scripts/calibration-harness'

/**
 * DEC-086. The Phase 1 calibration figures in `CURRENT_STATE.md` were computed
 * on 2026-08-05, when charter section 9 was a specification and
 * `src/domain/reputation-scoring.ts` did not exist. DEC-068 wrote the model in
 * code and recorded, as an open follow-up, that those figures had never been
 * reproduced through it.
 *
 * This is that reproduction, made permanent. It reads only cached raw evidence,
 * so it spends nothing and can run on every commit. If a future change to
 * `reputation-scoring-v1` stops agreeing with the calibration the project's
 * threshold conclusions rest on, this fails.
 *
 * Note what is *not* claimed: this reproduces `scoreLowerBound`, not
 * qualification. G4, G5 and G6 are judgment-dependent (charter 9.5, DEC-008),
 * no operator has assessed this historical evidence, and so every reconstructed
 * business is correctly `qualified: false`.
 */

const scored = reproduce()

describe('DEC-086 — the cached evidence is still readable', () => {
  it('reconstructs businesses from the retained raw responses', () => {
    expect(scored.length).toBeGreaterThan(30)
  })

  it('scores every reconstructed business against its own retrieval timestamp', () => {
    // Charter 9.7. If any of these were computed against the current clock, the
    // reproduction would drift as the wall clock advanced and this suite would
    // start failing on a date rather than on a code change.
    for (const { business } of scored) {
      expect(business.retrievedAt, business.title).toMatch(/^2026-08-0[56]T/)
    }
  })

  it('never converts a retrieval limit into a negative score', () => {
    // Hard rule 6 / charter 9.6: a sample proves presence, never absence.
    for (const { business, result } of scored) {
      expect(result.scoreLowerBound, business.title).toBeGreaterThan(0)
      expect(result.qualified, business.title).toBe(false)
    }
  })
})

describe('DEC-086 — complete-data figures reproduce exactly', () => {
  const exact = Object.entries(PUBLISHED).filter(([name]) => !SCORED_WITH_FACTOR_4_FLOORED.has(name))

  it.each(exact)('%s reproduces its published score of %s', (name, published) => {
    const hit = findByName(scored, name)
    expect(hit, `${name} is missing from the cached evidence`).toBeDefined()
    expect(hit!.result.scoreLowerBound).toBeCloseTo(published, 1)
  })
})

describe('DEC-086 — the partial-history figures differ by exactly their Factor-4 award', () => {
  /**
   * `CURRENT_STATE.md`, verbatim: the 8 partial histories were "scored
   * conservatively with Factor 4 at zero and Factor 5 as `longevity_unknown`".
   *
   * This reproduction does not apply that conservative floor, so each of these
   * must come out higher by exactly its Factor-4 award — and by nothing else.
   * That is a much stronger statement than "the numbers are close": it says the
   * entire difference is one documented policy choice, with no unexplained
   * residue anywhere in the model.
   */
  it.each([...SCORED_WITH_FACTOR_4_FLOORED])('%s differs by precisely its Factor-4 points', (name) => {
    const hit = findByName(scored, name)
    expect(hit, `${name} is missing from the cached evidence`).toBeDefined()

    const delta = hit!.result.scoreLowerBound - PUBLISHED[name]
    const factor4 = hit!.result.factors.find((factor) => factor.id === 'recent_consistency')

    expect(factor4, 'recent_consistency factor is missing').toBeDefined()
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeCloseTo(factor4!.score, 1)
  })

  it('leaves no unexplained residue once the floor is applied', () => {
    for (const name of SCORED_WITH_FACTOR_4_FLOORED) {
      const hit = findByName(scored, name)!
      const factor4 = hit.result.factors.find((factor) => factor.id === 'recent_consistency')!
      const floored = hit.result.scoreLowerBound - factor4.score
      expect(floored, `${name} with Factor 4 floored`).toBeCloseTo(PUBLISHED[name], 1)
    }
  })
})
