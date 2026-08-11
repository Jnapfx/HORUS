export type PageSpeedMeasurementInput = {
  url: string
}

export type PageSpeedRequestPlan = {
  source: 'pagespeed.mobile'
  method: 'GET'
  endpoint: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  query: Record<string, string | readonly string[]>
  credentialRequirement: 'pagespeed_api_key'
  rawEvidenceRequired: true
}

export function buildPageSpeedMobilePlan(input: PageSpeedMeasurementInput): PageSpeedRequestPlan {
  const url = new URL(input.url)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PageSpeed URL must use HTTP or HTTPS')

  return {
    source: 'pagespeed.mobile',
    method: 'GET',
    endpoint: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
    query: {
      url: url.toString(),
      strategy: 'mobile',
      /**
       * DEC-109. Without `category`, PageSpeed returns the performance
       * category alone — 47 audits, none of them `viewport`, `content-width`
       * or `tap-targets`. DEC-097 read those three to measure mobile
       * responsiveness, `web-opportunity-v2`'s largest factor at 30 of 100
       * points, on the premise that "every PageSpeed call returns a full
       * mobile Lighthouse run". It does not, and the factor came back
       * `unmeasured` on the first real site it was pointed at.
       *
       * These are requested by name rather than by taking whatever the
       * default gives, so a future reader can see which categories the model
       * actually depends on. Still one request, still one quota unit.
       */
      category: ['performance', 'seo', 'accessibility', 'best-practices'],
    },
    credentialRequirement: 'pagespeed_api_key',
    rawEvidenceRequired: true,
  }
}

export const PAGESPEED_CREDENTIAL_PLACEHOLDER = 'REDACTED_PAGESPEED_KEY' as const

export type PageSpeedMobileResponse = {
  requestUrl: string
  credentialPlaceholder: typeof PAGESPEED_CREDENTIAL_PLACEHOLDER
  retrievedAt: string
  payload: unknown
}

/**
 * DEC-072. Same credential-redaction pattern as `executeSerpApiDiscovery`
 * (DEC-046): the provenance URL is built before the key is ever set, so no
 * code path can serialise the real value into evidence storage.
 */
export async function executePageSpeedMobile(
  input: PageSpeedMeasurementInput & { apiKey: string; fetchImpl?: typeof fetch; now?: () => Date },
): Promise<PageSpeedMobileResponse> {
  if (!input.apiKey.trim()) throw new Error('PageSpeed API key is required')
  const plan = buildPageSpeedMobilePlan(input)

  const provenanceUrl = new URL(plan.endpoint)
  // `category` is repeated, not comma-joined — the PageSpeed API takes one
  // parameter per category and silently ignores a joined value.
  Object.entries(plan.query).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((entry) => provenanceUrl.searchParams.append(key, entry))
    else provenanceUrl.searchParams.set(key, value as string)
  })
  const executedUrl = new URL(provenanceUrl)
  executedUrl.searchParams.set('key', input.apiKey)
  provenanceUrl.searchParams.set('key', PAGESPEED_CREDENTIAL_PLACEHOLDER)

  const response = await (input.fetchImpl ?? fetch)(executedUrl)
  if (!response.ok) throw new Error(`PageSpeed request failed with HTTP ${response.status}`)

  return {
    requestUrl: provenanceUrl.toString(),
    credentialPlaceholder: PAGESPEED_CREDENTIAL_PLACEHOLDER,
    retrievedAt: (input.now?.() ?? new Date()).toISOString(),
    payload: await response.json(),
  }
}
