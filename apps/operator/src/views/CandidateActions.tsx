import { useState } from 'react'
import { buildReputationScore, type ReputationScore } from '../domain/reputation-scoring'
import { summarizeReviewHistory } from '../domain/review-history'
import { buildWebOpportunityAudit, type WebOpportunityAudit } from '../domain/web-opportunity-audit'
import type { CandidateSummary, ReviewHistoryResult, WebOpportunityMeasurementResult } from './types'

/**
 * DEC-071. Per candidate: retrieves real review history (a further real
 * SerpApi cost, up to 3 pages) and runs the real `reputation-scoring-v1`
 * against it. G4–G6 are deliberately left `insufficient_data` here — this
 * component has no way to assess a complaint pattern, operational status, or
 * listing identity, and per DEC-008 those require operator judgment, not an
 * invented default. That is why `qualified` can come back `false` even when
 * every computable factor looks strong: the operator, not this screen, is
 * the missing gate.
 */
export function CandidateScoreAction({ candidate, onScored }: { candidate: CandidateSummary; onScored?: (score: ReputationScore) => void }) {
  const [running, setRunning] = useState(false)
  const [historyResult, setHistoryResult] = useState<ReviewHistoryResult | null>(null)
  const [score, setScore] = useState<ReputationScore | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    if (!candidate.dataId) return
    setRunning(true)
    setError(null)
    setScore(null)
    setHistoryResult(null)
    window.horus?.discovery.fetchReviewHistory({ dataId: candidate.dataId })
      .then((outcome) => {
        setHistoryResult(outcome as ReviewHistoryResult)
        if (outcome.status !== 'completed') return
        const summary = summarizeReviewHistory({
          reviews: outcome.reviews,
          retrievedAt: outcome.retrievedAt,
          paginationExhausted: outcome.paginationExhausted,
        })
        const notYetAssessed = { status: 'insufficient_data' as const, evidence: 'Not yet reviewed by the operator.' }
        const computed = buildReputationScore({
          listingId: candidate.dataId!,
          retrievedAt: outcome.retrievedAt,
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
          longevity: { status: 'unmeasured', reason: 'Full-history retrieval was not performed (DEC-018 cost discipline).' },
          complaintPattern: notYetAssessed,
          operationalStatus: notYetAssessed,
          listingIdentity: notYetAssessed,
          market: { status: 'within_target', evidence: 'Discovered via a search already scoped to the target city; not independently re-verified.' },
        })
        setScore(computed)
        onScored?.(computed)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The review-history request was rejected.'))
      .finally(() => setRunning(false))
  }

  return (
    <div className="candidate-score">
      <button className="secondary" onClick={run} disabled={running || !candidate.dataId}>
        {running ? 'Retrieving review history…' : 'Fetch review history & score (spends further SerpApi credits)'}
      </button>
      {!candidate.dataId && <p className="notice">No data_id on this listing; review history cannot be retrieved.</p>}
      {error && <div className="error" role="alert"><strong>Rejected.</strong><p>{error}</p></div>}
      {historyResult?.status === 'failed' && <div className="error" role="alert"><strong>Retrieval failed: {historyResult.reason}</strong><p>{historyResult.detail}</p></div>}
      {score && (
        <div className="score-breakdown">
          <p>{score.status} · lower bound {score.scoreLowerBound.toFixed(1)}/100 · threshold {score.qualificationThreshold} · <strong>{score.qualified ? 'qualified' : 'not qualified'}</strong></p>
          <ul>
            {score.gates.map((gate) => <li key={gate.id} title={gate.evidence}>{gate.id}: {gate.status}</li>)}
          </ul>
          <ul>
            {score.factors.map((factor) => <li key={factor.id}>{factor.id}: {factor.score.toFixed(1)}/{factor.maximum}</li>)}
          </ul>
          {score.flags.length > 0 && <ul className="checklist">{score.flags.map((flag, i) => <li key={i}>{flag}</li>)}</ul>}
        </div>
      )}
    </div>
  )
}

/**
 * DEC-072. Only two of `web-opportunity-v2`'s five factors are backed by a
 * real measurement here: load performance (real PageSpeed) and the
 * `no-https` obsolete-appearance indicator (known from the URL itself). The
 * other three factors — mobile responsiveness, the other six
 * obsolete-appearance indicators, broken-link crawling, and commercial
 * ineffectiveness — stay `unmeasured`, so `scoreLowerBound` is a genuine
 * lower bound, not a stand-in for a full audit. The `tel:`-link finding is
 * shown as supplementary evidence, not folded into `brokenElements` — one
 * regex match on one page is not the checked-links crawl that factor is
 * meant to represent.
 */
export function CandidateWebOpportunityAction({ candidate, onMeasured }: { candidate: CandidateSummary; onMeasured?: (audit: WebOpportunityAudit) => void }) {
  const [running, setRunning] = useState(false)
  const [measurement, setMeasurement] = useState<WebOpportunityMeasurementResult | null>(null)
  const [audit, setAudit] = useState<WebOpportunityAudit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    if (!candidate.website) return
    setRunning(true)
    setError(null)
    setMeasurement(null)
    setAudit(null)
    window.horus?.discovery.measureWebOpportunity({ url: candidate.website })
      .then((outcome) => {
        setMeasurement(outcome as WebOpportunityMeasurementResult)
        if (outcome.status !== 'completed') return
        const unmeasured = (reason: string) => ({ status: 'unmeasured' as const, reason })
        const obsoleteAppearance = outcome.servesHttps.status === 'measured'
          ? {
              status: 'measured' as const,
              value: outcome.servesHttps.value ? [] : [{ indicator: 'no-https' as const, evidence: 'The listed URL does not use https.' }],
            }
          : unmeasured(outcome.servesHttps.reason)
        const computed = buildWebOpportunityAudit({
          url: candidate.website!,
          retrievedAt: outcome.retrievedAt,
          site: { availability: 'reachable' },
          mobile: unmeasured('Requires a rendered inspection; not yet wired.'),
          obsoleteAppearance,
          brokenElements: unmeasured('Requires a full link crawl; only a single tel: link check was performed, shown separately.'),
          performance: outcome.performance.status === 'measured'
            ? { status: 'measured', value: { timeToInteractiveSeconds: outcome.performance.value.timeToInteractiveSeconds, mobileProfile: 'PageSpeed Insights Lighthouse mobile' } }
            : unmeasured(outcome.performance.reason),
          commercialIneffectiveness: unmeasured('Requires content review across the site; not yet wired.'),
        })
        setAudit(computed)
        onMeasured?.(computed)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The web-opportunity measurement was rejected.'))
      .finally(() => setRunning(false))
  }

  return (
    <div className="candidate-score">
      <button className="secondary" onClick={run} disabled={running || !candidate.website}>
        {running ? 'Measuring…' : 'Measure web opportunity (spends a real PageSpeed request)'}
      </button>
      {!candidate.website && <p className="notice">No website field on this listing; nothing to measure.</p>}
      {error && <div className="error" role="alert"><strong>Rejected.</strong><p>{error}</p></div>}
      {measurement?.status === 'failed' && <div className="error" role="alert"><strong>Measurement failed: {measurement.reason}</strong><p>{measurement.detail}</p></div>}
      {measurement?.status === 'completed' && measurement.telLinkFound.status === 'measured' && (
        <p className="notice">Supplementary finding, not scored: a tel: link was {measurement.telLinkFound.value.found ? '' : 'not '}found on the fetched page.</p>
      )}
      {audit && (
        <div className="score-breakdown">
          <p>{audit.status} · lower bound {audit.scoreLowerBound.toFixed(1)}/100</p>
          <ul>
            {audit.factors.map((factor) => <li key={factor.id}>{factor.id}: {factor.score.toFixed(1)}/{factor.maximum} ({factor.status})</li>)}
          </ul>
          {audit.flags.length > 0 && <ul className="checklist">{audit.flags.map((flag, i) => <li key={i}>{flag}</li>)}</ul>}
        </div>
      )}
    </div>
  )
}
