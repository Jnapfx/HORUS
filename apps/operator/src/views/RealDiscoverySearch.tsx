import { useEffect, useState } from 'react'
import { screenListingGates, type ReputationScore } from '../domain/reputation-scoring'
import type { WebOpportunityAudit } from '../domain/web-opportunity-audit'
import { assessProximity, type Coordinates } from '../domain/proximity'
import { CandidateScoreAction, CandidateWebOpportunityAction } from './CandidateActions'
import { ShortlistView } from './ShortlistView'
import { ProspectRecord } from './ProspectRecord'
import type { DiscoveryRunResult } from './types'

/**
 * DEC-069. Deliberately outside the `stages` workflow above: that flow is the
 * Phase 4 representative case and its own banner promises "Search... are not
 * executed here." This section is the real thing — a real SerpApi request
 * that spends a real credit and retrieves real business data — so it gets
 * its own surface, its own spend-acknowledgement, and its own explicit scope
 * statement rather than silently changing what the representative flow means.
 */
export function RealDiscoverySearch() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState({ category: '', city: '', maxExamined: 20 })
  const [forceRefresh, setForceRefresh] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DiscoveryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [homeBase, setHomeBase] = useState<Coordinates | null | undefined>(undefined)
  const [scores, setScores] = useState<Record<string, ReputationScore>>({})
  const [audits, setAudits] = useState<Record<string, WebOpportunityAudit>>({})
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || homeBase !== undefined) return
    void window.horus?.discovery.getHomeBaseCoordinates().then(setHomeBase)
  }, [open, homeBase])

  const run = () => {
    setRunning(true)
    setError(null)
    setResult(null)
    window.horus?.discovery.run({ category: input.category, city: input.city, maxExamined: input.maxExamined, forceRefresh })
      .then((outcome) => setResult(outcome as DiscoveryRunResult))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The discovery request was rejected.'))
      .finally(() => setRunning(false))
  }

  if (!open) {
    return <section className="discovery-panel collapsed"><button className="secondary" onClick={() => setOpen(true)}>Open real discovery search (spends a real SerpApi credit)</button></section>
  }

  const canRun = confirmed && input.category.trim().length > 0 && input.city.trim().length > 0 && !running

  return (
    <section className="discovery-panel" aria-label="Real discovery search">
      <p className="eyebrow">REAL SEARCH · SPENDS A SERPAPI CREDIT · SEPARATE FROM THE REPRESENTATIVE WORKFLOW ABOVE</p>
      <h2>Real discovery search</h2>
      <p>Calls SerpApi's Google Maps API directly and retains the raw response as immutable local evidence (DEC-020, DEC-046). It performs one request only — it does not yet paginate to a target/maximum, apply gates G1/G2, or compute a reputation or web-opportunity score. It does not publish anything or contact anyone. A repeat search for the same category and city reuses the stored evidence instead of spending another credit (DEC-077), unless "force a fresh search" is checked below.</p>

      <div className="search-form">
        <label>Category<input value={input.category} onChange={(event) => setInput({ ...input, category: event.target.value })} placeholder="e.g. landscaping" /></label>
        <label>City<input value={input.city} onChange={(event) => setInput({ ...input, city: event.target.value })} placeholder="e.g. Stamford, Connecticut" /></label>
        <label>Candidates to return, up to 20<input type="number" min="1" max="20" value={input.maxExamined} onChange={(event) => setInput({ ...input, maxExamined: Number(event.target.value) })} /></label>
      </div>

      <label className="confirm-spend"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand this may spend a real SerpApi credit and retrieves real business data.</label>
      <label className="confirm-spend"><input type="checkbox" checked={forceRefresh} onChange={(event) => setForceRefresh(event.target.checked)} /> Force a fresh search even if a cached result exists (spends a new credit).</label>

      <button onClick={run} disabled={!canRun}>{running ? 'Searching…' : 'Run real discovery search'}</button>

      {error && <div className="error" role="alert"><strong>Request rejected before completion.</strong><p>{error}</p></div>}

      {result?.status === 'failed' && <div className="error" role="alert"><strong>Search failed: {result.reason}</strong><p>{result.detail}</p></div>}

      {result?.status === 'completed' && (
        <div className="discovery-result">
          <p className="success">{result.fromCache ? `Served from cached evidence snapshot ${result.snapshotId}, retrieved ${result.retrievedAt} — no new SerpApi credit spent.` : `Retrieved and stored as new evidence snapshot ${result.snapshotId} at ${result.retrievedAt}.`}</p>
          <h3>Candidates ({result.candidateCount})</h3>
          <ul className="evidence-list">
            {result.candidates.map((candidate, index) => {
              const key = candidate.dataId ?? `index-${index}`
              const screen = screenListingGates({ rating: candidate.rating, reviewCount: candidate.reviewCount })
              const proximity = homeBase && candidate.coordinates ? assessProximity(homeBase, candidate.coordinates) : null
              return (
                <li key={index}>
                  <p>
                    {candidate.name ?? 'Unnamed listing'} — {candidate.rating ?? 'no rating'} rating · {candidate.reviewCount ?? 'no review count'} reviews · {candidate.website ? 'has a website field' : 'no website field'}
                    {' · '}
                    <span title={screen.g1.evidence}>G1 {screen.g1.status}</span>
                    {' · '}
                    <span title={screen.g2.evidence}>G2 {screen.g2.status}</span>
                    {' · '}
                    {proximity
                      ? <span title="Straight-line distance (DEC-074); charter bands are provisional, not driving distance">{proximity.distanceMiles} mi · {proximity.band}</span>
                      : <span>proximity unavailable{homeBase === null ? ' (home base coordinates not configured)' : candidate.coordinates === null ? ' (no coordinates on this listing)' : ''}</span>}
                  </p>
                  <CandidateScoreAction candidate={candidate} onScored={(score) => setScores((prev) => ({ ...prev, [key]: score }))} />
                  <CandidateWebOpportunityAction candidate={candidate} onMeasured={(audit) => setAudits((prev) => ({ ...prev, [key]: audit }))} />
                </li>
              )
            })}
          </ul>
          <p className="notice">Raw discovery candidates only, with a G1/G2 quick screen from listing data alone (charter 9.1 — rating ≥ 4.5, at least 25 reviews). Full qualification (G3–G6 plus all five `reputation-scoring-v1` factors, DEC-068) requires review-history retrieval — a further real SerpApi cost per candidate, available per candidate below (DEC-071). Web-opportunity scoring is a separate, not-yet-wired step.</p>

          <ShortlistView
            candidates={result.candidates}
            scores={scores}
            audits={audits}
            homeBase={homeBase}
            selectedProspectId={selectedProspectId}
            onSelect={setSelectedProspectId}
          />

          {selectedProspectId && (
            <ProspectRecord
              id={selectedProspectId}
              evidenceRetrievedAt={result.retrievedAt}
              searchContext={{ category: input.category, city: input.city, maxExamined: input.maxExamined }}
              candidates={result.candidates}
              scores={scores}
              audits={audits}
              homeBase={homeBase}
              onClear={() => setSelectedProspectId(null)}
            />
          )}
        </div>
      )}
    </section>
  )
}
