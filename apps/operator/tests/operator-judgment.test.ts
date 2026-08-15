import { describe, expect, it } from 'vitest'
import {
  emptyJudgment,
  findJudgmentProblems,
  isJudgmentComplete,
  JUDGMENT_GATES,
  resolveJudgment,
  type OperatorJudgmentDraft,
} from '../src/domain/operator-judgment'
import { buildReputationScore } from '../src/domain/reputation-scoring'
import { buildShortlist } from '../src/domain/shortlist'

/**
 * DEC-091. The three charter 9.5 gates that only the operator can answer, and
 * which previously had no way to be answered at all.
 */

const answered = (): OperatorJudgmentDraft => ({
  complaintPattern: { verdict: 'none_found', rationale: 'Read the 20 most recent reviews; no unresolved complaints.' },
  operationalStatus: { verdict: 'active', rationale: 'Recent reviews describe current visits; hours are posted.' },
  listingIdentity: { verdict: 'confirmed', rationale: 'Listing name, address and reviews all match the same business.' },
})

describe('DEC-091 — the default never opens a gate', () => {
  it('starts every gate unassessed', () => {
    const draft = emptyJudgment()
    for (const gate of JUDGMENT_GATES) {
      expect(draft[gate.field].verdict, gate.id).toBe('insufficient_data')
      expect(draft[gate.field].rationale, gate.id).toBe('')
    }
  })

  it('does not consider an untouched draft complete', () => {
    expect(isJudgmentComplete(emptyJudgment())).toBe(false)
  })

  it('resolves an untouched draft to three insufficient_data assessments, not passes', () => {
    const resolved = resolveJudgment(emptyJudgment())
    expect(resolved.complaintPattern.status).toBe('insufficient_data')
    expect(resolved.operationalStatus.status).toBe('insufficient_data')
    expect(resolved.listingIdentity.status).toBe('insufficient_data')
  })
})

/**
 * DEC-124 superseded this block's original premise (DEC-091's rule 2: "a
 * verdict without a reason is not a judgment"). The operator asked directly
 * for the written-rationale requirement to be removed ("quitale lo de
 * escribir algo obligado. que no sea obligatorio."); DEC-124's own
 * consequences section claimed no test asserted the old throw-on-missing-
 * rationale behavior, which was wrong — this block did, and kept failing
 * against the new code until corrected here. DEC-091's rule 1, that an
 * unanswered gate never counts as a pass, is untouched and stays covered by
 * the describe block above.
 */
describe('DEC-124 — a verdict without a written rationale is still a recorded judgment', () => {
  it.each(['complaintPattern', 'operationalStatus', 'listingIdentity'] as const)(
    'accepts %s answered with a blank rationale, with no problems reported',
    (field) => {
      const draft = { ...answered(), [field]: { ...answered()[field], rationale: '   ' } }
      expect(findJudgmentProblems(draft)).toHaveLength(0)
      expect(() => resolveJudgment(draft)).not.toThrow()
    },
  )

  it('records an honest "no rationale" label rather than inventing one or blocking the verdict', () => {
    // DEC-005's "never invent" discipline, applied to a field it does not
    // govern but the same principle reaches: a blank rationale is recorded as
    // exactly that, never a fabricated-sounding explanation.
    const draft = { ...answered(), complaintPattern: { verdict: 'none_found' as const, rationale: '' } }
    const resolved = resolveJudgment(draft)
    expect(resolved.complaintPattern.evidence).toBe('Answered by the operator; no rationale was recorded.')
  })

  it('needs no rationale to leave a gate unassessed', () => {
    // "Not assessed" is honest and requires no defence.
    expect(findJudgmentProblems(emptyJudgment())).toHaveLength(0)
  })

  it('carries the operator rationale through as the gate evidence when one is given', () => {
    const resolved = resolveJudgment(answered())
    expect(resolved.complaintPattern.evidence).toContain('20 most recent reviews')
    expect(resolved.operationalStatus.evidence).toContain('hours are posted')
    expect(resolved.listingIdentity.evidence).toContain('same business')
  })
})

describe('DEC-091 — the gate this actually unblocks', () => {
  const scoreWith = (draft: OperatorJudgmentDraft) => {
    const assessed = resolveJudgment(draft)
    return buildReputationScore({
      listingId: 'test',
      retrievedAt: '2026-08-08T00:00:00.000Z',
      rating: { status: 'measured', value: 4.8 },
      reviewCount: { status: 'measured', value: 420 },
      recentActivity: {
        reviewsLast90Days: { status: 'measured', value: { count: 30, exhaustive: true } },
        reviewsLast365Days: { status: 'measured', value: { count: 120, exhaustive: true } },
        daysSinceLatestReview: { status: 'measured', value: 3 },
      },
      recentConsistency: { status: 'measured', value: { trailingYearMeanRating: 4.8, trailingYearReviewCount: 120 } },
      longevity: { status: 'measured', value: { historySpanYears: 6 } },
      complaintPattern: assessed.complaintPattern,
      operationalStatus: assessed.operationalStatus,
      listingIdentity: assessed.listingIdentity,
      market: { status: 'within_target', evidence: 'In the searched city.' },
    })
  }

  it('leaves a strong candidate unqualified while the gates are unanswered', () => {
    // The bug DEC-091 fixes, reproduced: this was every candidate, always.
    const score = scoreWith(emptyJudgment())
    expect(score.scoreLowerBound).toBeGreaterThan(score.qualificationThreshold)
    expect(score.qualified).toBe(false)
  })

  it('qualifies the same candidate once the operator answers all three', () => {
    const score = scoreWith(answered())
    expect(score.qualified).toBe(true)
    for (const gate of ['G4', 'G5', 'G6']) {
      expect(score.gates.find((g) => g.id.startsWith(gate))?.status, gate).toBe('passed')
    }
  })

  it('still refuses to qualify when the operator answers against the business', () => {
    // The gates are not a formality to be clicked through.
    const closed = { ...answered(), operationalStatus: { verdict: 'closed_or_permanently_closed' as const, rationale: 'Listing marked permanently closed.' } }
    expect(scoreWith(closed).qualified).toBe(false)

    const mismatch = { ...answered(), listingIdentity: { verdict: 'mismatch' as const, rationale: 'Reviews describe a different business.' } }
    expect(scoreWith(mismatch).qualified).toBe(false)
  })

  it('turns an empty shortlist into a ranked one — the end-to-end dead end', () => {
    // Before: ranked 0, excluded not_reputation_qualified, no "Select as
    // prospect" button, nothing downstream reachable from real data.
    const before = buildShortlist([{
      id: 'c', qualified: scoreWith(emptyJudgment()).qualified,
      reputationScoreLowerBound: 88, webOpportunityScoreLowerBound: 61, proximityBand: 'band_1' as never,
    }])
    expect(before.ranked).toHaveLength(0)
    expect(before.excluded[0].reason).toBe('not_reputation_qualified')

    const after = buildShortlist([{
      id: 'c', qualified: scoreWith(answered()).qualified,
      reputationScoreLowerBound: 88, webOpportunityScoreLowerBound: 61, proximityBand: 'band_1' as never,
    }])
    expect(after.ranked).toHaveLength(1)
    expect(after.ranked[0].rank).toBe(1)
  })
})
