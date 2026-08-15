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
 * One rule shapes this module, from DEC-008 and charter 9.5 rather than from
 * convenience: **the default is never a pass.** An unanswered gate stays
 * `insufficient_data`. Qualification has to be actively established, never
 * reached by leaving a form alone.
 *
 * DEC-091 also required a written rationale before a verdict other than
 * `insufficient_data` would be accepted — every assessment the charter
 * defines already carries an `evidence: string`, and FUNCTIONAL_DESIGN
 * section 5 asks for the operator's rationale to be captured. DEC-124 removed
 * that requirement at the operator's own direct request: the rationale is
 * still captured when written, but a verdict is now a real, recordable
 * judgment on its own — the charter asks whether the operator decided, not
 * whether they wrote a paragraph defending it.
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
 * DEC-124. A rationale used to be required for any verdict other than
 * `insufficient_data`, and blocked both recording and, before that, even
 * seeing a score. The operator asked directly for that friction to be
 * removed: "quitale lo de escribir algo obligado. que no sea obligatorio."
 * `findJudgmentProblems` now always reports no problems — kept as a named
 * export, rather than deleted, so `isJudgmentComplete` and the record button
 * still have one real place to check, if a future rule ever needs one. What
 * DEC-091's rule 1 established is unchanged: an unanswered gate (still
 * `insufficient_data`) never counts as a pass, and the three verdicts
 * themselves are still required to open the gate — only the free-text
 * explanation of a verdict is now optional.
 */
export function findJudgmentProblems(_draft: OperatorJudgmentDraft): readonly JudgmentProblem[] {
  return []
}

export type ResolvedJudgment = {
  complaintPattern: ComplaintPatternAssessment
  operationalStatus: OperationalStatusAssessment
  listingIdentity: ListingIdentityAssessment
}

const UNASSESSED_EVIDENCE = 'Not assessed by the operator.'
// DEC-124. The rationale field's own placeholder text, used verbatim as the
// recorded evidence when a verdict was answered but no rationale was typed —
// an honest label for what actually happened, not a fabricated explanation.
const NO_RATIONALE_EVIDENCE = 'Answered by the operator; no rationale was recorded.'

/**
 * Turns the draft into the three assessments `buildReputationScore` expects.
 * DEC-124: no longer throws on a missing rationale — a verdict without one is
 * still a real judgment (charter 9.5 asks whether the operator decided, not
 * whether they wrote a paragraph about it), recorded with a plain label
 * saying no rationale was given, rather than blocked or a guessed reason
 * fabricated in its place.
 */
export function resolveJudgment(draft: OperatorJudgmentDraft): ResolvedJudgment {
  const resolve = <T extends string>(entry: { verdict: T; rationale: string }) => ({
    status: entry.verdict,
    evidence: entry.rationale.trim()
      ? entry.rationale.trim()
      : entry.verdict === 'insufficient_data'
        ? UNASSESSED_EVIDENCE
        : NO_RATIONALE_EVIDENCE,
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
