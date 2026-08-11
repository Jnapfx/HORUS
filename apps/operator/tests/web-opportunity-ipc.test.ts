import { describe, expect, it } from 'vitest'
import { runWebOpportunityMeasurement } from '../electron/web-opportunity-ipc'
import { executePageSpeedMobile } from '../electron/integrations/pagespeed'

function pageSpeedPayload(interactiveMs: number) {
  return JSON.stringify({ lighthouseResult: { audits: { interactive: { numericValue: interactiveMs } } } })
}

describe('runWebOpportunityMeasurement', () => {
  it('measures real performance and the no-https indicator, and finds a tel: link on an https site', async () => {
    const saved: unknown[] = []
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = new URL(requestUrl.toString())
      if (url.hostname === 'www.googleapis.com') {
        expect(url.searchParams.get('key')).toBe('ps-key')
        expect(url.searchParams.get('strategy')).toBe('mobile')
        return new Response(pageSpeedPayload(6500), { status: 200 })
      }
      return new Response('<html><body><a href="tel:+12035551234">Call us</a></body></html>', { status: 200, headers: { 'content-type': 'text/html' } })
    }

    const result = await runWebOpportunityMeasurement({
      url: 'https://example-business.test/',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: (snapshot) => { saved.push(snapshot); return { id: `raw_${saved.length}`, path: 'x', payloadHash: 'h' } },
      fetchImpl,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    })

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.performance).toMatchObject({ status: 'measured', value: { timeToInteractiveSeconds: 6.5 } })
    expect(result.servesHttps).toMatchObject({ status: 'measured', value: true })
    expect(result.telLinkFound).toMatchObject({ status: 'measured', value: { found: true } })
    expect(saved).toHaveLength(2)
    expect(JSON.stringify(saved)).not.toContain('ps-key')
  })

  it('marks servesHttps false from the URL alone, with no network call, when the listed URL is http', async () => {
    let contacted = 0
    const fetchImpl: typeof fetch = async (requestUrl) => {
      contacted += 1
      const url = new URL(requestUrl.toString())
      // Only the PageSpeed call should ever fire; the site-fetch step must not run for a non-https URL.
      expect(url.hostname).toBe('www.googleapis.com')
      return new Response(pageSpeedPayload(3000), { status: 200 })
    }

    const result = await runWebOpportunityMeasurement({
      url: 'http://example-business.test/',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: () => ({ id: 'raw_1', path: 'x', payloadHash: 'h' }),
      fetchImpl,
    })

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.servesHttps).toMatchObject({ status: 'measured', value: false })
    expect(result.telLinkFound.status).toBe('unmeasured')
    expect(contacted).toBe(1)
  })

  it('keeps performance unmeasured, not failed, when PageSpeed errors, while still measuring servesHttps', async () => {
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = new URL(requestUrl.toString())
      if (url.hostname === 'www.googleapis.com') return new Response('quota exceeded', { status: 429 })
      return new Response('<html></html>', { status: 200 })
    }

    const result = await runWebOpportunityMeasurement({
      url: 'https://example-business.test/',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: () => ({ id: 'raw_1', path: 'x', payloadHash: 'h' }),
      fetchImpl,
    })

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.performance.status).toBe('unmeasured')
    expect(result.servesHttps).toMatchObject({ status: 'measured', value: true })
  })

  it('returns a failed result for an invalid URL rather than throwing', async () => {
    const result = await runWebOpportunityMeasurement({
      url: 'not a url',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: () => ({ id: 'x', path: 'x', payloadHash: 'x' }),
      fetchImpl: async () => new Response('{}', { status: 200 }),
    })
    expect(result).toMatchObject({ status: 'failed', reason: 'invalid_url' })
  })

  it('measures broken links from the same homepage fetch, no extra PageSpeed or evidence request (DEC-111)', async () => {
    const saved: unknown[] = []
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = new URL(requestUrl.toString())
      if (url.hostname === 'www.googleapis.com') return new Response(pageSpeedPayload(2000), { status: 200 })
      if (url.pathname === '/') {
        return new Response(
          '<html><body><a href="/broken-page">Broken</a><a href="/contact">Contact</a></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        )
      }
      if (url.pathname === '/broken-page') return new Response('not found', { status: 404 })
      return new Response('<html>ok</html>', { status: 200 })
    }

    const result = await runWebOpportunityMeasurement({
      url: 'https://example-business.test/',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: (snapshot) => { saved.push(snapshot); return { id: `raw_${saved.length}`, path: 'x', payloadHash: 'h' } },
      fetchImpl,
    })

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.brokenLinks).toEqual({
      checkedLinks: 2,
      brokenLinks: 1,
      contactPath: { status: 'verified-working' },
    })
    // Only the homepage fetch is stored as evidence (DEC-020) — the link
    // checks themselves are not separately persisted, same as the tel: check.
    expect(saved).toHaveLength(2)
  })

  it('leaves brokenLinks null when the site is not https, matching servesHttps/telLinkFound', async () => {
    const result = await runWebOpportunityMeasurement({
      url: 'http://example-business.test/',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: () => ({ id: 'raw_1', path: 'x', payloadHash: 'h' }),
      fetchImpl: async () => new Response(pageSpeedPayload(2000), { status: 200 }),
    })
    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.brokenLinks).toBeNull()
  })

  it('never contacts the network for a missing URL or key', async () => {
    let contacted = false
    const fetchImpl: typeof fetch = async () => { contacted = true; return new Response('{}', { status: 200 }) }

    await expect(runWebOpportunityMeasurement({
      url: '',
      pagespeedApiKey: 'ps-key',
      appendRawSnapshot: () => ({ id: 'x', path: 'x', payloadHash: 'x' }),
      fetchImpl,
    })).rejects.toThrow('URL is required')
    expect(contacted).toBe(false)

    await expect(runWebOpportunityMeasurement({
      url: 'https://example-business.test/',
      pagespeedApiKey: '',
      appendRawSnapshot: () => ({ id: 'x', path: 'x', payloadHash: 'x' }),
      fetchImpl,
    })).rejects.toThrow('PageSpeed API key is required')
    expect(contacted).toBe(false)
  })
})

/**
 * DEC-109. The check that would have caught DEC-097's premise being false.
 *
 * `assessMobileResponsiveness` reads `viewport`, `content-width` and
 * `tap-targets`. None of them is in the performance category, which is all
 * PageSpeed returns when no `category` is asked for — so the largest factor in
 * `web-opportunity-v2` came back `unmeasured` on the first real site it was
 * pointed at, while 19 unit tests passed against synthetic payloads that
 * contained the audits anyway.
 */
describe('the PageSpeed request asks for the categories the model reads (DEC-109)', () => {
  it('repeats category rather than joining it, and asks for more than performance', async () => {
    let executed: URL | null = null
    await executePageSpeedMobile({
      url: 'https://example.com/',
      apiKey: 'real-key',
      fetchImpl: async (requestUrl) => {
        executed = new URL(requestUrl.toString())
        return new Response(JSON.stringify({ lighthouseResult: { audits: {} } }), { status: 200 })
      },
      now: () => new Date('2026-08-09T00:00:00.000Z'),
    })

    const categories = executed!.searchParams.getAll('category')
    expect(categories).toContain('performance')
    // A joined value is silently ignored by the API, which is the failure
    // mode this asserts against: one parameter per category.
    expect(categories.every((value) => !value.includes(','))).toBe(true)
    // The three audits the model reads live outside the performance category.
    expect(categories.length).toBeGreaterThan(1)
  })

  it('keeps the API key out of the provenance URL while repeating category', async () => {
    const response = await executePageSpeedMobile({
      url: 'https://example.com/',
      apiKey: 'real-key',
      fetchImpl: async () => new Response(JSON.stringify({ lighthouseResult: { audits: {} } }), { status: 200 }),
      now: () => new Date('2026-08-09T00:00:00.000Z'),
    })
    expect(response.requestUrl).not.toContain('real-key')
    expect(new URL(response.requestUrl).searchParams.getAll('category').length).toBeGreaterThan(1)
  })
})
