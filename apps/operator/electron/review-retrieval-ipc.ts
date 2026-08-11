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
import {
  extractNextPageToken,
  extractReviews,
  readLatestRetainedRun,
  type RetainedReview,
  type RetainedReviewPage,
} from './review-evidence.js'

export type ReviewHistoryResult =
  | {
      status: 'completed'
      retrievedAt: string
      snapshotIds: readonly string[]
      pagesFetched: number
      /** `true` only if pagination ran out of further pages naturally, not merely hit the page cap. */
      paginationExhausted: boolean
      reviews: readonly RetainedReview[]
      /**
       * DEC-108. `true` when this was served from review pages already
       * retained, spending no SerpApi credit. The interface says so, for the
       * same reason DEC-077's discovery cache does.
       */
      fromCache: boolean
    }
  | { status: 'failed'; reason: string; detail: string }

export async function runReviewHistoryRetrieval(input: {
  dataId: string
  apiKey: string
  appendRawSnapshot: (snapshot: { source: string; request: unknown; retrievedAt: string; payload: unknown }) => { id: string; path: string; payloadHash: string }
  /** Default 3, matching the page count Phase 1 calibration used before deciding further pagination needed its own explicit decision. */
  maxPages?: number
  fetchImpl?: typeof fetch
  now?: () => Date
  /**
   * DEC-108. Review pages already retained for any listing. When this listing
   * is among them, they are served instead of spending a credit — the same
   * rule DEC-077 gave discovery, applied to the expensive half of retrieval.
   */
  retainedPages?: readonly RetainedReviewPage[]
  /** Retrieve again even though evidence is retained. The operator's explicit choice, and it spends. */
  forceRefresh?: boolean
}): Promise<ReviewHistoryResult> {
  if (!input.dataId.trim()) throw new Error('A listing data_id is required')
  const maxPages = input.maxPages ?? 3

  if (!input.forceRefresh && input.retainedPages) {
    const retained = readLatestRetainedRun(input.dataId, input.retainedPages)
    if (retained) {
      return {
        status: 'completed',
        retrievedAt: retained.retrievedAt,
        snapshotIds: retained.snapshotIds,
        pagesFetched: retained.pagesFetched,
        paginationExhausted: retained.paginationExhausted,
        reviews: retained.reviews,
        fromCache: true,
      }
    }
  }

  // Checked only once a real request is actually going to be made, so a
  // cache hit does not require a credential it will not use.
  if (!input.apiKey.trim()) throw new Error('A SerpApi key is required to retrieve review history')

  const snapshotIds: string[] = []
  const allReviews: RetainedReview[] = []
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
      fromCache: false,
    }
  } catch (error) {
    return { status: 'failed', reason: 'review_history_request_failed', detail: error instanceof Error ? error.message : String(error) }
  }
}
