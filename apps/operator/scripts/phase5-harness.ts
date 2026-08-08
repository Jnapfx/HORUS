/**
 * Reconstructs the two Phase 5 prospects — Finescape and Sons, and SEASONS
 * EATS — from the retained evidence in `cache/phase5/`, and scores them through
 * the real `reputation-scoring-v1` implementation.
 *
 * Companion to `calibration-harness.ts` (DEC-086), which did the same for the
 * Phase 1 calibration set. Same reason: both published figures — Finescape's
 * 48.1 and SEASONS EATS' 73.06 — were computed before the model existed as
 * code, and the retirement of one concept and the approval of the other rest
 * on them.
 *
 * The two cases are stored in different shapes and this harness does not
 * pretend otherwise. Finescape is raw SerpApi (`place_info`, `search_metadata`,
 * reviews with `iso_date`). SEASONS EATS is an already-normalized artifact
 * (`businessName`, `rating`, `reviewCount`, reviews with `isoDate`) whose
 * retrieval timestamp lives only in the `raw_snapshots` table, not in the file.
 * Reading each in its own shape is the honest option; converting one into the
 * other would invent structure the evidence does not have.
 *
 * Spends nothing — reads only what is already on disk.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildReputationScore, type ReputationScore } from '../src/domain/reputation-scoring'
import { summarizeReviewHistory } from '../src/domain/review-history'

const PHASE5 = join(import.meta.dirname, '../../../cache/phase5/raw')

export type Case = {
  name: string
  published: number
  rating: number
  reviewCount: number
  /** From `raw_snapshots.retrieved_at` — charter 9.7 scores against this, never the clock. */
  retrievedAt: string
  reviews: { isoDate: string; rating: number }[]
  paginationExhausted: boolean
  files: string[]
}

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(PHASE5, relative), 'utf8'))
}

/** Finescape: raw SerpApi review pages. */
export function readFinescape(): Case {
  const files = [
    'serpapi_google_maps_reviews/217c262ac787a179222e054c233f52fd1678e4f85c475a5a2e5e478952f17eb7.json',
    'serpapi_google_maps_reviews/11dd339c49e31562ddd19c4c225511cb3043a5689c24771ab511999f609041ba.json',
  ]
  const pages = files.map(readJson)
  const seen = new Set<string>()
  const reviews: { isoDate: string; rating: number }[] = []
  for (const page of pages) {
    for (const review of (page.reviews as { iso_date?: string; rating?: number }[]) ?? []) {
      if (!review.iso_date || typeof review.rating !== 'number') continue
      const key = `${review.iso_date}|${review.rating}`
      if (seen.has(key)) continue
      seen.add(key)
      reviews.push({ isoDate: review.iso_date, rating: review.rating })
    }
  }
  const identity = pages[0].place_info as { rating: number; reviews: number }
  const last = pages[pages.length - 1]
  return {
    name: 'Finescape and Sons',
    published: 48.1,
    rating: identity.rating,
    reviewCount: identity.reviews,
    retrievedAt: '2026-08-06T23:48:43.000Z',
    reviews,
    paginationExhausted: !(last.serpapi_pagination as { next?: string } | undefined)?.next,
    files,
  }
}

/** SEASONS EATS: already-normalized artifacts; the 28-review file supersedes the 18. */
export function readSeasonsEats(): Case {
  const files = [
    'serpapi-google-maps-reviews/98a27e5898f659d77c5521365af162c47fe252fbe5a3f228dc8c8a55421aa5cf.json',
    'serpapi-google-maps-reviews/fa21eb48d2df118bafe48e386235fd3144286268ab16e4aaebac7db171322065.json',
  ]
  const pages = files.map(readJson)
  const seen = new Set<string>()
  const reviews: { isoDate: string; rating: number }[] = []
  for (const page of pages) {
    for (const review of (page.reviews as { isoDate?: string; rating?: number }[]) ?? []) {
      if (!review.isoDate || typeof review.rating !== 'number') continue
      const key = `${review.isoDate}|${review.rating}`
      if (seen.has(key)) continue
      seen.add(key)
      reviews.push({ isoDate: review.isoDate, rating: review.rating })
    }
  }
  const last = pages[pages.length - 1]
  return {
    name: 'SEASONS EATS',
    published: 73.06,
    rating: last.rating as number,
    reviewCount: last.reviewCount as number,
    retrievedAt: '2026-08-07T02:37:55.856Z',
    reviews,
    paginationExhausted: !(last.pagination as { next?: boolean } | undefined)?.next,
    files,
  }
}

export function scoreCase(input: Case): ReputationScore {
  const summary = summarizeReviewHistory({
    reviews: input.reviews,
    retrievedAt: input.retrievedAt,
    paginationExhausted: input.paginationExhausted,
  })
  const notAssessed = {
    status: 'insufficient_data' as const,
    evidence: 'Not reviewed by the operator in this reproduction.',
  }
  return buildReputationScore({
    listingId: input.name,
    retrievedAt: input.retrievedAt,
    rating: { status: 'measured', value: input.rating },
    reviewCount: { status: 'measured', value: input.reviewCount },
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

export function reproducePhase5() {
  return [readFinescape(), readSeasonsEats()].map((input) => ({ input, result: scoreCase(input) }))
}
