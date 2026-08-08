import { describe, expect, it } from 'vitest'
import { assessProximity, bandForDistanceMiles, compareProximityBands, haversineDistanceMiles } from '../src/domain/proximity'

// Stamford, CT and Norwalk, CT — roughly 14 miles apart per DEC-026's own description.
const STAMFORD = { latitude: 41.0534, longitude: -73.5387 }
const NORWALK = { latitude: 41.1177, longitude: -73.4082 }

describe('haversineDistanceMiles', () => {
  it('computes a plausible straight-line distance, smaller than DEC-026\'s ~14-mile driving-distance description (as expected: straight-line is never longer than the road route)', () => {
    const distance = haversineDistanceMiles(STAMFORD, NORWALK)
    expect(distance).toBeGreaterThan(5)
    expect(distance).toBeLessThan(14)
  })

  it('returns zero for identical points', () => {
    expect(haversineDistanceMiles(STAMFORD, STAMFORD)).toBeCloseTo(0, 5)
  })

  it('is symmetric', () => {
    expect(haversineDistanceMiles(STAMFORD, NORWALK)).toBeCloseTo(haversineDistanceMiles(NORWALK, STAMFORD), 5)
  })

  it('rejects out-of-range coordinates', () => {
    expect(() => haversineDistanceMiles({ latitude: 91, longitude: 0 }, STAMFORD)).toThrow('latitude')
    expect(() => haversineDistanceMiles({ latitude: 0, longitude: 181 }, STAMFORD)).toThrow('longitude')
  })
})

describe('bandForDistanceMiles', () => {
  it('buckets into the charter\'s 5/15/30-mile bands', () => {
    expect(bandForDistanceMiles(0)).toBe('within_5_miles')
    expect(bandForDistanceMiles(5)).toBe('within_5_miles')
    expect(bandForDistanceMiles(5.01)).toBe('within_15_miles')
    expect(bandForDistanceMiles(15)).toBe('within_15_miles')
    expect(bandForDistanceMiles(15.01)).toBe('within_30_miles')
    expect(bandForDistanceMiles(30)).toBe('within_30_miles')
    expect(bandForDistanceMiles(30.01)).toBe('beyond_30_miles')
  })

  it('rejects a negative distance', () => {
    expect(() => bandForDistanceMiles(-1)).toThrow('non-negative')
  })
})

describe('assessProximity', () => {
  it('labels the result as straight-line, not driving distance', () => {
    const assessment = assessProximity(STAMFORD, NORWALK)
    expect(assessment.method).toBe('straight_line')
    expect(assessment.band).toBe('within_15_miles')
    expect(assessment.distanceMiles).toBeGreaterThan(5)
  })
})

describe('compareProximityBands', () => {
  it('orders a nearer band before a farther one, per DEC-017', () => {
    expect(compareProximityBands('within_5_miles', 'within_15_miles')).toBeLessThan(0)
    expect(compareProximityBands('within_30_miles', 'within_5_miles')).toBeGreaterThan(0)
    expect(compareProximityBands('beyond_30_miles', 'beyond_30_miles')).toBe(0)

    const bands: Array<'within_5_miles' | 'within_15_miles' | 'within_30_miles' | 'beyond_30_miles'> = ['beyond_30_miles', 'within_15_miles', 'within_5_miles', 'within_30_miles']
    expect([...bands].sort(compareProximityBands)).toEqual(['within_5_miles', 'within_15_miles', 'within_30_miles', 'beyond_30_miles'])
  })
})
