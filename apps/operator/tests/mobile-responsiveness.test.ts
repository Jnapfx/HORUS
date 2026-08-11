import { describe, expect, it } from 'vitest'
import { assessMobileResponsiveness, MOBILE_AUDIT_IDS } from '../src/domain/mobile-responsiveness'
import { MOBILE_AUDIT_IDS as IPC_MOBILE_AUDIT_IDS } from '../electron/web-opportunity-ipc'
import { buildWebOpportunityAudit } from '../src/domain/web-opportunity-audit'

/**
 * DEC-097. `web-opportunity-v2`'s largest factor — 30 of 100 points — read
 * from the Lighthouse audits that were already in every PageSpeed response
 * HORUS retrieves, and which DEC-072 left unread.
 */

const audit = (score: number | null, extra: Record<string, unknown> = {}) => ({ score, title: 'Audit title', ...extra })

const payload = (audits: Record<string, unknown>) => ({ lighthouseResult: { audits } })

const allPassing = payload({
  viewport: audit(1),
  'content-width': audit(1),
  'tap-targets': audit(1),
})

describe('DEC-097 — the three outcomes', () => {
  it('reads a missing viewport as not-responsive, the full 30 points', () => {
    const result = assessMobileResponsiveness(payload({
      viewport: audit(0), 'content-width': audit(1), 'tap-targets': audit(1),
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'not-responsive' })
    // Not a defect in a responsive layout — the absence of one.
    expect(result.status === 'measured' && result.evidence[0]).toContain('no usable mobile viewport')
  })

  it.each(['content-width', 'tap-targets'])('reads a failing %s with a viewport as responsive-defective', (failing) => {
    const result = assessMobileResponsiveness(payload({
      viewport: audit(1), 'content-width': audit(failing === 'content-width' ? 0 : 1), 'tap-targets': audit(failing === 'tap-targets' ? 0 : 1),
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'responsive-defective' })
  })

  it('reads everything passing as fully-responsive', () => {
    expect(assessMobileResponsiveness(allPassing)).toMatchObject({ status: 'measured', value: 'fully-responsive' })
  })

  it('feeds the model the value it already accepts, scoring 30 / 13 / 0', () => {
    const score = (value: 'not-responsive' | 'responsive-defective' | 'fully-responsive') =>
      buildWebOpportunityAudit({
        url: 'https://example.com',
        retrievedAt: '2026-08-09T00:00:00.000Z',
        site: { availability: 'reachable' },
        mobile: { status: 'measured', value },
        obsoleteAppearance: { status: 'unmeasured', reason: 'not wired' },
        brokenElements: { status: 'unmeasured', reason: 'not wired' },
        performance: { status: 'unmeasured', reason: 'not wired' },
        commercialIneffectiveness: { status: 'unmeasured', reason: 'not wired' },
      }).factors.find((factor) => factor.id === 'mobile_responsiveness')!.score

    expect(score('not-responsive')).toBe(30)
    expect(score('responsive-defective')).toBe(13)
    expect(score('fully-responsive')).toBe(0)
  })
})

describe('DEC-097 — charter 10.4: an absent audit is never a failure', () => {
  // This is the whole risk of reading someone else's audit set. Lighthouse
  // renames and drops audits between versions, and a missing one read as a
  // failure would be worth 30 points in the direction that makes a business
  // look like a better prospect than it is.
  it('refuses to assess when the viewport audit is absent', () => {
    const result = assessMobileResponsiveness(payload({ 'content-width': audit(1), 'tap-targets': audit(1) }))
    expect(result.status).toBe('unmeasured')
    expect(result.status === 'unmeasured' && result.reason).toContain('viewport audit')
  })

  it('refuses to claim fully-responsive when neither supporting audit ran', () => {
    // A viewport alone does not prove a working mobile layout, and
    // fully-responsive is the most favourable reading available.
    const result = assessMobileResponsiveness(payload({ viewport: audit(1) }))
    expect(result.status).toBe('unmeasured')
    expect(result.status === 'unmeasured' && result.reason).toContain('cannot be distinguished')
  })

  it('still reports fully-responsive when one supporting audit ran and passed, naming the gap', () => {
    const result = assessMobileResponsiveness(payload({ viewport: audit(1), 'tap-targets': audit(1) }))
    expect(result).toMatchObject({ status: 'measured', value: 'fully-responsive' })
    expect(result.status === 'measured' && result.evidence.join(' ')).toContain('not present in this run')
  })

  it.each([
    ['notApplicable', 'notApplicable'],
    ['informative', 'informative'],
    ['manual', 'manual'],
  ])('treats a %s audit as not a failure', (_label, mode) => {
    const result = assessMobileResponsiveness(payload({
      viewport: audit(1), 'content-width': audit(null, { scoreDisplayMode: mode }), 'tap-targets': audit(1),
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'fully-responsive' })
  })

  it('refuses to assess when the viewport audit errored rather than ran', () => {
    // Lighthouse emits an audit object with a null score and no display mode
    // when the audit itself failed to execute. That is not a site that failed
    // the check — it is a check that did not happen. Found by a mutation that
    // this suite did not catch on its first pass.
    const result = assessMobileResponsiveness(payload({
      viewport: audit(null), 'content-width': audit(1), 'tap-targets': audit(1),
    }))
    expect(result.status).toBe('unmeasured')
  })

  it('does not let an errored supporting audit manufacture a defect', () => {
    const result = assessMobileResponsiveness(payload({
      viewport: audit(1), 'content-width': audit(null), 'tap-targets': audit(1),
    }))
    // Viewport declared, one audit passed, one never ran: responsive as far as
    // anything could tell, and the evidence has to say the gap out loud.
    expect(result).toMatchObject({ status: 'measured', value: 'fully-responsive' })
    expect(result.status === 'measured' && result.evidence.join(' ')).toContain('not present in this run')
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['no lighthouseResult', { other: 1 }],
    ['no audits', { lighthouseResult: {} }],
  ])('refuses to assess a payload that is %s', (_label, broken) => {
    expect(assessMobileResponsiveness(broken).status).toBe('unmeasured')
  })
})

describe('DEC-097 — the pass threshold', () => {
  it('treats a borderline score below 0.9 as a failure, not a pass', () => {
    const result = assessMobileResponsiveness(payload({
      viewport: audit(1), 'content-width': audit(0.5), 'tap-targets': audit(1),
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'responsive-defective' })
  })

  it('accepts Lighthouse\'s own pass boundary at 0.9', () => {
    const result = assessMobileResponsiveness(payload({
      viewport: audit(0.9), 'content-width': audit(0.9), 'tap-targets': audit(0.9),
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'fully-responsive' })
  })
})

/**
 * DEC-109. The three audits DEC-097 named were renamed or removed in
 * Lighthouse 13, which the PageSpeed API now serves, so the factor read
 * `unmeasured` on every real site. These cover the successors and the
 * cross-version fallback.
 */
describe('reads the audits Lighthouse actually serves (DEC-109)', () => {
  const lighthouse13 = (audits: Record<string, unknown>) => ({ lighthouseResult: { audits } })
  const pass = { score: 1, scoreDisplayMode: 'binary', title: 'ok' }
  const fail = { score: 0, scoreDisplayMode: 'binary', title: 'not ok' }

  it('measures a Lighthouse 13 response, where viewport/content-width/tap-targets no longer exist', () => {
    const result = assessMobileResponsiveness(lighthouse13({
      'viewport-insight': { score: 1, scoreDisplayMode: 'numeric', title: 'Optimize viewport for mobile' },
      'target-size': pass,
      'meta-viewport': pass,
    }))
    expect(result.status).toBe('measured')
    if (result.status !== 'measured') throw new Error('unreachable')
    expect(result.value).toBe('fully-responsive')
  })

  it('reads a failing successor audit as the defect it is, not as an absent audit', () => {
    const result = assessMobileResponsiveness(lighthouse13({
      'viewport-insight': { score: 1, scoreDisplayMode: 'numeric', title: 'Optimize viewport for mobile' },
      'target-size': fail,
      'meta-viewport': pass,
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'responsive-defective' })
  })

  it('treats a failing viewport-insight as not-responsive, the same as the old viewport audit', () => {
    expect(assessMobileResponsiveness(lighthouse13({
      'viewport-insight': { score: 0, scoreDisplayMode: 'numeric', title: 'Optimize viewport for mobile' },
    }))).toMatchObject({ status: 'measured', value: 'not-responsive' })
  })

  it('still reads a pre-13 response, so retained calibration evidence keeps working', () => {
    expect(assessMobileResponsiveness(lighthouse13({
      viewport: pass, 'content-width': pass, 'tap-targets': fail,
    }))).toMatchObject({ status: 'measured', value: 'responsive-defective' })
  })

  it('prefers the newest name when a response somehow carries both', () => {
    const result = assessMobileResponsiveness(lighthouse13({
      'viewport-insight': { score: 0, scoreDisplayMode: 'numeric', title: 'new' },
      viewport: pass,
    }))
    expect(result).toMatchObject({ status: 'measured', value: 'not-responsive' })
  })

  it('stays unmeasured when no viewport audit under any name is present', () => {
    expect(assessMobileResponsiveness(lighthouse13({ 'target-size': pass })).status).toBe('unmeasured')
  })

  /**
   * The main process trims the Lighthouse response to a slice before it
   * crosses IPC. If that slice and the slots disagree, the factor goes
   * `unmeasured` for a reason no one would find by reading either file.
   */
  it('the IPC slice carries every audit id the slots may read', () => {
    expect([...IPC_MOBILE_AUDIT_IDS].sort()).toEqual([...MOBILE_AUDIT_IDS].sort())
  })
})
