/**
 * DEC-140. The BUILD -> QA -> FIX loop, and the second half of the
 * Orchestrator `docs/ORCHESTRATOR_GAP_ANALYSIS.md` §3 and
 * `docs/AGENTIC_ARCHITECTURE_AUDIT.md` §H specified. `run-lead.ts` wires
 * DISCOVERED -> QUALIFIED; this file wires QUALIFIED -> QA_PASSED, which is
 * everything between qualification and the operator's own DEC-004 publish
 * gate.
 *
 * `run-lead.ts`'s header records why this could not be built before: the
 * generator lived under `src/domain/`, which `tsconfig.electron.json` could
 * not import. That is resolved — `demonstration.ts` now lives in `shared/`,
 * built by both projects — so the main process can generate a demonstration
 * headlessly instead of depending on a mounted renderer to do it.
 *
 * What is autonomous here and why that is safe. The whole loop runs before
 * DEC-004 gate one and touches no publish or outreach channel: nothing it
 * does is visible to a business owner. Its terminal state is QA_PASSED, which
 * means "ready for the operator to look at", not "approved" — the operator
 * still reads the rendered result and still ticks the publish checkbox
 * themselves. Automating this part is precisely what the audit's §H argued
 * was safe *because* publishing is not automated.
 *
 * Order of checking, per audit §I: deterministic first, judgment second. The
 * impeccable detector is cheaper, reproducible, and needs no Claude Code
 * availability, so a page that fails it is sent back to be fixed without ever
 * spending an agent run on QA. The `qa_reviewer` agent only sees pages that
 * already pass every mechanical rule, so it spends its turn on what the
 * detector cannot judge — whether the copy is specific to this business.
 *
 * Every write is this module's own, through `appendValidatedLeadStatus`.
 * Neither agent is given a tool that could write a status, publish, or send;
 * they return a decision for this deterministic module to act on (DEC-045).
 */

import { buildDemonstrationSite, type DemonstrationBusinessInput } from '../../shared/demonstration.js'
import { describeBlockingFindings, runImpeccableGate } from '../qa/impeccable-gate.js'
import { runConceptComposer } from '../agent/concept-composer-ipc.js'
import { runQaReviewer } from '../agent/qa-ipc.js'
import { extractCandidatesForRestore } from '../discovery-ipc.js'
import { assembleLeadEvidence, findDiscoverySnapshotForLead } from './lead-evidence.js'
import { appendValidatedLeadStatus, readLeadState } from './lead-store.js'
import type { LeadState } from './lead-state.js'
import type { EvidenceReference, LocalAgentRuntime } from '../agent/runtime.js'
import type { HorusStore } from '../persistence.js'

/**
 * `docs/ORCHESTRATOR_GAP_ANALYSIS.md` §3's own recommended ceiling, named
 * rather than buried as a literal. Three build attempts total: the first, plus
 * two corrections. On exhaustion the lead stops at QA_FAILED with its
 * outstanding findings recorded — never forced through, never silently
 * dropped, and never escalated to FAILED, because a demonstration that could
 * not be auto-corrected is a judgment call for the operator, not an
 * infrastructure error.
 */
export const MAX_BUILD_ATTEMPTS = 3

/** The source name under which a built demonstration is retained, so the QA agent can cite it like any other evidence. */
export const DEMONSTRATION_DRAFT_SOURCE = 'horus.demonstration_draft'

export type DemonstrationAttempt = {
  attempt: number
  demoSnapshotId: string
  /** Blocking anti-pattern findings from impeccable, empty when the deterministic gate passed. */
  detectorFindings: readonly string[]
  /** Issues raised by the `qa_reviewer` agent, empty when it passed or never ran. */
  agentIssues: readonly string[]
  outcome: 'passed' | 'detector_rejected' | 'agent_rejected' | 'unchecked'
}

export type AdvanceDemonstrationResult =
  | { status: 'qa_passed'; leadState: LeadState; html: string; missingFields: readonly string[]; attempts: readonly DemonstrationAttempt[] }
  | { status: 'qa_failed'; leadState: LeadState; attempts: readonly DemonstrationAttempt[]; reason: string }
  | { status: 'failed'; leadState: LeadState; reason: string; detail: string }
  /** Not an error: the lead was not in a state this step handles. Nothing was written. */
  | { status: 'skipped'; reason: string }

function businessInputFor(store: HorusStore, dataId: string): DemonstrationBusinessInput | null {
  const discovery = findDiscoverySnapshotForLead(store, dataId)
  if (!discovery) return null

  const snapshots = store.listRawSnapshotsBySource('serpapi.google_maps')
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    const candidate = extractCandidatesForRestore(snapshots[i]!.payload).find((entry) => entry.dataId === dataId)
    if (!candidate) continue
    return {
      name: candidate.name,
      category: candidate.type,
      address: candidate.address,
      phone: candidate.phone,
      website: candidate.website,
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      serviceOptions: candidate.serviceOptions,
      highlights: candidate.highlights,
      operatingHours: candidate.operatingHours,
      priceRange: candidate.priceRange,
      photoUrl: candidate.photoUrl,
    }
  }
  return null
}

/**
 * Runs one full build round: compose, render, retain, then check
 * deterministically and (only if that passes) by agent judgment.
 */
async function runOneAttempt(input: {
  store: HorusStore
  runtime: LocalAgentRuntime
  dataId: string
  business: DemonstrationBusinessInput
  evidence: readonly EvidenceReference[]
  scratchRoot: string
  attempt: number
  fixNotes: readonly string[]
  now: () => Date
  detect?: Parameters<typeof runImpeccableGate>[0]['detect']
}): Promise<
  | { kind: 'built'; attempt: DemonstrationAttempt; html: string; missingFields: readonly string[]; fixNotes: readonly string[] }
  | { kind: 'agent_failed'; reason: string; detail: string }
> {
  const composed = await runConceptComposer({
    runtime: input.runtime,
    evidence: input.evidence,
    taskId: `composer_${input.dataId}_${input.attempt}_${input.now().getTime()}`,
    fixNotes: input.fixNotes,
  })

  if (composed.status === 'failed') {
    return { kind: 'agent_failed', reason: composed.reason, detail: composed.detail }
  }

  const site = buildDemonstrationSite({
    business: input.business,
    generatedAt: input.now().toISOString(),
    composition: composed.output,
  })

  // Retained before it is judged, so the QA agent cites the exact bytes that
  // were checked (charter 14: raw artifacts are never edited or overwritten;
  // a later attempt writes a new snapshot beside this one).
  const snapshot = input.store.appendRawSnapshot({
    source: DEMONSTRATION_DRAFT_SOURCE,
    request: { dataId: input.dataId, attempt: input.attempt, composition: composed.output },
    retrievedAt: input.now().toISOString(),
    payload: { html: site.html, missingFields: site.missingFields },
  })

  // Deterministic first — cheaper, reproducible, and no agent run spent on a
  // page that fails a mechanical rule.
  const gate = await runImpeccableGate({ html: site.html, scratchRoot: input.scratchRoot, detect: input.detect })

  if (gate.status === 'failed') {
    const findings = gate.blocking.map((finding) => `[${finding.antipattern}] ${finding.name} — ${finding.description} (found: ${finding.snippet})`)
    return {
      kind: 'built',
      html: site.html,
      missingFields: site.missingFields,
      fixNotes: [describeBlockingFindings(gate.blocking)],
      attempt: { attempt: input.attempt, demoSnapshotId: snapshot.id, detectorFindings: findings, agentIssues: [], outcome: 'detector_rejected' },
    }
  }

  // `unavailable` is not a pass. The page is recorded as unchecked and the
  // loop stops rather than advancing a lead on a check that never ran
  // (charter 9.6/10.4).
  if (gate.status === 'unavailable') {
    return {
      kind: 'built',
      html: site.html,
      missingFields: site.missingFields,
      fixNotes: [],
      attempt: { attempt: input.attempt, demoSnapshotId: snapshot.id, detectorFindings: [], agentIssues: [`Anti-pattern detector could not run: ${gate.detail}`], outcome: 'unchecked' },
    }
  }

  const reviewed = await runQaReviewer({
    runtime: input.runtime,
    evidence: [
      ...input.evidence,
      { snapshotId: snapshot.id, source: DEMONSTRATION_DRAFT_SOURCE, retrievedAt: input.now().toISOString() },
    ],
    taskId: `qa_${input.dataId}_${input.attempt}_${input.now().getTime()}`,
  })

  if (reviewed.status === 'failed') {
    return { kind: 'agent_failed', reason: reviewed.reason, detail: reviewed.detail }
  }

  if (reviewed.output.status === 'QA_FAILED') {
    return {
      kind: 'built',
      html: site.html,
      missingFields: site.missingFields,
      fixNotes: reviewed.output.issues,
      attempt: { attempt: input.attempt, demoSnapshotId: snapshot.id, detectorFindings: [], agentIssues: reviewed.output.issues, outcome: 'agent_rejected' },
    }
  }

  return {
    kind: 'built',
    html: site.html,
    missingFields: site.missingFields,
    fixNotes: [],
    attempt: { attempt: input.attempt, demoSnapshotId: snapshot.id, detectorFindings: [], agentIssues: [], outcome: 'passed' },
  }
}

/**
 * Advances one QUALIFIED lead through build and QA, correcting up to
 * `MAX_BUILD_ATTEMPTS` times, and stops at QA_PASSED — the operator's own
 * DEC-004 review is the next step and this function never takes it.
 */
export async function advanceLeadDemonstration(input: {
  store: HorusStore
  runtime: LocalAgentRuntime
  dataId: string
  /** A directory under the app's own data directory; each QA run creates and removes a subdirectory of it. */
  scratchRoot: string
  now?: () => Date
  /**
   * Injectable detector, for tests only — production passes nothing and gets
   * the real impeccable engine. It exists because the rejection and
   * unavailable branches below are otherwise unreachable from a test: the
   * closed token sets in `shared/demonstration.ts` mean the generator can no
   * longer produce a page that fails the detector, which is the point of them.
   * A branch that cannot be made to fire is not a verified branch.
   */
  detect?: Parameters<typeof runImpeccableGate>[0]['detect']
}): Promise<AdvanceDemonstrationResult> {
  const now = input.now ?? (() => new Date())
  const current = readLeadState(input.store, input.dataId)

  if (current.status !== 'QUALIFIED' && current.status !== 'QA_FAILED') {
    return { status: 'skipped', reason: `Lead "${input.dataId}" is "${current.status}" — demonstration build applies to a QUALIFIED lead, or a QA_FAILED one being retried.` }
  }

  const evidenceResult = assembleLeadEvidence(input.store, input.dataId)
  if (evidenceResult.status === 'not_found') {
    return { status: 'skipped', reason: evidenceResult.reason }
  }

  const business = businessInputFor(input.store, input.dataId)
  if (!business) {
    return { status: 'skipped', reason: `No retained listing fields for data_id "${input.dataId}" — nothing to build a demonstration from.` }
  }

  const attempts: DemonstrationAttempt[] = []
  let fixNotes: readonly string[] = []

  for (let attempt = 1; attempt <= MAX_BUILD_ATTEMPTS; attempt += 1) {
    appendValidatedLeadStatus(input.store, input.dataId, 'WEBSITE_GENERATING', {
      occurredAt: now().toISOString(),
      detail: attempt === 1 ? 'First build attempt.' : `Correction attempt ${attempt} of ${MAX_BUILD_ATTEMPTS}.`,
    })

    const round = await runOneAttempt({
      store: input.store,
      runtime: input.runtime,
      dataId: input.dataId,
      business,
      evidence: evidenceResult.evidence,
      scratchRoot: input.scratchRoot,
      attempt,
      fixNotes,
      now,
      detect: input.detect,
    })

    if (round.kind === 'agent_failed') {
      const leadState = appendValidatedLeadStatus(input.store, input.dataId, 'FAILED', {
        occurredAt: now().toISOString(),
        detail: `Demonstration build failed: ${round.reason} — ${round.detail}`,
      })
      return { status: 'failed', leadState, reason: round.reason, detail: round.detail }
    }

    attempts.push(round.attempt)

    appendValidatedLeadStatus(input.store, input.dataId, 'WEBSITE_GENERATED', {
      occurredAt: now().toISOString(),
      detail: `Attempt ${attempt} built and retained as ${round.attempt.demoSnapshotId}.`,
    })
    appendValidatedLeadStatus(input.store, input.dataId, 'QA_IN_PROGRESS', { occurredAt: now().toISOString() })

    if (round.attempt.outcome === 'passed') {
      const leadState = appendValidatedLeadStatus(input.store, input.dataId, 'QA_PASSED', {
        occurredAt: now().toISOString(),
        detail: `Passed the anti-pattern detector and QA review on attempt ${attempt}. Awaiting the operator's own review.`,
      })
      return { status: 'qa_passed', leadState, html: round.html, missingFields: round.missingFields, attempts }
    }

    const summary = round.attempt.outcome === 'detector_rejected'
      ? `Anti-pattern detector rejected attempt ${attempt}: ${round.attempt.detectorFindings.join(' ')}`
      : round.attempt.outcome === 'unchecked'
        ? `Attempt ${attempt} could not be checked: ${round.attempt.agentIssues.join(' ')}`
        : `QA review rejected attempt ${attempt}: ${round.attempt.agentIssues.join(' ')}`

    const leadState = appendValidatedLeadStatus(input.store, input.dataId, 'QA_FAILED', {
      occurredAt: now().toISOString(),
      detail: summary,
    })

    // An unrunnable detector is not something a fix pass can resolve — retrying
    // would just spend agent runs reproducing the same unchecked result.
    if (round.attempt.outcome === 'unchecked') {
      return { status: 'qa_failed', leadState, attempts, reason: summary }
    }

    if (attempt === MAX_BUILD_ATTEMPTS) {
      return {
        status: 'qa_failed',
        leadState,
        attempts,
        reason: `Stopped after ${MAX_BUILD_ATTEMPTS} attempts with findings still outstanding. ${summary}`,
      }
    }

    fixNotes = round.fixNotes
  }

  // Unreachable: the loop either returns or exhausts its attempts above. Kept
  // as a total function rather than a non-null assertion.
  return { status: 'skipped', reason: 'No build attempt ran.' }
}
