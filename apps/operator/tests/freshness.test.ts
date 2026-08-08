import { describe, expect, it } from 'vitest'
import { assessFreshness, assessOldest, MAX_EVIDENCE_AGE_DAYS } from '../src/domain/freshness'

/**
 * DEC-089. Charter section 14/15's 30-day contact gate, which until now existed
 * only in the charter and in comments.
 */

const NOW = new Date('2026-08-08T12:00:00.000Z')
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

describe('DEC-089 — the 30-day limit', () => {
  it('holds the charter value', () => {
    expect(MAX_EVIDENCE_AGE_DAYS).toBe(30)
  })

  it.each([0, 1, 15, 29, 30])('treats evidence %s days old as fresh and does not block', (days) => {
    const assessment = assessFreshness({ retrievedAt: daysBefore(days), now: NOW })
    expect(assessment.status).toBe('fresh')
    expect(assessment.ageDays).toBe(days)
    expect(assessment.blocksContact).toBe(false)
  })

  it.each([31, 45, 400])('treats evidence %s days old as stale and blocks contact', (days) => {
    const assessment = assessFreshness({ retrievedAt: daysBefore(days), now: NOW })
    expect(assessment.status).toBe('stale')
    expect(assessment.ageDays).toBe(days)
    expect(assessment.blocksContact).toBe(true)
    expect(assessment.evidence).toContain('Refresh before publishing or contacting')
  })

  it('puts the boundary exactly at 30 days, not 29 or 31', () => {
    expect(assessFreshness({ retrievedAt: daysBefore(30), now: NOW }).blocksContact).toBe(false)
    expect(assessFreshness({ retrievedAt: daysBefore(31), now: NOW }).blocksContact).toBe(true)
  })
})

describe('DEC-089 — missing or unusable time never opens the gate', () => {
  // Charter 9.6's principle applied to time: absent information is never a
  // pass. Every one of these blocks rather than defaulting to fresh.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['unparseable', 'last Tuesday'],
  ])('blocks when the retrieval time is %s', (_label, retrievedAt) => {
    const assessment = assessFreshness({ retrievedAt: retrievedAt as string | null | undefined, now: NOW })
    expect(assessment.status).toBe('unknown')
    expect(assessment.blocksContact).toBe(true)
    expect(assessment.ageDays).toBeNull()
  })

  it('blocks on a future timestamp rather than reading it as brand new', () => {
    // A clock error must not be able to open a contact gate.
    const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString()
    const assessment = assessFreshness({ retrievedAt: future, now: NOW })
    expect(assessment.status).toBe('unknown')
    expect(assessment.blocksContact).toBe(true)
  })
})

describe('DEC-089 — the oldest evidence governs', () => {
  it('is stale when any input is stale, however fresh the rest', () => {
    const assessment = assessOldest({
      retrievedAt: [daysBefore(0), daysBefore(1), daysBefore(90)],
      now: NOW,
    })
    expect(assessment.status).toBe('stale')
    expect(assessment.ageDays).toBe(90)
    expect(assessment.blocksContact).toBe(true)
  })

  it('is fresh only when every input is fresh, and reports the oldest', () => {
    const assessment = assessOldest({ retrievedAt: [daysBefore(2), daysBefore(20), daysBefore(9)], now: NOW })
    expect(assessment.status).toBe('fresh')
    expect(assessment.ageDays).toBe(20)
    expect(assessment.blocksContact).toBe(false)
  })

  it('lets an unknown input outrank a merely stale one', () => {
    const assessment = assessOldest({ retrievedAt: [daysBefore(90), null], now: NOW })
    expect(assessment.status).toBe('unknown')
    expect(assessment.blocksContact).toBe(true)
  })

  it('blocks on no evidence at all', () => {
    expect(assessOldest({ retrievedAt: [], now: NOW }).blocksContact).toBe(true)
  })
})

describe('DEC-089 — freshness deliberately depends on the clock', () => {
  it('turns the same evidence stale as time passes', () => {
    // The one place in the domain where this is correct. Scoring must be
    // reproducible against its stored timestamp (charter 9.7); freshness must
    // not be, because the question is whether the evidence is still current
    // *today*.
    const retrievedAt = daysBefore(29)
    expect(assessFreshness({ retrievedAt, now: NOW }).status).toBe('fresh')
    const twoDaysLater = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000)
    expect(assessFreshness({ retrievedAt, now: twoDaysLater }).status).toBe('stale')
  })
})
