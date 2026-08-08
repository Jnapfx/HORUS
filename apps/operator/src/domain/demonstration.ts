/**
 * DEC-079. `buildDemonstrationSite` is the first real implementation of
 * charter section 15 — until now nothing in the repository generated any
 * demonstration content; Phase 5's one real SEASONS EATS concept was
 * hand-built and published outside the app entirely (DEC-044).
 *
 * Scope, stated plainly, matching the pattern every other domain module in
 * this session has followed: this function only builds a static HTML string
 * from fields already retrieved and displayed elsewhere in the app (the
 * selected prospect's listing fields). It does not publish anything, does
 * not touch the network or the filesystem, and is not reachable from any
 * approval gate — DEC-004's publication gate applies to a later,
 * not-yet-built step that would actually deploy this output to Cloudflare
 * Pages. Calling this function has no consequence a business owner could
 * ever see.
 *
 * DEC-005 governs every line: only fields already verified elsewhere in the
 * app (SerpApi's own listing data) may appear as fact. Anything absent is
 * shown as a clearly labelled placeholder in `[bracketed text]`, never
 * guessed, invented, or left to look like a real value. There is
 * deliberately no "services," "about," "testimonials," or pricing section —
 * HORUS has no verified source for any of that content yet, and DEC-005
 * forbids inventing one. Internal analysis (reputation score, web-opportunity
 * score, proximity) is never shown here; it is HORUS's own assessment of the
 * business, not something to display back to the business itself.
 *
 * DEC-024's mandatory notice and `noindex` are both always present and
 * cannot be omitted by the caller — they are not configuration, they are
 * conditions of what this function is allowed to produce.
 */

export type DemonstrationBusinessInput = {
  name: string | null
  category: string | null
  address: string | null
  phone: string | null
  website: string | null
  /** Google's own aggregate rating, from the same verified listing data as everything else here. */
  rating: number | null
  reviewCount: number | null
}

export type DemonstrationSite = {
  html: string
  /** Which fields were unavailable and rendered as a labelled placeholder instead — for the operator's own review, never shown to a prospect as such. */
  missingFields: readonly string[]
  generatedAt: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function field(value: string | null, fieldName: string, placeholder: string, missing: string[]): string {
  if (value && value.trim()) return escapeHtml(value.trim())
  missing.push(fieldName)
  return `[${placeholder}]`
}

/** For a tel: link, strip everything but digits and a leading +; keeps the display text as the original verified string. */
function telHref(phone: string): string {
  const cleaned = phone.trim().replace(/[^\d+]/g, '')
  return `tel:${cleaned}`
}

export function buildDemonstrationSite(input: { business: DemonstrationBusinessInput; generatedAt: string }): DemonstrationSite {
  const { business, generatedAt } = input
  const missing: string[] = []

  const name = field(business.name, 'name', 'Business name not available', missing)
  const category = field(business.category, 'category', 'Category not available', missing)
  const address = field(business.address, 'address', 'Address not publicly listed', missing)

  const hasPhone = Boolean(business.phone && business.phone.trim())
  if (!hasPhone) missing.push('phone')
  const phoneDisplay = hasPhone ? escapeHtml(business.phone!.trim()) : '[Phone number not publicly listed]'
  const phoneBlock = hasPhone
    ? `<a class="cta" href="${telHref(business.phone!)}">Call ${phoneDisplay}</a>`
    : `<span class="placeholder">${phoneDisplay}</span>`

  const hasWebsite = Boolean(business.website && business.website.trim())
  const websiteBlock = hasWebsite
    ? `<a href="${escapeHtml(business.website!.trim())}" rel="noopener noreferrer" target="_blank">${escapeHtml(business.website!.trim())}</a>`
    : ''
  if (!hasWebsite) missing.push('website')

  const hasReputation = business.rating !== null && business.reviewCount !== null
  const reputationBlock = hasReputation
    ? `<p class="reputation">${business.rating!.toFixed(1)}&#9733; from ${business.reviewCount} Google reviews</p>`
    : ''
  if (!hasReputation) missing.push('reputation')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${name} — concept demonstration</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1c2230; background: #f7f8fb; }
  .notice { background: #fff4d6; border-bottom: 1px solid #e6c778; padding: 0.75rem 1rem; font-size: 0.9rem; text-align: center; }
  header { padding: 3rem 1.5rem 2rem; text-align: center; }
  h1 { margin: 0 0 0.25rem; font-size: 2rem; }
  .category { color: #5a6272; margin: 0 0 1rem; }
  .reputation { color: #5a6272; }
  main { max-width: 640px; margin: 0 auto; padding: 0 1.5rem 3rem; }
  section { background: #fff; border: 1px solid #e2e5ec; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .cta { display: inline-block; background: #1c2230; color: #fff; text-decoration: none; padding: 0.6rem 1.2rem; border-radius: 6px; }
  .placeholder { color: #9aa1af; font-style: italic; }
  footer { text-align: center; padding: 1.5rem; color: #9aa1af; font-size: 0.8rem; }
</style>
</head>
<body>
  <p class="notice"><strong>This is a HORUS concept demonstration, not ${name}'s official website.</strong> It shows how a real website could look, built only from information already public about this business.</p>
  <header>
    <h1>${name}</h1>
    <p class="category">${category}</p>
    ${reputationBlock}
  </header>
  <main>
    <section>
      <h2>Contact</h2>
      <p>${address}</p>
      <p>${phoneBlock}</p>
      ${hasWebsite ? `<p>Current website: ${websiteBlock}</p>` : ''}
    </section>
  </main>
  <footer>Generated by HORUS, ${escapeHtml(generatedAt)}. Not affiliated with or endorsed by ${name}.</footer>
</body>
</html>
`

  return { html, missingFields: missing, generatedAt }
}
