import { describe, expect, it } from 'vitest'
import { canTransition, requireTransition } from '../src/domain/workflow'

describe('HORUS workflow approvals', () => {
  it('requires demonstration approval before publication', () => {
    expect(canTransition('demo_awaiting_approval', 'demo_published')).toBe(true)
    expect(canTransition('prospect_selected', 'demo_published')).toBe(false)
  })

  it('permits Gmail compose handoff only after outreach approval', () => {
    expect(canTransition('outreach_awaiting_approval', 'gmail_handoff_opened')).toBe(true)
    expect(canTransition('demo_published', 'gmail_handoff_opened')).toBe(false)
  })

  it('rejects invalid transitions', () => {
    expect(() => requireTransition('search_draft', 'demo_published')).toThrow('Invalid HORUS workflow transition')
  })
})
