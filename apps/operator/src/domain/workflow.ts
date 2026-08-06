export type WorkflowState =
  | 'search_draft'
  | 'search_running'
  | 'shortlist_ready'
  | 'prospect_selected'
  | 'demo_awaiting_approval'
  | 'demo_published'
  | 'outreach_awaiting_approval'
  | 'gmail_handoff_opened'
  | 'sent_declared'

const allowedTransitions: Record<WorkflowState, readonly WorkflowState[]> = {
  search_draft: ['search_running'],
  search_running: ['shortlist_ready'],
  shortlist_ready: ['prospect_selected'],
  prospect_selected: ['demo_awaiting_approval'],
  demo_awaiting_approval: ['demo_published'],
  demo_published: ['outreach_awaiting_approval'],
  outreach_awaiting_approval: ['gmail_handoff_opened'],
  gmail_handoff_opened: ['sent_declared'],
  sent_declared: [],
}

export function canTransition(from: WorkflowState, to: WorkflowState) {
  return allowedTransitions[from].includes(to)
}

export function requireTransition(from: WorkflowState, to: WorkflowState) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid HORUS workflow transition: ${from} → ${to}`)
  }
}
