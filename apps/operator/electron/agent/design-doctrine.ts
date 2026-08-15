/**
 * DEC-140. The design doctrine the `concept_composer` agent is held to,
 * distilled from the two repositories `docs/DESIGN_REFERENCES.md` has listed
 * as adopted since DEC-114:
 *
 *   - `pbakaus/impeccable` (Apache-2.0, © 2026 Paul Bakaus) — its
 *     `skill/reference/craft-floor.md` quality floor and ban list, and the
 *     rule ids from its anti-pattern registry.
 *   - `Leonxlnx/taste-skill` (MIT, © 2026 Leonxlnx) — its
 *     `skills/taste-skill/SKILL.md` §4.1 typography and §4.2 colour
 *     calibration directives.
 *
 * Why the doctrine is a string constant here rather than an installed skill.
 * DEC-057 gives every Claude Code invocation a fresh, empty working directory
 * and `working-directory.ts` throws if a `.claude/` directory is present;
 * `runtime.ts` additionally passes `--system-prompt`, which replaces the
 * default system prompt outright. Both are deliberate — this repository's own
 * `CLAUDE.md` must never be auto-discovered by a bounded agent. The
 * consequence is that a skill directory is structurally unreachable from a
 * HORUS agent run: installing one would change nothing. Carrying the doctrine
 * in the instruction is therefore the only way to enforce it without
 * weakening DEC-057, and it has the better property anyway — the text is
 * versioned in this repository and reviewable in a diff.
 *
 * This text is guidance the agent is asked to follow. It is not the
 * enforcement. Enforcement is `electron/qa/impeccable-gate.ts`, which runs
 * impeccable's real detector over the built page, and the closed token sets in
 * `shared/demonstration.ts`, which the agent selects from but cannot extend.
 * A model that ignores every line below still cannot ship a page that fails
 * the detector.
 */

export const DESIGN_DOCTRINE_VERSION = 'impeccable-craft-floor+taste-skill-v1'

export const DESIGN_DOCTRINE = [
  'Design doctrine (from pbakaus/impeccable and Leonxlnx/taste-skill, the two references this project has adopted):',
  '',
  'Bans — these are the AI tells that make a generated page recognisable as generated:',
  '- No kicker or eyebrow: a small tracked-uppercase label sitting above a heading is banned outright. The heading carries its own weight.',
  '- No cream, beige or warm-paper page background. It is the reflex "tasteful AI" surface and it makes every brand look the same.',
  '- No gradient text, no purple/violet gradient accents, no cyan-on-dark.',
  '- No coloured left or right border on cards, sections, callouts or alerts.',
  '- No identical icon-plus-heading-plus-text cards used as the page structure. No cards nested inside cards.',
  '- No numbered section labels (01 / 02 / 03) unless the sequence itself carries information.',
  '- No serif chosen merely because it feels "premium" or "editorial"; and never Fraunces or Instrument Serif.',
  '- No overused faces: Inter, Roboto, Open Sans, Lato, Montserrat, Geist, Plus Jakarta Sans, Space Grotesk.',
  '',
  'Floor — the quality bar for what does ship:',
  '- One accent colour, locked for the whole page. Never a second accent in a later section.',
  '- Body text at least 14px; body measure 65-75 characters.',
  '- A real type hierarchy: obvious size and weight steps, not six sizes one pixel apart.',
  '- Tight grouping within a block, generous separation between blocks. More space above a heading than below it.',
  '- Text contrast at least 4.5:1 against its own background.',
  '',
  'Choosing this business\'s look:',
  '- Pick the palette and font pairing that fit THIS business, from the fixed sets below. A landscaper and a law firm should not come out looking the same.',
  '- Say why in "rationale", referring to what the evidence actually shows about the business.',
  '- These sets are pre-verified against impeccable\'s detector. You choose among them; you never write colours, fonts, or CSS yourself.',
].join('\n')
