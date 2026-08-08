import { describe, expect, it } from 'vitest'
import { inspectPublicWebsiteReadOnly, WebsiteInspectionRejected } from '../electron/agent/website-inspector'

/**
 * DEC-088. The two findings from the Phase 6 security review that were fixable
 * rather than merely documentable.
 *
 * Both were confirmed against the previous implementation before being fixed:
 * `redirect: 'follow'` meant fetch resolved the redirect chain itself and
 * re-validated nothing, and the size cap ran after `response.text()` had
 * already materialised the whole body.
 */

/** Builds a fetch that replays a scripted sequence of responses, one per hop. */
function scriptedFetch(steps: Array<{ status: number; location?: string; body?: string }>) {
  const requested: string[] = []
  let index = 0
  const impl = (async (url: string) => {
    requested.push(String(url))
    const step = steps[Math.min(index, steps.length - 1)]
    index += 1
    const headers = new Headers()
    if (step.location) headers.set('location', step.location)
    return new Response(step.body ?? 'ok', { status: step.status, headers })
  }) as unknown as typeof fetch
  return { impl, requested }
}

describe('DEC-088 — a redirect cannot escape the hostname denylist', () => {
  it('refuses a redirect from a public host to a private IP', async () => {
    // The attack this closes: a business URL drawn from evidence answers 302
    // and points the fetch at the operator's own network. Nothing in the
    // original code re-checked the destination.
    const { impl, requested } = scriptedFetch([
      { status: 302, location: 'https://10.0.0.5/admin' },
    ])
    await expect(inspectPublicWebsiteReadOnly('https://public.example.com/', { fetchImpl: impl }))
      .rejects.toThrow(WebsiteInspectionRejected)
    // The point: the private address was never requested.
    expect(requested).toEqual(['https://public.example.com/'])
  })

  it('refuses a redirect that downgrades to http', async () => {
    const { impl, requested } = scriptedFetch([
      { status: 301, location: 'http://public.example.com/' },
    ])
    await expect(inspectPublicWebsiteReadOnly('https://public.example.com/', { fetchImpl: impl }))
      .rejects.toThrow(/https/i)
    expect(requested).toHaveLength(1)
  })

  it.each(['https://localhost/', 'https://127.0.0.1/', 'https://192.168.1.1/', 'https://169.254.169.254/'])(
    'refuses a redirect to %s',
    async (target) => {
      const { impl } = scriptedFetch([{ status: 307, location: target }])
      await expect(inspectPublicWebsiteReadOnly('https://public.example.com/', { fetchImpl: impl }))
        .rejects.toThrow(WebsiteInspectionRejected)
    },
  )

  it('refuses to follow an unbounded redirect loop', async () => {
    const { impl, requested } = scriptedFetch([
      { status: 302, location: 'https://a.example.com/next' },
    ])
    await expect(inspectPublicWebsiteReadOnly('https://a.example.com/', { fetchImpl: impl }))
      .rejects.toThrow(/exceeded 5 redirects/)
    expect(requested.length).toBeLessThanOrEqual(6)
  })
})

describe('DEC-088 — a legitimate redirect still works, and is visible', () => {
  it('follows a public https redirect and reports the final hop', async () => {
    // The overwhelmingly common real case: example.com -> www.example.com.
    const { impl, requested } = scriptedFetch([
      { status: 301, location: 'https://www.example.com/' },
      { status: 200, body: '<html>home</html>' },
    ])
    const result = await inspectPublicWebsiteReadOnly('https://example.com/', { fetchImpl: impl })

    expect(requested).toEqual(['https://example.com/', 'https://www.example.com/'])
    // Previously this reported the requested URL no matter where it ended up,
    // so neither the analyst nor the operator could see the real destination.
    expect(result.url).toBe('https://www.example.com/')
    expect(result.redirectChain).toEqual(['https://www.example.com/'])
    expect(result.statusCode).toBe(200)
  })

  it('resolves a relative Location against the current hop', async () => {
    const { impl, requested } = scriptedFetch([
      { status: 302, location: '/landing' },
      { status: 200, body: 'ok' },
    ])
    const result = await inspectPublicWebsiteReadOnly('https://example.com/start', { fetchImpl: impl })
    expect(requested[1]).toBe('https://example.com/landing')
    expect(result.url).toBe('https://example.com/landing')
  })

  it('reports an empty chain when the first URL answers directly', async () => {
    const { impl } = scriptedFetch([{ status: 200, body: 'ok' }])
    const result = await inspectPublicWebsiteReadOnly('https://example.com/', { fetchImpl: impl })
    expect(result.redirectChain).toEqual([])
    expect(result.url).toBe('https://example.com/')
  })
})

describe('DEC-088 — the size cap bounds what is read, not just what is returned', () => {
  it('stops pulling from the stream once the cap is reached', async () => {
    // A counting stream: if the cap only applied after buffering, every chunk
    // would be pulled. The assertion is on how much was *read*, which is the
    // property the doc comment claimed and the old code did not have.
    let chunksPulled = 0
    const chunk = new TextEncoder().encode('A'.repeat(1000))
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksPulled += 1
        if (chunksPulled > 10_000) {
          controller.close()
          return
        }
        controller.enqueue(chunk)
      },
    })
    const impl = (async () => new Response(stream, { status: 200 })) as unknown as typeof fetch

    const result = await inspectPublicWebsiteReadOnly('https://example.com/', {
      fetchImpl: impl,
      maxBytes: 5000,
    })

    expect(result.textExcerpt).toHaveLength(5000)
    expect(result.truncated).toBe(true)
    // 5 chunks of 1000 to reach the cap, plus at most a couple for the
    // stream's own buffering and the end-of-stream probe. Far from 10,000.
    expect(chunksPulled).toBeLessThan(20)
  })

  it('returns a short body whole and does not mark it truncated', async () => {
    const impl = (async () => new Response('short', { status: 200 })) as unknown as typeof fetch
    const result = await inspectPublicWebsiteReadOnly('https://example.com/', { fetchImpl: impl, maxBytes: 5000 })
    expect(result.textExcerpt).toBe('short')
    expect(result.truncated).toBe(false)
  })
})
