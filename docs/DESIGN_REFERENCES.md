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
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | A design-doctrine rulebook for AI coding agents (59 detector rules), not shippable code. Adopted into `buildDemonstrationSite` (DEC-114): one accent color capped to a small area of the page; a warm cream rather than pure-white background; fluid headline sizing via `clamp()`; no shadow at rest, a shadow only on hover; a written ban list (no colored side-borders on cards, no gradient text, no pure black/white) used as a review checklist. | Its actual deliverable — an `npx` CLI installer and an agent-skill runner. Nothing here is code to import; only the numeric/color rules are usable. | Adopted, DEC-114 |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | A collection of AI-agent "skill" prompts for different visual directions, not shippable code. Adopted into `buildDemonstrationSite` (DEC-114): off-black rather than pure-black ink; tight letter-spacing on serif headings; muted, low-saturation tag-chip colors. | Its GSAP-driven motion system and Tailwind-based examples — neither fits a plain HTML/CSS, server-templated generator. | Adopted, DEC-114 |

## Provisional principles

- Prioritize clarity over decoration.
- Show loading, error, empty, and success states.
- Avoid irreversible actions without confirmation.
- Keep the process status and next step visible.
- Validate accessibility and responsive behavior once an interface exists.

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
