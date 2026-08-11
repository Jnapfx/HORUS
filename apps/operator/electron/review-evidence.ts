/**
 * DEC-108. Reading review history back out of retained evidence.
 *
 * Two things went wrong because nothing owned this job.
 *
 * **A restored session counted the same review many times.** DEC-107's
 * `session:restore` concatenated every retained review page for a listing.
 * Each press of "Fetch review history & score" writes a fresh set of pages
 * beside the old ones (charter 14 — evidence is never overwritten), so a
 * listing retrieved five times came back with its reviews five times over.
 * That is not a display bug: the trailing-90-day and trailing-365-day counts
 * feed reputation Factor 3, so the restored score rose with the number of
 * times the operator had pressed the button. Always upward — the direction
 * that flatters a prospect.
 *
 * **And re-retrieving cost credits for evidence already on disk.** Discovery
 * has had a cache since DEC-077; review retrieval never did, though it is the
 * expensive half — up to three credits per candidate against a 250/month free
 * tier (DEC-032).
 *
 * The fix for both is the same function, so the restored session and a cache
 * hit cannot disagree about what the evidence says.
 *
 * **Why the latest run rather than the union of everything retained.** A
 * retrieval run is a coherent sample taken at one moment, and charter 9.7
 * computes every time-based factor against that moment's stored timestamp.
 * Merging runs from different days would produce a set of reviews with no
 * single honest `retrievedAt` to measure recency against, and a
 * `paginationExhausted` flag belonging to none of them. Replaying the most
 * recent run reproduces exactly what that retrieval saw.
 */

export type RetainedReviewPage = {
  id: string
  retrievedAt: string
  /** The request as stored: for review pages, the SerpApi URL with its key redacted (DEC-046). */
  request: unknown
  payload: unknown
}

export type RetainedReview = {
  isoDate: string
  rating: number
  text: string | null
  author: string | null
  ownerResponded: boolean
}

export type RetainedReviewHistory = {
  dataId: string
  retrievedAt: string
  snapshotIds: readonly string[]
  pagesFetched: number
  paginationExhausted: boolean
  reviews: readonly RetainedReview[]
}

/**
 * DEC-105. The review text, author and owner-reply flag are carried through,
 * not dropped — charter 9.5's judgment gates ask the operator about the
 * reviews they read.
 */
export function extractReviews(payload: unknown): readonly RetainedReview[] {
  if (typeof payload !== 'object' || payload === null) return []
  const reviews = (payload as Record<string, unknown>).reviews
  if (!Array.isArray(reviews)) return []
  return reviews
    .map((raw): RetainedReview | null => {
      const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
      if (typeof item.iso_date !== 'string' || typeof item.rating !== 'number') return null
      const user = typeof item.user === 'object' && item.user !== null ? (item.user as Record<string, unknown>) : {}
      return {
        isoDate: item.iso_date,
        rating: item.rating,
        text: typeof item.snippet === 'string' && item.snippet.trim() ? item.snippet : null,
        author: typeof user.name === 'string' ? user.name : null,
        // Charter 9.5's G4 asks about *unresolved* complaints, so whether the
        // owner replied is part of the evidence, not decoration.
        ownerResponded: typeof item.response === 'object' && item.response !== null,
      }
    })
    .filter((review): review is RetainedReview => review !== null)
}

export function extractNextPageToken(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const pagination = (payload as Record<string, unknown>).serpapi_pagination
  if (typeof pagination !== 'object' || pagination === null) return null
  const token = (pagination as Record<string, unknown>).next_page_token
  return typeof token === 'string' && token ? token : null
}

export function extractDataId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const parameters = (payload as Record<string, unknown>).search_parameters
  if (typeof parameters !== 'object' || parameters === null) return null
  const dataId = (parameters as Record<string, unknown>).data_id
  return typeof dataId === 'string' && dataId ? dataId : null
}

/**
 * A page requested without a `next_page_token` is the first page of a run.
 * This is read from the stored request rather than inferred from timing,
 * because two runs seconds apart are still two runs.
 */
function isFirstPageOfRun(request: unknown): boolean {
  if (typeof request !== 'string') return false
  return !request.includes('next_page_token=')
}

/**
 * Identity for a single review. `review_id` is Google's own and is what makes
 * this reliable; the composite fallback exists only for a payload that lacks
 * it, and deliberately includes the text so two different reviews left on the
 * same day with the same rating are not collapsed into one.
 */
function reviewIdentity(raw: unknown, extracted: RetainedReview): string {
  const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  if (typeof item.review_id === 'string' && item.review_id) return `id:${item.review_id}`
  return `composite:${extracted.isoDate}|${extracted.rating}|${extracted.author ?? ''}|${extracted.text ?? ''}`
}

function rawReviews(payload: unknown): readonly unknown[] {
  if (typeof payload !== 'object' || payload === null) return []
  const reviews = (payload as Record<string, unknown>).reviews
  return Array.isArray(reviews) ? reviews : []
}

/**
 * Splits one listing's retained pages into retrieval runs, oldest run first.
 * A page that carried no `next_page_token` starts a new run.
 *
 * Pages retained before this decision are handled the same way: they were
 * written by the same paginator, so their first page has no token either.
 */
export function splitRetrievalRuns(pages: readonly RetainedReviewPage[]): readonly (readonly RetainedReviewPage[])[] {
  const ordered = [...pages].sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt))
  const runs: RetainedReviewPage[][] = []
  for (const page of ordered) {
    // A continuation page with no run to continue (truncated or reordered
    // evidence) opens its own run rather than being dropped — retained
    // evidence is never discarded because its neighbours are missing.
    if (isFirstPageOfRun(page.request) || runs.length === 0) runs.push([page])
    else runs[runs.length - 1].push(page)
  }
  return runs
}

/**
 * The most recent complete retrieval run for one listing, or `null` if
 * nothing is retained for it. Costs nothing — it reads stored files only.
 */
export function readLatestRetainedRun(
  dataId: string,
  pages: readonly RetainedReviewPage[],
): RetainedReviewHistory | null {
  const forListing = pages.filter((page) => extractDataId(page.payload) === dataId)
  if (forListing.length === 0) return null

  const runs = splitRetrievalRuns(forListing)
  const latest = runs[runs.length - 1]
  const lastPage = latest[latest.length - 1]

  // Within a run a duplicate should not occur, but SerpApi's pagination can
  // repeat a review across a page boundary, and a duplicate silently inflates
  // Factor 3 rather than failing loudly.
  const seen = new Set<string>()
  const reviews: RetainedReview[] = []
  for (const page of latest) {
    const raws = rawReviews(page.payload)
    const extracted = extractReviews(page.payload)
    let extractedIndex = 0
    for (const raw of raws) {
      const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
      if (typeof item.iso_date !== 'string' || typeof item.rating !== 'number') continue
      const review = extracted[extractedIndex]
      extractedIndex += 1
      if (!review) continue
      const identity = reviewIdentity(raw, review)
      if (seen.has(identity)) continue
      seen.add(identity)
      reviews.push(review)
    }
  }

  return {
    dataId,
    retrievedAt: lastPage.retrievedAt,
    snapshotIds: latest.map((page) => page.id),
    pagesFetched: latest.length,
    paginationExhausted: extractNextPageToken(lastPage.payload) === null,
    reviews,
  }
}

/** Every listing with retained review evidence, keyed by `data_id`. */
export function readAllRetainedRuns(pages: readonly RetainedReviewPage[]): Record<string, RetainedReviewHistory> {
  const dataIds = new Set<string>()
  for (const page of pages) {
    const dataId = extractDataId(page.payload)
    if (dataId) dataIds.add(dataId)
  }
  const histories: Record<string, RetainedReviewHistory> = {}
  for (const dataId of dataIds) {
    const history = readLatestRetainedRun(dataId, pages)
    if (history) histories[dataId] = history
  }
  return histories
}
