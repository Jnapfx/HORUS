/**
 * DEC-082. Charter §4's last unbuilt step: "record the prospect and next
 * follow-up." Every earlier piece of this session's real pipeline exists in
 * memory only (DEC-076) or produced a single durable event as a side effect
 * (`demonstration.published` from DEC-080, `outreach.gmail_handoff_opened`
 * and `outreach.declared_sent` from DEC-081) — nothing until now read those
 * events back and turned them into something an operator could look at as a
 * pipeline. This module does that: a pure projection over the event log
 * `persistence.ts`'s `listEvents` already exposes, same "storage separates
 * the immutable from the derived" principle (charter §14) every scoring
 * module in this session already follows — the events are the record; this
 * view is recomputed from them, never itself the source of truth.
 *
 * DEC-030: a follow-up (in person or otherwise) is an operator action HORUS
 * records, never one it schedules, prepares, or performs. `follow_up.scheduled`
 * is exactly that — a date and a note the operator supplied, nothing HORUS
 * inferred or picked on its own.
 */

export type TrackerEvent = {
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: unknown
  occurredAt: string
}

export type TrackerEntry = {
  id: string
  businessName: string | null
  demoUrl: string | null
  publishedAt: string | null
  outreachTo: string | null
  outreachOpenedAt: string | null
  declaredSentAt: string | null
  followUp: { date: string; note: string; scheduledAt: string } | null
  /**
   * DEC-096. When the business itself responded, recorded by the operator.
   * HORUS cannot observe a response any more than it can observe a send
   * (DEC-041, charter 17.3), so this is always an operator declaration.
   */
  respondedAt: string | null
  /** DEC-096. Set when a demonstration has been removed (DEC-090). */
  removedAt: string | null
}

export const DEMONSTRATION_REVIEW_DAYS = 60

export type DemonstrationReview = {
  entry: TrackerEntry
  daysLive: number
  /**
   * DEC-031: at 60 days from publication without a response, the operator is
   * asked whether to remove the demonstration. Never removed automatically.
   */
  state: 'live' | 'expired_awaiting_decision' | 'engaged' | 'removed'
  prompt: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

const RECOGNIZED_EVENT_TYPES = new Set([
  'demonstration.published',
  'demonstration.removed',
  'outreach.gmail_handoff_opened',
  'outreach.declared_sent',
  'outreach.response_recorded',
  'follow_up.scheduled',
])

/**
 * Groups every `demonstration`/`outreach`/`follow_up` event by its
 * `aggregateId` (the candidate's `dataId`, or the business name when no
 * `dataId` was available at publish time — see DEC-080). Events are expected
 * oldest-first, matching `listEvents`' own ordering, so a later event of the
 * same kind for the same prospect naturally overwrites an earlier one — a
 * prospect can be re-published or re-scheduled, and the tracker always shows
 * the most recent state, never a stale one.
 */
export function buildTrackerView(events: readonly TrackerEvent[]): readonly TrackerEntry[] {
  const byId = new Map<string, TrackerEntry>()

  const entryFor = (id: string): TrackerEntry => {
    const existing = byId.get(id)
    if (existing) return existing
    const created: TrackerEntry = {
      respondedAt: null,
      removedAt: null, id, businessName: null, demoUrl: null, publishedAt: null, outreachTo: null, outreachOpenedAt: null, declaredSentAt: null, followUp: null }
    byId.set(id, created)
    return created
  }

  for (const event of events) {
    if (!['demonstration', 'outreach', 'follow_up'].includes(event.aggregateType)) continue
    if (!RECOGNIZED_EVENT_TYPES.has(event.eventType)) continue
    const entry = entryFor(event.aggregateId)
    const payload = asRecord(event.payload)

    if (event.eventType === 'demonstration.published') {
      entry.businessName = stringOrNull(payload.businessName) ?? entry.businessName
      entry.demoUrl = stringOrNull(payload.url) ?? entry.demoUrl
      entry.publishedAt = event.occurredAt
    } else if (event.eventType === 'outreach.gmail_handoff_opened') {
      entry.outreachTo = stringOrNull(payload.to) ?? entry.outreachTo
      entry.outreachOpenedAt = event.occurredAt
    } else if (event.eventType === 'outreach.declared_sent') {
      entry.declaredSentAt = event.occurredAt
    } else if (event.eventType === 'demonstration.removed') {
      entry.removedAt = event.occurredAt
    } else if (event.eventType === 'outreach.response_recorded') {
      entry.respondedAt = event.occurredAt
    } else if (event.eventType === 'follow_up.scheduled') {
      const date = stringOrNull(payload.date)
      if (date) entry.followUp = { date, note: stringOrNull(payload.note) ?? '', scheduledAt: event.occurredAt }
    }
  }

  return [...byId.values()].sort((a, b) => (a.followUp?.date ?? '9999-99-99').localeCompare(b.followUp?.date ?? '9999-99-99'))
}

/**
 * DEC-096. Charter §15 and DEC-031's 60-day review, computed rather than
 * scheduled: at 60 days from publication without a recorded response, the
 * operator is asked whether to remove the demonstration.
 *
 * Three of DEC-031's clauses shape this, and each is a constraint rather than
 * a detail:
 *
 *   - **Nothing is taken down automatically.** This returns a question, never
 *     an action. DEC-090 supplies the removal mechanism; only the operator
 *     invokes it.
 *   - **The prompt repeats rather than firing once.** It is derived from the
 *     publication date on every read, so it cannot be dismissed into silence
 *     by a notification that was missed — an ignored prompt stays visible,
 *     which DEC-031 names as its own mitigation for the risk it accepts.
 *   - **A prospect that has engaged is not subject to it.** A recorded
 *     response takes the demonstration out of scope entirely.
 *
 * `now` is a parameter, like `assessFreshness`'s: this asks a question about
 * elapsed wall-clock time, so unlike scoring it must not be reproducible
 * against a stored timestamp.
 */
export function reviewDemonstrations(entries: readonly TrackerEntry[], now: Date): readonly DemonstrationReview[] {
  return entries
    .filter((entry) => entry.publishedAt !== null)
    .map((entry) => {
      const published = Date.parse(entry.publishedAt!)
      const daysLive = Number.isNaN(published)
        ? 0
        : Math.floor((now.getTime() - published) / 86_400_000)

      if (entry.removedAt) {
        return { entry, daysLive, state: 'removed' as const, prompt: null }
      }
      if (entry.respondedAt) {
        // DEC-031: "Where a prospect has engaged, the demonstration is not
        // subject to this prompt."
        return { entry, daysLive, state: 'engaged' as const, prompt: null }
      }
      if (daysLive >= DEMONSTRATION_REVIEW_DAYS) {
        return {
          entry,
          daysLive,
          state: 'expired_awaiting_decision' as const,
          prompt:
            `${entry.businessName ?? entry.id}'s demonstration has been public for ${daysLive} days with no recorded ` +
            `response. Its data is that old too. Decide whether to remove it — HORUS will not take it down on its own.`,
        }
      }
      return { entry, daysLive, state: 'live' as const, prompt: null }
    })
}
