export {}

declare global {
  interface Window {
    horus?: {
      foundation: {
        getStatus: () => Promise<{
          databasePath: string
          dataDirectory: string
          rawSnapshotCount: number
          eventCount: number
        }>
        getIntegrationContracts: () => Promise<Array<{
          id: 'serpapi' | 'pagespeed' | 'gmail-compose' | 'cloudflare-dashboard'
          label: string
          execution: 'main-process-only' | 'operator-dashboard'
          credentialBoundary: 'local-main-process' | 'no-credential'
          approvalRequirement: string
          rawEvidenceRequirement: 'required' | 'not-applicable'
        }>>
      }
    }
  }
}
