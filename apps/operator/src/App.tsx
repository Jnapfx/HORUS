import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  approveDemonstration,
  approveOutreach,
  createRepresentativeWorkflow,
  declareDeliveryAndNextAction,
  moveWorkflow,
  openLocalGmailHandoff,
  publishLocalDemonstration,
  representativeProspect,
  validateRepresentativeSearch,
  type VerticalWorkflowState,
  type WorkflowStep,
} from './domain/representative-workflow'
import { buildReputationScore, screenListingGates, type ReputationScore } from './domain/reputation-scoring'
import { summarizeReviewHistory } from './domain/review-history'
import { buildWebOpportunityAudit, type WebOpportunityAudit } from './domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from './domain/proximity'
import { buildShortlist, type ShortlistCandidateInput } from './domain/shortlist'
import { buildDemonstrationSite } from './domain/demonstration'
import { buildOutreachDraft } from './domain/outreach'
import { buildTrackerView, type TrackerEvent } from './domain/tracker'

type FoundationStatus = Awaited<ReturnType<NonNullable<Window['horus']>['foundation']['getStatus']>>

const stages: Array<{ step: WorkflowStep; label: string; title: string }> = [
  { step: 'search', label: '01', title: 'Define search' },
  { step: 'shortlist', label: '02', title: 'Discover & rank' },
  { step: 'prospect', label: '03–04', title: 'Select prospect' },
  { step: 'demonstration', label: '05', title: 'Prepare demonstration' },
  { step: 'demo_review', label: '06', title: 'Approve demonstration' },
  { step: 'publication', label: '07', title: 'Publish demonstration' },
  { step: 'outreach', label: '08', title: 'Prepare outreach' },
  { step: 'outreach_review', label: '09', title: 'Approve outreach' },
  { step: 'gmail_handoff', label: '09', title: 'Gmail handoff' },
  { step: 'tracker', label: '10', title: 'Track next action' },
]

function App() {
  const [status, setStatus] = useState<FoundationStatus | null>(null)
  const [workflow, setWorkflow] = useState<VerticalWorkflowState>(() => createRepresentativeWorkflow())

  useEffect(() => {
    void window.horus?.foundation.getStatus().then(setStatus)
    void window.horus?.workflow.getRepresentative().then((saved) => { if (saved) setWorkflow(saved) })
  }, [])

  const current = useMemo(() => stages.find((stage) => stage.step === workflow.step)!, [workflow.step])
  const stepIndex = stages.findIndex((stage) => stage.step === workflow.step)
  const isComplete = workflow.deliveryDeclared

  const persist = (next: VerticalWorkflowState) => {
    void window.horus?.workflow.saveRepresentative(next)
      .then(() => window.horus?.foundation.getStatus())
      .then((nextStatus) => { if (nextStatus) setStatus(nextStatus) })
      // The main process is entitled to refuse a save (DEC-048). A refusal must
      // be visible rather than leaving the interface showing unsaved state.
      .catch((error: unknown) => {
        window.alert(error instanceof Error ? error.message : 'The workflow state was rejected by HORUS.')
      })
  }
  const updateWorkflow = (next: VerticalWorkflowState) => { setWorkflow(next); persist(next) }
  const advance = (step: WorkflowStep, detail: string) => updateWorkflow(moveWorkflow(workflow, step, detail))
  const guarded = (operation: (currentWorkflow: VerticalWorkflowState) => VerticalWorkflowState) => {
    try { updateWorkflow(operation(workflow)) } catch (error) { window.alert(error instanceof Error ? error.message : 'The workflow action was blocked.') }
  }

  return (
    <main className="workflow-shell">
      <header className="topbar">
        <div><p className="eyebrow">HORUS V1 · PHASE 4</p><h1>First vertical workflow</h1></div>
        <span className="local-badge">Representative local case · no contact</span>
      </header>

      <section className="case-notice" aria-label="Representative case boundary">
        <strong>Safe validation mode.</strong> This flow uses a fictional, source-free representative case. Search, public deployment, Gmail opening, and sending are not executed here.
      </section>

      <div className="workbench">
        <nav aria-label="Workflow stages"><ol>{stages.map((stage, index) => <li key={stage.step} className={stage.step === workflow.step ? 'active' : index < stepIndex ? 'complete' : ''}><span>{stage.label}</span><strong>{stage.title}</strong></li>)}</ol></nav>
        <section className="stage-panel" aria-labelledby="stage-title">
          <p className="eyebrow">CURRENT STAGE · {current.label}</p>
          <h2 id="stage-title">{current.title}</h2>
          {workflow.step === 'search' && <SearchStage onStart={() => advance('shortlist', 'Representative local search completed with a bounded fixture.')} />}
          {workflow.step === 'shortlist' && <ShortlistStage onSelect={() => advance('prospect', 'Representative prospect selected from local shortlist.')} />}
          {workflow.step === 'prospect' && <ProspectStage onPrepare={() => advance('demonstration', 'Local evidence snapshot frozen for demonstration preparation.')} />}
          {workflow.step === 'demonstration' && <DemonstrationStage onReview={() => advance('demo_review', 'Local demonstration inventory prepared for review.')} />}
          {workflow.step === 'demo_review' && <ReviewDemoStage approved={workflow.demoApproved} onApprove={() => guarded(approveDemonstration)} onContinue={() => advance('publication', 'Approved local demonstration moved to publication preflight.')} />}
          {workflow.step === 'publication' && <PublicationStage published={workflow.demoPublished} onPublish={() => guarded(publishLocalDemonstration)} onContinue={() => advance('outreach', 'Local publication record accepted; outreach preparation opened.')} />}
          {workflow.step === 'outreach' && <OutreachStage onReview={() => advance('outreach_review', 'Representative no-send outreach prepared for review.')} />}
          {workflow.step === 'outreach_review' && <ReviewOutreachStage approved={workflow.outreachApproved} onApprove={() => guarded(approveOutreach)} onContinue={() => advance('gmail_handoff', 'Approved representative outreach moved to handoff review.')} />}
          {workflow.step === 'gmail_handoff' && <HandoffStage opened={workflow.gmailHandoffOpened} onOpen={() => guarded(openLocalGmailHandoff)} onContinue={() => advance('tracker', 'Local no-send handoff recorded; tracker opened.')} />}
          {workflow.step === 'tracker' && <TrackerStage complete={isComplete} onDeclare={() => guarded((currentWorkflow) => declareDeliveryAndNextAction(currentWorkflow, { date: '2026-08-13', description: 'Review the representative local case.' }))} />}
        </section>
      </div>

      <section className="audit-strip"><div><span>LOCAL STORE</span><strong>{status ? `${status.eventCount} durable events` : 'Checking store…'}</strong></div><div><span>APPROVALS</span><strong>{workflow.demoApproved ? 'Demo approved' : 'Demo pending'} · {workflow.outreachApproved ? 'Outreach approved' : 'Outreach pending'}</strong></div><div><span>NEXT ACTION</span><strong>{workflow.nextAction?.description ?? 'Complete the workflow to schedule one'}</strong></div></section>

      <AnalystPanel />
      <RealDiscoverySearch />
      <RealTrackerPanel />
    </main>
  )
}

type DiscoveryRunResult = Awaited<ReturnType<NonNullable<Window['horus']>['discovery']['run']>>

/**
 * DEC-069. Deliberately outside the `stages` workflow above: that flow is the
 * Phase 4 representative case and its own banner promises "Search... are not
 * executed here." This section is the real thing — a real SerpApi request
 * that spends a real credit and retrieves real business data — so it gets
 * its own surface, its own spend-acknowledgement, and its own explicit scope
 * statement rather than silently changing what the representative flow means.
 */
function RealDiscoverySearch() {
  const [open, setOpen] = useState(false)
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

  useEffect(() => {
    if (!open || homeBase !== undefined) return
    void window.horus?.discovery.getHomeBaseCoordinates().then(setHomeBase)
  }, [open, homeBase])

  const run = () => {
    setRunning(true)
    setError(null)
    setResult(null)
    window.horus?.discovery.run({ category: input.category, city: input.city, maxExamined: input.maxExamined, forceRefresh })
      .then((outcome) => setResult(outcome as DiscoveryRunResult))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The discovery request was rejected.'))
      .finally(() => setRunning(false))
  }

  if (!open) {
    return <section className="discovery-panel collapsed"><button className="secondary" onClick={() => setOpen(true)}>Open real discovery search (spends a real SerpApi credit)</button></section>
  }

  const canRun = confirmed && input.category.trim().length > 0 && input.city.trim().length > 0 && !running

  return (
    <section className="discovery-panel" aria-label="Real discovery search">
      <p className="eyebrow">REAL SEARCH · SPENDS A SERPAPI CREDIT · SEPARATE FROM THE REPRESENTATIVE WORKFLOW ABOVE</p>
      <h2>Real discovery search</h2>
      <p>Calls SerpApi's Google Maps API directly and retains the raw response as immutable local evidence (DEC-020, DEC-046). It performs one request only — it does not yet paginate to a target/maximum, apply gates G1/G2, or compute a reputation or web-opportunity score. It does not publish anything or contact anyone. A repeat search for the same category and city reuses the stored evidence instead of spending another credit (DEC-077), unless "force a fresh search" is checked below.</p>

      <div className="search-form">
        <label>Category<input value={input.category} onChange={(event) => setInput({ ...input, category: event.target.value })} placeholder="e.g. landscaping" /></label>
        <label>City<input value={input.city} onChange={(event) => setInput({ ...input, city: event.target.value })} placeholder="e.g. Stamford, Connecticut" /></label>
        <label>Candidates to return, up to 20<input type="number" min="1" max="20" value={input.maxExamined} onChange={(event) => setInput({ ...input, maxExamined: Number(event.target.value) })} /></label>
      </div>

      <label className="confirm-spend"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand this may spend a real SerpApi credit and retrieves real business data.</label>
      <label className="confirm-spend"><input type="checkbox" checked={forceRefresh} onChange={(event) => setForceRefresh(event.target.checked)} /> Force a fresh search even if a cached result exists (spends a new credit).</label>

      <button onClick={run} disabled={!canRun}>{running ? 'Searching…' : 'Run real discovery search'}</button>

      {error && <div className="error" role="alert"><strong>Request rejected before completion.</strong><p>{error}</p></div>}

      {result?.status === 'failed' && <div className="error" role="alert"><strong>Search failed: {result.reason}</strong><p>{result.detail}</p></div>}

      {result?.status === 'completed' && (
        <div className="discovery-result">
          <p className="success">{result.fromCache ? `Served from cached evidence snapshot ${result.snapshotId}, retrieved ${result.retrievedAt} — no new SerpApi credit spent.` : `Retrieved and stored as new evidence snapshot ${result.snapshotId} at ${result.retrievedAt}.`}</p>
          <h3>Candidates ({result.candidateCount})</h3>
          <ul className="evidence-list">
            {result.candidates.map((candidate, index) => {
              const key = candidate.dataId ?? `index-${index}`
              const screen = screenListingGates({ rating: candidate.rating, reviewCount: candidate.reviewCount })
              const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
              return (
                <li key={index}>
                  <p>
                    {candidate.name ?? 'Unnamed listing'} — {candidate.rating ?? 'no rating'} rating · {candidate.reviewCount ?? 'no review count'} reviews · {candidate.website ? 'has a website field' : 'no website field'}
                    {' · '}
                    <span title={screen.g1.evidence}>G1 {screen.g1.status}</span>
                    {' · '}
                    <span title={screen.g2.evidence}>G2 {screen.g2.status}</span>
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
          <p className="notice">Raw discovery candidates only, with a G1/G2 quick screen from listing data alone (charter 9.1 — rating ≥ 4.5, at least 25 reviews). Full qualification (G3–G6 plus all five `reputation-scoring-v1` factors, DEC-068) requires review-history retrieval — a further real SerpApi cost per candidate, available per candidate below (DEC-071). Web-opportunity scoring is a separate, not-yet-wired step.</p>

          <ShortlistView
            candidates={result.candidates}
            scores={scores}
            audits={audits}
            homeBase={homeBase}
            selectedProspectId={selectedProspectId}
            onSelect={setSelectedProspectId}
          />

          {selectedProspectId && (
            <ProspectRecord
              id={selectedProspectId}
              candidates={result.candidates}
              scores={scores}
              audits={audits}
              homeBase={homeBase}
              onClear={() => setSelectedProspectId(null)}
            />
          )}
        </div>
      )}
    </section>
  )
}

/**
 * DEC-075. Ranks only candidates that already have all three real inputs —
 * reputation qualification, a proximity band, and a web-opportunity score —
 * per charter §11/DEC-013/DEC-017. Nothing here triggers a new retrieval or
 * spends a credit; it reads whatever the operator has already fetched with
 * the per-candidate actions above and orders it. A candidate missing an
 * input is listed under "not yet rankable" with the specific reason, never
 * silently dropped or guessed into a slot.
 */
function ShortlistView({
  candidates,
  scores,
  audits,
  homeBase,
  selectedProspectId,
  onSelect,
}: {
  candidates: readonly CandidateSummary[]
  scores: Record<string, ReputationScore>
  audits: Record<string, WebOpportunityAudit>
  homeBase: Coordinates | null | undefined
  selectedProspectId: string | null
  onSelect: (id: string) => void
}) {
  const inputs: ShortlistCandidateInput[] = candidates.map((candidate, index) => {
    const key = candidate.dataId ?? `index-${index}`
    const score = scores[key]
    const audit = audits[key]
    const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
    return {
      id: key,
      qualified: score?.qualified ?? false,
      reputationScoreLowerBound: score?.scoreLowerBound ?? null,
      webOpportunityScoreLowerBound: audit?.scoreLowerBound ?? null,
      proximityBand: proximity?.band ?? null,
    }
  })
  const shortlist = buildShortlist(inputs)
  const nameFor = (id: string) => candidates.find((c, i) => (c.dataId ?? `index-${i}`) === id)?.name ?? id

  return (
    <div className="shortlist-view">
      <h3>Shortlist ({shortlist.ranked.length} ranked, {shortlist.excluded.length} not yet rankable)</h3>
      {shortlist.ranked.length === 0 && <p className="notice">No candidate is ranked yet — score reputation and web opportunity for at least one candidate above, with proximity configured (DEC-074), to see it here.</p>}
      <ol className="evidence-list">
        {shortlist.ranked.map((entry) => (
          <li key={entry.id}>
            #{entry.rank} {nameFor(entry.id)} — {entry.proximityBand} · web-opportunity {entry.webOpportunityScoreLowerBound?.toFixed(1)} · reputation {entry.reputationScoreLowerBound?.toFixed(1)}
            {' · '}
            {selectedProspectId === entry.id
              ? <strong>selected as prospect</strong>
              : <button className="secondary" onClick={() => onSelect(entry.id)}>Select as prospect</button>}
          </li>
        ))}
      </ol>
      {shortlist.excluded.length > 0 && (
        <>
          <p className="notice">Not yet rankable:</p>
          <ul className="checklist">
            {shortlist.excluded.map((exclusion) => <li key={exclusion.candidate.id}>{nameFor(exclusion.candidate.id)} — {exclusion.reason}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * DEC-076. A read-only, consolidated view of one selected shortlist entry's
 * already-computed evidence — nothing new is fetched or scored here, and
 * nothing is persisted (deliberately; a SQLite schema addition for a
 * "selected prospect" record is a separate, bigger decision than this one).
 * Selecting a prospect here does not approve, publish, or contact anyone —
 * charter §4/DEC-004's two blocking gates apply only much later, to a
 * demonstration and to outreach, neither of which exists yet from real data.
 */
function ProspectRecord({
  id,
  candidates,
  scores,
  audits,
  homeBase,
  onClear,
}: {
  id: string
  candidates: readonly CandidateSummary[]
  scores: Record<string, ReputationScore>
  audits: Record<string, WebOpportunityAudit>
  homeBase: Coordinates | null | undefined
  onClear: () => void
}) {
  const index = candidates.findIndex((c, i) => (c.dataId ?? `index-${i}`) === id)
  const candidate = candidates[index]
  const [screenshot, setScreenshot] = useState<
    { status: 'captured'; dataUrl: string; capturedAt: string; url: string } | { status: 'rejected'; reason: string } | { status: 'failed'; reason: string } | null
  >(null)
  const [capturing, setCapturing] = useState(false)
  const [demoPreview, setDemoPreview] = useState<ReturnType<typeof buildDemonstrationSite> | null>(null)
  const [publishApproved, setPublishApproved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<
    { status: 'published'; url: string | null; projectName: string; publishedAt: string; deployOutput: string } | { status: 'failed'; reason: string; detail: string } | null
  >(null)
  const [outreachDraft, setOutreachDraft] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [outreachApproved, setOutreachApproved] = useState(false)
  const [openingHandoff, setOpeningHandoff] = useState(false)
  const [handoffResult, setHandoffResult] = useState<{ status: 'opened'; occurredAt: string } | { status: 'failed'; reason: string } | null>(null)
  const [declaredSent, setDeclaredSent] = useState<{ occurredAt: string } | null>(null)
  const [followUpForm, setFollowUpForm] = useState({ date: '', note: '' })
  const [followUpScheduled, setFollowUpScheduled] = useState<{ occurredAt: string } | null>(null)

  if (!candidate) return null
  const score = scores[id]
  const audit = audits[id]
  const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null

  const captureScreenshot = () => {
    if (!candidate.website) return
    setCapturing(true)
    window.horus?.discovery.captureScreenshot({ url: candidate.website })
      .then(setScreenshot)
      .finally(() => setCapturing(false))
  }

  const generateDemoPreview = () => {
    setDemoPreview(
      buildDemonstrationSite({
        business: {
          name: candidate.name,
          category: candidate.type,
          address: candidate.address,
          phone: candidate.phone,
          website: candidate.website,
          rating: candidate.rating,
          reviewCount: candidate.reviewCount,
        },
        generatedAt: new Date().toISOString(),
      }),
    )
    setPublishApproved(false)
    setPublishResult(null)
  }

  const publish = () => {
    if (!demoPreview || !publishApproved) return
    setPublishing(true)
    window.horus?.publish.demonstration({ html: demoPreview.html, businessName: candidate.name ?? id, dataId: candidate.dataId })
      .then((result) => {
        setPublishResult(result)
        if (result.status === 'published') {
          const draft = buildOutreachDraft({ name: candidate.name, category: candidate.type, demoUrl: result.url })
          setOutreachDraft({ to: '', subject: draft.subject, body: draft.body })
          setOutreachApproved(false)
          setHandoffResult(null)
          setDeclaredSent(null)
        }
      })
      .finally(() => setPublishing(false))
  }

  const openGmailHandoff = () => {
    if (!outreachDraft || !outreachApproved) return
    setOpeningHandoff(true)
    window.horus?.outreach.openGmailHandoff({
      approvalId: `${id}_${Date.now()}`,
      to: outreachDraft.to,
      subject: outreachDraft.subject,
      body: outreachDraft.body,
      dataId: candidate.dataId,
    })
      .then(setHandoffResult)
      .finally(() => setOpeningHandoff(false))
  }

  const declareSent = () => {
    if (!outreachDraft) return
    window.horus?.outreach.declareSent({ dataId: candidate.dataId, to: outreachDraft.to }).then(setDeclaredSent)
  }

  const scheduleFollowUp = () => {
    if (!followUpForm.date) return
    window.horus?.tracker
      .scheduleFollowUp({ dataId: candidate.dataId, to: outreachDraft?.to ?? null, date: followUpForm.date, note: followUpForm.note })
      .then(setFollowUpScheduled)
  }

  return (
    <div className="prospect-card" aria-label="Selected prospect record">
      <p className="eyebrow">SELECTED PROSPECT · READ-ONLY · NOT AN APPROVAL, PUBLICATION, OR CONTACT</p>
      <h3>{candidate.name ?? 'Unnamed listing'}</h3>
      <p>{candidate.address ?? 'No address on the listing'} · {candidate.type ?? 'no category'} · {candidate.website ?? 'no website'} · {candidate.phone ?? 'no phone on the listing'}</p>
      {proximity && <p>{proximity.distanceMiles} mi · {proximity.band} (straight-line, DEC-074)</p>}

      {score ? (
        <>
          <h4>Reputation — {score.status} · lower bound {score.scoreLowerBound.toFixed(1)}/{score.qualificationThreshold} · {score.qualified ? 'qualified' : 'not qualified'}</h4>
          <ul>{score.gates.map((gate) => <li key={gate.id} title={gate.evidence}>{gate.id}: {gate.status}</li>)}</ul>
          <ul>{score.factors.map((factor) => <li key={factor.id}>{factor.id}: {factor.score.toFixed(1)}/{factor.maximum}</li>)}</ul>
          {score.flags.length > 0 && <ul className="checklist">{score.flags.map((flag, i) => <li key={i}>{flag}</li>)}</ul>}
        </>
      ) : <p className="notice">Reputation not yet scored for this candidate.</p>}

      {audit ? (
        <>
          <h4>Web opportunity — {audit.status} · lower bound {audit.scoreLowerBound.toFixed(1)}/100</h4>
          <ul>{audit.factors.map((factor) => <li key={factor.id}>{factor.id}: {factor.score.toFixed(1)}/{factor.maximum} ({factor.status})</li>)}</ul>
        </>
      ) : <p className="notice">Web opportunity not yet measured for this candidate.</p>}

      <h4>Website screenshot</h4>
      {candidate.website ? (
        <>
          <button className="secondary" onClick={captureScreenshot} disabled={capturing}>
            {capturing ? 'Capturing…' : 'Capture website screenshot (loads the site in a hidden window, DEC-078)'}
          </button>
          {screenshot?.status === 'captured' && (
            <>
              <img src={screenshot.dataUrl} alt={`Screenshot of ${candidate.website}`} className="website-screenshot" />
              <p className="notice">Captured {screenshot.capturedAt}. Shown for the operator's reference only — never stored, never treated as scored evidence.</p>
            </>
          )}
          {screenshot?.status === 'rejected' && <p className="notice">Rejected: {screenshot.reason}</p>}
          {screenshot?.status === 'failed' && <p className="notice">Capture failed: {screenshot.reason}</p>}
        </>
      ) : <p className="notice">No website field on this listing; nothing to capture.</p>}

      <h4>Demonstration preview</h4>
      <p className="notice">Builds a single-page HTML preview from only the verified fields already shown above (DEC-005) — never published, never sent anywhere, not the DEC-004 approval gate. Missing fields render as a labelled placeholder, not a guess.</p>
      <button className="secondary" onClick={generateDemoPreview}>Generate demonstration preview (not published, DEC-079)</button>
      {demoPreview && (
        <>
          {demoPreview.missingFields.length > 0 && (
            <p className="notice">Rendered with placeholders for: {demoPreview.missingFields.join(', ')}.</p>
          )}
          {/* The demonstration keeps its own light stylesheet and shares no
              tokens with this interface — DEC-083 rule 6, DEC-037. */}
          <iframe
            title="Demonstration preview"
            srcDoc={demoPreview.html}
            sandbox=""
            className="demo-preview-frame"
          />

          {/* DEC-004's first blocking gate. DEC-083 rule 5: this surface carries
              gravity, never reward — no transition, no celebration on success. */}
          <div className="gate-zone">
          <h4>Publish this demonstration — real, public, DEC-004 gate</h4>
          <p className="notice">
            Deploys the exact preview above to a real, public Cloudflare Pages URL via your authenticated Wrangler CLI (DEC-080).
            Once published it is reachable by anyone with the link, {candidate.name ?? 'this business'} included. This is the one
            action in this app so far with a real, lasting, public consequence — nothing before this point has published or sent anything.
          </p>
          <label className="confirm-spend">
            <input type="checkbox" checked={publishApproved} onChange={(event) => setPublishApproved(event.target.checked)} />
            {' '}I approve publishing this demonstration publicly, as shown in the preview above.
          </label>
          <button onClick={publish} disabled={!publishApproved || publishing}>
            {publishing ? 'Publishing…' : 'Publish now (real deploy)'}
          </button>
          {/* DEC-083 rule 2: a dimmed control reads as absent rather than blocked,
              so the reason it is disabled is stated in words, not left to styling. */}
          {!publishApproved && <p className="control-hint">Blocked: record the approval above before this can be used.</p>}
          {publishResult?.status === 'published' && (
            <p className="success">
              Published to project {publishResult.projectName} at {publishResult.publishedAt}.
              {publishResult.url ? <> Live at <a href={publishResult.url} target="_blank" rel="noopener noreferrer">{publishResult.url}</a>.</> : ' Wrangler did not print a recognizable URL — check the deploy output or your Cloudflare dashboard.'}
            </p>
          )}
          {publishResult?.status === 'failed' && (
            <div className="error" role="alert"><strong>Publish failed: {publishResult.reason}</strong><p>{publishResult.detail}</p></div>
          )}
          </div>
        </>
      )}

      {outreachDraft && (
        <>
          <h4>Outreach — real Gmail handoff, second DEC-004 gate</h4>
          <p className="notice">
            Language: English (DEC-027 — no owner-review-reply, listing-language, or majority-review-language evidence is retrieved anywhere in
            this app yet, so Spanish is never selected without evidence that doesn't currently exist). Edit freely below before approving —
            HORUS drafts, you decide what actually gets sent. There is no verified email address for {candidate.name ?? 'this business'}
            anywhere in this pipeline; enter it yourself below.
          </p>
          <label>Recipient email (not verified by HORUS — enter it yourself)
            <input
              type="email"
              value={outreachDraft.to}
              onChange={(event) => setOutreachDraft({ ...outreachDraft, to: event.target.value })}
              placeholder="owner@example.com"
            />
          </label>
          <label>Subject
            <input value={outreachDraft.subject} onChange={(event) => setOutreachDraft({ ...outreachDraft, subject: event.target.value })} />
          </label>
          <label>Body
            <textarea
              value={outreachDraft.body}
              onChange={(event) => setOutreachDraft({ ...outreachDraft, body: event.target.value })}
              rows={10}
              style={{ width: '100%', fontFamily: 'inherit' }}
            />
          </label>
          {/* DEC-004's second blocking gate. Same treatment as the publish gate
              above, for the same reason (DEC-083 rule 5). */}
          <div className="gate-zone">
          <label className="confirm-spend">
            <input type="checkbox" checked={outreachApproved} onChange={(event) => setOutreachApproved(event.target.checked)} />
            {' '}I approve sending this exact message, as written above. HORUS will only open a Gmail compose window — it cannot send.
          </label>
          <button onClick={openGmailHandoff} disabled={!outreachApproved || openingHandoff || !outreachDraft.to}>
            {openingHandoff ? 'Opening…' : 'Open Gmail compose (real, opens your browser)'}
          </button>
          {(!outreachApproved || !outreachDraft.to) && (
            <p className="control-hint">
              Blocked: {!outreachDraft.to ? 'enter a recipient email above' : ''}
              {!outreachDraft.to && !outreachApproved ? ', and ' : ''}
              {!outreachApproved ? 'record the approval above' : ''}.
            </p>
          )}
          {handoffResult?.status === 'opened' && (
            <>
              <p className="success">Gmail compose opened at {handoffResult.occurredAt}. Review it in your browser and send it yourself — HORUS has no way to do that for you.</p>
              {!declaredSent && <button className="secondary" onClick={declareSent}>I sent it (record send declaration, charter 17.3)</button>}
              {declaredSent && (
                <>
                  <p className="success">Recorded as sent by you at {declaredSent.occurredAt}. HORUS did not observe the send — this is your own declaration.</p>
                  <h4>Next follow-up (charter §4, DEC-030)</h4>
                  <p className="notice">A date and note you choose — HORUS never schedules or suggests one on its own.</p>
                  {followUpScheduled ? (
                    <p className="success">Follow-up recorded at {followUpScheduled.occurredAt}.</p>
                  ) : (
                    <>
                      <label>Follow-up date
                        <input type="date" value={followUpForm.date} onChange={(event) => setFollowUpForm({ ...followUpForm, date: event.target.value })} />
                      </label>
                      <label>Note
                        <input value={followUpForm.note} onChange={(event) => setFollowUpForm({ ...followUpForm, note: event.target.value })} placeholder="e.g. Call to check interest" />
                      </label>
                      <button className="secondary" onClick={scheduleFollowUp} disabled={!followUpForm.date}>Record follow-up</button>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {handoffResult?.status === 'failed' && <p className="notice">Could not open Gmail compose: {handoffResult.reason}</p>}
          </div>
        </>
      )}

      <p className="notice">This record exists only in this session's memory — closing the app discards it. Only a published demonstration, an opened outreach handoff, a send declaration, and a recorded follow-up persist (as durable events, DEC-080–082) — everything else here is lost when you close the app.</p>
      <button className="secondary" onClick={onClear}>Clear selection</button>
    </div>
  )
}

/**
 * DEC-082. Charter §4's tracker: a read-only projection over the durable
 * event log — every `demonstration.published`, `outreach.gmail_handoff_opened`,
 * `outreach.declared_sent`, and `follow_up.scheduled` event any `ProspectRecord`
 * in this session (or a past one — these events are durable) has ever
 * recorded, grouped by prospect via `buildTrackerView`. Fetched on demand
 * rather than kept live, matching how `AnalystPanel` and `RealDiscoverySearch`
 * are both collapsed-by-default sections the operator opens explicitly.
 */
function RealTrackerPanel() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<readonly ReturnType<typeof buildTrackerView>[number][] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    window.horus?.tracker.listEvents()
      .then((events) => setEntries(buildTrackerView(events as TrackerEvent[])))
      .finally(() => setLoading(false))
  }

  if (!open) {
    return <section className="discovery-panel collapsed"><button className="secondary" onClick={() => { setOpen(true); load() }}>Open tracker (recorded prospects)</button></section>
  }

  return (
    <section className="discovery-panel" aria-label="Prospect tracker">
      <p className="eyebrow">TRACKER · READ-ONLY PROJECTION OF DURABLE EVENTS</p>
      <h2>Tracker</h2>
      <p>Every prospect with a real published demonstration, an opened outreach handoff, a declared send, or a scheduled follow-up — reconstructed from the append-only event log, never itself the source of truth.</p>
      <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      {entries && entries.length === 0 && <p className="notice">No prospect has been published, contacted, or scheduled yet.</p>}
      {entries && entries.length > 0 && (
        <ul className="tracker-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.businessName ?? entry.id}</strong>
              {entry.demoUrl && <> · <a href={entry.demoUrl} target="_blank" rel="noopener noreferrer">{entry.demoUrl}</a></>}
              {entry.publishedAt && <> · published {entry.publishedAt}</>}
              {entry.outreachOpenedAt && <> · outreach opened {entry.outreachOpenedAt}</>}
              {entry.declaredSentAt && <> · sent (operator-declared) {entry.declaredSentAt}</>}
              {entry.followUp ? <> · next follow-up {entry.followUp.date}{entry.followUp.note ? ` (${entry.followUp.note})` : ''}</> : <> · no follow-up scheduled</>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type EvidenceSummary = { id: string; source: string; retrievedAt: string }
type AnalystRunResult = NonNullable<Window['horus']>['agent']['runAnalyst'] extends (...args: never[]) => Promise<infer R> ? R : never

/**
 * DEC-065. The analyst boundary's first UI surface. This panel only reads
 * retained evidence and displays what the analyst reports back — it saves
 * nothing, approves nothing, and makes no workflow-state transition. The
 * operator judges what, if anything, to do with the result; per DEC-045 no
 * agent output here is treated as authoritative.
 */
type DraftSummary = { id: string; taskId: string; createdAt: string; output: unknown }

function AnalystPanel() {
  const [open, setOpen] = useState(false)
  const [evidence, setEvidence] = useState<EvidenceSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AnalystRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftSummary[]>([])

  const refreshDrafts = () => { void window.horus?.agent.listDrafts().then(setDrafts) }

  useEffect(() => {
    if (!open) return
    void window.horus?.agent.listEvidence().then(setEvidence)
    refreshDrafts()
  }, [open])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const run = () => {
    const chosen = evidence.filter((item) => selected.has(item.id))
      .map((item) => ({ snapshotId: item.id, source: item.source, retrievedAt: item.retrievedAt }))
    setRunning(true)
    setError(null)
    setResult(null)
    window.horus?.agent.runAnalyst(chosen)
      .then((outcome) => { setResult(outcome as AnalystRunResult); refreshDrafts() })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The analyst task was rejected.'))
      .finally(() => setRunning(false))
  }

  if (!open) {
    return <section className="analyst-panel collapsed"><button className="secondary" onClick={() => setOpen(true)}>Open agent analyst (experimental, read-only, no state change)</button></section>
  }

  return (
    <section className="analyst-panel" aria-label="Agent analyst">
      <p className="eyebrow">EXPERIMENTAL · READ-ONLY · AGENT_ARCHITECTURE step 3–4</p>
      <h2>Opportunity analyst</h2>
      <p>Select retained evidence, then run the analyst. It only summarizes what was retrieved — it computes no score, proposes no contact, and saves nothing. Review its output like any other unverified draft.</p>

      {evidence.length === 0 && <p className="notice">No retained evidence in the local store yet.</p>}
      <ul className="evidence-picker">
        {evidence.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              {item.source} · {item.retrievedAt} · {item.id}
            </label>
          </li>
        ))}
      </ul>

      <button onClick={run} disabled={running || selected.size === 0}>{running ? 'Running…' : 'Run analyst on selected evidence'}</button>

      {error && <div className="error" role="alert"><strong>Rejected before any run.</strong><p>{error}</p></div>}

      {result?.status === 'failed' && <div className="error" role="alert"><strong>Run failed: {result.reason}</strong><p>{result.detail}</p></div>}

      {result?.status === 'awaiting_operator_review' && (
        <div className="analyst-result">
          {result.draftId && <p className="success">Saved as draft {result.draftId} — a record, not an approval or a state change.</p>}
          <h3>Observations ({result.output.observations.length})</h3>
          <ul>{result.output.observations.map((o, i) => <li key={i}><span className={`kind-${o.kind}`}>{o.kind}</span> {o.signal}</li>)}</ul>
          <h3>Proposed for review ({result.output.proposedForReview.length})</h3>
          <ul>{result.output.proposedForReview.map((p, i) => <li key={i}>{p.rationale}</li>)}</ul>
          <h3>Missing information ({result.output.missingInformation.length})</h3>
          <ul>{result.output.missingInformation.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <h3>Saved drafts ({drafts.length})</h3>
      <p className="notice">A history of past analyst runs. Each entry is exactly what that run produced — nothing here has been reviewed, approved, or acted on.</p>
      <ul className="draft-list">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <strong>{draft.taskId}</strong> · {draft.createdAt}
          </li>
        ))}
      </ul>
    </section>
  )
}

type CandidateSummary = Extract<DiscoveryRunResult, { status: 'completed' }>['candidates'][number]
type ReviewHistoryResult = Awaited<ReturnType<NonNullable<Window['horus']>['discovery']['fetchReviewHistory']>>

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
function CandidateScoreAction({ candidate, onScored }: { candidate: CandidateSummary; onScored?: (score: ReputationScore) => void }) {
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

type WebOpportunityMeasurementResult = Awaited<ReturnType<NonNullable<Window['horus']>['discovery']['measureWebOpportunity']>>

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
function CandidateWebOpportunityAction({ candidate, onMeasured }: { candidate: CandidateSummary; onMeasured?: (audit: WebOpportunityAudit) => void }) {
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

function SearchStage({ onStart }: { onStart: () => void }) {
  const [input, setInput] = useState({ category: 'Local service', city: 'Stamford, Connecticut', targetQualified: 1, maxExamined: 3 })
  const [errors, setErrors] = useState<string[]>([])
  const submit = () => { const nextErrors = validateRepresentativeSearch(input); setErrors(nextErrors); if (nextErrors.length === 0) onStart() }
  return <><p>Review the bounded parameters before a local representative run is created.</p><div className="search-form"><label>Category<input value={input.category} onChange={(event) => setInput({ ...input, category: event.target.value })} /></label><label>City<input value={input.city} onChange={(event) => setInput({ ...input, city: event.target.value })} /></label><label>Target qualified<input type="number" min="1" value={input.targetQualified} onChange={(event) => setInput({ ...input, targetQualified: Number(event.target.value) })} /></label><label>Maximum examined<input type="number" min="1" value={input.maxExamined} onChange={(event) => setInput({ ...input, maxExamined: Number(event.target.value) })} /></label></div>{errors.length > 0 && <div className="error" role="alert"><strong>Search not started.</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<button onClick={submit}>Run representative search</button></>
}
function ShortlistStage({ onSelect }: { onSelect: () => void }) {
  const [showEmpty, setShowEmpty] = useState(false)
  return <>{showEmpty ? <div className="empty-state"><h3>No candidate qualifies in this bounded run</h3><p>The stopping limit is preserved. HORUS does not relax qualification standards to fill the target.</p><button className="secondary" onClick={() => setShowEmpty(false)}>Return to representative shortlist</button></div> : <><p className="notice">1 representative record qualifies. Scores remain distinct and incomplete signals are not negative evidence.</p><article className="prospect-card"><h3>{representativeProspect.name}</h3><p>{representativeProspect.location} · {representativeProspect.proximity.band} · {representativeProspect.proximity.distance}</p><div><span>{representativeProspect.reputation.label} · {representativeProspect.reputation.score}</span><span>{representativeProspect.webOpportunity.label} · {representativeProspect.webOpportunity.score}</span></div></article><div className="button-row"><button onClick={onSelect}>Select representative prospect</button><button className="secondary" onClick={() => setShowEmpty(true)}>Show empty shortlist state</button></div></>}</>
}
function ProspectStage({ onPrepare }: { onPrepare: () => void }) { return <><p>Evidence is frozen locally for review. The record has no real contact route and cannot be used for outreach.</p><ul className="evidence-list"><li>Data age: {representativeProspect.evidenceAge}</li><li>Completeness: {representativeProspect.reputation.sourceCompleteness}</li><li>Flag: {representativeProspect.flags[0]}</li></ul><button onClick={onPrepare}>Prepare demonstration</button></> }
function DemonstrationStage({ onReview }: { onReview: () => void }) { return <><p>Draft a safe concept preview: placeholder identity, concept notice, noindex, and disabled form behavior. No business claim is rendered.</p><div className="preview-box"><small>HORUS CONCEPT DEMONSTRATION · NOT AN OFFICIAL WEBSITE</small><h3>Representative Local Service</h3><p>Verified-information placeholders only. No contact form transmits data.</p></div><button onClick={onReview}>Open demonstration review</button></> }
function ReviewDemoStage({ approved, onApprove, onContinue }: { approved: boolean; onApprove: () => void; onContinue: () => void }) { return <><Checklist items={['Concept notice is visible', 'noindex is present', 'All facts are placeholders or sourced', 'Removal path is defined', 'Desktop and 375px review completed']} /><p className="gate">Publication is blocked until this separate approval is recorded.</p>{approved ? <button onClick={onContinue}>Continue to publication preflight</button> : <button onClick={onApprove}>Approve demonstration for local publication</button>}</> }
function PublicationStage({ published, onPublish, onContinue }: { published: boolean; onPublish: () => void; onContinue: () => void }) { return <><p>In validation mode, publication records a local preview only. It does not deploy a public site.</p>{published ? <><p className="success">Local publication record created. No public URL exists.</p><button onClick={onContinue}>Prepare outreach</button></> : <button onClick={onPublish}>Record local publication</button>}</> }
function OutreachStage({ onReview }: { onReview: () => void }) { return <><p>Prepare general copy only. There is no recipient, no claimed observation, and no external handoff in this representative case.</p><div className="message-preview"><strong>Subject: A local HORUS workflow test</strong><p>This is a local representative workflow validation. It is not addressed to a business and will not be sent.</p></div><button onClick={onReview}>Open outreach review</button></> }
function ReviewOutreachStage({ approved, onApprove, onContinue }: { approved: boolean; onApprove: () => void; onContinue: () => void }) { return <><Checklist items={['No recipient is present', 'No business-specific claim is present', 'No public demonstration URL is claimed', 'No Gmail credential is available', 'Manual send remains outside HORUS']} /><p className="gate">Gmail handoff is blocked until this separate approval is recorded.</p>{approved ? <button onClick={onContinue}>Continue to handoff review</button> : <button onClick={onApprove}>Approve no-send handoff</button>}</> }
function HandoffStage({ opened, onOpen, onContinue }: { opened: boolean; onOpen: () => void; onContinue: () => void }) { return <><p>This representative action records the handoff locally. It deliberately does not open Gmail.</p>{opened ? <><p className="success">No-send handoff recorded. Gmail was not opened.</p><button onClick={onContinue}>Open tracker</button></> : <button onClick={onOpen}>Record local no-send handoff</button>}</> }
function TrackerStage({ complete, onDeclare }: { complete: boolean; onDeclare: () => void }) { return <>{complete ? <><p className="success">Representative workflow complete: marked not sent and a next action is scheduled for 2026-08-13.</p><p>The immutable event history is ready for the acceptance-test checkpoint.</p></> : <><p>Delivery status and the next action are required to complete the record.</p><button onClick={onDeclare}>Declare not sent and schedule next action</button></>}</> }
function Checklist({ items }: { items: string[] }) { return <ul className="checklist">{items.map((item) => <li key={item}>✓ {item}</li>)}</ul> }

export default App
