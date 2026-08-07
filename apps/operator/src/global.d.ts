export {}

import type { VerticalWorkflowState } from './domain/representative-workflow'

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
      workflow: {
        getRepresentative: () => Promise<VerticalWorkflowState | null>
        saveRepresentative: (state: VerticalWorkflowState) => Promise<void>
      }
      /** DEC-065. The analyst boundary, exposed for the first time to the renderer. */
      agent: {
        listEvidence: () => Promise<Array<{ id: string; source: string; retrievedAt: string }>>
        /** DEC-067. Persisted, already-validated analyst outputs, newest first. */
        listDrafts: () => Promise<Array<{ id: string; taskId: string; createdAt: string; output: unknown }>>
        checkAvailability: () => Promise<
          | { available: true; runtimeId: string; version: string }
          | { available: false; reason: string; detail: string }
        >
        runAnalyst: (evidence: Array<{ snapshotId: string; source: string; retrievedAt: string }>) => Promise<
          | {
              status: 'awaiting_operator_review'
              record: unknown
              draftId: string | null
              output: {
                observations: Array<{ candidateId: string; signal: string; kind: 'observed' | 'insufficient_data'; evidenceSnapshotIds: readonly string[] }>
                proposedForReview: Array<{ candidateId: string; rationale: string; evidenceSnapshotIds: readonly string[] }>
                missingInformation: readonly string[]
              }
            }
          | { status: 'failed'; record: unknown; reason: string; detail: string }
        >
      }
    }
  }
}
