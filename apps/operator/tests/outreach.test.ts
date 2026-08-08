import { describe, expect, it } from 'vitest'
import { buildOutreachDraft } from '../src/domain/outreach'

describe('buildOutreachDraft', () => {
  it('includes the real published demo URL when present', () => {
    const draft = buildOutreachDraft({ name: 'Tuff Lawn', category: 'Landscaper', demoUrl: 'https://abc.horus-tuff-lawn-concept.pages.dev' })
    expect(draft.body).toContain('https://abc.horus-tuff-lawn-concept.pages.dev')
    expect(draft.subject).toContain('Tuff Lawn')
  })

  it('never invents a demo URL, and warns instead when none exists', () => {
    const draft = buildOutreachDraft({ name: 'Tuff Lawn', category: 'Landscaper', demoUrl: null })
    expect(draft.body).toContain('[Demonstration link not available')
    expect(draft.body).not.toContain('pages.dev')
  })

  it('always defaults to English and states why, per DEC-027', () => {
    const draft = buildOutreachDraft({ name: 'La Casa de Tacos', category: null, demoUrl: 'https://x.pages.dev' })
    expect(draft.language).toBe('en')
    expect(draft.languageEvidence).toContain('DEC-027')
    expect(draft.languageEvidence.toLowerCase()).toContain('no language evidence')
  })

  it('never asserts anything about the business\'s reviews, quality, or shortcomings', () => {
    const draft = buildOutreachDraft({ name: 'Tuff Lawn', category: 'Landscaper', demoUrl: 'https://x.pages.dev' })
    const lower = draft.body.toLowerCase()
    expect(lower).not.toContain('review')
    expect(lower).not.toContain('rating')
    expect(lower).not.toContain('outdated')
    expect(lower).not.toContain('weak')
  })

  it('degrades gracefully with a null name and no category', () => {
    const draft = buildOutreachDraft({ name: null, category: null, demoUrl: 'https://x.pages.dev' })
    expect(draft.subject).toBe('A quick website concept')
    expect(draft.body).toContain('Hi,')
  })
})
