import { useState } from 'react'
import type { ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { buildDemonstrationSite } from '../domain/demonstration'
import { buildOutreachDraft } from '../domain/outreach'
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
