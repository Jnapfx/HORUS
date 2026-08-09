/**
 * Charter section 15's other half.
 *
 * DEC-089 built the 30-day gate and stated plainly what it was leaving out:
 * it blocks, but offers no way to refresh, and the charter asks for both —
 *
 *   "If data has aged past 30 days when the operator selects a prospect,
 *    HORUS refreshes that business before proceeding and **shows what
 *    changed**. A rating that has dropped or a recent complaint that has
 *    appeared is exactly the information the operator needs *before* making
 *    contact, not after."
 *
 * The showing is the point. A refresh that silently replaced the old figures
 * would satisfy the letter of the freshness rule and defeat its purpose: the
 * operator would proceed on fresh data without ever learning that the rating
 * fell while they were deciding.
 *
 * So this module compares two retrievals of the same listing and reports the
 * differences, marking the ones that bear on whether to contact the business
 * at all. It decides nothing — `materialForContact` is a flag for the
 * operator's attention, never an auto-reject (DEC-008).
 */

export type ListingEvidence = {
  name: string | null
  rating: number | null
  reviewCount: number | null
  address: string | null
  phone: string | null
  website: string | null
}

export type EvidenceChange = {
  field: keyof ListingEvidence
  before: string | number | null
  after: string | number | null
  /**
   * True when this change is the kind charter 15 says the operator needs to
   * see before contact — a fall in standing, or a shift in who the listing
   * even refers to. A flag for attention, never a decision (DEC-008).
   */
  materialForContact: boolean
  note: string
}

export type EvidenceComparison = {
  changes: readonly EvidenceChange[]
  /** True when any change is material. Nothing is blocked on this. */
  hasMaterialChange: boolean
  unchanged: boolean
}

function describe(value: string | number | null): string {
  return value === null ? 'not present' : String(value)
}

/**
 * `before` is the evidence the operator has been looking at; `after` is what a
 * fresh retrieval returned. Fields absent from both are not reported.
 */
export function compareListingEvidence(before: ListingEvidence, after: ListingEvidence): EvidenceComparison {
  const changes: EvidenceChange[] = []

  const push = (field: keyof ListingEvidence, materialForContact: boolean, note: string) => {
    changes.push({ field, before: before[field], after: after[field], materialForContact, note })
  }

  // A rating that fell is charter 15's own example of what must be surfaced.
  // A rating that rose is still reported — the operator asked what changed,
  // not what got worse — but it is not material to the decision to contact.
  if (before.rating !== after.rating) {
    const fell = before.rating !== null && after.rating !== null && after.rating < before.rating
    push('rating', fell, fell
      ? `The published rating fell from ${describe(before.rating)} to ${describe(after.rating)}.`
      : `The published rating changed from ${describe(before.rating)} to ${describe(after.rating)}.`)
  }

  // A falling review count means reviews were removed or the listing was
  // altered — unusual enough that the operator should see it before contact.
  if (before.reviewCount !== after.reviewCount) {
    const fell = before.reviewCount !== null && after.reviewCount !== null && after.reviewCount < before.reviewCount
    push('reviewCount', fell, fell
      ? `The review count fell from ${describe(before.reviewCount)} to ${describe(after.reviewCount)} — reviews were removed, or the listing changed.`
      : `The review count rose from ${describe(before.reviewCount)} to ${describe(after.reviewCount)}.`)
  }

  // Identity fields. A changed name or address may mean the listing now refers
  // to a different business — charter 9.5's G6 question, arriving unbidden.
  if (before.name !== after.name) {
    push('name', true, `The business name changed from "${describe(before.name)}" to "${describe(after.name)}" — confirm this is still the same business (G6).`)
  }
  if (before.address !== after.address) {
    push('address', true, `The address changed from "${describe(before.address)}" to "${describe(after.address)}" — confirm this is still the same business at the same location (G6).`)
  }

  // Contact and web presence. A website appearing is not a reason to stop, but
  // it changes the premise of the demonstration entirely.
  if (before.phone !== after.phone) {
    push('phone', false, `The phone number changed from ${describe(before.phone)} to ${describe(after.phone)}.`)
  }
  if (before.website !== after.website) {
    const appeared = before.website === null && after.website !== null
    push('website', appeared, appeared
      ? `A website now appears on the listing (${describe(after.website)}) where there was none — the web-opportunity premise for this prospect has changed.`
      : `The listed website changed from ${describe(before.website)} to ${describe(after.website)}.`)
  }

  return {
    changes,
    hasMaterialChange: changes.some((change) => change.materialForContact),
    unchanged: changes.length === 0,
  }
}
