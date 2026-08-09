import { useState } from 'react'
import { buildTrackerView, reviewDemonstrations, type TrackerEvent } from '../domain/tracker'

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
      {/* DEC-096. DEC-031's 60-day review, derived on every read so an ignored
          prompt stays visible rather than firing once and vanishing. */}
      {entries && entries.length > 0 && (() => {
        const due = reviewDemonstrations(entries, new Date()).filter((review) => review.state === 'expired_awaiting_decision')
        if (due.length === 0) return null
        return (
          <div className="gate-zone">
            <h4>Demonstrations awaiting your decision — charter 15, DEC-031</h4>
            <ul className="checklist">
              {due.map((review) => (
                <li key={review.entry.id}>
                  {review.prompt}
                  {review.entry.demoUrl && (
                    <> <a href={review.entry.demoUrl} target="_blank" rel="noopener noreferrer">{review.entry.demoUrl}</a></>
                  )}
                </li>
              ))}
            </ul>
            <p className="notice">
              Removing one is done from that prospect's record (DEC-090). If the business did respond, record that
              below — an engaged prospect is not subject to this prompt.
            </p>
          </div>
        )
      })()}
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
              {entry.respondedAt && <> · <strong>responded {entry.respondedAt}</strong></>}
              {entry.removedAt && <> · demonstration removed {entry.removedAt}</>}
              {!entry.respondedAt && !entry.removedAt && entry.publishedAt && (
                <>
                  {' · '}
                  <button
                    className="secondary"
                    onClick={() => {
                      const note = window.prompt(`Record a response from ${entry.businessName ?? entry.id}. What happened?`)
                      if (note === null) return
                      void window.horus?.outreach.recordResponse({ dataId: entry.id, note }).then(load)
                    }}
                  >
                    Record a response
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
