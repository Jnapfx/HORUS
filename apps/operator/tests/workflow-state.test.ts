import { describe, expect, it } from 'vitest'
import {
  WorkflowStateRejected,
  acceptWorkflowState,
  assertAcceptableTransition,
  parseWorkflowState,
  type MainProcessWorkflowState,
} from '../electron/workflow-state'

function state(overrides: Partial<MainProcessWorkflowState> = {}): MainProcessWorkflowState {
  return {
    step: 'search',
    demoApproved: false,
    demoPublished: false,
    outreachApproved: false,
    gmailHandoffOpened: false,
    deliveryDeclared: false,
    events: [{ type: 'representative_case_created', occurredAt: '2026-08-07T12:00:00.000Z', detail: 'Case created.' }],
    ...overrides,
  }
}

describe('main-process workflow state validation', () => {
  it('rejects malformed state instead of storing it', () => {
    expect(() => parseWorkflowState(null)).toThrow(WorkflowStateRejected)
    expect(() => parseWorkflowState({ ...state(), step: 'publish_everything' })).toThrow(/step must be one of/)
    expect(() => parseWorkflowState({ ...state(), demoApproved: 'yes' })).toThrow(/demoApproved must be a boolean/)
    expect(() => parseWorkflowState({ ...state(), events: 'none' })).toThrow(/events must be an array/)
    expect(() => parseWorkflowState({ ...state(), events: [{ type: 'x', detail: 'y', occurredAt: 'not-a-date' }] }))
      .toThrow(/valid timestamp/)
  })

  it('refuses an approval that skips what it depends on', () => {
    expect(() => parseWorkflowState(state({ outreachApproved: true })))
      .toThrow(/outreachApproved requires demoPublished/)
    expect(() => parseWorkflowState(state({ demoPublished: true })))
      .toThrow(/demoPublished requires demoApproved/)
    expect(() => parseWorkflowState(state({
      demoApproved: true,
      demoPublished: true,
      outreachApproved: true,
      gmailHandoffOpened: true,
      deliveryDeclared: true,
    }))).toThrow(/deliveryDeclared requires a recorded next action/)
  })

  it('accepts a well-formed state', () => {
    const accepted = parseWorkflowState(state({ step: 'demo_review', demoApproved: true }))
    expect(accepted).toMatchObject({ step: 'demo_review', demoApproved: true })
  })

  it('will not let the renderer revoke a recorded approval', () => {
    const previous = state({ step: 'publication', demoApproved: true })
    const next = state({ step: 'publication', demoApproved: false })

    expect(() => assertAcceptableTransition(previous, next)).toThrow(/demoApproved cannot be revoked/)
  })

  it('will not let the renderer skip or rewind a stage', () => {
    const previous = state({ step: 'shortlist' })

    expect(() => assertAcceptableTransition(previous, state({ step: 'search' })))
      .toThrow(/cannot move backwards/)
    expect(() => assertAcceptableTransition(previous, state({ step: 'demo_review' })))
      .toThrow(/cannot skip/)
    expect(() => assertAcceptableTransition(previous, state({ step: 'prospect' }))).not.toThrow()
  })

  it('treats recorded history as append-only', () => {
    const previous = state()
    const rewritten = state({
      events: [{ type: 'representative_case_created', occurredAt: '2026-08-07T12:00:00.000Z', detail: 'Edited detail.' }],
    })

    expect(() => assertAcceptableTransition(previous, rewritten)).toThrow(/cannot be rewritten/)
    expect(() => assertAcceptableTransition(previous, state({ events: [] }))).toThrow(/cannot be removed/)
    expect(() => assertAcceptableTransition(previous, state({
      events: [...previous.events, { type: 'workflow_step_changed', occurredAt: '2026-08-07T12:05:00.000Z', detail: 'Advanced.' }],
    }))).not.toThrow()
  })

  it('accepts a first save with no stored predecessor', () => {
    expect(() => acceptWorkflowState(null, state())).not.toThrow()
    expect(() => acceptWorkflowState(undefined, state())).not.toThrow()
  })
})
