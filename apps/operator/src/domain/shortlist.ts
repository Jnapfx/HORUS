import { compareProximityBands, type ProximityBand } from './proximity'

/**
 * Charter §11 / DEC-013 / DEC-017: reputation qualifies a candidate for the
 * shortlist at all; among qualified candidates, the nearer proximity band
 * always outranks a farther one; within a band, the weaker web presence
 * (higher `web-opportunity-v2` score — more room to improve) ranks higher;
 * reputation breaks ties within that.
 *
 * This module only orders candidates that already have all three inputs
 * measured. A qualified candidate missing a proximity band or a
 * web-opportunity score is never guessed into a band or given an assumed
 * score — it is excluded with a stated reason, the same missing-data
 * discipline `reputation-scoring.ts` and `review-history.ts` already apply
 * (charter §9.6's principle, extended here to ranking inputs).
 */

export type ShortlistCandidateInput = {
  id: string
  /** From `ReputationScore.qualified` (src/domain/reputation-scoring.ts). */
  qualified: boolean
  /** From `ReputationScore.scoreLowerBound`, when computed; `null` if reputation has not been scored yet. */
  reputationScoreLowerBound: number | null
  /** From `WebOpportunityAudit.scoreLowerBound`, when computed; `null` if not yet measured. */
  webOpportunityScoreLowerBound: number | null
  /** From `assessProximity(...).band`; `null` if proximity is unavailable (no home base coordinates, or no candidate coordinates). */
  proximityBand: ProximityBand | null
}

export type ShortlistExclusionReason = 'not_reputation_qualified' | 'no_proximity_data' | 'no_web_opportunity_data'

export type ShortlistExclusion = { candidate: ShortlistCandidateInput; reason: ShortlistExclusionReason }

export type RankedShortlistEntry = ShortlistCandidateInput & { rank: number }

export type ShortlistResult = {
  ranked: readonly RankedShortlistEntry[]
  excluded: readonly ShortlistExclusion[]
}

export function buildShortlist(candidates: readonly ShortlistCandidateInput[]): ShortlistResult {
  if (new Set(candidates.map((c) => c.id)).size !== candidates.length) {
    throw new Error('Shortlist candidates must have distinct ids')
  }

  const excluded: ShortlistExclusion[] = []
  const rankable: ShortlistCandidateInput[] = []

  for (const candidate of candidates) {
    if (!candidate.qualified) {
      excluded.push({ candidate, reason: 'not_reputation_qualified' })
      continue
    }
    if (candidate.proximityBand === null) {
      excluded.push({ candidate, reason: 'no_proximity_data' })
      continue
    }
    if (candidate.webOpportunityScoreLowerBound === null) {
      excluded.push({ candidate, reason: 'no_web_opportunity_data' })
      continue
    }
    rankable.push(candidate)
  }

  const sorted = [...rankable].sort((a, b) => {
    const bandCompare = compareProximityBands(a.proximityBand as ProximityBand, b.proximityBand as ProximityBand)
    if (bandCompare !== 0) return bandCompare
    const webOpportunityCompare = (b.webOpportunityScoreLowerBound as number) - (a.webOpportunityScoreLowerBound as number)
    if (webOpportunityCompare !== 0) return webOpportunityCompare
    return (b.reputationScoreLowerBound ?? 0) - (a.reputationScoreLowerBound ?? 0)
  })

  return { ranked: sorted.map((candidate, index) => ({ ...candidate, rank: index + 1 })), excluded }
}
