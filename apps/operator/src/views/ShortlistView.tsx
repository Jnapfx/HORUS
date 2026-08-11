import { useState } from 'react'
import type { ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { buildShortlist, type ShortlistCandidateInput } from '../domain/shortlist'
import { CandidateScoreAction, CandidateWebOpportunityAction } from './CandidateActions'
import { isJudgmentPending } from './candidate-scoring'
import type { CandidateSummary, RestoredReviewHistory, RestoredWebOpportunityMeasurement } from './types'

/**
 * DEC-075. Ranks only candidates that already have all three real inputs —
 * reputation qualification, a proximity band, and a web-opportunity score —
 * per charter §11/DEC-013/DEC-017. Nothing here triggers a new retrieval or
 * spends a credit; it reads whatever the operator has already fetched with
 * the per-candidate actions above and orders it. A candidate missing an
 * input is listed under "not yet rankable" with the specific reason, never
 * silently dropped or guessed into a slot.
 *
 * DEC-112. Rendered as compact cards rather than a wall of one-line-per-
 * candidate text: a short badge for the reason (full sentence still reachable
 * below it, since evidence must stay available — CLAUDE.md, "evidence over
 * scores"), and a real "Review →" button on every "not yet rankable" row that
 * expands the same score/judgment controls used on the Search view, in
 * place. An earlier version of this switched the whole workspace to the
 * Search view and scrolled to the candidate — the operator's own report was
 * that jumping views read as "sends me back to search" and lost their place
 * on the Shortlist; expanding in place keeps them where they are.
 */
const EXCLUSION_TEXT: Record<string, string> = {
  reputation_not_assessed: 'reputation not assessed yet — no review history has been retrieved for this listing',
  reputation_awaiting_judgment: 'scored — needs your reading of the reviews (G4/G5/G6) before it can qualify',
  not_reputation_qualified: 'scored, judged, and did not reach the qualification threshold',
  no_proximity_data: 'no proximity band — home base or listing coordinates are missing',
  no_web_opportunity_data: 'web opportunity not measured yet',
}

const EXCLUSION_LABEL: Record<string, string> = {
  reputation_not_assessed: 'not scored yet',
  reputation_awaiting_judgment: 'needs your judgment',
  not_reputation_qualified: 'below threshold',
  no_proximity_data: 'no proximity',
  no_web_opportunity_data: 'not measured',
}

export function ShortlistView({
  candidates,
  scores,
  audits,
  homeBase,
  selectedProspectId,
  onSelect,
  retainedHistories = {},
  retainedMeasurements = {},
  onScored = () => {},
  onMeasured = () => {},
  onQualified,
}: {
  candidates: readonly CandidateSummary[]
  scores: Record<string, ReputationScore>
  audits: Record<string, WebOpportunityAudit>
  homeBase: Coordinates | null | undefined
  selectedProspectId: string | null
  onSelect: (id: string) => void
  /** DEC-108. Present when this listing has been scored before in a prior session. */
  retainedHistories?: Record<string, RestoredReviewHistory>
  /** DEC-117. Present when this candidate's own website has been measured before, keyed by that URL. */
  retainedMeasurements?: Record<string, RestoredWebOpportunityMeasurement>
  onScored?: (id: string, score: ReputationScore) => void
  onMeasured?: (id: string, audit: WebOpportunityAudit) => void
  /** DEC-113. Fired when recording a judgment in place is what qualifies this candidate. */
  onQualified?: (dataId: string) => void
}) {
  // DEC-112. Which "not yet rankable" card, if any, has its score/judgment
  // controls expanded. Only one at a time — this is a focused task, not a
  // form to fill in for twenty candidates at once.
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      judgmentPending: score ? isJudgmentPending(score) : false,
    }
  })
  const shortlist = buildShortlist(inputs)
  const candidateFor = (id: string) => candidates.find((c, i) => (c.dataId ?? `index-${i}`) === id) ?? null
  const nameFor = (id: string) => candidateFor(id)?.name ?? id
  // DEC-110. Display-only ordering — `buildShortlist` itself makes no claim
  // about the order of `excluded`, so sorting here cannot disagree with any
  // domain test. Highest reputation lower bound first, so the candidates most
  // worth the operator's next look (usually "awaiting judgment") surface
  // above ones nobody has looked at or that scored poorly.
  const sortedExcluded = [...shortlist.excluded].sort(
    (a, b) => (b.candidate.reputationScoreLowerBound ?? -Infinity) - (a.candidate.reputationScoreLowerBound ?? -Infinity),
  )

  return (
    <div className="shortlist-view">
      <h3>Shortlist ({shortlist.ranked.length} ranked, {shortlist.excluded.length} not yet rankable)</h3>
      {shortlist.ranked.length === 0 && (
        <p className="notice">
          No candidate is ranked yet — score reputation and web opportunity for at least one candidate on the Search
          view, with proximity configured (DEC-074), to see it here.
        </p>
      )}
      {shortlist.ranked.length > 0 && (
        <div className="shortlist-cards">
          {shortlist.ranked.map((entry) => (
            <div className="shortlist-card" key={entry.id}>
              <div className="shortlist-card-main">
                <span className="shortlist-rank">#{entry.rank}</span>
                <strong>{nameFor(entry.id)}</strong>
              </div>
              <div className="shortlist-card-badges">
                <span>{entry.proximityBand}</span>
                <span>web-opportunity {entry.webOpportunityScoreLowerBound?.toFixed(1)}</span>
                <span>reputation {entry.reputationScoreLowerBound?.toFixed(1)}</span>
              </div>
              {selectedProspectId === entry.id
                ? <strong className="shortlist-selected">Selected as prospect</strong>
                : <button className="secondary" onClick={() => onSelect(entry.id)}>Select as prospect</button>}
            </div>
          ))}
        </div>
      )}

      {shortlist.excluded.length > 0 && (
        <>
          <p className="notice">Not yet rankable, best-scored first:</p>
          <div className="shortlist-cards">
            {sortedExcluded.map((exclusion) => {
              const candidate = candidateFor(exclusion.candidate.id)
              const isExpanded = expandedId === exclusion.candidate.id
              return (
                <div className="shortlist-card" key={exclusion.candidate.id}>
                  <div className="shortlist-card-main">
                    <strong>{nameFor(exclusion.candidate.id)}</strong>
                  </div>
                  <div className="shortlist-card-badges">
                    <span title={EXCLUSION_TEXT[exclusion.reason]}>{EXCLUSION_LABEL[exclusion.reason] ?? exclusion.reason}</span>
                    {/* DEC-108. What *is* known is shown, briefly — a candidate
                        that scored 84.3 and passed every gate, held up only for
                        a measurement that costs one PageSpeed request, reads
                        differently from one nobody has looked at. */}
                    {exclusion.candidate.reputationScoreLowerBound !== null && (
                      <span>reputation {exclusion.candidate.reputationScoreLowerBound.toFixed(1)}/100</span>
                    )}
                    {exclusion.candidate.proximityBand && <span>{exclusion.candidate.proximityBand}</span>}
                  </div>
                  {/* The badge above is the short label; the full sentence
                      stays in the DOM (muted, small) rather than only in a
                      tooltip, so it is still readable and still what
                      "evidence over scores" (CLAUDE.md) means in practice. */}
                  <p className="shortlist-reason-detail">{EXCLUSION_TEXT[exclusion.reason]}</p>
                  {candidate && (
                    <button className="secondary" onClick={() => setExpandedId(isExpanded ? null : exclusion.candidate.id)}>
                      {isExpanded ? 'Hide' : 'Review →'}
                    </button>
                  )}
                  {/* DEC-112. Expands in place — the same controls the Search
                      view offers per candidate, reused here rather than
                      switching views and losing the operator's place on the
                      Shortlist. */}
                  {isExpanded && candidate && (
                    <div className="shortlist-card-expanded">
                      <CandidateScoreAction
                        candidate={candidate}
                        retained={candidate.dataId ? retainedHistories[candidate.dataId] ?? null : null}
                        onScored={(score) => onScored(exclusion.candidate.id, score)}
                        onQualified={onQualified}
                      />
                      <CandidateWebOpportunityAction
                        candidate={candidate}
                        retained={candidate.website ? retainedMeasurements[candidate.website] ?? null : null}
                        onMeasured={(audit) => onMeasured(exclusion.candidate.id, audit)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
