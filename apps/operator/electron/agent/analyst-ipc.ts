/**
 * Wires the analyst boundary (`runtime.ts`, `analyst-task.ts`) to a single
 * function the Electron main process can call from an IPC handler — DEC-065.
 *
 * Kept separate from `main.ts` so it is testable without Electron: every
 * dependency (`runtime`, evidence, ids/clock) is passed in, exactly like the
 * rest of this codebase's dependency-injection pattern (`SpawnImpl`,
 * `PrepareIsolatedWorkingDirectory`).
 *
 * This function never advances a workflow step or requests approval. Per
 * DEC-045, only explicit, already-gated operator actions elsewhere in the
 * codebase do that. It may persist a draft (DEC-067) — but only through the
 * optional `saveDraft` callback, and only after `parseAnalystOutput` has
 * already accepted the result. A run's raw, unvalidated output is never
 * written anywhere; what `save_agent_draft` resolves to is HORUS's own code
 * saving what already passed the same validation gate the renderer sees.
 */

import { assertTaskIsBounded, type AgentRunRecord, type EvidenceReference, type LocalAgentRuntime } from './runtime.js'
import { type AnalystOutput, buildAnalystTask, parseAnalystOutput } from './analyst-task.js'

export type AnalystRunResult =
  | { status: 'awaiting_operator_review'; record: AgentRunRecord; output: AnalystOutput; draftId: string | null }
  | { status: 'failed'; record: AgentRunRecord; reason: string; detail: string }

export async function runOpportunityAnalyst(input: {
  runtime: LocalAgentRuntime
  evidence: readonly EvidenceReference[]
  taskId: string
  maxTurns?: number
  timeoutMs?: number
  /** DEC-067. Called only with an already-validated output; omit to skip persistence. */
  saveDraft?: (draft: { taskId: string; createdAt: string; output: AnalystOutput }) => { id: string }
  now?: () => Date
}): Promise<AnalystRunResult> {
  const task = buildAnalystTask({
    taskId: input.taskId,
    evidence: input.evidence,
    maxTurns: input.maxTurns,
    timeoutMs: input.timeoutMs,
  })

  // Guarded here, not left to the runtime, so every caller — real or fake —
  // gets the same fail-fast behavior for a malformed task.
  assertTaskIsBounded(task)

  const outcome = await input.runtime.run(task)

  if (outcome.status === 'failed') {
    return { status: 'failed', record: outcome.record, reason: outcome.reason, detail: outcome.detail }
  }

  let parsed: AnalystOutput
  try {
    parsed = parseAnalystOutput(outcome.output, task)
  } catch (error) {
    return {
      status: 'failed',
      record: outcome.record,
      reason: 'invalid_output',
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  const now = input.now ?? (() => new Date())
  const draftId = input.saveDraft
    ? input.saveDraft({ taskId: task.taskId, createdAt: now().toISOString(), output: parsed }).id
    : null

  return { status: 'awaiting_operator_review', record: outcome.record, output: parsed, draftId }
}
