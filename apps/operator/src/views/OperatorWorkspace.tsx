import { useEffect, useState } from 'react'
import { screenListingGates, type ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { findRecordedJudgment, type JudgmentEvent } from '../domain/judgment-log'
import { CandidateScoreAction, CandidateWebOpportunityAction } from './CandidateActions'
import { auditCandidateFromMeasurement, buildCandidateEvidenceReferences, scoreCandidateFromHistory } from './candidate-scoring'
import { ShortlistView } from './ShortlistView'
import { ProspectRecord, type ProspectSection } from './ProspectRecord'
import { RealTrackerPanel } from './RealTrackerPanel'
import { AnalystPanel } from './AnalystPanel'
import { RepresentativeWorkflow } from './RepresentativeWorkflow'
import type { AnalystRunResult, DiscoveryRunResult, RestoredReviewHistory, RestoredWebOpportunityMeasurement } from './types'

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
  // DEC-110. Bulk pre-screen: automates the per-candidate scoring buttons
  // below for every G1/G2-passing candidate, one consent covering all of it.
  const [prescreenConfirmed, setPrescreenConfirmed] = useState(false)
  const [prescreening, setPrescreening] = useState(false)
  const [prescreenProgress, setPrescreenProgress] = useState<{ done: number; total: number } | null>(null)
  const [prescreenErrors, setPrescreenErrors] = useState<readonly string[]>([])
  // DEC-127's follow-up. The opportunity analyst's first real use in the
  // actual workflow (DEC-099 placed it outside V1's critical path pending
  // SECURITY_REVIEW.md finding F4, which DEC-127 closed). A single
  // operator-triggered batch, not a background process — the operator chose
  // "un botón único" over running automatically after every search.
  const [analystResults, setAnalystResults] = useState<Record<string, AnalystRunResult>>({})
  const [analyzeConfirmed, setAnalyzeConfirmed] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null)
  const [analyzeErrors, setAnalyzeErrors] = useState<readonly string[]>([])

  const [restoring, setRestoring] = useState(true)
  const [retainedHistories, setRetainedHistories] = useState<Record<string, RestoredReviewHistory>>({})
  // DEC-117. This candidate's own website URL's most recent retained
  // web-opportunity measurement, keyed by that URL (the same key
  // `measureWebOpportunity` is called with) — the audit equivalent of
  // `retainedHistories` above.
  const [retainedMeasurements, setRetainedMeasurements] = useState<Record<string, RestoredWebOpportunityMeasurement>>({})
  // DEC-115. The operator's own request: the Search view should start fresh
  // every time the application opens, while Shortlist and Prospect keep
  // showing everything already scored and judged. This flag controls the
  // Search view's own display only — `result`/`completed` is still restored
  // below unconditionally, because Shortlist and Prospect both read from it
  // and losing that would break "lo demas se debe quedar guardado." A fresh
  // `run()` in the current session, or the operator's own "Show it anyway"
  // escape hatch, is the only way this becomes true after a restore.
  const [searchResultsVisible, setSearchResultsVisible] = useState(false)
  // DEC-112. Hides a candidate from view — the operator's own request for a
  // way to drop businesses that are obviously not a fit before spending any
  // more attention on them. This never touches retained evidence (DEC-020's
  // raw snapshots are untouched, charter 14): it is purely a display filter,
  // so un-hiding costs nothing and a fresh search or restart clears it.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (homeBase !== undefined) return
    void window.horus?.discovery.getHomeBaseCoordinates().then(setHomeBase)
  }, [homeBase])

  /**
   * DEC-107, corrected by DEC-108, extended by DEC-117. Rebuilds the last
   * session from evidence already on disk, so closing the application no
   * longer throws away a search the operator paid for. Costs nothing — no
   * request is made.
   *
   * **Scoring itself is not done here** — it is delegated to the same
   * `scoreCandidateFromHistory`/`auditCandidateFromMeasurement` functions the
   * live per-candidate actions use (DEC-108's own lesson: two paths computing
   * the same thing independently drift). What *is* done here, new as of
   * DEC-117, is calling them eagerly for every candidate with retained
   * evidence, so `scores`/`audits` are populated the moment the application
   * opens rather than only once each candidate's own action component happens
   * to mount. Before this, a restored session's Shortlist looked exactly like
   * an unscored one — every previously-qualified candidate showed as "not yet
   * rankable" until the operator expanded it by hand — and DEC-115 made that
   * worse by hiding the Search view's own candidate list by default on
   * restore, removing the one place a `CandidateScoreAction` was guaranteed to
   * mount. This is exactly the "web-opportunity audits... not restored" gap
   * CLAUDE.md's own known-weaknesses list named.
   */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const bridge = window.horus
      if (!bridge) { setRestoring(false); return }
      try {
        const [session, judgmentEvents] = await Promise.all([
          bridge.session.restore(),
          bridge.judgment.list().catch(() => [] as JudgmentEvent[]),
        ])
        if (cancelled || !session.discovery) return

        // DEC-115. The Search form itself is deliberately left blank here —
        // the operator asked for the Search panel to start fresh every time
        // the application opens, not pre-filled with the last category and
        // city. Nothing below this line is skipped: the underlying evidence
        // is still restored so Shortlist and Prospect keep working.

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
        setRetainedHistories(session.reviewHistories)
        setRetainedMeasurements(session.webOpportunityMeasurements)
        // DEC-126. The operator's own request: the selected prospect stays
        // selected across a full app restart, not just within the running
        // session. Set directly from the restored value, not through
        // `selectProspect` — writing it straight back to the same store it
        // was just read from would be a pointless round trip on every launch.
        if (session.selectedProspectId) setSelectedProspectId(session.selectedProspectId)

        // DEC-117. Eagerly compute every restorable score and audit — see
        // this effect's own comment above for why this now happens here
        // rather than only lazily, per mounted candidate action.
        const nextScores: Record<string, ReputationScore> = {}
        for (const candidate of session.discovery.candidates) {
          if (!candidate.dataId) continue
          const history = session.reviewHistories[candidate.dataId]
          if (!history) continue
          const priorJudgment = findRecordedJudgment(judgmentEvents as JudgmentEvent[], candidate.dataId)?.judgment
          try {
            nextScores[candidate.dataId] = scoreCandidateFromHistory(candidate, history, priorJudgment)
          } catch {
            // A judgment recorded before a field this model reads existed, or
            // any other reconstruction failure, must not crash the restore —
            // that candidate simply stays unscored until re-touched by hand.
          }
        }
        if (Object.keys(nextScores).length > 0) setScores((prev) => ({ ...nextScores, ...prev }))

        const nextAudits: Record<string, WebOpportunityAudit> = {}
        for (const candidate of session.discovery.candidates) {
          const key = candidate.dataId
          if (!key || !candidate.website) continue
          const measurement = session.webOpportunityMeasurements[candidate.website]
          if (!measurement) continue
          try {
            nextAudits[key] = auditCandidateFromMeasurement(candidate, measurement).audit
          } catch {
            // Same reasoning as above: a reconstruction failure leaves this
            // one candidate unmeasured rather than aborting the restore.
          }
        }
        if (Object.keys(nextAudits).length > 0) setAudits((prev) => ({ ...nextAudits, ...prev }))
        // Deliberately *not* `setConfirmed(true)`. That acknowledgement is the
        // operator's consent to spend a credit, and restoring a session is not
        // the operator giving it — it left the application launched with the
        // search button already armed.
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
      .then((outcome) => {
        setResult(outcome as DiscoveryRunResult)
        // DEC-115. A search actually run in this session is always shown —
        // only a *restored* result starts hidden on the Search view.
        setSearchResultsVisible(true)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The discovery request was rejected.'))
      .finally(() => setRunning(false))
  }

  const completed = result?.status === 'completed' ? result : null
  const canRun = confirmed && input.category.trim().length > 0 && input.city.trim().length > 0 && !running

  /**
   * DEC-110. Automates exactly what the per-candidate "Fetch review history &
   * score" / "Measure web opportunity" buttons already do (CandidateActions),
   * for every candidate that passes the free G1/G2 screen first — the same
   * cheapest-first discipline the project's own conventions already state.
   * Candidates that fail G1/G2 are skipped without spending anything on them.
   *
   * This does not, and cannot, produce a `qualified` shortlist by itself:
   * G4/G5/G6 (charter 9.5) require the operator's own reading of the reviews
   * and are never auto-answered (DEC-008, hard rule 5). What it produces is a
   * provisional reputation score and web-opportunity measurement for every
   * viable candidate, so the Shortlist view's "not yet rankable" list — now
   * sorted best-scored-first — becomes a worklist of which candidates are
   * worth the operator's own judgment next, instead of an unordered dump of
   * every raw result.
   */
  const runBulkPrescreen = async () => {
    if (!completed) return
    const viable = completed.candidates.filter((candidate) => {
      if (!candidate.dataId) return false
      const screen = screenListingGates({ rating: candidate.rating, reviewCount: candidate.reviewCount })
      return screen.g1.status === 'passed' && screen.g2.status === 'passed'
    })
    setPrescreening(true)
    setPrescreenErrors([])
    setPrescreenProgress({ done: 0, total: viable.length })

    const errors: string[] = []
    for (const candidate of viable) {
      const key = candidate.dataId!
      const label = candidate.name ?? key

      try {
        const historyOutcome = await window.horus?.discovery.fetchReviewHistory({ dataId: key, forceRefresh: false })
        if (historyOutcome?.status === 'completed') {
          const score = scoreCandidateFromHistory(candidate, {
            retrievedAt: historyOutcome.retrievedAt,
            reviews: historyOutcome.reviews,
            paginationExhausted: historyOutcome.paginationExhausted,
          })
          setScores((prev) => ({ ...prev, [key]: score }))
        } else if (historyOutcome?.status === 'failed') {
          errors.push(`${label}: review history — ${historyOutcome.reason}`)
        }
      } catch (err) {
        errors.push(`${label}: review history — ${err instanceof Error ? err.message : 'request rejected'}`)
      }

      if (candidate.website) {
        try {
          const measured = await window.horus?.discovery.measureWebOpportunity({ url: candidate.website })
          if (measured?.status === 'completed') {
            const { audit } = auditCandidateFromMeasurement(candidate, measured)
            setAudits((prev) => ({ ...prev, [key]: audit }))
          } else if (measured?.status === 'failed') {
            errors.push(`${label}: web opportunity — ${measured.reason}`)
          }
        } catch (err) {
          errors.push(`${label}: web opportunity — ${err instanceof Error ? err.message : 'request rejected'}`)
        }
      }

      setPrescreenProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev))
    }

    setPrescreenErrors(errors)
    setPrescreening(false)
    setView('shortlist')
  }

  // DEC-112. Same key convention used everywhere else a candidate needs one
  // (`scores`, `audits`, `retainedHistories`): the listing's own `dataId`
  // when present, otherwise its position in the *original* discovery result,
  // computed before any filtering — so removing one candidate can never
  // relabel another.
  const visibleCandidates = (completed?.candidates ?? [])
    .map((candidate, index) => ({ candidate, key: candidate.dataId ?? `index-${index}` }))
    .filter(({ key }) => !dismissedIds.has(key))

  /**
   * DEC-127's follow-up. Runs the existing, unchanged `opportunity_analyst`
   * (DEC-049, DEC-065) once per already-scored candidate — every candidate
   * that has a retained reputation score, the same population "Auto-screen"
   * already produced. Sequential, not parallel: HORUS begins with a single
   * execution queue for Claude Code (`AGENT_ARCHITECTURE.md` §7), and running
   * one candidate at a time means a Claude Code failure partway through
   * (unavailable, rate-limited) leaves every candidate completed so far with
   * its result intact, not lost as part of a batch.
   *
   * The analyst is unchanged and still bounded by every rule in
   * `AGENT_ARCHITECTURE.md` §5: it computes no score, proposes no contact,
   * and this function saves nothing to workflow state. `runOpportunityAnalyst`
   * (`analyst-ipc.ts`) already persists each result as a draft on the main
   * process's side (DEC-067) — this only keeps a copy in memory so the
   * Shortlist can show it next to the deterministic score, exactly the
   * output `AnalystPanel` already rendered, just attached to the candidate
   * the operator is actually looking at instead of a separate experimental
   * view.
   */
  const runAnalystForCandidates = async () => {
    if (!completed) return
    const targets = visibleCandidates.filter(({ key }) => Boolean(scores[key]))
    setAnalyzing(true)
    setAnalyzeErrors([])
    setAnalyzeProgress({ done: 0, total: targets.length })

    const errors: string[] = []
    for (const { candidate, key } of targets) {
      const label = candidate.name ?? key
      const evidence = buildCandidateEvidenceReferences({
        discoverySnapshotId: completed.snapshotId,
        discoveryRetrievedAt: completed.retrievedAt,
        reviewHistory: candidate.dataId ? retainedHistories[candidate.dataId] ?? null : null,
        webOpportunityMeasurement: candidate.website ? retainedMeasurements[candidate.website] ?? null : null,
      })

      try {
        const outcome = await window.horus?.agent.runAnalyst([...evidence])
        if (outcome) setAnalystResults((prev) => ({ ...prev, [key]: outcome }))
        if (outcome?.status === 'failed') errors.push(`${label}: ${outcome.reason} — ${outcome.detail}`)
      } catch (err) {
        errors.push(`${label}: ${err instanceof Error ? err.message : 'the analyst task was rejected'}`)
      }

      setAnalyzeProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev))
    }

    setAnalyzeErrors(errors)
    setAnalyzing(false)
  }

  /**
   * DEC-126. The operator's own request: the selected prospect should "quede
   * guardado hasta que avance asi cierre la app" — stay selected across an
   * app restart, not just within the running session (`selectedProspectId`
   * itself is only ever in memory). Every place that changes the selection —
   * qualifying a candidate, picking one on the Shortlist, or clearing it —
   * goes through this one function so persisting it can never be missed at
   * one of those call sites. The write is fire-and-forget: navigation itself
   * does not wait on it, since it is not a consequential action requiring
   * confirmation (DEC-004 gates are unaffected either way), only a durability
   * improvement over what was already happening in memory.
   */
  const selectProspect = (dataId: string | null) => {
    setSelectedProspectId(dataId)
    void window.horus?.prospect.setSelected({ dataId })
  }

  /**
   * DEC-113. The operator's own request: the moment recording a judgment is
   * what makes a candidate qualified, it should become the selected prospect
   * and stay there — not require a separate trip to the Shortlist to press
   * "Select as prospect" on a candidate that was just, in effect, selected by
   * the operator's own judgment. This is navigation only: it does not
   * publish, contact anyone, or cross either DEC-004 gate, and it is exactly
   * what "Select as prospect" already did, just triggered by the same button
   * press that recorded the judgment instead of a second one.
   */
  const onCandidateQualified = (dataId: string) => {
    selectProspect(dataId)
    setView('prospect')
  }

  // DEC-126. The operator's own request, from the Shortlist: a single button
  // to clear every candidate from this list at once, instead of removing them
  // one at a time. Reuses the same `dismissedIds` display filter the
  // per-candidate "Remove" button already writes to (DEC-112) — this never
  // touches retained evidence, only what is shown; "Restore all" on the
  // Search view already undoes it.
  const clearShortlist = () => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      for (const { key } of visibleCandidates) next.add(key)
      return next
    })
  }

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
                      data-view={item.id}
                      aria-current={view === item.id ? 'page' : undefined}
                      onClick={() => setView(item.id)}
                    >
                      {/* DEC-119. Purely decorative — a per-view shape, not a
                          completion indicator (no state currently tracks
                          per-view completion, and this does not invent any).
                          aria-hidden so it adds nothing to the accessible
                          name a test or screen reader would see. */}
                      <span className="nav-icon" aria-hidden="true" />
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
              <details className="explainer">
                <summary>What this does</summary>
                <p>
                  Calls SerpApi's Google Maps API and retains the raw response as immutable local evidence
                  (DEC-020, DEC-046). One request only — it does not paginate to a target or maximum. It publishes
                  nothing and contacts no one. A repeat search for the same category and city reuses the stored
                  evidence instead of spending another credit (DEC-077), unless a fresh search is forced.
                </p>
              </details>

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

              {completed && !searchResultsVisible && (
                <p className="notice">
                  A search from an earlier session is saved ({completed.candidateCount} candidates, retrieved{' '}
                  {completed.retrievedAt}) — Shortlist and Prospect already reflect it.{' '}
                  <button className="secondary" onClick={() => setSearchResultsVisible(true)}>Show it here too</button>
                </p>
              )}

              {completed && searchResultsVisible && (
                <>
                  <p className="success">
                    {completed.fromCache
                      ? `Served from cached evidence snapshot ${completed.snapshotId}, retrieved ${completed.retrievedAt} — no new SerpApi credit spent.`
                      : `Retrieved and stored as new evidence snapshot ${completed.snapshotId} at ${completed.retrievedAt}.`}
                  </p>
                  <div className="gate-zone">
                    <h4>Auto-screen candidates</h4>
                    <details className="explainer">
                      <summary>What this does</summary>
                      <p className="notice">
                        Runs the free G1/G2 screen on every candidate, then automatically retrieves review history and
                        measures web opportunity — the same actions available per candidate below — for every one that
                        passes it. This produces a provisional reputation score for each, sorted best-first on the
                        Shortlist view, so you know which candidates are worth reading reviews for next. It does{' '}
                        <strong>not</strong> qualify anyone: G4–G6 still need your own reading of the reviews
                        (charter 9.5) before any candidate can be ranked.
                      </p>
                    </details>
                    <label className="confirm-spend">
                      <input type="checkbox" checked={prescreenConfirmed} onChange={(e) => setPrescreenConfirmed(e.target.checked)} />
                      {' '}I understand this spends a SerpApi review-history credit and, for candidates with a website, a
                      PageSpeed request, for every candidate that passes G1/G2.
                    </label>
                    <button onClick={runBulkPrescreen} disabled={!prescreenConfirmed || prescreening}>
                      {prescreening
                        ? `Screening… ${prescreenProgress ? `${prescreenProgress.done}/${prescreenProgress.total}` : ''}`
                        : 'Auto-screen candidates & rank'}
                    </button>
                    {!prescreenConfirmed && <p className="control-hint">Blocked: acknowledge the credit cost above before this can be used.</p>}
                    {prescreenErrors.length > 0 && (
                      <div className="error" role="alert">
                        <strong>{prescreenErrors.length} candidate(s) could not be screened; the rest completed.</strong>
                        <ul className="checklist">{prescreenErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {/* DEC-127's follow-up. The agent analyst's first real use in
                      the actual workflow (DEC-099 kept it outside V1's
                      critical path until F4 closed). Placed after Auto-screen
                      because it reads what Auto-screen already retrieved —
                      running it on an unscored candidate would have nothing
                      to attach evidence to. Its output is read-only and never
                      qualifies, ranks, or approves anything (AGENT_ARCHITECTURE
                      §5); results show on the Shortlist next to each
                      candidate's score. */}
                  <div className="gate-zone">
                    <h4>Analyze candidates (agent, experimental)</h4>
                    <details className="explainer">
                      <summary>What this does</summary>
                      <p className="notice">
                        Runs the opportunity analyst (a bounded, read-only Claude Code task — AGENT_ARCHITECTURE.md) once
                        for every already-scored candidate, over exactly the evidence already retrieved for it. It reports
                        observations and which candidates it thinks are worth your review, always citing the evidence
                        behind each claim. It computes <strong>no score</strong>, proposes <strong>no contact</strong>, and
                        cannot qualify, rank, or approve anything — G4–G6 and both DEC-004 gates remain entirely yours.
                      </p>
                    </details>
                    <label className="confirm-spend">
                      <input type="checkbox" checked={analyzeConfirmed} onChange={(e) => setAnalyzeConfirmed(e.target.checked)} />
                      {' '}I understand this runs a local Claude Code task per scored candidate, using this Claude
                      subscription's own usage limit — not a SerpApi or PageSpeed credit.
                    </label>
                    <button onClick={() => void runAnalystForCandidates()} disabled={!analyzeConfirmed || analyzing || visibleCandidates.every(({ key }) => !scores[key])}>
                      {analyzing
                        ? `Analyzing… ${analyzeProgress ? `${analyzeProgress.done}/${analyzeProgress.total}` : ''}`
                        : 'Analyze candidates'}
                    </button>
                    {!analyzeConfirmed && <p className="control-hint">Blocked: acknowledge the usage cost above before this can be used.</p>}
                    {visibleCandidates.every(({ key }) => !scores[key]) && (
                      <p className="control-hint">Score at least one candidate above (or run Auto-screen) before there is anything for the analyst to read.</p>
                    )}
                    {analyzeErrors.length > 0 && (
                      <div className="error" role="alert">
                        <strong>{analyzeErrors.length} candidate(s) could not be analyzed; the rest completed.</strong>
                        <ul className="checklist">{analyzeErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  <h3>Candidates ({visibleCandidates.length}{visibleCandidates.length !== completed.candidateCount ? ` of ${completed.candidateCount}` : ''})</h3>
                  {dismissedIds.size > 0 && (
                    <p className="control-hint">
                      {dismissedIds.size} removed from this list. <button className="secondary" onClick={() => setDismissedIds(new Set())}>Restore all</button>
                    </p>
                  )}
                  <ul className="evidence-list">
                    {visibleCandidates.map(({ candidate, key }) => {
                      const screen = screenListingGates({ rating: candidate.rating, reviewCount: candidate.reviewCount })
                      const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
                      return (
                        <li key={key} id={`candidate-${key}`}>
                          <p>
                            <strong>{candidate.name ?? 'Unnamed listing'}</strong>
                            {' — '}{candidate.rating ?? '—'}★ · {candidate.reviewCount ?? '—'} reviews
                            {' · '}<span title={`G1 (${screen.g1.status}): ${screen.g1.evidence}`}>G1 {screen.g1.status}</span>
                            {' · '}<span title={`G2 (${screen.g2.status}): ${screen.g2.evidence}`}>G2 {screen.g2.status}</span>
                            {' · '}
                            {proximity
                              ? <span title="Straight-line distance (DEC-074); charter bands are provisional, not driving distance">{proximity.distanceMiles} mi</span>
                              : <span title={homeBase === null ? 'Home base coordinates not configured' : 'No coordinates on this listing'}>distance n/a</span>}
                            {' · '}
                            <button
                              className="secondary"
                              onClick={() => setDismissedIds((prev) => new Set(prev).add(key))}
                              title="Removes it from this list only — does not delete any retained evidence."
                            >
                              Remove
                            </button>
                          </p>
                          <CandidateScoreAction
                            candidate={candidate}
                            retained={candidate.dataId ? retainedHistories[candidate.dataId] ?? null : null}
                            onScored={(score) => setScores((prev) => ({ ...prev, [key]: score }))}
                            onQualified={onCandidateQualified}
                          />
                          <CandidateWebOpportunityAction
                            candidate={candidate}
                            retained={candidate.website ? retainedMeasurements[candidate.website] ?? null : null}
                            onMeasured={(audit) => setAudits((prev) => ({ ...prev, [key]: audit }))}
                          />
                        </li>
                      )
                    })}
                  </ul>
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
                    candidates={visibleCandidates.map((v) => v.candidate)}
                    scores={scores}
                    audits={audits}
                    homeBase={homeBase}
                    selectedProspectId={selectedProspectId}
                    onSelect={(id) => { selectProspect(id); setView('prospect') }}
                    retainedHistories={retainedHistories}
                    retainedMeasurements={retainedMeasurements}
                    onScored={(key, score) => setScores((prev) => ({ ...prev, [key]: score }))}
                    onMeasured={(key, audit) => setAudits((prev) => ({ ...prev, [key]: audit }))}
                    onQualified={onCandidateQualified}
                    onClearAll={clearShortlist}
                    analystResults={analystResults}
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
              onClear={() => { selectProspect(null); setView('shortlist') }}
              // DEC-129. The same assembly the Shortlist's "Analyze candidates"
              // button already uses (DEC-128) — this prospect's own retained
              // evidence, and nothing the deterministic score itself lacks.
              evidenceReferences={buildCandidateEvidenceReferences({
                discoverySnapshotId: completed.snapshotId,
                discoveryRetrievedAt: completed.retrievedAt,
                reviewHistory: (() => {
                  const dataId = completed.candidates.find((c, i) => (c.dataId ?? `index-${i}`) === selectedProspectId)?.dataId
                  return dataId ? retainedHistories[dataId] ?? null : null
                })(),
                webOpportunityMeasurement: (() => {
                  const website = completed.candidates.find((c, i) => (c.dataId ?? `index-${i}`) === selectedProspectId)?.website
                  return website ? retainedMeasurements[website] ?? null : null
                })(),
              })}
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
