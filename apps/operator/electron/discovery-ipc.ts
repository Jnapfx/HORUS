/**
 * Wires the real SerpApi discovery module (`integrations/serpapi.ts`) to a
 * single function the Electron main process can call from an IPC handler —
 * closing the gap DEC-050's sibling finding described: `App.tsx`'s search
 * stage has only ever advanced a fixture workflow state, never called the
 * discovery integration that has existed since Phase 3.
 *
 * Kept separate from `main.ts` and dependency-injected (`appendRawSnapshot`,
 * `fetchImpl`, `now`), in the same style as `analyst-ipc.ts`, so it is
 * testable without Electron, a database, or a network call.
 *
 * Scope, stated plainly: this performs one discovery request and stores its
 * raw evidence (DEC-020, DEC-046, DEC-047). It does not paginate to
 * `MAX_EXAMINED` (charter 12), does not run gates G1/G2, and does not compute
 * `reputation-scoring-v1` or `web-opportunity-v2` against the results — those
 * remain separate, not-yet-wired steps. It also performs no publication or
 * outreach action and requests no approval; per DEC-004 those gates apply
 * only once a specific prospect is selected, later in the workflow.
 *
 * DEC-077. Two fixes/additions from the first live runs:
 *   - `maxExamined` previously only bounded the `num` query parameter sent to
 *     SerpApi, which does not actually limit `local_results`' size for the
 *     Google Maps engine — a live run asking for 5 candidates got 20 back.
 *     The candidate list is now sliced to `maxExamined` after extraction, so
 *     the field the operator sees actually does what it says.
 *   - DEC-020 already required caching every external response so a repeat
 *     retrieval never re-spends a credit by default; discovery search never
 *     implemented that half of the rule. `findCachedSnapshot`, when supplied,
 *     is checked first (case-insensitive category+city match, any age — per
 *     DEC-021 browsing/ranking may use cached data of any age, freshness is
 *     only enforced at the two approval gates) and used instead of a new
 *     SerpApi request when a prior search for the same category and city
 *     exists. `forceRefresh` bypasses the cache when the operator explicitly
 *     wants current data.
 */

import { executeSerpApiDiscovery } from './integrations/serpapi.js'

export type DiscoveryCandidateSummary = {
  name: string | null
  rating: number | null
  reviewCount: number | null
  type: string | null
  dataId: string | null
  address: string | null
  website: string | null
  /** DEC-079. From the listing's own `phone` field, when present — needed for a demonstration's click-to-call link (charter 15.2/DEC-023). */
  phone: string | null
  /** DEC-074. From the listing's own `gps_coordinates`, when present — no geocoding call is made. */
  coordinates: { latitude: number; longitude: number } | null
}

export type DiscoveryRunResult =
  | {
      status: 'completed'
      snapshotId: string
      retrievedAt: string
      /** Credential-redacted, per DEC-046. Never the executed URL. `'(cached; no new request made)'` when served from a prior snapshot. */
      requestUrl: string
      candidateCount: number
      candidates: readonly DiscoveryCandidateSummary[]
      /** DEC-077. True when this result came from a previously stored snapshot rather than a new SerpApi request — no credit was spent. */
      fromCache: boolean
    }
  | { status: 'failed'; reason: string; detail: string }

export type CachedDiscoverySnapshot = { id: string; retrievedAt: string; payload: unknown }

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Reads only what SerpApi's Google Maps `local_results` shape documents.
 * A candidate missing a field stays `null` rather than being guessed at —
 * the same missing-data discipline the scoring modules use, applied here to
 * raw listing fields.
 */
function extractCandidates(payload: unknown): readonly DiscoveryCandidateSummary[] {
  if (typeof payload !== 'object' || payload === null) return []
  const localResults = (payload as Record<string, unknown>).local_results
  if (!Array.isArray(localResults)) return []
  return localResults.map((raw) => {
    const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const gps = typeof item.gps_coordinates === 'object' && item.gps_coordinates !== null ? (item.gps_coordinates as Record<string, unknown>) : {}
    const latitude = numberOrNull(gps.latitude)
    const longitude = numberOrNull(gps.longitude)
    return {
      name: textOrNull(item.title),
      rating: numberOrNull(item.rating),
      reviewCount: numberOrNull(item.reviews),
      type: textOrNull(item.type),
      dataId: textOrNull(item.data_id),
      address: textOrNull(item.address),
      website: textOrNull(item.website),
      phone: textOrNull(item.phone),
      coordinates: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    }
  })
}

export async function runRealDiscoverySearch(input: {
  category: string
  city: string
  /** Bounds this single request's page size; SerpApi's Google Maps API caps a page around 20 results (see the known-limitation note above about pagination to MAX_EXAMINED). Also, as of DEC-077, bounds the returned candidate list directly, since SerpApi does not reliably honor `num`. */
  maxExamined: number
  apiKey: string
  appendRawSnapshot: (snapshot: { source: string; request: unknown; retrievedAt: string; payload: unknown }) => { id: string; path: string; payloadHash: string }
  /** DEC-077. Looked up before spending a new credit; a match is used instead of a new request unless `forceRefresh` is set. */
  findCachedSnapshot?: (input: { category: string; city: string }) => CachedDiscoverySnapshot | null
  forceRefresh?: boolean
  fetchImpl?: typeof fetch
  now?: () => Date
}): Promise<DiscoveryRunResult> {
  if (!input.category.trim()) throw new Error('Search category is required')
  if (!input.city.trim()) throw new Error('Search city is required')
  if (!Number.isInteger(input.maxExamined) || input.maxExamined < 1) throw new Error('Maximum examined must be a positive integer')
  if (!input.apiKey.trim()) throw new Error('A SerpApi key is required to run a real search')

  if (!input.forceRefresh && input.findCachedSnapshot) {
    const cached = input.findCachedSnapshot({ category: input.category, city: input.city })
    if (cached) {
      const candidates = extractCandidates(cached.payload).slice(0, input.maxExamined)
      return {
        status: 'completed',
        snapshotId: cached.id,
        retrievedAt: cached.retrievedAt,
        requestUrl: '(cached; no new request made)',
        candidateCount: candidates.length,
        candidates,
        fromCache: true,
      }
    }
  }

  try {
    const response = await executeSerpApiDiscovery({
      query: input.category,
      location: input.city,
      num: Math.min(input.maxExamined, 20),
      apiKey: input.apiKey,
      fetchImpl: input.fetchImpl,
      now: input.now,
    })

    // Raw evidence is stored before anything derived is computed or shown,
    // consistent with every other retrieval path in this codebase (DEC-020).
    // `category`/`city` are stored alongside the redacted request URL so a
    // later search can be matched for caching (DEC-077) without re-parsing it.
    const stored = input.appendRawSnapshot({
      source: 'serpapi.google_maps',
      request: { requestUrl: response.requestUrl, category: input.category, city: input.city },
      retrievedAt: response.retrievedAt,
      payload: response.payload,
    })

    const candidates = extractCandidates(response.payload).slice(0, input.maxExamined)

    return {
      status: 'completed',
      snapshotId: stored.id,
      retrievedAt: response.retrievedAt,
      requestUrl: response.requestUrl,
      candidateCount: candidates.length,
      candidates,
      fromCache: false,
    }
  } catch (error) {
    return { status: 'failed', reason: 'discovery_request_failed', detail: error instanceof Error ? error.message : String(error) }
  }
}
