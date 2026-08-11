/**
 * Types derived from the preload bridge's own signatures, shared by the view
 * components extracted from `App.tsx` in DEC-085. Deriving rather than
 * redeclaring keeps a renderer type from drifting away from the IPC contract
 * that actually produces the value.
 */

export type FoundationStatus = Awaited<ReturnType<NonNullable<Window['horus']>['foundation']['getStatus']>>
export type DiscoveryRunResult = Awaited<ReturnType<NonNullable<Window['horus']>['discovery']['run']>>
export type CandidateSummary = Extract<DiscoveryRunResult, { status: 'completed' }>['candidates'][number]
export type ReviewHistoryResult = Awaited<ReturnType<NonNullable<Window['horus']>['discovery']['fetchReviewHistory']>>
export type WebOpportunityMeasurementResult = Awaited<ReturnType<NonNullable<Window['horus']>['discovery']['measureWebOpportunity']>>
/** DEC-108. One listing's most recent retained retrieval run, as `session:restore` reads it back. */
export type RestoredReviewHistory =
  Awaited<ReturnType<NonNullable<Window['horus']>['session']['restore']>>['reviewHistories'][string]
/** DEC-117. One URL's most recent retained web-opportunity measurement, as `session:restore` reads it back — keyed by the business's own website URL, the same key `measureWebOpportunity` is called with. */
export type RestoredWebOpportunityMeasurement =
  NonNullable<Awaited<ReturnType<NonNullable<Window['horus']>['session']['restore']>>['webOpportunityMeasurements'][string]>
export type EvidenceSummary = { id: string; source: string; retrievedAt: string }
export type AnalystRunResult = NonNullable<Window['horus']>['agent']['runAnalyst'] extends (...args: never[]) => Promise<infer R> ? R : never
export type DraftSummary = { id: string; taskId: string; createdAt: string; output: unknown }
