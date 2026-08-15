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
        /** DEC-129. Runs the concept_composer bounded task once over the given evidence. Never HTML, never persisted, never published — the renderer feeds the returned composition into `buildDemonstrationSite`. */
        runComposer: (evidence: Array<{ snapshotId: string; source: string; retrievedAt: string }>) => Promise<
          | {
              status: 'awaiting_operator_review'
              record: unknown
              output: {
                sectionOrder: readonly ('about' | 'reviews' | 'services' | 'hours')[]
                tone: 'warm' | 'minimal' | 'bold'
                tagline: string | null
                aboutParagraph: string | null
                reviewHighlights: readonly { quote: string; evidenceSnapshotId: string }[]
                rationale: string
                /** DEC-140. The agent's design choice, validated against the closed sets in `shared/demonstration.ts` before it gets here. */
                palette: 'forest' | 'cobalt' | 'black_tan' | 'terracotta_slate' | 'olive_brick' | 'mono_pop'
                fontPairing: 'editorial' | 'grotesque' | 'humanist'
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
            serviceOptions: readonly string[]
            highlights: readonly string[]
            categories: readonly string[]
            operatingHours: Readonly<Record<string, string>> | null
            priceRange: string | null
            photoUrl: string | null
              }>
              /** DEC-077. True when served from a prior cached search — no credit spent. */
              fromCache: boolean
            }
          | { status: 'failed'; reason: string; detail: string }
        >
        /** DEC-071/DEC-108. Spends further real SerpApi credits, up to one per page — unless this listing's pages are already retained, in which case it serves those and spends nothing. */
        fetchReviewHistory: (input: { dataId: string; forceRefresh?: boolean }) => Promise<
          | {
              status: 'completed'
              retrievedAt: string
              snapshotIds: readonly string[]
              pagesFetched: number
              paginationExhausted: boolean
              reviews: readonly { isoDate: string; rating: number; text: string | null; author: string | null; ownerResponded: boolean }[]
              fromCache: boolean
            }
          | { status: 'failed'; reason: string; detail: string }
        >
        /** DEC-072, cached by DEC-117. Spends a real PageSpeed quota unit and fetches the candidate's own site once — unless this exact URL was already measured, in which case no credit is spent. Set forceRefresh to measure again anyway. */
        measureWebOpportunity: (input: { url: string; forceRefresh?: boolean }) => Promise<
          | {
              status: 'completed'
              retrievedAt: string
              mobileAudits: { lighthouseResult: { audits: Record<string, unknown> } } | null
          obsoleteSignals: { obsoleteTechnologyMarkers: string[]; latestCopyrightYear: number | null } | null
          performance: { status: 'measured'; value: { timeToInteractiveSeconds: number; snapshotId: string } } | { status: 'unmeasured'; reason: string }
              servesHttps: { status: 'measured'; value: boolean } | { status: 'unmeasured'; reason: string }
              telLinkFound: { status: 'measured'; value: { found: boolean; snapshotId: string } } | { status: 'unmeasured'; reason: string }
              /** DEC-111. Same-origin link check feeding `broken_elements` — null when the homepage had no checkable same-origin https link. */
              brokenLinks: {
                checkedLinks: number
                brokenLinks: number
                contactPath:
                  | { status: 'verified-working' }
                  | { status: 'verified-broken'; verification: 'executed' }
                  | { status: 'unmeasured'; reason: string }
              } | null
              /** DEC-117. True when served from a measurement already retained for this exact URL — no PageSpeed credit spent. */
              fromCache: boolean
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
      /** DEC-107, extended by DEC-117 and DEC-126. Rebuilds the last working session from retained evidence. Spends nothing. */
      session: {
        restore: () => Promise<{
          discovery: {
            request: unknown
            retrievedAt: string
            snapshotId: string
            candidates: Extract<Awaited<ReturnType<Window['horus']['discovery']['run']>>, { status: 'completed' }>['candidates']
          } | null
          reviewHistories: Record<string, {
            dataId: string
            retrievedAt: string
            snapshotIds: readonly string[]
            pagesFetched: number
            paginationExhausted: boolean
            reviews: readonly { isoDate: string; rating: number; text: string | null; author: string | null; ownerResponded: boolean }[]
          }>
          /** DEC-117. Keyed by the business's own website URL — the same key `measureWebOpportunity` is called with. */
          webOpportunityMeasurements: Record<string, Extract<Awaited<ReturnType<Window['horus']['discovery']['measureWebOpportunity']>>, { status: 'completed' }>>
          /** DEC-126. The last selected prospect's `dataId`, or `null` if none was ever selected or it was cleared. */
          selectedProspectId: string | null
        }>
      }
      /** DEC-126. Persists which candidate is the selected prospect across an app restart. */
      prospect: {
        setSelected: (input: { dataId: string | null }) => Promise<{ status: 'saved' }>
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
      /** DEC-131. The Orchestrator's automated pipeline, wired one step at a time — currently only DISCOVERED -> QUALIFYING -> QUALIFIED/REJECTED/FAILED. */
      orchestrator: {
        advanceQualification: (input: { dataId: string }) => Promise<
          | {
              status: 'qualified' | 'rejected'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              output: {
                opportunityScore: number
                qualified: boolean
                reasons: readonly { text: string; evidenceSnapshotIds: readonly string[] }[]
              }
            }
          | {
              status: 'failed'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              reason: string
              detail: string
            }
          | { status: 'skipped'; reason: string }
        >
        /** DEC-137. Retries qualification for a lead currently FAILED — same result shape as `advanceQualification`, only reachable by the operator's own explicit action. */
        retryQualification: (input: { dataId: string }) => Promise<
          | {
              status: 'qualified' | 'rejected'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              output: {
                opportunityScore: number
                qualified: boolean
                reasons: readonly { text: string; evidenceSnapshotIds: readonly string[] }[]
              }
            }
          | {
              status: 'failed'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              reason: string
              detail: string
            }
          | { status: 'skipped'; reason: string }
        >
        /**
         * DEC-140. Builds the demonstration and runs the BUILD -> QA -> FIX
         * loop: the impeccable anti-pattern detector first, then the
         * `qa_reviewer` agent, correcting up to three times. Its success
         * state, `qa_passed`, means the page is ready for the operator to
         * read — it is not an approval and does not touch either DEC-004 gate.
         */
        advanceDemonstration: (input: { dataId: string }) => Promise<
          | {
              status: 'qa_passed'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              html: string
              /** Fields with no verified value, rendered as bracketed placeholders — same list `buildDemonstrationSite` returns directly. */
              missingFields: readonly string[]
              attempts: readonly {
                attempt: number
                demoSnapshotId: string
                detectorFindings: readonly string[]
                agentIssues: readonly string[]
                outcome: 'passed' | 'detector_rejected' | 'agent_rejected' | 'unchecked'
              }[]
            }
          | {
              status: 'qa_failed'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              attempts: readonly {
                attempt: number
                demoSnapshotId: string
                detectorFindings: readonly string[]
                agentIssues: readonly string[]
                outcome: 'passed' | 'detector_rejected' | 'agent_rejected' | 'unchecked'
              }[]
              reason: string
            }
          | {
              status: 'failed'
              leadState: {
                dataId: string
                status: string
                history: readonly { status: string; occurredAt: string; detail?: string }[]
              }
              reason: string
              detail: string
            }
          | { status: 'skipped'; reason: string }
        >
      }
      /** DEC-131. Read-only: replays a lead's recorded event history into its current status. */
      lead: {
        getState: (input: { dataId: string }) => Promise<{
          dataId: string
          status: string
          history: readonly { status: string; occurredAt: string; detail?: string }[]
        }>
      }
    }
  }
}
