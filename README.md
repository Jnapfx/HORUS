# HORUS V1

A clean repository for designing and building HORUS V1 with traceability from day one.

> Status: **Phases 0–3 complete and approved** (Javier Napoles, 2026-08-05–06). The local Electron/React foundation is implemented and tested.

## What this is

HORUS is a company being founded. **HORUS V1 is the first internal operating tool built for it** — used by the founder to acquire HORUS's first client. It is not a product for sale (DEC-003).

One complete run does this: enter a business category and a city → HORUS finds local businesses with strong reputations but weak web presence, ranks them with evidence → the founder picks one → HORUS builds a customized demonstration website from verified public information → the founder approves it before publication → HORUS publishes it and prepares an outreach handoff → the founder approves, composes, and sends it in Gmail → HORUS records the prospect and the next follow-up.

**One search → one qualified prospect → one approved live demonstration → one approved outreach → one trackable sales opportunity.**

Two rules are structural, not preferences: nothing reaches a business owner without explicit approval (DEC-004), and nothing in a demonstration may be invented (DEC-005).

The full specification is in [`docs/PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md), across eighteen sections.

## Objective

Build HORUS V1 incrementally, with explicit requirements, documented decisions, and verifiable checkpoints.

## Working principles

1. Document before implementing.
2. Work on one small, verifiable phase at a time.
3. Do not incorporate legacy code without justification and review.
4. Record decisions that affect architecture, scope, or user experience.
5. Keep the distinction between planned, implemented, and validated work visible.

## Documentation

| Document | Purpose | When to update it |
| --- | --- | --- |
| [`PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md) | Defines the problem, users, scope, and success criteria | When the purpose or scope changes |
| [`CURRENT_STATE.md`](docs/CURRENT_STATE.md) | Provides a reliable snapshot of the current state | At the end of each session or checkpoint |
| [`ROADMAP.md`](docs/ROADMAP.md) | Organizes phases and expected outcomes | When priorities or phases change |
| [`DECISIONS.md`](docs/DECISIONS.md) | Records significant decisions and their rationale | When a lasting decision is made |
| [`DESIGN_REFERENCES.md`](docs/DESIGN_REFERENCES.md) | Preserves design references and visual guidelines | When a reference or guideline is approved |
| [`CHANGELOG.md`](CHANGELOG.md) | Summarizes significant changes by version | When preparing a release or milestone |
| [`checkpoints/`](docs/checkpoints/README.md) | Provides evidence of completed and validated work | When a phase is completed |
| [`archive/`](docs/archive/README.md) | Stores historical material that is no longer current | When information from earlier work is retained |

## Minimum workflow

1. Define and approve the `PROJECT_CHARTER`.
2. Break down the first objective in the `ROADMAP`.
3. Implement only the active phase.
4. Validate the acceptance criteria.
5. Create a checkpoint and update `CURRENT_STATE`.
6. Record decisions and changes as needed.

## Setup

Copy `config/local.json.example` to `config/local.json` and fill it in. That file holds the operator's home base and API credentials, and is excluded from version control — it must never be committed (DEC-035).

## Next step

**Phase 4 — First Vertical Workflow** is the recommended next step, subject to separate authorization. Phase 3's approved technical foundation is documented in [`docs/TECHNICAL_FOUNDATION.md`](docs/TECHNICAL_FOUNDATION.md) and its [checkpoint](docs/checkpoints/2026-08-06_phase-3-technical-foundation.md).

Evidence of completed work: [`docs/checkpoints/2026-08-05_phase-0-definition.md`](docs/checkpoints/2026-08-05_phase-0-definition.md), [`docs/checkpoints/2026-08-05_phase-1-calibration.md`](docs/checkpoints/2026-08-05_phase-1-calibration.md), [`docs/checkpoints/2026-08-06_phase-2-functional-design.md`](docs/checkpoints/2026-08-06_phase-2-functional-design.md), and [`docs/checkpoints/2026-08-06_phase-3-technical-foundation.md`](docs/checkpoints/2026-08-06_phase-3-technical-foundation.md).
