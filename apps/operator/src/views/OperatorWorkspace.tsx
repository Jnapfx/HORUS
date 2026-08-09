import { useEffect, useState } from 'react'
import { screenListingGates, buildReputationScore, type ReputationScore } from '../domain/reputation-scoring'
import { summarizeReviewHistory } from '../domain/review-history'
import { findRecordedJudgment, type JudgmentEvent } from '../domain/judgment-log'
import { resolveJudgment, emptyJudgment } from '../domain/operator-judgment'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { CandidateScoreAction, CandidateWebOpportunityAction } from './CandidateActions'
import { ShortlistView } from './ShortlistView'
import { ProspectRecord, type ProspectSection } from './ProspectRecord'
import { RealTrackerPanel } from './RealTrackerPanel'
import { AnalystPanel } from './AnalystPanel'
import { RepresentativeWorkflow } from './RepresentativeWorkflow'
import type { DiscoveryRunResult } from './types'

/**
 * DEC-102. The operator workspace: FUNCTIONAL_DESIGN §6's six named views,
 * existing as views for the first time.
 *
 * Until now the interface was one scrolling shell with panels appended as each
 * capability was built (DEC-069 onward), and every Phase 6 checkpoint carried
 * "the six named views do not exist as views" as a known weakness. The layout
 * here follows the operator's own prototype: a fixed rail grouping the
 * workflow, the two approval gates, and the history, with one view in the main
 * area at a time.
 *
 * **Why the state lives here rather than in each view.** Discovery results,
 * per-candidate scores, audits and the selected prospect are shared by four of
 * the six views. Owning them at this level is what lets the operator move
 * between Prospect, Demo review and Outreach without losing a demonstration
 * preview or a half-written outreach draft — which is also why
 * `ProspectRecord` is mounted once and told which section to show, rather than
 * rendered separately inside three view branches, where React would unmount it
 * on every switch and silently discard the draft.
 */

type ViewId = 'search' | 'shortlist' | 'prospect' | 'demo' | 'outreach' | 'tracker' | 'analyst' | 'representative'

const NAV: ReadonlyArray<{ group: string; items: ReadonlyArray<{ id: ViewId; label: string }> }> = [
  { group: 'Workflow', items: [
    { id: 'search', label: 'Search' },
    { id: 'shortlist', label: 'Shortlist' },
    { id: 'prospect', label: 'Prospect' },
  ] },
  { group: 'Approvals', items: [
    { id: 'demo', label: 'Demo review' },
    { id: 'outreach', label: 'Outreach' },
  ] },
  { group: 'History', items: [
    { id: 'tracker', label: 'Tracker' },
  ] },
  // DEC-099 placed the agent outside V1's critical path. It keeps a surface,
  // separated from the workflow rather than listed inside it.
  { group: 'Experimental', items: [
    { id: 'analyst', label: 'Agent analyst' },
    { id: 'representative', label: 'Phase 4 walkthrough' },
  ] },
]

export function OperatorWorkspace() {
  const [view, setView] = useState<ViewId>('search')
  const [input, setInput] = useState({ category: '', city: '', maxExamined: 20 })
  const [forceRefresh, setForceRefresh] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DiscoveryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [homeBase, setHomeBase] = useState<Coordinates | null | undefined>(undefined)
  const [scores, setScores] = useState<Record<string, ReputationScore>>({})
  const [audits, setAudits] = useState<Record<string, WebOpportunityAudit>>({})
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null)

  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    if (homeBase !== undefined) return
    void window.horus?.discovery.getHomeBaseCoordinates().then(setHomeBase)
  }, [homeBase])

  /**
   * DEC-107. Rebuilds the last session from evidence already on disk, so
   * closing the application no longer throws away a search the operator paid
   * for. Costs nothing — no request is made.
   *
   * Scores are **recomputed** from the retained review snapshots rather than
   * restored from a stored copy, which is charter §14's own model: evidence is
   * immutable, everything derived from it is recomputable, and a second stored
   * copy of a score is a thing that can drift from the evidence that produced
   * it. The operator's recorded judgment (DEC-094) is read back and applied,
   * so a candidate that qualified yesterday still qualifies today.
   */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const bridge = window.horus
      if (!bridge) { setRestoring(false); return }
      try {
        const [session, judgmentEvents] = await Promise.all([bridge.session.restore(), bridge.judgment.list()])
        if (cancelled || !session.discovery) return

        const request = session.discovery.request as { category?: string; city?: string } | null
        if (request?.category && request?.city) {
          setInput((current) => ({ ...current, category: request.category!, city: request.city! }))
        }

        // Rebuilt from the retained snapshot. No request is made, so a
        // restore can never spend a credit.
        const outcome = {
          status: 'completed' as const,
          snapshotId: session.discovery.snapshotId,
          retrievedAt: session.discovery.retrievedAt,
          candidateCount: session.discovery.candidates.length,
          candidates: session.discovery.candidates,
          fromCache: true,
        }
        setResult(outcome as unknown as DiscoveryRunResult)
        setConfirmed(true)

        // Recompute a score for every candidate whose review history is
        // already retained, applying whatever judgment was recorded for it.
        const restored: Record<string, ReputationScore> = {}
        for (const candidate of outcome.candidates) {
          const dataId = candidate.dataId
          if (!dataId) continue
          const history = session.reviewHistories[dataId]
          if (!history) continue
          const reviews = (history.reviews as { iso_date?: string; rating?: number }[])
            .filter((r) => typeof r.iso_date === 'string' && typeof r.rating === 'number')
            .map((r) => ({ isoDate: r.iso_date!, rating: r.rating! }))
          if (reviews.length === 0) continue
          const summary = summarizeReviewHistory({ reviews, retrievedAt: history.retrievedAt, paginationExhausted: history.paginationExhausted })
          const prior = findRecordedJudgment(judgmentEvents as JudgmentEvent[], dataId)
          const assessed = resolveJudgment(prior?.judgment ?? emptyJudgment())
          restored[dataId] = buildReputationScore({
            listingId: dataId,
            retrievedAt: history.retrievedAt,
            rating: candidate.rating === null ? { status: 'unmeasured', reason: 'No rating on the listing.' } : { status: 'measured', value: candidate.rating },
            reviewCount: candidate.reviewCount === null ? { status: 'unmeasured', reason: 'No review count on the listing.' } : { status: 'measured', value: candidate.reviewCount },
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
              ? { status: 'unmeasured', reason: 'Fewer than two dated reviews were retrieved.' }
              : { status: 'measured', value: { historySpanYears: summary.retrievedHistorySpanYears } },
            complaintPattern: assessed.complaintPattern,
            operationalStatus: assessed.operationalStatus,
            listingIdentity: assessed.listingIdentity,
            market: { status: 'within_target', evidence: 'Discovered via a search already scoped to the target city.' },
          })
        }
        if (!cancelled && Object.keys(restored).length > 0) setScores(restored)
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const run = () => {
    setRunning(true)
    setError(null)
    setResult(null)
    window.horus?.discovery.run({ ...input, forceRefresh })
      .then((outcome) => setResult(outcome as DiscoveryRunResult))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The discovery request was rejected.'))
      .finally(() => setRunning(false))
  }

  const completed = result?.status === 'completed' ? result : null
  const canRun = confirmed && input.category.trim().length > 0 && input.city.trim().length > 0 && !running

  const prospectSection: ProspectSection =
    view === 'prospect' ? 'evidence' : view === 'demo' ? 'demonstration' : view === 'outreach' ? 'outreach' : 'hidden'

  return (
    <div className="workspace">
      <header className="workspace-header">
        <h1 className="workspace-mark">HORUS</h1>
        <p className="workspace-context">
          Operator workspace{input.city.trim() ? ` · ${input.city.trim()}` : ''}
        </p>
        <span className="workspace-badge">
          {restoring ? 'Restoring last session…' : completed ? `${completed.candidateCount} candidates retrieved` : 'No search run yet'}
        </span>
      </header>

      <div className="workspace-body">
        <nav className="workspace-nav" aria-label="Operator views">
          {NAV.map((section) => (
            <div key={section.group}>
              <p className="workspace-nav-group">{section.group}</p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`workspace-nav-item${view === item.id ? ' active' : ''}`}
                      aria-current={view === item.id ? 'page' : undefined}
                      onClick={() => setView(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="workspace-main">
          {view === 'search' && (
            <section aria-label="Search market">
              <p className="eyebrow">REAL SEARCH · SPENDS A SERPAPI CREDIT</p>
              <h2>Search market</h2>
              <p>
                Calls SerpApi's Google Maps API and retains the raw response as immutable local evidence
                (DEC-020, DEC-046). One request only — it does not paginate to a target or maximum. It publishes
                nothing and contacts no one. A repeat search for the same category and city reuses the stored
                evidence instead of spending another credit (DEC-077), unless a fresh search is forced.
              </p>

              <div className="search-form">
                <label>Business category<input value={input.category} onChange={(e) => setInput({ ...input, category: e.target.value })} placeholder="e.g. landscaping" /></label>
                <label>City and region<input value={input.city} onChange={(e) => setInput({ ...input, city: e.target.value })} placeholder="e.g. Stamford, Connecticut" /></label>
                <label>Candidates to return, up to 20<input type="number" min="1" max="20" value={input.maxExamined} onChange={(e) => setInput({ ...input, maxExamined: Number(e.target.value) })} /></label>
              </div>

              <label className="confirm-spend"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I understand this may spend a real SerpApi credit and retrieves real business data.</label>
              <label className="confirm-spend"><input type="checkbox" checked={forceRefresh} onChange={(e) => setForceRefresh(e.target.checked)} /> Force a fresh search even if a cached result exists (spends a new credit).</label>

              <button onClick={run} disabled={!canRun}>{running ? 'Searching…' : 'Start bounded search'}</button>
              {!confirmed && <p className="control-hint">Blocked: acknowledge the credit cost above before this can be used.</p>}

              {error && <div className="error" role="alert"><strong>Request rejected before completion.</strong><p>{error}</p></div>}
              {result?.status === 'failed' && <div className="error" role="alert"><strong>Search failed: {result.reason}</strong><p>{result.detail}</p></div>}

              {completed && (
                <>
                  <p className="success">
                    {completed.fromCache
                      ? `Served from cached evidence snapshot ${completed.snapshotId}, retrieved ${completed.retrievedAt} — no new SerpApi credit spent.`
                      : `Retrieved and stored as new evidence snapshot ${completed.snapshotId} at ${completed.retrievedAt}.`}
                  </p>
                  <h3>Candidates ({completed.candidateCount})</h3>
                  <ul className="evidence-list">
                    {completed.candidates.map((candidate, index) => {
                      const key = candidate.dataId ?? `index-${index}`
                      const screen = screenListingGates({ rating: candidate.rating, reviewCount: candidate.reviewCount })
                      const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
                      return (
                        <li key={index}>
                          <p>
                            {candidate.name ?? 'Unnamed listing'} — {candidate.rating ?? 'no rating'} rating · {candidate.reviewCount ?? 'no review count'} reviews · {candidate.website ? 'has a website field' : 'no website field'}
                            {' · '}<span title={screen.g1.evidence}>G1 {screen.g1.status}</span>
                            {' · '}<span title={screen.g2.evidence}>G2 {screen.g2.status}</span>
                            {' · '}
                            {proximity
                              ? <span title="Straight-line distance (DEC-074); charter bands are provisional, not driving distance">{proximity.distanceMiles} mi · {proximity.band}</span>
                              : <span>proximity unavailable{homeBase === null ? ' (home base coordinates not configured)' : candidate.coordinates === null ? ' (no coordinates on this listing)' : ''}</span>}
                          </p>
                          <CandidateScoreAction candidate={candidate} onScored={(score) => setScores((prev) => ({ ...prev, [key]: score }))} />
                          <CandidateWebOpportunityAction candidate={candidate} onMeasured={(audit) => setAudits((prev) => ({ ...prev, [key]: audit }))} />
                        </li>
                      )
                    })}
                  </ul>
                  <p className="notice">
                    Raw discovery candidates with a G1/G2 quick screen from listing data alone (charter 9.1). Full
                    qualification needs review-history retrieval and your judgment on G4–G6 — both per candidate,
                    above. Ranking happens on the Shortlist view.
                  </p>
                </>
              )}
            </section>
          )}

          {view === 'shortlist' && (
            <section aria-label="Shortlist">
              <p className="eyebrow">RANKED BY PROXIMITY BAND, THEN WEB OPPORTUNITY</p>
              <h2>Shortlist</h2>
              {!completed
                ? <p className="notice">No search has been run yet. Start on the Search view.</p>
                : <ShortlistView
                    candidates={completed.candidates}
                    scores={scores}
                    audits={audits}
                    homeBase={homeBase}
                    selectedProspectId={selectedProspectId}
                    onSelect={(id) => { setSelectedProspectId(id); setView('prospect') }}
                  />}
            </section>
          )}

          {view === 'prospect' && !selectedProspectId && (
            <section aria-label="Prospect"><h2>Prospect</h2>
              <p className="notice">No prospect is selected. Rank candidates on the Shortlist view and select one there.</p>
            </section>
          )}
          {view === 'demo' && !selectedProspectId && (
            <section aria-label="Demonstration review"><h2>Demo review</h2>
              <p className="notice">No prospect is selected, so there is nothing to review. DEC-004's first gate lives here.</p>
            </section>
          )}
          {view === 'outreach' && !selectedProspectId && (
            <section aria-label="Outreach"><h2>Outreach</h2>
              <p className="notice">No prospect is selected. DEC-004's second gate lives here, and opens only after a demonstration is published.</p>
            </section>
          )}

          {/* Mounted once, across all three of its views, so a preview or a
              half-written draft survives switching between them. */}
          {completed && selectedProspectId && (
            <ProspectRecord
              id={selectedProspectId}
              section={prospectSection}
              evidenceRetrievedAt={completed.retrievedAt}
              searchContext={{ category: input.category, city: input.city, maxExamined: input.maxExamined }}
              candidates={completed.candidates}
              scores={scores}
              audits={audits}
              homeBase={homeBase}
              onClear={() => { setSelectedProspectId(null); setView('shortlist') }}
            />
          )}

          {view === 'tracker' && <RealTrackerPanel />}
          {view === 'analyst' && <AnalystPanel />}
          {view === 'representative' && <RepresentativeWorkflow />}
        </main>
      </div>
    </div>
  )
}
