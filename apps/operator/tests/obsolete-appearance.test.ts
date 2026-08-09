import { describe, expect, it } from 'vitest'
import { scanObsoleteAppearance, STALE_COPYRIGHT_YEARS } from '../src/domain/obsolete-appearance'

/**
 * DEC-098. Two more of the seven obsolete-appearance indicators, and — more
 * importantly — an honest statement of how many of the seven were looked at.
 */

const RETRIEVED = '2026-08-09T00:00:00.000Z'

const scan = (signals: Partial<Parameters<typeof scanObsoleteAppearance>[0]['signals']>) =>
  scanObsoleteAppearance({
    signals: { obsoleteTechnologyMarkers: [], latestCopyrightYear: null, servesHttps: true, ...signals },
    retrievedAt: RETRIEVED,
  })

describe('DEC-098 — coverage is stated, never implied', () => {
  it('names every indicator it did not check', () => {
    // The whole point. DEC-072 reported "measured" after looking at one of
    // seven and said nothing about the other six.
    const result = scan({})
    expect(result.examined).toEqual(['no-https'])
    expect(result.notExamined).toHaveLength(6)
    expect(result.coverage).toContain('1 of 7')
    expect(result.coverage).toContain('four-or-more-font-families')
  })

  it('says plainly that an unchecked indicator is not an absent one', () => {
    expect(scan({}).coverage).toContain('not evidence they are absent')
  })

  it('counts up as more becomes checkable', () => {
    const result = scan({ obsoleteTechnologyMarkers: ['<marquee> tag'], latestCopyrightYear: 2019 })
    expect(result.examined).toHaveLength(3)
    expect(result.coverage).toContain('3 of 7')
  })
})

describe('DEC-098 — obsolete technology, presence only', () => {
  it('reports markers that were found', () => {
    const result = scan({ obsoleteTechnologyMarkers: ['Flash embed', '<marquee> tag'] })
    const found = result.indicators.find((indicator) => indicator.indicator === 'obsolete-technology-marker')!
    expect(found.evidence).toContain('Flash embed')
    expect(found.evidence).toContain('<marquee> tag')
  })

  it('finding none is not itself an indicator', () => {
    const result = scan({ latestCopyrightYear: 2026 })
    expect(result.indicators.map((indicator) => indicator.indicator)).not.toContain('obsolete-technology-marker')
  })
})

describe('DEC-098 — copyright staleness, never absence', () => {
  it(`flags a copyright year ${STALE_COPYRIGHT_YEARS} or more years old`, () => {
    const result = scan({ latestCopyrightYear: 2026 - STALE_COPYRIGHT_YEARS })
    const found = result.indicators.find((indicator) => indicator.indicator === 'stale-or-missing-copyright')!
    expect(found.evidence).toContain('2 years before')
  })

  it('does not flag a copyright year one year behind', () => {
    // A site updated in December and checked in January is not neglected, and
    // this must not fire on the turn of a year.
    const result = scan({ latestCopyrightYear: 2025 })
    expect(result.indicators.map((indicator) => indicator.indicator)).not.toContain('stale-or-missing-copyright')
  })

  it('never infers the "missing" half of the indicator', () => {
    // A copyright notice absent from fetched text may be rendered later or lie
    // beyond the fetch cap. DEC-034 warns that absences are cheap to detect
    // and easy to get wrong; this refuses to detect one at all.
    const result = scan({ latestCopyrightYear: null })
    expect(result.indicators.map((indicator) => indicator.indicator)).not.toContain('stale-or-missing-copyright')
    expect(result.examined).not.toContain('stale-or-missing-copyright')
    expect(result.notExamined).toContain('stale-or-missing-copyright')
  })

  it('compares against the evidence\'s retrieval year, not the current clock', () => {
    // Charter 9.7. The same evidence must give the same answer whenever it is
    // rescored.
    const old = scanObsoleteAppearance({
      signals: { obsoleteTechnologyMarkers: [], latestCopyrightYear: 2019, servesHttps: true },
      retrievedAt: '2020-01-01T00:00:00.000Z',
    })
    expect(old.indicators.map((indicator) => indicator.indicator)).not.toContain('stale-or-missing-copyright')
  })
})

describe('DEC-098 — https, unchanged from DEC-072', () => {
  it('reports no-https when the site does not serve https', () => {
    expect(scan({ servesHttps: false }).indicators.map((indicator) => indicator.indicator)).toContain('no-https')
  })

  it('does not examine it at all when the measurement failed', () => {
    const result = scan({ servesHttps: null })
    expect(result.examined).not.toContain('no-https')
    expect(result.notExamined).toContain('no-https')
    expect(result.coverage).toContain('0 of 7')
  })
})
