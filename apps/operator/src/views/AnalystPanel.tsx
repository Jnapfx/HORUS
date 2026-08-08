import { useEffect, useState } from 'react'
import type { AnalystRunResult, DraftSummary, EvidenceSummary } from './types'

/**
 * DEC-065. The analyst boundary's first UI surface. This panel only reads
 * retained evidence and displays what the analyst reports back — it saves
 * nothing, approves nothing, and makes no workflow-state transition. The
 * operator judges what, if anything, to do with the result; per DEC-045 no
 * agent output here is treated as authoritative.
 */

export function AnalystPanel() {
  const [open, setOpen] = useState(false)
  const [evidence, setEvidence] = useState<EvidenceSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AnalystRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftSummary[]>([])

  const refreshDrafts = () => { void window.horus?.agent.listDrafts().then(setDrafts) }

  useEffect(() => {
    if (!open) return
    void window.horus?.agent.listEvidence().then(setEvidence)
    refreshDrafts()
  }, [open])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const run = () => {
    const chosen = evidence.filter((item) => selected.has(item.id))
      .map((item) => ({ snapshotId: item.id, source: item.source, retrievedAt: item.retrievedAt }))
    setRunning(true)
    setError(null)
    setResult(null)
    window.horus?.agent.runAnalyst(chosen)
      .then((outcome) => { setResult(outcome as AnalystRunResult); refreshDrafts() })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The analyst task was rejected.'))
      .finally(() => setRunning(false))
  }

  if (!open) {
    return <section className="analyst-panel collapsed"><button className="secondary" onClick={() => setOpen(true)}>Open agent analyst (experimental, read-only, no state change)</button></section>
  }

  return (
    <section className="analyst-panel" aria-label="Agent analyst">
      <p className="eyebrow">EXPERIMENTAL · READ-ONLY · AGENT_ARCHITECTURE step 3–4</p>
      <h2>Opportunity analyst</h2>
      <p>Select retained evidence, then run the analyst. It only summarizes what was retrieved — it computes no score, proposes no contact, and saves nothing. Review its output like any other unverified draft.</p>

      {evidence.length === 0 && <p className="notice">No retained evidence in the local store yet.</p>}
      <ul className="evidence-picker">
        {evidence.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
              {item.source} · {item.retrievedAt} · {item.id}
            </label>
          </li>
        ))}
      </ul>

      <button onClick={run} disabled={running || selected.size === 0}>{running ? 'Running…' : 'Run analyst on selected evidence'}</button>

      {error && <div className="error" role="alert"><strong>Rejected before any run.</strong><p>{error}</p></div>}

      {result?.status === 'failed' && <div className="error" role="alert"><strong>Run failed: {result.reason}</strong><p>{result.detail}</p></div>}

      {result?.status === 'awaiting_operator_review' && (
        <div className="analyst-result">
          {result.draftId && <p className="success">Saved as draft {result.draftId} — a record, not an approval or a state change.</p>}
          <h3>Observations ({result.output.observations.length})</h3>
          <ul>{result.output.observations.map((o, i) => <li key={i}><span className={`kind-${o.kind}`}>{o.kind}</span> {o.signal}</li>)}</ul>
          <h3>Proposed for review ({result.output.proposedForReview.length})</h3>
          <ul>{result.output.proposedForReview.map((p, i) => <li key={i}>{p.rationale}</li>)}</ul>
          <h3>Missing information ({result.output.missingInformation.length})</h3>
          <ul>{result.output.missingInformation.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <h3>Saved drafts ({drafts.length})</h3>
      <p className="notice">A history of past analyst runs. Each entry is exactly what that run produced — nothing here has been reviewed, approved, or acted on.</p>
      <ul className="draft-list">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <strong>{draft.taskId}</strong> · {draft.createdAt}
          </li>
        ))}
      </ul>
    </section>
  )
}
