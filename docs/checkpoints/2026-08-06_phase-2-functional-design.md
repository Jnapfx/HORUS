# Checkpoint: Phase 2 — Functional Design

- Date: 2026-08-06
- Phase: 2 — Functional Design
- Owner: Javier Napoles, founder and sole operator of HORUS
- Commit or version: documentation only; no application code or implementation architecture

## Outcome achieved

The approved HORUS workflow is now specified as a reviewable functional design. An implementer can determine what each of the ten workflow steps accepts, produces, blocks, preserves, and requires for acceptance before selecting technical architecture.

The design covers the six required application views, evidence depth, uncertainty presentation, blocking approval gates, freshness checks, the prospect tracker, and an approved V1 demonstration-template baseline.

## Included scope

- State model for search runs, candidates, prospects, demonstrations, and outreach.
- Inputs, transformations, outputs, uncertainty handling, and acceptance conditions for the ten charter workflow steps.
- Search, Shortlist, Prospect detail, Demonstration review, Outreach review, and Tracker views.
- Evidence presentation from glanceable status through auditable source snapshots.
- Demonstration template, visual baseline, responsive-review requirement, and practical accessibility baseline.
- Structured demonstration editing, city-boundary default, and required operator decisions.

## Out of scope

- Application code, architecture, framework, data-store, API client, deployment automation, and OAuth implementation.
- Publishing any demonstration, creating any outreach draft, sending email, or contacting a business.
- Altering `reputation-scoring-v1`, `web-opportunity-v2`, or calibration conclusions.

## Validation performed

| Check | Result | Evidence |
| --- | --- | --- |
| Ten workflow steps specified | Passed | `FUNCTIONAL_DESIGN.md` section 4 |
| Six required views designed | Passed | `FUNCTIONAL_DESIGN.md` section 6 |
| Approval gates block downstream actions | Passed | `FUNCTIONAL_DESIGN.md` sections 3–6; DEC-004 |
| Evidence and uncertainty remain distinct | Passed | `FUNCTIONAL_DESIGN.md` sections 5 and 7 |
| Demonstration visual/template direction approved | Passed | `FUNCTIONAL_DESIGN.md` sections 8 and 10; DEC-036, DEC-037 |
| Accessibility baseline approved | Passed | `FUNCTIONAL_DESIGN.md` sections 8 and 10; DEC-038 |
| Market-boundary and editing defaults approved | Passed | `FUNCTIONAL_DESIGN.md` section 10; DEC-039, DEC-040 |
| Phase 2 exit criterion | Met | `ROADMAP.md` Phase 2 |

## Known limitations

- The approved visual baseline is intentionally not a complete HORUS public brand identity.
- The practical WCAG AA-equivalent baseline requires a technical test strategy in Phase 3.
- The functional design does not choose a routing capability, architecture, storage technology, or exact method for executing site checks.
- The unresolved real-world calibration limitations from Phase 1 remain unchanged.

## Related decisions

- DEC-003 through DEC-005 — single operator, approval gates, and traceable content
- DEC-014, DEC-015, DEC-017, DEC-020, DEC-021 — bounded/reproducible evidence workflow
- DEC-023 through DEC-025, DEC-027 through DEC-031 — demonstration, outreach, and tracker constraints
- DEC-036 through DEC-040 — approved Phase 2 design defaults

## Next authorized step

No next phase is authorized by this checkpoint. The recommended next step is Phase 3 — Technical Foundation, subject to separate operator authorization. It may establish the technical foundation but does not authorize publication or outreach.
