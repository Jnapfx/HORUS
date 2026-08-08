import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

/**
 * DEC-038's accessibility baseline, verified rather than asserted in prose.
 *
 * DEC-038 requires six things: keyboard-operable approval and destructive
 * controls, visible focus, semantic heading structure, text alternatives for
 * images, sufficient contrast, and no colour-only meaning. It deferred the
 * technical verification method. `tests/contrast.test.ts` (DEC-083) covers
 * contrast; this file covers the rest as far as it honestly can.
 *
 * Coverage is deliberately layered, and the layers are not equivalent:
 *
 *   - Rendered  — `App` is rendered with `react-dom/server`, so these run
 *     against real output. This reaches the default view only: the search
 *     stage and the three collapsed panel buttons. The deeper surfaces
 *     (`ProspectRecord`, both DEC-004 gates, the evidence panels) are private
 *     to `App.tsx` and unreachable without state, so they are not covered here.
 *   - Static    — regex over `App.tsx` source, which does reach those deeper
 *     surfaces. Weaker than rendering: it checks the markup as written, not the
 *     markup as produced.
 *   - Stylesheet — the focus rule is a CSS guarantee, not a DOM one.
 *
 * What none of these can check: actual keyboard traversal and actual focus
 * appearance in a running browser. That needs a real browser and remains open.
 */

const source = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8')
const html = renderToStaticMarkup(<App />)

describe('DEC-038 — semantic heading structure (rendered)', () => {
  const levels = [...html.matchAll(/<h([1-6])[^>]*>/g)].map((match) => Number(match[1]))

  it('has exactly one h1', () => {
    expect(levels.filter((level) => level === 1)).toHaveLength(1)
  })

  it('starts at h1', () => {
    expect(levels[0]).toBe(1)
  })

  it('never skips a heading level going down', () => {
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1],
        `heading ${i} jumps from h${levels[i - 1]} to h${levels[i]}`).toBeLessThanOrEqual(1)
    }
  })
})

describe('DEC-038 — text alternatives (static, reaches the whole file)', () => {
  it('gives every image an alt attribute', () => {
    const images = source.match(/<img\b[^>]*>/gs) ?? []
    expect(images.length, 'no images found — has the screenshot view been removed?').toBeGreaterThan(0)
    for (const image of images) {
      expect(image, `image without alt: ${image}`).toMatch(/\balt=/)
    }
  })

  it('gives every iframe a title', () => {
    const frames = source.match(/<iframe\b[^>]*?\/>/gs) ?? []
    expect(frames.length, 'no iframes found — has the demonstration preview been removed?').toBeGreaterThan(0)
    for (const frame of frames) {
      expect(frame, `iframe without title: ${frame}`).toMatch(/\btitle=/)
    }
  })
})

describe('DEC-038 — keyboard-operable controls (static, reaches the whole file)', () => {
  it('puts every click handler on a natively focusable element', () => {
    // A `<div onClick>` is unreachable by keyboard. Every interactive element
    // in this application must be a real button, input, or anchor so that it
    // is focusable and activatable without a pointer — DEC-038's first clause,
    // which names approval and destructive controls specifically.
    const handlers = [...source.matchAll(/<([a-zA-Z][\w.]*)\b[^>]*?\bonClick=/gs)]
    expect(handlers.length, 'no click handlers found at all — check the regex').toBeGreaterThan(5)
    const focusable = new Set(['button', 'input', 'a'])
    for (const [, tag] of handlers) {
      expect(focusable.has(tag), `onClick on <${tag}>, which is not keyboard-focusable`).toBe(true)
    }
  })

  it('renders the reachable controls as real buttons and inputs', () => {
    expect(html).toMatch(/<button/)
    expect(html).not.toMatch(/<div[^>]*onclick/i)
  })
})

describe('DEC-038 — labelled inputs (rendered)', () => {
  it('wraps every rendered input in a label', () => {
    // This app labels by wrapping rather than by `for`/`id`, so an input that
    // is not inside a <label> has no accessible name at all.
    const inputs = html.match(/<input\b[^>]*>/g) ?? []
    expect(inputs.length).toBeGreaterThan(0)
    const labelled = html.match(/<label\b[^>]*>(?:(?!<\/label>).)*?<input\b/gs) ?? []
    expect(labelled.length, 'an input is rendered outside a <label>').toBe(inputs.length)
  })
})

describe('DEC-038 — visible focus (stylesheet)', () => {
  it('defines a :focus-visible indicator', () => {
    expect(css).toMatch(/:focus-visible\s*\{/)
  })

  it('never removes an outline without replacing it with a visible ring', () => {
    // `outline: none` on its own is the single most common way a codebase
    // silently loses keyboard visibility. Where it appears, the same rule must
    // supply a box-shadow ring in its place.
    const blocks = css.split('}')
    for (const block of blocks) {
      if (/outline:\s*none/.test(block)) {
        expect(block, `outline removed without a replacement ring:\n${block}`).toMatch(/box-shadow/)
      }
    }
  })
})

describe('DEC-083 rule 2 — no state carried by colour or dimming alone', () => {
  it('states in words why each disabled DEC-004 gate control is disabled', () => {
    // A dimmed control on a dark surface reads as absent rather than blocked.
    // Both gates pair their disabled button with a textual reason.
    const hints = source.match(/className="control-hint"/g) ?? []
    expect(hints.length, 'a DEC-004 gate lost its textual blocked-reason').toBeGreaterThanOrEqual(2)
    expect(source).toMatch(/Blocked: record the approval above/)
    expect(source).toMatch(/Blocked: \{!outreachDraft\.to/)
  })
})
