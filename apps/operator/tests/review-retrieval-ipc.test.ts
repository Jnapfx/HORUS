import { describe, expect, it } from 'vitest'
import { runReviewHistoryRetrieval } from '../electron/review-retrieval-ipc'

function page(reviews: Array<{ iso_date: string; rating: number }>, nextToken: string | null) {
  return JSON.stringify({ reviews, serpapi_pagination: nextToken ? { next_page_token: nextToken } : {} })
}

describe('runReviewHistoryRetrieval', () => {
  it('stops naturally when a page has no next_page_token, and reports pagination as exhausted', async () => {
    const saved: unknown[] = []
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = new URL(requestUrl.toString())
      expect(url.searchParams.get('engine')).toBe('google_maps_reviews')
      expect(url.searchParams.get('sort_by')).toBe('newestFirst')
      expect(url.searchParams.get('api_key')).toBe('real-key')
      return new Response(page([{ iso_date: '2026-08-01T00:00:00Z', rating: 5 }], null), { status: 200 })
    }

    const result = await runReviewHistoryRetrieval({
      dataId: 'data-id-1',
      apiKey: 'real-key',
      appendRawSnapshot: (snapshot) => { saved.push(snapshot); return { id: 'raw_r1', path: 'x', payloadHash: 'h' } },
      fetchImpl,
      now: () => new Date('2026-08-07T00:00:00.000Z'),
    })

    expect(result).toMatchObject({ status: 'completed', pagesFetched: 1, paginationExhausted: true })
    if (result.status !== 'completed') throw new Error('unreachable')
    // DEC-105 carries the review text through, so the operator can actually
    // read what charter 9.5's gates ask them to judge. The deep-equality
    // assertion is kept rather than loosened: it is what caught the change.
    expect(result.reviews).toEqual([
      { isoDate: '2026-08-01T00:00:00Z', rating: 5, text: null, author: null, ownerResponded: false },
    ])
    expect(saved).toHaveLength(1)
    expect(JSON.stringify(saved)).not.toContain('real-key')
  })

  it('follows next_page_token across pages and stops at the page cap, reporting partial pagination', async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async (requestUrl) => {
      calls += 1
      const url = new URL(requestUrl.toString())
      if (calls === 1) {
        expect(url.searchParams.has('next_page_token')).toBe(false)
        return new Response(page([{ iso_date: '2026-08-01T00:00:00Z', rating: 5 }], 'token-2'), { status: 200 })
      }
      expect(url.searchParams.get('next_page_token')).toBe('token-2')
      return new Response(page([{ iso_date: '2026-07-01T00:00:00Z', rating: 4 }], 'token-3'), { status: 200 })
    }

    const result = await runReviewHistoryRetrieval({
      dataId: 'data-id-1',
      apiKey: 'real-key',
      maxPages: 2,
      appendRawSnapshot: () => ({ id: `raw_${calls}`, path: 'x', payloadHash: 'h' }),
      fetchImpl,
    })

    expect(result).toMatchObject({ status: 'completed', pagesFetched: 2, paginationExhausted: false })
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.reviews).toHaveLength(2)
  })

  it('returns a failed result rather than throwing when a page request fails, keeping snapshots already stored', async () => {
    let calls = 0
    const saved: unknown[] = []
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      if (calls === 1) return new Response(page([{ iso_date: '2026-08-01T00:00:00Z', rating: 5 }], 'token-2'), { status: 200 })
      return new Response('Server error', { status: 500 })
    }

    const result = await runReviewHistoryRetrieval({
      dataId: 'data-id-1',
      apiKey: 'real-key',
      appendRawSnapshot: (snapshot) => { saved.push(snapshot); return { id: `raw_${calls}`, path: 'x', payloadHash: 'h' } },
      fetchImpl,
    })

    expect(result).toMatchObject({ status: 'failed', reason: 'review_history_request_failed' })
    // The first page's evidence, already retrieved, is not discarded by a later page's failure.
    expect(saved).toHaveLength(1)
  })

  it('never contacts the network for a missing data_id or key', async () => {
    let contacted = false
    const fetchImpl: typeof fetch = async () => { contacted = true; return new Response('{}', { status: 200 }) }

    await expect(runReviewHistoryRetrieval({
      dataId: '',
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'x', path: 'x', payloadHash: 'x' }),
      fetchImpl,
    })).rejects.toThrow('data_id is required')
    expect(contacted).toBe(false)
  })
})

describe('DEC-105 — the review text reaches the operator', () => {
  it('carries the words, the author, and whether the owner replied', async () => {
    // G4 asks about a pattern of *unresolved* complaints, so an owner reply is
    // part of the evidence rather than decoration.
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      reviews: [{
        iso_date: '2026-08-01T00:00:00Z',
        rating: 2,
        snippet: 'They never came back to finish the job.',
        user: { name: 'A. Customer' },
        response: { snippet: 'Sorry, we will call you.' },
      }],
      serpapi_pagination: {},
    }), { status: 200 })

    const result = await runReviewHistoryRetrieval({
      dataId: 'x', apiKey: 'real-key', appendRawSnapshot: () => ({ id: 'r', path: 'p', payloadHash: 'h' }), fetchImpl,
    })

    expect(result.status).toBe('completed')
    expect(result.status === 'completed' && result.reviews[0]).toEqual({
      isoDate: '2026-08-01T00:00:00Z',
      rating: 2,
      text: 'They never came back to finish the job.',
      author: 'A. Customer',
      ownerResponded: true,
    })
  })

  it('reports a rating-only review as having no text rather than inventing one', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      reviews: [{ iso_date: '2026-08-01T00:00:00Z', rating: 5 }],
      serpapi_pagination: {},
    }), { status: 200 })
    const result = await runReviewHistoryRetrieval({
      dataId: 'x', apiKey: 'real-key', appendRawSnapshot: () => ({ id: 'r', path: 'p', payloadHash: 'h' }), fetchImpl,
    })
    expect(result.status === 'completed' && result.reviews[0].text).toBeNull()
    expect(result.status === 'completed' && result.reviews[0].ownerResponded).toBe(false)
  })
})

/**
 * DEC-108. The cache DEC-077 gave discovery, applied to the expensive half of
 * retrieval. In the operator's own store, 46 retained review pages held only
 * 23 distinct ones: 23 SerpApi credits, 9% of a monthly free tier, spent
 * re-retrieving reviews that were already on disk (DEC-020, DEC-032).
 */
describe('runReviewHistoryRetrieval — retained evidence (DEC-108)', () => {
  const retainedPages = [
    {
      id: 'raw_cached_1',
      retrievedAt: '2026-08-09T19:15:40.000Z',
      request: 'https://serpapi.com/search.json?engine=google_maps_reviews&data_id=cached-id&hl=en&sort_by=newestFirst&api_key=REDACTED_SERPAPI_KEY',
      payload: {
        search_parameters: { data_id: 'cached-id' },
        reviews: [{ iso_date: '2026-08-01T00:00:00Z', rating: 5, review_id: 'r1', snippet: 'good', user: { name: 'Ana' } }],
        serpapi_pagination: {},
      },
    },
  ]

  const refuseToSpend: typeof fetch = async () => {
    throw new Error('a SerpApi request was made for reviews already retained')
  }

  it('serves retained pages without making a request or storing a new snapshot', async () => {
    const saved: unknown[] = []
    const result = await runReviewHistoryRetrieval({
      dataId: 'cached-id',
      apiKey: 'real-key',
      appendRawSnapshot: (snapshot) => { saved.push(snapshot); return { id: 'raw_new', path: 'x', payloadHash: 'h' } },
      fetchImpl: refuseToSpend,
      retainedPages,
    })

    expect(result).toMatchObject({
      status: 'completed',
      fromCache: true,
      retrievedAt: '2026-08-09T19:15:40.000Z',
      pagesFetched: 1,
      paginationExhausted: true,
      snapshotIds: ['raw_cached_1'],
    })
    // Evidence is immutable and is not rewritten by being read back.
    expect(saved).toEqual([])
  })

  it('does not require a SerpApi key to read evidence it already paid for', async () => {
    const result = await runReviewHistoryRetrieval({
      dataId: 'cached-id',
      apiKey: '',
      appendRawSnapshot: () => { throw new Error('should not store') },
      fetchImpl: refuseToSpend,
      retainedPages,
    })
    expect(result).toMatchObject({ status: 'completed', fromCache: true })
  })

  it('spends when the operator explicitly forces a fresh retrieval', async () => {
    const result = await runReviewHistoryRetrieval({
      dataId: 'cached-id',
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_new', path: 'x', payloadHash: 'h' }),
      fetchImpl: async () => new Response(page([{ iso_date: '2026-08-08T00:00:00Z', rating: 4 }], null), { status: 200 }),
      retainedPages,
      forceRefresh: true,
    })
    expect(result).toMatchObject({ status: 'completed', fromCache: false, pagesFetched: 1 })
  })

  it('spends for a listing that has no retained evidence, even when other listings do', async () => {
    let requests = 0
    const result = await runReviewHistoryRetrieval({
      dataId: 'never-retrieved',
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_new', path: 'x', payloadHash: 'h' }),
      fetchImpl: async () => { requests += 1; return new Response(page([{ iso_date: '2026-08-08T00:00:00Z', rating: 4 }], null), { status: 200 }) },
      retainedPages,
    })
    expect(requests).toBe(1)
    expect(result).toMatchObject({ status: 'completed', fromCache: false })
  })

  it('still spends when no retained evidence is supplied at all', async () => {
    let requests = 0
    const result = await runReviewHistoryRetrieval({
      dataId: 'cached-id',
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_new', path: 'x', payloadHash: 'h' }),
      fetchImpl: async () => { requests += 1; return new Response(page([{ iso_date: '2026-08-08T00:00:00Z', rating: 4 }], null), { status: 200 }) },
    })
    expect(requests).toBe(1)
    expect(result).toMatchObject({ status: 'completed', fromCache: false })
  })
})
