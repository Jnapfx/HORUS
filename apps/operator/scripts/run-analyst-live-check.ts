#!/usr/bin/env -S npx tsx
/**
 * DEC-060 combined verification. Runs the real `buildAnalystTask`, the real
 * `read_evidence_snapshot` MCP server, the real spawn implementation, and the
 * real isolated working directory together, against two seeded evidence
 * snapshots — then checks the result with `parseAnalystOutput`, the same
 * function HORUS itself would use.
 *
 * Everything before this script was verified in pieces: the schema and
 * --system-prompt contract by hand (DEC-056/057), the permission lockdown by
 * hand (DEC-058), the evidence tool by hand against a single hand-seeded row
 * (DEC-059). This is the first run where all of it operates at once, on a
 * task built the same way HORUS's own code builds one.
 *
 * Prerequisite: `npm run build:electron` must have already produced
 * `build/electron/agent/evidence-mcp-server.js` — this script spawns that
 * compiled file with plain `node`, not through tsx.
 *
 * Run from `apps/operator`:
 *   npm run build:electron && npx tsx scripts/run-analyst-live-check.ts
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAnalystTask, parseAnalystOutput } from '../electron/agent/analyst-task.js'
import { createEvidenceToolWiring } from '../electron/agent/evidence-tool-wiring.js'
import { nodeSpawn } from '../electron/agent/node-spawn.js'
import { createClaudeCodeRuntime } from '../electron/agent/runtime.js'
import { createWorkingDirectoryPreparer } from '../electron/agent/working-directory.js'
import { createHorusStore } from '../electron/persistence.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const operatorRoot = path.join(scriptDirectory, '..')
const serverScriptPath = path.join(operatorRoot, 'build', 'electron', 'agent', 'evidence-mcp-server.js')

function fail(message: string): never {
  console.error(`\nFAIL: ${message}\n`)
  process.exit(1)
}

async function main() {
  if (!fs.existsSync(serverScriptPath)) {
    fail(`${serverScriptPath} does not exist. Run "npm run build:electron" first.`)
  }

  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-analyst-live-check-'))
  console.log(`Seeding evidence in ${dataDirectory}`)

  const store = createHorusStore(dataDirectory)
  const listing = store.appendRawSnapshot({
    source: 'serpapi',
    request: { engine: 'google_maps', q: 'plumbers in Stamford, CT' },
    retrievedAt: '2026-08-07T12:00:00.000Z',
    payload: {
      title: 'Example Plumbing Co',
      rating: 4.6,
      reviews: 212,
      website: 'https://example-plumbing.invalid',
    },
  })
  const performance = store.appendRawSnapshot({
    source: 'pagespeed',
    request: { url: 'https://example-plumbing.invalid', strategy: 'mobile' },
    retrievedAt: '2026-08-07T12:05:00.000Z',
    payload: { performanceScore: 41, largestContentfulPaintSeconds: 11.2 },
  })
  store.close()

  const task = buildAnalystTask({
    taskId: `live-check-${Date.now()}`,
    evidence: [
      { snapshotId: listing.id, source: 'serpapi', retrievedAt: '2026-08-07T12:00:00.000Z' },
      { snapshotId: performance.id, source: 'pagespeed', retrievedAt: '2026-08-07T12:05:00.000Z' },
    ],
    maxTurns: 8,
    timeoutMs: 120_000,
  })

  const evidenceTools = createEvidenceToolWiring({
    serverScriptPath,
    databasePath: path.join(dataDirectory, 'horus.sqlite'),
  })

  const runtime = createClaudeCodeRuntime({
    spawnImpl: nodeSpawn,
    prepareWorkingDirectory: createWorkingDirectoryPreparer(path.join(dataDirectory, 'agent-runs')),
    evidenceTools,
  })

  console.log('Checking Claude Code availability...')
  const availability = await runtime.checkAvailability()
  if (!availability.available) {
    fail(`Claude Code is not available: ${availability.reason} — ${availability.detail}`)
  }
  console.log(`Available: ${availability.runtimeId} ${availability.version}`)

  console.log('Running the analyst task...')
  const outcome = await runtime.run(task)

  if (outcome.status === 'failed') {
    fail(`Runtime reported failure: ${outcome.reason} — ${outcome.detail}`)
  }

  console.log(`Run record: ${JSON.stringify(outcome.record, null, 2)}`)
  console.log(`Raw output: ${JSON.stringify(outcome.output, null, 2)}`)

  try {
    const parsed = parseAnalystOutput(outcome.output, task)
    console.log('\nPASS: parseAnalystOutput accepted the live result.')
    console.log(`  observations: ${parsed.observations.length}`)
    console.log(`  proposedForReview: ${parsed.proposedForReview.length}`)
    console.log(`  missingInformation: ${parsed.missingInformation.length}`)
  } catch (error) {
    fail(`parseAnalystOutput rejected the live result: ${error instanceof Error ? error.message : String(error)}`)
  }

  fs.rmSync(dataDirectory, { recursive: true, force: true })
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error))
})
