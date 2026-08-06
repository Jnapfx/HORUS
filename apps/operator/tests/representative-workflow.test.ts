import { describe, expect, it } from 'vitest'
import { completeRepresentativeAcceptanceRun, createRepresentativeWorkflow, moveWorkflow, openLocalGmailHandoff, publishLocalDemonstration, representativeProspect, validateRepresentativeSearch } from '../src/domain/representative-workflow'

describe('representative vertical workflow', () => {
  it('blocks publication until the demonstration approval is recorded', () => {
    const state = { ...createRepresentativeWorkflow(), step: 'publication' as const }
    expect(() => publishLocalDemonstration(state)).toThrow('blocked until explicit approval')
  })

  it('blocks Gmail handoff until the outreach approval is recorded', () => {
    const state = { ...createRepresentativeWorkflow(), step: 'gmail_handoff' as const }
    expect(() => openLocalGmailHandoff(state)).toThrow('blocked until explicit outreach approval')
  })

  it('completes the representative no-send path with a next action', () => {
    const state = completeRepresentativeAcceptanceRun()

    expect(state.deliveryDeclared).toBe(true)
    expect(state.nextAction?.description).toBe('Review the representative local case.')
    expect(state.events.at(-1)?.type).toBe('delivery_declared_not_sent')
    expect(state.events.filter((event) => event.type === 'workflow_step_changed')).toHaveLength(9)
    expect(state.events.some((event) => event.detail.includes('Gmail was opened'))).toBe(false)
  })

  it('blocks skipped workflow stages and exposes incomplete data as a disclosure', () => {
    expect(() => moveWorkflow(createRepresentativeWorkflow(), 'publication', 'Skip local review.')).toThrow('Workflow stage transition is blocked')
    expect(representativeProspect.reputation.sourceCompleteness).toBe('partial_data')
    expect(representativeProspect.webOpportunity.sourceCompleteness).toContain('unmeasured')
  })

  it('keeps an invalid search in its empty draft state', () => {
    expect(validateRepresentativeSearch({ category: '', city: '', targetQualified: 0, maxExamined: 0 })).toEqual([
      'Enter a business category before starting the search.',
      'Enter a city before starting the search.',
      'Target qualified must be at least 1.',
      'Maximum examined must be at least the target qualified count.',
    ])
  })
})
