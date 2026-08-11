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
  /**
   * DEC-106. Published listing attributes, all optional. Every one is content
   * the business itself put on its own Google listing; nothing here is
   * inferred, and an absent field omits its section rather than inviting a
   * guess (DEC-005, FUNCTIONAL_DESIGN §8.1).
   */
  serviceOptions?: readonly string[]
  highlights?: readonly string[]
  operatingHours?: Readonly<Record<string, string>> | null
  priceRange?: string | null
  photoUrl?: string | null
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

/**
 * DEC-114. `apps/demo-template/` holds several hand-built concept sites
 * (SEASONS EATS, Finescape and Sons, Caribbean Bakery Mini Mart, Sunshine
 * Cuisine) from earlier in the project — real editorial layouts with a big
 * serif headline, a colored decorative panel, an eyebrow label system, and a
 * dark "visit" card, all built to charter section 15/DEC-025's real-data-only
 * rule. `buildDemonstrationSite` never adopted that visual language; it built
 * a plain generic template instead, which is what the operator saw as
 * "pauperrimo" once field-sparse listings left most sections empty.
 *
 * This derives one accent color deterministically from the business's own
 * category text — same category, same hue, every time (kept pure per the
 * "identical input produces byte-identical output" test) — so the common
 * template (DEC-037) gets a small bounded per-prospect accent without any
 * randomness or per-business bespoke file.
 *
 * Also folded in specific token-level rules from the two references the
 * operator named — github.com/pbakaus/impeccable and
 * github.com/Leonxlnx/taste-skill, both design-doctrine rulebooks for AI
 * agents rather than shippable code (recorded fully in
 * docs/DESIGN_REFERENCES.md): a single accent color kept to a small area of
 * the page, a warm cream rather than pure-white background, no drop shadow at
 * rest (only on hover), body copy at 1.6 line-height, and off-black rather
 * than pure-black ink.
 */
function hueFromCategory(category: string | null): number {
  const source = (category ?? 'default').toLowerCase()
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  return hash % 360
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

  /**
   * DEC-106. FUNCTIONAL_DESIGN §8.1's services, hours and imagery sections,
   * built from the listing's own published attributes. Every one of these was
   * already retrieved and thrown away, which is why a generated demonstration
   * used to be the business's contact card.
   *
   * Each block omits itself entirely when its evidence is absent — §8.1's own
   * rule ("omit the block when support is absent"), and DEC-005's: a gap stays
   * empty rather than being filled.
   */
  const services = business.serviceOptions ?? []
  const highlights = business.highlights ?? []
  const servicesBlock = services.length + highlights.length > 0
    ? `<section>
      <h2>What ${name} offers</h2>
      <ul class="tags">${[...services, ...highlights].map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <p class="sourced">Listed publicly by the business on its own Google listing.</p>
    </section>`
    : ''
  if (services.length + highlights.length === 0) missing.push('services')

  const hours = business.operatingHours ?? null
  const hoursBlock = hours
    ? `<section>
      <h2>Hours</h2>
      <table class="hours">${Object.entries(hours).map(([day, value]) =>
        `<tr><th>${escapeHtml(day.charAt(0).toUpperCase() + day.slice(1))}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
      <p class="sourced">Published hours from the business's own Google listing.</p>
    </section>`
    : ''
  if (!hours) missing.push('hours')

  // DEC-025. The listing's own photo, labelled as what it is. Never a stock
  // image, and never presented as the business's own work without saying where
  // it came from.
  const photoBlock = business.photoUrl && business.photoUrl.trim()
    ? `<figure class="photo">
      <img src="${escapeHtml(business.photoUrl.trim())}" alt="Photo published on ${name}'s Google listing" loading="lazy">
      <figcaption>Photo from ${name}'s own public Google listing.</figcaption>
    </figure>`
    : `<div class="placeholder-area">[Business photography would appear here — none is published on the current listing]</div>`
  if (!business.photoUrl) missing.push('photo')

  const priceBlock = business.priceRange && business.priceRange.trim()
    ? `<p class="price">Typical spend: ${escapeHtml(business.priceRange.trim())} <span class="sourced">(published range)</span></p>`
    : ''

  const hasReputation = business.rating !== null && business.reviewCount !== null
  const reputationBlock = hasReputation
    ? `<p class="reputation">${business.rating!.toFixed(1)}&#9733; from ${business.reviewCount} Google reviews</p>`
    : ''
  if (!hasReputation) missing.push('reputation')

  // DEC-114, corrected by DEC-116. Deterministic per-category accent — see
  // `hueFromCategory` above. DEC-083 rule 6 keeps this generator's output
  // sharing no CSS custom properties with the operator interface (so a
  // demonstration page's styling can never be affected by, or leak into,
  // the app's own dark theme) — these are plain literals, computed once
  // here in JS and interpolated directly — no CSS custom-property syntax at all.
  const hue = hueFromCategory(business.category)
  const accent = `hsl(${hue} 45% 36%)`
  const accentSoft = `hsl(${hue} 55% 94%)`
  const ink = '#1c2230'
  const muted = '#5a6272'
  const line = '#e2e5ec'
  const paper = '#f6f1e6'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${name} — concept demonstration</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; color: ${ink}; background: ${paper}; line-height: 1.6; }
  .notice { background: ${ink}; color: #fff; padding: 0.75rem 1rem; font: 600 0.74rem/1.4 system-ui, -apple-system, sans-serif; text-align: center; letter-spacing: 0.03em; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }
  nav.top { display: flex; justify-content: space-between; align-items: baseline; padding: 1.5rem 0 0.25rem; font: 700 0.72rem system-ui, -apple-system, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: ${muted}; }
  .hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 1.75rem; align-items: center; padding: 1.5rem 0 3rem; }
  .eyebrow { margin: 0 0 0.7rem; color: ${accent}; font: 700 0.72rem system-ui, -apple-system, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; }
  h1 { margin: 0 0 0.6rem; font-size: clamp(2.1rem, 5vw, 3.4rem); line-height: 1.02; letter-spacing: -0.02em; font-weight: 700; }
  .reputation { display: block; margin: 0 0 1rem; color: ${ink}; font-family: system-ui, -apple-system, sans-serif; font-weight: 600; }
  .price { color: ${muted}; font-family: system-ui, -apple-system, sans-serif; margin: 0 0 1.25rem; }
  .cta { display: inline-block; background: ${ink}; color: #fff; text-decoration: none; padding: 0.75rem 1.4rem; border-radius: 999px; font: 700 0.92rem system-ui, -apple-system, sans-serif; }
  .placeholder { display: inline-block; color: #9aa1af; font-style: italic; font-family: system-ui, -apple-system, sans-serif; }
  .art { position: relative; overflow: hidden; min-height: 260px; height: 100%; border-radius: 20px; background: ${accent}; }
  .art::before, .art::after { position: absolute; content: ""; border: 2px solid rgba(255,255,255,0.32); border-radius: 50%; pointer-events: none; }
  .art::before { width: 220px; height: 220px; right: -90px; top: -70px; }
  .art::after { width: 160px; height: 160px; left: -80px; bottom: -70px; }
  .photo { position: relative; margin: 0; height: 100%; min-height: 260px; }
  .photo img { width: 100%; height: 100%; min-height: 260px; object-fit: cover; display: block; border-radius: 20px; }
  .photo figcaption { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 0.6rem 1rem; background: rgba(20,24,34,0.6); color: #fff; font: 500 0.72rem system-ui, -apple-system, sans-serif; border-radius: 0 0 20px 20px; }
  .placeholder-area { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; height: 100%; min-height: 260px; padding: 1.5rem; text-align: center; color: rgba(255,255,255,0.9); font: italic 0.95rem system-ui, -apple-system, sans-serif; }
  main.wrap { padding-bottom: 1rem; }
  section { background: #fff; border: 1px solid ${line}; border-radius: 12px; padding: 1.75rem; margin-bottom: 1.5rem; transition: box-shadow 0.15s ease; }
  section:hover { box-shadow: 0 4px 24px -4px rgba(0,0,0,0.12); }
  section h2 { margin: 0 0 1rem; font-size: 1.5rem; line-height: 1.1; letter-spacing: -0.03em; }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 0.9rem; font-family: system-ui, -apple-system, sans-serif; }
  .tags li { background: ${accentSoft}; border: 1px solid ${line}; color: ${ink}; border-radius: 999px; padding: 0.4rem 0.85rem; font-size: 0.88rem; font-weight: 600; }
  .sourced { color: ${muted}; font-family: system-ui, -apple-system, sans-serif; font-size: 0.8rem; margin: 0; }
  .hours { border-collapse: collapse; width: 100%; max-width: 380px; margin-bottom: 0.9rem; font-family: system-ui, -apple-system, sans-serif; }
  .hours th { text-align: left; font-weight: 700; padding: 0.4rem 1.2rem 0.4rem 0; white-space: nowrap; color: ${ink}; }
  .hours td { padding: 0.4rem 0; color: ${muted}; }
  .visit { background: ${ink}; color: #fff; border: none; }
  .visit h2 { color: #fff; }
  .visit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; background: rgba(255,255,255,0.14); border-radius: 10px; overflow: hidden; }
  .visit-grid div { background: rgba(255,255,255,0.06); padding: 1.1rem 1.2rem; font-family: system-ui, -apple-system, sans-serif; }
  .visit-grid strong { display: block; margin-bottom: 0.4rem; color: rgba(255,255,255,0.6); font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .visit-grid p, .visit-grid a { margin: 0; color: #fff; font-size: 0.95rem; }
  footer { text-align: center; padding: 2rem 1.5rem; color: ${muted}; font-family: system-ui, -apple-system, sans-serif; font-size: 0.8rem; }
  @media (max-width: 680px) {
    .hero { grid-template-columns: 1fr; padding-top: 0.5rem; }
    .art, .photo, .photo img { min-height: 200px; }
  }
</style>
</head>
<body>
  <p class="notice"><strong>This is a HORUS concept demonstration, not ${name}'s official website.</strong> It shows how a real website could look, built only from information already public about this business.</p>
  <nav class="top wrap"><span>HORUS concept</span><span>${category}</span></nav>
  <section class="hero wrap">
    <div>
      <p class="eyebrow">${category}</p>
      <h1>${name}</h1>
      ${reputationBlock}
      ${priceBlock}
      <p>${phoneBlock}</p>
    </div>
    <div class="art">${photoBlock}</div>
  </section>
  <main class="wrap">
    ${servicesBlock}
    ${hoursBlock}
    <section class="visit" id="visit">
      <h2>Visit ${name}</h2>
      <div class="visit-grid">
        <div><strong>Address</strong><p>${address}</p></div>
        ${hasWebsite ? `<div><strong>Online</strong><p>Current website: ${websiteBlock}</p></div>` : ''}
      </div>
    </section>
  </main>
  <footer>Generated by HORUS, ${escapeHtml(generatedAt)}. Not affiliated with or endorsed by ${name}.</footer>
</body>
</html>
`

  return { html, missingFields: missing, generatedAt }
}
