/**
 * DEC-081. The first real outreach-draft content generator — charter §17 and
 * `electron/compose-handoff.ts`'s `buildGmailComposeHandoff` (tested since
 * before this session, but never wired to anything real) both assumed a
 * subject and body would exist; nothing produced one until now.
 *
 * DEC-005 governs this exactly as it governs `demonstration.ts` (DEC-079):
 * only fields already verified elsewhere in the app may appear as fact. The
 * message references the business's own name, category, and its real
 * published demonstration URL — nothing about the business's reviews,
 * quality, or shortcomings is asserted, since a cold outreach message
 * asserting a stranger's business has a weak web presence is not something
 * HORUS has standing to claim uninvited, and it isn't necessary to make the
 * pitch (the demonstration itself is the pitch).
 *
 * DEC-027's language rule (English by default; Spanish only on positive
 * evidence, ranked owner-review-replies > listing/site language > majority-
 * Spanish reviews) cannot be applied for real yet: `review-history.ts` only
 * ever retrieves `{isoDate, rating}` pairs (DEC-071) — review text and owner
 * replies are never fetched, so none of DEC-027's three evidence tiers exist
 * anywhere in this codebase today. `buildOutreachDraft` is honest about that
 * rather than silently defaulting: it always returns `language: 'en'` and a
 * `languageEvidence` string that says plainly why, so the operator sees the
 * limitation instead of a confident-looking but unfounded decision.
 */

export type OutreachBusinessInput = {
  name: string | null
  category: string | null
  /** The real, live URL from a successful DEC-080 publish. Required for the draft to make sense — the demonstration is the entire reason for the message. */
  demoUrl: string | null
}

export type OutreachDraft = {
  subject: string
  body: string
  language: 'en'
  languageEvidence: string
}

export function buildOutreachDraft(input: OutreachBusinessInput): OutreachDraft {
  const name = input.name?.trim() || 'there'
  const categoryLine = input.category?.trim() ? ` I work with local ${input.category.trim().toLowerCase()} businesses in the area` : ''

  const subject = input.name?.trim() ? `A quick website concept for ${input.name.trim()}` : 'A quick website concept'

  const body = [
    `Hi${input.name?.trim() ? ` ${input.name.trim()} team` : ''},`,
    '',
    `My name is [Your name].${categoryLine}, and I put together a quick website concept for ${name} to show what's possible — no obligation, just wanted to share it.`,
    '',
    input.demoUrl ? `You can view it here: ${input.demoUrl}` : '[Demonstration link not available — do not send until a demonstration is published.]',
    '',
    "It's just a concept built from publicly available information — happy to talk through it if it's useful, and no worries at all if it's not the right time.",
    '',
    'Best,',
    '[Your name]',
  ].join('\n')

  return {
    subject,
    body,
    language: 'en',
    languageEvidence:
      'Defaulting to English (DEC-027). No language evidence is currently retrieved anywhere in the app — review text and owner replies are not part of the review-history retrieval (DEC-071 only fetches rating and date), so none of DEC-027\'s three evidence tiers (owner review replies, listing/site language, majority-Spanish reviews) can be checked yet. A Spanish-language business name alone is never sufficient evidence per DEC-027.',
  }
}
