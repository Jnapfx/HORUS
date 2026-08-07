#!/usr/bin/env -S npx tsx
/**
 * AGENT_ARCHITECTURE.md step 4 — shadow-mode replay, DEC-063.
 *
 * Runs the real analyst task (buildAnalystTask / parseAnalystOutput) against
 * the real retained evidence for the two cases the roadmap names — Finescape
 * and Sons, SEASONS EATS — read from cache/phase5/horus.sqlite exactly as
 * the operator's Phase 5 run left it. Nothing here writes to that database,
 * proposes contact, or computes a score: the analyst only observes, and this
 * script only prints the observation next to the retained historical
 * decision so the operator can compare them by eye.
 *
 * DEC-063: cache/phase5/horus.sqlite mixes three storage_path conventions
 * (absolute, repo-root-relative, apps/operator-relative), and 10 of its 64
 * rows have a NULL id and are therefore unreachable by read_evidence_snapshot
 * at all. Finescape's 3 relevant rows all use the repo-root-relative
 * convention. SEASONS EATS's own discovery/listing row is one of the NULL-id
 * rows and cannot be cited by this replay; only 2 near-duplicate paginated
 * review snapshots for SEASONS EATS have a real id, and both use the
 * apps/operator-relative convention. That is why this script takes a
 * different evidenceBasePath per case, and why the SEASONS EATS replay is
 * explicitly partial.
 *
 * Prerequisite: `npm run build:electron` must already have produced
 * `build/electron/agent/evidence-mcp-server.js`.
 *
 * Run from apps/operator, from the repository root as cwd is irrelevant —
 * paths are resolved from this script's own location and from explicit
 * evidenceBasePath values below, not from process.cwd():
 *
 *   npm run build:electron
 *   npx tsx scripts/run-shadow-replay.ts finescape
 *   npx tsx scripts/run-shadow-replay.ts seasons
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAnalystTask, parseAnalystOutput } from '../electron/agent/analyst-task.js'
import { createEvidenceToolWiring } from '../electron/agent/evidence-tool-wiring.js'
import { nodeSpawn } from '../electron/agent/node-spawn.js'
import { createClaudeCodeRuntime } from '../electron/agent/runtime.js'
import { createWorkingDirectoryPreparer } from '../electron/agent/working-directory.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const operatorRoot = path.join(scriptDirectory, '..')
const repoRoot = path.join(operatorRoot, '..', '..')
const serverScriptPath = path.join(operatorRoot, 'build', 'electron', 'agent', 'evidence-mcp-server.js')
const databasePath = path.join(repoRoot, 'cache', 'phase5', 'horus.sqlite')

type Case = {
  name: string
  evidence: readonly { snapshotId: string; source: string; retrievedAt: string }[]
  evidenceBasePath: string
  historicalDecision: string
  knownGaps: string
}

const CASES: Record<string, Case> = {
  finescape: {
    name: 'Finescape and Sons',
    evidence: [
      {
        snapshotId: 'raw_8ecb903afd3e62ecfa341225edb067c209a0d27b0ac6bc69df97d9dd1cc99c9e',
        source: 'serpapi.google_maps',
        retrievedAt: '2026-08-06T22:59:58.018Z',
      },
      {
        snapshotId: 'raw_217c262ac787a179222e054c233f52fd1678e4f85c475a5a2e5e478952f17eb7',
        source: 'serpapi.google_maps_reviews',
        retrievedAt: '2026-08-06T23:47:41.000Z',
      },
      {
        snapshotId: 'raw_11dd339c49e31562ddd19c4c225511cb3043a5689c24771ab511999f609041ba',
        source: 'serpapi.google_maps_reviews',
        retrievedAt: '2026-08-06T23:48:43.000Z',
      },
    ],
    evidenceBasePath: repoRoot,
    historicalDecision:
      'Retired below the 70-point qualification threshold at a reputation score of 48.1/100 (reputation-scoring-v1). Not advanced to outreach.',
    knownGaps: 'None known — the discovery listing and both review pages are all reachable.',
  },
  seasons: {
    name: 'SEASONS EATS',
    evidence: [
      {
        snapshotId: 'raw_98a27e5898f659d77c5521365af162c47fe252fbe5a3f228dc8c8a55421aa5cf',
        source: 'serpapi-google-maps-reviews',
        retrievedAt: '2026-08-07T02:36:08.643Z',
      },
      {
        snapshotId: 'raw_fa21eb48d2df118bafe48e386235fd3144286268ab16e4aaebac7db171322065',
        source: 'serpapi-google-maps-reviews',
        retrievedAt: '2026-08-07T02:37:55.856Z',
      },
    ],
    evidenceBasePath: path.join(repoRoot, 'apps', 'operator'),
    historicalDecision:
      'Approved for a bounded public concept and operator-confirmed manual outreach at a conservative reputation lower bound of 73.06/100.',
    knownGaps:
      'PARTIAL REPLAY, per DEC-063. The discovery/listing row that recorded SEASONS EATS\'s name, address, category, and the source rating/review count is one of 10 raw_snapshots rows with a NULL id in this legacy database, and read_evidence_snapshot cannot address a row with no id. Only 2 near-duplicate paginated review-page snapshots survive as citable evidence (rating 4.7, reviewCount 292, recent review dates). This replay cannot reproduce the full evidence base the original 73.06 score was computed from — it can only show whether the analyst\'s observations from the reachable subset are consistent with that record, not confirm or recompute the score.',
  },
}

function fail(message: string): never {
  console.error(`\nFAIL: ${message}\n`)
  process.exit(1)
}

async function main() {
  const key = process.argv[2]
  const testCase = key ? CASES[key] : undefined
  if (!testCase) {
    fail(`Usage: run-shadow-replay.ts <${Object.keys(CASES).join('|')}>`)
  }

  if (!fs.existsSync(serverScriptPath)) {
    fail(`${serverScriptPath} does not exist. Run "npm run build:electron" first.`)
  }
  if (!fs.existsSync(databasePath)) {
    fail(`${databasePath} does not exist.`)
  }

  console.log(`=== Shadow-mode replay: ${testCase.name} ===`)
  console.log(`Database: ${databasePath} (read-only)`)
  console.log(`evidenceBasePath: ${testCase.evidenceBasePath}`)
  console.log(`Evidence supplied: ${testCase.evidence.map((e) => e.snapshotId).join(', ')}`)
  console.log(`Known gaps: ${testCase.knownGaps}`)

  const task = buildAnalystTask({
    taskId: `shadow-replay-${key}-${Date.now()}`,
    evidence: testCase.evidence,
    maxTurns: 12,
    timeoutMs: 180_000,
  })

  const evidenceTools = createEvidenceToolWiring({
    serverScriptPath,
    databasePath,
    evidenceBasePath: testCase.evidenceBasePath,
  })

  const runtime = createClaudeCodeRuntime({
    spawnImpl: nodeSpawn,
    prepareWorkingDirectory: createWorkingDirectoryPreparer(path.join(operatorRoot, '.tmp-agent-runs')),
    evidenceTools,
  })

  console.log('\nChecking Claude Code availability...')
  const availability = await runtime.checkAvailability()
  if (!availability.available) {
    fail(`Claude Code is not available: ${availability.reason} — ${availability.detail}`)
  }
  console.log(`Available: ${availability.runtimeId} ${availability.version}`)

  console.log('Running the analyst task against real retained evidence...')
  const outcome = await runtime.run(task)

  if (outcome.status === 'failed') {
    fail(`Runtime reported failure: ${outcome.reason} — ${outcome.detail}`)
  }

  console.log(`\nRun record: ${JSON.stringify(outcome.record, null, 2)}`)
  console.log(`Raw output: ${JSON.stringify(outcome.output, null, 2)}`)

  try {
    const parsed = parseAnalystOutput(outcome.output, task)
    console.log('\nPASS: parseAnalystOutput accepted the live result.')
    console.log(`  observations: ${parsed.observations.length}`)
    parsed.observations.forEach((o) => console.log(`    - [${o.kind}] ${o.signal} (cites ${o.evidenceSnapshotIds.join(', ')})`))
    console.log(`  proposedForReview: ${parsed.proposedForReview.length}`)
    parsed.proposedForReview.forEach((p) => console.log(`    - ${p.rationale}`))
    console.log(`  missingInformation: ${parsed.missingInformation.length}`)
    parsed.missingInformation.forEach((m) => console.log(`    - ${m}`))

    console.log(`\n--- Retained historical decision (${testCase.name}) ---`)
    console.log(testCase.historicalDecision)
    console.log('\nThis script does not judge agreement automatically — HORUS computes no score from agent')
    console.log('output (section 5) and this replay makes no state transition. Compare by eye and record')
    console.log('the outcome as a new decision.')
  } catch (error) {
    fail(`parseAnalystOutput rejected the live result: ${error instanceof Error ? error.message : String(error)}`)
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error))
})
