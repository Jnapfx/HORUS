import { describe, expect, it } from 'vitest'
import {
  buildJudgmentLog,
  findRecordedJudgment,
  JUDGMENT_AGGREGATE_TYPE,
  JUDGMENT_EVENT_TYPE,
  type JudgmentEvent,
} from '../src/domain/judgment-log'
import { emptyJudgment, type OperatorJudgmentDraft } from '../src/domain/operator-judgment'

/**
 * DEC-094. The operator's judgment, made durable.
 *
 * A judgment is the one input to a reputation score that cannot be recomputed
 * from retained evidence: rerunning the model reproduces every factor and
 * every objective gate, but nothing can reconstruct what the operator
 * concluded from reading the reviews. DEC-091 left it in component state and
 * said so; this closes it.
 */

const judgment = (verdict = 'none_found'): OperatorJudgmentDraft => ({
  complaintPattern: { verdict: verdict as never, rationale: 'Read the 20 most recent reviews.' },
  operationalStatus: { verdict: 'active', rationale: 'Hours posted; recent visits described.' },
  listingIdentity: { verdict: 'confirmed', rationale: 'Name, address and reviews all match.' },
})

const event = (over: Partial<JudgmentEvent> = {}): JudgmentEvent => ({
  aggregateType: JUDGMENT_AGGREGATE_TYPE,
  aggregateId: 'listing-1',
  eventType: JUDGMENT_EVENT_TYPE,
  payload: judgment(),
  occurredAt: '2026-08-09T10:00:00.000Z',
  ...over,
})

describe('DEC-094 — reading a judgment back', () => {
  it('returns nothing for a listing never judged', () => {
    expect(findRecordedJudgment([], 'listing-1')).toBeNull()
    expect(findRecordedJudgment([event({ aggregateId: 'other' })], 'listing-1')).toBeNull()
  })

  it('returns the judgment with its rationale intact', () => {
    const found = findRecordedJudgment([event()], 'listing-1')
    expect(found?.judgment.complaintPattern.rationale).toBe('Read the 20 most recent reviews.')
    expect(found?.recordedAt).toBe('2026-08-09T10:00:00.000Z')
    expect(found?.revision).toBe(1)
  })

  it('keeps listings separate', () => {
    const log = buildJudgmentLog([
      event({ aggregateId: 'a' }),
      event({ aggregateId: 'b', payload: judgment('pattern_found') }),
    ])
    expect(log.get('a')?.judgment.complaintPattern.verdict).toBe('none_found')
    expect(log.get('b')?.judgment.complaintPattern.verdict).toBe('pattern_found')
  })
})

describe('DEC-094 — a later judgment supersedes without erasing', () => {
  const first = event({ occurredAt: '2026-08-09T10:00:00.000Z', payload: judgment('none_found') })
  const second = event({ occurredAt: '2026-08-09T12:00:00.000Z', payload: judgment('pattern_found') })

  it('takes the most recent verdict', () => {
    const found = findRecordedJudgment([first, second], 'listing-1')
    expect(found?.judgment.complaintPattern.verdict).toBe('pattern_found')
    expect(found?.recordedAt).toBe('2026-08-09T12:00:00.000Z')
  })

  it('counts the revisions, so a changed mind is visible rather than silent', () => {
    expect(findRecordedJudgment([first, second], 'listing-1')?.revision).toBe(2)
  })

  it('does not depend on the order events arrive in', () => {
    // `listEvents` returns oldest-first, but the projection enforces ordering
    // rather than assuming it.
    const forwards = findRecordedJudgment([first, second], 'listing-1')
    const backwards = findRecordedJudgment([second, first], 'listing-1')
    expect(backwards?.judgment.complaintPattern.verdict).toBe('pattern_found')
    expect(backwards?.recordedAt).toBe(forwards?.recordedAt)
    expect(backwards?.revision).toBe(2)
  })
})

describe('DEC-094 — a malformed record never becomes a verdict', () => {
  it.each([
    ['wrong aggregate type', event({ aggregateType: 'demonstration' })],
    ['wrong event type', event({ eventType: 'demonstration.published' })],
    ['payload is null', event({ payload: null })],
    ['payload is a string', event({ payload: 'none_found' })],
    ['payload missing a gate', event({ payload: { complaintPattern: { verdict: 'none_found', rationale: 'x' } } })],
    ['gate missing its rationale', event({ payload: { ...judgment(), listingIdentity: { verdict: 'confirmed' } } })],
  ])('skips %s rather than guessing at it', (_label, malformed) => {
    expect(findRecordedJudgment([malformed], 'listing-1')).toBeNull()
  })

  it('ignores a malformed later event rather than letting it clear a good one', () => {
    const good = event({ occurredAt: '2026-08-09T10:00:00.000Z' })
    const bad = event({ occurredAt: '2026-08-09T12:00:00.000Z', payload: null })
    const found = findRecordedJudgment([good, bad], 'listing-1')
    expect(found?.judgment.complaintPattern.rationale).toBe('Read the 20 most recent reviews.')
  })
})

describe('DEC-094 — an unanswered judgment round-trips as unanswered', () => {
  it('does not turn an empty draft into a passing one', () => {
    // The default-is-never-a-pass rule from DEC-091 has to survive storage.
    const found = findRecordedJudgment([event({ payload: emptyJudgment() })], 'listing-1')
    expect(found?.judgment.complaintPattern.verdict).toBe('insufficient_data')
    expect(found?.judgment.operationalStatus.verdict).toBe('insufficient_data')
    expect(found?.judgment.listingIdentity.verdict).toBe('insufficient_data')
  })
})
