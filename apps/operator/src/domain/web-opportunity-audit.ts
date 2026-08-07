export const WEB_OPPORTUNITY_MODEL_VERSION = 'web-opportunity-v2' as const

export type Measurement<T> =
  | { status: 'measured'; value: T }
  | { status: 'unmeasured'; reason: string }

export type MobileResponsiveness = 'not-responsive' | 'responsive-defective' | 'fully-responsive'

export type ObsoleteAppearanceIndicator =
  | 'four-or-more-font-families'
  | 'six-or-more-non-neutral-colours'
  | 'placeholder-or-theme-content'
  | 'stock-imagery-in-place-of-business-work'
  | 'stale-or-missing-copyright'
  | 'no-https'
  | 'obsolete-technology-marker'

export type CommercialIneffectivenessIndicator =
  | 'no-services-listed'
  | 'no-visible-call-to-action'
  | 'no-contact-route-from-main-page'
  | 'no-photographs-of-business-work'
  | 'no-service-area-or-location'
  | 'no-business-hours'

export type IndicatorEvidence<T extends string> = {
  indicator: T
  evidence: string
}

export type CommercialIndicatorEvidence = {
  indicator: CommercialIneffectivenessIndicator
  searchedLocations: readonly string[]
}

export type BrokenElementObservation = {
  checkedLinks: number
  brokenLinks: number
  contactPath:
    | { status: 'verified-working' }
    | { status: 'verified-broken'; verification: 'executed' }
    | { status: 'unmeasured'; reason: string }
}

export type WebOpportunityAuditInput = {
  url: string
  retrievedAt: string
  site: { availability: 'reachable' } | { availability: 'unreachable'; detail: string }
  mobile: Measurement<MobileResponsiveness>
  obsoleteAppearance: Measurement<readonly IndicatorEvidence<ObsoleteAppearanceIndicator>[]>
  brokenElements: Measurement<BrokenElementObservation>
  performance: Measurement<{ timeToInteractiveSeconds: number; mobileProfile: string }>
  commercialIneffectiveness: Measurement<readonly CommercialIndicatorEvidence[]>
}

export type WebOpportunityFactor = {
  id: 'mobile_responsiveness' | 'obsolete_appearance' | 'broken_elements' | 'load_performance' | 'commercial_ineffectiveness'
  score: number
  maximum: number
  status: 'measured' | 'unmeasured'
  evidence: readonly string[]
}

export type WebOpportunityAudit = {
  modelVersion: typeof WEB_OPPORTUNITY_MODEL_VERSION
  url: string
  retrievedAt: string
  status: 'complete_data' | 'partial_data' | 'insufficient_data'
  scoreLowerBound: number
  factors: readonly WebOpportunityFactor[]
  flags: readonly string[]
}

export type WebsitePresence = 'business-site' | 'no-website' | 'insufficient-data'

export type WebsitePresenceAssessmentInput = {
  listedUrl: string
  destinationUrl?: string
  destination: 'business-site' | 'provider-parking' | 'social-profile' | 'unreachable'
  hasBusinessContent: boolean
  evidence: string
}

export type WebsitePresenceAssessment = {
  presence: WebsitePresence
  automaticCandidate: boolean
  evidence: string
  flags: readonly string[]
}

function validateUrl(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Website audit URL must use HTTP or HTTPS')
  return url.toString()
}

function validateTimestamp(value: string) {
  if (Number.isNaN(Date.parse(value))) throw new Error('Website audit retrieval timestamp must be valid')
  return value
}

/**
 * A provider parking/domain-for-sale page or social-only profile is an
 * observable absence of a business website, not a temporary outage. It creates a discovery candidate,
 * while reputation and the normal approval gates still control publication and
 * outreach.
 */
export function assessWebsitePresence(input: WebsitePresenceAssessmentInput): WebsitePresenceAssessment {
  validateUrl(input.listedUrl)
  if (input.destinationUrl) validateUrl(input.destinationUrl)
  if (!input.evidence.trim()) throw new Error('Website presence assessment requires evidence')

  if (input.destination === 'unreachable') {
    return {
      presence: 'insufficient-data',
      automaticCandidate: false,
      evidence: input.evidence,
      flags: ['Site unreachable at retrieval; re-check before making any website-absence claim.'],
    }
  }

  if ((input.destination === 'provider-parking' || input.destination === 'social-profile') && !input.hasBusinessContent) {
    return {
      presence: 'no-website',
      automaticCandidate: true,
      evidence: input.evidence,
      flags: [input.destination === 'provider-parking'
        ? 'Provider parking without business content is classified as no website.'
        : 'A social-only profile without a business website is classified as no website.'],
    }
  }

  return {
    presence: 'business-site',
    automaticCandidate: false,
    evidence: input.evidence,
    flags: [],
  }
}

function requireDistinct<T extends string>(items: readonly { indicator: T }[], label: string) {
  if (new Set(items.map((item) => item.indicator)).size !== items.length) throw new Error(`${label} indicators must be distinct`)
}

function concaveIndicatorScore(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 6
  if (count === 2) return 11
  if (count === 3) return 15
  if (count === 4) return 18
  return 20
}

function unmeasuredFactor(id: WebOpportunityFactor['id'], maximum: number, reason: string): WebOpportunityFactor {
  return { id, score: 0, maximum, status: 'unmeasured', evidence: [`Unmeasured: ${reason}`] }
}

function scoreMobile(input: Measurement<MobileResponsiveness>): WebOpportunityFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('mobile_responsiveness', 30, input.reason)
  const score = input.value === 'not-responsive' ? 30 : input.value === 'responsive-defective' ? 13 : 0
  return { id: 'mobile_responsiveness', score, maximum: 30, status: 'measured', evidence: [input.value] }
}

function scoreObsoleteAppearance(input: Measurement<readonly IndicatorEvidence<ObsoleteAppearanceIndicator>[]>): WebOpportunityFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('obsolete_appearance', 20, input.reason)
  requireDistinct(input.value, 'Obsolete appearance')
  if (input.value.some((item) => !item.evidence.trim())) throw new Error('Obsolete appearance indicators require evidence')
  return {
    id: 'obsolete_appearance',
    score: concaveIndicatorScore(input.value.length),
    maximum: 20,
    status: 'measured',
    evidence: input.value.map((item) => `${item.indicator}: ${item.evidence}`),
  }
}

function scoreBrokenElements(input: Measurement<BrokenElementObservation>): WebOpportunityFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('broken_elements', 18, input.reason)
  const { checkedLinks, brokenLinks, contactPath } = input.value
  if (!Number.isInteger(checkedLinks) || checkedLinks < 1) throw new Error('Broken-link analysis requires at least one checked link')
  if (!Number.isInteger(brokenLinks) || brokenLinks < 0 || brokenLinks > checkedLinks) throw new Error('Broken-link count must be between zero and checked links')

  if (contactPath.status === 'verified-broken') {
    if (contactPath.verification !== 'executed') throw new Error('A broken contact path requires executed verification')
    return { id: 'broken_elements', score: 18, maximum: 18, status: 'measured', evidence: ['Broken contact path verified by executed interaction.'] }
  }

  const ratioScore = 18 * Math.min(brokenLinks / checkedLinks / 0.2, 1)
  const contactEvidence = contactPath.status === 'unmeasured'
    ? `Contact path unmeasured: ${contactPath.reason}`
    : 'Contact path verified working.'
  return {
    id: 'broken_elements',
    score: ratioScore,
    maximum: 18,
    status: 'measured',
    evidence: [`${brokenLinks}/${checkedLinks} checked links were broken.`, contactEvidence],
  }
}

function scorePerformance(input: Measurement<{ timeToInteractiveSeconds: number; mobileProfile: string }>): WebOpportunityFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('load_performance', 12, input.reason)
  const { timeToInteractiveSeconds, mobileProfile } = input.value
  if (!Number.isFinite(timeToInteractiveSeconds) || timeToInteractiveSeconds < 0) throw new Error('Time to interactive must be a non-negative number')
  if (!mobileProfile.trim()) throw new Error('Load performance requires a recorded mobile profile')
  const score = timeToInteractiveSeconds <= 2.5 ? 0 : timeToInteractiveSeconds <= 8 ? 12 * (timeToInteractiveSeconds - 2.5) / 5.5 : 12
  return {
    id: 'load_performance',
    score,
    maximum: 12,
    status: 'measured',
    evidence: [`${timeToInteractiveSeconds}s time to interactive using ${mobileProfile}.`],
  }
}

function scoreCommercialIneffectiveness(input: Measurement<readonly CommercialIndicatorEvidence[]>): WebOpportunityFactor {
  if (input.status === 'unmeasured') return unmeasuredFactor('commercial_ineffectiveness', 20, input.reason)
  requireDistinct(input.value, 'Commercial ineffectiveness')
  if (input.value.some((item) => item.searchedLocations.length === 0 || item.searchedLocations.some((location) => !location.trim()))) {
    throw new Error('Commercial ineffectiveness indicators require searched locations')
  }
  return {
    id: 'commercial_ineffectiveness',
    score: concaveIndicatorScore(input.value.length),
    maximum: 20,
    status: 'measured',
    evidence: input.value.map((item) => `${item.indicator}; searched: ${item.searchedLocations.join(', ')}.`),
  }
}

export function buildWebOpportunityAudit(input: WebOpportunityAuditInput): WebOpportunityAudit {
  const url = validateUrl(input.url)
  const retrievedAt = validateTimestamp(input.retrievedAt)
  if (input.site.availability === 'unreachable') {
    const factors: WebOpportunityFactor[] = [
      unmeasuredFactor('mobile_responsiveness', 30, input.site.detail),
      unmeasuredFactor('obsolete_appearance', 20, input.site.detail),
      unmeasuredFactor('broken_elements', 18, input.site.detail),
      unmeasuredFactor('load_performance', 12, input.site.detail),
      unmeasuredFactor('commercial_ineffectiveness', 20, input.site.detail),
    ]
    return { modelVersion: WEB_OPPORTUNITY_MODEL_VERSION, url, retrievedAt, status: 'insufficient_data', scoreLowerBound: 0, factors, flags: ['Site unreachable at retrieval; re-check before making any claim.'] }
  }

  const factors = [
    scoreMobile(input.mobile),
    scoreObsoleteAppearance(input.obsoleteAppearance),
    scoreBrokenElements(input.brokenElements),
    scorePerformance(input.performance),
    scoreCommercialIneffectiveness(input.commercialIneffectiveness),
  ] as const
  const hasUnmeasuredFactor = factors.some((factor) => factor.status === 'unmeasured')
  const hasUnmeasuredContactPath = input.brokenElements.status === 'measured' && input.brokenElements.value.contactPath.status === 'unmeasured'
  const flags = [
    ...(hasUnmeasuredFactor ? ['One or more factors are unmeasured; score is a lower bound.'] : []),
    ...(hasUnmeasuredContactPath ? ['Contact-path execution is unmeasured; no contact-path defect was inferred.'] : []),
    ...(factors.find((factor) => factor.id === 'commercial_ineffectiveness')!.score > 0 ? ['Commercial-ineffectiveness evidence requires operator review.'] : []),
  ]
  return {
    modelVersion: WEB_OPPORTUNITY_MODEL_VERSION,
    url,
    retrievedAt,
    status: hasUnmeasuredFactor || hasUnmeasuredContactPath ? 'partial_data' : 'complete_data',
    scoreLowerBound: factors.reduce((total, factor) => total + factor.score, 0),
    factors,
    flags,
  }
}
