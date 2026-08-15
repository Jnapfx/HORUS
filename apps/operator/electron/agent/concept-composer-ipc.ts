/**
 * DEC-129. Wires the composer boundary (`runtime.ts`, `concept-composer-task.ts`)
 * to a single function the Electron main process can call from an IPC handler
 * — the same shape `analyst-ipc.ts` already established for DEC-065.
 *
 * Kept separate from `main.ts` so it is testable without Electron. Produces
 * no side effect other than the optional draft save, exactly like
 * `runOpportunityAnalyst` — DEC-045 applies here identically: a composed
 * result is inert data for the operator to review inside the demonstration
 * preview, never something this function publishes or persists as a public
 * fact.
 */

import { assertTaskIsBounded, type AgentRunRecord, type EvidenceReference, type LocalAgentRuntime } from './runtime.js'
import { buildConceptComposerTask, type ComposerOutput, parseComposerOutput } from './concept-composer-task.js'

export type ComposerRunResult =
  | { status: 'awaiting_operator_review'; record: AgentRunRecord; output: ComposerOutput }
  | { status: 'failed'; record: AgentRunRecord; reason: string; detail: string }

export async function runConceptComposer(input: {
  runtime: LocalAgentRuntime
  evidence: readonly EvidenceReference[]
  taskId: string
  maxTurns?: number
  timeoutMs?: number
  /** DEC-140. Findings from a prior rejected round, for the Orchestrator's fix pass. Absent for a first attempt. */
  fixNotes?: readonly string[]
}): Promise<ComposerRunResult> {
  const task = buildConceptComposerTask({
    taskId: input.taskId,
    evidence: input.evidence,
    maxTurns: input.maxTurns,
    timeoutMs: input.timeoutMs,
    fixNotes: input.fixNotes,
  })

  // Guarded here, not left to the runtime, matching `runOpportunityAnalyst`'s
  // own fail-fast behavior for a malformed task.
  assertTaskIsBounded(task)

  const outcome = await input.runtime.run(task)

  if (outcome.status === 'failed') {
    return { status: 'failed', record: outcome.record, reason: outcome.reason, detail: outcome.detail }
  }

  let parsed: ComposerOutput
  try {
    parsed = parseComposerOutput(outcome.output, task)
  } catch (error) {
    return {
      status: 'failed',
      record: outcome.record,
      reason: 'invalid_output',
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  return { status: 'awaiting_operator_review', record: outcome.record, output: parsed }
}
