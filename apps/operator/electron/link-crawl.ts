/**
 * DEC-111. Measures `web-opportunity-v2`'s `broken_elements` factor, which
 * has read `unmeasured` on every candidate ever scored since DEC-072
 * explicitly declined "a full link crawl."
 *
 * That earlier decision reasoned that broken-link detection needs either
 * rendering a page or judgment a regex cannot honestly claim. That does not
 * hold for the narrow claim this module makes: whether a same-origin link
 * the page itself advertises returns an HTTP error is an objective,
 * mechanical fact, not a judgment call.
 *
 * Safety boundary, matching `SECURITY_REVIEW.md` finding F4's concern about
 * an agent being steered off-site by hostile page or review text: this
 * module only ever follows a link that (a) was found in the business's own
 * homepage HTML, fetched from a URL the operator already trusts, and (b)
 * resolves to the exact same hostname as that homepage. A same-origin
 * `http:` link, or any link to a different host, is skipped — never
 * fetched, and never counted as broken (an off-site or plain-http link is
 * not a defect in the business's own https site, and HORUS's own read-only
 * inspector is https-only besides). There is no recursion: only links found
 * directly on the homepage are checked, never links found on a checked
 * page. No agent, no LLM, and no third-party text is ever used to choose
 * what URL to fetch next.
 */

import { inspectPublicWebsiteReadOnly } from './agent/website-inspector.js'

const MAX_LINKS_CHECKED = 5
const PER_LINK_TIMEOUT_MS = 8_000

function extractSameOriginLinks(html: string, base: URL): readonly URL[] {
  const hrefPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi
  const seen = new Set<string>()
  const links: URL[] = []
  let match = hrefPattern.exec(html)
  while (match !== null) {
    try {
      const resolved = new URL(match[1], base)
      if (resolved.protocol === 'https:' && resolved.hostname === base.hostname && !seen.has(resolved.toString())) {
        seen.add(resolved.toString())
        links.push(resolved)
      }
    } catch {
      // Skip mailto:, tel:, javascript:, or malformed hrefs — not a same-origin page link.
    }
    match = hrefPattern.exec(html)
  }
  return links
}

export type BrokenLinkCheck = {
  checkedLinks: number
  brokenLinks: number
  contactPath:
    | { status: 'verified-working' }
    | { status: 'verified-broken'; verification: 'executed' }
    | { status: 'unmeasured'; reason: string }
}

/**
 * Checks up to `MAX_LINKS_CHECKED` same-origin https links found on the
 * already-fetched homepage. Returns `null` when there was nothing
 * checkable — the caller (and the renderer's scoring) must read that as
 * `unmeasured`, never as zero broken links, so a page with no links is not
 * scored as if its links were verified clean.
 */
export async function checkBrokenLinks(
  homepageUrl: string,
  homepageHtml: string,
  fetchImpl?: typeof fetch,
): Promise<BrokenLinkCheck | null> {
  const base = new URL(homepageUrl)
  const candidates = extractSameOriginLinks(homepageHtml, base).slice(0, MAX_LINKS_CHECKED)
  if (candidates.length === 0) return null

  let broken = 0
  let contactPath: BrokenLinkCheck['contactPath'] = {
    status: 'unmeasured',
    reason: 'No link naming "contact" was found among the same-origin links checked.',
  }

  for (const link of candidates) {
    const looksLikeContact = /contact/i.test(link.pathname)
    try {
      const result = await inspectPublicWebsiteReadOnly(link.toString(), { fetchImpl, timeoutMs: PER_LINK_TIMEOUT_MS })
      const isBroken = result.statusCode >= 400
      if (isBroken) broken += 1
      if (looksLikeContact) contactPath = isBroken ? { status: 'verified-broken', verification: 'executed' } : { status: 'verified-working' }
    } catch {
      broken += 1
      if (looksLikeContact) contactPath = { status: 'verified-broken', verification: 'executed' }
    }
  }

  return { checkedLinks: candidates.length, brokenLinks: broken, contactPath }
}
