import type { Measurement } from './web-opportunity-audit'

export const REPUTATION_MODEL_VERSION = 'reputation-scoring-v1' as const

/**
 * Charter section 9.1's default qualification threshold. Configurable per
 * DEC-007 — "all thresholds and curve parameters are configurable" — but a
 * change to this value produces a new model version rather than silently
 * mutating v1's meaning (DEC-007, DEC-011's versioning rule).
 */
export const DEFAULT_QUALIFICATION_THRESHOLD = 70

export type GateId =
  | 'G1_rating'
  | 'G2_review_count'
  | 'G3_recency'
  | 'G4_complaint_pattern'
  | 'G5_operational_status'
  | 'G6_listing_identity'

export type GateResult = {
  id: GateId
  status: 'passed' | 'failed' | 'insufficient_data'
  evidence: string
}

export type ReputationFactorId =
  | 'average_rating'
  | 'review_volume'
  | 'review_recency'
  | 'recent_consistency'
  | 'longevity_evidence'

export type ReputationFactor = {
  id: ReputationFactorId
  score: number
  maximum: number
  status: 'measured' | 'unmeasured'
  evidence: readonly string[]
}

/**
 * A count derived from a review-history sample, together with whether the
 * retrieval that produced it covered the full window the count claims to
 * describe. Charter 9.6: "a sample can prove presence, never absence" — a
 * `partial_data` count may still satisfy a gate by proving enough activity
 * exists, but it may never be read as proof that activity is absent.
 */
export type SampledCount = { count: number; sampleCompleteness: 'complete' | 'partial_data' }

export type ComplaintPatternAssessment =
  | { status: 'none_found'; evidence: string }
  | { status: 'pattern_found'; evidence: string }
  | { status: 'insufficient_data'; evidence: string }

export type OperationalStatusAssessment =
  | { status: 'active'; evidence: string }
  | { status: 'closed_or_permanently_closed'; evidence: string }
  | { status: 'insufficient_data'; evidence: string }

export type ListingIdentityAssessment =
  | { status: 'confirmed'; evidence: string }
  | { status: 'mismatch'; evidence: string }
  | { status: 'insufficient_data'; evidence: string }

export type MarketAssessment = { status: 'within_target' | 'outside_target'; evidence: string }

export type ReputationScoringInput = {
  listingId: string
  retrievedAt: string
  /** The listing's published average, at Google's precision. Never a value computed from a retrieved sample (charter 9.2). */
  rating: Measurement<number>
  /** Total published review count on the listing, not the number of reviews retrieved (charter 9.2, Factor 2). */
  reviewCount: Measurement<number>
  recentActivity: {
    reviewsLast90Days: Measurement<SampledCount>
    reviewsLast365Days: Measurement<SampledCount>
    daysSinceLatestReview: Measurement<number>
  }
  /** Requires at least 5 reviews in the trailing-365-day window (charter 9.2, Factor 4). Mark `unmeasured` rather than supplying a value from fewer. */
  recentConsistency: Measurement<{ trailingYearMeanRating: number; trailingYearReviewCount: number }>
  longevity: Measurement<{ historySpanYears: number }>
  /** G4. Judgment-dependent per charter 9.5 — never auto-rejects on its own (DEC-008). */
  complaintPattern: ComplaintPatternAssessment
  /** G5. Objective only for the closed/permanently-closed case charter 9.4 names explicitly. */
  operationalStatus: OperationalStatusAssessment
  /** G6. Confirms the reviews and listing belong to the actual business and location. */
  listingIdentity: ListingIdentityAssessment
  market: MarketAssessment
  duplicateOfListingId?: string
  /** Charter 9.6: relative timestamps ("3 months ago") bucketed conservatively must be flagged, not treated as precise. */
  datesImprecise?: { applies: boolean; evidence: string }
  /**
   * Judgment-dependent signals charter 9.5 lists but this module has no rule to detect
   * (franchise ownership, suspected review manipulation, recently renamed listing, and
   * so on). Passed through verbatim rather than fabricating a detection capability that
   * does not exist (see CURRENT_STATE.md "Undefined capabilities").
   */
  additionalOperatorFlags?: readonly { flag: string; evidence: string }[]
  qualificationThreshold?: number
}

export type ReputationScore = {
  modelVersion: typeof REPUTATION_MODEL_VERSION
  listingId: string
  retrievedAt: string
  status: 'complete_data' | 'partial_data' | 'insufficient_data'
  gates: readonly GateResult[]
  autoReject: { condition: string; evidence: string } | null
  factors: readonly ReputationFactor[]
  scoreLowerBound: number
  qualificationThreshold: number
  /**
   * HORUS's own proposed determination from this model alone. `false` covers
   * both an objective auto-reject and a gate that failed or came back
   * insufficient_data, including G4 (judgment-dependent). Per DEC-008, a
   * judgment-dependent gate failing here is surfaced as a flag with evidence —
   * it is not the same as `autoReject`, and nothing in this module publishes,
   * contacts, or otherwise treats it as final; the operator retains the
   * decision downstream.
   */
  qualified: boolean
  flags: readonly string[]
}

function requireNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} must not be empty`)
  return value
}

function validateTimestamp(value: string) {
  if (Number.isNaN(Date.parse(value))) throw new Error('Reputation score retrieval timestamp must be valid')
  return value
}

function unmeasuredFactor(id: ReputationFactorId, maximum: number, reason: string): ReputationFactor {
  return { id, score: 0, maximum, status: 'unmeasured', evidence: [`Unmeasured: ${reason}`] }
}

/**
 * Charter 9.2: "only final displayed points are rounded" — factor scores keep
 * full precision internally. This clears binary floating-point noise (e.g.
 * 4.8 − 4.5 is not exactly 0.3 in IEEE 754) well below the precision anyone
 * reads, rather than rounding for display.
 */
function clean(value: number) {
  return Math.round(value * 1e6) / 1e6
}

function scoreRating(input: Measurement<number>): ReputationFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('average_rating', 35, input.reason)
  const r = input.value
  if (!Number.isFinite(r) || r < 0 || r > 5) throw new Error('Published rating must be between 0 and 5')
  const score = clean(r <= 4.5 ? 14 : r > 4.9 ? 35 : 14 + 21 * (r - 4.5) / 0.4)
  return { id: 'average_rating', score, maximum: 35, status: 'measured', evidence: [`Published average rating ${r}.`] }
}

function scoreVolume(input: Measurement<number>): ReputationFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('review_volume', 25, input.reason)
  const n = input.value
  if (!Number.isInteger(n) || n < 0) throw new Error('Published review count must be a non-negative integer')
  const score = clean(n <= 0 ? 0 : n > 400 ? 25 : Math.max(0, 25 * Math.log(n / 25) / Math.log(16)))
  return { id: 'review_volume', score, maximum: 25, status: 'measured', evidence: [`${n} published reviews.`] }
}

function sustainedActivityPoints(r365: number) {
  if (r365 <= 10) return 0
  if (r365 > 40) return 14
  return 14 * Math.log(r365 / 10) / Math.log(4)
}

function freshnessPoints(daysSinceLatest: number) {
  const d = daysSinceLatest
  if (d <= 30) return 6
  if (d <= 90) return 6 - 3 * (d - 30) / 60
  if (d <= 180) return 3 - 3 * (d - 90) / 90
  return 0
}

function scoreRecency(recentActivity: ReputationScoringInput['recentActivity']): ReputationFactor {
  const { reviewsLast365Days, daysSinceLatestReview } = recentActivity
  if (reviewsLast365Days.status === 'unmeasured') return unmeasuredFactor('review_recency', 20, reviewsLast365Days.reason)
  if (daysSinceLatestReview.status === 'unmeasured') return unmeasuredFactor('review_recency', 20, daysSinceLatestReview.reason)
  const r365 = reviewsLast365Days.value.count
  const d = daysSinceLatestReview.value
  if (!Number.isFinite(r365) || r365 < 0) throw new Error('Reviews in the trailing 365 days must be a non-negative number')
  if (!Number.isFinite(d) || d < 0) throw new Error('Days since the latest review must be a non-negative number')
  const sustained = sustainedActivityPoints(r365)
  const freshness = freshnessPoints(d)
  const evidence = [`${r365} reviews in the trailing 365 days (${reviewsLast365Days.value.sampleCompleteness}).`, `${d} days since the latest review.`]
  return { id: 'review_recency', score: clean(sustained + freshness), maximum: 20, status: 'measured', evidence }
}

function scoreConsistency(input: ReputationScoringInput['recentConsistency'], lifetimeRating: Measurement<number>): ReputationFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('recent_consistency', 15, input.reason)
  const { trailingYearMeanRating, trailingYearReviewCount } = input.value
  if (trailingYearReviewCount < 5) {
    throw new Error('Recent consistency requires at least 5 trailing-year reviews; mark as unmeasured instead of supplying a value from fewer')
  }
  if (lifetimeRating.status === 'unmeasured') throw new Error('Recent consistency requires the lifetime published rating to compute delta against')
  const delta = trailingYearMeanRating - lifetimeRating.value
  const magnitude = Math.abs(delta)
  const score = clean(delta >= 0
    ? 15
    : magnitude < 0.3
      ? 15 - 7.5 * (magnitude / 0.3)
      : magnitude <= 0.6
        ? 7.5 - 7.5 * ((magnitude - 0.3) / 0.3)
        : 0)
  return {
    id: 'recent_consistency',
    score,
    maximum: 15,
    status: 'measured',
    evidence: [`Trailing-year mean ${trailingYearMeanRating.toFixed(2)} over ${trailingYearReviewCount} reviews vs. lifetime average ${lifetimeRating.value}; delta ${delta.toFixed(2)}.`],
  }
}

function scoreLongevity(input: Measurement<{ historySpanYears: number }>): ReputationFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('longevity_evidence', 5, input.reason)
  const span = input.value.historySpanYears
  if (!Number.isFinite(span) || span < 0) throw new Error('History span must be a non-negative number of years')
  const score = clean(span < 1 ? 0 : span > 5 ? 5 : 5 * (span - 1) / 4)
  return { id: 'longevity_evidence', score, maximum: 5, status: 'measured', evidence: [`${span.toFixed(2)} years of retrievable review history.`] }
}

function evaluateRatingGate(rating: Measurement<number>): GateResult {
  if (rating.status === 'unmeasured') return { id: 'G1_rating', status: 'insufficient_data', evidence: `No rating available: ${rating.reason}` }
  return { id: 'G1_rating', status: rating.value >= 4.5 ? 'passed' : 'failed', evidence: `Published average rating ${rating.value}.` }
}

function evaluateVolumeGate(reviewCount: Measurement<number>): GateResult {
  if (reviewCount.status === 'unmeasured') return { id: 'G2_review_count', status: 'insufficient_data', evidence: `No review count available: ${reviewCount.reason}` }
  return { id: 'G2_review_count', status: reviewCount.value >= 25 ? 'passed' : 'failed', evidence: `${reviewCount.value} published reviews.` }
}

/**
 * A partial, deliberately limited screen for a bare discovery listing (rating
 * and review count only, before any review-history retrieval). It checks G1
 * and G2 — the only two of the six charter 9.1 gates computable from what a
 * discovery request alone returns — and nothing else. It never produces a
 * `qualified` result: that requires G3–G6 and all five scoring factors, which
 * need review-history data this function does not have. Intended for a
 * discovery results list to show which candidates are worth a closer look,
 * not to stand in for `buildReputationScore`.
 */
export function screenListingGates(input: { rating: number | null; reviewCount: number | null }): { g1: GateResult; g2: GateResult } {
  const rating: Measurement<number> = input.rating === null
    ? { status: 'unmeasured', reason: 'No rating on the discovery listing.' }
    : { status: 'measured', value: input.rating }
  const reviewCount: Measurement<number> = input.reviewCount === null
    ? { status: 'unmeasured', reason: 'No review count on the discovery listing.' }
    : { status: 'measured', value: input.reviewCount }
  return { g1: evaluateRatingGate(rating), g2: evaluateVolumeGate(reviewCount) }
}

/**
 * Charter 9.6's missing-data principle applied to G3: a sample proving
 * enough recent activity passes the gate regardless of whether pagination
 * was exhausted. Only a complete sample that fails to show enough activity
 * may fail the gate; an incomplete sample that fails to show enough is
 * `insufficient_data`, never a failure.
 */
function evaluateRecencyGate(recentActivity: ReputationScoringInput['recentActivity']): GateResult {
  const { reviewsLast90Days, reviewsLast365Days } = recentActivity
  const provesByNinety = reviewsLast90Days.status === 'measured' && reviewsLast90Days.value.count >= 3
  const provesByYear = reviewsLast365Days.status === 'measured' && reviewsLast365Days.value.count >= 10
  if (provesByNinety || provesByYear) {
    const evidence = provesByNinety
      ? `${(reviewsLast90Days as { status: 'measured'; value: SampledCount }).value.count} reviews in the trailing 90 days.`
      : `${(reviewsLast365Days as { status: 'measured'; value: SampledCount }).value.count} reviews in the trailing 365 days.`
    return { id: 'G3_recency', status: 'passed', evidence }
  }

  const ninetyComplete = reviewsLast90Days.status === 'measured' && reviewsLast90Days.value.sampleCompleteness === 'complete'
  const yearComplete = reviewsLast365Days.status === 'measured' && reviewsLast365Days.value.sampleCompleteness === 'complete'
  if (ninetyComplete && yearComplete) {
    return {
      id: 'G3_recency',
      status: 'failed',
      evidence: `Complete data: ${(reviewsLast90Days as { status: 'measured'; value: SampledCount }).value.count} reviews in 90 days, ${(reviewsLast365Days as { status: 'measured'; value: SampledCount }).value.count} in 365 — neither threshold met.`,
    }
  }
  return { id: 'G3_recency', status: 'insufficient_data', evidence: 'Retrieved sample does not yet prove or disprove the recency gate; pagination was not exhausted.' }
}

function evaluateComplaintGate(assessment: ComplaintPatternAssessment): GateResult {
  if (assessment.status === 'none_found') return { id: 'G4_complaint_pattern', status: 'passed', evidence: assessment.evidence }
  if (assessment.status === 'insufficient_data') return { id: 'G4_complaint_pattern', status: 'insufficient_data', evidence: assessment.evidence }
  return { id: 'G4_complaint_pattern', status: 'failed', evidence: assessment.evidence }
}

function evaluateOperationalGate(assessment: OperationalStatusAssessment): GateResult {
  if (assessment.status === 'active') return { id: 'G5_operational_status', status: 'passed', evidence: assessment.evidence }
  if (assessment.status === 'insufficient_data') return { id: 'G5_operational_status', status: 'insufficient_data', evidence: assessment.evidence }
  return { id: 'G5_operational_status', status: 'failed', evidence: assessment.evidence }
}

function evaluateIdentityGate(assessment: ListingIdentityAssessment): GateResult {
  if (assessment.status === 'confirmed') return { id: 'G6_listing_identity', status: 'passed', evidence: assessment.evidence }
  if (assessment.status === 'insufficient_data') return { id: 'G6_listing_identity', status: 'insufficient_data', evidence: assessment.evidence }
  return { id: 'G6_listing_identity', status: 'failed', evidence: assessment.evidence }
}

export function buildReputationScore(input: ReputationScoringInput): ReputationScore {
  const listingId = requireNonEmpty(input.listingId, 'Listing id')
  const retrievedAt = validateTimestamp(input.retrievedAt)
  const threshold = input.qualificationThreshold ?? DEFAULT_QUALIFICATION_THRESHOLD

  const allTimestampInputsUnmeasured =
    input.recentActivity.reviewsLast90Days.status === 'unmeasured' &&
    input.recentActivity.reviewsLast365Days.status === 'unmeasured' &&
    input.recentActivity.daysSinceLatestReview.status === 'unmeasured' &&
    input.recentConsistency.status === 'unmeasured' &&
    input.longevity.status === 'unmeasured'

  // Charter 9.4's explicit insufficient_data condition: no rating, no review
  // count, or no review timestamps at all. This is re-checkable, never a
  // rejection for inactivity or poor performance (9.6).
  if (input.rating.status === 'unmeasured' || input.reviewCount.status === 'unmeasured' || allTimestampInputsUnmeasured) {
    const reason = input.rating.status === 'unmeasured'
      ? input.rating.reason
      : input.reviewCount.status === 'unmeasured'
        ? input.reviewCount.reason
        : 'No review-timestamp data was retrievable.'
    return {
      modelVersion: REPUTATION_MODEL_VERSION,
      listingId,
      retrievedAt,
      status: 'insufficient_data',
      gates: [],
      autoReject: null,
      factors: [],
      scoreLowerBound: 0,
      qualificationThreshold: threshold,
      qualified: false,
      flags: [`Required data missing; result is insufficient_data, not evidence of poor reputation: ${reason}`],
    }
  }

  const gates: readonly GateResult[] = [
    evaluateRatingGate(input.rating),
    evaluateVolumeGate(input.reviewCount),
    evaluateRecencyGate(input.recentActivity),
    evaluateComplaintGate(input.complaintPattern),
    evaluateOperationalGate(input.operationalStatus),
    evaluateIdentityGate(input.listingIdentity),
  ]

  const factors: readonly ReputationFactor[] = [
    scoreRating(input.rating),
    scoreVolume(input.reviewCount),
    scoreRecency(input.recentActivity),
    scoreConsistency(input.recentConsistency, input.rating),
    scoreLongevity(input.longevity),
  ]

  // Objective, reproducible conditions only (DEC-008). G4 (judgment-dependent)
  // never appears here — a failed G4 still fails the gate below, but it is
  // surfaced as a flag, not folded into autoReject.
  const g5 = gates.find((g) => g.id === 'G5_operational_status')!
  const g6 = gates.find((g) => g.id === 'G6_listing_identity')!
  const g1 = gates.find((g) => g.id === 'G1_rating')!
  const g2 = gates.find((g) => g.id === 'G2_review_count')!
  const g3 = gates.find((g) => g.id === 'G3_recency')!

  const autoReject: ReputationScore['autoReject'] =
    input.duplicateOfListingId
      ? { condition: 'duplicate_listing', evidence: `Duplicate of listing ${input.duplicateOfListingId}.` }
      : input.market.status === 'outside_target'
        ? { condition: 'outside_target_market', evidence: input.market.evidence }
        : g5.status === 'failed'
          ? { condition: 'listing_closed_or_permanently_closed', evidence: g5.evidence }
          : g6.status === 'failed'
            ? { condition: 'wrong_location_or_duplicate_listing', evidence: g6.evidence }
            : g1.status === 'failed'
              ? { condition: 'rating_below_gate', evidence: g1.evidence }
              : g2.status === 'failed'
                ? { condition: 'review_count_below_gate', evidence: g2.evidence }
                : g3.status === 'failed'
                  ? { condition: 'recency_requirement_not_met_on_complete_data', evidence: g3.evidence }
                  : null

  const anyGateInsufficient = gates.some((g) => g.status === 'insufficient_data')
  const anyFactorUnmeasured = factors.some((f) => f.status === 'unmeasured')
  const recentActivityPartial =
    (input.recentActivity.reviewsLast365Days.status === 'measured' && input.recentActivity.reviewsLast365Days.value.sampleCompleteness === 'partial_data') ||
    (input.recentActivity.reviewsLast90Days.status === 'measured' && input.recentActivity.reviewsLast90Days.value.sampleCompleteness === 'partial_data')
  const isPartial = anyGateInsufficient || anyFactorUnmeasured || recentActivityPartial

  const consistencyFactor = factors.find((f) => f.id === 'recent_consistency')!
  const flags = [
    ...(isPartial ? ['One or more gates, factors, or samples are partial or unmeasured; score is a lower bound.'] : []),
    ...(input.recentConsistency.status === 'measured' && input.recentConsistency.value.trailingYearMeanRating < 4.5 ? ['recent_rating_below_gate'] : []),
    ...(consistencyFactor.status === 'measured' && consistencyFactor.score === 0 && input.recentConsistency.status === 'measured' &&
      (input.recentConsistency.value.trailingYearMeanRating - input.rating.value) <= -0.6 ? ['reputation_decline'] : []),
    ...(input.recentConsistency.status === 'unmeasured' ? ['consistency_unverified'] : []),
    ...(input.longevity.status === 'unmeasured' ? ['longevity_unknown'] : []),
    ...(input.datesImprecise?.applies ? [`imprecise_dates: ${input.datesImprecise.evidence}`] : []),
    ...(input.complaintPattern.status === 'pattern_found' ? [`suspected_complaint_pattern: ${input.complaintPattern.evidence}`] : []),
    ...(gates.find((g) => g.id === 'G3_recency')!.status === 'insufficient_data' ? ['recency_gate_insufficient_data: pagination not exhausted, not evidence of inactivity'] : []),
    ...(input.additionalOperatorFlags ?? []).map((f) => `${f.flag}: ${f.evidence}`),
  ]

  const scoreLowerBound = factors.reduce((total, factor) => total + factor.score, 0)
  const qualified = autoReject === null && gates.every((g) => g.status === 'passed') && scoreLowerBound >= threshold

  return {
    modelVersion: REPUTATION_MODEL_VERSION,
    listingId,
    retrievedAt,
    status: isPartial ? 'partial_data' : 'complete_data',
    gates,
    autoReject,
    factors,
    scoreLowerBound,
    qualificationThreshold: threshold,
    qualified,
    flags,
  }
}
