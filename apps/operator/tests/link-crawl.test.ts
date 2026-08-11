import { describe, expect, it } from 'vitest'
import { checkBrokenLinks } from '../electron/link-crawl'

/**
 * DEC-111. `checkBrokenLinks` is what makes `web-opportunity-v2`'s
 * `broken_elements` factor measurable for the first time — DEC-072 left it
 * `unmeasured`, stating a full link crawl was out of scope. This is that
 * crawl, bounded to same-origin https links only.
 */
describe('checkBrokenLinks', () => {
  it('returns null when the homepage has no same-origin https link to check', async () => {
    const result = await checkBrokenLinks(
      'https://example-business.test/',
      '<html><body><a href="tel:+12035551234">Call</a><a href="mailto:x@y.test">Email</a></body></html>',
      async () => new Response('unused', { status: 200 }),
    )
    expect(result).toBeNull()
  })

  it('checks same-origin links found on the page and counts real failures', async () => {
    const html = `<html><body>
      <a href="/services">Services</a>
      <a href="/gone">Gone</a>
      <a href="https://example-business.test/contact">Contact</a>
      <a href="https://other-site.test/steal">Off-site, must be skipped</a>
    </body></html>`

    const requested: string[] = []
    const fetchImpl: typeof fetch = async (requestUrl) => {
      const url = requestUrl.toString()
      requested.push(url)
      if (url.includes('/gone')) return new Response('not found', { status: 404 })
      return new Response('<html>ok</html>', { status: 200 })
    }

    const result = await checkBrokenLinks('https://example-business.test/', html, fetchImpl)

    expect(result).not.toBeNull()
    expect(result!.checkedLinks).toBe(3) // /services, /gone, /contact — off-site link excluded
    expect(result!.brokenLinks).toBe(1) // only /gone returned 404
    expect(result!.contactPath).toEqual({ status: 'verified-working' })
    expect(requested.every((url) => url.startsWith('https://example-business.test/'))).toBe(true)
  })

  it('reports a broken contact path when the contact link itself 404s', async () => {
    const html = '<a href="/contact-us">Contact us</a>'
    const result = await checkBrokenLinks(
      'https://example-business.test/',
      html,
      async () => new Response('not found', { status: 404 }),
    )
    expect(result).toEqual({
      checkedLinks: 1,
      brokenLinks: 1,
      contactPath: { status: 'verified-broken', verification: 'executed' },
    })
  })

  it('counts a network failure (not just an HTTP error status) as broken', async () => {
    const html = '<a href="/down">Down</a>'
    const result = await checkBrokenLinks(
      'https://example-business.test/',
      html,
      async () => { throw new Error('connection reset') },
    )
    expect(result).toEqual({
      checkedLinks: 1,
      brokenLinks: 1,
      contactPath: { status: 'unmeasured', reason: expect.any(String) },
    })
  })

  it('never checks more than 5 links even when the page lists more', async () => {
    const links = Array.from({ length: 12 }, (_, i) => `<a href="/page-${i}">Page ${i}</a>`).join('\n')
    let calls = 0
    await checkBrokenLinks('https://example-business.test/', links, async () => { calls += 1; return new Response('ok', { status: 200 }) })
    expect(calls).toBe(5)
  })

  it('does not penalize a same-origin http link — skips it rather than counting it broken (HORUS is https-only, not the business\'s fault)', async () => {
    const html = '<a href="http://example-business.test/insecure-page">Insecure</a>'
    const result = await checkBrokenLinks('https://example-business.test/', html, async () => new Response('unused', { status: 200 }))
    expect(result).toBeNull()
  })
})
