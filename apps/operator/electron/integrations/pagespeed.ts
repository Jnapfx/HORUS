export type PageSpeedMeasurementInput = {
  url: string
}

export type PageSpeedRequestPlan = {
  source: 'pagespeed.mobile'
  method: 'GET'
  endpoint: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
  query: Record<string, string>
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
  Object.entries(plan.query).forEach(([key, value]) => provenanceUrl.searchParams.set(key, value))
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
