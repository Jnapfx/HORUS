/**
 * Charter 11.1 / DEC-016 / DEC-017: proximity is measured from a stored home
 * base, in miles, bucketed into bands so a nearer band always outranks a
 * farther one. DEC-026 fixes miles as the unit for the Stamford/Norwalk
 * market. The 5/15/30-mile band boundaries remain provisional and unobserved
 * (charter §2, "Untested numbers") — Phase 1's checkpoint already recorded
 * that no routing capability is configured, so this is a straight-line
 * (great-circle) distance, not a driving distance. That gap is stated here,
 * not hidden: `ProximityAssessment.method` says so on every result.
 */

export type Coordinates = { latitude: number; longitude: number }

export type ProximityBand = 'within_5_miles' | 'within_15_miles' | 'within_30_miles' | 'beyond_30_miles'

export type ProximityAssessment = {
  distanceMiles: number
  band: ProximityBand
  method: 'straight_line'
}

const EARTH_RADIUS_MILES = 3958.7613

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

function validateCoordinates(point: Coordinates, label: string) {
  if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90) {
    throw new Error(`${label} latitude must be between -90 and 90`)
  }
  if (!Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
    throw new Error(`${label} longitude must be between -180 and 180`)
  }
}

/** Great-circle distance in miles between two points, via the haversine formula. */
export function haversineDistanceMiles(a: Coordinates, b: Coordinates): number {
  validateCoordinates(a, 'First point')
  validateCoordinates(b, 'Second point')

  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const centralAngle = 2 * Math.asin(Math.min(1, Math.sqrt(h)))
  return EARTH_RADIUS_MILES * centralAngle
}

export function bandForDistanceMiles(distanceMiles: number): ProximityBand {
  if (distanceMiles < 0) throw new Error('Distance must be non-negative')
  if (distanceMiles <= 5) return 'within_5_miles'
  if (distanceMiles <= 15) return 'within_15_miles'
  if (distanceMiles <= 30) return 'within_30_miles'
  return 'beyond_30_miles'
}

export function assessProximity(homeBase: Coordinates, candidate: Coordinates): ProximityAssessment {
  const distanceMiles = haversineDistanceMiles(homeBase, candidate)
  return { distanceMiles: Math.round(distanceMiles * 100) / 100, band: bandForDistanceMiles(distanceMiles), method: 'straight_line' }
}

/**
 * DEC-017: a nearer band always outranks a farther one, for use as a
 * `Array.prototype.sort` comparator. Ties within a band are not resolved
 * here — web-opportunity ranks within a band, reputation breaks ties within
 * that (charter §11), both outside this module's concern.
 */
export function compareProximityBands(a: ProximityBand, b: ProximityBand): number {
  const order: readonly ProximityBand[] = ['within_5_miles', 'within_15_miles', 'within_30_miles', 'beyond_30_miles']
  return order.indexOf(a) - order.indexOf(b)
}
