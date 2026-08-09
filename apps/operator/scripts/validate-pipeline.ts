/**
 * DEC-092 validation harness. Drives the *real* code paths — the same
 * functions `main.ts` wires to IPC — end to end, from a real SerpApi search
 * through to a demonstration preview, and stops there.
 *
 * Why a script and not the app: the pipeline from DEC-076 onward has never
 * been executed, in any form. Running it headlessly exercises every domain and
 * integration path in one pass, reproducibly, with the results printed rather
 * than clicked through. It does not exercise the React event wiring, which
 * still needs the app itself.
 *
 * **Spends real SerpApi credits.** One for the search; one to three per
 * candidate whose review history is retrieved. Each spend is announced before
 * it happens and the review-history step only runs for candidates named on the
 * command line, so nothing is retrieved by accident.
 *
 * It stops at the demonstration preview. It never publishes and never contacts
 * anyone — DEC-004's two gates are not reachable from this file at all.
 *
 *   npm run validate:pipeline -- --category landscaping --city "Norwalk, Connecticut" --max 10
 *   npm run validate:pipeline -- ... --score 1,3,4      # retrieve history for those candidates
 */

import { fileURLToPath } from 'node:url'
import { getHomeBaseCoordinates, loadOperatorConfig, requireSerpApiKey } from '../electron/config'
import { runRealDiscoverySearch } from '../electron/discovery-ipc'
import { createHorusStore } from '../electron/persistence'
import { runReviewHistoryRetrieval } from '../electron/review-retrieval-ipc'
import { screenListingGates, buildReputationScore } from '../src/domain/reputation-scoring'
import { summarizeReviewHistory } from '../src/domain/review-history'
import { assessProximity } from '../src/domain/proximity'
import { buildShortlist } from '../src/domain/shortlist'
import { buildDemonstrationSite } from '../src/domain/demonstration'
import { emptyJudgment, resolveJudgment, type OperatorJudgmentDraft } from '../src/domain/operator-judgment'
import { assessOldest } from '../src/domain/freshness'

function arg(name: string, fallback = ''): string {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

const category = arg('category', 'landscaping')
const city = arg('city', 'Norwalk, Connecticut')
const maxExamined = Number(arg('max', '10'))
const scoreList = arg('score')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0)

const configPath = fileURLToPath(new URL('../../../config/local.json', import.meta.url))
const config = loadOperatorConfig(configPath)
const homeBase = getHomeBaseCoordinates(config)
const store = createHorusStore(fileURLToPath(new URL('../.validation-data', import.meta.url)))

const line = (label: string) => console.log(`\n${'—'.repeat(4)} ${label} ${'—'.repeat(Math.max(0, 66 - label.length))}`)

line('1. SETUP')
console.log(`  category         ${category}`)
console.log(`  city             ${city}`)
console.log(`  max examined     ${maxExamined}`)
console.log(`  home base coords ${homeBase ? `${homeBase.latitude}, ${homeBase.longitude}` : 'NOT CONFIGURED — proximity will be unavailable'}`)
console.log(`  scoring          ${scoreList.length > 0 ? `candidates ${scoreList.join(', ')} (SPENDS CREDITS)` : 'none requested'}`)

line('2. DISCOVERY — spends 1 SerpApi credit unless a cached snapshot matches')
const discovery = await runRealDiscoverySearch({
  category,
  city,
  maxExamined,
  apiKey: requireSerpApiKey(config),
  appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
  // DEC-077's adapter, copied from main.ts so the cache path is the real one.
  findCachedSnapshot: (lookup) =>
    store.findLatestRawSnapshot({
      source: 'serpapi.google_maps',
      matches: (request) => {
        if (typeof request !== 'object' || request === null) return false
        const r = request as Record<string, unknown>
        return (
          typeof r.category === 'string' && typeof r.city === 'string' &&
          r.category.toLowerCase() === lookup.category.toLowerCase() &&
          r.city.toLowerCase() === lookup.city.toLowerCase()
        )
      },
    }),
})

if (discovery.status !== 'completed') {
  console.log(`  FAILED: ${discovery.reason} — ${discovery.detail}`)
  process.exit(1)
}
console.log(`  ${discovery.fromCache ? 'served from cache, no credit spent' : 'retrieved fresh, 1 credit spent'}`)
console.log(`  snapshot ${discovery.snapshotId} at ${discovery.retrievedAt}`)
console.log(`  ${discovery.candidateCount} candidates\n`)

line('3. G1/G2 SCREEN + PROXIMITY — free, from the listing alone')
const candidates = discovery.candidates
candidates.forEach((candidate, index) => {
  const screen = screenListingGates({ rating: candidate.rating, reviewCount: candidate.reviewCount })
  const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
  console.log(
    `  ${String(index + 1).padStart(2)}. ${(candidate.name ?? 'unnamed').slice(0, 34).padEnd(35)}` +
    `${String(candidate.rating ?? '—').padStart(4)} · ${String(candidate.reviewCount ?? '—').padStart(5)} rev · ` +
    `G1 ${screen.g1.status.padEnd(8)} G2 ${screen.g2.status.padEnd(8)} ` +
    `${proximity ? `${proximity.distanceMiles.toFixed(1)}mi ${proximity.band}` : 'proximity unavailable'} · ` +
    `${candidate.website ? 'site' : 'NO SITE'}`,
  )
})

const scored = new Map<number, {
  summary: ReturnType<typeof summarizeReviewHistory>
  retrievedAt: string
  score: ReturnType<typeof buildReputationScore>
}>()

function scoreCandidate(position: number, summary: ReturnType<typeof summarizeReviewHistory>, retrievedAt: string, draft: OperatorJudgmentDraft) {
  const candidate = candidates[position - 1]
  const assessed = resolveJudgment(draft)
  return buildReputationScore({
    listingId: candidate.dataId!,
    retrievedAt,
    rating: candidate.rating === null ? { status: 'unmeasured', reason: 'No rating.' } : { status: 'measured', value: candidate.rating },
    reviewCount: candidate.reviewCount === null ? { status: 'unmeasured', reason: 'No review count.' } : { status: 'measured', value: candidate.reviewCount },
    recentActivity: {
      reviewsLast90Days: { status: 'measured', value: summary.reviewsLast90Days },
      reviewsLast365Days: { status: 'measured', value: summary.reviewsLast365Days },
      daysSinceLatestReview: summary.daysSinceLatestReview === null
        ? { status: 'unmeasured', reason: 'No reviews retrieved.' }
        : { status: 'measured', value: summary.daysSinceLatestReview },
    },
    recentConsistency: summary.recentConsistency
      ? { status: 'measured', value: summary.recentConsistency }
      : { status: 'unmeasured', reason: 'Fewer than 5 trailing-year reviews retrieved.' },
    longevity: { status: 'unmeasured', reason: 'Full-history retrieval not performed (DEC-018).' },
    complaintPattern: assessed.complaintPattern,
    operationalStatus: assessed.operationalStatus,
    listingIdentity: assessed.listingIdentity,
    market: { status: 'within_target', evidence: 'Search was scoped to the target city.' },
  })
}

if (scoreList.length > 0) {
  line('4. REVIEW HISTORY + REPUTATION — SPENDS 1-3 CREDITS PER CANDIDATE')
  for (const position of scoreList) {
    const candidate = candidates[position - 1]
    if (!candidate?.dataId) {
      console.log(`  ${position}. skipped — no data_id on this listing`)
      continue
    }
    console.log(`  ${position}. ${candidate.name} — retrieving…`)
    const history = await runReviewHistoryRetrieval({
      dataId: candidate.dataId,
      apiKey: requireSerpApiKey(config),
      appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
    })
    if (history.status !== 'completed') {
      console.log(`     FAILED: ${history.reason} — ${history.detail}`)
      continue
    }
    const summary = summarizeReviewHistory({
      reviews: history.reviews,
      retrievedAt: history.retrievedAt,
      paginationExhausted: history.paginationExhausted,
    })
    // Judgment left unanswered on purpose: this harness must not fabricate the
    // operator's G4/G5/G6 conclusions (DEC-008, DEC-091).
    const score = scoreCandidate(position, summary, history.retrievedAt, emptyJudgment())
    scored.set(position, { summary, retrievedAt: history.retrievedAt, score })
    console.log(`     ${history.reviews.length} reviews over ${history.pagesFetched} page(s), exhausted ${history.paginationExhausted}`)
    console.log(`     ${score.status} · ${score.scoreLowerBound.toFixed(1)}/100 · qualified ${score.qualified}`)
    console.log(`     gates: ${score.gates.map((gate) => `${gate.id.split('_')[0]} ${gate.status}`).join(' · ')}`)
  }
}

line('5. SHORTLIST — judgment unanswered (the real state), then answered')
if (scored.size === 0) {
  console.log('  no candidate was scored, so there is nothing to rank — pass --score to retrieve review history')
}
const answered: OperatorJudgmentDraft = {
  complaintPattern: { verdict: 'none_found', rationale: 'VALIDATION PLACEHOLDER — not a real operator assessment.' },
  operationalStatus: { verdict: 'active', rationale: 'VALIDATION PLACEHOLDER — not a real operator assessment.' },
  listingIdentity: { verdict: 'confirmed', rationale: 'VALIDATION PLACEHOLDER — not a real operator assessment.' },
}

for (const [label, draft] of (scored.size === 0 ? [] : [['unanswered (real state)', emptyJudgment()], ['answered (simulated)', answered]] as const)) {
  const inputs = [...scored.entries()].map(([position, held]) => {
    const candidate = candidates[position - 1]
    const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
    return {
      id: candidate.name ?? String(position),
      qualified: scoreCandidate(position, held.summary, held.retrievedAt, draft).qualified,
      reputationScoreLowerBound: held.score.scoreLowerBound,
      // Web opportunity is not measured by this harness; a fixed stand-in
      // keeps it from being the reason a candidate is excluded, so the
      // shortlist reports on qualification and proximity only.
      webOpportunityScoreLowerBound: 50,
      proximityBand: proximity?.band ?? null,
    }
  })
  const result = buildShortlist(inputs)
  console.log(`  judgment ${label.padEnd(24)} ranked ${result.ranked.length}, excluded ${result.excluded.length}` +
    (result.excluded.length > 0 ? ` (${[...new Set(result.excluded.map((exclusion) => exclusion.reason))].join(', ')})` : ''))
  for (const entry of result.ranked) console.log(`      #${entry.rank} ${entry.id} — ${entry.proximityBand}`)
}

line('6. FRESHNESS + DEMONSTRATION PREVIEW — no network, nothing published')
const first = candidates[0]
const freshness = assessOldest({ retrievedAt: [discovery.retrievedAt], now: new Date() })
console.log(`  freshness: ${freshness.status}, ${freshness.ageDays} days — blocks contact: ${freshness.blocksContact}`)
const demo = buildDemonstrationSite({
  business: {
    name: first.name, category: first.type, address: first.address,
    phone: first.phone, website: first.website, rating: first.rating, reviewCount: first.reviewCount,
  },
  generatedAt: new Date().toISOString(),
})
console.log(`  demonstration built: ${demo.html.length} bytes, placeholders for [${demo.missingFields.join(', ') || 'none'}]`)
console.log(`  noindex present: ${demo.html.includes('noindex')} · concept notice present: ${demo.html.toLowerCase().includes('concept')}`)

line('DONE — stopped before both DEC-004 gates. Nothing published, nothing sent.')
store.close()
