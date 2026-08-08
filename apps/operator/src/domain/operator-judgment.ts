/**
 * Charter 9.5's three judgment-dependent gates — G4 complaint pattern, G5
 * operational status, G6 listing identity — as something the operator can
 * actually record.
 *
 * Until DEC-091 they were hardcoded to `insufficient_data` in the only code
 * path that scores a candidate, with the note "Not yet reviewed by the
 * operator" and **no interface anywhere for the operator to review them**.
 * Because `qualified` requires every gate to have passed, no candidate could
 * ever be qualified; because `buildShortlist` excludes anything not qualified,
 * the shortlist was always empty; and because "Select as prospect" is rendered
 * only for ranked entries, the prospect record, demonstration, publication,
 * outreach and tracker were all unreachable from real data. The project's
 * headline promise — one search, one qualified prospect — was structurally
 * impossible to reach.
 *
 * Two rules shape this module, and both come from DEC-008 and charter 9.5
 * rather than from convenience:
 *
 * 1. **The default is never a pass.** An unanswered gate stays
 *    `insufficient_data`. Qualification has to be actively established, never
 *    reached by leaving a form alone.
 * 2. **A verdict without a reason is not a judgment.** Every assessment the
 *    charter defines already carries an `evidence: string`, and a status
 *    chosen with that field left blank is refused here rather than passed
 *    down. FUNCTIONAL_DESIGN section 5 requires the operator's rationale to be
 *    captured; a gate that could be opened by picking from a dropdown without
 *    saying why is exactly the "silently satisfying an operator gate" failure
 *    that DEC-087's mutation test exists to catch.
 *
 * Nothing here scores, ranks, or decides anything. It records what the
 * operator concluded and hands it to `reputation-scoring.ts`, which owns the
 * gate logic (DEC-045).
 */

import type {
  ComplaintPatternAssessment,
  ListingIdentityAssessment,
  OperationalStatusAssessment,
} from './reputation-scoring'

export type JudgmentGateId = 'G4' | 'G5' | 'G6'

export type ComplaintPatternVerdict = ComplaintPatternAssessment['status']
export type OperationalStatusVerdict = OperationalStatusAssessment['status']
export type ListingIdentityVerdict = ListingIdentityAssessment['status']

/** What the operator has entered so far. Every field starts unanswered. */
export type OperatorJudgmentDraft = {
  complaintPattern: { verdict: ComplaintPatternVerdict; rationale: string }
  operationalStatus: { verdict: OperationalStatusVerdict; rationale: string }
  listingIdentity: { verdict: ListingIdentityVerdict; rationale: string }
}

export function emptyJudgment(): OperatorJudgmentDraft {
  return {
    complaintPattern: { verdict: 'insufficient_data', rationale: '' },
    operationalStatus: { verdict: 'insufficient_data', rationale: '' },
    listingIdentity: { verdict: 'insufficient_data', rationale: '' },
  }
}

/** The prompt each gate puts to the operator. Charter 9.5's wording, shortened. */
export const JUDGMENT_GATES: ReadonlyArray<{
  id: JudgmentGateId
  field: keyof OperatorJudgmentDraft
  question: string
  options: ReadonlyArray<{ value: string; label: string }>
}> = [
  {
    id: 'G4',
    field: 'complaintPattern',
    question: 'Is there a pattern of unresolved complaints in the reviews you read?',
    options: [
      { value: 'insufficient_data', label: 'Not assessed yet' },
      { value: 'none_found', label: 'No pattern found' },
      { value: 'pattern_found', label: 'A pattern is present' },
    ],
  },
  {
    id: 'G5',
    field: 'operationalStatus',
    question: 'Is the business currently operating?',
    options: [
      { value: 'insufficient_data', label: 'Not assessed yet' },
      { value: 'active', label: 'Active' },
      { value: 'closed_or_permanently_closed', label: 'Closed or permanently closed' },
    ],
  },
  {
    id: 'G6',
    field: 'listingIdentity',
    question: 'Do the listing and its reviews belong to this business at this location?',
    options: [
      { value: 'insufficient_data', label: 'Not assessed yet' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'mismatch', label: 'Mismatch' },
    ],
  },
]

export type JudgmentProblem = { gate: JudgmentGateId; problem: string }

/**
 * A gate answered with anything other than `insufficient_data` must carry a
 * rationale. An unanswered gate needs none — "not assessed" is an honest state
 * and requires no defence.
 */
export function findJudgmentProblems(draft: OperatorJudgmentDraft): readonly JudgmentProblem[] {
  const problems: JudgmentProblem[] = []
  for (const gate of JUDGMENT_GATES) {
    const entry = draft[gate.field]
    if (entry.verdict !== 'insufficient_data' && !entry.rationale.trim()) {
      problems.push({
        gate: gate.id,
        problem: `${gate.id} is answered "${entry.verdict}" with no rationale. Record what you saw that supports it.`,
      })
    }
  }
  return problems
}

export type ResolvedJudgment = {
  complaintPattern: ComplaintPatternAssessment
  operationalStatus: OperationalStatusAssessment
  listingIdentity: ListingIdentityAssessment
}

const UNASSESSED_EVIDENCE = 'Not assessed by the operator.'

/**
 * Turns the draft into the three assessments `buildReputationScore` expects.
 * Throws rather than silently downgrading when a verdict lacks its rationale:
 * quietly turning an unsupported "none_found" into `insufficient_data` would
 * hide an operator's half-finished judgment behind a plausible-looking score.
 */
export function resolveJudgment(draft: OperatorJudgmentDraft): ResolvedJudgment {
  const problems = findJudgmentProblems(draft)
  if (problems.length > 0) {
    throw new Error(`Operator judgment is incomplete: ${problems.map((problem) => problem.problem).join(' ')}`)
  }
  const resolve = <T extends string>(entry: { verdict: T; rationale: string }) => ({
    status: entry.verdict,
    evidence: entry.verdict === 'insufficient_data' && !entry.rationale.trim()
      ? UNASSESSED_EVIDENCE
      : entry.rationale.trim(),
  })
  return {
    complaintPattern: resolve(draft.complaintPattern) as ComplaintPatternAssessment,
    operationalStatus: resolve(draft.operationalStatus) as OperationalStatusAssessment,
    listingIdentity: resolve(draft.listingIdentity) as ListingIdentityAssessment,
  }
}

/**
 * Whether every judgment gate has been answered in a way that could let
 * qualification proceed. Reported for the interface's benefit only —
 * `reputation-scoring.ts` remains the sole authority on whether a gate
 * actually passes (DEC-045).
 */
export function isJudgmentComplete(draft: OperatorJudgmentDraft): boolean {
  return (
    findJudgmentProblems(draft).length === 0 &&
    JUDGMENT_GATES.every((gate) => draft[gate.field].verdict !== 'insufficient_data')
  )
}
