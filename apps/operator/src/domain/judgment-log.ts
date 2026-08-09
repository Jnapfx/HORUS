/**
 * Charter 14 and FUNCTIONAL_DESIGN section 5: the operator's rationale belongs
 * in the record.
 *
 * DEC-091 gave the operator somewhere to answer charter 9.5's three judgment
 * gates, and explicitly recorded what it was leaving undone — the answers lived
 * in component state and were lost when the application closed. A judgment is
 * the one input to a reputation score that cannot be recomputed from retained
 * evidence: rerunning the model reproduces every factor and every objective
 * gate, but nothing can reconstruct what the operator concluded from reading
 * the reviews. Losing it means the qualification decision is not reproducible,
 * which is the one property charter 9.7 and DEC-020 exist to guarantee.
 *
 * This is a projection over the same append-only event log DEC-082's tracker
 * reads, and it follows that decision's rule exactly: derived views are
 * recomputed from immutable events, never maintained as a second stored copy
 * that can drift (charter 14).
 *
 * A later judgment supersedes an earlier one for the same listing. The earlier
 * event is not deleted or amended — it stays in the log, so a change of mind
 * about a business remains visible rather than being quietly overwritten. That
 * mirrors the rule the decision log itself follows.
 */

import type { OperatorJudgmentDraft } from './operator-judgment'

export const JUDGMENT_AGGREGATE_TYPE = 'prospect'
export const JUDGMENT_EVENT_TYPE = 'prospect.judgment_recorded'

export type JudgmentEvent = {
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: unknown
  occurredAt: string
}

export type RecordedJudgment = {
  listingId: string
  judgment: OperatorJudgmentDraft
  recordedAt: string
  /** How many times this listing has been judged, including this one. */
  revision: number
}

function isDraft(value: unknown): value is OperatorJudgmentDraft {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (['complaintPattern', 'operationalStatus', 'listingIdentity'] as const).every((field) => {
    const entry = record[field]
    if (typeof entry !== 'object' || entry === null) return false
    const gate = entry as Record<string, unknown>
    return typeof gate.verdict === 'string' && typeof gate.rationale === 'string'
  })
}

/**
 * Latest judgment per listing, keyed by listing id. Events that are not
 * judgments, or whose payload is not a readable judgment, are skipped rather
 * than guessed at — a malformed record must not become a verdict.
 */
export function buildJudgmentLog(events: readonly JudgmentEvent[]): Map<string, RecordedJudgment> {
  const byListing = new Map<string, RecordedJudgment>()
  for (const event of events) {
    if (event.aggregateType !== JUDGMENT_AGGREGATE_TYPE) continue
    if (event.eventType !== JUDGMENT_EVENT_TYPE) continue
    if (!isDraft(event.payload)) continue

    const existing = byListing.get(event.aggregateId)
    // `listEvents` returns oldest-first, but ordering is enforced here rather
    // than assumed: a later `occurredAt` always wins.
    if (existing && existing.recordedAt > event.occurredAt) {
      byListing.set(event.aggregateId, { ...existing, revision: existing.revision + 1 })
      continue
    }
    byListing.set(event.aggregateId, {
      listingId: event.aggregateId,
      judgment: event.payload,
      recordedAt: event.occurredAt,
      revision: (existing?.revision ?? 0) + 1,
    })
  }
  return byListing
}

/** Convenience for a single listing. `null` when it has never been judged. */
export function findRecordedJudgment(
  events: readonly JudgmentEvent[],
  listingId: string,
): RecordedJudgment | null {
  return buildJudgmentLog(events).get(listingId) ?? null
}
