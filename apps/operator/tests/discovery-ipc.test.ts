import { describe, expect, it } from 'vitest'
import { runRealDiscoverySearch } from '../electron/discovery-ipc'

function fakeAppendRawSnapshot(saved: unknown[]) {
  return (snapshot: unknown) => {
    saved.push(snapshot)
    return { id: 'raw_test_1', path: '/tmp/raw_test_1.json', payloadHash: 'hash-1' }
  }
}

describe('runRealDiscoverySearch', () => {
  it('executes one discovery request, stores the raw evidence, and returns sanitized candidates', async () => {
    const saved: unknown[] = []
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = new URL(requestUrl.toString())
      expect(url.searchParams.get('api_key')).toBe('real-key')
      expect(url.searchParams.get('q')).toBe('landscaping in Stamford, Connecticut')
      return new Response(JSON.stringify({
        local_results: [
          { title: 'Tuff Lawn', rating: 4.6, reviews: 314, type: 'Landscaper', data_id: 'abc123', address: '1 Main St, Stamford, CT', website: 'https://tufflawn.example', phone: '(203) 555-0100', gps_coordinates: { latitude: 41.0534, longitude: -73.5387 } },
          { title: 'No Website Landscaping', rating: 4.9, reviews: 40, type: 'Landscaper' },
        ],
      }), { status: 200 })
    }

    const result = await runRealDiscoverySearch({
      category: 'landscaping',
      city: 'Stamford, Connecticut',
      maxExamined: 10,
      apiKey: 'real-key',
      appendRawSnapshot: fakeAppendRawSnapshot(saved),
      fetchImpl,
      now: () => new Date('2026-08-07T18:00:00.000Z'),
    })

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.snapshotId).toBe('raw_test_1')
    expect(result.candidateCount).toBe(2)
    expect(result.fromCache).toBe(false)
    expect(result.candidates[0]).toMatchObject({ name: 'Tuff Lawn', rating: 4.6, reviewCount: 314, dataId: 'abc123', phone: '(203) 555-0100', coordinates: { latitude: 41.0534, longitude: -73.5387 } })
    expect(result.candidates[1]).toMatchObject({ name: 'No Website Landscaping', website: null, phone: null, coordinates: null })

    // The credential never reaches storage or the renderer.
    expect(saved).toHaveLength(1)
    expect(JSON.stringify(saved)).not.toContain('real-key')
    expect(JSON.stringify(result)).not.toContain('real-key')
    // DEC-077. Stored structured, so a later search can be matched for caching.
    expect(saved[0]).toMatchObject({ request: { category: 'landscaping', city: 'Stamford, Connecticut' } })
  })

  it('caps the returned candidate list at maxExamined even when SerpApi ignores num (DEC-077)', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({
        local_results: Array.from({ length: 20 }, (_, i) => ({ title: `Candidate ${i}`, rating: 4.5, reviews: 50 })),
      }), { status: 200 })

    const result = await runRealDiscoverySearch({
      category: 'plumber',
      city: 'Fairfield, Connecticut',
      maxExamined: 5,
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_test_cap', path: '/tmp/x.json', payloadHash: 'h' }),
      fetchImpl,
    })

    expect(result).toMatchObject({ status: 'completed', candidateCount: 5 })
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.candidates).toHaveLength(5)
  })

  it('uses a cached snapshot instead of a new request when one matches category and city (DEC-077)', async () => {
    let contacted = false
    const fetchImpl: typeof fetch = async () => { contacted = true; return new Response(JSON.stringify({ local_results: [] }), { status: 200 }) }
    const cachedPayload = { local_results: [{ title: 'Cached Plumbing Co', rating: 4.8, reviews: 100 }] }

    const result = await runRealDiscoverySearch({
      category: 'Plumber',
      city: 'Fairfield',
      maxExamined: 10,
      apiKey: 'real-key',
      appendRawSnapshot: () => { throw new Error('should not store a new snapshot when serving from cache') },
      findCachedSnapshot: (lookup) =>
        lookup.category.trim().toLowerCase() === 'plumber' && lookup.city.trim().toLowerCase() === 'fairfield'
          ? { id: 'raw_cached_1', retrievedAt: '2026-08-01T00:00:00.000Z', payload: cachedPayload }
          : null,
      fetchImpl,
    })

    expect(contacted).toBe(false)
    expect(result).toMatchObject({ status: 'completed', snapshotId: 'raw_cached_1', fromCache: true, candidateCount: 1 })
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.candidates[0]).toMatchObject({ name: 'Cached Plumbing Co' })
  })

  it('ignores the cache and spends a new request when forceRefresh is set (DEC-077)', async () => {
    let contacted = false
    const fetchImpl: typeof fetch = async () => { contacted = true; return new Response(JSON.stringify({ local_results: [] }), { status: 200 }) }

    const result = await runRealDiscoverySearch({
      category: 'plumber',
      city: 'Fairfield',
      maxExamined: 10,
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_fresh', path: '/tmp/x.json', payloadHash: 'h' }),
      findCachedSnapshot: () => ({ id: 'raw_cached_1', retrievedAt: '2026-08-01T00:00:00.000Z', payload: { local_results: [] } }),
      forceRefresh: true,
      fetchImpl,
    })

    expect(contacted).toBe(true)
    expect(result).toMatchObject({ status: 'completed', snapshotId: 'raw_fresh', fromCache: false })
  })

  it('caps the request page size at 20 regardless of a larger maxExamined', async () => {
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = new URL(requestUrl.toString())
      expect(url.searchParams.get('num')).toBe('20')
      return new Response(JSON.stringify({ local_results: [] }), { status: 200 })
    }

    await runRealDiscoverySearch({
      category: 'restaurants',
      city: 'Norwalk, Connecticut',
      maxExamined: 60,
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_test_2', path: '/tmp/x.json', payloadHash: 'h' }),
      fetchImpl,
    })
  })

  it('returns a failed result rather than throwing when the request fails, and stores nothing', async () => {
    const saved: unknown[] = []
    const fetchImpl: typeof fetch = async () => new Response('Server error', { status: 500 })

    const result = await runRealDiscoverySearch({
      category: 'plumbing',
      city: 'Stamford, Connecticut',
      maxExamined: 5,
      apiKey: 'real-key',
      appendRawSnapshot: fakeAppendRawSnapshot(saved),
      fetchImpl,
    })

    expect(result).toMatchObject({ status: 'failed', reason: 'discovery_request_failed' })
    expect(saved).toHaveLength(0)
  })

  it('never contacts the network for missing required fields', async () => {
    let contacted = false
    const fetchImpl: typeof fetch = async () => { contacted = true; return new Response('{}', { status: 200 }) }

    await expect(runRealDiscoverySearch({
      category: '',
      city: 'Stamford, Connecticut',
      maxExamined: 5,
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'x', path: 'x', payloadHash: 'x' }),
      fetchImpl,
    })).rejects.toThrow('category is required')
    expect(contacted).toBe(false)

    await expect(runRealDiscoverySearch({
      category: 'plumbing',
      city: 'Stamford, Connecticut',
      maxExamined: 5,
      apiKey: '',
      appendRawSnapshot: () => ({ id: 'x', path: 'x', payloadHash: 'x' }),
      fetchImpl,
    })).rejects.toThrow('SerpApi key is required')
    expect(contacted).toBe(false)
  })

  it('handles a payload with no local_results as zero candidates, not an error', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ error: 'Google Maps hasn\'t returned any results' }), { status: 200 })

    const result = await runRealDiscoverySearch({
      category: 'blacksmith',
      city: 'Stamford, Connecticut',
      maxExamined: 5,
      apiKey: 'real-key',
      appendRawSnapshot: () => ({ id: 'raw_test_3', path: 'x', payloadHash: 'x' }),
      fetchImpl,
    })

    expect(result).toMatchObject({ status: 'completed', candidateCount: 0, candidates: [] })
  })
})
