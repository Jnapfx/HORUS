/**
 * DEC-059 (`read_evidence_snapshot`), extended by a later decision for
 * `inspect_public_website_readonly`. Builds the `McpServerWiring` that
 * connects both real tools to the one MCP server `evidence-mcp-server.ts`
 * exposes. Nothing here spawns anything — it only describes how
 * `buildClaudeCodeArgs` should, if the resulting object is passed to
 * `createClaudeCodeRuntime` as `evidenceTools`.
 */

import type { McpServerWiring } from './runtime.js'

export function createEvidenceToolWiring(input: {
  /** Path to the compiled `evidence-mcp-server.js`, e.g. under `build/electron/agent/`. */
  serverScriptPath: string
  /** Path to `horus.sqlite`. The server opens it read-only; see `evidence-store.ts`. */
  databasePath: string
  /**
   * DEC-062. Only consulted for a `raw_snapshots` row whose `storage_path` is
   * relative — every row `electron/persistence.ts` has ever written is
   * absolute, so this normally does nothing. It matters for evidence retained
   * outside that write path, such as `cache/phase5/horus.sqlite`, whose
   * `storage_path` values are relative to the HORUS repository root.
   */
  evidenceBasePath?: string
  nodeExecutable?: string
}): McpServerWiring {
  return {
    serverName: 'horus-evidence',
    command: input.nodeExecutable ?? 'node',
    args: [input.serverScriptPath],
    env: {
      HORUS_DATABASE_PATH: input.databasePath,
      ...(input.evidenceBasePath ? { HORUS_EVIDENCE_BASE: input.evidenceBasePath } : {}),
    },
    toolNameMap: new Map([
      ['read_evidence_snapshot', 'mcp__horus-evidence__read_evidence_snapshot'],
      ['inspect_public_website_readonly', 'mcp__horus-evidence__inspect_public_website_readonly'],
    ]),
  }
}
