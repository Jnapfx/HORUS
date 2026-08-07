export type IntegrationId = 'serpapi' | 'pagespeed' | 'website-analysis' | 'gmail-compose' | 'cloudflare-dashboard'

export type IntegrationContract = {
  id: IntegrationId
  label: string
  execution: 'main-process-only' | 'operator-dashboard'
  credentialBoundary: 'local-main-process' | 'no-credential'
  approvalRequirement: string
  rawEvidenceRequirement: 'required' | 'not-applicable'
}

const contracts: readonly IntegrationContract[] = [
  {
    id: 'serpapi',
    label: 'SerpApi discovery and review history',
    execution: 'main-process-only',
    credentialBoundary: 'local-main-process',
    approvalRequirement: 'Run only from a future explicit search command.',
    rawEvidenceRequirement: 'required',
  },
  {
    id: 'pagespeed',
    label: 'PageSpeed Insights measurement',
    execution: 'main-process-only',
    credentialBoundary: 'local-main-process',
    approvalRequirement: 'Run only for a selected candidate in a future explicit analysis command.',
    rawEvidenceRequirement: 'required',
  },
  {
    id: 'website-analysis',
    label: 'Public website structure and interaction analysis',
    execution: 'main-process-only',
    credentialBoundary: 'no-credential',
    approvalRequirement: 'Run only for a reputation-qualified selected candidate, or for provider-parking evidence explicitly selected by the operator; respect site restrictions and do not submit forms. Reputation still blocks publication and outreach.',
    rawEvidenceRequirement: 'required',
  },
  {
    id: 'gmail-compose',
    label: 'Gmail compose handoff',
    execution: 'main-process-only',
    credentialBoundary: 'no-credential',
    approvalRequirement: 'Requires an explicit outreach approval ID before a compose URL can be created.',
    rawEvidenceRequirement: 'not-applicable',
  },
  {
    id: 'cloudflare-dashboard',
    label: 'Cloudflare Dashboard upload handoff',
    execution: 'operator-dashboard',
    credentialBoundary: 'no-credential',
    approvalRequirement: 'Requires an explicit publication approval ID; HORUS does not retain a Cloudflare token.',
    rawEvidenceRequirement: 'not-applicable',
  },
]

export function listIntegrationContracts(): readonly IntegrationContract[] {
  return contracts.map((contract) => ({ ...contract }))
}
