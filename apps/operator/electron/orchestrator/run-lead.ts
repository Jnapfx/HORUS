/**
 * DEC-131. The deterministic Orchestrator itself — `docs/ORCHESTRATOR_GAP_ANALYSIS.md`
 * §3's "smallest safe piece first": this phase wires exactly one step,
 * DISCOVERED -> QUALIFYING -> QUALIFIED/REJECTED/FAILED, using the
 * Qualification Agent built alongside this file. Website generation and QA
 * are deliberately not wired into this dispatcher yet — `buildDemonstrationSite`
 * lives under `src/domain/`, which `tsconfig.electron.json` cannot import
 * (the same rootDir boundary `lead-state.ts`'s comment explains), and
 * generation today runs client-side in `ProspectRecord.tsx`. Chaining that
 * step into a headless Orchestrator needs a real design decision — either
 * reimplementing demo generation under `electron/`, or having the main
 * process ask the running renderer to generate and report back over IPC —
 * that has not been made yet. See `docs/DECISIONS.md` DEC-131's
 * "Not yet wired" note.
 *
 * Every transition is written by this module alone, through
 * `appendValidatedLeadStatus`, which itself refuses anything
 * `lead-state.ts#isValidLeadTransition` disallows. The Qualification Agent
 * never calls `appendEvent` and is never given a tool that could — it only
 * returns a score and a decision for this module to act on (DEC-130). That
 * split is what keeps DEC-130's narrow reversal narrow: the agent computes a
 * number, HORUS still owns every write.
 */

import { assembleLeadEvidence } from './lead-evidence.js'
import { appendOperatorRetryFromFailed, appendValidatedLeadStatus, readLeadState } from './lead-store.js'
import type { LeadState } from './lead-state.js'
import type { EvidenceReference, LocalAgentRuntime } from '../agent/runtime.js'
import { runQualificationAgent } from '../agent/qualification-ipc.js'
import type { QualificationOutput } from '../agent/qualification-task.js'
import type { HorusStore } from '../persistence.js'

export type AdvanceQualificationResult =
  | { status: 'qualified'; leadState: LeadState; output: QualificationOutput }
  | { status: 'rejected'; leadState: LeadState; output: QualificationOutput }
  | { status: 'failed'; leadState: LeadState; reason: string; detail: string }
  /** Not an error: the lead was not in a state this step handles, or has no retained evidence yet. Nothing was written. */
  | { status: 'skipped'; reason: string }

function summarizeReasons(output: QualificationOutput): string {
  return output.reasons.map((reason) => reason.text).join(' ')
}

/**
 * DEC-137. The part of `advanceLeadQualification` and `retryLeadQualification`
 * that is identical once a lead is already sitting at QUALIFYING: run the
 * agent, then write whatever it decided (or that it failed) through the
 * normal, always-allowed QUALIFYING -> QUALIFIED/REJECTED/FAILED edges. Which
 * status a lead had to be in *before* QUALIFYING — DISCOVERED for a first
 * attempt, FAILED for a retry — is each caller's own concern, checked and
 * written by that caller before this runs.
 */
async function runQualificationAndRecord(input: {
  store: HorusStore
  runtime: LocalAgentRuntime
  dataId: string
  evidence: readonly EvidenceReference[]
  now: () => Date
}): Promise<AdvanceQualificationResult> {
  const outcome = await runQualificationAgent({
    runtime: input.runtime,
    evidence: input.evidence,
    taskId: `qualification_${input.dataId}_${input.now().getTime()}`,
  })

  if (outcome.status === 'failed') {
    const leadState = appendValidatedLeadStatus(input.store, input.dataId, 'FAILED', {
      occurredAt: input.now().toISOString(),
      detail: `Qualification agent failed: ${outcome.reason} — ${outcome.detail}`,
    })
    return { status: 'failed', leadState, reason: outcome.reason, detail: outcome.detail }
  }

  const nextStatus = outcome.output.qualified ? 'QUALIFIED' : 'REJECTED'
  const leadState = appendValidatedLeadStatus(input.store, input.dataId, nextStatus, {
    occurredAt: input.now().toISOString(),
    detail: `Score ${outcome.output.opportunityScore}/100. ${summarizeReasons(outcome.output)}`,
  })

  return nextStatus === 'QUALIFIED'
    ? { status: 'qualified', leadState, output: outcome.output }
    : { status: 'rejected', leadState, output: outcome.output }
}

export async function advanceLeadQualification(input: {
  store: HorusStore
  runtime: LocalAgentRuntime
  dataId: string
  now?: () => Date
}): Promise<AdvanceQualificationResult> {
  const now = input.now ?? (() => new Date())
  const current = readLeadState(input.store, input.dataId)

  if (current.status !== 'DISCOVERED') {
    return { status: 'skipped', reason: `Lead "${input.dataId}" is "${current.status}", not "DISCOVERED" — qualification does not apply.` }
  }

  const evidenceResult = assembleLeadEvidence(input.store, input.dataId)
  if (evidenceResult.status === 'not_found') {
    return { status: 'skipped', reason: evidenceResult.reason }
  }

  appendValidatedLeadStatus(input.store, input.dataId, 'QUALIFYING', { occurredAt: now().toISOString() })

  return runQualificationAndRecord({ store: input.store, runtime: input.runtime, dataId: input.dataId, evidence: evidenceResult.evidence, now })
}

/**
 * DEC-137. The operator's own explicit "reintentar" action for a lead stuck
 * at FAILED — a timeout or other infra failure is not a business judgment,
 * and `lead-state.ts` deliberately gives FAILED no automatic way out. Only
 * this function, called only from a button the operator presses, may move a
 * FAILED lead back to QUALIFYING (`appendOperatorRetryFromFailed`); nothing
 * in the automated pipeline calls it on its own. Everything after that point
 * — running the agent, recording QUALIFIED/REJECTED/FAILED — is identical to
 * a first attempt, because it *is* a first attempt at qualification, just one
 * the operator asked for a second time.
 */
export async function retryLeadQualification(input: {
  store: HorusStore
  runtime: LocalAgentRuntime
  dataId: string
  now?: () => Date
}): Promise<AdvanceQualificationResult> {
  const now = input.now ?? (() => new Date())
  const current = readLeadState(input.store, input.dataId)

  if (current.status !== 'FAILED') {
    return { status: 'skipped', reason: `Lead "${input.dataId}" is "${current.status}", not "FAILED" — there is nothing to retry.` }
  }

  const evidenceResult = assembleLeadEvidence(input.store, input.dataId)
  if (evidenceResult.status === 'not_found') {
    return { status: 'skipped', reason: evidenceResult.reason }
  }

  appendOperatorRetryFromFailed(input.store, input.dataId, { occurredAt: now().toISOString(), detail: 'Retried by the operator after a prior failure.' })

  return runQualificationAndRecord({ store: input.store, runtime: input.runtime, dataId: input.dataId, evidence: evidenceResult.evidence, now })
}
