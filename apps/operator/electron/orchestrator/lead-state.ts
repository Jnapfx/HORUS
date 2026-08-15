/**
 * DEC-131. The persisted Lead state machine `docs/ORCHESTRATOR_GAP_ANALYSIS.md`
 * §2 called for — the piece everything else in the Orchestrator depends on.
 * Pure and deterministic, matching every other domain module in this
 * codebase: given a lead's own event history (already filtered to one
 * `dataId` by the caller — same shape `buildTrackerView`/`buildShortlist`
 * already take), replay it into a current status. Never a second mutable
 * copy that could drift from the event log (charter 14's own principle,
 * "evidence over scores, replay over storage").
 *
 * Status vocabulary is `agentic_orchestration.md`'s own, unchanged — the
 * document the operator asked HORUS to move toward.
 *
 * Lives under `electron/`, not `src/domain/`, even though it is a pure
 * function with no Electron dependency: `tsconfig.electron.json` and
 * `tsconfig.app.json` each build only their own directory (`rootDir`), so a
 * module imported by both would need to live in neither — the same
 * constraint `web-opportunity-ipc.ts`'s `MOBILE_AUDIT_IDS` comment (DEC-109)
 * already documents for this codebase. The Orchestrator, which lives in
 * `electron/`, is this module's only real consumer; the renderer never needs
 * the state machine itself, only the plain status string an IPC call already
 * returns.
 */

export type LeadStatus =
  | 'DISCOVERED'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'REJECTED'
  | 'WEBSITE_GENERATING'
  | 'WEBSITE_GENERATED'
  | 'QA_IN_PROGRESS'
  | 'QA_FAILED'
  | 'QA_PASSED'
  | 'OUTREACH_READY'
  | 'APPROVED'
  | 'SENT'
  | 'FAILED'

export type LeadStatusEvent = {
  status: LeadStatus
  occurredAt: string
  /** Free-text context — a rejection reason, a QA issue summary, a failure detail. Never authoritative on its own; `status` is. */
  detail?: string
}

export type LeadState = {
  dataId: string
  status: LeadStatus
  /** Oldest first — the same reading order `RealTrackerPanel` already uses for its own per-prospect timeline. */
  history: readonly LeadStatusEvent[]
}

/**
 * The document's own pipeline, plus a `FAILED` terminal state and a
 * `QA_FAILED → WEBSITE_GENERATING` retry edge (document §7, "Correction
 * Loop") the diagram doesn't draw explicitly but the prose requires. Every
 * other transition not listed here is invalid — `appendLeadStatus` (the
 * Orchestrator-side writer, `electron/orchestrator/lead-store.ts`) refuses to
 * write one, so a bug in the Orchestrator's own sequencing cannot silently
 * corrupt a lead's recorded history.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  DISCOVERED: ['QUALIFYING'],
  QUALIFYING: ['QUALIFIED', 'REJECTED', 'FAILED'],
  QUALIFIED: ['WEBSITE_GENERATING'],
  REJECTED: [],
  WEBSITE_GENERATING: ['WEBSITE_GENERATED', 'FAILED'],
  WEBSITE_GENERATED: ['QA_IN_PROGRESS'],
  QA_IN_PROGRESS: ['QA_PASSED', 'QA_FAILED'],
  QA_FAILED: ['WEBSITE_GENERATING', 'FAILED'],
  QA_PASSED: ['OUTREACH_READY'],
  OUTREACH_READY: ['APPROVED'],
  APPROVED: ['SENT'],
  SENT: [],
  FAILED: [],
}

export const LEAD_STATUSES: readonly LeadStatus[] = Object.keys(ALLOWED_TRANSITIONS) as LeadStatus[]

/** Terminal states — the Orchestrator stops dispatching once a lead reaches one of these. `REJECTED` and `FAILED` are terminal for automation but not for the operator, who can always work a lead by hand outside the pipeline regardless of its recorded status here. */
export const TERMINAL_STATUSES: ReadonlySet<LeadStatus> = new Set(['REJECTED', 'SENT', 'FAILED'])

export function isValidLeadTransition(from: LeadStatus, to: LeadStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * A lead with no recorded events is `DISCOVERED` by default — the document's
 * own entry state, and true of every candidate a discovery search already
 * returned before the Orchestrator ever looks at it. This is why `DISCOVERED`
 * itself is never written as an event: it is the correct answer to "what has
 * happened to this lead" when nothing has, yet.
 */
export function buildLeadState(dataId: string, events: readonly LeadStatusEvent[]): LeadState {
  const history = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const status = history.length > 0 ? history[history.length - 1]!.status : 'DISCOVERED'
  return { dataId, status, history }
}

/** True once a lead has left the automated pipeline — either it will never proceed further on its own (`REJECTED`, `FAILED`), or it already has (`SENT`). */
export function isLeadTerminal(status: LeadStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}
