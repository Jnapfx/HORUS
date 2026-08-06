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
      q: input.query.trim(),
      location: input.location.trim(),
      start: String(input.start ?? 0),
      num: String(input.num ?? 20),
    },
    credentialRequirement: 'serpapi_key',
    rawEvidenceRequired: true,
  }
}
