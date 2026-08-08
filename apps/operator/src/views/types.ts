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
export type EvidenceSummary = { id: string; source: string; retrievedAt: string }
export type AnalystRunResult = NonNullable<Window['horus']>['agent']['runAnalyst'] extends (...args: never[]) => Promise<infer R> ? R : never
export type DraftSummary = { id: string; taskId: string; createdAt: string; output: unknown }
