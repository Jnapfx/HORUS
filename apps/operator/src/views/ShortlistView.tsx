import type { ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { buildShortlist, type ShortlistCandidateInput } from '../domain/shortlist'
import type { CandidateSummary } from './types'

/**
 * DEC-075. Ranks only candidates that already have all three real inputs —
 * reputation qualification, a proximity band, and a web-opportunity score —
 * per charter §11/DEC-013/DEC-017. Nothing here triggers a new retrieval or
 * spends a credit; it reads whatever the operator has already fetched with
 * the per-candidate actions above and orders it. A candidate missing an
 * input is listed under "not yet rankable" with the specific reason, never
 * silently dropped or guessed into a slot.
 */
/**
 * DEC-103. Each reason in the operator's own words. `reputation_not_assessed`
 * is phrased so it cannot be mistaken for a judgement about the business:
 * nothing has been measured, and that is a state, not a verdict.
 */
const EXCLUSION_TEXT: Record<string, string> = {
  reputation_not_assessed: 'reputation not assessed yet — no review history has been retrieved for this listing',
  not_reputation_qualified: 'scored, and did not reach the qualification threshold',
  no_proximity_data: 'no proximity band — home base or listing coordinates are missing',
  no_web_opportunity_data: 'web opportunity not measured yet',
}

export function ShortlistView({
  candidates,
  scores,
  audits,
  homeBase,
  selectedProspectId,
  onSelect,
}: {
  candidates: readonly CandidateSummary[]
  scores: Record<string, ReputationScore>
  audits: Record<string, WebOpportunityAudit>
  homeBase: Coordinates | null | undefined
  selectedProspectId: string | null
  onSelect: (id: string) => void
}) {
  const inputs: ShortlistCandidateInput[] = candidates.map((candidate, index) => {
    const key = candidate.dataId ?? `index-${index}`
    const score = scores[key]
    const audit = audits[key]
    const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
    return {
      id: key,
      qualified: score?.qualified ?? false,
      reputationScoreLowerBound: score?.scoreLowerBound ?? null,
      webOpportunityScoreLowerBound: audit?.scoreLowerBound ?? null,
      proximityBand: proximity?.band ?? null,
    }
  })
  const shortlist = buildShortlist(inputs)
  const nameFor = (id: string) => candidates.find((c, i) => (c.dataId ?? `index-${i}`) === id)?.name ?? id

  return (
    <div className="shortlist-view">
      <h3>Shortlist ({shortlist.ranked.length} ranked, {shortlist.excluded.length} not yet rankable)</h3>
      {shortlist.ranked.length === 0 && <p className="notice">No candidate is ranked yet — score reputation and web opportunity for at least one candidate above, with proximity configured (DEC-074), to see it here.</p>}
      <ol className="evidence-list">
        {shortlist.ranked.map((entry) => (
          <li key={entry.id}>
            #{entry.rank} {nameFor(entry.id)} — {entry.proximityBand} · web-opportunity {entry.webOpportunityScoreLowerBound?.toFixed(1)} · reputation {entry.reputationScoreLowerBound?.toFixed(1)}
            {' · '}
            {selectedProspectId === entry.id
              ? <strong>selected as prospect</strong>
              : <button className="secondary" onClick={() => onSelect(entry.id)}>Select as prospect</button>}
          </li>
        ))}
      </ol>
      {shortlist.excluded.length > 0 && (
        <>
          <p className="notice">Not yet rankable:</p>
          <ul className="checklist">
            {shortlist.excluded.map((exclusion) => (
              <li key={exclusion.candidate.id}>
                {nameFor(exclusion.candidate.id)} — {EXCLUSION_TEXT[exclusion.reason]}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
