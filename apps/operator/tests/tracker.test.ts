import { describe, expect, it } from 'vitest'
import { buildTrackerView, type TrackerEvent } from '../src/domain/tracker'

describe('buildTrackerView', () => {
  it('assembles one entry per prospect from published, outreach, and follow-up events', () => {
    const events: TrackerEvent[] = [
      { aggregateType: 'demonstration', aggregateId: 'c1', eventType: 'demonstration.published', payload: { url: 'https://x.pages.dev', projectName: 'horus-x-concept', businessName: 'Tuff Lawn' }, occurredAt: '2026-08-08T10:00:00.000Z' },
      { aggregateType: 'outreach', aggregateId: 'c1', eventType: 'outreach.gmail_handoff_opened', payload: { to: 'owner@tufflawn.example', subject: 'A quick website concept for Tuff Lawn' }, occurredAt: '2026-08-08T10:05:00.000Z' },
      { aggregateType: 'outreach', aggregateId: 'c1', eventType: 'outreach.declared_sent', payload: { to: 'owner@tufflawn.example', declaredBy: 'operator' }, occurredAt: '2026-08-08T10:10:00.000Z' },
      { aggregateType: 'follow_up', aggregateId: 'c1', eventType: 'follow_up.scheduled', payload: { date: '2026-08-15', note: 'Call to check interest' }, occurredAt: '2026-08-08T10:11:00.000Z' },
    ]

    const view = buildTrackerView(events)

    expect(view).toEqual([
      {
        id: 'c1',
        businessName: 'Tuff Lawn',
        demoUrl: 'https://x.pages.dev',
        publishedAt: '2026-08-08T10:00:00.000Z',
        outreachTo: 'owner@tufflawn.example',
        outreachOpenedAt: '2026-08-08T10:05:00.000Z',
        declaredSentAt: '2026-08-08T10:10:00.000Z',
        followUp: { date: '2026-08-15', note: 'Call to check interest', scheduledAt: '2026-08-08T10:11:00.000Z' },
      },
    ])
  })

  it('ignores event types and aggregate types it does not recognize, rather than throwing', () => {
    const events: TrackerEvent[] = [
      { aggregateType: 'workflow_session', aggregateId: 'w1', eventType: 'workflow.snapshot_saved', payload: {}, occurredAt: '2026-08-08T09:00:00.000Z' },
      { aggregateType: 'demonstration', aggregateId: 'c1', eventType: 'demonstration.something_else', payload: {}, occurredAt: '2026-08-08T09:01:00.000Z' },
    ]
    expect(buildTrackerView(events)).toEqual([])
  })

  it('a later event of the same kind overwrites an earlier one for the same prospect', () => {
    const events: TrackerEvent[] = [
      { aggregateType: 'follow_up', aggregateId: 'c1', eventType: 'follow_up.scheduled', payload: { date: '2026-08-10', note: 'first' }, occurredAt: '2026-08-08T09:00:00.000Z' },
      { aggregateType: 'follow_up', aggregateId: 'c1', eventType: 'follow_up.scheduled', payload: { date: '2026-08-20', note: 'rescheduled' }, occurredAt: '2026-08-08T09:30:00.000Z' },
    ]
    const view = buildTrackerView(events)
    expect(view).toHaveLength(1)
    expect(view[0]!.followUp).toEqual({ date: '2026-08-20', note: 'rescheduled', scheduledAt: '2026-08-08T09:30:00.000Z' })
  })

  it('sorts entries by follow-up date ascending, with no-follow-up entries last', () => {
    const events: TrackerEvent[] = [
      { aggregateType: 'demonstration', aggregateId: 'no-followup', eventType: 'demonstration.published', payload: { businessName: 'No Followup Co' }, occurredAt: '2026-08-08T09:00:00.000Z' },
      { aggregateType: 'follow_up', aggregateId: 'later', eventType: 'follow_up.scheduled', payload: { date: '2026-09-01' }, occurredAt: '2026-08-08T09:00:00.000Z' },
      { aggregateType: 'follow_up', aggregateId: 'sooner', eventType: 'follow_up.scheduled', payload: { date: '2026-08-10' }, occurredAt: '2026-08-08T09:00:00.000Z' },
    ]
    const view = buildTrackerView(events)
    expect(view.map((entry) => entry.id)).toEqual(['sooner', 'later', 'no-followup'])
  })

  it('handles an empty event log', () => {
    expect(buildTrackerView([])).toEqual([])
  })

  it('never throws on a malformed payload — missing or wrong-typed fields are treated as absent', () => {
    const events: TrackerEvent[] = [
      { aggregateType: 'demonstration', aggregateId: 'c1', eventType: 'demonstration.published', payload: { url: 42, businessName: null }, occurredAt: '2026-08-08T09:00:00.000Z' },
      { aggregateType: 'follow_up', aggregateId: 'c1', eventType: 'follow_up.scheduled', payload: 'not an object', occurredAt: '2026-08-08T09:01:00.000Z' },
    ]
    expect(() => buildTrackerView(events)).not.toThrow()
    const view = buildTrackerView(events)
    expect(view[0]).toMatchObject({ id: 'c1', demoUrl: null, businessName: null, followUp: null })
  })
})
