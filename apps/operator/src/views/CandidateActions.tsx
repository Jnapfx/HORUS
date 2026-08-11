import { useEffect, useState } from 'react'
import type { ReputationScore } from '../domain/reputation-scoring'
import { summarizeReviewHistory } from '../domain/review-history'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { findRecordedJudgment, type JudgmentEvent } from '../domain/judgment-log'
import {
  emptyJudgment,
  findJudgmentProblems,
  isJudgmentComplete,
  JUDGMENT_GATES,
  type OperatorJudgmentDraft,
} from '../domain/operator-judgment'
import { auditCandidateFromMeasurement, scoreCandidateFromHistory } from './candidate-scoring'
import type { CandidateSummary, RestoredReviewHistory, RestoredWebOpportunityMeasurement, ReviewHistoryResult, WebOpportunityMeasurementResult } from './types'

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
export function CandidateScoreAction({ candidate, retained, onScored, onQualified }: {
  candidate: CandidateSummary
  /**
   * DEC-108. This listing's review pages, already retained and read back by
   * `session:restore`. Present means the operator has scored this candidate
   * before — so it is shown as scored, with its reviews and its judgment,
   * rather than as a blank row above a button offering to spend credits on
   * evidence that is already on disk.
   */
  retained?: RestoredReviewHistory | null
  onScored?: (score: ReputationScore) => void
  /**
   * DEC-113. Fired once, the moment the operator's own recorded judgment
   * (charter 9.5, DEC-008) is what makes this candidate `qualified`. Never
   * fired by a computed score alone — only after "Record this judgment" has
   * actually written it, since that button press is the operator's real
   * decision, not a side effect of typing into a select box.
   */
  onQualified?: (dataId: string) => void
}) {
  const [running, setRunning] = useState(false)
  const [historyResult, setHistoryResult] = useState<ReviewHistoryResult | null>(null)
  const [score, setScore] = useState<ReputationScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Retained so answering a judgment gate rescores from evidence already paid
  // for, rather than spending another SerpApi credit (DEC-020, DEC-032).
  const [retrieved, setRetrieved] = useState<{
    summary: ReturnType<typeof summarizeReviewHistory>
    retrievedAt: string
    reviews: readonly { isoDate: string; rating: number; text: string | null; author: string | null; ownerResponded: boolean }[]
    paginationExhausted: boolean
    publishedCount: number | null
  } | null>(null)
  const [judgment, setJudgment] = useState<OperatorJudgmentDraft>(emptyJudgment)
  const [recorded, setRecorded] = useState<{ occurredAt: string; revision: number } | null>(null)
  const [recording, setRecording] = useState(false)
  const [servedFromEvidence, setServedFromEvidence] = useState(false)

  // DEC-094, extended by DEC-108. Charter 14: a judgment recorded in a
  // previous session is part of the record and must come back with it — and so
  // must the score that judgment produced. The two are restored together, in
  // one effect, because scoring without the judgment would briefly show the
  // candidate as unqualified for a reason that is not true.
  useEffect(() => {
    if (!candidate.dataId) return
    let cancelled = false
    void window.horus?.judgment.list().then((events) => {
      if (cancelled) return
      const prior = findRecordedJudgment(events as JudgmentEvent[], candidate.dataId!)
      const draft = prior?.judgment ?? emptyJudgment()
      if (prior) {
        setJudgment(draft)
        setRecorded({ occurredAt: prior.recordedAt, revision: prior.revision })
      }
      if (!retained || retained.reviews.length === 0) return
      const summary = summarizeReviewHistory({
        reviews: retained.reviews,
        retrievedAt: retained.retrievedAt,
        paginationExhausted: retained.paginationExhausted,
      })
      setRetrieved({
        summary,
        retrievedAt: retained.retrievedAt,
        reviews: retained.reviews,
        paginationExhausted: retained.paginationExhausted,
        publishedCount: candidate.reviewCount,
      })
      setServedFromEvidence(true)
      // Recomputed from evidence rather than restored from a stored copy —
      // charter 14's own model, and the reason DEC-107 chose it.
      try {
        const computed = scoreWith(retained.reviews, retained.retrievedAt, retained.paginationExhausted, draft)
        setScore(computed)
        onScored?.(computed)
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : 'The recorded judgment could not be applied.')
      }
    })
    return () => { cancelled = true }
    // `onScored` is an inline callback from the parent and would re-run this
    // on every render; the candidate and its retained evidence are what
    // actually determine the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.dataId, retained])

  const run = (forceRefresh: boolean) => {
    if (!candidate.dataId) return
    setRunning(true)
    setError(null)
    setScore(null)
    setHistoryResult(null)
    window.horus?.discovery.fetchReviewHistory({ dataId: candidate.dataId, forceRefresh })
      .then((outcome) => {
        setHistoryResult(outcome as ReviewHistoryResult)
        if (outcome.status !== 'completed') return
        setServedFromEvidence(outcome.fromCache)
        const summary = summarizeReviewHistory({
          reviews: outcome.reviews,
          retrievedAt: outcome.retrievedAt,
          paginationExhausted: outcome.paginationExhausted,
        })
        setRetrieved({
          summary,
          retrievedAt: outcome.retrievedAt,
          reviews: outcome.reviews,
          paginationExhausted: outcome.paginationExhausted,
          publishedCount: candidate.reviewCount,
        })
        const computed = scoreWith(outcome.reviews, outcome.retrievedAt, outcome.paginationExhausted, judgment)
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
  // DEC-110. Delegates to the shared `candidate-scoring.ts` module also used
  // by the bulk pre-screen in `OperatorWorkspace`, so the two paths cannot
  // silently disagree about how a score is built from a review history — the
  // same class of defect DEC-108 found and fixed for session restore.
  //
  // Takes `reviews`/`paginationExhausted` explicitly rather than reading them
  // off `retrieved` state: two of this function's three call sites run
  // before `setRetrieved` has committed, so closing over that state here
  // would silently score against the *previous* retrieval.
  function scoreWith(
    reviews: readonly { isoDate: string; rating: number; text: string | null; author: string | null; ownerResponded: boolean }[],
    retrievedAt: string,
    paginationExhausted: boolean,
    draft: OperatorJudgmentDraft,
  ): ReputationScore {
    return scoreCandidateFromHistory(candidate, { retrievedAt, reviews, paginationExhausted }, draft)
  }

  /** Rescores against retained evidence. No retrieval, no credit. */
  const applyJudgment = (next: OperatorJudgmentDraft) => {
    setJudgment(next)
    if (!retrieved) return
    try {
      const computed = scoreWith(retrieved.reviews, retrieved.retrievedAt, retrieved.paginationExhausted, next)
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
      {/* DEC-108. The label states the true cost of the press. Review pages
          already retained are served for nothing (DEC-020: once stored, they
          can be scored any number of times for free), so a candidate that has
          been scored before must not be offered a button that says it spends.
          Retrieving again is still available, and still says what it costs. */}
      <button className="secondary" onClick={() => run(false)} disabled={running || !candidate.dataId}>
        {running
          ? 'Reading review history…'
          : retrieved
            ? 'Rescore from retained reviews (no credit)'
            : 'Fetch review history & score (spends further SerpApi credits)'}
      </button>
      {retrieved && (
        <button className="secondary" onClick={() => run(true)} disabled={running || !candidate.dataId}>
          Retrieve fresh reviews (spends further SerpApi credits)
        </button>
      )}
      {servedFromEvidence && (
        <p className="success">
          Served from review pages already retained, retrieved {retrieved?.retrievedAt ?? ''} — no SerpApi credit spent.
        </p>
      )}
      {!candidate.dataId && <p className="notice">No data_id on this listing; review history cannot be retrieved.</p>}
      {error && <div className="error" role="alert"><strong>Rejected.</strong><p>{error}</p></div>}
      {historyResult?.status === 'failed' && <div className="error" role="alert"><strong>Retrieval failed: {historyResult.reason}</strong><p>{historyResult.detail}</p></div>}
      {retrieved && (
        <div className="gate-zone">
          <h4>Operator judgment — charter 9.5 gates G4, G5, G6</h4>

          {/* DEC-105. The reviews themselves, next to the questions about
              them. Worst rating first, because G4 asks about a pattern of
              unresolved complaints and that is where one would be visible.
              Reading the words is the whole task; the numbers above are
              already computed. */}
          <details className="review-evidence" open>
            <summary>
              Reviews retrieved ({retrieved.reviews.length}
              {retrieved.publishedCount !== null ? ` of ${retrieved.publishedCount} published` : ''})
              {' · '}worst rating first
            </summary>
            {!retrieved.paginationExhausted && (
              <p className="notice">
                This is a sample, not the whole history — retrieval stopped at DEC-018's page cap. Reviews you cannot
                see here may say something different, so anything you conclude from silence is not evidence
                (charter 9.6).
              </p>
            )}
            <ul className="review-list">
              {[...retrieved.reviews]
                .sort((a, b) => a.rating - b.rating || b.isoDate.localeCompare(a.isoDate))
                .map((review, index) => (
                  <li key={`${review.isoDate}-${index}`} className={review.rating <= 3 ? 'low' : undefined}>
                    <p className="review-meta">
                      {'★'.repeat(review.rating)}{'·'.repeat(5 - review.rating)} {review.rating}/5
                      {' · '}{review.isoDate.slice(0, 10)}
                      {review.author ? ` · ${review.author}` : ''}
                      {review.ownerResponded ? ' · owner replied' : ''}
                    </p>
                    {review.text
                      ? <p className="review-text">{review.text}</p>
                      : <p className="review-text muted">No text — a rating only.</p>}
                  </li>
                ))}
            </ul>
          </details>
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
                  .then((result) => {
                    setRecorded({ occurredAt: result.occurredAt, revision: (recorded?.revision ?? 0) + 1 })
                    // DEC-113. `score` here is the one already recomputed
                    // in-browser from this exact judgment (`applyJudgment`,
                    // above) — the write above just makes it durable. Firing
                    // on that recompute would fire on every keystroke; this
                    // only fires once the operator has actually pressed the
                    // button that records it.
                    if (score?.qualified && candidate.dataId) onQualified?.(candidate.dataId)
                  })
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
            {score.factors.map((factor) => (
              <li key={factor.id}>
                {/* DEC-119. A fixed-colour status dot, never sized or filled
                    by the score — the operator's own request was explicit
                    about that distinction after the alternative (a filled
                    bar/ring) was flagged as exactly DEC-073's failure mode.
                    Colour is paired with the existing `(status)` word, per
                    DEC-083 rule 2 — never the only carrier of meaning. */}
                <span className={`factor-dot factor-dot--${factor.status}`} aria-hidden="true" />
                {factor.id}: {factor.score.toFixed(1)}/{factor.maximum} ({factor.status})
              </li>
            ))}
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
export function CandidateWebOpportunityAction({ candidate, retained, onMeasured }: {
  candidate: CandidateSummary
  /**
   * DEC-117. This URL's measurement, already retained and read back by
   * `session:restore` — the same shape `CandidateScoreAction`'s `retained`
   * prop already follows for review history (DEC-108). Present means this
   * site has been measured before, so it is shown as measured rather than as
   * a blank row above a button offering to spend a PageSpeed unit on a
   * measurement already on disk.
   */
  retained?: RestoredWebOpportunityMeasurement | null
  onMeasured?: (audit: WebOpportunityAudit) => void
}) {
  const [running, setRunning] = useState(false)
  const [measurement, setMeasurement] = useState<WebOpportunityMeasurementResult | null>(null)
  const [audit, setAudit] = useState<WebOpportunityAudit | null>(null)
  const [obsoleteCoverage, setObsoleteCoverage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // DEC-117. Restores from retained evidence on mount, the same shape
  // `CandidateScoreAction`'s own restore effect uses — no request, no credit.
  useEffect(() => {
    if (!retained) return
    setMeasurement(retained)
    const { audit: computed, obsoleteCoverage: coverage } = auditCandidateFromMeasurement(candidate, retained)
    setObsoleteCoverage(coverage)
    setAudit(computed)
    onMeasured?.(computed)
    // `onMeasured` is an inline callback from the parent and would re-run
    // this on every render; the candidate and its retained evidence are what
    // actually determine the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.website, retained])

  const run = (forceRefresh: boolean) => {
    if (!candidate.website) return
    setRunning(true)
    setError(null)
    setMeasurement(null)
    setAudit(null)
    window.horus?.discovery.measureWebOpportunity({ url: candidate.website, forceRefresh })
      .then((outcome) => {
        setMeasurement(outcome as WebOpportunityMeasurementResult)
        if (outcome.status !== 'completed') return
        // DEC-110. Delegates to the same shared module the bulk pre-screen
        // uses (`candidate-scoring.ts`); behavior unchanged from before this
        // extraction (DEC-097/DEC-098).
        const { audit: computed, obsoleteCoverage } = auditCandidateFromMeasurement(candidate, outcome)
        setObsoleteCoverage(obsoleteCoverage)
        setAudit(computed)
        onMeasured?.(computed)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The web-opportunity measurement was rejected.'))
      .finally(() => setRunning(false))
  }

  return (
    <div className="candidate-score">
      {/* DEC-117. A URL already measured is served for nothing (DEC-020: once
          stored, evidence can be re-derived from any number of times for
          free), so a candidate measured before must not be offered a button
          that says it spends. Measuring again is still available, and still
          says what it costs. */}
      <button className="secondary" onClick={() => run(false)} disabled={running || !candidate.website}>
        {running
          ? 'Measuring…'
          : audit
            ? 'Re-check from retained measurement (no credit)'
            : 'Measure web opportunity (spends a real PageSpeed request)'}
      </button>
      {audit && (
        <button className="secondary" onClick={() => run(true)} disabled={running || !candidate.website}>
          Measure again (spends a real PageSpeed request)
        </button>
      )}
      {!candidate.website && <p className="notice">No website field on this listing; nothing to measure.</p>}
      {measurement?.status === 'completed' && measurement.fromCache && (
        <p className="success">Served from a measurement already retained, retrieved {measurement.retrievedAt} — no PageSpeed credit spent.</p>
      )}
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
            {audit.factors.map((factor) => (
              <li key={factor.id}>
                <span className={`factor-dot factor-dot--${factor.status}`} aria-hidden="true" />
                {factor.id}: {factor.score.toFixed(1)}/{factor.maximum} ({factor.status})
              </li>
            ))}
          </ul>
          {audit.flags.length > 0 && <ul className="checklist">{audit.flags.map((flag, i) => <li key={i}>{flag}</li>)}</ul>}
        </div>
      )}
    </div>
  )
}
