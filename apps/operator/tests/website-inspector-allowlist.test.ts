import { describe, expect, it } from 'vitest'
import { inspectPublicWebsiteReadOnly, WebsiteInspectionRejected } from '../electron/agent/website-inspector'

/**
 * DEC-127. The `isHostnameAllowed` option `inspect_public_website_readonly`
 * gained to close SECURITY_REVIEW.md finding F4. `evidence-mcp-server.ts` is
 * where this is actually wired to a per-task allowlist; these tests exercise
 * the enforcement point itself, independent of that wiring.
 */

function scriptedFetch(steps: Array<{ status: number; location?: string; body?: string }>) {
  let index = 0
  const impl = (async () => {
    const step = steps[Math.min(index, steps.length - 1)]
    index += 1
    const headers = new Headers()
    if (step.location) headers.set('location', step.location)
    return new Response(step.body ?? 'ok', { status: step.status, headers })
  }) as unknown as typeof fetch
  return impl
}

describe('DEC-127 — inspect_public_website_readonly respects an hostname allowlist', () => {
  it('is unaffected when no allowlist checker is supplied (existing callers/tests)', async () => {
    const fetchImpl = scriptedFetch([{ status: 200, body: 'ok' }])
    const result = await inspectPublicWebsiteReadOnly('https://example.com/', { fetchImpl })
    expect(result.statusCode).toBe(200)
  })

  it('allows a requested URL whose hostname the checker approves', async () => {
    const fetchImpl = scriptedFetch([{ status: 200, body: 'ok' }])
    const result = await inspectPublicWebsiteReadOnly('https://example.com/', {
      fetchImpl,
      isHostnameAllowed: (hostname) => hostname === 'example.com',
    })
    expect(result.statusCode).toBe(200)
  })

  it('rejects a requested URL whose hostname the checker does not approve, before any request is meaningfully used', async () => {
    const fetchImpl = scriptedFetch([{ status: 200, body: 'ok' }])
    await expect(
      inspectPublicWebsiteReadOnly('https://attacker.example/?d=leak', {
        fetchImpl,
        isHostnameAllowed: (hostname) => hostname === 'example.com',
      }),
    ).rejects.toThrow(WebsiteInspectionRejected)
  })

  it('rejects a redirect to a hostname the checker does not approve, even though the entry hostname was approved', async () => {
    // The F4-adjacent case this must not miss: a legitimate business URL that
    // redirects somewhere the task's own evidence never named.
    const fetchImpl = scriptedFetch([{ status: 302, location: 'https://attacker.example/exfiltrate' }])
    await expect(
      inspectPublicWebsiteReadOnly('https://example.com/', {
        fetchImpl,
        isHostnameAllowed: (hostname) => hostname === 'example.com',
      }),
    ).rejects.toThrow(WebsiteInspectionRejected)
  })

  it('allows a legitimate same-registrable-domain redirect (example.com -> www.example.com)', async () => {
    const fetchImpl = scriptedFetch([
      { status: 301, location: 'https://www.example.com/' },
      { status: 200, body: 'home' },
    ])
    const result = await inspectPublicWebsiteReadOnly('https://example.com/', {
      fetchImpl,
      isHostnameAllowed: (hostname) => hostname === 'example.com' || hostname === 'www.example.com',
    })
    expect(result.url).toBe('https://www.example.com/')
  })
})
