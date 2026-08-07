/**
 * Wires the analyst boundary (`runtime.ts`, `analyst-task.ts`) to a single
 * function the Electron main process can call from an IPC handler — DEC-065.
 *
 * Kept separate from `main.ts` so it is testable without Electron: every
 * dependency (`runtime`, evidence, ids/clock) is passed in, exactly like the
 * rest of this codebase's dependency-injection pattern (`SpawnImpl`,
 * `PrepareIsolatedWorkingDirectory`).
 *
 * This function never writes anything. Its result is inert data for the
 * renderer to display; nothing here saves a draft, advances a workflow step,
 * or requests approval. Per DEC-045, only explicit, already-gated operator
 * actions elsewhere in the codebase do that.
 */

import { assertTaskIsBounded, type AgentRunRecord, type EvidenceReference, type LocalAgentRuntime } from './runtime.js'
import { type AnalystOutput, buildAnalystTask, parseAnalystOutput } from './analyst-task.js'

export type AnalystRunResult =
  | { status: 'awaiting_operator_review'; record: AgentRunRecord; output: AnalystOutput }
  | { status: 'failed'; record: AgentRunRecord; reason: string; detail: string }

export async function runOpportunityAnalyst(input: {
  runtime: LocalAgentRuntime
  evidence: readonly EvidenceReference[]
  taskId: string
  maxTurns?: number
  timeoutMs?: number
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

  try {
    const parsed = parseAnalystOutput(outcome.output, task)
    return { status: 'awaiting_operator_review', record: outcome.record, output: parsed }
  } catch (error) {
    return {
      status: 'failed',
      record: outcome.record,
      reason: 'invalid_output',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
