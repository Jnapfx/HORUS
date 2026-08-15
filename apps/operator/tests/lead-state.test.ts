import { describe, expect, it } from 'vitest'
import { buildLeadState, isLeadTerminal, isValidLeadTransition, LEAD_STATUSES } from '../electron/orchestrator/lead-state'

describe('buildLeadState', () => {
  it('defaults to DISCOVERED with empty history when nothing has happened yet', () => {
    const state = buildLeadState('lead_1', [])
    expect(state).toEqual({ dataId: 'lead_1', status: 'DISCOVERED', history: [] })
  })

  it('replays events in occurredAt order regardless of input order, and reports the latest as current status', () => {
    const state = buildLeadState('lead_1', [
      { status: 'QUALIFIED', occurredAt: '2026-08-11T12:00:02.000Z' },
      { status: 'QUALIFYING', occurredAt: '2026-08-11T12:00:01.000Z' },
    ])
    expect(state.status).toBe('QUALIFIED')
    expect(state.history.map((e) => e.status)).toEqual(['QUALIFYING', 'QUALIFIED'])
  })

  it('carries the detail field through unchanged', () => {
    const state = buildLeadState('lead_1', [
      { status: 'REJECTED', occurredAt: '2026-08-11T12:00:00.000Z', detail: 'opportunity_score 22/100 — no clear web-opportunity gap' },
    ])
    expect(state.history[0]!.detail).toBe('opportunity_score 22/100 — no clear web-opportunity gap')
  })
})

describe('isValidLeadTransition', () => {
  it('allows the document\'s own happy path end to end', () => {
    const path: Array<[string, string]> = [
      ['DISCOVERED', 'QUALIFYING'],
      ['QUALIFYING', 'QUALIFIED'],
      ['QUALIFIED', 'WEBSITE_GENERATING'],
      ['WEBSITE_GENERATING', 'WEBSITE_GENERATED'],
      ['WEBSITE_GENERATED', 'QA_IN_PROGRESS'],
      ['QA_IN_PROGRESS', 'QA_PASSED'],
      ['QA_PASSED', 'OUTREACH_READY'],
      ['OUTREACH_READY', 'APPROVED'],
      ['APPROVED', 'SENT'],
    ]
    for (const [from, to] of path) {
      expect(isValidLeadTransition(from as never, to as never), `${from} -> ${to}`).toBe(true)
    }
  })

  it('allows the QA correction loop back to WEBSITE_GENERATING', () => {
    expect(isValidLeadTransition('QA_FAILED', 'WEBSITE_GENERATING')).toBe(true)
  })

  it('allows rejection only from QUALIFYING, never after', () => {
    expect(isValidLeadTransition('QUALIFYING', 'REJECTED')).toBe(true)
    expect(isValidLeadTransition('QUALIFIED', 'REJECTED')).toBe(false)
    expect(isValidLeadTransition('WEBSITE_GENERATED', 'REJECTED')).toBe(false)
  })

  it('refuses a transition that skips steps', () => {
    expect(isValidLeadTransition('DISCOVERED', 'QUALIFIED')).toBe(false)
    expect(isValidLeadTransition('QUALIFIED', 'QA_PASSED')).toBe(false)
  })

  it('refuses any transition out of a terminal state', () => {
    for (const terminal of ['REJECTED', 'SENT', 'FAILED'] as const) {
      for (const status of LEAD_STATUSES) {
        expect(isValidLeadTransition(terminal, status), `${terminal} -> ${status}`).toBe(false)
      }
    }
  })
})

describe('isLeadTerminal', () => {
  it('is true for REJECTED, FAILED, and SENT only', () => {
    for (const status of LEAD_STATUSES) {
      expect(isLeadTerminal(status)).toBe(status === 'REJECTED' || status === 'FAILED' || status === 'SENT')
    }
  })
})
