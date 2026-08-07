/**
 * DEC-059. Builds the `McpServerWiring` that connects `read_evidence_snapshot`,
 * the one tool `ANALYST_TOOLS` names that HORUS actually implements, to a real
 * MCP server. Nothing here spawns anything — it only describes how
 * `buildClaudeCodeArgs` should, if the resulting object is passed to
 * `createClaudeCodeRuntime` as `evidenceTools`.
 */

import type { McpServerWiring } from './runtime.js'

export function createEvidenceToolWiring(input: {
  /** Path to the compiled `evidence-mcp-server.js`, e.g. under `build/electron/agent/`. */
  serverScriptPath: string
  /** Path to `horus.sqlite`. The server opens it read-only; see `evidence-store.ts`. */
  databasePath: string
  nodeExecutable?: string
}): McpServerWiring {
  return {
    serverName: 'horus-evidence',
    command: input.nodeExecutable ?? 'node',
    args: [input.serverScriptPath],
    env: { HORUS_DATABASE_PATH: input.databasePath },
    toolNameMap: new Map([['read_evidence_snapshot', 'mcp__horus-evidence__read_evidence_snapshot']]),
  }
}
