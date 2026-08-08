/**
 * CLI over `phase5-harness.ts`. Prints the two Phase 5 prospects recomputed
 * from retained evidence against their published figures. Assertions live in
 * `tests/phase5-reproduction.test.ts`; this is for reading.
 *
 * Run with: npm run phase5:reproduce
 */

import { reproducePhase5 } from './phase5-harness'

for (const { input, result } of reproducePhase5()) {
  const delta = result.scoreLowerBound - input.published
  console.log(`\n${input.name}`)
  console.log(`  published   ${input.published.toFixed(2)}`)
  console.log(`  recomputed  ${result.scoreLowerBound.toFixed(2)}   delta ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`)
  console.log(`  status      ${result.status}   qualified ${result.qualified} (threshold ${result.qualificationThreshold})`)
  console.log(`  evidence    rating ${input.rating} · ${input.reviewCount} published reviews · ${input.reviews.length} retrieved · pagination exhausted ${input.paginationExhausted}`)
  console.log(`  retrievedAt ${input.retrievedAt}`)
  console.log(`  factors     ${result.factors.map((factor) => `${factor.id} ${factor.score.toFixed(1)}/${factor.maximum}`).join(' · ')}`)
  console.log(`  gates       ${result.gates.map((gate) => `${gate.id} ${gate.status}`).join(' · ')}`)
}
console.log()
