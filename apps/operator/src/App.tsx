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
    void window.horus?.workflow.saveRepresentative(next).then(() => window.horus?.foundation.getStatus()).then((nextStatus) => { if (nextStatus) setStatus(nextStatus) })
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
    </main>
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
