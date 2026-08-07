/**
 * Provider-neutral local agent boundary — AGENT_ARCHITECTURE sections 2, 3, 6,
 * 7, 8 and 9, recorded as DEC-049.
 *
 * Claude supplies reasoning and drafting only. Nothing in this module can
 * advance a prospect, create an approval, publish, open Gmail, or declare
 * delivery: an `AgentRunOutcome` is inert data that the operator reviews.
 *
 * The runtime is expressed as an interface so a later version can substitute the
 * Anthropic API, another hosted provider, or a local model without touching the
 * workflow and approval layers (section 7).
 *
 * Verified against Anthropic's published CLI documentation on 2026-08-07, not
 * against a live run. See DEC-056. Two documented behaviours shaped this file:
 *
 * 1. `--output-format json` returns an envelope whose text is in `result`, with
 *    `session_id` and `total_cost_usd` alongside it. When `--json-schema` is
 *    supplied, schema-conforming output arrives in `structured_output` instead
 *    of being buried in prose. HORUS uses the schema form.
 * 2. `--bare` is Anthropic's recommended mode for scripted calls, and HORUS must
 *    NOT use it: bare mode does not use the subscription login and requires
 *    `ANTHROPIC_API_KEY`, which DEC-045 explicitly refuses for this pilot.
 *
 * Not using `--bare` means Claude Code would otherwise auto-discover the
 * current working directory's `CLAUDE.md`, hooks, plugins and MCP servers —
 * and this repository has a `CLAUDE.md` written for a human maintaining
 * HORUS, not for a bounded analyst reasoning over supplied evidence. DEC-057
 * closes that gap two ways: `--system-prompt` replaces the default system
 * prompt outright with the task's own instruction, and every run gets a fresh
 * working directory that HORUS creates and that never contains a `CLAUDE.md`,
 * `.claude/` directory, hooks, or plugins.
 */

export type AgentRole = 'opportunity_analyst' | 'concept_composer' | 'outreach_composer'

/** Section 9. Every state a run can end in other than a reviewable result. */
export type AgentFailureReason =
  | 'runtime_not_installed'
  | 'authentication_required'
  | 'usage_limit_reached'
  | 'timeout'
  | 'cancelled'
  | 'invalid_output'
  | 'tool_denied'
  | 'evidence_missing'

/**
 * Section 6. No agent may ever hold these, whatever a task requests. Matching is
 * on substrings so that a renamed but equivalent tool is still caught.
 */
export const FORBIDDEN_TOOL_PATTERNS = [
  'send_email',
  'send_message',
  'publish',
  'deploy',
  'delete_deployment',
  'retire_deployment',
  'read_credential',
  'read_secret',
  'set_model_parameter',
  'write_evidence',
  'overwrite_evidence',
] as const

export type EvidenceReference = {
  snapshotId: string
  source: string
  retrievedAt: string
}

/** Section 3. An agent is a task, its evidence, its tools, its schema and its limits. */
export type BoundedAgentTask = {
  taskId: string
  role: AgentRole
  instructionVersion: string
  instruction: string
  evidence: readonly EvidenceReference[]
  allowedTools: readonly string[]
  limits: { maxTurns: number; timeoutMs: number }
  /** JSON Schema passed to `--json-schema`, so the runtime returns `structured_output`. */
  outputSchema: Record<string, unknown>
}

export type AgentAvailability =
  | { available: true; runtimeId: string; version: string }
  | { available: false; reason: Extract<AgentFailureReason, 'runtime_not_installed' | 'authentication_required' | 'usage_limit_reached'>; detail: string }

/** Section 8. Recorded for every execution, success or failure. */
export type AgentRunRecord = {
  taskId: string
  role: AgentRole
  instructionVersion: string
  runtimeId: string
  startedAt: string
  completedAt: string
  evidenceIds: readonly string[]
  toolsOffered: readonly string[]
  turnsUsed: number | null
  /** Documented fields of the `--output-format json` envelope, when present. */
  sessionId: string | null
  totalCostUsd: number | null
}

export type AgentRunOutcome =
  | { status: 'awaiting_operator_review'; record: AgentRunRecord; output: unknown }
  | { status: 'failed'; record: AgentRunRecord; reason: AgentFailureReason; detail: string }

export interface LocalAgentRuntime {
  readonly runtimeId: string
  checkAvailability(): Promise<AgentAvailability>
  run(task: BoundedAgentTask): Promise<AgentRunOutcome>
}

export class AgentTaskRejected extends Error {
  readonly reason: AgentFailureReason

  constructor(reason: AgentFailureReason, message: string) {
    super(message)
    this.name = 'AgentTaskRejected'
    this.reason = reason
  }
}

/**
 * Validated before a runtime is contacted, so a malformed or over-privileged
 * task never reaches a subprocess.
 */
export function assertTaskIsBounded(task: BoundedAgentTask): void {
  if (!task.taskId.trim()) throw new AgentTaskRejected('invalid_output', 'A task requires an id')
  if (!task.instruction.trim()) throw new AgentTaskRejected('invalid_output', 'A task requires an instruction')
  if (!task.instructionVersion.trim()) throw new AgentTaskRejected('invalid_output', 'A task requires an instruction version')

  if (task.evidence.length === 0) {
    throw new AgentTaskRejected('evidence_missing', 'A task requires at least one retained evidence reference')
  }
  task.evidence.forEach((reference) => {
    if (!reference.snapshotId.trim()) throw new AgentTaskRejected('evidence_missing', 'Every evidence reference requires a snapshot id')
    if (Number.isNaN(Date.parse(reference.retrievedAt))) {
      throw new AgentTaskRejected('evidence_missing', `Evidence ${reference.snapshotId} has an invalid retrieval timestamp`)
    }
  })

  const forbidden = task.allowedTools.find((tool) =>
    FORBIDDEN_TOOL_PATTERNS.some((pattern) => tool.toLowerCase().includes(pattern)),
  )
  if (forbidden) {
    throw new AgentTaskRejected('tool_denied', `Tool "${forbidden}" is never available to an agent`)
  }

  if (!Number.isInteger(task.limits.maxTurns) || task.limits.maxTurns < 1) {
    throw new AgentTaskRejected('invalid_output', 'maxTurns must be a positive integer')
  }
  if (!Number.isInteger(task.limits.timeoutMs) || task.limits.timeoutMs < 1) {
    throw new AgentTaskRejected('invalid_output', 'timeoutMs must be a positive integer')
  }
}

export type SpawnResult = {
  code: number | null
  stdout: string
  stderr: string
  timedOut?: boolean
}

/**
 * Section 2: the executable is spawned with an explicit argument array. There is
 * deliberately no string-composed command anywhere in this module. `cwd` is
 * always the isolated directory from `prepareIsolatedWorkingDirectory` (DEC-057)
 * — never the HORUS repository, which has its own `CLAUDE.md`.
 */
export type SpawnImpl = (
  executable: string,
  args: readonly string[],
  options: { timeoutMs: number; cwd: string },
) => Promise<SpawnResult>

/**
 * The `-p` prompt is deliberately minimal. The task's actual rules travel in
 * `--system-prompt`, which replaces Claude Code's default system prompt rather
 * than appending to it (DEC-057). Reaching evidence still goes through the
 * `read_evidence_snapshot` tool, not by inlining evidence content here — but
 * DEC-061 found live that the *ids* themselves have to be named somewhere, or
 * the runtime has no way to know what to ask the tool for. A first live run
 * with only a count ("analyze the 2 referenced evidence snapshot(s)") produced
 * two guessed, nonexistent ids and an honest "cannot find them" report — a
 * correct response to a prompt that had, in fact, withheld the one thing it
 * claimed to reference.
 */
export function buildKickoffPrompt(task: BoundedAgentTask): string {
  const ids = task.evidence.map((reference) => reference.snapshotId).join(', ')
  return `Task ${task.taskId}: analyze the following evidence snapshot id(s) using only the allowed tools, then return the required JSON. Evidence snapshot ids: ${ids}`
}

/**
 * DEC-059. Describes one real MCP server this runtime can offer a task, and how
 * a `BoundedAgentTask.allowedTools` entry maps onto the `mcp__<server>__<tool>`
 * name Claude Code expects (see section "Tool naming convention" in Anthropic's
 * MCP docs). `toolNameMap` only ever grows entries for tools that genuinely
 * exist behind `command`; a task naming a tool with no entry here gets nothing
 * added to `--allowedTools` for it; `--permission-mode dontAsk` then denies it,
 * exactly as DEC-058 describes for every tool that isn't wired yet.
 */
export type McpServerWiring = {
  serverName: string
  command: string
  args: readonly string[]
  env: Readonly<Record<string, string>>
  toolNameMap: ReadonlyMap<string, string>
}

function buildMcpConfigArgs(task: BoundedAgentTask, wiring: McpServerWiring | undefined): readonly string[] {
  if (!wiring) return []

  const allowed = task.allowedTools
    .map((tool) => wiring.toolNameMap.get(tool))
    .filter((name): name is string => name !== undefined)
  if (allowed.length === 0) return []

  const mcpConfig = {
    mcpServers: {
      [wiring.serverName]: { command: wiring.command, args: [...wiring.args], env: { ...wiring.env } },
    },
  }
  return ['--mcp-config', JSON.stringify(mcpConfig), '--allowedTools', allowed.join(',')]
}

export function buildClaudeCodeArgs(task: BoundedAgentTask, evidenceTools?: McpServerWiring): readonly string[] {
  // Deliberately no `--bare`: it would bypass the subscription login and demand
  // an API key, which DEC-045 refuses. --system-prompt and the isolated cwd
  // (DEC-057) are what make that safe to omit.
  //
  // `--permission-mode dontAsk` denies anything not explicitly allowed (DEC-058).
  // `evidenceTools`, when supplied, is the one real capability allow-listed on
  // top of that floor (DEC-059); everything else in task.allowedTools that has
  // no wiring here still resolves to no access, exactly as DEC-058 documented.
  return [
    '-p',
    buildKickoffPrompt(task),
    '--system-prompt',
    task.instruction,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(task.outputSchema),
    '--max-turns',
    String(task.limits.maxTurns),
    '--permission-mode',
    'dontAsk',
    ...buildMcpConfigArgs(task, evidenceTools),
  ]
}

/**
 * Documented behaviour this relies on: exit code 0 on success and non-zero on
 * failure; SIGTERM produces 143; and a failure inside the run, such as missing
 * authentication, is printed as the result on stdout rather than stderr — which
 * is why stdout is inspected even when the exit code is 0.
 *
 * The specific error wording is still not verified against a live run.
 */
export function classifyFailure(result: SpawnResult): { reason: AgentFailureReason; detail: string } | null {
  if (result.timedOut) return { reason: 'timeout', detail: 'The runtime exceeded its time limit.' }
  if (result.code === 143) return { reason: 'cancelled', detail: 'The runtime was terminated before completing.' }

  const text = `${result.stderr}\n${result.stdout}`.toLowerCase()
  const authFailed = text.includes('not logged in') || text.includes('authentication_failed')
    || text.includes('authentication') || text.includes('unauthorized') || text.includes('invalid api key')
  const limited = text.includes('usage limit') || text.includes('rate_limit') || text.includes('rate limit')
    || text.includes('quota') || text.includes('billing_error')

  // A run can exit 0 and still report a failure in the result payload.
  if (result.code === 0) {
    if (authFailed) return { reason: 'authentication_required', detail: 'Claude Code requires a valid local login.' }
    if (limited) return { reason: 'usage_limit_reached', detail: 'The subscription usage limit was reached.' }
    return null
  }

  if (text.includes('command not found') || text.includes('enoent')) {
    return { reason: 'runtime_not_installed', detail: 'Claude Code was not found on this machine.' }
  }
  if (authFailed) return { reason: 'authentication_required', detail: 'Claude Code requires a valid local login.' }
  if (limited) return { reason: 'usage_limit_reached', detail: 'The subscription usage limit was reached.' }
  return { reason: 'invalid_output', detail: `The runtime exited with code ${result.code}.` }
}

/**
 * Creates a fresh, empty directory for one run and returns its path. Never
 * reuses a directory across runs and never points at the HORUS repository:
 * that repository's `CLAUDE.md`, hooks and plugins are exactly what an agent
 * run must not inherit (DEC-057). The caller owns cleanup; `prepareRoot`
 * defaults to the OS temp directory so a missing caller-supplied root still
 * produces a workable location rather than a thrown error.
 */
export type PrepareIsolatedWorkingDirectory = (taskId: string) => Promise<string>

export type ClaudeCodeRuntimeOptions = {
  spawnImpl: SpawnImpl
  prepareWorkingDirectory: PrepareIsolatedWorkingDirectory
  executable?: string
  now?: () => Date
  /** DEC-059. Omit to run with no real tools available, per DEC-058. */
  evidenceTools?: McpServerWiring
}

export function createClaudeCodeRuntime(options: ClaudeCodeRuntimeOptions): LocalAgentRuntime {
  const executable = options.executable ?? 'claude'
  const now = options.now ?? (() => new Date())
  const runtimeId = 'claude-code-local'

  return {
    runtimeId,

    async checkAvailability(): Promise<AgentAvailability> {
      const cwd = await options.prepareWorkingDirectory('availability-check')
      const result = await options.spawnImpl(executable, ['--version'], { timeoutMs: 10_000, cwd })
      const failure = classifyFailure(result)
      if (failure) {
        const reason = failure.reason === 'authentication_required' || failure.reason === 'usage_limit_reached'
          ? failure.reason
          : 'runtime_not_installed'
        return { available: false, reason, detail: failure.detail }
      }
      return { available: true, runtimeId, version: result.stdout.trim() }
    },

    async run(task: BoundedAgentTask): Promise<AgentRunOutcome> {
      assertTaskIsBounded(task)

      const startedAt = now().toISOString()
      const baseRecord = {
        taskId: task.taskId,
        role: task.role,
        instructionVersion: task.instructionVersion,
        runtimeId,
        startedAt,
        evidenceIds: task.evidence.map((reference) => reference.snapshotId),
        toolsOffered: [...task.allowedTools],
      }

      const cwd = await options.prepareWorkingDirectory(task.taskId)
      const args = buildClaudeCodeArgs(task, options.evidenceTools)
      const result = await options.spawnImpl(executable, args, { timeoutMs: task.limits.timeoutMs, cwd })
      const completedAt = now().toISOString()

      const emptyMetadata = { completedAt, turnsUsed: null, sessionId: null, totalCostUsd: null }
      const failure = classifyFailure(result)
      if (failure) {
        return { status: 'failed', record: { ...baseRecord, ...emptyMetadata }, ...failure }
      }

      let envelope: Record<string, unknown>
      try {
        const parsed: unknown = JSON.parse(result.stdout)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
        envelope = parsed as Record<string, unknown>
      } catch {
        return {
          status: 'failed',
          record: { ...baseRecord, ...emptyMetadata },
          reason: 'invalid_output',
          detail: 'The runtime did not return a parseable JSON object.',
        }
      }

      const readNumber = (key: string) => (typeof envelope[key] === 'number' ? (envelope[key] as number) : null)
      const readString = (key: string) => (typeof envelope[key] === 'string' ? (envelope[key] as string) : null)
      const metadata = {
        completedAt,
        turnsUsed: readNumber('num_turns'),
        sessionId: readString('session_id'),
        totalCostUsd: readNumber('total_cost_usd'),
      }

      // With `--json-schema`, conforming output arrives in `structured_output`.
      // Its absence means the runtime answered in prose, which is a failure for a
      // task whose entire contract is a schema.
      if (!('structured_output' in envelope)) {
        return {
          status: 'failed',
          record: { ...baseRecord, ...metadata },
          reason: 'invalid_output',
          detail: 'The runtime returned no structured_output for a schema-constrained task.',
        }
      }

      return {
        status: 'awaiting_operator_review',
        record: { ...baseRecord, ...metadata },
        output: envelope.structured_output,
      }
    },
  }
}
