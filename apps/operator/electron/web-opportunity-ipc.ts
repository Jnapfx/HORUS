/**
 * DEC-072. Wires two of `web-opportunity-v2`'s five factors to real,
 * mechanical measurement: load performance (real PageSpeed Insights) and the
 * `no-https` obsolete-appearance indicator (real, from the URL's own
 * protocol — no network call needed to know this). It also attempts one
 * further real, evidence-based check — whether the fetched page contains a
 * `tel:` link — but only when the site is confirmed https, since the
 * read-only inspector this reuses (`website-inspector.ts`) requires that.
 *
 * Deliberately not attempted here: mobile responsiveness, the other six
 * obsolete-appearance indicators, a broken-link crawl, and commercial
 * ineffectiveness. All of those need either rendering a page (this tool only
 * fetches raw HTML as inert text) or judgment about intent and content
 * quality that a regex cannot honestly claim to have — so this module leaves
 * them `unmeasured` rather than approximate them with a heuristic that would
 * look more confident than it is (DEC-005's spirit applied to scoring
 * inputs, not just demonstration content).
 */

import { inspectPublicWebsiteReadOnly } from './agent/website-inspector.js'
import { executePageSpeedMobile } from './integrations/pagespeed.js'

export type Measured<T> = { status: 'measured'; value: T } | { status: 'unmeasured'; reason: string }

export type WebOpportunityMeasurementResult =
  | {
      status: 'completed'
      retrievedAt: string
      performance: Measured<{ timeToInteractiveSeconds: number; snapshotId: string }>
      /**
       * DEC-097. A trimmed slice of the same Lighthouse run `performance` is
       * read from — no extra request, no extra credit. Deliberately raw: this
       * process measures, the renderer scores, the same layering
       * `screenListingGates` and review-history retrieval already follow. The
       * shape is kept identical to PageSpeed's own so the renderer's pure
       * `assessMobileResponsiveness` reads it unchanged.
       */
      mobileAudits: { lighthouseResult: { audits: Record<string, unknown> } } | null
      servesHttps: Measured<boolean>
      telLinkFound: Measured<{ found: boolean; snapshotId: string }>
      /**
       * DEC-098. Mechanical patterns read from the page text this module
       * already fetches and stores for the tel: check — no new request. Raw
       * findings only: the renderer maps them onto the model's indicators,
       * the same measure-here/score-there split DEC-097 follows.
       */
      obsoleteSignals: { obsoleteTechnologyMarkers: string[]; latestCopyrightYear: number | null } | null
    }
  | { status: 'failed'; reason: string; detail: string }

/**
 * DEC-097. Carries forward only the three audits the mobile factor needs,
 * rather than the whole multi-megabyte Lighthouse document. Missing audits are
 * simply absent from the slice, which the renderer treats as `unmeasured`
 * rather than as a failure (charter 10.4).
 */
const MOBILE_AUDIT_IDS = ['viewport', 'content-width', 'tap-targets']

function extractMobileAudits(payload: unknown): { lighthouseResult: { audits: Record<string, unknown> } } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const lighthouse = (payload as Record<string, unknown>).lighthouseResult
  if (typeof lighthouse !== 'object' || lighthouse === null) return null
  const audits = (lighthouse as Record<string, unknown>).audits
  if (typeof audits !== 'object' || audits === null) return null
  const source = audits as Record<string, unknown>
  const slice: Record<string, unknown> = {}
  for (const id of MOBILE_AUDIT_IDS) {
    if (id in source) slice[id] = source[id]
  }
  return { lighthouseResult: { audits: slice } }
}

/**
 * DEC-098. Long-obsolete technology, matched verbatim. Presence only: a marker
 * that is absent proves nothing, because the page may render it later or the
 * fetch may have been truncated (charter 10.4).
 */
const OBSOLETE_MARKERS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'Flash embed', pattern: /<(embed|object)[^>]+(application\/x-shockwave-flash|\.swf)/i },
  { label: '<marquee> tag', pattern: /<marquee\b/i },
  { label: '<blink> tag', pattern: /<blink\b/i },
  { label: 'presentational <font> tag', pattern: /<font\b/i },
  { label: '"best viewed in" notice', pattern: /best\s+viewed\s+(in|with)/i },
  { label: 'FrontPage generator tag', pattern: /content=["'][^"']*FrontPage/i },
]

function extractObsoleteSignals(html: string): { obsoleteTechnologyMarkers: string[]; latestCopyrightYear: number | null } {
  const obsoleteTechnologyMarkers = OBSOLETE_MARKERS.filter((marker) => marker.pattern.test(html)).map((marker) => marker.label)

  // Years adjacent to a copyright notice only — a bare four-digit number
  // anywhere on the page is not a copyright date.
  const years: number[] = []
  const pattern = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})/gi
  let match = pattern.exec(html)
  while (match !== null) {
    const year = Number(match[1])
    if (year >= 1990 && year <= 2100) years.push(year)
    match = pattern.exec(html)
  }

  return { obsoleteTechnologyMarkers, latestCopyrightYear: years.length > 0 ? Math.max(...years) : null }
}

function extractTimeToInteractiveSeconds(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null
  const lighthouse = (payload as Record<string, unknown>).lighthouseResult
  if (typeof lighthouse !== 'object' || lighthouse === null) return null
  const audits = (lighthouse as Record<string, unknown>).audits
  if (typeof audits !== 'object' || audits === null) return null
  const interactive = (audits as Record<string, unknown>).interactive
  if (typeof interactive !== 'object' || interactive === null) return null
  const numericValue = (interactive as Record<string, unknown>).numericValue
  return typeof numericValue === 'number' ? numericValue / 1000 : null
}

export async function runWebOpportunityMeasurement(input: {
  url: string
  pagespeedApiKey: string
  appendRawSnapshot: (snapshot: { source: string; request: unknown; retrievedAt: string; payload: unknown }) => { id: string; path: string; payloadHash: string }
  fetchImpl?: typeof fetch
  now?: () => Date
}): Promise<WebOpportunityMeasurementResult> {
  if (!input.url.trim()) throw new Error('A website URL is required')
  if (!input.pagespeedApiKey.trim()) throw new Error('A PageSpeed API key is required')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(input.url)
  } catch {
    return { status: 'failed', reason: 'invalid_url', detail: `"${input.url}" is not a valid URL` }
  }

  const now = input.now ?? (() => new Date())
  let retrievedAt: string | null = null

  let mobileAudits: { lighthouseResult: { audits: Record<string, unknown> } } | null = null
  let performance: Measured<{ timeToInteractiveSeconds: number; snapshotId: string }> = {
    status: 'unmeasured',
    reason: 'PageSpeed request did not complete.',
  }
  try {
    const response = await executePageSpeedMobile({ url: input.url, apiKey: input.pagespeedApiKey, fetchImpl: input.fetchImpl, now: input.now })
    retrievedAt = response.retrievedAt
    const stored = input.appendRawSnapshot({ source: 'pagespeed.mobile', request: response.requestUrl, retrievedAt: response.retrievedAt, payload: response.payload })
    mobileAudits = extractMobileAudits(response.payload)
    const tti = extractTimeToInteractiveSeconds(response.payload)
    performance = tti === null
      ? { status: 'unmeasured', reason: 'PageSpeed response did not include a usable Time to Interactive value.' }
      : { status: 'measured', value: { timeToInteractiveSeconds: tti, snapshotId: stored.id } }
  } catch (error) {
    performance = { status: 'unmeasured', reason: error instanceof Error ? error.message : String(error) }
  }

  // Requires no network call: the listed URL's own scheme is already known.
  const servesHttps: Measured<boolean> = { status: 'measured', value: parsedUrl.protocol === 'https:' }

  let obsoleteSignals: { obsoleteTechnologyMarkers: string[]; latestCopyrightYear: number | null } | null = null
  let telLinkFound: Measured<{ found: boolean; snapshotId: string }> = servesHttps.value
    ? { status: 'unmeasured', reason: 'Website inspection did not complete.' }
    : { status: 'unmeasured', reason: 'Site is not served over https; contact-path inspection requires an https URL.' }

  if (servesHttps.value) {
    try {
      const inspection = await inspectPublicWebsiteReadOnly(input.url, { fetchImpl: input.fetchImpl })
      if (!retrievedAt) retrievedAt = now().toISOString()
      const stored = input.appendRawSnapshot({
        source: 'horus.website-analysis',
        request: { url: inspection.url, method: 'GET' },
        retrievedAt,
        payload: { statusCode: inspection.statusCode, contentType: inspection.contentType, textExcerpt: inspection.textExcerpt, truncated: inspection.truncated },
      })
      telLinkFound = { status: 'measured', value: { found: /href\s*=\s*["']tel:/i.test(inspection.textExcerpt), snapshotId: stored.id } }
      obsoleteSignals = extractObsoleteSignals(inspection.textExcerpt)
    } catch (error) {
      telLinkFound = { status: 'unmeasured', reason: error instanceof Error ? error.message : String(error) }
    }
  }

  if (!retrievedAt) retrievedAt = now().toISOString()

  return { status: 'completed', retrievedAt, performance, mobileAudits, servesHttps, telLinkFound, obsoleteSignals }
}
