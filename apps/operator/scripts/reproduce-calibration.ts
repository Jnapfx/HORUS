/**
 * CLI over `calibration-harness.ts`. Prints every reconstructed business and
 * the comparison against the figures published on 2026-08-05. The assertions
 * live in `tests/calibration-reproduction.test.ts`; this is for reading.
 *
 * Run with: npm run calibration:reproduce
 */

import { PUBLISHED, findByName, reproduce } from './calibration-harness'

const scored = reproduce()

console.log(`\nBusinesses reconstructed from cached review evidence: ${scored.length}\n`)
console.log('name'.padEnd(38), 'pages'.padStart(5), 'revs'.padStart(5), 'score'.padStart(7), '  status')
console.log('-'.repeat(85))
for (const { business, result } of scored) {
  console.log(
    business.title.slice(0, 37).padEnd(38),
    String(business.pageCount).padStart(5),
    String(business.reviews.length).padStart(5),
    result.scoreLowerBound.toFixed(1).padStart(7),
    ' ',
    result.status,
  )
}

console.log('\n--- comparison against the figures published on 2026-08-05 ---\n')
for (const [name, published] of Object.entries(PUBLISHED)) {
  const hit = findByName(scored, name)
  if (!hit) {
    console.log(`  NOT FOUND  ${name.padEnd(26)} published ${published.toFixed(1)}`)
    continue
  }
  const recomputed = hit.result.scoreLowerBound
  const delta = recomputed - published
  const factor4 = hit.result.factors.find((factor) => factor.id === 'recent_consistency')
  console.log(
    `  ${(Math.abs(delta) < 0.05 ? 'MATCH' : 'DIFFERS').padEnd(10)}${name.padEnd(26)}` +
    `published ${published.toFixed(1)}   recomputed ${recomputed.toFixed(1)}   ` +
    `delta ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` +
    (Math.abs(delta) < 0.05 ? '' : `   (Factor 4 award ${factor4?.score.toFixed(1)}/${factor4?.maximum})`),
  )
}
console.log()
