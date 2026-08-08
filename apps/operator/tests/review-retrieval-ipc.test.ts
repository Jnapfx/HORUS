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
    expect(result.reviews).toEqual([{ isoDate: '2026-08-01T00:00:00Z', rating: 5 }])
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
