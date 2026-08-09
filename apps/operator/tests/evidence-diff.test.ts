import { describe, expect, it } from 'vitest'
import { compareListingEvidence, type ListingEvidence } from '../src/domain/evidence-diff'

/**
 * DEC-095. Charter 15's "shows what changed", which DEC-089 named as the half
 * of the freshness rule it was not building.
 */

const base: ListingEvidence = {
  name: 'Test Landscaping',
  rating: 4.8,
  reviewCount: 120,
  address: '1 Example Street',
  phone: '+1 555 0100',
  website: 'https://example.com',
}

const changed = (over: Partial<ListingEvidence>): ListingEvidence => ({ ...base, ...over })

describe('DEC-095 — nothing changed', () => {
  it('reports no changes for identical evidence', () => {
    const result = compareListingEvidence(base, { ...base })
    expect(result.unchanged).toBe(true)
    expect(result.changes).toHaveLength(0)
    expect(result.hasMaterialChange).toBe(false)
  })
})

describe('DEC-095 — charter 15\'s own example', () => {
  it('flags a fallen rating as material', () => {
    const result = compareListingEvidence(base, changed({ rating: 4.2 }))
    const change = result.changes.find((entry) => entry.field === 'rating')!
    expect(change.materialForContact).toBe(true)
    expect(change.note).toContain('fell from 4.8 to 4.2')
    expect(result.hasMaterialChange).toBe(true)
  })

  it('reports a risen rating without calling it material', () => {
    // The operator asked what changed, not what got worse — but a rise is not
    // a reason to look again before contacting.
    const result = compareListingEvidence(base, changed({ rating: 4.9 }))
    expect(result.changes.find((entry) => entry.field === 'rating')?.materialForContact).toBe(false)
    expect(result.hasMaterialChange).toBe(false)
  })

  it('flags a fallen review count — reviews were removed, or the listing changed', () => {
    const result = compareListingEvidence(base, changed({ reviewCount: 90 }))
    expect(result.changes.find((entry) => entry.field === 'reviewCount')?.materialForContact).toBe(true)
  })

  it('reports a risen review count as ordinary', () => {
    const result = compareListingEvidence(base, changed({ reviewCount: 140 }))
    expect(result.changes.find((entry) => entry.field === 'reviewCount')?.materialForContact).toBe(false)
  })
})

describe('DEC-095 — identity changes raise G6 unbidden', () => {
  it.each([
    ['name', changed({ name: 'Different Landscaping' })],
    ['address', changed({ address: '99 Other Road' })],
  ])('flags a changed %s as material and names the gate', (field, after) => {
    const result = compareListingEvidence(base, after)
    const change = result.changes.find((entry) => entry.field === field)!
    expect(change.materialForContact).toBe(true)
    expect(change.note).toContain('G6')
  })
})

describe('DEC-095 — a website appearing changes the premise', () => {
  it('flags a site appearing where there was none', () => {
    const before = changed({ website: null })
    const result = compareListingEvidence(before, changed({ website: 'https://new.example.com' }))
    const change = result.changes.find((entry) => entry.field === 'website')!
    expect(change.materialForContact).toBe(true)
    expect(change.note).toContain('web-opportunity premise')
  })

  it('treats a site merely changing address as ordinary', () => {
    const result = compareListingEvidence(base, changed({ website: 'https://moved.example.com' }))
    expect(result.changes.find((entry) => entry.field === 'website')?.materialForContact).toBe(false)
  })

  it('does not flag a phone change as material', () => {
    const result = compareListingEvidence(base, changed({ phone: '+1 555 0199' }))
    expect(result.changes.find((entry) => entry.field === 'phone')?.materialForContact).toBe(false)
    expect(result.hasMaterialChange).toBe(false)
  })
})

describe('DEC-095 — it reports, it never decides', () => {
  it('carries before and after on every change so the operator can judge', () => {
    const result = compareListingEvidence(base, changed({ rating: 3.9, reviewCount: 80, name: 'New Name' }))
    expect(result.changes).toHaveLength(3)
    for (const change of result.changes) {
      expect(change.before, change.field).not.toBeUndefined()
      expect(change.after, change.field).not.toBeUndefined()
      expect(change.note.length, change.field).toBeGreaterThan(0)
    }
  })

  it('handles a field appearing or disappearing without inventing a value', () => {
    const result = compareListingEvidence(changed({ phone: null }), base)
    const change = result.changes.find((entry) => entry.field === 'phone')!
    expect(change.before).toBeNull()
    expect(change.note).toContain('not present')
  })

  it('exposes no verdict beyond a flag for attention', () => {
    // DEC-008: judgment-dependent signals are surfaced, never auto-rejected.
    // Nothing in the returned shape blocks, rejects, or disqualifies.
    const result = compareListingEvidence(base, changed({ rating: 1.0, name: 'Something Else' }))
    expect(Object.keys(result).sort()).toEqual(['changes', 'hasMaterialChange', 'unchanged'])
  })
})
