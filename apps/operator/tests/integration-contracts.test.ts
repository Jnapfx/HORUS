import { describe, expect, it } from 'vitest'
import { buildCloudflareDashboardUploadPlan } from '../electron/integrations/cloudflare'
import { listIntegrationContracts } from '../electron/integrations/contracts'
import { buildPageSpeedMobilePlan } from '../electron/integrations/pagespeed'
import { buildSerpApiDiscoveryPlan, executeSerpApiDiscovery } from '../electron/integrations/serpapi'

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

  it('executes discovery only with a main-process key and keeps it out of the response payload', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(input.toString())
      expect(url.searchParams.get('api_key')).toBe('test-key')
      return new Response(JSON.stringify({ local_results: [{ title: 'Example' }] }), { status: 200 })
    }

    const result = await executeSerpApiDiscovery({ query: 'landscaping', location: 'Stamford, Connecticut', apiKey: 'test-key', fetchImpl })

    expect(result.requestUrl).toContain('engine=google_maps')
    expect(result.requestUrl).toContain('q=landscaping+in+Stamford%2C+Connecticut')
    expect(result.payload).toEqual({ local_results: [{ title: 'Example' }] })
    expect(JSON.stringify(result.payload)).not.toContain('test-key')
  })
})
