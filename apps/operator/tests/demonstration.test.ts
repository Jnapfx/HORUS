import { describe, expect, it } from 'vitest'
import { buildDemonstrationSite, type DemonstrationBusinessInput } from '../src/domain/demonstration'

const fullBusiness: DemonstrationBusinessInput = {
  name: 'Tuff Lawn',
  category: 'Landscaper',
  address: '1 Main St, Stamford, CT',
  phone: '(203) 555-0100',
  website: 'https://tufflawn.example',
  rating: 4.6,
  reviewCount: 314,
}

describe('buildDemonstrationSite', () => {
  it('renders every verified field with no placeholders when all data is present', () => {
    const result = buildDemonstrationSite({ business: fullBusiness, generatedAt: '2026-08-08T12:00:00.000Z' })

    expect(result.missingFields).toEqual([])
    expect(result.html).toContain('Tuff Lawn')
    expect(result.html).toContain('Landscaper')
    expect(result.html).toContain('1 Main St, Stamford, CT')
    expect(result.html).toContain('tel:2035550100')
    expect(result.html).toContain('https://tufflawn.example')
    expect(result.html).toContain('4.6')
    expect(result.html).toContain('314 Google reviews')
  })

  it('always includes the DEC-024 notice and noindex meta tag, unconditionally', () => {
    const result = buildDemonstrationSite({ business: fullBusiness, generatedAt: '2026-08-08T12:00:00.000Z' })

    expect(result.html).toContain('HORUS concept demonstration, not')
    expect(result.html).toContain('meta name="robots" content="noindex, nofollow"')
  })

  it('never fabricates missing fields — uses a bracketed placeholder and records it instead', () => {
    const sparse: DemonstrationBusinessInput = {
      name: 'Mennillo Plumbing',
      category: null,
      address: null,
      phone: null,
      website: null,
      rating: null,
      reviewCount: null,
    }
    const result = buildDemonstrationSite({ business: sparse, generatedAt: '2026-08-08T12:00:00.000Z' })

    expect(result.missingFields).toEqual(expect.arrayContaining(['category', 'address', 'phone', 'website', 'reputation']))
    expect(result.html).toContain('[Category not available]')
    expect(result.html).toContain('[Address not publicly listed]')
    expect(result.html).toContain('[Phone number not publicly listed]')
    expect(result.html).not.toContain('tel:')
    // No invented services, testimonials, or pricing sections exist to check for their absence —
    // this asserts the template has no such section header at all.
    expect(result.html.toLowerCase()).not.toContain('testimonial')
    expect(result.html.toLowerCase()).not.toContain('pricing')
    expect(result.html.toLowerCase()).not.toContain('our services')
  })

  it('never leaks the internal reputation or web-opportunity scores into the demo', () => {
    const result = buildDemonstrationSite({ business: fullBusiness, generatedAt: '2026-08-08T12:00:00.000Z' })
    expect(result.html.toLowerCase()).not.toContain('reputation-scoring')
    expect(result.html.toLowerCase()).not.toContain('web-opportunity')
    expect(result.html.toLowerCase()).not.toContain('qualified')
  })

  it('escapes HTML-special characters in business fields rather than injecting them raw', () => {
    const malicious: DemonstrationBusinessInput = {
      name: '<script>alert(1)</script> & Sons',
      category: 'Auto & "Truck" Repair',
      address: null,
      phone: null,
      website: null,
      rating: null,
      reviewCount: null,
    }
    const result = buildDemonstrationSite({ business: malicious, generatedAt: '2026-08-08T12:00:00.000Z' })

    expect(result.html).not.toContain('<script>alert(1)</script>')
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).toContain('&amp;')
    expect(result.html).toContain('&quot;Truck&quot;')
  })

  it('omits the current-website line entirely when no website is on file, rather than showing an empty link', () => {
    const noWebsite: DemonstrationBusinessInput = { ...fullBusiness, website: null }
    const result = buildDemonstrationSite({ business: noWebsite, generatedAt: '2026-08-08T12:00:00.000Z' })
    expect(result.html).not.toContain('Current website:')
  })

  it('is a pure function: identical input produces byte-identical output', () => {
    const a = buildDemonstrationSite({ business: fullBusiness, generatedAt: '2026-08-08T12:00:00.000Z' })
    const b = buildDemonstrationSite({ business: fullBusiness, generatedAt: '2026-08-08T12:00:00.000Z' })
    expect(a.html).toBe(b.html)
  })
})
