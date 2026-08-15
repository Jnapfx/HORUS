import { buildReputationScore, type ReputationScore } from '../domain/reputation-scoring'
import { summarizeReviewHistory } from '../domain/review-history'
import { buildWebOpportunityAudit, type WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessMobileResponsiveness } from '../domain/mobile-responsiveness'
import { scanObsoleteAppearance } from '../domain/obsolete-appearance'
import { emptyJudgment, resolveJudgment, type OperatorJudgmentDraft } from '../domain/operator-judgment'
import type { CandidateSummary, WebOpportunityMeasurementResult } from './types'

/**
 * Pulled out of `CandidateActions.tsx` so the manual per-candidate path
 * (`CandidateScoreAction`) and the automated bulk pre-screen
 * (`OperatorWorkspace`'s "Auto-screen candidates") compute a reputation score
 * from the exact same code. DEC-108 found and fixed a case where two paths
 * recomputed the same thing slightly differently and drifted; this exists so
 * that class of defect cannot recur here. Behavior is unchanged from what
 * `CandidateScoreAction.scoreWith` did before this extraction.
 *
 * G4/G5/G6 (charter 9.5) are judgment-dependent and can never be filled in by
 * this function — `judgment` defaults to unanswered (`insufficient_data` on
 * all three), which is what a bulk, unattended pre-screen must produce: a
 * provisional score the operator can use to decide which candidates are
 * worth their own attention next, never a `qualified: true` result (DEC-008,
 * hard rule 5 — operator flags never auto-reject or auto-qualify).
 */
export function scoreCandidateFromHistory(
  candidate: Pick<CandidateSummary, 'dataId' | 'rating' | 'reviewCount'>,
  history: {
    retrievedAt: string
    reviews: readonly { isoDate: string; rating: number; text: string | null; author: string | null; ownerResponded: boolean }[]
    paginationExhausted: boolean
  },
  judgment: OperatorJudgmentDraft = emptyJudgment(),
): ReputationScore {
  if (!candidate.dataId) throw new Error('Cannot score a candidate with no data_id')
  const summary = summarizeReviewHistory({
    reviews: history.reviews,
    retrievedAt: history.retrievedAt,
    paginationExhausted: history.paginationExhausted,
  })
  const assessed = resolveJudgment(judgment)
  return buildReputationScore({
    listingId: candidate.dataId,
    retrievedAt: history.retrievedAt,
    rating: candidate.rating === null ? { status: 'unmeasured', reason: 'No rating on the discovery listing.' } : { status: 'measured', value: candidate.rating },
    reviewCount: candidate.reviewCount === null ? { status: 'unmeasured', reason: 'No review count on the discovery listing.' } : { status: 'measured', value: candidate.reviewCount },
    recentActivity: {
      reviewsLast90Days: { status: 'measured', value: summary.reviewsLast90Days },
      reviewsLast365Days: { status: 'measured', value: summary.reviewsLast365Days },
      daysSinceLatestReview: summary.daysSinceLatestReview === null
        ? { status: 'unmeasured', reason: 'No reviews were retrieved.' }
        : { status: 'measured', value: summary.daysSinceLatestReview },
    },
    recentConsistency: summary.recentConsistency
      ? { status: 'measured', value: summary.recentConsistency }
      : { status: 'unmeasured', reason: 'Fewer than 5 trailing-year reviews were retrieved.' },
    longevity: summary.retrievedHistorySpanYears === null
      ? { status: 'unmeasured', reason: 'Fewer than two dated reviews were retrieved, so no span can be established.' }
      : { status: 'measured', value: { historySpanYears: summary.retrievedHistorySpanYears } },
    complaintPattern: assessed.complaintPattern,
    operationalStatus: assessed.operationalStatus,
    listingIdentity: assessed.listingIdentity,
    market: { status: 'within_target', evidence: 'Discovered via a search already scoped to the target city; not independently re-verified.' },
  })
}

/** True when G4, G5, or G6 is still `insufficient_data` — the operator has not yet answered the judgment gates for this score (see `ShortlistCandidateInput.judgmentPending`). */
export function isJudgmentPending(score: ReputationScore): boolean {
  return score.gates.some((gate) =>
    (gate.id === 'G4_complaint_pattern' || gate.id === 'G5_operational_status' || gate.id === 'G6_listing_identity') &&
    gate.status === 'insufficient_data',
  )
}

/**
 * Pulled out of `CandidateWebOpportunityAction` for the same reason as
 * `scoreCandidateFromHistory` above. Behavior is unchanged (DEC-097/098).
 */
export function auditCandidateFromMeasurement(
  candidate: Pick<CandidateSummary, 'website'>,
  outcome: Extract<WebOpportunityMeasurementResult, { status: 'completed' }>,
): { audit: WebOpportunityAudit; obsoleteCoverage: string } {
  if (!candidate.website) throw new Error('Cannot audit a candidate with no website')
  const unmeasured = (reason: string) => ({ status: 'unmeasured' as const, reason })
  const scan = scanObsoleteAppearance({
    signals: {
      obsoleteTechnologyMarkers: outcome.obsoleteSignals?.obsoleteTechnologyMarkers ?? [],
      latestCopyrightYear: outcome.obsoleteSignals?.latestCopyrightYear ?? null,
      servesHttps: outcome.servesHttps.status === 'measured' ? outcome.servesHttps.value : null,
    },
    retrievedAt: outcome.retrievedAt,
  })
  const obsoleteAppearance = scan.examined.length === 0
    ? unmeasured('No obsolete-appearance indicator could be checked for this site.')
    : { status: 'measured' as const, value: scan.indicators }
  // DEC-111. `outcome.brokenLinks` is null when the homepage had no checkable
  // same-origin https link — that reads as `unmeasured`, never as zero broken
  // links, so a business whose page had nothing to check is not scored as if
  // its links were verified clean.
  const brokenElements = outcome.brokenLinks
    ? { status: 'measured' as const, value: outcome.brokenLinks }
    : unmeasured('No same-origin https link could be checked on the fetched homepage.')
  const audit = buildWebOpportunityAudit({
    url: candidate.website,
    retrievedAt: outcome.retrievedAt,
    site: { availability: 'reachable' },
    mobile: assessMobileResponsiveness(outcome.mobileAudits),
    obsoleteAppearance,
    brokenElements,
    performance: outcome.performance.status === 'measured'
      ? { status: 'measured', value: { timeToInteractiveSeconds: outcome.performance.value.timeToInteractiveSeconds, mobileProfile: 'PageSpeed Insights Lighthouse mobile' } }
      : unmeasured(outcome.performance.reason),
    commercialIneffectiveness: unmeasured('Requires content review across the site; not yet wired.'),
  })
  return { audit, obsoleteCoverage: scan.coverage }
}

export type AnalystEvidenceReference = { snapshotId: string; source: string; retrievedAt: string }

/**
 * DEC-127 gave `inspect_public_website_readonly` a hostname allowlist built
 * from exactly the evidence a task supplies — this is what supplies it. The
 * shared discovery snapshot (`serpapi.google_maps`) always comes first: it is
 * where every candidate's own `website` field lives, the trusted key the
 * allowlist reads (`evidence-hostname-allowlist.ts`). A candidate's review
 * pages and web-opportunity measurement, when retained, are added the same
 * way the deterministic score already reads them
 * (`scoreCandidateFromHistory`, `auditCandidateFromMeasurement` above) — this
 * function supplies the analyst with no evidence the deterministic score
 * itself does not already have access to.
 *
 * `snapshotId`s are de-duplicated: `performance` and `telLinkFound` can point
 * at the same `horus.website-analysis` snapshot, and the analyst's own
 * `assertTaskIsBounded` requires at least one evidence reference, not that
 * every one be distinct — de-duplicating here is a courtesy to the operator
 * reading the request, not a requirement of the runtime.
 */
export function buildCandidateEvidenceReferences(input: {
  discoverySnapshotId: string
  discoveryRetrievedAt: string
  reviewHistory?: { retrievedAt: string; snapshotIds: readonly string[] } | null
  webOpportunityMeasurement?: {
    retrievedAt: string
    performance: { status: 'measured'; value: { snapshotId: string } } | { status: 'unmeasured'; reason: string }
    telLinkFound: { status: 'measured'; value: { snapshotId: string } } | { status: 'unmeasured'; reason: string }
  } | null
}): readonly AnalystEvidenceReference[] {
  const references: AnalystEvidenceReference[] = [
    { snapshotId: input.discoverySnapshotId, source: 'serpapi.google_maps', retrievedAt: input.discoveryRetrievedAt },
  ]

  if (input.reviewHistory) {
    for (const snapshotId of input.reviewHistory.snapshotIds) {
      references.push({ snapshotId, source: 'serpapi.google_maps_reviews', retrievedAt: input.reviewHistory.retrievedAt })
    }
  }

  const measurement = input.webOpportunityMeasurement
  if (measurement) {
    if (measurement.performance.status === 'measured') {
      references.push({ snapshotId: measurement.performance.value.snapshotId, source: 'pagespeed.mobile', retrievedAt: measurement.retrievedAt })
    }
    if (measurement.telLinkFound.status === 'measured') {
      references.push({ snapshotId: measurement.telLinkFound.value.snapshotId, source: 'horus.website-analysis', retrievedAt: measurement.retrievedAt })
    }
  }

  const seen = new Set<string>()
  return references.filter((reference) => {
    if (seen.has(reference.snapshotId)) return false
    seen.add(reference.snapshotId)
    return true
  })
}
