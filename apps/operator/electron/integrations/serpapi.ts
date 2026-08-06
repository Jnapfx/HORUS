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

export type SerpApiDiscoveryResponse = {
  requestUrl: string
  payload: unknown
}

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

export async function executeSerpApiDiscovery(input: SerpApiDiscoveryInput & { apiKey: string; fetchImpl?: typeof fetch }): Promise<SerpApiDiscoveryResponse> {
  requireText(input.apiKey, 'SerpApi key')
  const plan = buildSerpApiDiscoveryPlan(input)
  const requestUrl = new URL(plan.endpoint)
  Object.entries(plan.query).forEach(([key, value]) => requestUrl.searchParams.set(key, value))
  requestUrl.searchParams.set('api_key', input.apiKey)

  const response = await (input.fetchImpl ?? fetch)(requestUrl)
  if (!response.ok) throw new Error(`SerpApi discovery failed with HTTP ${response.status}`)
  return { requestUrl: requestUrl.toString(), payload: await response.json() }
}
