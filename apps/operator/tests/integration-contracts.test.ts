import { describe, expect, it } from 'vitest'
import { buildCloudflareDashboardUploadPlan } from '../electron/integrations/cloudflare'
import { listIntegrationContracts } from '../electron/integrations/contracts'
import { buildPageSpeedMobilePlan } from '../electron/integrations/pagespeed'
import { buildSerpApiDiscoveryPlan } from '../electron/integrations/serpapi'

describe('non-production integration contracts', () => {
  it('plans SerpApi and PageSpeed requests without embedding credentials', () => {
    const serpApi = buildSerpApiDiscoveryPlan({ query: 'plumbers', location: 'Stamford, CT' })
    const pageSpeed = buildPageSpeedMobilePlan({ url: 'https://example.invalid/' })

    expect(serpApi.query).toMatchObject({ engine: 'google_maps', q: 'plumbers', location: 'Stamford, CT' })
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

    expect(contracts.map((contract) => contract.id)).toEqual(['serpapi', 'pagespeed', 'gmail-compose', 'cloudflare-dashboard'])
    expect(contracts.every((contract) => !JSON.stringify(contract).includes('api_key'))).toBe(true)
  })
})
