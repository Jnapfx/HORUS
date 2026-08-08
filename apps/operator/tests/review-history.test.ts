import { describe, expect, it } from 'vitest'
import { summarizeReviewHistory } from '../src/domain/review-history'

const RETRIEVED_AT = '2026-08-07T00:00:00.000Z'

describe('summarizeReviewHistory', () => {
  it('buckets reviews into the 90-day and 365-day windows against retrievedAt, never the current clock', () => {
    const summary = summarizeReviewHistory({
      retrievedAt: RETRIEVED_AT,
      paginationExhausted: true,
      reviews: [
        { isoDate: '2026-08-01T00:00:00.000Z', rating: 5 }, // 6 days old
        { isoDate: '2026-06-01T00:00:00.000Z', rating: 4 }, // ~67 days old
        { isoDate: '2026-03-01T00:00:00.000Z', rating: 5 }, // ~159 days old
        { isoDate: '2025-09-01T00:00:00.000Z', rating: 3 }, // ~340 days old
        { isoDate: '2024-01-01T00:00:00.000Z', rating: 5 }, // >365 days old
      ],
    })

    expect(summary.reviewsLast90Days).toMatchObject({ count: 2, sampleCompleteness: 'complete' })
    expect(summary.reviewsLast365Days).toMatchObject({ count: 4, sampleCompleteness: 'complete' })
    expect(summary.daysSinceLatestReview).toBeCloseTo(6, 0)
  })

  it('marks the 365-day window partial when pagination stopped before the boundary and no review proves it complete', () => {
    const summary = summarizeReviewHistory({
      retrievedAt: RETRIEVED_AT,
      paginationExhausted: false,
      reviews: [
        { isoDate: '2026-08-01T00:00:00.000Z', rating: 5 },
        { isoDate: '2026-07-01T00:00:00.000Z', rating: 5 },
      ],
    })

    expect(summary.reviewsLast90Days).toMatchObject({ sampleCompleteness: 'partial_data' })
    expect(summary.reviewsLast365Days).toMatchObject({ sampleCompleteness: 'partial_data' })
  })

  it('marks the 90-day window complete on its own once a fetched review is already older than 90 days, even mid-page-cap', () => {
    const summary = summarizeReviewHistory({
      retrievedAt: RETRIEVED_AT,
      paginationExhausted: false,
      reviews: [
        { isoDate: '2026-08-01T00:00:00.000Z', rating: 5 },
        { isoDate: '2026-01-01T00:00:00.000Z', rating: 4 }, // well past 90 days, proves the 90-day window complete
      ],
    })

    expect(summary.reviewsLast90Days).toMatchObject({ sampleCompleteness: 'complete' })
    expect(summary.reviewsLast365Days).toMatchObject({ sampleCompleteness: 'partial_data' })
  })

  it('computes recentConsistency only from 5 or more trailing-year reviews, matching reputation-scoring-v1\'s own minimum', () => {
    const fourReviews = summarizeReviewHistory({
      retrievedAt: RETRIEVED_AT,
      paginationExhausted: true,
      reviews: Array.from({ length: 4 }, (_, i) => ({ isoDate: `2026-0${i + 1}-01T00:00:00.000Z`, rating: 5 })),
    })
    expect(fourReviews.recentConsistency).toBeNull()

    const fiveReviews = summarizeReviewHistory({
      retrievedAt: RETRIEVED_AT,
      paginationExhausted: true,
      reviews: [
        { isoDate: '2026-07-01T00:00:00.000Z', rating: 5 },
        { isoDate: '2026-06-01T00:00:00.000Z', rating: 5 },
        { isoDate: '2026-05-01T00:00:00.000Z', rating: 4 },
        { isoDate: '2026-04-01T00:00:00.000Z', rating: 4 },
        { isoDate: '2026-03-01T00:00:00.000Z', rating: 5 },
      ],
    })
    expect(fiveReviews.recentConsistency).toMatchObject({ trailingYearReviewCount: 5, trailingYearMeanRating: 4.6 })
  })

  it('handles zero retrieved reviews without throwing', () => {
    const summary = summarizeReviewHistory({ retrievedAt: RETRIEVED_AT, paginationExhausted: true, reviews: [] })
    expect(summary.daysSinceLatestReview).toBeNull()
    expect(summary.recentConsistency).toBeNull()
    expect(summary.reviewsLast90Days).toMatchObject({ count: 0 })
  })

  it('silently drops a review with an unparseable date rather than throwing', () => {
    const summary = summarizeReviewHistory({
      retrievedAt: RETRIEVED_AT,
      paginationExhausted: true,
      reviews: [{ isoDate: 'not-a-date', rating: 5 }, { isoDate: '2026-08-01T00:00:00.000Z', rating: 5 }],
    })
    expect(summary.reviewsLast90Days.count).toBe(1)
  })

  it('rejects an invalid retrievedAt', () => {
    expect(() => summarizeReviewHistory({ retrievedAt: 'not-a-date', paginationExhausted: true, reviews: [] })).toThrow('retrievedAt')
  })
})
