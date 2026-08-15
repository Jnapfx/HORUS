/**
 * DEC-131. Server-side evidence assembly for the Orchestrator — the same job
 * `src/views/candidate-scoring.ts`'s `buildCandidateEvidenceReferences`
 * already does for the renderer's own manual "Analyze candidates" button,
 * necessarily reimplemented here rather than imported: that module lives
 * under `src/`, and `tsconfig.electron.json` builds only `electron/` (see
 * `lead-state.ts`'s own comment on this same boundary). The Orchestrator
 * supplies a qualification task with no evidence the deterministic score
 * does not already have access to — same rule, same reason.
 *
 * Unlike the renderer's version, this has to locate the discovery snapshot
 * itself: the renderer already holds `discoverySnapshotId` in component
 * state from the search that produced the candidate list, but the
 * Orchestrator is handed only a `dataId` and has to find which retained
 * discovery snapshot that candidate came from.
 */

import type { EvidenceReference } from '../agent/runtime.js'
import type { HorusStore } from '../persistence.js'
import { extractCandidatesForRestore } from '../discovery-ipc.js'
import { readLatestRetainedRun } from '../review-evidence.js'
import { reconstructMeasurementFromSnapshots, type RawSnapshotRecord } from '../web-opportunity-ipc.js'

/**
 * Scans retained discovery snapshots, most recent first, for the first one
 * whose candidate list includes `dataId`. Discovery snapshots are never
 * queried by candidate — SerpApi returns a page of listings per search, not
 * one row per business — so this is a linear scan; retained snapshots are a
 * small, bounded set in practice (one per search the operator has run).
 */
export function findDiscoverySnapshotForLead(
  store: HorusStore,
  dataId: string,
): { snapshotId: string; retrievedAt: string; website: string | null } | null {
  const snapshots = store.listRawSnapshotsBySource('serpapi.google_maps')
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    const snapshot = snapshots[i]!
    const candidate = extractCandidatesForRestore(snapshot.payload).find((c) => c.dataId === dataId)
    if (candidate) {
      return { snapshotId: snapshot.id, retrievedAt: snapshot.retrievedAt, website: candidate.website }
    }
  }
  return null
}

export type LeadEvidenceResult =
  | { status: 'found'; evidence: readonly EvidenceReference[] }
  | { status: 'not_found'; reason: string }

/**
 * Assembles every retained piece of evidence for one lead: its discovery
 * listing, its review history (if any was fetched), and its web-opportunity
 * measurement (if its website was ever measured). Mirrors
 * `buildCandidateEvidenceReferences`'s exact composition and de-duplication.
 */
export function assembleLeadEvidence(store: HorusStore, dataId: string): LeadEvidenceResult {
  const discovery = findDiscoverySnapshotForLead(store, dataId)
  if (!discovery) {
    return { status: 'not_found', reason: `No retained discovery snapshot contains a candidate with data_id "${dataId}"` }
  }

  const references: EvidenceReference[] = [
    { snapshotId: discovery.snapshotId, source: 'serpapi.google_maps', retrievedAt: discovery.retrievedAt },
  ]

  const reviewHistory = readLatestRetainedRun(dataId, store.listRawSnapshotsBySource('serpapi.google_maps_reviews'))
  if (reviewHistory) {
    for (const snapshotId of reviewHistory.snapshotIds) {
      references.push({ snapshotId, source: 'serpapi.google_maps_reviews', retrievedAt: reviewHistory.retrievedAt })
    }
  }

  if (discovery.website) {
    const pagespeedSnapshots: readonly RawSnapshotRecord[] = store.listRawSnapshotsBySource('pagespeed.mobile')
    const analysisSnapshots: readonly RawSnapshotRecord[] = store.listRawSnapshotsBySource('horus.website-analysis')
    const measurement = reconstructMeasurementFromSnapshots(discovery.website, pagespeedSnapshots, analysisSnapshots)
    if (measurement) {
      if (measurement.performance.status === 'measured') {
        references.push({ snapshotId: measurement.performance.value.snapshotId, source: 'pagespeed.mobile', retrievedAt: measurement.retrievedAt })
      }
      if (measurement.telLinkFound.status === 'measured') {
        references.push({ snapshotId: measurement.telLinkFound.value.snapshotId, source: 'horus.website-analysis', retrievedAt: measurement.retrievedAt })
      }
    }
  }

  const seen = new Set<string>()
  const deduped = references.filter((reference) => {
    if (seen.has(reference.snapshotId)) return false
    seen.add(reference.snapshotId)
    return true
  })

  return { status: 'found', evidence: deduped }
}
