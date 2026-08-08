import type { SampledCount } from './reputation-scoring'

export type ReviewRecord = { isoDate: string; rating: number }

export type ReviewHistorySummary = {
  reviewsLast90Days: SampledCount
  reviewsLast365Days: SampledCount
  /** `null` only when no reviews were retrieved at all. */
  daysSinceLatestReview: number | null
  /** `null` when fewer than 5 trailing-365-day reviews were retrieved (charter 9.2, Factor 4's stated minimum). */
  recentConsistency: { trailingYearMeanRating: number; trailingYearReviewCount: number } | null
}

function daysBetween(retrievedAt: Date, isoDate: Date) {
  return (retrievedAt.getTime() - isoDate.getTime()) / (1000 * 60 * 60 * 24)
}

/**
 * Turns a retrieved batch of reviews into the shape `reputation-scoring.ts`
 * needs — nothing here computes a gate, a factor, or a score; this only
 * counts and buckets what was actually retrieved. Charter 9.7: every
 * time-based figure is computed against `retrievedAt`, the stored retrieval
 * timestamp, never the current clock, so a later re-read of the same
 * evidence reproduces the same summary.
 *
 * `paginationExhausted` distinguishes two reasons a review's age might be the
 * oldest one seen: the retrieval ran out of history naturally (no further
 * page existed), or it stopped early at a page cap (DEC-018's cost
 * discipline) while more, older reviews may still exist. The 90-day and
 * 365-day windows are marked complete independently — the 90-day window can
 * already be proven complete by a review that is itself older than 90 days,
 * even if the 365-day window cannot yet be proven either way (charter 9.6).
 */
export function summarizeReviewHistory(input: {
  reviews: readonly ReviewRecord[]
  retrievedAt: string
  paginationExhausted: boolean
}): ReviewHistorySummary {
  if (Number.isNaN(Date.parse(input.retrievedAt))) throw new Error('retrievedAt must be a valid timestamp')

  const retrievedAt = new Date(input.retrievedAt)
  const withAge = input.reviews
    .map((review) => {
      const parsed = Date.parse(review.isoDate)
      if (Number.isNaN(parsed)) return null
      return { ...review, ageDays: daysBetween(retrievedAt, new Date(parsed)) }
    })
    .filter((review): review is ReviewRecord & { ageDays: number } => review !== null && review.ageDays >= 0)

  const within90 = withAge.filter((r) => r.ageDays <= 90)
  const within365 = withAge.filter((r) => r.ageDays <= 365)
  const oldestAgeDays = withAge.length > 0 ? Math.max(...withAge.map((r) => r.ageDays)) : null
  const newestAgeDays = withAge.length > 0 ? Math.min(...withAge.map((r) => r.ageDays)) : null

  const ninetyComplete = input.paginationExhausted || (oldestAgeDays !== null && oldestAgeDays > 90)
  const yearComplete = input.paginationExhausted || (oldestAgeDays !== null && oldestAgeDays > 365)

  const recentConsistency = within365.length >= 5
    ? { trailingYearMeanRating: within365.reduce((sum, r) => sum + r.rating, 0) / within365.length, trailingYearReviewCount: within365.length }
    : null

  return {
    reviewsLast90Days: { count: within90.length, sampleCompleteness: ninetyComplete ? 'complete' : 'partial_data' },
    reviewsLast365Days: { count: within365.length, sampleCompleteness: yearComplete ? 'complete' : 'partial_data' },
    daysSinceLatestReview: newestAgeDays === null ? null : Math.round(newestAgeDays * 100) / 100,
    recentConsistency,
  }
}
