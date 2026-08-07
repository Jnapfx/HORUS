export type SerpApiDiscoveryInput = {
  query: string
  location: string
  start?: number
  num?: number
}

export type SerpApiRequestPlan = {
  source: 'serpapi.google_maps'
  method: 'GET'
  endpoint: 'https://serpapi.com/search.json'
  query: Record<string, string>
  credentialRequirement: 'serpapi_key'
  rawEvidenceRequired: true
}

/**
 * `requestUrl` is the provenance record for a retrieval and is written to the
 * evidence store by `appendRawSnapshot`. It therefore carries the credential
 * placeholder, never the credential: the executed URL is built separately and
 * never leaves this module. See DEC-046.
 */
export type SerpApiDiscoveryResponse = {
  requestUrl: string
  credentialPlaceholder: typeof CREDENTIAL_PLACEHOLDER
  retrievedAt: string
  payload: unknown
}

export const CREDENTIAL_PLACEHOLDER = 'REDACTED_SERPAPI_KEY' as const

function requireText(value: string, name: string) {
  if (!value.trim()) throw new Error(`${name} is required`)
}

export function buildSerpApiDiscoveryPlan(input: SerpApiDiscoveryInput): SerpApiRequestPlan {
  requireText(input.query, 'Search query')
  requireText(input.location, 'Search location')

  return {
    source: 'serpapi.google_maps',
    method: 'GET',
    endpoint: 'https://serpapi.com/search.json',
    query: {
      engine: 'google_maps',
      q: `${input.query.trim()} in ${input.location.trim()}`,
      start: String(input.start ?? 0),
      num: String(input.num ?? 20),
    },
    credentialRequirement: 'serpapi_key',
    rawEvidenceRequired: true,
  }
}

export async function executeSerpApiDiscovery(
  input: SerpApiDiscoveryInput & { apiKey: string; fetchImpl?: typeof fetch; now?: () => Date },
): Promise<SerpApiDiscoveryResponse> {
  requireText(input.apiKey, 'SerpApi key')
  const plan = buildSerpApiDiscoveryPlan(input)

  // Built once without the credential. The provenance copy is taken before the
  // key is ever set, so no code path can accidentally serialise it.
  const provenanceUrl = new URL(plan.endpoint)
  Object.entries(plan.query).forEach(([key, value]) => provenanceUrl.searchParams.set(key, value))
  const executedUrl = new URL(provenanceUrl)
  executedUrl.searchParams.set('api_key', input.apiKey)
  provenanceUrl.searchParams.set('api_key', CREDENTIAL_PLACEHOLDER)

  const response = await (input.fetchImpl ?? fetch)(executedUrl)
  if (!response.ok) throw new Error(`SerpApi discovery failed with HTTP ${response.status}`)

  return {
    requestUrl: provenanceUrl.toString(),
    credentialPlaceholder: CREDENTIAL_PLACEHOLDER,
    retrievedAt: (input.now?.() ?? new Date()).toISOString(),
    payload: await response.json(),
  }
}
