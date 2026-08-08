import { useState } from 'react'
import { buildTrackerView, type TrackerEvent } from '../domain/tracker'

/**
 * DEC-082. Charter §4's tracker: a read-only projection over the durable
 * event log — every `demonstration.published`, `outreach.gmail_handoff_opened`,
 * `outreach.declared_sent`, and `follow_up.scheduled` event any `ProspectRecord`
 * in this session (or a past one — these events are durable) has ever
 * recorded, grouped by prospect via `buildTrackerView`. Fetched on demand
 * rather than kept live, matching how `AnalystPanel` and `RealDiscoverySearch`
 * are both collapsed-by-default sections the operator opens explicitly.
 */
export function RealTrackerPanel() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<readonly ReturnType<typeof buildTrackerView>[number][] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    window.horus?.tracker.listEvents()
      .then((events) => setEntries(buildTrackerView(events as TrackerEvent[])))
      .finally(() => setLoading(false))
  }

  if (!open) {
    return <section className="discovery-panel collapsed"><button className="secondary" onClick={() => { setOpen(true); load() }}>Open tracker (recorded prospects)</button></section>
  }

  return (
    <section className="discovery-panel" aria-label="Prospect tracker">
      <p className="eyebrow">TRACKER · READ-ONLY PROJECTION OF DURABLE EVENTS</p>
      <h2>Tracker</h2>
      <p>Every prospect with a real published demonstration, an opened outreach handoff, a declared send, or a scheduled follow-up — reconstructed from the append-only event log, never itself the source of truth.</p>
      <button className="secondary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      {entries && entries.length === 0 && <p className="notice">No prospect has been published, contacted, or scheduled yet.</p>}
      {entries && entries.length > 0 && (
        <ul className="tracker-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.businessName ?? entry.id}</strong>
              {entry.demoUrl && <> · <a href={entry.demoUrl} target="_blank" rel="noopener noreferrer">{entry.demoUrl}</a></>}
              {entry.publishedAt && <> · published {entry.publishedAt}</>}
              {entry.outreachOpenedAt && <> · outreach opened {entry.outreachOpenedAt}</>}
              {entry.declaredSentAt && <> · sent (operator-declared) {entry.declaredSentAt}</>}
              {entry.followUp ? <> · next follow-up {entry.followUp.date}{entry.followUp.note ? ` (${entry.followUp.note})` : ''}</> : <> · no follow-up scheduled</>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
