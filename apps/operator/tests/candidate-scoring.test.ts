import { describe, expect, it } from 'vitest'
import { auditCandidateFromMeasurement, isJudgmentPending, scoreCandidateFromHistory } from '../src/views/candidate-scoring'

/**
 * DEC-110. `scoreCandidateFromHistory` was extracted from
 * `CandidateScoreAction`'s private `scoreWith` closure without changing its
 * behavior, so this asserts what that closure was already relied on to do —
 * a regression guard for the extraction, and for the bulk pre-screen that now
 * calls the same function unattended.
 */
describe('scoreCandidateFromHistory', () => {
  const candidate = { dataId: 'listing-1', rating: 4.8, reviewCount: 120 }
  const history = {
    retrievedAt: '2026-08-09T00:00:00.000Z',
    reviews: Array.from({ length: 20 }, (_, i) => ({
      isoDate: new Date(Date.parse('2026-08-09T00:00:00.000Z') - i * 10 * 24 * 60 * 60 * 1000).toISOString(),
      rating: 5,
      text: 'Great work.',
      author: `Author ${i}`,
      ownerResponded: false,
    })),
    paginationExhausted: false,
  }

  it('throws for a candidate with no data_id, matching the guard the manual path relied on implicitly', () => {
    expect(() => scoreCandidateFromHistory({ dataId: null, rating: 5, reviewCount: 10 }, history)).toThrow('data_id')
  })

  it('scores from real inputs and defaults every judgment gate to insufficient_data when none is supplied', () => {
    const score = scoreCandidateFromHistory(candidate, history)
    expect(score.qualified).toBe(false)
    expect(score.gates.find((g) => g.id === 'G4_complaint_pattern')?.status).toBe('insufficient_data')
    expect(score.gates.find((g) => g.id === 'G5_operational_status')?.status).toBe('insufficient_data')
    expect(score.gates.find((g) => g.id === 'G6_listing_identity')?.status).toBe('insufficient_data')
  })

  it('a bulk pre-screen score is never qualified, no matter how strong the objective factors are (DEC-008)', () => {
    // High rating, high volume, plenty of recent activity — every objective
    // gate should pass, and it must still not qualify without the operator's
    // own judgment on G4-G6.
    const score = scoreCandidateFromHistory(candidate, history)
    expect(score.gates.find((g) => g.id === 'G1_rating')?.status).toBe('passed')
    expect(score.gates.find((g) => g.id === 'G2_review_count')?.status).toBe('passed')
    expect(score.qualified).toBe(false)
  })
})

describe('isJudgmentPending', () => {
  const candidate = { dataId: 'listing-1', rating: 4.8, reviewCount: 120 }
  const history = {
    retrievedAt: '2026-08-09T00:00:00.000Z',
    reviews: [{ isoDate: '2026-08-01T00:00:00.000Z', rating: 5, text: null, author: null, ownerResponded: false }],
    paginationExhausted: true,
  }

  it('is true when the judgment gates are unanswered', () => {
    const score = scoreCandidateFromHistory(candidate, history)
    expect(isJudgmentPending(score)).toBe(true)
  })

  it('is false once all three judgment gates carry a real verdict', () => {
    const score = scoreCandidateFromHistory(candidate, history, {
      complaintPattern: { verdict: 'none_found', rationale: 'Read the reviews; no unresolved complaints.' },
      operationalStatus: { verdict: 'active', rationale: 'Listing shows as open.' },
      listingIdentity: { verdict: 'confirmed', rationale: 'Address and name match.' },
    })
    expect(isJudgmentPending(score)).toBe(false)
  })
})

/**
 * DEC-111. `auditCandidateFromMeasurement` now feeds `outcome.brokenLinks`
 * into the `broken_elements` factor instead of hardcoding it `unmeasured` —
 * this is the wiring test for that, distinct from `link-crawl.test.ts`, which
 * tests the crawl itself.
 */
describe('auditCandidateFromMeasurement — broken_elements wiring (DEC-111)', () => {
  const candidate = { website: 'https://example-business.test/' }
  const baseOutcome = {
    status: 'completed' as const,
    retrievedAt: '2026-08-10T00:00:00.000Z',
    mobileAudits: null,
    obsoleteSignals: null,
    performance: { status: 'unmeasured' as const, reason: 'not measured in this test' },
    servesHttps: { status: 'measured' as const, value: true },
    telLinkFound: { status: 'unmeasured' as const, reason: 'not measured in this test' },
  }

  it('scores broken_elements as measured when a link check came back', () => {
    const { audit } = auditCandidateFromMeasurement(candidate, {
      ...baseOutcome,
      brokenLinks: { checkedLinks: 4, brokenLinks: 1, contactPath: { status: 'verified-working' } },
    })
    const factor = audit.factors.find((f) => f.id === 'broken_elements')!
    expect(factor.status).toBe('measured')
    expect(factor.score).toBeGreaterThan(0)
  })

  it('leaves broken_elements unmeasured when no same-origin link was checkable', () => {
    const { audit } = auditCandidateFromMeasurement(candidate, { ...baseOutcome, brokenLinks: null })
    const factor = audit.factors.find((f) => f.id === 'broken_elements')!
    expect(factor.status).toBe('unmeasured')
  })
})
