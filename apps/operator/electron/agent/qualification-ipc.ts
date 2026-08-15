/**
 * DEC-130/DEC-131. Wires the qualification boundary to a single function,
 * mirroring `analyst-ipc.ts` exactly. No draft persistence — the result is
 * written straight to the lead's own event history by the Orchestrator
 * (`electron/orchestrator/run-lead.ts`), which is this role's real record,
 * not a separate drafts table.
 */

import { assertTaskIsBounded, type AgentRunRecord, type EvidenceReference, type LocalAgentRuntime } from './runtime.js'
import { buildQualificationTask, type QualificationOutput, parseQualificationOutput } from './qualification-task.js'

export type QualificationRunResult =
  | { status: 'awaiting_operator_review'; record: AgentRunRecord; output: QualificationOutput }
  | { status: 'failed'; record: AgentRunRecord; reason: string; detail: string }

export async function runQualificationAgent(input: {
  runtime: LocalAgentRuntime
  evidence: readonly EvidenceReference[]
  taskId: string
  maxTurns?: number
  timeoutMs?: number
}): Promise<QualificationRunResult> {
  const task = buildQualificationTask({
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

  let parsed: QualificationOutput
  try {
    parsed = parseQualificationOutput(outcome.output, task)
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
