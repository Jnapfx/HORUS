import { useState } from 'react'
import type { ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { buildDemonstrationSite } from '../domain/demonstration'
import { buildOutreachDraft } from '../domain/outreach'
import { assessOldest } from '../domain/freshness'
import { compareListingEvidence, type EvidenceComparison, type ListingEvidence } from '../domain/evidence-diff'
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
export function ProspectRecord({
  id,
  candidates,
  scores,
  audits,
  homeBase,
  evidenceRetrievedAt,
  searchContext,
  onClear,
  now,
}: {
  id: string
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

  if (!candidate) return null
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

      {/* DEC-089. Shown here, before either gate, so the operator learns the
          evidence is stale while there is still something to do about it —
          not at the moment they try to publish. */}
      <p className={freshness.blocksContact ? 'gate' : 'notice'}>
        <strong>Evidence freshness: {freshness.status}.</strong> {freshness.evidence}
      </p>

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
