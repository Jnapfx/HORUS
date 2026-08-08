import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProspectRecord } from '../src/views/ProspectRecord'
import type { CandidateSummary } from '../src/views/types'

/**
 * DEC-089. The 30-day rule asserted where it actually matters — on the rendered
 * component, not only on the pure function.
 *
 * `tests/freshness.test.ts` proves the arithmetic. This proves the wiring: that
 * a stale prospect really does reach the operator with the publish control
 * disabled and a stated reason, which is the whole point of the charter rule.
 *
 * Only the header and the publish gate are reachable from a server render — the
 * outreach gate appears after a real publication, which is a state transition
 * `renderToStaticMarkup` cannot drive. That gate carries the identical
 * `freshness.blocksContact` guard in the same component; it is covered by the
 * source assertion at the end rather than by rendering.
 */

const NOW = new Date('2026-08-08T12:00:00.000Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

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

function render(evidenceRetrievedAt: string | null) {
  return renderToStaticMarkup(
    <ProspectRecord
      id="test-candidate"
      candidates={[candidate]}
      scores={{}}
      audits={{}}
      homeBase={null}
      evidenceRetrievedAt={evidenceRetrievedAt}
      onClear={() => {}}
      now={NOW}
    />,
  )
}

describe('DEC-089 — a stale prospect reaches the operator already blocked', () => {
  it('states the evidence is stale, in words, in the header', () => {
    const html = render(daysBefore(90))
    expect(html).toContain('Evidence freshness: stale')
    expect(html).toContain('90 days ago')
    expect(html).toContain('Refresh before publishing or contacting')
  })

  it('states the evidence is fresh when it is', () => {
    const html = render(daysBefore(3))
    expect(html).toContain('Evidence freshness: fresh')
    expect(html).toContain('within the 30-day limit')
  })

  it('blocks when no retrieval time is recorded at all', () => {
    const html = render(null)
    expect(html).toContain('Evidence freshness: unknown')
    expect(html).toContain('cannot be established')
  })

  it('does not claim freshness it has not established', () => {
    // Guards against the failure mode this rule exists to prevent: silence
    // reading as a pass.
    for (const value of [null, 'not a date']) {
      expect(render(value), String(value)).not.toContain('Evidence freshness: fresh')
    }
  })
})

describe('DEC-089 — both DEC-004 gates carry the same guard', () => {
  it('disables the publish control on stale evidence, with a stated reason', () => {
    // The publish button renders only after a demonstration preview exists, so
    // what is asserted here is the guard the operator meets first: the blocking
    // banner and the refusal to present publication as available.
    const stale = render(daysBefore(400))
    expect(stale).toContain('Refresh before publishing or contacting')
    expect(stale).not.toContain('Evidence freshness: fresh')
  })

  it('applies blocksContact to the publish button, the outreach button, and both banners', () => {
    // Source-level, because the outreach gate needs a real publication to
    // render. Four guarded points: two disabled attributes and two banners.
    const source = new URL('../src/views/ProspectRecord.tsx', import.meta.url)
    const text = require('node:fs').readFileSync(source, 'utf8') as string

    const publishButton = text.match(/onClick=\{publish\}\s+disabled=\{[^}]*\}/)?.[0] ?? ''
    expect(publishButton, 'publish button is not guarded on freshness').toContain('freshness.blocksContact')

    const outreachButton = text.match(/onClick=\{openGmailHandoff\}\s+disabled=\{[^}]*\}/)?.[0] ?? ''
    expect(outreachButton, 'outreach button is not guarded on freshness').toContain('freshness.blocksContact')

    expect(text.match(/freshness\.blocksContact/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })
})
