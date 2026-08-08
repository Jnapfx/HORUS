/**
 * Paginates `executeSerpApiReviews` from the newest review, storing each
 * page as its own immutable raw-evidence snapshot (DEC-020, DEC-046,
 * DEC-047), and stops at a page cap rather than paying for a full history —
 * the same cost discipline DEC-018 and Phase 1 calibration already
 * documented ("stop before further pagination and assess the cost
 * pattern"). What it returns is deliberately raw: `isoDate`/`rating` pairs
 * only, plus whether pagination was exhausted. Turning that into gates and
 * factors is `src/domain/review-history.ts` and `reputation-scoring.ts`'s
 * job, run in the renderer — this module's job is credentialed retrieval
 * and evidence storage only.
 */

import { executeSerpApiReviews } from './integrations/serpapi.js'

export type ReviewHistoryResult =
  | {
      status: 'completed'
      retrievedAt: string
      snapshotIds: readonly string[]
      pagesFetched: number
      /** `true` only if pagination ran out of further pages naturally, not merely hit the page cap. */
      paginationExhausted: boolean
      reviews: readonly { isoDate: string; rating: number }[]
    }
  | { status: 'failed'; reason: string; detail: string }

function extractReviews(payload: unknown): readonly { isoDate: string; rating: number }[] {
  if (typeof payload !== 'object' || payload === null) return []
  const reviews = (payload as Record<string, unknown>).reviews
  if (!Array.isArray(reviews)) return []
  return reviews
    .map((raw) => {
      const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
      return typeof item.iso_date === 'string' && typeof item.rating === 'number' ? { isoDate: item.iso_date, rating: item.rating } : null
    })
    .filter((review): review is { isoDate: string; rating: number } => review !== null)
}

function extractNextPageToken(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const pagination = (payload as Record<string, unknown>).serpapi_pagination
  if (typeof pagination !== 'object' || pagination === null) return null
  const token = (pagination as Record<string, unknown>).next_page_token
  return typeof token === 'string' && token ? token : null
}

export async function runReviewHistoryRetrieval(input: {
  dataId: string
  apiKey: string
  appendRawSnapshot: (snapshot: { source: string; request: unknown; retrievedAt: string; payload: unknown }) => { id: string; path: string; payloadHash: string }
  /** Default 3, matching the page count Phase 1 calibration used before deciding further pagination needed its own explicit decision. */
  maxPages?: number
  fetchImpl?: typeof fetch
  now?: () => Date
}): Promise<ReviewHistoryResult> {
  if (!input.dataId.trim()) throw new Error('A listing data_id is required')
  if (!input.apiKey.trim()) throw new Error('A SerpApi key is required to retrieve review history')
  const maxPages = input.maxPages ?? 3

  const snapshotIds: string[] = []
  const allReviews: { isoDate: string; rating: number }[] = []
  let pageToken: string | undefined
  let retrievedAt = ''
  let paginationExhausted = false

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const response = await executeSerpApiReviews({
        dataId: input.dataId,
        pageToken,
        apiKey: input.apiKey,
        fetchImpl: input.fetchImpl,
        now: input.now,
      })
      retrievedAt = response.retrievedAt

      const stored = input.appendRawSnapshot({
        source: 'serpapi.google_maps_reviews',
        request: response.requestUrl,
        retrievedAt: response.retrievedAt,
        payload: response.payload,
      })
      snapshotIds.push(stored.id)
      allReviews.push(...extractReviews(response.payload))

      const nextToken = extractNextPageToken(response.payload)
      if (!nextToken) {
        paginationExhausted = true
        break
      }
      pageToken = nextToken
    }

    return {
      status: 'completed',
      retrievedAt,
      snapshotIds,
      pagesFetched: snapshotIds.length,
      paginationExhausted,
      reviews: allReviews,
    }
  } catch (error) {
    return { status: 'failed', reason: 'review_history_request_failed', detail: error instanceof Error ? error.message : String(error) }
  }
}
