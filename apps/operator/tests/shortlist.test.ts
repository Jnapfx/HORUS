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
