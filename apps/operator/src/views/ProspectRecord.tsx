import { useState } from 'react'
import type { ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { buildDemonstrationSite, type DemonstrationComposition } from '../../shared/demonstration'
import { buildOutreachDraft } from '../domain/outreach'
import { assessOldest } from '../domain/freshness'
import { compareListingEvidence, type EvidenceComparison, type ListingEvidence } from '../domain/evidence-diff'
import type { AnalystEvidenceReference } from './candidate-scoring'
import type { CandidateSummary } from './types'

/**
 * DEC-076. A read-only, consolidated view of one selected shortlist entry's
 * already-computed evidence — nothing new is fetched or scored here, and
 * nothing is persisted (deliberately; a SQLite schema addition for a
 * "selected prospect" record is a separate, bigger decision than this one).
 * Selecting a prospect here does not approve, publish, or contact anyone —
 * charter §4/DEC-004's two blocking gates apply only much later, to a
 * demonstration and to outreach, neither of which exists yet from real data.
 */
/**
 * DEC-102. Which slice of the record to show. The component is mounted once by
 * `OperatorWorkspace` and told which section is on screen, rather than being
 * rendered inside three separate view branches — React would unmount it on
 * every switch and silently discard a demonstration preview or a half-written
 * outreach draft.
 */
export type ProspectSection = 'evidence' | 'demonstration' | 'outreach' | 'hidden'

export function ProspectRecord({
  id,
  section = 'evidence',
  candidates,
  scores,
  audits,
  homeBase,
  evidenceRetrievedAt,
  searchContext,
  onClear,
  now,
  evidenceReferences = [],
}: {
  id: string
  section?: ProspectSection
  candidates: readonly CandidateSummary[]
  scores: Record<string, ReputationScore>
  audits: Record<string, WebOpportunityAudit>
  homeBase: Coordinates | null | undefined
  /** When the listing evidence behind this prospect was retrieved (DEC-089). */
  evidenceRetrievedAt: string | null | undefined
  /** What to re-search when refreshing this business's public data (DEC-095). */
  searchContext?: { category: string; city: string; maxExamined: number }
  onClear: () => void
  /** Injected only by tests; freshness is deliberately clock-dependent. */
  now?: Date
  /** DEC-129. This prospect's own already-retained evidence, assembled the same way (`buildCandidateEvidenceReferences`) the Shortlist's "Analyze candidates" button already uses — what the concept_composer agent is allowed to read. */
  evidenceReferences?: readonly AnalystEvidenceReference[]
}) {
  const index = candidates.findIndex((c, i) => (c.dataId ?? `index-${i}`) === id)
  const candidate = candidates[index]
  const [screenshot, setScreenshot] = useState<
    { status: 'captured'; dataUrl: string; capturedAt: string; url: string } | { status: 'rejected'; reason: string } | { status: 'failed'; reason: string } | null
  >(null)
  const [capturing, setCapturing] = useState(false)
  const [demoPreview, setDemoPreview] = useState<ReturnType<typeof buildDemonstrationSite> | null>(null)
  // DEC-129. `null` = never run; `undefined` composition on generateDemoPreview
  // falls back to the deterministic default, exactly as before this decision.
  const [composerConfirmed, setComposerConfirmed] = useState(false)
  const [composing, setComposing] = useState(false)
  const [composerResult, setComposerResult] = useState<
    | { status: 'awaiting_operator_review'; output: DemonstrationComposition; rationale: string }
    | { status: 'failed'; reason: string; detail: string }
    | null
  >(null)
  // DEC-140. The BUILD -> QA -> FIX loop's own outcome, shown to the operator
  // before they read the preview: how many attempts it took, what each round
  // was rejected for, and whether the page reaching them passed both checks or
  // merely ran out of correction attempts. `null` = the loop never ran.
  const [demoQa, setDemoQa] = useState<
    | { status: 'qa_passed'; attempts: readonly { attempt: number; detectorFindings: readonly string[]; agentIssues: readonly string[]; outcome: string }[] }
    | { status: 'qa_failed'; attempts: readonly { attempt: number; detectorFindings: readonly string[]; agentIssues: readonly string[]; outcome: string }[]; reason: string }
    | null
  >(null)
  const [publishApproved, setPublishApproved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<
    { status: 'published'; url: string | null; projectName: string; publishedAt: string; deployOutput: string } | { status: 'failed'; reason: string; detail: string } | null
  >(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<
    { status: 'compared'; comparison: EvidenceComparison; retrievedAt: string }
    | { status: 'not_found' }
    | { status: 'failed'; detail: string }
    | null
  >(null)
  const [removeConfirmation, setRemoveConfirmation] = useState('')
  const [removing, setRemoving] = useState(false)
  const [removeResult, setRemoveResult] = useState<
    { status: 'removed'; projectName: string; removedAt: string; output: string } | { status: 'failed'; reason: string; detail: string } | null
  >(null)
  const [outreachDraft, setOutreachDraft] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [outreachApproved, setOutreachApproved] = useState(false)

  /**
   * DEC-101. AGENT_ARCHITECTURE section 11: "A material edit invalidates the
   * relevant prior approval." The publish gate already did this — generating
   * a new preview clears its approval — but the outreach gate did not. The
   * checkbox reads "I approve sending this exact message, as written above",
   * and editing the recipient, subject or body after ticking it left that
   * approval standing over text it was never given for.
   */
  const editOutreachDraft = (next: { to: string; subject: string; body: string }) => {
    setOutreachDraft(next)
    setOutreachApproved(false)
  }
  const [openingHandoff, setOpeningHandoff] = useState(false)
  const [handoffResult, setHandoffResult] = useState<{ status: 'opened'; occurredAt: string } | { status: 'failed'; reason: string } | null>(null)
  const [declaredSent, setDeclaredSent] = useState<{ occurredAt: string } | null>(null)
  const [followUpForm, setFollowUpForm] = useState({ date: '', note: '' })
  const [followUpScheduled, setFollowUpScheduled] = useState<{ occurredAt: string } | null>(null)
  // DEC-131. The Orchestrator's first wired step, surfaced manually here
  // rather than run automatically on selection — the operator asked for the
  // pipeline to run without a human step *between* discovery, qualification,
  // website generation and QA (docs/DECISIONS.md DEC-131), not for it to run
  // the moment a prospect is opened. `leadStatus` is `null` until checked or
  // advanced at least once in this session.
  const [leadStatus, setLeadStatus] = useState<{
    status: string
    history: readonly { status: string; occurredAt: string; detail?: string }[]
  } | null>(null)
  const [qualifying, setQualifying] = useState(false)
  const [qualifyResult, setQualifyResult] = useState<{ status: 'failed'; reason: string; detail: string } | { status: 'skipped'; reason: string } | null>(null)
  // DEC-134. The operator's own request: fewer clicks, one yes/no per
  // business. `runFullFlow` below collapses qualification, composing, and
  // demo generation into the single "Sí, seguir" button — everything up to
  // (not including) the DEC-004 publish/outreach gates, which stay their own
  // explicit steps because they are real, irreversible actions (a public
  // site, a real email), not something to fold into a generic continue
  // button. "No, siguiente" is `onClear` under a clearer label.
  const [flowRunning, setFlowRunning] = useState(false)
  const [flowStage, setFlowStage] = useState<'idle' | 'qualifying' | 'composing' | 'done'>('idle')

  if (!candidate) return null
  // Mounted but off-screen: keeps every draft and preview alive while the
  // operator is on a view that does not show this record.
  if (section === 'hidden') return null
  const score = scores[id]
  const audit = audits[id]
  const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null

  // DEC-089, charter 14/15. The oldest evidence behind this prospect governs
  // both DEC-004 gates: the listing retrieval, and the review history the
  // reputation score was built from. Browsing and ranking are unaffected
  // (DEC-021 allows cached data of any age); this only blocks contact.
  // `undefined` means the source does not exist yet — no reputation score has
  // been computed — which is not the same as a source that exists without a
  // timestamp. Only the latter is `unknown` evidence. Dropping the former
  // keeps the blocked-reason truthful; if every source is absent the list is
  // empty and `assessOldest` still blocks, so this is not a loophole.
  const freshness = assessOldest({
    retrievedAt: [evidenceRetrievedAt, score?.retrievedAt].filter((value) => value !== undefined),
    now: now ?? new Date(),
  })

  // DEC-095. Charter 15's other half: the freshness gate blocks, and this is
  // how the operator clears it. Spends a real SerpApi credit, so it is never
  // automatic — and it does not silently replace the old figures, because
  // charter 15's whole point is that a rating which fell while the operator
  // was deciding must be *seen*, not quietly corrected.
  const refreshEvidence = () => {
    if (!searchContext) return
    setRefreshing(true)
    setRefreshResult(null)
    const before: ListingEvidence = {
      name: candidate.name ?? null, rating: candidate.rating ?? null, reviewCount: candidate.reviewCount ?? null,
      address: candidate.address ?? null, phone: candidate.phone ?? null, website: candidate.website ?? null,
    }
    window.horus?.discovery
      .run({ ...searchContext, forceRefresh: true })
      .then((outcome) => {
        if (outcome.status !== 'completed') {
          setRefreshResult({ status: 'failed', detail: 'detail' in outcome ? outcome.detail : 'The refresh was rejected.' })
          return
        }
        const fresh = outcome.candidates.find((entry) => entry.dataId === candidate.dataId)
        if (!fresh) {
          // The business no longer appears in its own category search. That is
          // a finding, not an error, and it is not this screen's job to
          // interpret it (DEC-008).
          setRefreshResult({ status: 'not_found' })
          return
        }
        const after: ListingEvidence = {
          name: fresh.name ?? null, rating: fresh.rating ?? null, reviewCount: fresh.reviewCount ?? null,
          address: fresh.address ?? null, phone: fresh.phone ?? null, website: fresh.website ?? null,
        }
        setRefreshResult({ status: 'compared', comparison: compareListingEvidence(before, after), retrievedAt: outcome.retrievedAt })
      })
      .finally(() => setRefreshing(false))
  }

  const captureScreenshot = () => {
    if (!candidate.website) return
    setCapturing(true)
    window.horus?.discovery.captureScreenshot({ url: candidate.website })
      .then(setScreenshot)
      .finally(() => setCapturing(false))
  }

  // DEC-134. Split out of `generateDemoPreview` so `runFullFlow` below can
  // pass a freshly-composed result straight through: calling `setComposerResult`
  // and then reading `composerResult` in the same synchronous block would see
  // the pre-update value (React state updates are not applied mid-function),
  // which would silently render the deterministic fallback even when the
  // composer had just succeeded.
  const renderDemo = (composition: DemonstrationComposition | undefined) => {
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
          // DEC-106. Verified listing attributes that had been retrieved and
          // discarded before ever reaching the demonstration.
          serviceOptions: candidate.serviceOptions,
          highlights: candidate.highlights,
          operatingHours: candidate.operatingHours,
          priceRange: candidate.priceRange,
          photoUrl: candidate.photoUrl,
        },
        generatedAt: new Date().toISOString(),
        // DEC-129. `undefined` when the composer was never run (or failed) —
        // `buildDemonstrationSite` then falls back to the pre-DEC-129
        // deterministic default, exactly as it always has.
        composition,
      }),
    )
    setPublishApproved(false)
    setPublishResult(null)
  }

  const generateDemoPreview = () => {
    renderDemo(composerResult?.status === 'awaiting_operator_review' ? composerResult.output : undefined)
  }

  // DEC-129. A single, explicit, manual run — same shape as the Shortlist's
  // own "Analyze candidates" button (DEC-128): a spend-acknowledgment
  // checkbox, one bounded task, inert output the operator reviews before it
  // ever reaches a preview. The composition only ever changes what
  // `generateDemoPreview` renders next; it does not touch `demoPreview` or
  // any existing approval until the operator presses "Generate demonstration
  // preview" again.
  const composeWithAgent = () => {
    if (evidenceReferences.length === 0) return
    setComposing(true)
    setComposerResult(null)
    window.horus?.agent.runComposer([...evidenceReferences])
      .then((outcome) => {
        if (!outcome) return
        if (outcome.status === 'failed') {
          setComposerResult({ status: 'failed', reason: outcome.reason, detail: outcome.detail })
          return
        }
        setComposerResult({ status: 'awaiting_operator_review', output: outcome.output, rationale: outcome.output.rationale })
      })
      .finally(() => setComposing(false))
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

  // DEC-090. Charter 15's removal path. Destructive and outward-facing: it
  // deletes the Cloudflare Pages project and every deployment under it, so the
  // public URL stops resolving. Guarded by typing the project name rather than
  // a single click, because a misclick here is not recoverable from the app.
  const removeDemonstration = () => {
    if (publishResult?.status !== 'published') return
    if (removeConfirmation.trim() !== publishResult.projectName) return
    setRemoving(true)
    window.horus?.publish
      .removeDemonstration({ projectName: publishResult.projectName, dataId: candidate.dataId })
      .then(setRemoveResult)
      .finally(() => setRemoving(false))
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

  // DEC-131. Runs the Qualification Agent once for this lead. `advanceQualification`
  // itself checks the lead's current status server-side and is a no-op
  // (`status: 'skipped'`) unless the lead is DISCOVERED, so this is safe to
  // press more than once — it only ever records at most one real transition.
  const runQualification = () => {
    if (!candidate.dataId) return
    setQualifying(true)
    setQualifyResult(null)
    window.horus?.orchestrator.advanceQualification({ dataId: candidate.dataId })
      .then((outcome) => {
        if (!outcome) return
        if (outcome.status === 'failed' || outcome.status === 'skipped') {
          setQualifyResult(outcome)
        }
        if ('leadState' in outcome) setLeadStatus(outcome.leadState)
      })
      .finally(() => setQualifying(false))
  }

  // DEC-137. The operator's own explicit "reintentar" — only offered once
  // `leadStatus.status` is actually `FAILED`, and calls a separate IPC
  // channel (`orchestrator:retry-qualification`) that only accepts a FAILED
  // lead; `runQualification`/`runFullFlow` above still refuse to do anything
  // once a lead has left DISCOVERED, so a stuck lead needs this button.
  const retryQualification = () => {
    if (!candidate.dataId) return
    setQualifying(true)
    setQualifyResult(null)
    window.horus?.orchestrator.retryQualification({ dataId: candidate.dataId })
      .then((outcome) => {
        if (!outcome) return
        if (outcome.status === 'failed' || outcome.status === 'skipped') {
          setQualifyResult(outcome)
        }
        if ('leadState' in outcome) setLeadStatus(outcome.leadState)
      })
      .finally(() => setQualifying(false))
  }

  const checkLeadStatus = () => {
    if (!candidate.dataId) return
    window.horus?.lead.getState({ dataId: candidate.dataId }).then(setLeadStatus)
  }

  // DEC-134. The single "Sí, seguir" flow: qualify (DEC-130/131), then — only
  // if the agent qualified this lead (or it was already QUALIFIED from an
  // earlier run this session) — compose and render a demo preview, with no
  // separate button presses in between. A rejected, failed, or otherwise
  // not-yet-qualified lead stops here rather than generating a demo for a
  // business the pipeline itself decided not to pursue.
  const runFullFlow = async () => {
    if (!candidate.dataId) {
      // No data_id on this candidate (a fixture in tests, or a listing SerpApi
      // returned with none) — nothing to qualify against; still worth a demo.
      generateDemoPreview()
      return
    }
    setFlowRunning(true)
    setQualifyResult(null)
    setFlowStage('qualifying')
    try {
      const outcome = await window.horus?.orchestrator.advanceQualification({ dataId: candidate.dataId })
      if (!outcome) return

      let qualified = outcome.status === 'qualified'
      if ('leadState' in outcome) setLeadStatus(outcome.leadState)

      if (outcome.status === 'failed') {
        setQualifyResult(outcome)
        return
      }
      if (outcome.status === 'rejected') {
        return
      }
      if (outcome.status === 'skipped') {
        // The lead was not DISCOVERED — most likely it was already qualified
        // in an earlier press of this same button this session. Read its
        // actual current status rather than guessing from the skip reason.
        const state = await window.horus?.lead.getState({ dataId: candidate.dataId })
        if (state) setLeadStatus(state)
        qualified = state?.status === 'QUALIFIED'
        if (!qualified) {
          setQualifyResult(outcome)
          return
        }
      }

      // DEC-140. Was a single composer call whose output the renderer fed
      // straight into `buildDemonstrationSite` — one build, no checking. It
      // now runs the Orchestrator's BUILD -> QA -> FIX loop in the main
      // process: the same composer, plus the impeccable anti-pattern detector
      // and the `qa_reviewer` agent, correcting up to three times. What comes
      // back has already passed both checks, so the operator's DEC-004 review
      // starts from a page that no longer has the mechanical defects they were
      // previously the first to see. The gate itself is untouched — `qa_passed`
      // is not an approval, and `renderDemo`'s own `setPublishApproved(false)`
      // still applies to the result.
      setFlowStage('composing')
      const built = await window.horus?.orchestrator.advanceDemonstration({ dataId: candidate.dataId })
      if (built && 'leadState' in built) setLeadStatus(built.leadState)

      if (built?.status === 'qa_passed') {
        setDemoPreview({ html: built.html, missingFields: built.missingFields, generatedAt: new Date().toISOString() })
        setPublishApproved(false)
        setPublishResult(null)
        setDemoQa({ status: 'qa_passed', attempts: built.attempts })
        setFlowStage('done')
        return
      }

      if (built?.status === 'qa_failed') {
        setDemoQa({ status: 'qa_failed', attempts: built.attempts, reason: built.reason })
      }

      // Anything the loop could not complete (a QA failure it could not
      // correct, an agent failure, or a lead the step does not apply to)
      // falls back to the pre-DEC-140 local build, so the operator still gets
      // a preview to look at rather than an empty panel — it is simply one
      // that has not passed QA, and the panel above says so.
      let composition: DemonstrationComposition | undefined
      if (evidenceReferences.length > 0) {
        try {
          const composed = await window.horus?.agent.runComposer([...evidenceReferences])
          if (composed?.status === 'awaiting_operator_review') {
            setComposerResult({ status: 'awaiting_operator_review', output: composed.output, rationale: composed.output.rationale })
            composition = composed.output
          } else if (composed?.status === 'failed') {
            // Best-effort: the composer failing does not block the flow — a
            // demo still gets generated, just with the deterministic default.
            setComposerResult({ status: 'failed', reason: composed.reason, detail: composed.detail })
          }
        } catch {
          // same best-effort posture
        }
      }
      renderDemo(composition)
      setFlowStage('done')
    } finally {
      setFlowRunning(false)
    }
  }

  const scheduleFollowUp = () => {
    if (!followUpForm.date) return
    window.horus?.tracker
      .scheduleFollowUp({ dataId: candidate.dataId, to: outreachDraft?.to ?? null, date: followUpForm.date, note: followUpForm.note })
      .then(setFollowUpScheduled)
  }

  return (
    <div className="prospect-card" aria-label="Selected prospect record">
      <p className="eyebrow">SELECTED PROSPECT · {section === 'demonstration' ? 'DEC-004 GATE ONE' : section === 'outreach' ? 'DEC-004 GATE TWO' : 'EVIDENCE'}</p>
      <h3>{candidate.name ?? 'Unnamed listing'}</h3>

      <p className={freshness.blocksContact ? 'gate' : 'notice'}>
        <strong>Evidence freshness: {freshness.status}.</strong> {freshness.evidence}
      </p>

      {section === 'evidence' && (<>
      <p>{candidate.address ?? 'No address on the listing'} · {candidate.type ?? 'no category'} · {candidate.website ?? 'no website'} · {candidate.phone ?? 'no phone on the listing'}</p>
      {proximity && <p>{proximity.distanceMiles} mi · {proximity.band} (straight-line, DEC-074)</p>}

      {/* DEC-134. The operator's own request: fewer clicks. One decision per
          business — qualify, compose, and render a demo preview all happen
          behind "Sí, seguir"; the two DEC-004 gates (publish, outreach) stay
          separate, explicit steps on their own views, since those are real,
          irreversible actions this button must never fold into a generic
          "continue". */}
      <div className="gate-zone">
        <h4>¿Seguir con este negocio?</h4>
        <p className="notice">
          "Sí, seguir" califica este negocio con el agente (DEC-130) y arma un preview de demo automáticamente — sin
          botones intermedios. "No, siguiente" lo descarta y vuelve a la lista. Publicar el demo y enviar el mensaje
          siguen siendo pasos separados con tu aprobación explícita — nada de eso ocurre acá.
        </p>
        <div className="button-row">
          <button onClick={runFullFlow} disabled={flowRunning}>
            {flowRunning
              ? flowStage === 'qualifying' ? 'Calificando…' : flowStage === 'composing' ? 'Redactando…' : 'Procesando…'
              : 'Sí, seguir'}
          </button>
          <button className="secondary" onClick={onClear} disabled={flowRunning}>No, siguiente</button>
        </div>
        {leadStatus && (
          <p className="notice">
            <strong>Estado: {leadStatus.status}.</strong>{' '}
            {leadStatus.history.length > 0 ? leadStatus.history[leadStatus.history.length - 1]?.detail : 'Sin transiciones registradas aún.'}
          </p>
        )}
        {qualifyResult?.status === 'failed' && (
          <div className="error" role="alert"><strong>Calificación falló: {qualifyResult.reason}</strong><p>{qualifyResult.detail}</p></div>
        )}
        {qualifyResult?.status === 'skipped' && <p className="control-hint">{qualifyResult.reason}</p>}
        {leadStatus?.status === 'REJECTED' && (
          <p className="gate">El agente no calificó este negocio — no se generó demo. Podés revisar por qué en el detalle de abajo, o pasar al siguiente.</p>
        )}
        {/* DEC-137. FAILED is a dead end for `runFullFlow`/`runQualification`
            on purpose — an infra failure should not retry itself. This is the
            operator's own explicit way back in, calling a separate IPC
            channel that only accepts a FAILED lead. */}
        {leadStatus?.status === 'FAILED' && (
          <div className="button-row">
            <button className="secondary" onClick={retryQualification} disabled={qualifying}>
              {qualifying ? 'Reintentando…' : 'Reintentar calificación'}
            </button>
          </div>
        )}
      </div>

      {/* DEC-134. Everything below is unchanged from before this decision —
          refreshing evidence, capturing a screenshot, checking raw scores,
          and re-running qualification by hand are all still here for the
          cases the automatic flow above doesn't cover. It stays plainly
          visible rather than behind a collapsed `<details>`: this is where
          the actual evidence lives, and the operator's own request was one
          button to decide, not that the underlying record become harder to
          read. */}
      {searchContext && (
        <div className="button-row">
          <button className="secondary" onClick={refreshEvidence} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : "Refresh this business's public data (spends a SerpApi credit)"}
          </button>
        </div>
      )}
      {refreshResult?.status === 'failed' && (
        <div className="error" role="alert"><strong>Refresh failed.</strong><p>{refreshResult.detail}</p></div>
      )}
      {refreshResult?.status === 'not_found' && (
        <p className="gate">
          This business no longer appears in a fresh search of its own category and city. That may mean the listing
          was removed, renamed, or reclassified — it is not something HORUS can interpret for you, and it is worth
          resolving before any contact.
        </p>
      )}
      {refreshResult?.status === 'compared' && (
        <div className={refreshResult.comparison.hasMaterialChange ? 'gate' : 'success'}>
          <strong>
            Refreshed {refreshResult.retrievedAt}.{' '}
            {refreshResult.comparison.unchanged
              ? 'Nothing changed.'
              : `${refreshResult.comparison.changes.length} change(s)${refreshResult.comparison.hasMaterialChange ? ', some worth reading before contact' : ''}.`}
          </strong>
          {!refreshResult.comparison.unchanged && (
            <ul className="checklist">
              {refreshResult.comparison.changes.map((change) => (
                <li key={change.field}>{change.materialForContact ? '! ' : '· '}{change.note}</li>
              ))}
            </ul>
          )}
          <p className="notice">
            The scores above were computed from the earlier retrieval and have not been recalculated. Rescore this
            candidate to apply the refreshed evidence.
          </p>
        </div>
      )}

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

      {/* DEC-130/DEC-131. Agent-decided qualification — the one narrow DEC-045
          exception this codebase makes, and only for a lead moving through
          this automated pipeline; the reputation/web-opportunity scores above
          remain fully deterministic and unaffected by this. Manual re-run,
          for when the operator wants to qualify again without also
          regenerating the demo (`runFullFlow` above does both together). */}
      <div className="button-row">
        <button className="secondary" onClick={checkLeadStatus}>Check status</button>
        <button className="secondary" onClick={runQualification} disabled={qualifying || !candidate.dataId}>
          {qualifying ? 'Qualifying…' : 'Run qualification only'}
        </button>
      </div>

      </>)}

      {section === 'demonstration' && (<>
      <h4>Demonstration preview</h4>
      <p className="notice">Builds a single-page HTML preview from only the verified fields already shown above (DEC-005) — never published, never sent anywhere, not the DEC-004 approval gate. Missing fields render as a labelled placeholder, not a guess.</p>

      {/* DEC-129. Optional, explicit, and read before the preview is ever
          built — running this does not by itself change what is on screen;
          "Generate demonstration preview" below has to be pressed again
          (or re-pressed) to pick up its output. */}
      <div className="gate-zone">
        <h4>Compose with agent (experimental)</h4>
        <details className="explainer">
          <summary>What this does</summary>
          <p className="notice">
            Runs the concept composer (a bounded, read-only Claude Code task, same boundary as the opportunity analyst
            — AGENT_ARCHITECTURE.md) once over this prospect's own already-retrieved evidence. It decides which of
            "about," "reviews," "services," and "hours" to show and in what order, drafts a short about paragraph,
            and picks real review sentences to quote verbatim — citing the evidence behind every quote. It never
            writes HTML or CSS, invents a fact, or publishes anything; the deterministic preview below still renders
            every line, and a section it asks for still only appears if the underlying data actually exists.
          </p>
        </details>
        <label className="confirm-spend">
          <input type="checkbox" checked={composerConfirmed} onChange={(event) => setComposerConfirmed(event.target.checked)} />
          {' '}I understand this runs a local Claude Code task using this Claude subscription's own usage limit — not a SerpApi or PageSpeed credit.
        </label>
        <button
          className="secondary"
          onClick={composeWithAgent}
          disabled={!composerConfirmed || composing || evidenceReferences.length === 0}
        >
          {composing ? 'Composing…' : 'Compose with agent'}
        </button>
        {!composerConfirmed && <p className="control-hint">Blocked: acknowledge the usage cost above before this can be used.</p>}
        {evidenceReferences.length === 0 && <p className="control-hint">No retained evidence for this prospect yet — nothing for the composer to read.</p>}
        {composerResult?.status === 'failed' && (
          <div className="error" role="alert"><strong>Compose failed: {composerResult.reason}</strong><p>{composerResult.detail}</p></div>
        )}
        {composerResult?.status === 'awaiting_operator_review' && (
          <div className="notice">
            <p><strong>Composed — review below, then press "Generate demonstration preview" to render it.</strong></p>
            <p>Sections: {composerResult.output.sectionOrder.join(', ') || '(none)'} · Tone: {composerResult.output.tone}</p>
            <p className="control-hint">Why: {composerResult.rationale}</p>
          </div>
        )}
      </div>

      <button className="secondary" onClick={generateDemoPreview}>Generate demonstration preview (not published, DEC-079)</button>
      {/* DEC-140. What the automated QA loop found, stated before the preview
          rather than after it — the operator should know whether the page
          below passed its checks before they start reading it. */}
      {demoQa && (
        <div className={demoQa.status === 'qa_passed' ? 'notice' : 'error'} role={demoQa.status === 'qa_failed' ? 'alert' : undefined}>
          <strong>
            {demoQa.status === 'qa_passed'
              ? `Passed the anti-pattern detector and QA review on attempt ${demoQa.attempts.length} of ${demoQa.attempts.length}.`
              : 'Did not pass automated QA.'}
          </strong>
          {demoQa.status === 'qa_failed' && <p>{demoQa.reason}</p>}
          <ul>
            {demoQa.attempts.map((attempt) => (
              <li key={attempt.attempt}>
                Attempt {attempt.attempt}: {attempt.outcome.replaceAll('_', ' ')}
                {[...attempt.detectorFindings, ...attempt.agentIssues].length > 0 && ` — ${[...attempt.detectorFindings, ...attempt.agentIssues].join(' ')}`}
              </li>
            ))}
          </ul>
          <p className="control-hint">
            Automated QA is a pre-filter, not an approval. Publishing is still your own decision at the gate below (DEC-004).
          </p>
        </div>
      )}
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
          {freshness.blocksContact && (
            <p className="gate" role="alert">
              <strong>Publication blocked — evidence is not fresh.</strong> {freshness.evidence}
            </p>
          )}
          <button onClick={publish} disabled={!publishApproved || publishing || freshness.blocksContact}>
            {publishing ? 'Publishing…' : 'Publish now (real deploy)'}
          </button>
          {/* DEC-083 rule 2: a dimmed control reads as absent rather than blocked,
              so the reason it is disabled is stated in words, not left to styling. */}
          {freshness.blocksContact
            ? <p className="control-hint">Blocked: refresh this business's public data before publishing (charter 14, {freshness.maxAgeDays}-day limit).</p>
            : !publishApproved && <p className="control-hint">Blocked: record the approval above before this can be used.</p>}
          {publishResult?.status === 'published' && (
            <p className="success">
              Published to project {publishResult.projectName} at {publishResult.publishedAt}.
              {publishResult.url ? <> Live at <a href={publishResult.url} target="_blank" rel="noopener noreferrer">{publishResult.url}</a>.</> : ' Wrangler did not print a recognizable URL — check the deploy output or your Cloudflare dashboard.'}
            </p>
          )}
          {publishResult?.status === 'failed' && (
            <div className="error" role="alert"><strong>Publish failed: {publishResult.reason}</strong><p>{publishResult.detail}</p></div>
          )}

          {publishResult?.status === 'published' && !removeResult && (
            <div className="gate-zone">
              <h4>Remove this demonstration — charter 15 removal path</h4>
              <p className="notice">
                Deletes the Cloudflare Pages project <strong>{publishResult.projectName}</strong> and every deployment
                under it. The public URL stops resolving. This cannot be undone from HORUS — republishing means deploying
                again. Use this when {candidate.name ?? 'the business'} asks for it, or when a concept has served its
                purpose (DEC-031's 60-day review).
              </p>
              <label>Type the project name to confirm
                <input
                  value={removeConfirmation}
                  onChange={(event) => setRemoveConfirmation(event.target.value)}
                  placeholder={publishResult.projectName}
                />
              </label>
              <button onClick={removeDemonstration} disabled={removing || removeConfirmation.trim() !== publishResult.projectName}>
                {removing ? 'Removing…' : 'Remove the published demonstration'}
              </button>
              {removeConfirmation.trim() !== publishResult.projectName && (
                <p className="control-hint">Blocked: type <strong>{publishResult.projectName}</strong> exactly to enable this.</p>
              )}
            </div>
          )}
          {removeResult?.status === 'removed' && (
            <p className="success">Removed project {removeResult.projectName} at {removeResult.removedAt}. The public URL no longer resolves.</p>
          )}
          {removeResult?.status === 'failed' && (
            <div className="error" role="alert"><strong>Removal failed: {removeResult.reason}</strong><p>{removeResult.detail}</p></div>
          )}
          </div>
        </>
      )}

      </>)}

      {section === 'outreach' && !outreachDraft && (
        <p className="notice">
          Nothing to send yet. An outreach draft is created only once a demonstration has actually been published
          (DEC-081), which happens on the Demo review view.
        </p>
      )}
      {section === 'outreach' && outreachDraft && (
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
              onChange={(event) => editOutreachDraft({ ...outreachDraft, to: event.target.value })}
              placeholder="owner@example.com"
            />
          </label>
          <label>Subject
            <input value={outreachDraft.subject} onChange={(event) => editOutreachDraft({ ...outreachDraft, subject: event.target.value })} />
          </label>
          <label>Body
            <textarea
              value={outreachDraft.body}
              onChange={(event) => editOutreachDraft({ ...outreachDraft, body: event.target.value })}
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
          {freshness.blocksContact && (
            <p className="gate" role="alert">
              <strong>Outreach blocked — evidence is not fresh.</strong> {freshness.evidence}
            </p>
          )}
          <button onClick={openGmailHandoff} disabled={!outreachApproved || openingHandoff || !outreachDraft.to || freshness.blocksContact}>
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
