/**
 * Reconstructs the Phase 1 calibration reputation scores from the retained raw
 * SerpApi evidence, through the real `reputation-scoring-v1` implementation.
 *
 * Why this exists: the calibration figures published in `CURRENT_STATE.md`
 * were produced on 2026-08-05, when charter section 9 was a specification and
 * `src/domain/reputation-scoring.ts` did not exist. DEC-068 implemented the
 * model in code and recorded, as an explicit open follow-up, that the
 * historical figures had never been reproduced through that implementation.
 * Until they are, every conclusion resting on them — the 70-point threshold
 * review, the Factor-4 floor check, the boundary review — rests on numbers no
 * running code has ever generated.
 *
 * This spends nothing. It reads only the 230 cached files already on disk
 * (DEC-020: once raw responses are stored, any model version can be scored
 * against them for free).
 *
 * Charter 9.7 is the reason this is reproducible at all: every time-based
 * figure is computed against the stored retrieval timestamp, never the current
 * clock, so running this a year from now must give the same answer.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildReputationScore, type ReputationScore } from '../src/domain/reputation-scoring'
import { summarizeReviewHistory } from '../src/domain/review-history'

const CACHE = join(import.meta.dirname, '../../../cache/raw/serpapi/google_maps')

type Page = {
  dataId: string
  retrievedAt: string
  title: string | null
  rating: number | null
  reviewCount: number | null
  reviews: { isoDate: string; rating: number }[]
  hasNextPage: boolean
}

/** SerpApi's `created_at` is `YYYY-MM-DD HH:MM:SS UTC`, not ISO 8601. */
function toIso(created: string): string {
  return `${created.replace(' UTC', '').replace(' ', 'T')}Z`
}

export function readPages(): Page[] {
  const pages: Page[] = []
  for (const name of readdirSync(CACHE)) {
    if (!name.endsWith('.json') || !name.includes('reviews')) continue
    const payload = JSON.parse(readFileSync(join(CACHE, name), 'utf8'))
    const dataId = payload?.search_parameters?.data_id
    const createdAt = payload?.search_metadata?.created_at
    if (!dataId || !createdAt || !Array.isArray(payload.reviews)) continue
    pages.push({
      dataId,
      retrievedAt: toIso(createdAt),
      title: payload?.place_info?.title ?? null,
      rating: payload?.place_info?.rating ?? null,
      reviewCount: payload?.place_info?.reviews ?? null,
      reviews: payload.reviews
        .filter((review: { iso_date?: string; rating?: number }) => review.iso_date && typeof review.rating === 'number')
        .map((review: { iso_date: string; rating: number }) => ({ isoDate: review.iso_date, rating: review.rating })),
      hasNextPage: Boolean(payload?.serpapi_pagination?.next),
    })
  }
  return pages
}

/** One business, with its pages joined in retrieval order. */
export type Business = {
  dataId: string
  title: string
  rating: number | null
  reviewCount: number | null
  retrievedAt: string
  reviews: { isoDate: string; rating: number }[]
  paginationExhausted: boolean
  pageCount: number
}

export function groupByBusiness(pages: Page[]): Business[] {
  const byId = new Map<string, Page[]>()
  for (const page of pages) {
    const existing = byId.get(page.dataId)
    if (existing) existing.push(page)
    else byId.set(page.dataId, [page])
  }

  const businesses: Business[] = []
  for (const [dataId, group] of byId) {
    group.sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt))
    const identified = group.find((page) => page.title !== null) ?? group[0]
    // Deduplicate: a retry can re-fetch a page already held.
    const seen = new Set<string>()
    const reviews: { isoDate: string; rating: number }[] = []
    for (const page of group) {
      for (const review of page.reviews) {
        const key = `${review.isoDate}|${review.rating}`
        if (seen.has(key)) continue
        seen.add(key)
        reviews.push(review)
      }
    }
    businesses.push({
      dataId,
      title: identified.title ?? dataId,
      rating: identified.rating,
      reviewCount: identified.reviewCount,
      // Charter 9.7 — score against the evidence's own retrieval time.
      retrievedAt: group[group.length - 1].retrievedAt,
      reviews,
      // Exhausted only if the last page retrieved offered no further page.
      paginationExhausted: !group[group.length - 1].hasNextPage,
      pageCount: group.length,
    })
  }
  return businesses.sort((a, b) => a.title.localeCompare(b.title))
}

export function score(business: Business): ReputationScore {
  const summary = summarizeReviewHistory({
    reviews: business.reviews,
    retrievedAt: business.retrievedAt,
    paginationExhausted: business.paginationExhausted,
  })
  // G4/G5/G6 are judgment-dependent (charter 9.5, DEC-008) and no operator has
  // assessed this historical evidence, so they stay `insufficient_data` — the
  // same choice the live `CandidateScoreAction` makes. That is why `qualified`
  // is false throughout; the figure being reproduced is `scoreLowerBound`.
  const notAssessed = { status: 'insufficient_data' as const, evidence: 'Not reviewed by the operator in this reproduction.' }
  return buildReputationScore({
    listingId: business.dataId,
    retrievedAt: business.retrievedAt,
    rating: business.rating === null
      ? { status: 'unmeasured', reason: 'No rating in the cached place_info.' }
      : { status: 'measured', value: business.rating },
    reviewCount: business.reviewCount === null
      ? { status: 'unmeasured', reason: 'No review count in the cached place_info.' }
      : { status: 'measured', value: business.reviewCount },
    recentActivity: {
      reviewsLast90Days: { status: 'measured', value: summary.reviewsLast90Days },
      reviewsLast365Days: { status: 'measured', value: summary.reviewsLast365Days },
      daysSinceLatestReview: summary.daysSinceLatestReview === null
        ? { status: 'unmeasured', reason: 'No reviews were retrieved.' }
        : { status: 'measured', value: summary.daysSinceLatestReview },
    },
    recentConsistency: summary.recentConsistency
      ? { status: 'measured', value: summary.recentConsistency }
      : { status: 'unmeasured', reason: 'Fewer than 5 trailing-year reviews were retrieved.' },
    longevity: { status: 'unmeasured', reason: 'Full-history retrieval was not performed (DEC-018 cost discipline).' },
    complaintPattern: notAssessed,
    operationalStatus: notAssessed,
    listingIdentity: notAssessed,
    market: { status: 'within_target', evidence: 'Retrieved by a search already scoped to the target city.' },
  })
}


/** Figures published in CURRENT_STATE.md on 2026-08-05, before the code existed. */
export const PUBLISHED: Record<string, number> = {
  'Tuff Lawn': 73.6,
  'CINCO DE MAYO': 68.3,
  'United Sewer & Water': 65.6,
  'Barcelona Wine Bar': 65.4,
  'Mashed Burgers': 68.3,
  'FAIRCONN Plumbing': 65.0,
}

/**
 * The two businesses CURRENT_STATE.md labels `partial`. Its own words: the 8
 * partial histories were "scored conservatively with Factor 4 at zero and
 * Factor 5 as `longevity_unknown`". A recomputation that does not apply that
 * conservative floor must therefore come out higher by exactly the Factor-4
 * award, and by nothing else.
 */
export const SCORED_WITH_FACTOR_4_FLOORED = new Set(['Mashed Burgers', 'FAIRCONN Plumbing'])

export function reproduce() {
  const businesses = groupByBusiness(readPages())
  return businesses.map((business) => ({ business, result: score(business) }))
}

export function findByName(
  scored: ReturnType<typeof reproduce>,
  name: string,
) {
  return scored.find(({ business }) => business.title.toLowerCase().startsWith(name.toLowerCase()))
}
