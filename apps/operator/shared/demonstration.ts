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
 * guessed, invented, or left to look like a real value. There is no
 * "testimonials" or pricing section — HORUS has no verified source for
 * either, and DEC-005 forbids inventing one. Internal analysis (reputation
 * score, web-opportunity score, proximity) is never shown here; it is
 * HORUS's own assessment of the business, not something to display back to
 * the business itself.
 *
 * DEC-024's mandatory notice and `noindex` are both always present and
 * cannot be omitted by the caller — they are not configuration, they are
 * conditions of what this function is allowed to produce.
 *
 * DEC-129 added the optional `composition` input: an "about" paragraph and a
 * small set of verbatim review quotes, plus which of the four optional
 * sections (about/reviews/services/hours) to show and in what order, and a
 * tone preset. That content is decided by the `concept_composer` agent
 * (`electron/agent/concept-composer-task.ts`) — a bounded, schema-validated,
 * evidence-cited task, never free text this function trusts blindly — but
 * this function remains the only thing that ever emits HTML or CSS. Omit
 * `composition` (or pass `null`) and every line below behaves exactly as it
 * did before DEC-129: services/hours only, in the DEC-123 archetype order,
 * no about or reviews section. A section named in `composition.sectionOrder`
 * still only renders if its own underlying data exists — an agent asking for
 * "hours" cannot make an hours table appear where there is no retained hours
 * data, the same omit-when-absent rule every other section already follows.
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

/**
 * DEC-129. The `concept_composer` agent's content decisions, already
 * validated by `parseComposerOutput` before this ever reaches here — this
 * function does no further trust decision on the agent's behalf, only
 * rendering. `reviewHighlights` quotes were already checked, at parse time,
 * against evidence the composer task actually received; this function does
 * not re-verify them against a source it has no access to, which is why the
 * composer's own output validation is where DEC-005 is actually enforced for
 * this content, not here.
 */
export type DemonstrationComposition = {
  sectionOrder: readonly ('about' | 'reviews' | 'services' | 'hours')[]
  tone: 'warm' | 'minimal' | 'bold'
  tagline: string | null
  aboutParagraph: string | null
  reviewHighlights: readonly { quote: string; evidenceSnapshotId: string }[]
  /**
   * DEC-140. The agent's design authority, and the exact limit of it: it picks
   * from these closed sets, it does not author CSS. Every member of both sets
   * is verified against impeccable's detector by the test suite, so the worst
   * an agent can do here is choose a different verified-good look — it cannot
   * introduce a colour, a font, or a rule that has not been checked. Omit
   * either (or the whole `composition`) and the value is derived
   * deterministically from the business's own verified category instead.
   */
  palette?: DesignPaletteKey | null
  fontPairing?: DesignFontKey | null
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
 * Also folded in specific token-level rules from the two references the
 * operator named — github.com/pbakaus/impeccable and
 * github.com/Leonxlnx/taste-skill, both design-doctrine rulebooks for AI
 * agents rather than shippable code (recorded fully in
 * docs/DESIGN_REFERENCES.md): a single accent color kept to a small area of
 * the page, a warm cream rather than pure-white background, no drop shadow at
 * rest (only on hover), body copy at 1.6 line-height, and off-black rather
 * than pure-black ink.
 *
 * DEC-122. DEC-114's accent still looked bad on a real sample: hashing a
 * category string directly onto a raw 0–359 hue at one fixed
 * saturation/lightness produces plenty of muddy, low-appeal colors (a
 * saturated yellow-green at 45%/36% reads as olive drab, for example) — there
 * was no curation, only arithmetic. `ACCENT_PALETTE` below replaces that with
 * a small, hand-picked set of hue/saturation/lightness triples, each chosen
 * to read cleanly against the cream background and off-black ink; the same
 * category still always produces the same entry (still a pure function,
 * still no per-business bespoke file, DEC-037), but every possible output is
 * now one someone actually looked at.
 */
/**
 * DEC-140. DEC-114 recorded "a warm cream rather than pure-white background"
 * as a rule *adopted from* `pbakaus/impeccable`. It is the opposite: cream is
 * `cream-palette` in impeccable's own anti-pattern registry — "the default
 * 'tasteful' AI surface, reached for by reflex" — and `Leonxlnx/taste-skill`
 * bans the same warm-paper family outright as its "second-most-recurring
 * AI-tell". Both repositories were named in DEC-114 and neither was ever
 * installed or run; the rules were transcribed from their READMEs by hand and
 * two of them came across inverted. Running the real detector against this
 * file's real output for the first time (2026-08-11) found `cream-palette`
 * firing on `#f6f1e6`, the value DEC-114 introduced. See
 * `electron/qa/impeccable-gate.ts`.
 *
 * These replace it. Each entry is one of taste-skill's own named "rotate, do
 * not reuse" alternatives to the banned warm-craft palette, resolved to
 * concrete values and then verified — not asserted — by running impeccable's
 * detector against a page built with it (`tests/demonstration-design.test.ts`
 * builds every palette and requires zero blocking findings from all of them,
 * so a palette that fails contrast or trips a slop rule cannot be added here
 * without the suite going red).
 *
 * A palette is a whole coordinated set, never mixed: taste-skill's colour
 * consistency lock ("pick one accent, lock it") is why the accent is not
 * selected independently of the surface it sits on.
 */
export const DESIGN_PALETTE_KEYS = ['forest', 'cobalt', 'black_tan', 'terracotta_slate', 'olive_brick', 'mono_pop'] as const
export type DesignPaletteKey = (typeof DESIGN_PALETTE_KEYS)[number]

type DesignPalette = { paper: string; ink: string; muted: string; line: string; accent: string; accentSoft: string }

const DESIGN_PALETTES: Readonly<Record<DesignPaletteKey, DesignPalette>> = {
  // "Forest: deep green + bone + amber accent"
  forest: { paper: '#fbfbf9', ink: '#14231c', muted: '#47574f', line: '#dee4e0', accent: '#1f5741', accentSoft: '#eaf2ee' },
  // "Cobalt + Cream: saturated blue against a single neutral" — the neutral
  // resolved to true paper rather than cream, per the ban above.
  cobalt: { paper: '#ffffff', ink: '#10172a', muted: '#4a546c', line: '#dfe3ec', accent: '#1d4ed8', accentSoft: '#e8eeff' },
  // "Black and Tan: true off-black + warm tan, sharp contrast, no beige"
  black_tan: { paper: '#fafaf8', ink: '#17150f', muted: '#544f43', line: '#e4e2dc', accent: '#8a5a2b', accentSoft: '#f3ece2' },
  // "Terracotta + Slate: warm rust against cool grey, no brass"
  terracotta_slate: { paper: '#f8f9fa', ink: '#1b2027', muted: '#4d5663', line: '#e0e4e9', accent: '#b4472e', accentSoft: '#fbeae5' },
  // "Olive + Brick + Paper: muted olive plus brick-red accent"
  olive_brick: { paper: '#fbfaf7', ink: '#1e2118', muted: '#4e5743', line: '#e3e5dd', accent: '#9c3320', accentSoft: '#f7e7e3' },
  // "Pure monochrome + single saturated pop"
  mono_pop: { paper: '#ffffff', ink: '#111111', muted: '#525252', line: '#e5e5e5', accent: '#047857', accentSoft: '#e6f4f0' },
}

/**
 * The no-composition default. Still a pure hash of the business's own verified
 * category — same category, same palette, every run — so omitting a
 * composition keeps `buildDemonstrationSite` the deterministic function its
 * "identical input produces byte-identical output" test requires.
 */
function paletteFromCategory(category: string | null): DesignPaletteKey {
  const source = (category ?? 'default').toLowerCase()
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  return DESIGN_PALETTE_KEYS[hash % DESIGN_PALETTE_KEYS.length]!
}

/**
 * DEC-140. The typographic half of the agent's design authority. Every stack
 * is checked against impeccable's `OVERUSED_FONTS` set (Inter, Roboto, Open
 * Sans, Lato, Montserrat, Arial, Helvetica, and the newer Geist/Fraunces/
 * Plus Jakarta/Space Grotesk wave) and against taste-skill's own ban on
 * `Fraunces` and `Instrument Serif` as display faces. Only faces that ship
 * with the OS are named: a demonstration is a single self-contained HTML
 * string with no build step and no external requests (DEC-024's `noindex`
 * page must not phone a font CDN), so a webfont is not available to it.
 */
export const DESIGN_FONT_KEYS = ['editorial', 'grotesque', 'humanist'] as const
export type DesignFontKey = (typeof DESIGN_FONT_KEYS)[number]

const DESIGN_FONTS: Readonly<Record<DesignFontKey, { display: string; body: string }>> = {
  editorial: { display: `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`, body: `'Iowan Old Style', Palatino, Georgia, serif` },
  grotesque: { display: `'Helvetica Neue', 'Segoe UI', system-ui, sans-serif`, body: `'Helvetica Neue', 'Segoe UI', system-ui, sans-serif` },
  humanist: { display: `Optima, Candara, 'Gill Sans', 'Trebuchet MS', sans-serif`, body: `Candara, 'Trebuchet MS', system-ui, sans-serif` },
}

function fontFromCategory(category: string | null): DesignFontKey {
  const source = (category ?? 'default').toLowerCase()
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = (hash * 17 + source.charCodeAt(i)) >>> 0
  return DESIGN_FONT_KEYS[hash % DESIGN_FONT_KEYS.length]!
}

/**
 * DEC-122. A long legal business name ("FAIRCONN Plumbing and Heating LLC")
 * wrapped to three lines at the old fixed `clamp(2.1rem, 5vw, 3.4rem)` and, on
 * some names, pushed past its column — the operator reported this directly
 * ("te parece que esa mierda esta bien?" flagged the three-line headline) and
 * it was still unfixed. Sized from the verified name's own length, not
 * guessed per business — a longer real name gets a smaller starting size, so
 * it still reads as a headline instead of overflowing one.
 */
function headlineSizeFor(rawName: string | null): string {
  const length = (rawName ?? '').trim().length
  if (length <= 20) return 'clamp(2.2rem, 5.2vw, 3.6rem)'
  if (length <= 35) return 'clamp(1.85rem, 4.6vw, 2.9rem)'
  return 'clamp(1.5rem, 3.8vw, 2.3rem)'
}

/**
 * DEC-122. When there is no published photo, the accent panel was plain
 * color plus small caution-orange italic text — the least distinctive part
 * of an already-generic page, and the most common case (most small-business
 * Google listings have no owner-published photo at all). A single large
 * initial, drawn from the business's own verified name (or its category if
 * the name is unavailable), gives every business a distinct mark without
 * inventing anything — it is one letter already present in a verified field,
 * not generated content.
 */
function monogramFrom(rawName: string | null, rawCategory: string | null): string {
  const source = (rawName && rawName.trim()) || (rawCategory && rawCategory.trim()) || ''
  const match = source.match(/[a-zA-Z0-9]/)
  return match ? escapeHtml(match[0].toUpperCase()) : ''
}

/**
 * DEC-123. The operator's next request after DEC-122's polish pass: "quiero
 * que cada sitio generado se adapte mas o menos a la empresa" — every
 * generated site still had the identical shape (same section order, same
 * eyebrow mark) regardless of what kind of business it was. This buckets the
 * business's own verified `category` string into one of six broad archetypes
 * by keyword match — never a guess at anything not already in that field —
 * and uses the match only for two purely presentational choices: a small
 * inline icon next to the category label, and whether Hours or Services
 * reads first (a cafe's visitor wants to know if it's open; a plumber's wants
 * to know what's offered). No new fact is introduced and no existing section
 * is added, removed, or its content changed — DEC-005 still governs every
 * word of copy. An unmatched or absent category falls through to a neutral
 * mark and the existing services-before-hours order, unchanged from DEC-122.
 */
const ARCHETYPES: ReadonlyArray<{ id: string; keywords: readonly string[]; hoursFirst: boolean; icon: string }> = [
  {
    id: 'food_drink',
    keywords: ['restaurant', 'cafe', 'café', 'coffee', 'bakery', 'bar', 'pizza', 'diner', 'grill', 'catering', 'brewery', 'deli', 'bistro', 'eatery', 'kitchen'],
    hoursFirst: true,
    icon: '<polygon points="5,3 19,3 16,15 8,15"/><rect x="10" y="15" width="4" height="4"/><rect x="7" y="19" width="10" height="2"/>',
  },
  {
    id: 'health_wellness',
    keywords: ['health', 'wellness', 'spa', 'salon', 'dental', 'dentist', 'clinic', 'doctor', 'therapy', 'gym', 'fitness', 'yoga', 'chiropractic', 'medical'],
    hoursFirst: true,
    icon: '<rect x="9" y="3" width="6" height="18"/><rect x="3" y="9" width="18" height="6"/>',
  },
  {
    id: 'home_trade',
    keywords: ['landscap', 'plumb', 'electrician', 'electrical', 'hvac', 'roofing', 'contractor', 'construction', 'handyman', 'lawn', 'pest control', 'remodel'],
    hoursFirst: false,
    icon: '<polygon points="12,3 21,10 21,21 3,21 3,10"/><rect x="10" y="14" width="4" height="7"/>',
  },
  {
    id: 'professional',
    keywords: ['law firm', 'attorney', 'legal', 'accounting', 'accountant', 'insurance', 'real estate', 'consulting', 'financial', 'tax'],
    hoursFirst: false,
    icon: '<rect x="3" y="8" width="18" height="12" rx="1"/><rect x="8" y="4" width="8" height="4" rx="1"/>',
  },
  {
    id: 'automotive',
    keywords: ['auto repair', 'mechanic', 'car wash', 'tire', 'auto body', 'automotive', 'dealership'],
    hoursFirst: false,
    icon: '<rect x="3" y="11" width="18" height="6" rx="1"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><rect x="6" y="7" width="12" height="5" rx="1"/>',
  },
  {
    id: 'retail',
    keywords: ['store', 'shop', 'boutique', 'market', 'retail'],
    hoursFirst: false,
    icon: '<path d="M8 8a4 4 0 0 1 8 0"/><polygon points="5,8 19,8 18,21 6,21"/>',
  },
]

const GENERAL_ARCHETYPE = {
  hoursFirst: false,
  icon: '<polygon points="12,2 14.9,8.6 22,9.3 16.5,14 18.2,21 12,17.3 5.8,21 7.5,14 2,9.3 9.1,8.6"/>',
}

function archetypeFromCategory(category: string | null): { hoursFirst: boolean; icon: string } {
  const source = (category ?? '').toLowerCase()
  if (!source) return GENERAL_ARCHETYPE
  const match = ARCHETYPES.find((archetype) => archetype.keywords.some((keyword) => source.includes(keyword)))
  return match ?? GENERAL_ARCHETYPE
}

/**
 * DEC-129. The composer's `tone` choice maps to a small, fixed set of
 * presentational presets — never a free-form style the agent writes — so
 * "the agent decides style" stays inside what this function already knows
 * how to render safely. `warm` reproduces the exact values this file used
 * before DEC-129 (DEC-114/116/122's own choices), so omitting `composition`
 * — the default, pre-DEC-129 call shape — renders byte-identical output.
 */
const TONE_PRESETS: Record<'warm' | 'minimal' | 'bold', {
  radius: string
  radiusLg: string
  sectionHover: boolean
  headlineWeight: number
  letterSpacing: string
  /**
   * DEC-140. Was `accentStripe`, which put `border-left: 4px solid <accent>`
   * on every rounded section in the `bold` preset. That is `side-tab`, the
   * rule impeccable calls "the most recognizable tell of AI-generated UIs",
   * and it fired 144 times across the generated matrix. `bold` now signals
   * itself typographically — an accent-coloured section heading — which no
   * border rule can catch because there is no border.
   */
  accentHeading: boolean
  decorativeCircles: boolean
}> = {
  warm: { radius: '12px', radiusLg: '20px', sectionHover: true, headlineWeight: 700, letterSpacing: '-0.02em', accentHeading: false, decorativeCircles: true },
  minimal: { radius: '8px', radiusLg: '14px', sectionHover: false, headlineWeight: 600, letterSpacing: '-0.01em', accentHeading: false, decorativeCircles: false },
  bold: { radius: '16px', radiusLg: '24px', sectionHover: true, headlineWeight: 800, letterSpacing: '-0.03em', accentHeading: true, decorativeCircles: true },
}

export function buildDemonstrationSite(input: {
  business: DemonstrationBusinessInput
  generatedAt: string
  /** DEC-129. Omit or pass null for the pre-DEC-129 deterministic default (services/hours only, DEC-123 archetype order). */
  composition?: DemonstrationComposition | null
}): DemonstrationSite {
  const { business, generatedAt, composition = null } = input
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

  // DEC-122. A real, verifiable action derived entirely from the address
  // already on file — a Google Maps search URL built from the business's own
  // verified address, never a guess at coordinates or a second address
  // source. Present only when a real address exists.
  const hasAddress = Boolean(business.address && business.address.trim())
  const directionsBlock = hasAddress
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address!.trim())}" rel="noopener noreferrer" target="_blank">Get directions</a>`
    : ''

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

  /**
   * DEC-129. Content the `concept_composer` agent proposed, already validated
   * (parseComposerOutput) before this function is ever called with it. Each
   * block still only renders if its own field is actually populated — an
   * agent naming "about" in `sectionOrder` with a `null` paragraph (which
   * `parseComposerOutput` should never allow through, but this function does
   * not re-trust that on faith) simply produces nothing, the same
   * omit-when-absent rule every other section here follows.
   */
  const aboutBlock = composition?.aboutParagraph
    ? `<section>
      <h2>About ${name}</h2>
      <p>${escapeHtml(composition.aboutParagraph)}</p>
      <p class="sourced">Summarized by HORUS's concept composer agent from this business's own verified public listing — reviewed before publishing.</p>
    </section>`
    : ''

  const reviewHighlights = composition?.reviewHighlights ?? []
  const reviewsBlock = reviewHighlights.length > 0
    ? `<section>
      <h2>What people are saying</h2>
      <div class="review-quotes">${reviewHighlights.map((highlight) => `<blockquote>&ldquo;${escapeHtml(highlight.quote)}&rdquo;</blockquote>`).join('')}</div>
      <p class="sourced">Quoted verbatim from this business's own public Google reviews.</p>
    </section>`
    : ''

  const taglineBlock = composition?.tagline
    ? `<p class="tagline">${escapeHtml(composition.tagline)}</p>`
    : ''

  // DEC-025. The listing's own photo, labelled as what it is. Never a stock
  // image, and never presented as the business's own work without saying where
  // it came from. DEC-122: when there is none, a monogram drawn from the
  // business's own verified name fills the panel instead of empty space.
  const monogram = monogramFrom(business.name, business.category)
  const photoBlock = business.photoUrl && business.photoUrl.trim()
    ? `<figure class="photo">
      <img src="${escapeHtml(business.photoUrl.trim())}" alt="Photo published on ${name}'s Google listing" loading="lazy">
      <figcaption>Photo from ${name}'s own public Google listing.</figcaption>
    </figure>`
    : `<div class="placeholder-area">${monogram ? `<span class="monogram" aria-hidden="true">${monogram}</span>` : ''}<span class="placeholder-text">[Business photography would appear here — none is published on the current listing]</span></div>`
  if (!business.photoUrl) missing.push('photo')

  const priceBlock = business.priceRange && business.priceRange.trim()
    ? `<p class="price">Typical spend: ${escapeHtml(business.priceRange.trim())} <span class="sourced">(published range)</span></p>`
    : ''

  const hasReputation = business.rating !== null && business.reviewCount !== null
  const reputationBlock = hasReputation
    ? `<p class="reputation">${business.rating!.toFixed(1)}&#9733; from ${business.reviewCount} Google reviews</p>`
    : ''
  if (!hasReputation) missing.push('reputation')

  // DEC-114, corrected by DEC-116, re-curated by DEC-122. DEC-083 rule 6
  // keeps this generator's output sharing no CSS custom properties with the
  // operator interface (so a demonstration page's styling can never be
  // affected by, or leak into, the app's own dark theme) — these are plain
  // literals, computed once here in JS and interpolated directly — no CSS
  // custom-property syntax at all.
  const paletteKey = composition?.palette ?? paletteFromCategory(business.category)
  const { paper, ink, muted, line, accent, accentSoft } = DESIGN_PALETTES[paletteKey]
  const fontKey = composition?.fontPairing ?? fontFromCategory(business.category)
  const fonts = DESIGN_FONTS[fontKey]
  const headlineSize = headlineSizeFor(business.name)
  const archetype = archetypeFromCategory(business.category)
  // DEC-140. DEC-123's archetype mark survives the eyebrow's removal by moving
  // into the top navigation — which is impeccable's own prescribed remedy for
  // `hero-eyebrow-chip` ("run it as a navigation breadcrumb instead"), not a
  // workaround for it. The category label itself was already duplicated there
  // before this change, so nothing verified is lost by deleting the eyebrow.
  const navIcon = `<svg class="nav-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${archetype.icon}</svg>`

  // DEC-129. With no composition, this is exactly DEC-123's own logic,
  // unchanged: services/hours only, ordered by the category archetype. With
  // one, the composer's own `sectionOrder` decides which of the four optional
  // sections appear and in what order — filtered to blocks that actually have
  // content, so an agent naming a section with nothing behind it still omits
  // it rather than rendering an empty box (DEC-005, same as every other gap
  // in this file).
  const sectionBlocks: Record<'about' | 'reviews' | 'services' | 'hours', string> = {
    about: aboutBlock,
    reviews: reviewsBlock,
    services: servicesBlock,
    hours: hoursBlock,
  }
  const orderedSections = composition
    ? composition.sectionOrder.map((key) => sectionBlocks[key]).filter(Boolean).join('\n    ')
    : (archetype.hoursFirst ? `${hoursBlock}\n    ${servicesBlock}` : `${servicesBlock}\n    ${hoursBlock}`)

  const tone = TONE_PRESETS[composition?.tone ?? 'warm']

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
  body { font-family: ${fonts.body}; margin: 0; color: ${ink}; background: ${paper}; line-height: 1.6; }
  .notice { background: ${ink}; color: #fff; padding: 0.9rem 1.25rem; font: 600 0.875rem/1.5 ${fonts.body}; text-align: center; letter-spacing: 0.02em; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }
  nav.top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem 1rem; padding: 1.5rem 0 0.25rem; font: 600 0.875rem ${fonts.body}; letter-spacing: 0.06em; text-transform: uppercase; color: ${muted}; }
  nav.top .nav-label { display: inline-flex; align-items: center; gap: 0.45rem; }
  .nav-icon { flex: 0 0 auto; width: 15px; height: 15px; color: ${accent}; }
  nav.top span:last-child { text-align: right; max-width: 65%; overflow-wrap: anywhere; }
  .hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 1.75rem; align-items: center; padding: 1.5rem 1.5rem 3rem; }
  .hero-copy { min-width: 0; }
  h1 { margin: 0 0 0.75rem; font-family: ${fonts.display}; font-size: ${headlineSize}; line-height: 1.08; letter-spacing: ${tone.letterSpacing}; font-weight: ${tone.headlineWeight}; overflow-wrap: break-word; hyphens: auto; }
  .tagline { margin: 0 0 1rem; color: ${muted}; font-size: 1.125rem; }
  .reputation { display: block; margin: 0 0 1rem; color: ${ink}; font-weight: 600; }
  .price { color: ${muted}; margin: 0 0 1.25rem; }
  .cta { display: inline-block; background: ${ink}; color: #fff; text-decoration: none; padding: 0.8rem 1.5rem; border-radius: 999px; font: 700 1rem ${fonts.body}; }
  .placeholder { display: inline-block; color: ${muted}; font-style: italic; }
  .art { position: relative; overflow: hidden; min-height: 260px; height: 100%; padding: 0.9rem; border-radius: ${tone.radiusLg}; background: ${accent}; }
  ${tone.decorativeCircles ? `.art::before, .art::after { position: absolute; content: ""; border: 2px solid rgba(255,255,255,0.32); border-radius: 50%; pointer-events: none; }
  .art::before { width: 220px; height: 220px; right: -90px; top: -70px; }
  .art::after { width: 160px; height: 160px; left: -80px; bottom: -70px; }` : ''}
  .photo { position: relative; margin: 0; height: 100%; min-height: 232px; }
  .photo img { width: 100%; height: 100%; min-height: 232px; object-fit: cover; display: block; border-radius: ${tone.radius}; }
  .photo figcaption { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 0.7rem 1.1rem; background: rgba(20,24,34,0.72); color: #fff; font: 500 0.875rem ${fonts.body}; border-radius: 0 0 ${tone.radius} ${tone.radius}; }
  .placeholder-area { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; height: 100%; min-height: 260px; padding: 1.5rem; text-align: center; }
  .monogram { position: absolute; inset: 0; z-index: 0; display: flex; align-items: center; justify-content: center; font-family: ${fonts.display}; font-size: 9rem; font-weight: 700; color: rgba(255,255,255,0.24); line-height: 1; pointer-events: none; }
  .placeholder-text { position: relative; z-index: 1; color: rgba(255,255,255,0.9); font: italic 1rem ${fonts.body}; }
  main.wrap { padding-bottom: 1rem; }
  section { background: #fff; border: 1px solid ${line}; border-radius: ${tone.radius}; padding: 1.75rem; margin-bottom: 1.5rem; transition: box-shadow 0.15s ease; }
  ${tone.sectionHover ? 'section:hover { box-shadow: 0 4px 24px -4px rgba(0,0,0,0.12); }' : ''}
  section h2 { margin: 0 0 1rem; font-family: ${fonts.display}; font-size: 1.9rem; line-height: 1.15; letter-spacing: -0.02em;${tone.accentHeading ? ` color: ${accent};` : ''} }
  .tags { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 0.9rem; }
  .tags li { background: ${accentSoft}; border: 1px solid ${line}; color: ${ink}; border-radius: 999px; padding: 0.45rem 0.9rem; font-size: 0.875rem; font-weight: 600; }
  .sourced { color: ${muted}; font-size: 0.875rem; margin: 0; }
  .review-quotes { display: grid; gap: 1rem; margin: 0 0 0.9rem; }
  blockquote { margin: 0; padding: 0.9rem 1.1rem; background: ${accentSoft}; border-radius: ${tone.radius}; font-style: italic; font-size: 1.125rem; line-height: 1.55; }
  .hours { border-collapse: collapse; width: 100%; max-width: 380px; margin-bottom: 0.9rem; }
  .hours th { text-align: left; font-weight: 700; padding: 0.4rem 1.2rem 0.4rem 0; white-space: nowrap; color: ${ink}; }
  .hours td { padding: 0.4rem 0; color: ${muted}; }
  .visit { background: ${ink}; color: #fff; border: none; }
  .visit h2 { color: #fff; }
  .visit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; background: rgba(255,255,255,0.14); border-radius: 10px; overflow: hidden; }
  .visit-grid div { background: rgba(255,255,255,0.06); padding: 1.2rem 1.3rem; min-width: 0; }
  .visit-grid strong { display: block; margin-bottom: 0.45rem; color: rgba(255,255,255,0.82); font-size: 0.875rem; letter-spacing: 0.06em; text-transform: uppercase; }
  .visit-grid p, .visit-grid a { margin: 0; color: #fff; font-size: 1rem; overflow-wrap: break-word; }
  footer { text-align: center; padding: 2rem 1.5rem; color: ${muted}; font-size: 0.875rem; }
  @media (max-width: 680px) {
    .hero { grid-template-columns: 1fr; padding-top: 0.5rem; }
    .art, .photo, .photo img { min-height: 200px; }
    .monogram { font-size: 6rem; }
    nav.top span:last-child { max-width: 100%; text-align: left; }
  }
</style>
</head>
<body>
  <p class="notice"><strong>This is a HORUS concept demonstration, not ${name}'s official website.</strong> It shows how a real website could look, built only from information already public about this business.</p>
  <nav class="top wrap"><span class="nav-label">${navIcon}${category}</span><span>HORUS concept</span></nav>
  <section class="hero wrap">
    <div class="hero-copy">
      <h1>${name}</h1>
      ${taglineBlock}
      ${reputationBlock}
      ${priceBlock}
      <p>${phoneBlock}</p>
    </div>
    <div class="art">${photoBlock}</div>
  </section>
  <main class="wrap">
    ${orderedSections}
    <section class="visit" id="visit">
      <h2>Visit ${name}</h2>
      <div class="visit-grid">
        <div><strong>Address</strong><p>${address}</p></div>
        ${hasAddress ? `<div><strong>Directions</strong><p>${directionsBlock}</p></div>` : ''}
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
