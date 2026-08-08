import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio, parseHex, readHexTokens, relativeLuminance } from '../src/design/contrast'

/**
 * DEC-083's contrast clause, enforced against the real token values rather than
 * asserted in a comment. Body text >= 4.5:1, large text >= 3:1, and non-text UI
 * components, control boundaries, and focus indicators >= 3:1 against every
 * adjacent surface (WCAG 2.1 SC 1.4.3 and 1.4.11; DEC-038's baseline).
 *
 * If a token is changed to something illegible, this fails.
 */

const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8')
const token = readHexTokens(css)

const at = (name: string): string => {
  const value = token[name]
  if (!value) throw new Error(`Token ${name} is missing from index.css`)
  return value
}

/** The three planes text is actually read on. */
const READING_SURFACES = ['--surface-0', '--surface-1', '--surface-2', '--surface-3'] as const

describe('contrast primitives', () => {
  it('matches the WCAG reference extremes', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('is order-independent', () => {
    expect(contrastRatio('#1a1f29', '#e4e7ec')).toBeCloseTo(contrastRatio('#e4e7ec', '#1a1f29'), 6)
  })

  it('expands three-digit hex', () => {
    expect(parseHex('#fff')).toEqual(parseHex('#ffffff'))
  })

  it('refuses a value that is not a hex colour rather than guessing', () => {
    expect(() => parseHex('rebeccapurple')).toThrow(/Not a hex colour/)
    expect(() => parseHex('#12g456')).toThrow(/Not a hex colour/)
  })

  it('linearizes low channels through the WCAG low-end branch', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBe(0)
    expect(relativeLuminance(parseHex('#ffffff'))).toBeCloseTo(1, 6)
  })
})

describe('DEC-083 token palette — text', () => {
  it.each(['--text-primary', '--text-secondary', '--text-muted'])(
    '%s clears 4.5:1 on every reading surface',
    (name) => {
      for (const surface of READING_SURFACES) {
        expect(contrastRatio(at(name), at(surface)),
          `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('avoids pure white on the darkest surface, which halates on a laptop panel', () => {
    expect(at('--text-primary').toLowerCase()).not.toBe('#ffffff')
  })
})

describe('DEC-083 token palette — the four semantic accents', () => {
  const accents = ['--accent-info', '--accent-caution', '--accent-blocked', '--accent-approved']

  it.each(accents)('%s clears 4.5:1 on every reading surface', (name) => {
    for (const surface of READING_SURFACES) {
      expect(contrastRatio(at(name), at(surface)),
        `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([
    ['--accent-info', '--wash-info'],
    ['--accent-caution', '--wash-caution'],
    ['--accent-blocked', '--wash-blocked'],
    ['--accent-approved', '--wash-approved'],
  ])('%s clears 4.5:1 on its own tinted backing %s', (accent, wash) => {
    expect(contrastRatio(at(accent), at(wash))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the four meanings visually distinguishable from one another', () => {
    // Not a WCAG requirement — a DEC-036 one. A single accent system with four
    // meanings only works if the four are actually telling apart.
    for (let i = 0; i < accents.length; i += 1) {
      for (let j = i + 1; j < accents.length; j += 1) {
        expect(at(accents[i])).not.toBe(at(accents[j]))
      }
    }
  })

  it('is exactly four meanings — a fifth requires a new decision (DEC-083 rule 1)', () => {
    const declared = Object.keys(token).filter((name) => name.startsWith('--accent-'))
    expect(declared.sort()).toEqual([...accents].sort())
  })
})

describe('DEC-083 token palette — non-text UI (WCAG 1.4.11)', () => {
  it('--border-control clears 3:1 on every surface it can bound a control against', () => {
    for (const surface of READING_SURFACES) {
      expect(contrastRatio(at('--border-control'), at(surface)),
        `--border-control on ${surface}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('--focus-ring clears 3:1 against every surface it lands on', () => {
    for (const surface of READING_SURFACES) {
      expect(contrastRatio(at('--focus-ring'), at(surface)),
        `--focus-ring on ${surface}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('the two-tone focus ring stays visible on the light primary action fill', () => {
    // The ring is `0 0 0 2px --surface-0, 0 0 0 4px --focus-ring`. The light
    // outer ring is never adjacent to the light button fill — the dark inner
    // ring separates them — so the chain to verify is fill/inner and
    // inner/outer, not fill/outer. That pairing is why a light action fill can
    // carry a light focus ring at all; asserting fill/outer directly would be
    // measuring two colours that never touch.
    expect(contrastRatio(at('--surface-0'), at('--action-fill')),
      'inner ring against the fill it surrounds').toBeGreaterThanOrEqual(3)
    expect(contrastRatio(at('--focus-ring'), at('--surface-0')),
      'outer ring against the inner ring').toBeGreaterThanOrEqual(3)
  })

  it('the primary action label clears 4.5:1 on its own fill', () => {
    expect(contrastRatio(at('--action-text'), at('--action-fill'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(at('--action-text'), at('--action-fill-hover'))).toBeGreaterThanOrEqual(4.5)
  })

  it('documents that --border-subtle is deliberately below 3:1 and must never bound a control', () => {
    // This assertion exists to make the exception explicit and deliberate. If a
    // future change raises it above 3:1 that is fine, but the comment in
    // App.css claiming it is a surface separator would then be stale.
    expect(contrastRatio(at('--border-subtle'), at('--surface-1'))).toBeLessThan(3)
  })
})

describe('DEC-083 rule 6 — the demonstration shares no tokens with this interface', () => {
  it('keeps the operator interface dark and the demonstration generator light', () => {
    const demonstration = readFileSync(
      fileURLToPath(new URL('../src/domain/demonstration.ts', import.meta.url)),
      'utf8',
    )
    expect(css).toContain('color-scheme: dark')
    expect(demonstration).toContain('color-scheme: light')
    expect(demonstration).not.toContain('var(--')
  })
})
