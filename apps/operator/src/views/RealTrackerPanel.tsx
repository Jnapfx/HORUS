import { useEffect, useState } from 'react'
import { buildTrackerView, reviewDemonstrations, type TrackerEntry, type TrackerEvent } from '../domain/tracker'

/**
 * DEC-120. The operator asked to see "paso a paso lo que se hizo con hora" —
 * a real step-by-step timeline, not one line per prospect with every event
 * run together behind middle dots. Every step below reads an already-present
 * `TrackerEntry` field (`publishedAt`, `outreachOpenedAt`, `declaredSentAt`,
 * `followUp.scheduledAt`, `respondedAt`, `removedAt`) — `buildTrackerView`
 * itself is untouched, so this adds nothing to what counts as a recorded
 * event and invents no timestamp that was not already in the durable log.
 * Steps that never happened for a given prospect (a `null` field) simply do
 * not appear — a timeline of what is actually on record, not a fixed
 * template with blanks.
 */
type TimelineStep = { key: string; occurredAt: string; title: string; description: string }

function timelineFor(entry: TrackerEntry): readonly TimelineStep[] {
  const steps: TimelineStep[] = []
  if (entry.publishedAt) {
    steps.push({
      key: 'published',
      occurredAt: entry.publishedAt,
      title: 'Demonstration published',
      description: entry.demoUrl ? `Actual sent URL retained in record: ${entry.demoUrl}` : 'Actual sent URL retained in record.',
    })
  }
  if (entry.outreachOpenedAt) {
    steps.push({
      key: 'outreach_opened',
      occurredAt: entry.outreachOpenedAt,
      title: 'Gmail draft created',
      description: entry.outreachTo ? `Drafted to ${entry.outreachTo}, after explicit outreach approval.` : 'After explicit outreach approval.',
    })
  }
  if (entry.declaredSentAt) {
    steps.push({
      key: 'declared_sent',
      occurredAt: entry.declaredSentAt,
      title: 'Send declared by the operator',
      description: 'HORUS cannot observe a send (charter 17.3, DEC-041) — this is the operator\'s own declaration.',
    })
  }
  if (entry.followUp) {
    steps.push({
      key: 'follow_up',
      occurredAt: entry.followUp.scheduledAt,
      title: 'Follow-up scheduled',
      description: `For ${entry.followUp.date}${entry.followUp.note ? ` — ${entry.followUp.note}` : ''}.`,
    })
  }
  if (entry.respondedAt) {
    steps.push({
      key: 'responded',
      occurredAt: entry.respondedAt,
      title: 'Response recorded',
      description: 'The business responded — recorded by the operator; HORUS cannot observe a reply (DEC-041).',
    })
  }
  if (entry.removedAt) {
    steps.push({
      key: 'removed',
      occurredAt: entry.removedAt,
      title: 'Demonstration removed',
      description: 'Taken down by explicit operator action (DEC-090).',
    })
  }
  return [...steps].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

/** Presentation only — the underlying value stays the real ISO timestamp. */
function formatWhen(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function statusFor(entry: TrackerEntry): string {
  if (entry.removedAt) return 'Demonstration removed'
  if (entry.respondedAt) return 'Business responded'
  if (entry.declaredSentAt) return 'Sent (operator-declared)'
  if (entry.outreachOpenedAt) return 'Awaiting send declaration'
  if (entry.publishedAt) return 'Published — outreach not yet opened'
  return 'Recorded'
}

/**
 * DEC-082, corrected by DEC-118. Charter §4's tracker: a read-only projection
 * over the durable event log — every `demonstration.published`,
 * `outreach.gmail_handoff_opened`, `outreach.declared_sent`, and
 * `follow_up.scheduled` event any `ProspectRecord` in this session (or a past
 * one — these events are durable) has ever recorded, grouped by prospect via
 * `buildTrackerView`.
 *
 * DEC-118. Originally fetched on demand only, matching how `AnalystPanel` and
 * `RealDiscoverySearch` are both collapsed-by-default sections the operator
 * opens explicitly — but this section is not collapsed by default (`open`
 * starts `true`), so that reasoning did not actually apply here: the operator
 * reported opening this view right after sending a real outreach email and
 * seeing nothing, when the event was in fact recorded and a press of
 * "Refresh" showed it immediately. Loading once, automatically, the moment
 * this view is reached removes that false "nothing happened" read without
 * changing anything else — "Refresh" still exists for a later event recorded
 * while already on this view.
 */
export function RealTrackerPanel() {
  const [open, setOpen] = useState(true)
  const [entries, setEntries] = useState<readonly ReturnType<typeof buildTrackerView>[number][] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    window.horus?.tracker.listEvents()
      .then((events) => setEntries(buildTrackerView(events as TrackerEvent[])))
      .finally(() => setLoading(false))
  }

  // DEC-118. Loads once when this view first mounts, so the tracker never
  // reads as empty just because "Refresh" was not yet pressed.
  useEffect(() => {
    load()
    // Deliberately empty: this is a one-time load on mount, not a live
    // subscription — `load` itself is stable enough for this purpose and
    // re-running it on every render would defeat "fetch on demand."
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <div className="tracker-entries">
          {entries.map((entry) => {
            const steps = timelineFor(entry)
            return (
              <article className="tracker-entry" key={entry.id}>
                <div className="tracker-entry-header">
                  <h3>{entry.businessName ?? entry.id}</h3>
                  {entry.demoUrl && (
                    <a href={entry.demoUrl} target="_blank" rel="noopener noreferrer">{entry.demoUrl}</a>
                  )}
                </div>
                <div className="tracker-entry-body">
                  <div className="tracker-timeline-col">
                    <h4>Prospect timeline</h4>
                    {steps.length === 0 && <p className="review-text muted">Nothing recorded for this prospect yet beyond selection.</p>}
                    <ol className="tracker-timeline">
                      {steps.map((step) => (
                        <li key={step.key}>
                          <time dateTime={step.occurredAt}>{formatWhen(step.occurredAt)}</time>
                          <strong>{step.title}</strong>
                          <p>{step.description}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="tracker-record-col">
                    <h4>Current record</h4>
                    <dl className="tracker-record-status">
                      <div>
                        <dt>Status</dt>
                        <dd><span className="tracker-status-pill">{statusFor(entry)}</span></dd>
                      </div>
                      {entry.followUp && (
                        <div>
                          <dt>Next follow-up</dt>
                          <dd>{entry.followUp.date}{entry.followUp.note ? ` — ${entry.followUp.note}` : ''}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="button-row">
                      {/* DEC-120. Reuses the same real IPC `ProspectRecord.tsx` already
                          calls (DEC-081/DEC-096) — HORUS still never sends email
                          (DEC-041); this only lets the operator declare a send from
                          the Tracker as well, once a Gmail draft has actually been
                          opened. There is deliberately no "declare not sent" button:
                          no event type or IPC handler in this codebase records that,
                          and adding one here would be a fabricated control. */}
                      {entry.outreachOpenedAt && !entry.declaredSentAt && !entry.removedAt && (
                        <button
                          onClick={() => {
                            void window.horus?.outreach.declareSent({ dataId: entry.id, to: entry.outreachTo ?? '' }).then(load)
                          }}
                        >
                          Declare sent
                        </button>
                      )}
                      {!entry.respondedAt && !entry.removedAt && entry.publishedAt && (
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
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
