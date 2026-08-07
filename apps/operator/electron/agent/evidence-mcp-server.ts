#!/usr/bin/env node
/**
 * DEC-059. The MCP server Claude Code spawns to give the opportunity analyst
 * its one real tool: `read_evidence_snapshot`. This process is entirely
 * separate from the Electron main process. Claude Code starts it, over stdio,
 * as named in the `--mcp-config` JSON that `runtime.ts` builds.
 *
 * It exposes exactly one tool, and that tool can only read. It opens the
 * database with `readonly: true` (`evidence-store.ts`), so even a bug here
 * cannot write, publish, or contact anything — the guarantee is in the SQLite
 * connection, not just in what this file happens to call.
 *
 * Configuration arrives through the environment, set by whoever spawns this
 * process (`buildClaudeCodeArgs`'s `--mcp-config`), not through arguments a
 * shell could inject:
 *
 *   HORUS_DATABASE_PATH  absolute path to horus.sqlite (required)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { openReadOnlyEvidenceStore } from './evidence-store.js'

const databasePath = process.env.HORUS_DATABASE_PATH
if (!databasePath) {
  console.error('HORUS_DATABASE_PATH is required to start the HORUS evidence MCP server.')
  process.exit(1)
}

const store = openReadOnlyEvidenceStore(databasePath)

const server = new McpServer({ name: 'horus-evidence', version: '1.0.0' })

server.registerTool(
  'read_evidence_snapshot',
  {
    title: 'Read HORUS evidence snapshot',
    description:
      'Reads one retained, immutable evidence snapshot by id. Read-only: cannot write, publish, ' +
      'or contact anything. Returns the snapshot\'s source, retrieval timestamp, and payload, or ' +
      'reports that no snapshot exists for the given id.',
    inputSchema: { snapshotId: z.string() },
  },
  async ({ snapshotId }) => {
    const snapshot = store.getSnapshot(snapshotId)
    if (!snapshot) {
      return {
        content: [{ type: 'text', text: `No evidence snapshot found for id "${snapshotId}".` }],
        isError: true,
      }
    }
    return { content: [{ type: 'text', text: JSON.stringify(snapshot) }] }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
