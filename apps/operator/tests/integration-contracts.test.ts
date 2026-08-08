import { describe, expect, it } from 'vitest'
import { buildCloudflareDashboardUploadPlan } from '../electron/integrations/cloudflare'
import { listIntegrationContracts } from '../electron/integrations/contracts'
import { PAGESPEED_CREDENTIAL_PLACEHOLDER, buildPageSpeedMobilePlan, executePageSpeedMobile } from '../electron/integrations/pagespeed'
import { CREDENTIAL_PLACEHOLDER, buildSerpApiDiscoveryPlan, buildSerpApiReviewsPlan, executeSerpApiDiscovery, executeSerpApiReviews } from '../electron/integrations/serpapi'

describe('non-production integration contracts', () => {
  it('plans SerpApi and PageSpeed requests without embedding credentials', () => {
    const serpApi = buildSerpApiDiscoveryPlan({ query: 'plumbers', location: 'Stamford, CT' })
    const pageSpeed = buildPageSpeedMobilePlan({ url: 'https://example.invalid/' })

    expect(serpApi.query).toMatchObject({ engine: 'google_maps', q: 'plumbers in Stamford, CT' })
    expect(serpApi.query).not.toHaveProperty('location')
    expect(pageSpeed.query).toMatchObject({ strategy: 'mobile', url: 'https://example.invalid/' })
    expect(JSON.stringify([serpApi, pageSpeed])).not.toContain('api_key=')
  })

  it('requires publication approval before preparing a Cloudflare dashboard handoff', () => {
    expect(() => buildCloudflareDashboardUploadPlan({ publicationApprovalId: '', assetDirectory: '/tmp/demo' }))
      .toThrow('Publication approval is required')

    expect(buildCloudflareDashboardUploadPlan({ publicationApprovalId: 'approval_1', assetDirectory: '/tmp/demo' }))
      .toMatchObject({ mode: 'operator-dashboard', credentialRequirement: 'none' })
  })

  it('exposes contract metadata without exposing credentials', () => {
    const contracts = listIntegrationContracts()

    expect(contracts.map((contract) => contract.id)).toEqual(['serpapi', 'pagespeed', 'website-analysis', 'gmail-compose', 'cloudflare-dashboard'])
    expect(contracts.find((contract) => contract.id === 'website-analysis')?.approvalRequirement).toContain('do not submit forms')
    expect(contracts.find((contract) => contract.id === 'website-analysis')?.approvalRequirement).toContain('provider-parking')
    expect(contracts.every((contract) => !JSON.stringify(contract).includes('api_key'))).toBe(true)
  })

  it('executes discovery only with a main-process key and keeps it out of every returned field', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString())
      expect(url.searchParams.get('api_key')).toBe('test-key')
      return new Response(JSON.stringify({ local_results: [{ title: 'Example' }] }), { status: 200 })
    }

    const result = await executeSerpApiDiscovery({
      query: 'landscaping',
      location: 'Stamford, Connecticut',
      apiKey: 'test-key',
      fetchImpl,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    })

    expect(result.requestUrl).toContain('engine=google_maps')
    expect(result.requestUrl).toContain('q=landscaping+in+Stamford%2C+Connecticut')
    expect(result.payload).toEqual({ local_results: [{ title: 'Example' }] })
    expect(result.retrievedAt).toBe('2026-08-07T12:00:00.000Z')

    // The whole result is what reaches the evidence store, not just the payload.
    expect(JSON.stringify(result)).not.toContain('test-key')
    expect(result.requestUrl).toContain(`api_key=${CREDENTIAL_PLACEHOLDER}`)
  })

  it('plans a paginated reviews request, sorted newest first, without embedding a credential', () => {
    const firstPage = buildSerpApiReviewsPlan({ dataId: 'abc123' })
    expect(firstPage.query).toMatchObject({ engine: 'google_maps_reviews', data_id: 'abc123', sort_by: 'newestFirst' })
    expect(firstPage.query).not.toHaveProperty('next_page_token')

    const secondPage = buildSerpApiReviewsPlan({ dataId: 'abc123', pageToken: 'token-2' })
    expect(secondPage.query.next_page_token).toBe('token-2')
    expect(JSON.stringify([firstPage, secondPage])).not.toContain('api_key=')
  })

  it('executes a reviews request with a main-process key and keeps it out of the returned result', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString())
      expect(url.searchParams.get('api_key')).toBe('test-key')
      return new Response(JSON.stringify({ reviews: [{ iso_date: '2026-08-01T00:00:00Z', rating: 5 }] }), { status: 200 })
    }

    const result = await executeSerpApiReviews({ dataId: 'abc123', apiKey: 'test-key', fetchImpl, now: () => new Date('2026-08-07T12:00:00.000Z') })

    expect(result.payload).toEqual({ reviews: [{ iso_date: '2026-08-01T00:00:00Z', rating: 5 }] })
    expect(JSON.stringify(result)).not.toContain('test-key')
    expect(result.requestUrl).toContain(`api_key=${CREDENTIAL_PLACEHOLDER}`)
  })

  it('executes a PageSpeed request with a main-process key and keeps it out of the returned result', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString())
      expect(url.searchParams.get('key')).toBe('ps-test-key')
      expect(url.searchParams.get('strategy')).toBe('mobile')
      return new Response(JSON.stringify({ lighthouseResult: { audits: { interactive: { numericValue: 5000 } } } }), { status: 200 })
    }

    const result = await executePageSpeedMobile({ url: 'https://example.invalid/', apiKey: 'ps-test-key', fetchImpl, now: () => new Date('2026-08-07T12:00:00.000Z') })

    expect(JSON.stringify(result)).not.toContain('ps-test-key')
    expect(result.requestUrl).toContain(`key=${PAGESPEED_CREDENTIAL_PLACEHOLDER}`)
  })

  it('records that a credential was used without recording its value', async () => {
    const fetchImpl: typeof fetch = async () => new Response('{}', { status: 200 })
    const result = await executeSerpApiDiscovery({ query: 'plumbing', location: 'Stamford, CT', apiKey: 'sk-live-abcdef123456', fetchImpl })

    expect(result.credentialPlaceholder).toBe(CREDENTIAL_PLACEHOLDER)
    expect(JSON.stringify(result)).not.toContain('sk-live-abcdef123456')
    expect(new URL(result.requestUrl).searchParams.get('api_key')).toBe(CREDENTIAL_PLACEHOLDER)
  })
})
