import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { ProspectRecord } from '../src/views/ProspectRecord'
import type { CandidateSummary } from '../src/views/types'

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
 *   - Rendered  — components rendered with `react-dom/server`, so these run
 *     against real output. Since DEC-085 exported the view components, this
 *     reaches `App`'s default view *and* `ProspectRecord`'s default state.
 *     It still cannot reach either DEC-004 gate: those render only after the
 *     operator generates a demonstration preview or a draft, which is a state
 *     transition `renderToStaticMarkup` cannot drive. The gates remain
 *     static-layer only.
 *   - Static    — regex over every component source under `src`, which does
 *     reach the surfaces rendering cannot. Weaker than rendering: it checks the
 *     markup as written, not the markup as produced, so a property dropped by a
 *     conditional would pass.
 *   - Stylesheet — the focus rule is a CSS guarantee, not a DOM one.
 *
 * What none of these can check: actual keyboard traversal and actual focus
 * appearance in a running browser. That needs a real browser and remains open.
 */

/**
 * The static layer reads every component source, not one file. DEC-085 moved
 * the view components out of `App.tsx` and these checks failed — correctly, and
 * for the wrong reason: they were pinned to a path rather than to the markup.
 * Globbing removes that brittleness and widens coverage at the same time.
 */
const sourceDir = fileURLToPath(new URL('../src', import.meta.url))
const componentFiles = readdirSync(sourceDir, { recursive: true, encoding: 'utf8' })
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => join(sourceDir, name))
const source = componentFiles.map((file) => readFileSync(file, 'utf8')).join('\n')

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

describe('DEC-038 — text alternatives (static, reaches every component source)', () => {
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

describe('DEC-038 — keyboard-operable controls (static, reaches every component source)', () => {
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

describe('DEC-038 — ProspectRecord default state (rendered, unlocked by DEC-085)', () => {
  // Reachable only because DEC-085 made this an exported module. Its default
  // state is the evidence-heavy surface an operator reads before selecting; the
  // publish and outreach gates below it need an interaction to appear and so
  // stay outside this layer.
  const candidate = {
    dataId: 'test-candidate',
    name: 'Test Business',
    address: '1 Example Street',
    type: 'landscaping',
    website: 'https://example.com',
    phone: '+1 555 0100',
    rating: 4.6,
    reviewCount: 212,
    coordinates: null,
  } as unknown as CandidateSummary

  const record = renderToStaticMarkup(
    <ProspectRecord
      id="test-candidate"
      candidates={[candidate]}
      scores={{}}
      audits={{}}
      homeBase={null}
      onClear={() => {}}
    />,
  )

  it('renders without a score or audit rather than showing a zero', () => {
    // Hard rule 6 and charter 9.6: absent measurement is not a low value.
    expect(record).toContain('not yet scored')
    expect(record).toContain('not yet measured')
    expect(record).not.toMatch(/\b0\.0\/100\b/)
  })

  it('never skips a heading level', () => {
    const levels = [...record.matchAll(/<h([1-6])[^>]*>/g)].map((match) => Number(match[1]))
    expect(levels.length).toBeGreaterThan(0)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1],
        `heading ${i} jumps from h${levels[i - 1]} to h${levels[i]}`).toBeLessThanOrEqual(1)
    }
  })

  it('uses real buttons for every action', () => {
    expect(record).toMatch(/<button/)
    expect(record).not.toMatch(/<div[^>]*onclick/i)
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
