import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeBlockingFindings, runImpeccableGate, type ImpeccableFinding } from '../electron/qa/impeccable-gate'

let scratchRoot: string

beforeEach(() => {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-qa-test-'))
})

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true })
})

/**
 * A page built to trip specific, named impeccable rules. Every rule asserted
 * below was confirmed to fire against this exact markup by running the real
 * detector before the assertion was written — the fixture is evidence, not a
 * guess at what the detector might say.
 */
const DELIBERATELY_BAD_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Bad</title><style>
body { background: #f5f1ea; color: #1a1714; font-family: Inter, sans-serif; margin:0; }
.eyebrow { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color:#b08947; }
h1 { font-size: 72px; letter-spacing:-0.06em; margin:0; }
.grad { background: linear-gradient(90deg,#7c3aed,#22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; font-size:40px; }
.card { border-left: 4px solid #7c3aed; border-radius: 14px; padding: 4px; }
.small { font-size: 10px; }
</style></head><body>
<div class="eyebrow">Landscaping Services</div>
<h1>We build beautiful outdoor spaces for you</h1>
<p class="grad">Gradient headline</p>
<div class="card"><p class="small">Tiny cramped text inside a side-striped rounded card.</p></div>
</body></html>`

const CLEAN_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Clean</title><style>
body { background:#ffffff; color:#1b1b1b; font-family: Georgia, serif; margin:0; padding:48px; }
h1 { font-size:44px; margin:0 0 24px; letter-spacing:-0.02em; }
p { font-size:17px; line-height:1.6; max-width:68ch; margin:0 0 20px; }
</style></head><body>
<h1>Tuff Lawn</h1>
<p>A landscaping business in Stamford, Connecticut, with a long record of local work and a straightforward set of services.</p>
</body></html>`

describe('runImpeccableGate', () => {
  // The check that makes every other assertion in this file meaningful: a gate
  // that cannot be made to fail is not a gate. This runs the real detector, not
  // a stub.
  it('fails a page built to trip known anti-patterns, and names each rule', async () => {
    const result = await runImpeccableGate({ html: DELIBERATELY_BAD_PAGE, scratchRoot })

    expect(result.status).toBe('failed')
    if (result.status !== 'failed') return

    const ids = result.blocking.map((finding) => finding.antipattern)
    expect(ids).toContain('cream-palette')
    expect(ids).toContain('hero-eyebrow-chip')
    expect(ids).toContain('gradient-text')
    expect(ids).toContain('side-tab')
    expect(ids).toContain('tiny-text')
    expect(ids).toContain('low-contrast')
  })

  it('passes a page with no blocking findings', async () => {
    const result = await runImpeccableGate({ html: CLEAN_PAGE, scratchRoot })

    expect(result.status).toBe('passed')
    if (result.status !== 'passed') return
    expect(result.blocking).toEqual([])
  })

  // Charter 9.6/10.4: a sample proves presence, never absence. A detector that
  // could not run must never be recorded as a page that passed.
  it('reports unavailable — never passed — when the detector itself throws', async () => {
    const result = await runImpeccableGate({
      html: CLEAN_PAGE,
      scratchRoot,
      detect: async () => {
        throw new Error('module not found')
      },
    })

    expect(result.status).toBe('unavailable')
    if (result.status !== 'unavailable') return
    expect(result.reason).toBe('detector_failed')
    expect(result.detail).toContain('module not found')
  })

  it('treats advisory findings as non-blocking and still passes', async () => {
    const result = await runImpeccableGate({
      html: CLEAN_PAGE,
      scratchRoot,
      detect: async () => [
        { antipattern: 'em-dash-overuse', name: 'Em dash overuse', description: 'x', severity: 'advisory', category: 'slop', snippet: 'y' },
      ],
    })

    expect(result.status).toBe('passed')
    if (result.status !== 'passed') return
    expect(result.advisory).toHaveLength(1)
    expect(result.advisory[0]!.antipattern).toBe('em-dash-overuse')
  })

  it('blocks on error severity', async () => {
    const result = await runImpeccableGate({
      html: CLEAN_PAGE,
      scratchRoot,
      detect: async () => [
        { antipattern: 'script-error', name: 'Script error', description: 'x', severity: 'error', category: 'quality', snippet: 'y' },
      ],
    })

    expect(result.status).toBe('failed')
  })

  it('leaves no scratch directory behind, on success or on failure', async () => {
    await runImpeccableGate({ html: CLEAN_PAGE, scratchRoot })
    expect(fs.readdirSync(scratchRoot)).toEqual([])

    await runImpeccableGate({
      html: CLEAN_PAGE,
      scratchRoot,
      detect: async () => {
        throw new Error('boom')
      },
    })
    expect(fs.readdirSync(scratchRoot)).toEqual([])
  })
})

describe('describeBlockingFindings', () => {
  it('renders each finding as a numbered, rule-identified instruction line', () => {
    const findings: ImpeccableFinding[] = [
      { antipattern: 'cream-palette', name: 'Cream / beige palette', description: 'Choose a deliberate background.', severity: 'warning', category: 'slop', snippet: 'rgb(245, 241, 234)' },
    ]

    const described = describeBlockingFindings(findings)

    expect(described).toContain('1. [cream-palette]')
    expect(described).toContain('Cream / beige palette')
    expect(described).toContain('rgb(245, 241, 234)')
  })
})
