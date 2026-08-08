/**
 * Charter section 14/15 and DEC-021: the 30-day freshness rule at the two
 * DEC-004 contact gates.
 *
 *   "Before a demonstration is published | Data must be ≤ 30 days old, or refreshed first."
 *   "Before an outreach message is sent  | Data must be ≤ 30 days old, or refreshed first."
 *
 * Until DEC-089 this rule existed only in the charter and in comments. The
 * application published and drafted outreach without checking it at all, which
 * meant a demonstration could be built and made public from evidence of any
 * age — a rating that had since dropped, or a complaint that had since
 * appeared, being exactly what the charter says the operator needs to know
 * *before* making contact rather than after.
 *
 * **This module deliberately uses the current clock, and it is the only place
 * in the domain that does.** Everywhere else — `reputation-scoring.ts`,
 * `review-history.ts` — time is computed against the stored retrieval
 * timestamp so a run stays reproducible (charter 9.7). Freshness is the
 * opposite kind of question: not "what did this evidence show when it was
 * retrieved" but "is this evidence still recent enough to put in front of a
 * business owner today". That answer must change as time passes. `now` is an
 * explicit parameter rather than an implicit `new Date()` so the behaviour
 * stays testable and the dependency stays visible.
 *
 * Browsing and ranking are unaffected: DEC-021 allows cached data of any age
 * for evaluation. This gate applies only where HORUS is about to reach a real
 * business.
 */

/** Charter section 14. Not a tunable — changing it is a charter change. */
export const MAX_EVIDENCE_AGE_DAYS = 30

export type FreshnessStatus = 'fresh' | 'stale' | 'unknown'

export type FreshnessAssessment = {
  status: FreshnessStatus
  /** Whole days, rounded down. `null` when the retrieval time is unusable. */
  ageDays: number | null
  retrievedAt: string | null
  assessedAt: string
  maxAgeDays: number
  /**
   * True when this evidence may not be used to publish or to contact.
   * `unknown` blocks: an unreadable retrieval time is not permission to
   * proceed (charter 9.6's principle applied to time — missing information is
   * never a pass).
   */
  blocksContact: boolean
  evidence: string
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function assessFreshness(input: { retrievedAt: string | null | undefined; now: Date }): FreshnessAssessment {
  const assessedAt = input.now.toISOString()
  const base = { assessedAt, maxAgeDays: MAX_EVIDENCE_AGE_DAYS }

  if (!input.retrievedAt) {
    return {
      ...base,
      status: 'unknown',
      ageDays: null,
      retrievedAt: null,
      blocksContact: true,
      evidence: 'No retrieval timestamp is recorded for this evidence, so its age cannot be established.',
    }
  }

  const parsed = Date.parse(input.retrievedAt)
  if (Number.isNaN(parsed)) {
    return {
      ...base,
      status: 'unknown',
      ageDays: null,
      retrievedAt: input.retrievedAt,
      blocksContact: true,
      evidence: `"${input.retrievedAt}" is not a readable timestamp, so the evidence's age cannot be established.`,
    }
  }

  // A retrieval timestamp in the future is not fresh — it is wrong, and
  // treating it as fresh would let a clock error open a contact gate.
  const elapsedMs = input.now.getTime() - parsed
  if (elapsedMs < 0) {
    return {
      ...base,
      status: 'unknown',
      ageDays: null,
      retrievedAt: input.retrievedAt,
      blocksContact: true,
      evidence: `The retrieval timestamp ${input.retrievedAt} is in the future relative to ${assessedAt}.`,
    }
  }

  const ageDays = Math.floor(elapsedMs / MS_PER_DAY)
  const stale = ageDays > MAX_EVIDENCE_AGE_DAYS
  return {
    ...base,
    status: stale ? 'stale' : 'fresh',
    ageDays,
    retrievedAt: input.retrievedAt,
    blocksContact: stale,
    evidence: stale
      ? `Retrieved ${input.retrievedAt}, ${ageDays} days ago — older than the ${MAX_EVIDENCE_AGE_DAYS}-day limit for contact (charter 14, DEC-021). Refresh before publishing or contacting.`
      : `Retrieved ${input.retrievedAt}, ${ageDays} days ago — within the ${MAX_EVIDENCE_AGE_DAYS}-day limit for contact.`,
  }
}

/**
 * The oldest piece of evidence governs. A demonstration built from a fresh
 * listing and a stale review history is not fresh: the gate asks whether
 * everything shown to a business owner is current, so the weakest input sets
 * the answer.
 */
export function assessOldest(input: {
  retrievedAt: readonly (string | null | undefined)[]
  now: Date
}): FreshnessAssessment {
  if (input.retrievedAt.length === 0) {
    return assessFreshness({ retrievedAt: null, now: input.now })
  }
  const assessments = input.retrievedAt.map((retrievedAt) => assessFreshness({ retrievedAt, now: input.now }))
  // `unknown` outranks `stale` outranks `fresh` — any blocking input blocks.
  return (
    assessments.find((assessment) => assessment.status === 'unknown') ??
    assessments.find((assessment) => assessment.status === 'stale') ??
    assessments.reduce((oldest, current) => ((current.ageDays ?? 0) > (oldest.ageDays ?? 0) ? current : oldest))
  )
}
