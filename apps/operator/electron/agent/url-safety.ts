/**
 * DEC-077. The same https-only + local/internal hostname denylist
 * `website-inspector.ts` (DEC-059/066) already uses, pulled out so a second
 * module that reaches a business's own public URL — the website-screenshot
 * capturer — doesn't carry its own silently-drifting copy of the same rule.
 * `website-inspector.ts` is left untouched rather than refactored to import
 * this, to avoid disturbing its already-verified tests for a purely
 * cosmetic dedupe; both copies are intentionally kept behaviorally identical.
 *
 * Same stated limitation as the original: a literal-hostname denylist, not
 * DNS-aware — it does not resolve the hostname and check the resulting IP,
 * so a hostname that resolves to a private address via DNS would still pass
 * this check. Proportionate for a single-operator tool reaching URLs drawn
 * from HORUS's own evidence, not a solved SSRF defense.
 */

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fe80:/i,
]

export class PublicUrlRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicUrlRejected'
  }
}

export function validatePublicHttpsUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new PublicUrlRejected(`"${rawUrl}" is not a valid URL`)
  }
  if (parsed.protocol !== 'https:') {
    throw new PublicUrlRejected(`Only https URLs may be used; got "${parsed.protocol}"`)
  }
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new PublicUrlRejected(`"${parsed.hostname}" is not a public website host`)
  }
  return parsed
}
