/**
 * `web-opportunity-v2`'s largest factor, filled in from evidence already paid
 * for.
 *
 * Mobile responsiveness is worth 30 of the model's 100 points — more than any
 * other factor — and DEC-072 left it permanently `unmeasured` with the note
 * "Requires a rendered inspection; not yet wired." It turns out the rendered
 * inspection was already happening: every PageSpeed Insights call HORUS makes
 * for load performance returns a full mobile Lighthouse run, and only
 * `audits.interactive` was ever read from it. This reads three more audits
 * from the same response. **No new request, no new credit, no new
 * measurement infrastructure, and no change to the model** — this supplies a
 * value `web-opportunity-v2` already defines and has always accepted.
 *
 * The mapping, and why each step is where it is:
 *
 *   - `viewport` failing means the page never declares a mobile viewport at
 *     all. That is the definition of `not-responsive`: it is not a defect in
 *     a responsive layout, it is the absence of one.
 *   - `content-width` or `tap-targets` failing, with a viewport present, is
 *     `responsive-defective` — the site tried, and the result does not work
 *     properly on a phone.
 *   - All three passing is `fully-responsive`.
 *
 * Charter 10.4 governs the missing case and is why this returns a reason
 * rather than a guess: **an audit absent from the response is `unmeasured`,
 * never a failure.** Lighthouse's audit set changes between versions, and a
 * renamed or dropped audit must never be read as a site scoring badly. That
 * distinction is worth 30 points, in the direction that makes a business look
 * like a better prospect than it is.
 */

import type { MobileResponsiveness } from './web-opportunity-audit'

/** The three Lighthouse audits this reads, in the order they are considered. */
export const MOBILE_AUDIT_IDS = ['viewport', 'content-width', 'tap-targets'] as const
export type MobileAuditId = (typeof MOBILE_AUDIT_IDS)[number]

export type MobileAssessment =
  | { status: 'measured'; value: MobileResponsiveness; evidence: readonly string[] }
  | { status: 'unmeasured'; reason: string }

type AuditOutcome = 'passed' | 'failed' | 'not_applicable' | 'absent'

function readAudit(audits: Record<string, unknown>, id: MobileAuditId): { outcome: AuditOutcome; title: string } {
  const audit = audits[id]
  if (typeof audit !== 'object' || audit === null) return { outcome: 'absent', title: id }
  const record = audit as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title : id

  // Lighthouse marks an audit informative or inapplicable with a null score.
  // That is not a failure and must not be scored as one.
  const scoreDisplayMode = record.scoreDisplayMode
  if (scoreDisplayMode === 'notApplicable' || scoreDisplayMode === 'informative' || scoreDisplayMode === 'manual') {
    return { outcome: 'not_applicable', title }
  }
  const score = record.score
  if (typeof score !== 'number') return { outcome: 'absent', title }
  return { outcome: score >= 0.9 ? 'passed' : 'failed', title }
}

export function assessMobileResponsiveness(payload: unknown): MobileAssessment {
  if (typeof payload !== 'object' || payload === null) {
    return { status: 'unmeasured', reason: 'The PageSpeed response was not readable.' }
  }
  const lighthouse = (payload as Record<string, unknown>).lighthouseResult
  if (typeof lighthouse !== 'object' || lighthouse === null) {
    return { status: 'unmeasured', reason: 'The PageSpeed response contained no Lighthouse result.' }
  }
  const audits = (lighthouse as Record<string, unknown>).audits
  if (typeof audits !== 'object' || audits === null) {
    return { status: 'unmeasured', reason: 'The Lighthouse result contained no audits.' }
  }

  const record = audits as Record<string, unknown>
  const viewport = readAudit(record, 'viewport')
  const contentWidth = readAudit(record, 'content-width')
  const tapTargets = readAudit(record, 'tap-targets')

  // Charter 10.4. The viewport audit is the one this cannot proceed without:
  // every other branch is interpreted relative to whether a mobile viewport
  // was declared at all.
  if (viewport.outcome === 'absent') {
    return {
      status: 'unmeasured',
      reason: 'The Lighthouse run did not include a viewport audit, so mobile responsiveness cannot be established from it.',
    }
  }

  if (viewport.outcome === 'failed') {
    return {
      status: 'measured',
      value: 'not-responsive',
      evidence: [`Lighthouse mobile: "${viewport.title}" failed — the page declares no usable mobile viewport.`],
    }
  }

  const defects = [contentWidth, tapTargets].filter((audit) => audit.outcome === 'failed')
  if (defects.length > 0) {
    return {
      status: 'measured',
      value: 'responsive-defective',
      evidence: [
        'Lighthouse mobile: a viewport is declared, so the site is responsive in intent.',
        ...defects.map((audit) => `"${audit.title}" failed.`),
      ],
    }
  }

  // Everything that was checkable passed. If the supporting audits were absent
  // rather than passing, say so — "fully-responsive" is the most favourable
  // reading and must not rest on audits that never ran.
  const uncheckable = [contentWidth, tapTargets].filter((audit) => audit.outcome === 'absent')
  if (uncheckable.length === [contentWidth, tapTargets].length) {
    return {
      status: 'unmeasured',
      reason: 'A viewport is declared, but neither supporting mobile audit was present, so the result cannot be distinguished from a defective layout.',
    }
  }

  return {
    status: 'measured',
    value: 'fully-responsive',
    evidence: [
      'Lighthouse mobile: a viewport is declared and every checkable mobile audit passed.',
      ...uncheckable.map((audit) => `"${audit.title}" was not present in this run.`),
    ],
  }
}
