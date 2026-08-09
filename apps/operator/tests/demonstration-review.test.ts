import { describe, expect, it } from 'vitest'
import {
  buildTrackerView,
  DEMONSTRATION_REVIEW_DAYS,
  reviewDemonstrations,
  type TrackerEvent,
} from '../src/domain/tracker'

/**
 * DEC-096. DEC-031's 60-day demonstration review, which had a removal
 * mechanism after DEC-090 but nothing to trigger it.
 */

const NOW = new Date('2026-10-08T12:00:00.000Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const published = (over: Partial<TrackerEvent> = {}): TrackerEvent => ({
  aggregateType: 'demonstration',
  aggregateId: 'listing-1',
  eventType: 'demonstration.published',
  payload: { businessName: 'Test Landscaping', url: 'https://demo.pages.dev' },
  occurredAt: daysBefore(70),
  ...over,
})

const review = (events: readonly TrackerEvent[]) => reviewDemonstrations(buildTrackerView(events), NOW)

describe('DEC-096 — the 60-day boundary', () => {
  it('uses the charter value', () => {
    expect(DEMONSTRATION_REVIEW_DAYS).toBe(60)
  })

  it.each([0, 1, 30, 59])('leaves a demonstration %s days old alone', (days) => {
    const [entry] = review([published({ occurredAt: daysBefore(days) })])
    expect(entry.state).toBe('live')
    expect(entry.prompt).toBeNull()
  })

  it.each([60, 61, 400])('asks about a demonstration %s days old', (days) => {
    const [entry] = review([published({ occurredAt: daysBefore(days) })])
    expect(entry.state).toBe('expired_awaiting_decision')
    expect(entry.prompt).toContain('Decide whether to remove it')
    expect(entry.daysLive).toBe(days)
  })

  it('never proposes the action itself — it asks', () => {
    // DEC-031: "Nothing is taken down automatically." The returned shape has
    // no action, no flag that could be read as authorisation, only a question.
    const [entry] = review([published()])
    expect(entry.prompt).toContain('HORUS will not take it down on its own')
    expect(Object.keys(entry).sort()).toEqual(['daysLive', 'entry', 'prompt', 'state'])
  })
})

describe('DEC-096 — a prospect that engaged is out of scope', () => {
  it('does not prompt when a response has been recorded', () => {
    // DEC-031, verbatim: "Where a prospect has engaged, the demonstration is
    // not subject to this prompt."
    const [entry] = review([
      published({ occurredAt: daysBefore(200) }),
      { aggregateType: 'outreach', aggregateId: 'listing-1', eventType: 'outreach.response_recorded', payload: {}, occurredAt: daysBefore(150) },
    ])
    expect(entry.state).toBe('engaged')
    expect(entry.prompt).toBeNull()
  })

  it('stops prompting once the demonstration has been removed', () => {
    const [entry] = review([
      published({ occurredAt: daysBefore(200) }),
      { aggregateType: 'demonstration', aggregateId: 'listing-1', eventType: 'demonstration.removed', payload: {}, occurredAt: daysBefore(10) },
    ])
    expect(entry.state).toBe('removed')
    expect(entry.prompt).toBeNull()
  })
})

describe('DEC-096 — the prompt repeats rather than firing once', () => {
  it('is derived on every read, so it cannot be missed into silence', () => {
    // DEC-031 names this as its own mitigation: an ignored prompt stays
    // visible. Reading twice must give the same answer, and reading later
    // must still give it.
    const events = [published({ occurredAt: daysBefore(90) })]
    expect(review(events)[0].state).toBe('expired_awaiting_decision')
    expect(review(events)[0].state).toBe('expired_awaiting_decision')
    const muchLater = reviewDemonstrations(buildTrackerView(events), new Date('2027-01-01T00:00:00.000Z'))
    expect(muchLater[0].state).toBe('expired_awaiting_decision')
  })

  it('counts the days from publication, and they grow', () => {
    const events = [published({ occurredAt: daysBefore(90) })]
    const later = reviewDemonstrations(buildTrackerView(events), new Date(NOW.getTime() + 10 * 86_400_000))
    expect(review(events)[0].daysLive).toBe(90)
    expect(later[0].daysLive).toBe(100)
  })
})

describe('DEC-096 — only published demonstrations are reviewed', () => {
  it('ignores a prospect that was never published', () => {
    const reviews = review([
      { aggregateType: 'outreach', aggregateId: 'listing-2', eventType: 'outreach.declared_sent', payload: {}, occurredAt: daysBefore(200) },
    ])
    expect(reviews).toHaveLength(0)
  })

  it('reviews each published prospect separately', () => {
    const reviews = review([
      published({ aggregateId: 'a', occurredAt: daysBefore(10) }),
      published({ aggregateId: 'b', occurredAt: daysBefore(90) }),
    ])
    expect(reviews.find((entry) => entry.entry.id === 'a')?.state).toBe('live')
    expect(reviews.find((entry) => entry.entry.id === 'b')?.state).toBe('expired_awaiting_decision')
  })
})
