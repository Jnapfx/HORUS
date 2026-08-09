import { useEffect, useMemo, useState } from 'react'
import {
  approveDemonstration,
  approveOutreach,
  createRepresentativeWorkflow,
  declareDeliveryAndNextAction,
  moveWorkflow,
  openLocalGmailHandoff,
  publishLocalDemonstration,
  type VerticalWorkflowState,
  type WorkflowStep,
} from '../domain/representative-workflow'
import {
  DemonstrationStage,
  HandoffStage,
  OutreachStage,
  ProspectStage,
  PublicationStage,
  ReviewDemoStage,
  ReviewOutreachStage,
  SearchStage,
  ShortlistStage,
  TrackerStage,
} from './RepresentativeStages'
import type { FoundationStatus } from './types'

/**
 * DEC-102. Phase 4's representative workflow, kept as a reference view rather
 * than deleted. Its own banner has always said search, deployment, Gmail and
 * sending "are not executed here" — it is a fixture-driven walkthrough, and
 * with the six real views now existing it is no longer the way anyone works.
 * It is retained because it exercises workflow-state persistence and DEC-048's
 * main-process validation, which nothing else does.
 */

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

export function RepresentativeWorkflow() {
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


    </main>
  )
}
