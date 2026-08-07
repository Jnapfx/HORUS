/**
 * Main-process validation for workflow state arriving from the renderer.
 *
 * DEC-048. `workflow:representative:save` previously accepted `state: unknown`
 * and wrote it straight to SQLite and the append-only event log. The renderer
 * sits on the untrusted side of the `contextIsolation` boundary, so every
 * approval flag in the store was, in effect, renderer-asserted.
 *
 * AGENT_ARCHITECTURE section 5 requires workflow state transitions, approval
 * validation and delivery declaration to be enforced by deterministic code, and
 * states that renderer state is never proof of approval. This module is that
 * enforcement for the save channel.
 *
 * Scope limit, recorded deliberately: this validates a *submitted state* against
 * the state the main process already holds. It makes an approval impossible to
 * fabricate out of order, to revoke, or to reach by skipping a stage. It does
 * not make the renderer incapable of lying about a single legitimate-looking
 * step. Closing that requires the renderer to send commands rather than state,
 * so that the main process computes every transition itself. That refactor is
 * recorded as the follow-up in CURRENT_STATE.md and is not attempted here.
 */

export const WORKFLOW_STEPS = [
  'search',
  'shortlist',
  'prospect',
  'demonstration',
  'demo_review',
  'publication',
  'outreach',
  'outreach_review',
  'gmail_handoff',
  'tracker',
] as const

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number]

export type WorkflowEvent = {
  type: string
  occurredAt: string
  detail: string
}

export type MainProcessWorkflowState = {
  step: WorkflowStep
  demoApproved: boolean
  demoPublished: boolean
  outreachApproved: boolean
  gmailHandoffOpened: boolean
  deliveryDeclared: boolean
  nextAction?: { date: string; description: string }
  events: WorkflowEvent[]
}

export class WorkflowStateRejected extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(`Workflow state rejected: ${reason}`)
    this.name = 'WorkflowStateRejected'
    this.reason = reason
  }
}

/** Approval flags in the order they may become true. Each requires the previous. */
const APPROVAL_CHAIN = [
  'demoApproved',
  'demoPublished',
  'outreachApproved',
  'gmailHandoffOpened',
  'deliveryDeclared',
] as const satisfies readonly (keyof MainProcessWorkflowState)[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key]
  if (typeof value !== 'boolean') throw new WorkflowStateRejected(`${key} must be a boolean`)
  return value
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new WorkflowStateRejected(`${label} must be a non-empty string`)
  return value
}

function readEvents(value: unknown): WorkflowEvent[] {
  if (!Array.isArray(value)) throw new WorkflowStateRejected('events must be an array')
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new WorkflowStateRejected(`events[${index}] must be an object`)
    const occurredAt = readNonEmptyString(entry.occurredAt, `events[${index}].occurredAt`)
    if (Number.isNaN(Date.parse(occurredAt))) throw new WorkflowStateRejected(`events[${index}].occurredAt must be a valid timestamp`)
    return {
      type: readNonEmptyString(entry.type, `events[${index}].type`),
      detail: readNonEmptyString(entry.detail, `events[${index}].detail`),
      occurredAt,
    }
  })
}

function readNextAction(value: unknown): MainProcessWorkflowState['nextAction'] {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) throw new WorkflowStateRejected('nextAction must be an object')
  return {
    date: readNonEmptyString(value.date, 'nextAction.date'),
    description: readNonEmptyString(value.description, 'nextAction.description'),
  }
}

/**
 * Structural validation. Throws `WorkflowStateRejected` rather than returning a
 * partial value, so a malformed state can never reach the store.
 */
export function parseWorkflowState(value: unknown): MainProcessWorkflowState {
  if (!isRecord(value)) throw new WorkflowStateRejected('state must be an object')

  const step = value.step
  if (typeof step !== 'string' || !(WORKFLOW_STEPS as readonly string[]).includes(step)) {
    throw new WorkflowStateRejected(`step must be one of: ${WORKFLOW_STEPS.join(', ')}`)
  }

  const state: MainProcessWorkflowState = {
    step: step as WorkflowStep,
    demoApproved: readBoolean(value, 'demoApproved'),
    demoPublished: readBoolean(value, 'demoPublished'),
    outreachApproved: readBoolean(value, 'outreachApproved'),
    gmailHandoffOpened: readBoolean(value, 'gmailHandoffOpened'),
    deliveryDeclared: readBoolean(value, 'deliveryDeclared'),
    nextAction: readNextAction(value.nextAction),
    events: readEvents(value.events),
  }

  // An approval may only exist if everything it depends on already does.
  APPROVAL_CHAIN.forEach((flag, index) => {
    if (index === 0 || !state[flag]) return
    const prerequisite = APPROVAL_CHAIN[index - 1]!
    if (!state[prerequisite]) throw new WorkflowStateRejected(`${flag} requires ${prerequisite}`)
  })

  if (state.deliveryDeclared && !state.nextAction) {
    throw new WorkflowStateRejected('deliveryDeclared requires a recorded next action')
  }

  return state
}

/**
 * Compares a submitted state with the state the main process already holds.
 * This is the part the renderer cannot talk its way around: approvals are
 * append-only, stages advance one at a time, and recorded history may only grow.
 */
export function assertAcceptableTransition(
  previous: MainProcessWorkflowState | null,
  next: MainProcessWorkflowState,
): void {
  if (!previous) {
    // First save for this workflow. There is nothing to compare against, so the
    // structural invariants in parseWorkflowState are the whole guarantee.
    return
  }

  APPROVAL_CHAIN.forEach((flag) => {
    if (previous[flag] && !next[flag]) {
      throw new WorkflowStateRejected(`${flag} cannot be revoked through a state save`)
    }
  })

  const previousIndex = WORKFLOW_STEPS.indexOf(previous.step)
  const nextIndex = WORKFLOW_STEPS.indexOf(next.step)
  if (nextIndex < previousIndex) {
    throw new WorkflowStateRejected(`step cannot move backwards from ${previous.step} to ${next.step}`)
  }
  if (nextIndex > previousIndex + 1) {
    throw new WorkflowStateRejected(`step cannot skip from ${previous.step} to ${next.step}`)
  }

  if (next.events.length < previous.events.length) {
    throw new WorkflowStateRejected('recorded events cannot be removed')
  }
  previous.events.forEach((event, index) => {
    const candidate = next.events[index]
    if (!candidate || candidate.type !== event.type || candidate.occurredAt !== event.occurredAt || candidate.detail !== event.detail) {
      throw new WorkflowStateRejected(`recorded event at position ${index} cannot be rewritten`)
    }
  })
}

/** Convenience wrapper: the only entry point the IPC handler needs. */
export function acceptWorkflowState(previous: unknown, submitted: unknown): MainProcessWorkflowState {
  const next = parseWorkflowState(submitted)
  assertAcceptableTransition(previous === null || previous === undefined ? null : parseWorkflowState(previous), next)
  return next
}
