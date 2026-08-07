import { describe, expect, it } from 'vitest'
import { assessWebsitePresence, buildWebOpportunityAudit } from '../src/domain/web-opportunity-audit'

const measured = <T>(value: T) => ({ status: 'measured' as const, value })
const unmeasured = (reason: string) => ({ status: 'unmeasured' as const, reason })

describe('web opportunity audit', () => {
  it('treats a provider domain-for-sale page without business content as an automatic no-website candidate', () => {
    const assessment = assessWebsitePresence({
      listedUrl: 'http://sunshinecuisine.biz/',
      destinationUrl: 'https://forsale.godaddy.com/forsale/sunshinecuisine.biz',
      destination: 'provider-parking',
      hasBusinessContent: false,
      evidence: 'The listed URL redirected to GoDaddy and displayed that the domain is for sale.',
    })

    expect(assessment).toMatchObject({ presence: 'no-website', automaticCandidate: true })
  })

  it('treats a social-only profile as an automatic no-website candidate', () => {
    const assessment = assessWebsitePresence({
      listedUrl: 'https://www.instagram.com/caribbeanbakeryminimart/',
      destination: 'social-profile',
      hasBusinessContent: false,
      evidence: 'The listing provides Instagram as its sole web destination; no business website is listed.',
    })

    expect(assessment).toMatchObject({ presence: 'no-website', automaticCandidate: true })
  })

  it('does not turn a temporary unavailable URL into a no-website candidate', () => {
    const assessment = assessWebsitePresence({
      listedUrl: 'https://example.invalid/',
      destination: 'unreachable',
      hasBusinessContent: false,
      evidence: 'HTTP 503 during retrieval.',
    })

    expect(assessment).toMatchObject({ presence: 'insufficient-data', automaticCandidate: false })
  })

  it('calculates the charter reference profile and retains its evidence', () => {
    const audit = buildWebOpportunityAudit({
      url: 'https://example.invalid/',
      retrievedAt: '2026-08-07T12:00:00.000Z',
      site: { availability: 'reachable' },
      mobile: measured('responsive-defective'),
      obsoleteAppearance: measured([
        { indicator: 'placeholder-or-theme-content', evidence: 'Homepage contains lorem ipsum.' },
        { indicator: 'stale-or-missing-copyright', evidence: 'Footer has no copyright year.' },
        { indicator: 'obsolete-technology-marker', evidence: 'Source exposes an obsolete generator tag.' },
      ]),
      brokenElements: measured({ checkedLinks: 5, brokenLinks: 0, contactPath: { status: 'verified-working' } }),
      performance: measured({ timeToInteractiveSeconds: 6, mobileProfile: 'PageSpeed Insights Lighthouse mobile' }),
      commercialIneffectiveness: measured([
        { indicator: 'no-services-listed', searchedLocations: ['homepage', 'services navigation'] },
        { indicator: 'no-visible-call-to-action', searchedLocations: ['homepage'] },
        { indicator: 'no-business-hours', searchedLocations: ['homepage', 'contact page'] },
      ]),
    })

    expect(audit.status).toBe('complete_data')
    expect(audit.scoreLowerBound).toBeCloseTo(50.6, 1)
    expect(audit.factors.find((factor) => factor.id === 'obsolete_appearance')?.evidence).toHaveLength(3)
    expect(audit.flags).toContain('Commercial-ineffectiveness evidence requires operator review.')
  })

  it('keeps unavailable data at zero and marks the score as a lower bound', () => {
    const audit = buildWebOpportunityAudit({
      url: 'https://example.invalid/',
      retrievedAt: '2026-08-07T12:00:00.000Z',
      site: { availability: 'reachable' },
      mobile: measured('fully-responsive'),
      obsoleteAppearance: unmeasured('Visual inspection was not completed.'),
      brokenElements: measured({ checkedLinks: 3, brokenLinks: 0, contactPath: { status: 'unmeasured', reason: 'No interaction run was approved.' } }),
      performance: unmeasured('PageSpeed measurement unavailable.'),
      commercialIneffectiveness: unmeasured('Content review was not completed.'),
    })

    expect(audit.status).toBe('partial_data')
    expect(audit.scoreLowerBound).toBe(0)
    expect(audit.flags).toContain('Contact-path execution is unmeasured; no contact-path defect was inferred.')
  })

  it('does not score a temporarily unreachable site as broken', () => {
    const audit = buildWebOpportunityAudit({
      url: 'https://example.invalid/',
      retrievedAt: '2026-08-07T12:00:00.000Z',
      site: { availability: 'unreachable', detail: 'HTTP 503 during retrieval.' },
      mobile: unmeasured('Not run.'),
      obsoleteAppearance: unmeasured('Not run.'),
      brokenElements: unmeasured('Not run.'),
      performance: unmeasured('Not run.'),
      commercialIneffectiveness: unmeasured('Not run.'),
    })

    expect(audit.status).toBe('insufficient_data')
    expect(audit.scoreLowerBound).toBe(0)
    expect(audit.flags[0]).toContain('re-check')
  })

  it('requires executed verification before assigning the broken-contact maximum', () => {
    expect(() => buildWebOpportunityAudit({
      url: 'https://example.invalid/',
      retrievedAt: '2026-08-07T12:00:00.000Z',
      site: { availability: 'reachable' },
      mobile: measured('fully-responsive'),
      obsoleteAppearance: measured([]),
      brokenElements: measured({ checkedLinks: 1, brokenLinks: 0, contactPath: { status: 'verified-broken', verification: 'parsed-only' as never } }),
      performance: measured({ timeToInteractiveSeconds: 1, mobileProfile: 'PageSpeed Insights Lighthouse mobile' }),
      commercialIneffectiveness: measured([]),
    })).toThrow('requires executed verification')
  })

  it('requires evidence for visual and content claims', () => {
    expect(() => buildWebOpportunityAudit({
      url: 'https://example.invalid/',
      retrievedAt: '2026-08-07T12:00:00.000Z',
      site: { availability: 'reachable' },
      mobile: measured('fully-responsive'),
      obsoleteAppearance: measured([{ indicator: 'no-https', evidence: '' }]),
      brokenElements: measured({ checkedLinks: 1, brokenLinks: 0, contactPath: { status: 'verified-working' } }),
      performance: measured({ timeToInteractiveSeconds: 1, mobileProfile: 'PageSpeed Insights Lighthouse mobile' }),
      commercialIneffectiveness: measured([]),
    })).toThrow('require evidence')
  })
})
