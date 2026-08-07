import { describe, expect, it } from 'vitest'
import { ANALYST_TOOLS, buildAnalystTask, parseAnalystOutput } from '../electron/agent/analyst-task'
import { createEvidenceToolWiring } from '../electron/agent/evidence-tool-wiring'
import {
  AgentTaskRejected,
  assertTaskIsBounded,
  buildClaudeCodeArgs,
  classifyFailure,
  createClaudeCodeRuntime,
  type McpServerWiring,
  type SpawnImpl,
  type SpawnResult,
} from '../electron/agent/runtime'

const evidence = [
  { snapshotId: 'raw_1', source: 'serpapi', retrievedAt: '2026-08-07T12:00:00.000Z' },
  { snapshotId: 'raw_2', source: 'pagespeed', retrievedAt: '2026-08-07T12:05:00.000Z' },
]

function task(overrides: Partial<Parameters<typeof buildAnalystTask>[0]> = {}) {
  return buildAnalystTask({ taskId: 'task_1', evidence, ...overrides })
}

function spawnReturning(result: Partial<SpawnResult>): SpawnImpl {
  return async () => ({ code: 0, stdout: '', stderr: '', ...result })
}

const prepareWorkingDirectory = async (taskId: string) => `/tmp/horus-agent-runs/${taskId}`

describe('bounded agent task', () => {
  it('never offers a tool that could contact, publish or read a credential', () => {
    const forbidden = ['send_email', 'publish_demonstration', 'read_credential_value', 'set_model_parameter_v2']

    forbidden.forEach((tool) => {
      expect(() => assertTaskIsBounded({ ...task(), allowedTools: [tool] })).toThrow(AgentTaskRejected)
      expect(() => assertTaskIsBounded({ ...task(), allowedTools: [tool] })).toThrow(/never available to an agent/)
    })

    expect(ANALYST_TOOLS).not.toContain('publish')
    expect(() => assertTaskIsBounded(task())).not.toThrow()
  })

  it('refuses to run without retained evidence', () => {
    expect(() => assertTaskIsBounded({ ...task(), evidence: [] })).toThrow(/at least one retained evidence reference/)
    expect(() => assertTaskIsBounded({
      ...task(),
      evidence: [{ snapshotId: 'raw_1', source: 'serpapi', retrievedAt: 'whenever' }],
    })).toThrow(/invalid retrieval timestamp/)
  })

  it('spawns with an explicit argument array, a schema, a replaced system prompt, and never --bare', () => {
    const args = buildClaudeCodeArgs(task())

    expect(Array.isArray(args)).toBe(true)
    expect(args[0]).toBe('-p')
    expect(args).toContain('--output-format')
    expect(args).toContain('json')
    expect(args).toContain('--json-schema')
    expect(args).toContain('--max-turns')
    expect(args.join(' ')).not.toContain('&&')
    // --bare would bypass the subscription login and require an API key (DEC-045).
    expect(args).not.toContain('--bare')

    // The -p prompt is a short kickoff; the actual rules travel in
    // --system-prompt, which replaces the default rather than appending to it.
    const systemPromptIndex = args.indexOf('--system-prompt')
    expect(systemPromptIndex).toBeGreaterThan(-1)
    expect(args[systemPromptIndex + 1]).toContain('HORUS opportunity analyst')
    expect(args[1]).not.toContain('HORUS opportunity analyst')
    expect(args[1]).toContain('task_1')
  })

  it('names the actual evidence snapshot ids in the kickoff, not just a count (DEC-061)', () => {
    // A live run with only "analyze the 2 referenced evidence snapshot(s)"
    // produced two guessed, nonexistent ids and a correct "cannot find them"
    // report — a correct response to a prompt that withheld the one thing it
    // claimed to reference.
    const args = buildClaudeCodeArgs(task())

    expect(args[1]).toContain('raw_1')
    expect(args[1]).toContain('raw_2')
  })

  it('locks down tool permissions so a run with no allowed tools can execute none (DEC-058)', () => {
    // A live run showed Claude Code defaults to Bash and file read/write when
    // nothing restricts it. assertTaskIsBounded only validates the task's own
    // data; --permission-mode dontAsk is what actually restricts the process.
    const args = buildClaudeCodeArgs(task())

    const modeIndex = args.indexOf('--permission-mode')
    expect(modeIndex).toBeGreaterThan(-1)
    expect(args[modeIndex + 1]).toBe('dontAsk')
  })

  it('grants no MCP tool when no evidenceTools wiring is supplied (DEC-058 baseline)', () => {
    const args = buildClaudeCodeArgs(task())

    expect(args).not.toContain('--mcp-config')
    expect(args).not.toContain('--allowedTools')
  })

  it('allow-lists exactly the mapped evidence tools when wiring is supplied (DEC-059, extended for inspect_public_website_readonly)', () => {
    const wiring = createEvidenceToolWiring({
      serverScriptPath: '/app/build/electron/agent/evidence-mcp-server.js',
      databasePath: '/app/data/horus.sqlite',
    })

    const args = buildClaudeCodeArgs(task(), wiring)

    const mcpConfigIndex = args.indexOf('--mcp-config')
    expect(mcpConfigIndex).toBeGreaterThan(-1)
    const mcpConfig = JSON.parse(args[mcpConfigIndex + 1] as string)
    expect(mcpConfig.mcpServers['horus-evidence']).toMatchObject({
      command: 'node',
      args: ['/app/build/electron/agent/evidence-mcp-server.js'],
      env: { HORUS_DATABASE_PATH: '/app/data/horus.sqlite' },
    })

    const allowedToolsIndex = args.indexOf('--allowedTools')
    expect(allowedToolsIndex).toBeGreaterThan(-1)
    // task() defaults to ANALYST_TOOLS's full list; createEvidenceToolWiring's
    // default wiring now maps two of those five to a real MCP tool
    // (read_evidence_snapshot, DEC-059; inspect_public_website_readonly,
    // DEC-066). The other three (run_deterministic_scoring, save_agent_draft,
    // request_operator_review) still have no wiring entry, so per DEC-058 they
    // resolve to no access regardless of what task.allowedTools names.
    expect((args[allowedToolsIndex + 1] as string).split(',').sort()).toEqual([
      'mcp__horus-evidence__inspect_public_website_readonly',
      'mcp__horus-evidence__read_evidence_snapshot',
    ])
  })

  it('grants nothing for a wired server if the task never named the tool', () => {
    const wiring: McpServerWiring = {
      serverName: 'horus-evidence',
      command: 'node',
      args: ['server.js'],
      env: {},
      toolNameMap: new Map([['read_evidence_snapshot', 'mcp__horus-evidence__read_evidence_snapshot']]),
    }
    const args = buildClaudeCodeArgs({ ...task(), allowedTools: [] }, wiring)

    expect(args).not.toContain('--mcp-config')
    expect(args).not.toContain('--allowedTools')
  })

  it('never runs from the HORUS repository, or any directory containing CLAUDE.md', async () => {
    let capturedCwd: string | undefined
    const spawnImpl: SpawnImpl = async (_exe, _args, spawnOptions) => {
      capturedCwd = spawnOptions.cwd
      return { code: 0, stdout: JSON.stringify({ structured_output: { observations: [], proposedForReview: [], missingInformation: [] } }), stderr: '' }
    }
    const runtime = createClaudeCodeRuntime({ spawnImpl, prepareWorkingDirectory })

    await runtime.run(task())

    expect(capturedCwd).toBeDefined()
    expect(capturedCwd).not.toContain('HORUS')
    expect(capturedCwd).not.toBe(process.cwd())
  })

  it('distinguishes the failure states the operator has to act on differently', () => {
    expect(classifyFailure({ code: 0, stdout: '{}', stderr: '' })).toBeNull()
    expect(classifyFailure({ code: null, stdout: '', stderr: '', timedOut: true })?.reason).toBe('timeout')
    expect(classifyFailure({ code: 143, stdout: '', stderr: '' })?.reason).toBe('cancelled')
    expect(classifyFailure({ code: 127, stdout: '', stderr: 'command not found' })?.reason).toBe('runtime_not_installed')
    expect(classifyFailure({ code: 1, stdout: '', stderr: 'You are not logged in' })?.reason).toBe('authentication_required')
    expect(classifyFailure({ code: 1, stdout: '', stderr: 'Usage limit reached' })?.reason).toBe('usage_limit_reached')
  })

  it('detects a failure reported on stdout despite a zero exit code', () => {
    // Documented behaviour: a failure inside the run is printed as the result.
    expect(classifyFailure({ code: 0, stdout: '{"result":"authentication_failed"}', stderr: '' })?.reason)
      .toBe('authentication_required')
  })

  it('returns a result for operator review and never an approval', async () => {
    const runtime = createClaudeCodeRuntime({
      spawnImpl: spawnReturning({
        stdout: JSON.stringify({
          num_turns: 3,
          session_id: 'sess_1',
          total_cost_usd: 0.02,
          structured_output: { observations: [], proposedForReview: [], missingInformation: [] },
        }),
      }),
      prepareWorkingDirectory,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    })

    const outcome = await runtime.run(task())

    expect(outcome.status).toBe('awaiting_operator_review')
    expect(outcome.record).toMatchObject({ turnsUsed: 3, sessionId: 'sess_1', totalCostUsd: 0.02 })
    expect(outcome.record.evidenceIds).toEqual(['raw_1', 'raw_2'])
    expect(JSON.stringify(outcome)).not.toContain('approved')
  })

  it('reports unparseable output as a failure rather than an empty result', async () => {
    const runtime = createClaudeCodeRuntime({ spawnImpl: spawnReturning({ stdout: 'not json' }), prepareWorkingDirectory })
    const outcome = await runtime.run(task())

    expect(outcome).toMatchObject({ status: 'failed', reason: 'invalid_output' })
  })

  it('refuses prose when the task was schema-constrained', async () => {
    const runtime = createClaudeCodeRuntime({
      spawnImpl: spawnReturning({ stdout: JSON.stringify({ result: 'Here is my analysis...', session_id: 's' }) }),
      prepareWorkingDirectory,
    })
    const outcome = await runtime.run(task())

    expect(outcome).toMatchObject({ status: 'failed', reason: 'invalid_output' })
    expect(outcome.status === 'failed' && outcome.detail).toContain('structured_output')
  })
})

describe('analyst output validation', () => {
  const analystTask = task()

  const valid = {
    observations: [
      { candidateId: 'c1', signal: 'No contact route on the main page.', kind: 'observed', evidenceSnapshotIds: ['raw_1'] },
      { candidateId: 'c1', signal: 'Business hours not retrieved.', kind: 'insufficient_data', evidenceSnapshotIds: ['raw_2'] },
    ],
    proposedForReview: [{ candidateId: 'c1', rationale: 'Strong reviews, weak site.', evidenceSnapshotIds: ['raw_1', 'raw_2'] }],
    missingInformation: ['Opening hours were not present in the retrieved listing.'],
  }

  it('accepts a fully evidence-linked result', () => {
    expect(parseAnalystOutput(valid, analystTask)).toMatchObject({
      observations: [{ kind: 'observed' }, { kind: 'insufficient_data' }],
    })
  })

  it('rejects a claim citing evidence the task never received', () => {
    const fabricated = {
      ...valid,
      observations: [{ ...valid.observations[0], evidenceSnapshotIds: ['raw_999'] }],
    }

    expect(() => parseAnalystOutput(fabricated, analystTask)).toThrow(/was not supplied to this task/)
  })

  it('rejects an uncited claim outright', () => {
    const uncited = { ...valid, observations: [{ ...valid.observations[0], evidenceSnapshotIds: [] }] }

    expect(() => parseAnalystOutput(uncited, analystTask)).toThrow(/must cite at least one evidence snapshot/)
  })

  it('will not let the agent report a score', () => {
    const scored = {
      ...valid,
      proposedForReview: [{ ...valid.proposedForReview[0], reputationScore: 78 }],
    }

    expect(() => parseAnalystOutput(scored, analystTask)).toThrow(/HORUS owns every score/)
  })

  it('forces an absence to be recorded as insufficient data, not a negative claim', () => {
    const negative = {
      ...valid,
      observations: [{ ...valid.observations[0], kind: 'absent' }],
    }

    expect(() => parseAnalystOutput(negative, analystTask)).toThrow(/must be "observed" or "insufficient_data"/)
  })
})
