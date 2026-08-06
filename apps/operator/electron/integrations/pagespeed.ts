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
