import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DESIGN_FONT_KEYS,
  DESIGN_PALETTE_KEYS,
  buildDemonstrationSite,
  type DemonstrationBusinessInput,
} from '../shared/demonstration'
import { runImpeccableGate } from '../electron/qa/impeccable-gate'

/**
 * DEC-140. The test that makes `docs/DESIGN_REFERENCES.md`'s "Adopted" claim
 * true rather than asserted. DEC-114 recorded impeccable and taste-skill as
 * adopted while neither was installed and neither had ever run; two of the
 * rules it transcribed by hand came across inverted (it adopted a warm cream
 * background and a hero eyebrow, both of which impeccable classifies as
 * anti-patterns). This file runs the real detector over every design the
 * generator can produce, so a regression of that kind fails the suite instead
 * of shipping.
 *
 * The matrix is every combination the agent can select — palette x font
 * pairing x tone — crossed with a field-complete and a field-sparse listing,
 * because sparsity is what the operator originally flagged: a page that
 * passes only when every field happens to be present is not verified.
 */

const FULL: DemonstrationBusinessInput = {
  serviceOptions: ['Outdoor seating', 'Delivery'],
  highlights: ['Fast service'],
  operatingHours: { monday: '9 AM–5 PM', tuesday: '9 AM–5 PM' },
  priceRange: '$30–50',
  photoUrl: 'https://example.com/photo.jpg',
  name: 'Tuff Lawn',
  category: 'Landscaper',
  address: '1 Main St, Stamford, CT',
  phone: '(203) 555-0100',
  website: 'https://tufflawn.example',
  rating: 4.6,
  reviewCount: 314,
}

/** The shape that produced the original complaint: a long legal name and almost nothing else. */
const SPARSE: DemonstrationBusinessInput = {
  name: 'FAIRCONN Plumbing and Heating LLC',
  category: null,
  address: null,
  phone: null,
  website: null,
  rating: null,
  reviewCount: null,
}

let scratchRoot: string

beforeAll(() => {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-design-test-'))
})

afterAll(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true })
})

describe('every generated demonstration design passes impeccable', () => {
  for (const palette of DESIGN_PALETTE_KEYS) {
    for (const fontPairing of DESIGN_FONT_KEYS) {
      for (const tone of ['warm', 'minimal', 'bold'] as const) {
        for (const [label, business] of [['field-complete', FULL], ['field-sparse', SPARSE]] as const) {
          it(`${palette} / ${fontPairing} / ${tone} / ${label}`, async () => {
            const site = buildDemonstrationSite({
              business,
              generatedAt: '2026-08-11T12:00:00.000Z',
              composition: {
                sectionOrder: ['about', 'services', 'hours'],
                tone,
                tagline: null,
                aboutParagraph: 'A landscaping business operating in Stamford, Connecticut.',
                reviewHighlights: [],
                palette,
                fontPairing,
              },
            })

            const result = await runImpeccableGate({ html: site.html, scratchRoot })

            // A detector that could not run must not be read as a pass.
            expect(result.status).toBe('passed')
          })
        }
      }
    }
  }
})

describe('the specific anti-patterns DEC-114 introduced by mistranscription', () => {
  it('never emits a cream or beige page background', async () => {
    for (const palette of DESIGN_PALETTE_KEYS) {
      const site = buildDemonstrationSite({
        business: FULL,
        generatedAt: '2026-08-11T12:00:00.000Z',
        composition: { sectionOrder: [], tone: 'warm', tagline: null, aboutParagraph: null, reviewHighlights: [], palette, fontPairing: 'editorial' },
      })
      const result = await runImpeccableGate({ html: site.html, scratchRoot })
      expect(result.status).toBe('passed')
      // The exact value DEC-114 shipped.
      expect(site.html).not.toContain('#f6f1e6')
    }
  })

  it('no longer renders a tracked-caps eyebrow label above the headline', () => {
    const site = buildDemonstrationSite({ business: FULL, generatedAt: '2026-08-11T12:00:00.000Z' })

    expect(site.html).not.toContain('class="eyebrow"')
    // The category is still shown — it is verified data, and it moved to the
    // top navigation, which is impeccable's own prescribed remedy.
    expect(site.html).toContain('Landscaper')
  })

  it('puts no coloured side border on any section, in any tone', () => {
    for (const tone of ['warm', 'minimal', 'bold'] as const) {
      const site = buildDemonstrationSite({
        business: FULL,
        generatedAt: '2026-08-11T12:00:00.000Z',
        composition: { sectionOrder: ['services'], tone, tagline: null, aboutParagraph: null, reviewHighlights: [], palette: 'cobalt', fontPairing: 'grotesque' },
      })
      expect(site.html).not.toContain('border-left: 4px')
    }
  })
})

describe('design tokens keep buildDemonstrationSite a pure function', () => {
  it('produces byte-identical output for identical input, tokens included', () => {
    const composition = {
      sectionOrder: ['services', 'hours'] as const,
      tone: 'bold' as const,
      tagline: null,
      aboutParagraph: null,
      reviewHighlights: [],
      palette: 'olive_brick' as const,
      fontPairing: 'humanist' as const,
    }
    const a = buildDemonstrationSite({ business: FULL, generatedAt: '2026-08-11T12:00:00.000Z', composition })
    const b = buildDemonstrationSite({ business: FULL, generatedAt: '2026-08-11T12:00:00.000Z', composition })

    expect(a.html).toBe(b.html)
  })

  it('derives a stable palette and font from the category when the agent supplies none', () => {
    const first = buildDemonstrationSite({ business: FULL, generatedAt: '2026-08-11T12:00:00.000Z' })
    const second = buildDemonstrationSite({ business: FULL, generatedAt: '2026-08-11T12:00:00.000Z' })

    expect(first.html).toBe(second.html)
  })

  it('lets the agent choose a design the category hash would not have picked', () => {
    const derived = buildDemonstrationSite({ business: FULL, generatedAt: '2026-08-11T12:00:00.000Z' })
    const chosen = DESIGN_PALETTE_KEYS.map((palette) =>
      buildDemonstrationSite({
        business: FULL,
        generatedAt: '2026-08-11T12:00:00.000Z',
        composition: { sectionOrder: [], tone: 'warm', tagline: null, aboutParagraph: null, reviewHighlights: [], palette, fontPairing: 'editorial' },
      }).html,
    )

    // At least one explicit palette differs from the derived default, i.e. the
    // agent's choice actually reaches the output rather than being ignored.
    expect(chosen.some((html) => html !== derived.html)).toBe(true)
  })
})
