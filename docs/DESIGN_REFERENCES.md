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
| To be defined | — | — | Pending |

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
