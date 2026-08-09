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
      /** DEC-069. Spends a real SerpApi credit and retrieves real business data — distinct from the fixture-only `workflow` above. */
      discovery: {
        run: (input: { category: string; city: string; maxExamined: number; forceRefresh?: boolean }) => Promise<
          | {
              status: 'completed'
              snapshotId: string
              retrievedAt: string
              requestUrl: string
              candidateCount: number
              candidates: Array<{
                name: string | null
                rating: number | null
                reviewCount: number | null
                type: string | null
                dataId: string | null
                address: string | null
                website: string | null
                phone: string | null
                coordinates: { latitude: number; longitude: number } | null
              }>
              /** DEC-077. True when served from a prior cached search — no credit spent. */
              fromCache: boolean
            }
          | { status: 'failed'; reason: string; detail: string }
        >
        /** DEC-071. Spends further real SerpApi credits, up to one per page retrieved. */
        fetchReviewHistory: (input: { dataId: string }) => Promise<
          | {
              status: 'completed'
              retrievedAt: string
              snapshotIds: readonly string[]
              pagesFetched: number
              paginationExhausted: boolean
              reviews: readonly { isoDate: string; rating: number }[]
            }
          | { status: 'failed'; reason: string; detail: string }
        >
        /** DEC-072. Spends a real PageSpeed quota unit and fetches the candidate's own site once. */
        measureWebOpportunity: (input: { url: string }) => Promise<
          | {
              status: 'completed'
              retrievedAt: string
              performance: { status: 'measured'; value: { timeToInteractiveSeconds: number; snapshotId: string } } | { status: 'unmeasured'; reason: string }
              servesHttps: { status: 'measured'; value: boolean } | { status: 'unmeasured'; reason: string }
              telLinkFound: { status: 'measured'; value: { found: boolean; snapshotId: string } } | { status: 'unmeasured'; reason: string }
            }
          | { status: 'failed'; reason: string; detail: string }
        >
        /** DEC-074. Returns only a coordinate pair, or null — never the configured street address. */
        getHomeBaseCoordinates: () => Promise<{ latitude: number; longitude: number } | null>
        /** DEC-078. Loads the URL in a hidden window and captures a screenshot. In-memory only; nothing is stored. */
        captureScreenshot: (input: { url: string }) => Promise<
          | { status: 'captured'; dataUrl: string; capturedAt: string; url: string }
          | { status: 'rejected'; reason: string }
          | { status: 'failed'; reason: string }
        >
      }
      /** DEC-080. REAL PUBLICATION — deploys to Cloudflare Pages via the operator's authenticated Wrangler CLI. Requires explicit DEC-004 approval before calling. */
      publish: {
        demonstration: (input: { html: string; businessName: string; dataId: string | null }) => Promise<
          | { status: 'published'; url: string | null; projectName: string; publishedAt: string; deployOutput: string }
          | { status: 'failed'; reason: string; detail: string }
        >
        /** DEC-090. Charter 15's removal path. Destructive and outward-facing: deletes the Pages project and every deployment under it. */
        removeDemonstration: (input: { projectName: string; dataId: string | null }) => Promise<
          | { status: 'removed'; projectName: string; removedAt: string; output: string }
          | { status: 'failed'; reason: string; detail: string }
        >
      }
      /** DEC-094. Durable operator judgment on charter 9.5's judgment gates; read back as a projection, never a second stored copy. */
      judgment: {
        record: (input: { listingId: string; judgment: unknown }) => Promise<{ status: 'recorded'; occurredAt: string }>
        list: () => Promise<readonly { aggregateType: string; aggregateId: string; eventType: string; payload: unknown; occurredAt: string }[]>
      }
      /** DEC-081. The second DEC-004 gate — opens a real Gmail compose window, no send capability. */
      outreach: {
        openGmailHandoff: (input: { approvalId: string; to: string; subject: string; body: string; dataId: string | null }) => Promise<
          { status: 'opened'; occurredAt: string } | { status: 'failed'; reason: string }
        >
        declareSent: (input: { dataId: string | null; to: string }) => Promise<{ status: 'recorded'; occurredAt: string }>
        /** DEC-096. Operator-declared: HORUS cannot observe a reply (DEC-041). Exempts the demonstration from DEC-031's 60-day prompt. */
        recordResponse: (input: { dataId: string | null; note: string }) => Promise<{ status: 'recorded'; occurredAt: string }>
      }
      /** DEC-082. Charter §4's final step — recording a prospect's next follow-up and reading back the pipeline as a whole. */
      tracker: {
        scheduleFollowUp: (input: { dataId: string | null; to: string | null; date: string; note: string }) => Promise<{ status: 'recorded'; occurredAt: string }>
        listEvents: () => Promise<Array<{ id: string; aggregateType: string; aggregateId: string; eventType: string; payload: unknown; occurredAt: string }>>
      }
    }
  }
}
