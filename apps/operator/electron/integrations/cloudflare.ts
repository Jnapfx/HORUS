export type ApprovedDashboardUploadInput = {
  publicationApprovalId: string
  assetDirectory: string
}

export type CloudflareDashboardUploadPlan = {
  mode: 'operator-dashboard'
  dashboardUrl: 'https://dash.cloudflare.com/'
  assetDirectory: string
  publicationApprovalId: string
  credentialRequirement: 'none'
}

export function buildCloudflareDashboardUploadPlan(input: ApprovedDashboardUploadInput): CloudflareDashboardUploadPlan {
  if (!input.publicationApprovalId.trim()) throw new Error('Publication approval is required before a Cloudflare upload handoff')
  if (!input.assetDirectory.trim()) throw new Error('Asset directory is required before a Cloudflare upload handoff')

  return {
    mode: 'operator-dashboard',
    dashboardUrl: 'https://dash.cloudflare.com/',
    assetDirectory: input.assetDirectory,
    publicationApprovalId: input.publicationApprovalId,
    credentialRequirement: 'none',
  }
}
