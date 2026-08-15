import { describe, expect, it } from 'vitest'
import { appendOperatorRetryFromFailed, appendValidatedLeadStatus, LeadTransitionRejected, readLeadState } from '../electron/orchestrator/lead-store'
import type { DomainEventRecord, HorusStore } from '../electron/persistence'

function fakeStore(): HorusStore {
  const events: DomainEventRecord[] = []
  let counter = 0
  return {
    appendRawSnapshot: () => {
      throw new Error('not used in these tests')
    },
    appendEvent: (input) => {
      const id = `event_${counter++}`
      events.push({ id, ...input })
      return id
    },
    getWorkflowState: () => null,
    saveWorkflowState: () => {},
    getFoundationStatus: () => {
      throw new Error('not used in these tests')
    },
    listRawSnapshots: () => [],
    listRawSnapshotsBySource: () => [],
    findLatestRawSnapshot: () => null,
    saveAgentDraft: () => {
      throw new Error('not used in these tests')
    },
    listAgentDrafts: () => [],
    listEvents: (aggregateTypes) =>
      aggregateTypes && aggregateTypes.length > 0
        ? events.filter((event) => aggregateTypes.includes(event.aggregateType))
        : events,
    close: () => {},
  }
}

describe('readLeadState', () => {
  it('defaults to DISCOVERED for a lead with no recorded events', () => {
    const store = fakeStore()
    expect(readLeadState(store, 'lead_1').status).toBe('DISCOVERED')
  })

  it('only reads events for the requested lead, ignoring other aggregates and other leads', () => {
    const store = fakeStore()
    store.appendEvent({ aggregateType: 'lead', aggregateId: 'lead_2', eventType: 'lead.status_changed', payload: { status: 'QUALIFYING', occurredAt: '2026-08-11T00:00:00.000Z' }, occurredAt: '2026-08-11T00:00:00.000Z' })
    store.appendEvent({ aggregateType: 'prospect', aggregateId: 'lead_1', eventType: 'prospect.judgment_recorded', payload: {}, occurredAt: '2026-08-11T00:00:00.000Z' })
    expect(readLeadState(store, 'lead_1').status).toBe('DISCOVERED')
  })
})

describe('appendValidatedLeadStatus', () => {
  it('writes an allowed transition and returns the resulting state', () => {
    const store = fakeStore()
    const state = appendValidatedLeadStatus(store, 'lead_1', 'QUALIFYING', { occurredAt: '2026-08-11T00:00:00.000Z' })
    expect(state.status).toBe('QUALIFYING')
    expect(state.history).toHaveLength(1)
  })

  it('rejects a transition lead-state.ts does not allow, without writing anything', () => {
    const store = fakeStore()
    expect(() => appendValidatedLeadStatus(store, 'lead_1', 'QUALIFIED', { occurredAt: '2026-08-11T00:00:00.000Z' })).toThrow(LeadTransitionRejected)
    expect(readLeadState(store, 'lead_1').status).toBe('DISCOVERED')
  })

  it('validates against the freshly-read current state, not a stale one', () => {
    const store = fakeStore()
    appendValidatedLeadStatus(store, 'lead_1', 'QUALIFYING', { occurredAt: '2026-08-11T00:00:00.000Z' })
    const state = appendValidatedLeadStatus(store, 'lead_1', 'QUALIFIED', { occurredAt: '2026-08-11T00:01:00.000Z' })
    expect(state.status).toBe('QUALIFIED')
    expect(state.history.map((e) => e.status)).toEqual(['QUALIFYING', 'QUALIFIED'])
  })

  it('carries an optional detail through into the recorded event', () => {
    const store = fakeStore()
    const state = appendValidatedLeadStatus(store, 'lead_1', 'QUALIFYING', { occurredAt: '2026-08-11T00:00:00.000Z', detail: 'starting qualification' })
    expect(state.history[0]?.detail).toBe('starting qualification')
  })
})

describe('appendOperatorRetryFromFailed', () => {
  it('moves a FAILED lead back to QUALIFYING — the one transition lead-state.ts forbids everyone else', () => {
    const store = fakeStore()
    appendValidatedLeadStatus(store, 'lead_1', 'QUALIFYING', { occurredAt: '2026-08-11T00:00:00.000Z' })
    appendValidatedLeadStatus(store, 'lead_1', 'FAILED', { occurredAt: '2026-08-11T00:01:00.000Z' })

    const state = appendOperatorRetryFromFailed(store, 'lead_1', { occurredAt: '2026-08-11T00:02:00.000Z' })

    expect(state.status).toBe('QUALIFYING')
    expect(state.history.map((e) => e.status)).toEqual(['QUALIFYING', 'FAILED', 'QUALIFYING'])
  })

  it('refuses a lead that is not FAILED, without writing anything', () => {
    const store = fakeStore()
    expect(() => appendOperatorRetryFromFailed(store, 'lead_1', { occurredAt: '2026-08-11T00:00:00.000Z' })).toThrow(LeadTransitionRejected)
    expect(readLeadState(store, 'lead_1').status).toBe('DISCOVERED')
  })

  it('still refuses a QUALIFYING lead — only FAILED may use this door', () => {
    const store = fakeStore()
    appendValidatedLeadStatus(store, 'lead_1', 'QUALIFYING', { occurredAt: '2026-08-11T00:00:00.000Z' })
    expect(() => appendOperatorRetryFromFailed(store, 'lead_1', { occurredAt: '2026-08-11T00:01:00.000Z' })).toThrow(LeadTransitionRejected)
    expect(readLeadState(store, 'lead_1').status).toBe('QUALIFYING')
  })
})
