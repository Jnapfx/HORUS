# Design References

## Status

The V1 visual baseline is approved in [`FUNCTIONAL_DESIGN.md`](FUNCTIONAL_DESIGN.md), sections 8 and 10. It is a deliberately focused operating and demonstration system, not a complete public brand identity for HORUS.

Two constraints are now fixed. HORUS V1 is an application with a visual interface and persistent state, not a command-line tool (DEC-029). It serves a single operator on a single machine, so there are no accounts, roles, or sharing to design for (DEC-003).

Note that HORUS produces two distinct kinds of interface, and they must not be confused:

- **The operator interface** — the six views listed in charter section 18. Seen only by the founder. Optimized for judgment and evidence, not for persuasion.
- **The demonstration websites** — seen by prospective clients, and the product HORUS is selling. Governed by charter section 15 and DEC-023 through DEC-025.

A reference useful for one is not automatically useful for the other.

## How to document references

Each reference must explain what should be learned or adopted from it. A reference must not be treated as an instruction to copy an entire product.

| Reference | Useful element | What to avoid | Status |
| --- | --- | --- | --- |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | **Installed and run, not transcribed (DEC-140).** `impeccable@3.5.0` is a real dependency; its static `detectHtml` engine runs over every generated demonstration as a blocking QA gate (`electron/qa/impeccable-gate.ts`), and its `craft-floor.md` doctrine is carried into the composer's instruction (`electron/agent/design-doctrine.ts`). Its 59-rule registry is the standard, read from the package rather than copied. | Its browser engine (`detectUrl`/`createBrowserDetector`), which launches Chromium through the optional `puppeteer` dependency — deliberately not declared in `impeccable.d.ts` and refused in `allowScripts`. Its `npx` CLI installer and hook system, which DEC-057's isolated agent working directory makes unreachable anyway. | **Enforced, DEC-140** (was "Adopted, DEC-114" while never installed) |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | **Doctrine adopted from the source, DEC-140.** Its §4.2 colour calibration supplies the six palettes `shared/demonstration.ts` now ships — each one of its own named "rotate, do not reuse" alternatives to the banned warm-craft family — and its §4.1 typography rules (no Fraunces, no Instrument Serif, serif only when justified) constrain the font pairings. Its ban list is in the composer's instruction. | Its GSAP motion system, Tailwind examples and webfont recommendations — none fit a self-contained HTML string with no build step and no external requests. | **Adopted from source, DEC-140** |

### A correction worth recording

DEC-114 listed both repositories as "Adopted" for a year-month while neither was installed and neither had ever run: about eight rules were transcribed from their READMEs by hand. **Two came across inverted** — a warm cream background and a hero eyebrow label, both of which these repositories classify as anti-patterns, were adopted as rules *from* them. Running impeccable's own detector against the generator's own output for the first time (2026-08-11) found six blocking failures in the shipped template. A transcribed rule is a claim; a detector that runs is a check. See DEC-140.

## Provisional principles

- Prioritize clarity over decoration.
- Show loading, error, empty, and success states.
- Avoid irreversible actions without confirmation.
- Keep the process status and next step visible.
- Validate accessibility and responsive behavior once an interface exists.

### A correction worth recording

DEC-114 listed both repositories as "Adopted" for a year-month while neither was installed and neither had ever run: about eight rules were transcribed from their READMEs by hand. **Two came across inverted** — a warm cream background and a hero eyebrow label, both of which these repositories classify as anti-patterns, were adopted as rules *from* them. Running impeccable's own detector against the generator's own output for the first time (2026-08-11) found six blocking failures in the shipped template. A transcribed rule is a claim; a detector that runs is a check. See DEC-140.

## Provisional principles specific to demonstrations

- Show only what the evidence supports. Empty is better than invented (DEC-005, DEC-025).
- The concept-demonstration notice must be visible without being the first thing that dominates the page.
- Mobile rendering is the priority, since the demonstration's argument is that the prospect's current site fails there.

## Pending decisions

- Interface type: **decided** — visual application with persistent state (DEC-029).
- Priority devices: operator interface targets the founder's laptop. Demonstrations are mobile-first; approval reviews desktop and 375px views.
- Visual identity: restrained evidence-workbench for the operator; bounded adaptation from verified business cues for demonstrations (DEC-036).
- Accessibility requirements: practical WCAG AA-equivalent baseline; technical verification method is a Phase 3 concern (DEC-038).
- Demonstration template: common mobile-first template with bounded per-prospect adaptation (DEC-037).
