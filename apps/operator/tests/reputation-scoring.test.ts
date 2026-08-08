import { describe, expect, it } from 'vitest'
import { buildReputationScore, DEFAULT_QUALIFICATION_THRESHOLD, screenListingGates, type ReputationScoringInput } from '../src/domain/reputation-scoring'

const measured = <T>(value: T) => ({ status: 'measured' as const, value })
const unmeasured = (reason: string) => ({ status: 'unmeasured' as const, reason })
// Round-half-up to one decimal, matching how charter 9.3's reference table displays points —
// vitest's toBeCloseTo(x, 1) rejects exact .05 boundary cases (e.g. 1.25 vs 1.3) that round-half-up accepts.
const roundedTo1dp = (value: number) => Math.round(value * 10 + Number.EPSILON) / 10

function baseInput(overrides: Partial<ReputationScoringInput> = {}): ReputationScoringInput {
  return {
    listingId: 'listing-1',
    retrievedAt: '2026-08-05T00:00:00.000Z',
    rating: measured(4.7),
    reviewCount: measured(120),
    recentActivity: {
      reviewsLast90Days: measured({ count: 10, sampleCompleteness: 'complete' }),
      reviewsLast365Days: measured({ count: 30, sampleCompleteness: 'complete' }),
      daysSinceLatestReview: measured(5),
    },
    recentConsistency: measured({ trailingYearMeanRating: 4.7, trailingYearReviewCount: 30 }),
    longevity: measured({ historySpanYears: 6 }),
    complaintPattern: { status: 'none_found', evidence: 'No recurring complaint pattern found in retrieved reviews.' },
    operationalStatus: { status: 'active', evidence: 'Listing shows normal operating hours and no closure notice.' },
    listingIdentity: { status: 'confirmed', evidence: 'Address and phone number match the retrieved listing.' },
    market: { status: 'within_target', evidence: 'Address is within Stamford, CT.' },
    ...overrides,
  }
}

describe('reputation scoring — charter 9.3 reference profiles', () => {
  it('4.5 rating, 30 reviews, 12/yr, steady, 2 years — 39.7 total', () => {
    const score = buildReputationScore(baseInput({
      rating: measured(4.5),
      reviewCount: measured(30),
      recentActivity: {
        reviewsLast90Days: measured({ count: 3, sampleCompleteness: 'complete' }),
        reviewsLast365Days: measured({ count: 12, sampleCompleteness: 'complete' }),
        daysSinceLatestReview: measured(5),
      },
      recentConsistency: measured({ trailingYearMeanRating: 4.5, trailingYearReviewCount: 12 }),
      longevity: measured({ historySpanYears: 2 }),
    }))
    expect(score.factors.find((f) => f.id === 'average_rating')?.score).toBeCloseTo(14.0, 1)
    expect(score.factors.find((f) => f.id === 'review_volume')?.score).toBeCloseTo(1.6, 1)
    expect(score.factors.find((f) => f.id === 'review_recency')?.score).toBeCloseTo(7.8, 1)
    expect(score.factors.find((f) => f.id === 'recent_consistency')?.score).toBeCloseTo(15.0, 1)
    expect(roundedTo1dp(score.factors.find((f) => f.id === 'longevity_evidence')?.score ?? NaN)).toBe(1.3)
    expect(score.scoreLowerBound).toBeCloseTo(39.7, 0)
  })

  it('4.7 rating, 85 reviews, 22/yr, delta -0.1, 6 years — 67.0 total', () => {
    const score = buildReputationScore(baseInput({
      rating: measured(4.7),
      reviewCount: measured(85),
      recentActivity: {
        reviewsLast90Days: measured({ count: 6, sampleCompleteness: 'complete' }),
        reviewsLast365Days: measured({ count: 22, sampleCompleteness: 'complete' }),
        daysSinceLatestReview: measured(5),
      },
      recentConsistency: measured({ trailingYearMeanRating: 4.6, trailingYearReviewCount: 22 }),
      longevity: measured({ historySpanYears: 6 }),
    }))
    expect(score.factors.find((f) => f.id === 'average_rating')?.score).toBeCloseTo(24.5, 1)
    expect(score.factors.find((f) => f.id === 'review_volume')?.score).toBeCloseTo(11.0, 1)
    expect(score.factors.find((f) => f.id === 'review_recency')?.score).toBeCloseTo(14.0, 1)
    expect(score.factors.find((f) => f.id === 'recent_consistency')?.score).toBeCloseTo(12.5, 1)
    expect(score.factors.find((f) => f.id === 'longevity_evidence')?.score).toBeCloseTo(5.0, 1)
    expect(score.scoreLowerBound).toBeCloseTo(67.0, 0)
  })

  it('4.7 rating, 120 reviews, 30/yr, steady, 6 years — 75.7 total, qualifies at the default threshold', () => {
    const score = buildReputationScore(baseInput())
    expect(score.factors.find((f) => f.id === 'average_rating')?.score).toBeCloseTo(24.5, 1)
    expect(score.factors.find((f) => f.id === 'review_volume')?.score).toBeCloseTo(14.1, 1)
    expect(score.factors.find((f) => f.id === 'review_recency')?.score).toBeCloseTo(17.1, 1)
    expect(score.factors.find((f) => f.id === 'recent_consistency')?.score).toBeCloseTo(15.0, 1)
    expect(score.factors.find((f) => f.id === 'longevity_evidence')?.score).toBeCloseTo(5.0, 1)
    expect(score.scoreLowerBound).toBeCloseTo(75.7, 0)
    expect(score.qualified).toBe(true)
    expect(score.qualificationThreshold).toBe(DEFAULT_QUALIFICATION_THRESHOLD)
  })

  it('4.8 rating, 220 reviews, 45/yr, steady, 8 years — 89.4 total', () => {
    const score = buildReputationScore(baseInput({
      rating: measured(4.8),
      reviewCount: measured(220),
      recentActivity: {
        reviewsLast90Days: measured({ count: 12, sampleCompleteness: 'complete' }),
        reviewsLast365Days: measured({ count: 45, sampleCompleteness: 'complete' }),
        daysSinceLatestReview: measured(2),
      },
      recentConsistency: measured({ trailingYearMeanRating: 4.8, trailingYearReviewCount: 45 }),
      longevity: measured({ historySpanYears: 8 }),
    }))
    expect(roundedTo1dp(score.factors.find((f) => f.id === 'average_rating')?.score ?? NaN)).toBe(29.8)
    expect(score.factors.find((f) => f.id === 'review_volume')?.score).toBeCloseTo(19.6, 1)
    expect(score.factors.find((f) => f.id === 'review_recency')?.score).toBeCloseTo(20.0, 1)
    expect(score.scoreLowerBound).toBeCloseTo(89.4, 0)
  })
})

describe('reputation scoring — calibration regression (CURRENT_STATE.md, 2026-08-05 review-volume saturation check)', () => {
  it('reproduces the three documented review-volume boundary points from real listing review counts', () => {
    const tuffLawn = buildReputationScore(baseInput({ reviewCount: measured(314) })).factors.find((f) => f.id === 'review_volume')!.score
    const cincoDeMayo = buildReputationScore(baseInput({ reviewCount: measured(392) })).factors.find((f) => f.id === 'review_volume')!.score
    const teedAndBrown = buildReputationScore(baseInput({ reviewCount: measured(435) })).factors.find((f) => f.id === 'review_volume')!.score
    expect(tuffLawn).toBeCloseTo(22.8, 1)
    expect(cincoDeMayo).toBeCloseTo(24.8, 1)
    expect(teedAndBrown).toBeCloseTo(25.0, 1)
  })
})

describe('reputation scoring — gates, missing-data principle, and auto-reject', () => {
  it('passes G3 from a partial sample that already proves enough recent activity (charter 9.6)', () => {
    const score = buildReputationScore(baseInput({
      recentActivity: {
        reviewsLast90Days: measured({ count: 4, sampleCompleteness: 'partial_data' }),
        reviewsLast365Days: unmeasured('Pagination stopped after the 90-day window.'),
        daysSinceLatestReview: measured(3),
      },
    }))
    expect(score.gates.find((g) => g.id === 'G3_recency')?.status).toBe('passed')
  })

  it('never fails G3 from an incomplete sample that has not yet proven enough (insufficient_data, not a rejection)', () => {
    const score = buildReputationScore(baseInput({
      recentActivity: {
        reviewsLast90Days: measured({ count: 1, sampleCompleteness: 'partial_data' }),
        reviewsLast365Days: measured({ count: 4, sampleCompleteness: 'partial_data' }),
        daysSinceLatestReview: measured(3),
      },
    }))
    expect(score.gates.find((g) => g.id === 'G3_recency')?.status).toBe('insufficient_data')
    expect(score.autoReject).toBeNull()
    expect(score.qualified).toBe(false)
  })

  it('fails G3 only once the complete sample proves the thresholds are not met', () => {
    const score = buildReputationScore(baseInput({
      recentActivity: {
        reviewsLast90Days: measured({ count: 1, sampleCompleteness: 'complete' }),
        reviewsLast365Days: measured({ count: 4, sampleCompleteness: 'complete' }),
        daysSinceLatestReview: measured(200),
      },
    }))
    expect(score.gates.find((g) => g.id === 'G3_recency')?.status).toBe('failed')
    expect(score.autoReject).toMatchObject({ condition: 'recency_requirement_not_met_on_complete_data' })
    expect(score.qualified).toBe(false)
  })

  it('returns insufficient_data, not a poor score, when rating is unavailable', () => {
    const score = buildReputationScore(baseInput({ rating: unmeasured('Listing did not return a rating field.') }))
    expect(score.status).toBe('insufficient_data')
    expect(score.factors).toHaveLength(0)
    expect(score.qualified).toBe(false)
    expect(score.autoReject).toBeNull()
  })

  it('auto-rejects on closed status, an objective condition, distinct from a judgment flag', () => {
    const score = buildReputationScore(baseInput({
      operationalStatus: { status: 'closed_or_permanently_closed', evidence: 'Listing displays "Permanently closed."' },
    }))
    expect(score.autoReject).toMatchObject({ condition: 'listing_closed_or_permanently_closed' })
    expect(score.qualified).toBe(false)
  })

  it('does not auto-reject a suspected complaint pattern (G4); it fails the gate and is surfaced as a flag for operator review (DEC-008)', () => {
    const score = buildReputationScore(baseInput({
      complaintPattern: { status: 'pattern_found', evidence: 'Six reviews in the last quarter describe unfinished work.' },
    }))
    expect(score.autoReject).toBeNull()
    expect(score.gates.find((g) => g.id === 'G4_complaint_pattern')?.status).toBe('failed')
    expect(score.qualified).toBe(false)
    expect(score.flags.some((f) => f.startsWith('suspected_complaint_pattern'))).toBe(true)
  })

  it('does not qualify a business below the threshold even with every gate passed', () => {
    const score = buildReputationScore(baseInput({
      rating: measured(4.5),
      reviewCount: measured(26),
      recentActivity: {
        reviewsLast90Days: measured({ count: 3, sampleCompleteness: 'complete' }),
        reviewsLast365Days: measured({ count: 10, sampleCompleteness: 'complete' }),
        daysSinceLatestReview: measured(200),
      },
      recentConsistency: unmeasured('Fewer than 5 trailing-year reviews retrieved.'),
      longevity: unmeasured('No earliest-review date retrievable.'),
    }))
    expect(score.gates.every((g) => g.status === 'passed')).toBe(true)
    expect(score.scoreLowerBound).toBeLessThan(DEFAULT_QUALIFICATION_THRESHOLD)
    expect(score.qualified).toBe(false)
    expect(score.flags).toContain('consistency_unverified')
    expect(score.flags).toContain('longevity_unknown')
  })

  it('raises reputation_decline and recent_rating_below_gate together for a sharp decline', () => {
    const score = buildReputationScore(baseInput({
      rating: measured(4.7),
      recentConsistency: measured({ trailingYearMeanRating: 4.0, trailingYearReviewCount: 12 }),
    }))
    expect(score.factors.find((f) => f.id === 'recent_consistency')?.score).toBe(0)
    expect(score.flags).toContain('reputation_decline')
    expect(score.flags).toContain('recent_rating_below_gate')
  })

  it('rejects a recent-consistency value computed from fewer than 5 reviews rather than silently accepting it', () => {
    expect(() => buildReputationScore(baseInput({
      recentConsistency: measured({ trailingYearMeanRating: 4.9, trailingYearReviewCount: 2 }),
    }))).toThrow('at least 5')
  })

  it('auto-rejects a duplicate listing and an out-of-market listing', () => {
    const duplicate = buildReputationScore(baseInput({ duplicateOfListingId: 'listing-0' }))
    expect(duplicate.autoReject).toMatchObject({ condition: 'duplicate_listing' })

    const outsideMarket = buildReputationScore(baseInput({ market: { status: 'outside_target', evidence: 'Address is in Danbury, outside Stamford/Norwalk.' } }))
    expect(outsideMarket.autoReject).toMatchObject({ condition: 'outside_target_market' })
  })

  it('screenListingGates checks only G1/G2 from bare listing fields, and never claims qualification', () => {
    const both = screenListingGates({ rating: 4.7, reviewCount: 120 })
    expect(both.g1.status).toBe('passed')
    expect(both.g2.status).toBe('passed')

    const failsBoth = screenListingGates({ rating: 4.2, reviewCount: 10 })
    expect(failsBoth.g1.status).toBe('failed')
    expect(failsBoth.g2.status).toBe('failed')

    const missing = screenListingGates({ rating: null, reviewCount: null })
    expect(missing.g1.status).toBe('insufficient_data')
    expect(missing.g2.status).toBe('insufficient_data')
  })

  it('passes through operator-flagged signals the model has no rule to detect', () => {
    const score = buildReputationScore(baseInput({
      additionalOperatorFlags: [{ flag: 'franchise_ownership', evidence: 'Listing shares branding with a five-location regional chain.' }],
    }))
    expect(score.flags.some((f) => f.startsWith('franchise_ownership'))).toBe(true)
    expect(score.autoReject).toBeNull()
  })
})
