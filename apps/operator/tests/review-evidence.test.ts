import { describe, expect, it } from 'vitest'
import { readAllRetainedRuns, readLatestRetainedRun, splitRetrievalRuns } from '../electron/review-evidence'
import { summarizeReviewHistory } from '../src/domain/review-history'
import type { RetainedReviewPage } from '../electron/review-evidence'

const DATA_ID = '0x89c2a1e6b7decf69:0x1baebae088a46f4'

function page(input: {
  id: string
  retrievedAt: string
  dataId?: string
  pageToken?: string
  nextToken?: string | null
  reviews: Array<{ iso_date: string; rating: number; review_id?: string; snippet?: string; user?: { name: string } }>
}): RetainedReviewPage {
  const base = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${encodeURIComponent(input.dataId ?? DATA_ID)}&hl=en&sort_by=newestFirst`
  return {
    id: input.id,
    retrievedAt: input.retrievedAt,
    request: input.pageToken ? `${base}&next_page_token=${input.pageToken}&api_key=REDACTED_SERPAPI_KEY` : `${base}&api_key=REDACTED_SERPAPI_KEY`,
    payload: {
      search_parameters: { data_id: input.dataId ?? DATA_ID },
      reviews: input.reviews,
      serpapi_pagination: input.nextToken ? { next_page_token: input.nextToken } : {},
    },
  }
}

/** One run: a first page plus a continuation that ends the history. */
function run(prefix: string, at: string) {
  return [
    page({ id: `${prefix}-1`, retrievedAt: at, nextToken: 'tok', reviews: [
      { iso_date: '2026-08-01T00:00:00Z', rating: 5, review_id: 'r1' },
      { iso_date: '2026-07-20T00:00:00Z', rating: 4, review_id: 'r2' },
    ] }),
    page({ id: `${prefix}-2`, retrievedAt: at, pageToken: 'tok', nextToken: null, reviews: [
      { iso_date: '2026-07-01T00:00:00Z', rating: 5, review_id: 'r3' },
    ] }),
  ]
}

describe('splitRetrievalRuns', () => {
  it('starts a new run at every page requested without a next_page_token', () => {
    const pages = [...run('a', '2026-08-09T18:52:00.000Z'), ...run('b', '2026-08-09T19:15:40.000Z')]
    const runs = splitRetrievalRuns(pages)
    expect(runs.map((r) => r.map((p) => p.id))).toEqual([['a-1', 'a-2'], ['b-1', 'b-2']])
  })

  it('orders by retrieval time rather than trusting the order it was handed', () => {
    const pages = [...run('b', '2026-08-09T19:15:40.000Z'), ...run('a', '2026-08-09T18:52:00.000Z')]
    expect(splitRetrievalRuns(pages).map((r) => r[0].id)).toEqual(['a-1', 'b-1'])
  })

  it('opens a run for a continuation page with nothing to continue rather than discarding retained evidence', () => {
    const orphan = page({ id: 'orphan', retrievedAt: '2026-08-09T18:00:00.000Z', pageToken: 'tok', nextToken: null, reviews: [] })
    expect(splitRetrievalRuns([orphan]).map((r) => r.map((p) => p.id))).toEqual([['orphan']])
  })
})

describe('readLatestRetainedRun', () => {
  it('replays the most recent run only, so a review retrieved five times is counted once', () => {
    // The shape found in the operator's own store: the same listing retrieved
    // five separate times, each run writing its pages beside the last.
    const pages = [
      ...run('a', '2026-08-09T18:52:00.000Z'),
      ...run('b', '2026-08-09T18:58:57.000Z'),
      ...run('c', '2026-08-09T19:00:13.000Z'),
      ...run('d', '2026-08-09T19:01:06.000Z'),
      ...run('e', '2026-08-09T19:15:40.000Z'),
    ]
    const history = readLatestRetainedRun(DATA_ID, pages)
    expect(history).not.toBeNull()
    expect(history!.reviews).toHaveLength(3)
    expect(history!.pagesFetched).toBe(2)
    expect(history!.snapshotIds).toEqual(['e-1', 'e-2'])
    // Charter 9.7: time-based factors compute against the stored retrieval
    // timestamp of the evidence they are measuring, which is this run's.
    expect(history!.retrievedAt).toBe('2026-08-09T19:15:40.000Z')
    expect(history!.paginationExhausted).toBe(true)
  })

  /**
   * The defect this decision exists for, stated as arithmetic rather than as
   * a count. Concatenating the runs inflates the trailing-90-day count, which
   * is reputation Factor 3's input — and it inflates upward, the direction
   * that flatters a prospect.
   */
  it('does not inflate the trailing-window counts the way concatenating every retained page did', () => {
    const pages = [...run('a', '2026-08-09T18:52:00.000Z'), ...run('b', '2026-08-09T19:15:40.000Z'), ...run('c', '2026-08-09T19:16:00.000Z')]
    const history = readLatestRetainedRun(DATA_ID, pages)!

    const correct = summarizeReviewHistory({
      reviews: history.reviews,
      retrievedAt: history.retrievedAt,
      paginationExhausted: history.paginationExhausted,
    })
    const concatenated = summarizeReviewHistory({
      reviews: pages.flatMap((p) => (p.payload as { reviews: { iso_date: string; rating: number }[] }).reviews.map((r) => ({ isoDate: r.iso_date, rating: r.rating }))),
      retrievedAt: history.retrievedAt,
      paginationExhausted: history.paginationExhausted,
    })

    expect(correct.reviewsLast90Days.count).toBe(3)
    expect(concatenated.reviewsLast90Days.count).toBe(9)
  })

  it('collapses a review repeated across a page boundary, by Google review_id', () => {
    const pages = [
      page({ id: 'p1', retrievedAt: '2026-08-09T19:00:00.000Z', nextToken: 'tok', reviews: [
        { iso_date: '2026-08-01T00:00:00Z', rating: 5, review_id: 'r1' },
      ] }),
      page({ id: 'p2', retrievedAt: '2026-08-09T19:00:01.000Z', pageToken: 'tok', nextToken: null, reviews: [
        { iso_date: '2026-08-01T00:00:00Z', rating: 5, review_id: 'r1' },
        { iso_date: '2026-07-01T00:00:00Z', rating: 3, review_id: 'r2' },
      ] }),
    ]
    expect(readLatestRetainedRun(DATA_ID, pages)!.reviews).toHaveLength(2)
  })

  it('keeps two genuinely different reviews that share a date and rating when no review_id is present', () => {
    const pages = [
      page({ id: 'p1', retrievedAt: '2026-08-09T19:00:00.000Z', nextToken: null, reviews: [
        { iso_date: '2026-08-01T00:00:00Z', rating: 5, snippet: 'great food', user: { name: 'Ana' } },
        { iso_date: '2026-08-01T00:00:00Z', rating: 5, snippet: 'lovely staff', user: { name: 'Ben' } },
      ] }),
    ]
    expect(readLatestRetainedRun(DATA_ID, pages)!.reviews).toHaveLength(2)
  })

  it('reports a run that stopped at the page cap as not exhausted', () => {
    const pages = [page({ id: 'p1', retrievedAt: '2026-08-09T19:00:00.000Z', nextToken: 'more', reviews: [{ iso_date: '2026-08-01T00:00:00Z', rating: 5, review_id: 'r1' }] })]
    expect(readLatestRetainedRun(DATA_ID, pages)!.paginationExhausted).toBe(false)
  })

  it('returns null for a listing with nothing retained, rather than an empty history', () => {
    expect(readLatestRetainedRun('0xdeadbeef:0x0', run('a', '2026-08-09T18:52:00.000Z'))).toBeNull()
  })

  it('never mixes one listing’s pages into another’s', () => {
    const pages = [
      ...run('a', '2026-08-09T18:52:00.000Z'),
      page({ id: 'other', retrievedAt: '2026-08-09T19:00:00.000Z', dataId: '0xother:0x1', nextToken: null, reviews: [
        { iso_date: '2026-08-05T00:00:00Z', rating: 1, review_id: 'x1' },
      ] }),
    ]
    expect(readLatestRetainedRun(DATA_ID, pages)!.reviews.map((r) => r.rating)).toEqual([5, 4, 5])
    expect(readLatestRetainedRun('0xother:0x1', pages)!.reviews.map((r) => r.rating)).toEqual([1])
  })
})

describe('readAllRetainedRuns', () => {
  it('keys every listing with retained evidence by its data_id', () => {
    const pages = [
      ...run('a', '2026-08-09T18:52:00.000Z'),
      page({ id: 'other', retrievedAt: '2026-08-09T19:00:00.000Z', dataId: '0xother:0x1', nextToken: null, reviews: [
        { iso_date: '2026-08-05T00:00:00Z', rating: 1, review_id: 'x1' },
      ] }),
    ]
    const all = readAllRetainedRuns(pages)
    expect(Object.keys(all).sort()).toEqual([DATA_ID, '0xother:0x1'].sort())
    expect(all[DATA_ID].reviews).toHaveLength(3)
  })

  it('carries the review text, author and owner reply DEC-105 needs', () => {
    const pages = [page({ id: 'p1', retrievedAt: '2026-08-09T19:00:00.000Z', nextToken: null, reviews: [
      { iso_date: '2026-08-01T00:00:00Z', rating: 1, review_id: 'r1', snippet: 'took my money', user: { name: 'Ana' } },
    ] })]
    expect(readAllRetainedRuns(pages)[DATA_ID].reviews[0]).toEqual({
      isoDate: '2026-08-01T00:00:00Z',
      rating: 1,
      text: 'took my money',
      author: 'Ana',
      ownerResponded: false,
    })
  })
})
