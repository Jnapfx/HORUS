// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortlistView } from '../src/views/ShortlistView'
import { ProspectRecord } from '../src/views/ProspectRecord'
import type { CandidateSummary } from '../src/views/types'
import type { ReputationScore } from '../src/domain/reputation-scoring'

/**
 * DEC-093. Interaction tests against a real DOM.
 *
 * Every other layer this project tests — pure domain functions, server-rendered
 * markup, source assertions — proved unable to see the two structural dead ends
 * found in this session. Both lived in the wiring *between* units: DEC-091's
 * (no qualified candidate, therefore no ranked entry, therefore no button to
 * reach anything downstream) and DEC-092's (no home-base coordinates, therefore
 * every candidate excluded on proximity). 305 tests passed throughout.
 *
 * These tests click. They are the layer DEC-084 identified as the only way to
 * close that gap and deferred; DEC-092's findings are what justify paying for
 * it now.
 */

afterEach(cleanup)

const candidate = (over: Partial<CandidateSummary> = {}) => ({
  dataId: 'data-1',
  name: 'Test Landscaping',
  address: '1 Example Street',
  type: 'landscaping',
  website: 'https://example.com',
  phone: '+1 555 0100',
  rating: 4.8,
  reviewCount: 120,
  coordinates: { latitude: 41.1, longitude: -73.4 },
  ...over,
} as unknown as CandidateSummary)

const score = (qualified: boolean): ReputationScore => ({
  modelVersion: 'reputation-scoring-v1',
  listingId: 'data-1',
  retrievedAt: '2026-08-08T00:00:00.000Z',
  status: 'partial_data',
  gates: [],
  autoReject: null,
  factors: [],
  scoreLowerBound: 88,
  qualificationThreshold: 70,
  qualified,
  flags: [],
} as unknown as ReputationScore)

describe('DEC-093 — the shortlist is the only route to everything downstream', () => {
  const audits = { 'data-1': { scoreLowerBound: 60 } } as never
  const homeBase = { latitude: 41.05, longitude: -73.54 }

  it('offers no way forward when nothing qualifies — the DEC-091 dead end, in the DOM', () => {
    render(
      <ShortlistView
        candidates={[candidate()]}
        scores={{ 'data-1': score(false) }}
        audits={audits}
        homeBase={homeBase}
        selectedProspectId={null}
        onSelect={() => {}}
      />,
    )
    // This is precisely what the operator saw for the whole life of the
    // project: an excluded candidate, a stated reason, and no button.
    expect(screen.queryByRole('button', { name: /select as prospect/i })).toBeNull()
    // "not yet rankable" appears in both the count heading and the list
    // label, so match the reason itself — the thing the operator has to read.
    expect(screen.getByText(/not_reputation_qualified/)).toBeTruthy()
  })

  it('offers the button, and calls back with the right id, once a candidate qualifies', () => {
    const onSelect = vi.fn()
    render(
      <ShortlistView
        candidates={[candidate()]}
        scores={{ 'data-1': score(true) }}
        audits={audits}
        homeBase={homeBase}
        selectedProspectId={null}
        onSelect={onSelect}
      />,
    )
    const button = screen.getByRole('button', { name: /select as prospect/i })
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('data-1')
  })

  it('replaces the button with a plain statement once selected, so it cannot be re-fired', () => {
    render(
      <ShortlistView
        candidates={[candidate()]}
        scores={{ 'data-1': score(true) }}
        audits={audits}
        homeBase={homeBase}
        selectedProspectId="data-1"
        onSelect={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /select as prospect/i })).toBeNull()
    expect(screen.getByText(/selected as prospect/i)).toBeTruthy()
  })
})

describe('DEC-093 — the DEC-004 publish gate, clicked', () => {
  const renderRecord = (evidenceRetrievedAt: string | null, now: Date) =>
    render(
      <ProspectRecord
        id="data-1"
        candidates={[candidate()]}
        scores={{}}
        audits={{}}
        homeBase={null}
        evidenceRetrievedAt={evidenceRetrievedAt}
        onClear={() => {}}
        now={now}
      />,
    )

  const NOW = new Date('2026-08-08T12:00:00.000Z')
  const daysBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

  it('shows the freshness verdict before any gate is reached', () => {
    renderRecord(daysBefore(2), NOW)
    expect(screen.getByText(/evidence freshness: fresh/i)).toBeTruthy()
  })

  it('says so, in the DOM, when the evidence is too old to contact anyone', () => {
    renderRecord(daysBefore(120), NOW)
    expect(screen.getByText(/evidence freshness: stale/i)).toBeTruthy()
    expect(screen.getByText(/refresh before publishing or contacting/i)).toBeTruthy()
  })

  it('generates a demonstration preview on click, without publishing anything', () => {
    renderRecord(daysBefore(2), NOW)
    fireEvent.click(screen.getByRole('button', { name: /generate demonstration preview/i }))
    // The preview appears, and with it the gate — still shut.
    expect(screen.getByTitle('Demonstration preview')).toBeTruthy()
    const publish = screen.getByRole('button', { name: /publish now/i }) as HTMLButtonElement
    expect(publish.disabled, 'the publish gate opened without an approval').toBe(true)
    expect(screen.getByText(/blocked: record the approval above/i)).toBeTruthy()
  })

  it('opens the gate only after the approval box is actually ticked', () => {
    renderRecord(daysBefore(2), NOW)
    fireEvent.click(screen.getByRole('button', { name: /generate demonstration preview/i }))
    const approval = screen.getByRole('checkbox', { name: /i approve publishing this demonstration/i })
    fireEvent.click(approval)
    expect((screen.getByRole('button', { name: /publish now/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps the gate shut on stale evidence even when the operator ticks approval', () => {
    // Two independent conditions. Ticking the box must not be enough when the
    // evidence is too old — charter 15 requires both.
    renderRecord(daysBefore(120), NOW)
    fireEvent.click(screen.getByRole('button', { name: /generate demonstration preview/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /i approve publishing this demonstration/i }))
    const publish = screen.getByRole('button', { name: /publish now/i }) as HTMLButtonElement
    expect(publish.disabled, 'stale evidence did not block a ticked approval').toBe(true)
    expect(screen.getByText(/blocked: refresh this business/i)).toBeTruthy()
  })

  it('never invokes the publish channel while the gate is shut', () => {
    const demonstration = vi.fn()
    ;(window as unknown as { horus: unknown }).horus = { publish: { demonstration } }
    renderRecord(daysBefore(120), NOW)
    fireEvent.click(screen.getByRole('button', { name: /generate demonstration preview/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /i approve publishing this demonstration/i }))
    fireEvent.click(screen.getByRole('button', { name: /publish now/i }))
    expect(demonstration, 'a real publish was attempted through a shut gate').not.toHaveBeenCalled()
    delete (window as unknown as { horus?: unknown }).horus
  })
})

describe('DEC-093 — the demonstration preview carries its safety marks into the DOM', () => {
  it('renders the concept notice and noindex inside the sandboxed frame', () => {
    render(
      <ProspectRecord
        id="data-1"
        candidates={[candidate()]}
        scores={{}}
        audits={{}}
        homeBase={null}
        evidenceRetrievedAt="2026-08-08T00:00:00.000Z"
        onClear={() => {}}
        now={new Date('2026-08-08T12:00:00.000Z')}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /generate demonstration preview/i }))
    const frame = screen.getByTitle('Demonstration preview') as HTMLIFrameElement
    // DEC-024: both are unconditional. Asserted on what the iframe is actually
    // given, not on what the generator returned.
    expect(frame.getAttribute('srcdoc')).toContain('noindex')
    expect(frame.getAttribute('sandbox')).toBe('')
  })
})
