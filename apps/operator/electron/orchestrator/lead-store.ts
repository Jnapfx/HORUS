/**
 * DEC-131. The Orchestrator's own thin read/write layer over
 * `HorusStore.appendEvent`/`listEvents` (`persistence.ts`), scoped to the
 * `'lead'` aggregate type — no schema change needed (`persistence.ts`'s event
 * store was already generic). Every write goes through
 * `appendValidatedLeadStatus`, which refuses a transition
 * `lead-state.ts#isValidLeadTransition` does not allow, so a bug in the
 * Orchestrator's own sequencing cannot silently corrupt a lead's recorded
 * history — the same fail-closed posture `assertTaskIsBounded` gives agent
 * tasks, applied here to state transitions.
 */

import type { HorusStore } from '../persistence.js'
import { buildLeadState, isValidLeadTransition, type LeadState, type LeadStatus } from './lead-state.js'

export class LeadTransitionRejected extends Error {
  constructor(from: LeadStatus, to: LeadStatus) {
    super(`Lead transition ${from} -> ${to} is not allowed`)
    this.name = 'LeadTransitionRejected'
  }
}

/** Reads a lead's full event history and replays it into its current status. Read-only, costs nothing beyond the query. */
export function readLeadState(store: HorusStore, dataId: string): LeadState {
  const events = store
    .listEvents(['lead'])
    .filter((event) => event.aggregateId === dataId && event.eventType === 'lead.status_changed')
    .map((event) => event.payload as { status: LeadStatus; occurredAt: string; detail?: string })
  return buildLeadState(dataId, events)
}

/**
 * Appends one status transition, after checking it against the lead's
 * current state — read fresh, not passed in, so two concurrent callers
 * cannot both validate against a status that is about to be stale.
 */
export function appendValidatedLeadStatus(
  store: HorusStore,
  dataId: string,
  to: LeadStatus,
  input: { occurredAt: string; detail?: string },
): LeadState {
  const current = readLeadState(store, dataId)
  if (!isValidLeadTransition(current.status, to)) {
    throw new LeadTransitionRejected(current.status, to)
  }
  store.appendEvent({
    aggregateType: 'lead',
    aggregateId: dataId,
    eventType: 'lead.status_changed',
    payload: { status: to, occurredAt: input.occurredAt, detail: input.detail },
    occurredAt: input.occurredAt,
  })
  return readLeadState(store, dataId)
}

/**
 * DEC-137. A narrow, operator-initiated exception to FAILED's terminal
 * status — not a change to it. `lead-state.ts#isValidLeadTransition`
 * deliberately keeps `FAILED: []` (`tests/lead-state.test.ts`'s "refuses any
 * transition out of a terminal state" checks this for every status), because
 * nothing in the automated pipeline should ever retry a failed lead on its
 * own. A timeout or other infra failure is not a business judgment, though,
 * and the operator asked directly for a way to try again after one: "agregar
 * un reintento manual." This function is that one narrow door, checked here
 * rather than by loosening the general transition table every other caller
 * (`appendValidatedLeadStatus`) still relies on to keep `FAILED` closed to
 * everything else. It writes exactly one transition, FAILED -> QUALIFYING,
 * and only from FAILED — any other starting status is rejected the same way
 * `appendValidatedLeadStatus` rejects a disallowed one.
 */
export function appendOperatorRetryFromFailed(
  store: HorusStore,
  dataId: string,
  input: { occurredAt: string; detail?: string },
): LeadState {
  const current = readLeadState(store, dataId)
  if (current.status !== 'FAILED') {
    throw new LeadTransitionRejected(current.status, 'QUALIFYING')
  }
  store.appendEvent({
    aggregateType: 'lead',
    aggregateId: dataId,
    eventType: 'lead.status_changed',
    payload: { status: 'QUALIFYING', occurredAt: input.occurredAt, detail: input.detail },
    occurredAt: input.occurredAt,
  })
  return readLeadState(store, dataId)
}
