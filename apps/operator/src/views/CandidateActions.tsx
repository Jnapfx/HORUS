import { useEffect, useState } from 'react'
import { buildReputationScore, type ReputationScore } from '../domain/reputation-scoring'
import { summarizeReviewHistory } from '../domain/review-history'
import { buildWebOpportunityAudit, type WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessMobileResponsiveness } from '../domain/mobile-responsiveness'
import { scanObsoleteAppearance } from '../domain/obsolete-appearance'
import { findRecordedJudgment, type JudgmentEvent } from '../domain/judgment-log'
import {
  emptyJudgment,
  findJudgmentProblems,
  isJudgmentComplete,
  JUDGMENT_GATES,
  resolveJudgment,
  type OperatorJudgmentDraft,
} from '../domain/operator-judgment'
import type { CandidateSummary, ReviewHistoryResult, WebOpportunityMeasurementResult } from './types'

/**
 * DEC-071, extended by DEC-091. Per candidate: retrieves real review history
 * (a further real SerpApi cost, up to 3 pages) and runs the real
 * `reputation-scoring-v1` against it.
 *
 * G4–G6 require operator judgment and cannot be computed (charter 9.5,
 * DEC-008). DEC-071 left them permanently `insufficient_data` with no way to
 * answer them, which made `qualified` unreachable for every candidate and, in
 * turn, left the shortlist permanently empty and everything downstream of it
 * unreachable. DEC-091 adds the three questions and recomputes the score from
 * the already-retrieved history — no further retrieval, no further credit —
 * so the operator, who is the missing gate, can now actually be it.
 */
export function CandidateScoreAction({ candidate, onScored }: { candidate: CandidateSummary; onScored?: (score: ReputationScore) => void }) {
  const [running, setRunning] = useState(false)
  const [historyResult, setHistoryResult] = useState<ReviewHistoryResult | null>(null)
  const [score, setScore] = useState<ReputationScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Retained so answering a judgment gate rescores from evidence already paid
  // for, rather than spending another SerpApi credit (DEC-020, DEC-032).
  const [retrieved, setRetrieved] = useState<{ summary: ReturnType<typeof summarizeReviewHistory>; retrievedAt: string } | null>(null)
  const [judgment, setJudgment] = useState<OperatorJudgmentDraft>(emptyJudgment)
  const [recorded, setRecorded] = useState<{ occurredAt: string; revision: number } | null>(null)
  const [recording, setRecording] = useState(false)

  // DEC-094. Charter 14: a judgment recorded in a previous session is part of
  // the record and must come back with it. Restored before any scoring, so a
  // reopened candidate shows what the operator already concluded rather than a
  // blank form that would silently re-open the gates.
  useEffect(() => {
    if (!candidate.dataId) return
    let cancelled = false
    void window.horus?.judgment.list().then((events) => {
      if (cancelled) return
      const prior = findRecordedJudgment(events as JudgmentEvent[], candidate.dataId!)
      if (!prior) return
      setJudgment(prior.judgment)
      setRecorded({ occurredAt: prior.recordedAt, revision: prior.revision })
    })
    return () => { cancelled = true }
  }, [candidate.dataId])

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
        setRetrieved({ summary, retrievedAt: outcome.retrievedAt })
        const computed = scoreWith(summary, outcome.retrievedAt, judgment)
        setScore(computed)
        onScored?.(computed)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The review-history request was rejected.'))
      .finally(() => setRunning(false))
  }

  /**
   * DEC-091. The one place the operator's recorded judgment reaches the
   * model. `resolveJudgment` throws on a verdict without a rationale rather
   * than downgrading it, so a half-finished judgment surfaces as an error
   * instead of a plausible-looking score.
   */
  function scoreWith(
    summary: ReturnType<typeof summarizeReviewHistory>,
    retrievedAt: string,
    draft: OperatorJudgmentDraft,
  ): ReputationScore {
    const assessed = resolveJudgment(draft)
    return buildReputationScore({
      listingId: candidate.dataId!,
      retrievedAt,
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
      // DEC-104. The retrieved reviews already prove a minimum history span,
      // and it was being discarded — every candidate lost up to 5 points for
      // evidence that had been retrieved and paid for.
      longevity: summary.retrievedHistorySpanYears === null
        ? { status: 'unmeasured', reason: 'Fewer than two dated reviews were retrieved, so no span can be established.' }
        : { status: 'measured', value: { historySpanYears: summary.retrievedHistorySpanYears } },
      complaintPattern: assessed.complaintPattern,
      operationalStatus: assessed.operationalStatus,
      listingIdentity: assessed.listingIdentity,
      market: { status: 'within_target', evidence: 'Discovered via a search already scoped to the target city; not independently re-verified.' },
    })
  }

  /** Rescores against retained evidence. No retrieval, no credit. */
  const applyJudgment = (next: OperatorJudgmentDraft) => {
    setJudgment(next)
    if (!retrieved) return
    try {
      const computed = scoreWith(retrieved.summary, retrieved.retrievedAt, next)
      setScore(computed)
      onScored?.(computed)
      setError(null)
    } catch (problem) {
      // An incomplete judgment must not leave a stale score standing as if it
      // were current — clear it and say why.
      setScore(null)
      setError(problem instanceof Error ? problem.message : 'The operator judgment was rejected.')
    }
  }

  return (
    <div className="candidate-score">
      <button className="secondary" onClick={run} disabled={running || !candidate.dataId}>
        {running ? 'Retrieving review history…' : 'Fetch review history & score (spends further SerpApi credits)'}
      </button>
      {!candidate.dataId && <p className="notice">No data_id on this listing; review history cannot be retrieved.</p>}
      {error && <div className="error" role="alert"><strong>Rejected.</strong><p>{error}</p></div>}
      {historyResult?.status === 'failed' && <div className="error" role="alert"><strong>Retrieval failed: {historyResult.reason}</strong><p>{historyResult.detail}</p></div>}
      {retrieved && (
        <div className="gate-zone">
          <h4>Operator judgment — charter 9.5 gates G4, G5, G6</h4>
          <p className="notice">
            These three cannot be computed from evidence; they are yours to decide (DEC-008). Until all three are
            answered, this candidate cannot qualify, cannot be ranked on the shortlist, and cannot be selected as a
            prospect. Leaving one unanswered is a valid, honest state — it just does not open the gate. Answering one
            requires saying what you saw, and rescoring costs nothing: it reuses the review history already retrieved.
          </p>
          {JUDGMENT_GATES.map((gate) => {
            const entry = judgment[gate.field]
            return (
              <div key={gate.id} className="judgment-gate">
                <label>
                  {gate.id} — {gate.question}
                  <select
                    value={entry.verdict}
                    onChange={(event) =>
                      applyJudgment({ ...judgment, [gate.field]: { ...entry, verdict: event.target.value } } as OperatorJudgmentDraft)
                    }
                  >
                    {gate.options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {entry.verdict !== 'insufficient_data' && (
                  <label>
                    What did you see that supports this? (required)
                    <input
                      value={entry.rationale}
                      onChange={(event) =>
                        applyJudgment({ ...judgment, [gate.field]: { ...entry, rationale: event.target.value } } as OperatorJudgmentDraft)
                      }
                      placeholder="e.g. read the 20 most recent reviews; no unresolved complaints"
                    />
                  </label>
                )}
              </div>
            )
          })}
          {/* DEC-094. Recording is a deliberate act with its own control, not a
              side effect of typing — the same shape as every other consequential
              action in this application. */}
          <div className="button-row">
            <button
              className="secondary"
              disabled={recording || findJudgmentProblems(judgment).length > 0}
              onClick={() => {
                if (!candidate.dataId) return
                setRecording(true)
                window.horus?.judgment
                  .record({ listingId: candidate.dataId, judgment })
                  .then((result) => setRecorded({ occurredAt: result.occurredAt, revision: (recorded?.revision ?? 0) + 1 }))
                  .finally(() => setRecording(false))
              }}
            >
              {recording ? 'Recording…' : 'Record this judgment'}
            </button>
          </div>
          {recorded && (
            <p className="success">
              Recorded {recorded.occurredAt}
              {recorded.revision > 1 ? ` — revision ${recorded.revision}; earlier judgments stay in the log` : ''}.
            </p>
          )}
          {findJudgmentProblems(judgment).map((problem) => (
            <p key={problem.gate} className="control-hint">{problem.problem}</p>
          ))}
          {!isJudgmentComplete(judgment) && findJudgmentProblems(judgment).length === 0 && (
            <p className="control-hint">
              Not all three gates are answered. This candidate stays unqualified, which is correct — not a failure.
            </p>
          )}
        </div>
      )}
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
  const [obsoleteCoverage, setObsoleteCoverage] = useState<string | null>(null)
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
        // DEC-098. DEC-072 checked one of seven indicators and handed the
        // model `measured: []` when the site served https — a completeness
        // claim it had not earned. The score was always a genuine lower bound
        // (more indicators can only raise it), but nothing said how much had
        // been looked at. `scan.coverage` now says it out loud.
        const scan = scanObsoleteAppearance({
          signals: {
            obsoleteTechnologyMarkers: outcome.obsoleteSignals?.obsoleteTechnologyMarkers ?? [],
            latestCopyrightYear: outcome.obsoleteSignals?.latestCopyrightYear ?? null,
            servesHttps: outcome.servesHttps.status === 'measured' ? outcome.servesHttps.value : null,
          },
          retrievedAt: outcome.retrievedAt,
        })
        setObsoleteCoverage(scan.coverage)
        const obsoleteAppearance = scan.examined.length === 0
          ? unmeasured('No obsolete-appearance indicator could be checked for this site.')
          : { status: 'measured' as const, value: scan.indicators }
        const computed = buildWebOpportunityAudit({
          url: candidate.website!,
          retrievedAt: outcome.retrievedAt,
          site: { availability: 'reachable' },
          // DEC-097. The rendered inspection DEC-072 said this needed was
          // already happening — every PageSpeed call returns a full mobile
          // Lighthouse run, and only `interactive` was ever read from it.
          mobile: assessMobileResponsiveness(outcome.mobileAudits),
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
      {obsoleteCoverage && <p className="notice">{obsoleteCoverage}</p>}
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
