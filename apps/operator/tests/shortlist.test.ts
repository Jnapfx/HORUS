import { describe, expect, it } from 'vitest'
import { buildShortlist, type ShortlistCandidateInput } from '../src/domain/shortlist'

const base = (overrides: Partial<ShortlistCandidateInput>): ShortlistCandidateInput => ({
  id: 'c1',
  qualified: true,
  reputationScoreLowerBound: 75,
  webOpportunityScoreLowerBound: 40,
  proximityBand: 'within_5_miles',
  ...overrides,
})

describe('buildShortlist', () => {
  it('excludes a candidate that is not reputation-qualified, never ranking it (charter §11, DEC-013)', () => {
    const result = buildShortlist([base({ id: 'a', qualified: false })])
    expect(result.ranked).toHaveLength(0)
    expect(result.excluded).toEqual([{ candidate: expect.objectContaining({ id: 'a' }), reason: 'not_reputation_qualified' }])
  })

  it('excludes a qualified candidate with no proximity data rather than guessing a band', () => {
    const result = buildShortlist([base({ id: 'a', proximityBand: null })])
    expect(result.ranked).toHaveLength(0)
    expect(result.excluded[0]).toMatchObject({ reason: 'no_proximity_data' })
  })

  it('excludes a qualified candidate with no web-opportunity measurement rather than assuming a score', () => {
    const result = buildShortlist([base({ id: 'a', webOpportunityScoreLowerBound: null })])
    expect(result.ranked).toHaveLength(0)
    expect(result.excluded[0]).toMatchObject({ reason: 'no_web_opportunity_data' })
  })

  it('ranks a nearer proximity band above a farther one regardless of web-opportunity score (DEC-017)', () => {
    const result = buildShortlist([
      base({ id: 'far-but-high-opportunity', proximityBand: 'within_30_miles', webOpportunityScoreLowerBound: 90 }),
      base({ id: 'near-but-low-opportunity', proximityBand: 'within_5_miles', webOpportunityScoreLowerBound: 10 }),
    ])
    expect(result.ranked.map((r) => r.id)).toEqual(['near-but-low-opportunity', 'far-but-high-opportunity'])
    expect(result.ranked[0].rank).toBe(1)
    expect(result.ranked[1].rank).toBe(2)
  })

  it('ranks higher web-opportunity (weaker web presence, more room to improve) above lower, within the same band', () => {
    const result = buildShortlist([
      base({ id: 'weaker-site', proximityBand: 'within_5_miles', webOpportunityScoreLowerBound: 70 }),
      base({ id: 'stronger-site', proximityBand: 'within_5_miles', webOpportunityScoreLowerBound: 20 }),
    ])
    expect(result.ranked.map((r) => r.id)).toEqual(['weaker-site', 'stronger-site'])
  })

  it('breaks a same-band, same-web-opportunity tie with reputation (DEC-013)', () => {
    const result = buildShortlist([
      base({ id: 'lower-reputation', proximityBand: 'within_5_miles', webOpportunityScoreLowerBound: 50, reputationScoreLowerBound: 71 }),
      base({ id: 'higher-reputation', proximityBand: 'within_5_miles', webOpportunityScoreLowerBound: 50, reputationScoreLowerBound: 88 }),
    ])
    expect(result.ranked.map((r) => r.id)).toEqual(['higher-reputation', 'lower-reputation'])
  })

  it('rejects duplicate candidate ids rather than silently ranking one of them', () => {
    expect(() => buildShortlist([base({ id: 'dup' }), base({ id: 'dup' })])).toThrow('distinct ids')
  })

  it('returns an empty shortlist for no candidates, not an error', () => {
    expect(buildShortlist([])).toEqual({ ranked: [], excluded: [] })
  })
})

describe('DEC-103 — never assessed is not the same as assessed and short', () => {
  const base = { proximityBand: 'within_5_miles' as const, webOpportunityScoreLowerBound: 50 }

  it('reports a candidate whose reputation was never scored as not assessed', () => {
    // The screen that prompted this showed ten businesses all reading
    // "not_reputation_qualified" when nine had never been looked at.
    const result = buildShortlist([
      { id: 'never-scored', qualified: false, reputationScoreLowerBound: null, ...base },
    ])
    expect(result.excluded[0].reason).toBe('reputation_not_assessed')
  })

  it('still reports a scored candidate below the threshold as not qualified', () => {
    const result = buildShortlist([
      { id: 'scored-low', qualified: false, reputationScoreLowerBound: 53.5, ...base },
    ])
    expect(result.excluded[0].reason).toBe('not_reputation_qualified')
  })

  it('keeps the two apart in one shortlist', () => {
    const result = buildShortlist([
      { id: 'never-scored', qualified: false, reputationScoreLowerBound: null, ...base },
      { id: 'scored-low', qualified: false, reputationScoreLowerBound: 53.5, ...base },
    ])
    expect(result.excluded.map((exclusion) => exclusion.reason))
      .toEqual(['reputation_not_assessed', 'not_reputation_qualified'])
  })

  it('does not let a missing score hide a genuine qualification', () => {
    // A scored, qualified candidate must still rank — the new branch checks
    // for an absent score, not for an unqualified one.
    const result = buildShortlist([
      { id: 'good', qualified: true, reputationScoreLowerBound: 88, ...base },
    ])
    expect(result.ranked).toHaveLength(1)
  })
})

describe('DEC-110 — awaiting judgment is not the same as scored and short', () => {
  const base = { proximityBand: 'within_5_miles' as const, webOpportunityScoreLowerBound: 50 }

  it('reports a scored candidate whose judgment gates are unanswered as awaiting judgment, not not-qualified', () => {
    const result = buildShortlist([
      { id: 'high-but-unjudged', qualified: false, reputationScoreLowerBound: 85, judgmentPending: true, ...base },
    ])
    expect(result.excluded[0].reason).toBe('reputation_awaiting_judgment')
  })

  it('still reports a scored, judged candidate below threshold as not qualified', () => {
    const result = buildShortlist([
      { id: 'judged-low', qualified: false, reputationScoreLowerBound: 53.5, judgmentPending: false, ...base },
    ])
    expect(result.excluded[0].reason).toBe('not_reputation_qualified')
  })

  it('defaults to not-qualified when judgmentPending is not supplied, so every existing caller is unaffected', () => {
    const result = buildShortlist([
      { id: 'legacy-caller', qualified: false, reputationScoreLowerBound: 53.5, ...base },
    ])
    expect(result.excluded[0].reason).toBe('not_reputation_qualified')
  })
})
