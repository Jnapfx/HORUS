import { describe, expect, it } from 'vitest'
import { runWebOpportunityMeasurement } from '../electron/web-opportunity-ipc'

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
