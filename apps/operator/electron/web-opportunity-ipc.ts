/**
 * DEC-072. Wires two of `web-opportunity-v2`'s five factors to real,
 * mechanical measurement: load performance (real PageSpeed Insights) and the
 * `no-https` obsolete-appearance indicator (real, from the URL's own
 * protocol — no network call needed to know this). It also attempts one
 * further real, evidence-based check — whether the fetched page contains a
 * `tel:` link — but only when the site is confirmed https, since the
 * read-only inspector this reuses (`website-inspector.ts`) requires that.
 *
 * Deliberately not attempted here: mobile responsiveness and the other six
 * obsolete-appearance indicators, and commercial ineffectiveness. All of
 * those need either rendering a page (this tool only fetches raw HTML as
 * inert text) or judgment about intent and content quality that a regex
 * cannot honestly claim to have — so this module leaves them `unmeasured`
 * rather than approximate them with a heuristic that would look more
 * confident than it is (DEC-005's spirit applied to scoring inputs, not just
 * demonstration content).
 *
 * DEC-111 adds one exception to that list: a same-origin link check
 * (`link-crawl.ts`) reuses the same homepage fetch this module already
 * performs for the tel: check, since whether a same-origin link returns an
 * HTTP error is an objective fact, not a judgment call.
 */

import { inspectPublicWebsiteReadOnly } from './agent/website-inspector.js'
import { executePageSpeedMobile } from './integrations/pagespeed.js'
import { checkBrokenLinks, type BrokenLinkCheck } from './link-crawl.js'

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
      /**
       * DEC-111. Same-origin link check derived from the same homepage fetch
       * `telLinkFound`/`obsoleteSignals` already use — no extra request. Null
       * when the homepage had no checkable same-origin https link, read as
       * `unmeasured` by the renderer rather than as zero broken links.
       */
      brokenLinks: BrokenLinkCheck | null
      /**
       * DEC-117. True when this result was rebuilt from evidence already
       * retained for this exact URL, rather than a new PageSpeed/fetch —
       * matches DEC-108's `fromCache`-style signal for review history, so the
       * renderer can say plainly that nothing was spent.
       */
      fromCache: boolean
    }
  | { status: 'failed'; reason: string; detail: string }

/** DEC-117. One raw evidence row, as `persistence.ts`'s `listRawSnapshotsBySource` already returns it. */
export type RawSnapshotRecord = { id: string; retrievedAt: string; request: unknown; payload: unknown }

/** The URL this snapshot's measurement run was for, stored alongside the request so a later run can find it without re-parsing a PageSpeed request URL or an inspector's echoed one. */
export function extractTargetUrl(request: unknown): string | null {
  if (typeof request !== 'object' || request === null) return null
  const value = (request as Record<string, unknown>).targetUrl
  return typeof value === 'string' && value ? value : null
}

function latestForUrl(url: string, snapshots: readonly RawSnapshotRecord[]): RawSnapshotRecord | null {
  const matches = snapshots.filter((snapshot) => extractTargetUrl(snapshot.request) === url)
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt)).at(-1) ?? null
}

/**
 * DEC-117. Rebuilds a completed measurement from evidence already retained
 * for this exact URL — no PageSpeed quota unit, no network fetch. Two call
 * sites use this, and must agree: this file's own cache check below (serves a
 * repeat "Measure web opportunity" press for free) and `session:restore`
 * (restores a prior measurement into the renderer on app launch, so a closed
 * and reopened application does not read as "nothing was ever measured" —
 * the same known gap DEC-107/DEC-108 already closed for reputation scoring,
 * left open here until now).
 *
 * `servesHttps` is re-derived from the URL itself rather than read back from
 * a snapshot — it costs nothing and cannot go stale. `brokenLinks` reads from
 * the `horus.website-analysis` snapshot's own payload (stored there since
 * DEC-117, alongside the fetched page text it was computed from) rather than
 * re-crawling, since a live link check is a further real fetch of each linked
 * page and restoring must spend nothing.
 */
export function reconstructMeasurementFromSnapshots(
  url: string,
  pagespeedSnapshots: readonly RawSnapshotRecord[],
  websiteAnalysisSnapshots: readonly RawSnapshotRecord[],
): (Extract<WebOpportunityMeasurementResult, { status: 'completed' }>) | null {
  const pagespeed = latestForUrl(url, pagespeedSnapshots)
  const analysis = latestForUrl(url, websiteAnalysisSnapshots)
  if (!pagespeed && !analysis) return null

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }
  const servesHttps: Measured<boolean> = { status: 'measured', value: parsedUrl.protocol === 'https:' }

  let performance: Measured<{ timeToInteractiveSeconds: number; snapshotId: string }> = {
    status: 'unmeasured',
    reason: 'No retained PageSpeed measurement for this URL.',
  }
  let mobileAudits: { lighthouseResult: { audits: Record<string, unknown> } } | null = null
  if (pagespeed) {
    mobileAudits = extractMobileAudits(pagespeed.payload)
    const tti = extractTimeToInteractiveSeconds(pagespeed.payload)
    performance = tti === null
      ? { status: 'unmeasured', reason: 'The retained PageSpeed response did not include a usable Time to Interactive value.' }
      : { status: 'measured', value: { timeToInteractiveSeconds: tti, snapshotId: pagespeed.id } }
  }

  let telLinkFound: Measured<{ found: boolean; snapshotId: string }> = {
    status: 'unmeasured',
    reason: 'No retained page fetch for this URL.',
  }
  let obsoleteSignals: { obsoleteTechnologyMarkers: string[]; latestCopyrightYear: number | null } | null = null
  let brokenLinks: BrokenLinkCheck | null = null
  if (analysis) {
    const payload = typeof analysis.payload === 'object' && analysis.payload !== null ? (analysis.payload as Record<string, unknown>) : {}
    const textExcerpt = typeof payload.textExcerpt === 'string' ? payload.textExcerpt : ''
    telLinkFound = { status: 'measured', value: { found: /href\s*=\s*["']tel:/i.test(textExcerpt), snapshotId: analysis.id } }
    obsoleteSignals = extractObsoleteSignals(textExcerpt)
    brokenLinks = (payload.brokenLinks as BrokenLinkCheck | undefined) ?? null
  }

  const retrievedAt = pagespeed?.retrievedAt ?? analysis?.retrievedAt
  if (!retrievedAt) return null

  return { status: 'completed', retrievedAt, performance, mobileAudits, servesHttps, telLinkFound, obsoleteSignals, brokenLinks, fromCache: true }
}

/**
 * DEC-097. Carries forward only the three audits the mobile factor needs,
 * rather than the whole multi-megabyte Lighthouse document. Missing audits are
 * simply absent from the slice, which the renderer treats as `unmeasured`
 * rather than as a failure (charter 10.4).
 */
// DEC-109. Every id `MOBILE_AUDIT_SLOTS` may read, across Lighthouse versions.
// Kept as a literal rather than imported so the main process does not depend on
// the renderer's domain modules, and asserted equal to it by a test.
export const MOBILE_AUDIT_IDS = ['viewport-insight', 'viewport', 'target-size', 'tap-targets', 'content-width', 'meta-viewport']

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
  /** DEC-117. Set to skip the cache below and spend a fresh PageSpeed unit even when this exact URL was measured before. */
  forceRefresh?: boolean
  /**
   * DEC-117. Checked before spending anything, unless `forceRefresh` is set —
   * the same shape `discovery:run`'s `findCachedSnapshot` (DEC-077) and
   * review history's retained-pages check (DEC-108) already follow. A miss
   * (both arrays empty for this URL) falls through to a real measurement.
   */
  findCachedSnapshots?: () => { pagespeed: readonly RawSnapshotRecord[]; analysis: readonly RawSnapshotRecord[] }
}): Promise<WebOpportunityMeasurementResult> {
  if (!input.url.trim()) throw new Error('A website URL is required')
  if (!input.pagespeedApiKey.trim()) throw new Error('A PageSpeed API key is required')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(input.url)
  } catch {
    return { status: 'failed', reason: 'invalid_url', detail: `"${input.url}" is not a valid URL` }
  }

  if (!input.forceRefresh && input.findCachedSnapshots) {
    const { pagespeed, analysis } = input.findCachedSnapshots()
    const cached = reconstructMeasurementFromSnapshots(input.url, pagespeed, analysis)
    if (cached) return cached
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
    // DEC-117. `targetUrl` recorded alongside the redacted request URL, the
    // same reason `discovery:run` stores `category`/`city` beside its own
    // request (DEC-077) — so a later run, or a restore, can find this without
    // re-parsing PageSpeed's own request URL.
    const stored = input.appendRawSnapshot({
      source: 'pagespeed.mobile',
      request: { requestUrl: response.requestUrl, targetUrl: input.url },
      retrievedAt: response.retrievedAt,
      payload: response.payload,
    })
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
  let brokenLinks: BrokenLinkCheck | null = null

  if (servesHttps.value) {
    try {
      const inspection = await inspectPublicWebsiteReadOnly(input.url, { fetchImpl: input.fetchImpl })
      if (!retrievedAt) retrievedAt = now().toISOString()
      // DEC-117. The link crawl now runs before the snapshot is stored, so its
      // result can be persisted in the same evidence row as the fetched page
      // it was computed from — still exactly one further request per checked
      // link, still exactly two stored snapshots for this whole function
      // (`pagespeed.mobile` above, `horus.website-analysis` here), just
      // reordered so the crawl's own output does not need a third write.
      let crawl: BrokenLinkCheck | null = null
      try {
        crawl = await checkBrokenLinks(inspection.url, inspection.textExcerpt, input.fetchImpl)
      } catch {
        crawl = null
      }
      const stored = input.appendRawSnapshot({
        source: 'horus.website-analysis',
        request: { url: inspection.url, method: 'GET', targetUrl: input.url },
        retrievedAt,
        payload: {
          statusCode: inspection.statusCode,
          contentType: inspection.contentType,
          textExcerpt: inspection.textExcerpt,
          truncated: inspection.truncated,
          brokenLinks: crawl,
        },
      })
      telLinkFound = { status: 'measured', value: { found: /href\s*=\s*["']tel:/i.test(inspection.textExcerpt), snapshotId: stored.id } }
      obsoleteSignals = extractObsoleteSignals(inspection.textExcerpt)
      brokenLinks = crawl
    } catch (error) {
      telLinkFound = { status: 'unmeasured', reason: error instanceof Error ? error.message : String(error) }
    }
  }

  if (!retrievedAt) retrievedAt = now().toISOString()

  return { status: 'completed', retrievedAt, performance, mobileAudits, servesHttps, telLinkFound, obsoleteSignals, brokenLinks, fromCache: false }
}
