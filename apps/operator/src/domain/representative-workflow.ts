export type WorkflowStep =
  | 'search'
  | 'shortlist'
  | 'prospect'
  | 'demonstration'
  | 'demo_review'
  | 'publication'
  | 'outreach'
  | 'outreach_review'
  | 'gmail_handoff'
  | 'tracker'

export type VerticalWorkflowState = {
  step: WorkflowStep
  demoApproved: boolean
  demoPublished: boolean
  outreachApproved: boolean
  gmailHandoffOpened: boolean
  deliveryDeclared: boolean
  nextAction?: { date: string; description: string }
  events: Array<{ type: string; occurredAt: string; detail: string }>
}

export const representativeProspect = {
  id: 'prospect-representative-001',
  name: 'Representative Local Service',
  location: 'Stamford, Connecticut',
  reputation: { score: 82, label: 'Qualifies', sourceCompleteness: 'partial_data' },
  webOpportunity: { score: 71, label: 'Measured opportunity', sourceCompleteness: 'unmeasured performance signal' },
  proximity: { band: 'Band 1', distance: '4.2 mi' },
  evidenceAge: '2 days',
  flags: ['Confirm the preferred public contact route before outreach.'],
  sourceNote: 'Representative local-only fixture; it is not a real business and contains no contact route.',
} as const

export type RepresentativeSearchInput = {
  category: string
  city: string
  targetQualified: number
  maxExamined: number
}

export function validateRepresentativeSearch(input: RepresentativeSearchInput) {
  const errors: string[] = []
  if (!input.category.trim()) errors.push('Enter a business category before starting the search.')
  if (!input.city.trim()) errors.push('Enter a city before starting the search.')
  if (!Number.isInteger(input.targetQualified) || input.targetQualified < 1) errors.push('Target qualified must be at least 1.')
  if (!Number.isInteger(input.maxExamined) || input.maxExamined < 1 || input.maxExamined < input.targetQualified) errors.push('Maximum examined must be at least the target qualified count.')
  return errors
}

function event(type: string, detail: string, occurredAt = new Date().toISOString()) {
  return { type, detail, occurredAt }
}

const allowedStageTransitions: Record<WorkflowStep, readonly WorkflowStep[]> = {
  search: ['shortlist'],
  shortlist: ['prospect'],
  prospect: ['demonstration'],
  demonstration: ['demo_review'],
  demo_review: ['publication'],
  publication: ['outreach'],
  outreach: ['outreach_review'],
  outreach_review: ['gmail_handoff'],
  gmail_handoff: ['tracker'],
  tracker: [],
}

export function createRepresentativeWorkflow(): VerticalWorkflowState {
  return {
    step: 'search',
    demoApproved: false,
    demoPublished: false,
    outreachApproved: false,
    gmailHandoffOpened: false,
    deliveryDeclared: false,
    events: [event('representative_case_created', 'Local representative case created; no external search was run.')],
  }
}

export function moveWorkflow(state: VerticalWorkflowState, step: WorkflowStep, detail: string): VerticalWorkflowState {
  if (!allowedStageTransitions[state.step].includes(step)) {
    throw new Error(`Workflow stage transition is blocked: ${state.step} → ${step}`)
  }
  if (step === 'publication' && !state.demoApproved) throw new Error('Publication review cannot continue until demonstration approval is recorded')
  if (step === 'outreach' && !state.demoPublished) throw new Error('Outreach cannot begin until the local publication record exists')
  if (step === 'gmail_handoff' && !state.outreachApproved) throw new Error('Gmail handoff review cannot continue until outreach approval is recorded')
  if (step === 'tracker' && !state.gmailHandoffOpened) throw new Error('Tracker cannot open until a local Gmail handoff is recorded')
  return { ...state, step, events: [...state.events, event('workflow_step_changed', detail)] }
}

export function approveDemonstration(state: VerticalWorkflowState): VerticalWorkflowState {
  if (state.step !== 'demo_review') throw new Error('Demonstration approval requires the demonstration review step')
  return { ...state, demoApproved: true, events: [...state.events, event('demonstration_approved', 'Publication approval recorded after local review checklist.')] }
}

export function publishLocalDemonstration(state: VerticalWorkflowState): VerticalWorkflowState {
  if (!state.demoApproved) throw new Error('Demonstration publication is blocked until explicit approval is recorded')
  if (state.step !== 'publication') throw new Error('Demonstration publication requires the publication step')
  return { ...state, demoPublished: true, events: [...state.events, event('demonstration_published_locally', 'Representative preview recorded locally; no public deployment occurred.')] }
}

export function approveOutreach(state: VerticalWorkflowState): VerticalWorkflowState {
  if (!state.demoPublished) throw new Error('Outreach approval is blocked until a demonstration is published')
  if (state.step !== 'outreach_review') throw new Error('Outreach approval requires the outreach review step')
  return { ...state, outreachApproved: true, events: [...state.events, event('outreach_approved', 'No-send outreach handoff approval recorded.')] }
}

export function openLocalGmailHandoff(state: VerticalWorkflowState): VerticalWorkflowState {
  if (!state.outreachApproved) throw new Error('Gmail handoff is blocked until explicit outreach approval is recorded')
  if (state.step !== 'gmail_handoff') throw new Error('Gmail handoff requires the Gmail handoff step')
  return { ...state, gmailHandoffOpened: true, events: [...state.events, event('gmail_handoff_simulated', 'Local representative handoff recorded; Gmail was not opened.')] }
}

export function declareDeliveryAndNextAction(state: VerticalWorkflowState, nextAction: { date: string; description: string }): VerticalWorkflowState {
  if (!state.gmailHandoffOpened) throw new Error('Delivery declaration requires a recorded Gmail handoff')
  if (!nextAction.date || !nextAction.description) throw new Error('A next action date and description are required')
  return {
    ...state,
    deliveryDeclared: true,
    nextAction,
    events: [...state.events, event('delivery_declared_not_sent', `Representative case marked not sent; next action: ${nextAction.description}.`)],
  }
}

export function completeRepresentativeAcceptanceRun() {
  let state = createRepresentativeWorkflow()
  state = moveWorkflow(state, 'shortlist', 'Representative local search completed with a bounded fixture.')
  state = moveWorkflow(state, 'prospect', 'Representative prospect selected from local shortlist.')
  state = moveWorkflow(state, 'demonstration', 'Local evidence snapshot frozen for demonstration preparation.')
  state = moveWorkflow(state, 'demo_review', 'Local demonstration inventory prepared for review.')
  state = approveDemonstration(state)
  state = moveWorkflow(state, 'publication', 'Approved local demonstration moved to publication preflight.')
  state = publishLocalDemonstration(state)
  state = moveWorkflow(state, 'outreach', 'Local publication record accepted; outreach preparation opened.')
  state = moveWorkflow(state, 'outreach_review', 'Representative no-send outreach prepared for review.')
  state = approveOutreach(state)
  state = moveWorkflow(state, 'gmail_handoff', 'Approved representative outreach moved to handoff review.')
  state = openLocalGmailHandoff(state)
  state = moveWorkflow(state, 'tracker', 'Local no-send handoff recorded; tracker opened.')
  return declareDeliveryAndNextAction(state, { date: '2026-08-13', description: 'Review the representative local case.' })
}
