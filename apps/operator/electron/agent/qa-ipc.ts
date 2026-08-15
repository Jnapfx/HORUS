/** DEC-131. Wires the QA boundary to a single function, mirroring `analyst-ipc.ts`/`qualification-ipc.ts`. No draft persistence — the Orchestrator writes the result straight into the lead's own event history. */

import { assertTaskIsBounded, type AgentRunRecord, type EvidenceReference, type LocalAgentRuntime } from './runtime.js'
import { buildQaTask, type QaOutput, parseQaOutput } from './qa-task.js'

export type QaRunResult =
  | { status: 'awaiting_operator_review'; record: AgentRunRecord; output: QaOutput }
  | { status: 'failed'; record: AgentRunRecord; reason: string; detail: string }

export async function runQaReviewer(input: {
  runtime: LocalAgentRuntime
  evidence: readonly EvidenceReference[]
  taskId: string
  maxTurns?: number
  timeoutMs?: number
}): Promise<QaRunResult> {
  const task = buildQaTask({
    taskId: input.taskId,
    evidence: input.evidence,
    maxTurns: input.maxTurns,
    timeoutMs: input.timeoutMs,
  })

  assertTaskIsBounded(task)

  const outcome = await input.runtime.run(task)

  if (outcome.status === 'failed') {
    return { status: 'failed', record: outcome.record, reason: outcome.reason, detail: outcome.detail }
  }

  let parsed: QaOutput
  try {
    parsed = parseQaOutput(outcome.output, task)
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
