/**
 * Two more of `web-opportunity-v2`'s seven obsolete-appearance indicators,
 * plus an honest statement of how many of the seven were actually looked at.
 *
 * DEC-072 wired exactly one indicator, `no-https`, and then passed the result
 * to the model as `status: 'measured'`. When a site did serve https that meant
 * handing the model an empty indicator list — *"obsolete appearance was
 * examined and nothing was found"* — after examining one of seven things.
 *
 * The **score** was never wrong: the factor's concave curve rises with the
 * number of indicators found, so reporting fewer can only produce a smaller
 * number, and `scoreLowerBound` is explicitly a lower bound. What was wrong is
 * that nothing said so. The operator read "measured" and had no way to know
 * six indicators had never been checked — the kind of quiet completeness claim
 * charter 10.4 and hard rule 6 exist to prevent.
 *
 * This module fixes both halves: it detects two further indicators from page
 * text HORUS has already fetched and stored (no new request, no new cost — the
 * same argument as DEC-097), and it returns the examined and unexamined sets
 * explicitly so the interface can state coverage instead of implying it.
 *
 * **Only presence is ever detected.** `stale-or-missing-copyright` is reported
 * only in its *stale* form — a copyright year that is present and old. The
 * *missing* form is deliberately never inferred: a copyright notice absent
 * from the fetched text may simply be rendered by JavaScript, or live in a
 * footer beyond the fetch cap, and DEC-034 warns specifically that absences
 * are cheap to detect and easy to get wrong.
 */

import type { ObsoleteAppearanceIndicator } from './web-opportunity-audit'

/** Mechanical findings from the page text, produced in the main process. */
export type ObsoleteAppearanceSignals = {
  /** Markers of long-obsolete web technology found verbatim in the page. */
  obsoleteTechnologyMarkers: readonly string[]
  /** The most recent four-digit year adjacent to a copyright notice, if any. */
  latestCopyrightYear: number | null
  servesHttps: boolean | null
}

export type IndicatorFinding = {
  indicator: ObsoleteAppearanceIndicator
  evidence: string
}

export type ObsoleteAppearanceScan = {
  indicators: readonly IndicatorFinding[]
  examined: readonly ObsoleteAppearanceIndicator[]
  /** The indicators this scan has no way to check. Stated, never implied. */
  notExamined: readonly ObsoleteAppearanceIndicator[]
  coverage: string
}

const ALL_INDICATORS: readonly ObsoleteAppearanceIndicator[] = [
  'four-or-more-font-families',
  'six-or-more-non-neutral-colours',
  'placeholder-or-theme-content',
  'stock-imagery-in-place-of-business-work',
  'stale-or-missing-copyright',
  'no-https',
  'obsolete-technology-marker',
]

/**
 * A copyright year this many years behind the retrieval year reads as stale.
 * Two rather than one: a site updated in December and checked in January is
 * not neglected, and this must not fire on the turn of a year.
 */
export const STALE_COPYRIGHT_YEARS = 2

export function scanObsoleteAppearance(input: {
  signals: ObsoleteAppearanceSignals
  /** Charter 9.7: compared against the evidence's own retrieval time, not the clock. */
  retrievedAt: string
}): ObsoleteAppearanceScan {
  const indicators: IndicatorFinding[] = []
  const examined: ObsoleteAppearanceIndicator[] = []

  if (input.signals.servesHttps !== null) {
    examined.push('no-https')
    if (!input.signals.servesHttps) {
      indicators.push({ indicator: 'no-https', evidence: 'The listed URL does not use https.' })
    }
  }

  if (input.signals.obsoleteTechnologyMarkers.length > 0 || input.signals.latestCopyrightYear !== null) {
    // Both of these are read from the same fetched page text; if that text was
    // retrieved at all, both were checkable.
    examined.push('obsolete-technology-marker')
    if (input.signals.obsoleteTechnologyMarkers.length > 0) {
      indicators.push({
        indicator: 'obsolete-technology-marker',
        evidence: `Found in the page: ${input.signals.obsoleteTechnologyMarkers.join(', ')}.`,
      })
    }
  }

  const retrievalYear = new Date(input.retrievedAt).getUTCFullYear()
  if (input.signals.latestCopyrightYear !== null && !Number.isNaN(retrievalYear)) {
    examined.push('stale-or-missing-copyright')
    const age = retrievalYear - input.signals.latestCopyrightYear
    if (age >= STALE_COPYRIGHT_YEARS) {
      indicators.push({
        indicator: 'stale-or-missing-copyright',
        evidence: `The most recent copyright year on the page is ${input.signals.latestCopyrightYear}, ${age} years before this evidence was retrieved.`,
      })
    }
  }

  const uniqueExamined = [...new Set(examined)]
  const notExamined = ALL_INDICATORS.filter((indicator) => !uniqueExamined.includes(indicator))

  return {
    indicators,
    examined: uniqueExamined,
    notExamined,
    coverage:
      `${uniqueExamined.length} of ${ALL_INDICATORS.length} obsolete-appearance indicators were checked. ` +
      (notExamined.length > 0
        ? `Not checked: ${notExamined.join(', ')} — their absence from this result is not evidence they are absent from the site (charter 10.4).`
        : 'All indicators were checked.'),
  }
}
