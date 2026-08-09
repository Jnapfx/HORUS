# Checkpoint: Phase 6 — The Real Pipeline Runs End to End for the First Time

- Date: 2026-08-08
- Phase: 6 — Validation and Hardening (**third partial checkpoint of 2026-08-08; the phase is still not complete**)
- Owner: Javier Napoles, founder and sole operator of HORUS
- Approval status: **not approved.** Recorded as evidence of work performed, not as a completed phase, and not as a request to accept DEC-083 through DEC-092 as a bundle — each stands on its own in [`../DECISIONS.md`](../DECISIONS.md).

## Why this is a partial checkpoint

The two earlier checkpoints from the same day recorded that charter §4's loop had been *built*. This one records the first time any of it was **run**.

That distinction turned out to matter more than expected. Between those checkpoints and this one, two separate structural dead ends were found — neither of which any test could see, because both sat *between* the tested units rather than inside them.

## Outcome achieved

**A real search now runs through to a demonstration preview, on real business data, for the first time in the project's history.**

Ten SerpApi credits were spent: one search of `landscaping` in Norwalk, Connecticut returning 10 candidates, and nine review-history pages across three of them. The run stopped at the demonstration preview. Nothing was published and no one was contacted; DEC-004's two gates are not reachable from the validation harness at all.

## What the run proved

- **The pipeline is continuous.** Discovery → G1/G2 screen → proximity → review history → `reputation-scoring-v1` → shortlist → prospect → freshness → demonstration all execute in sequence against live data.
- **The model is stable on real data.** TwoGen Landscaping recomputed to **71.0** against the **71.1** DEC-073 recorded live four days earlier. Tuff Lawn came to **76.2** against the calibration's **73.6**, the gap consistent with four more days of reviews and a different retrieval depth.
- **DEC-091's fix works where it matters.** With the operator judgment unanswered the shortlist ranked 0 and excluded 3 as `not_reputation_qualified`; with it answered, 2 ranked. That is the dead end dying on real data.
- **Objective gates are not rescued by judgment.** LT Landscaping stayed excluded *even with all three judgment gates answered*, because it failed G3, the objective recency gate. Nothing had previously tested this, and it is exactly what charter 9.4/9.5 require.
- **DEC-077's cache works.** A second pass served discovery from the stored snapshot with no new credit — validated live for the first time, and it then saved a credit again by accident during the write-up.
- **DEC-089's freshness gate reports correctly** on evidence retrieved seconds earlier: fresh, 0 days, contact not blocked.
- **The demonstration generator produced a complete page** for TwoGen with zero placeholders, `noindex` present and the concept notice present.

## What the run found

**Two blockers, both discovered before a single credit was spent.**

1. `latitude`/`longitude` were absent from `config/local.json` — optional fields added by DEC-074 and never filled in. `getHomeBaseCoordinates` returned null, so every candidate was excluded with `no_proximity_data`. **This was a second dead end stacked directly behind DEC-091's**, and only one is ever visible at a time: fixing the first reveals the second.
2. The application had never persisted anything. No data directory existed under any name, so DEC-077's cache could not help and the search had to cost a credit. Every piece of real evidence in the repository until now was produced outside this application.

**One new finding from the run itself.** All three scored candidates retrieved exactly 28 reviews across 3 pages with `paginationExhausted: false` — DEC-018's page cap, hit every time. For TwoGen that is 28 of 42 published reviews; for Tuff Lawn it is **28 of 314, a 9% sample**. The system reports this honestly (`partial_data`, longevity `unmeasured`), but recency and consistency for a high-volume business rest on a thin slice, and the cap was chosen for cost rather than as a sampling decision. Recorded, not acted on: changing it would change the model.

## Included scope

- `scripts/validate-pipeline.ts` and `npm run validate:pipeline` (DEC-092).
- Approximate home-base coordinates written to `config/local.json`, labelled in the file itself as validation-only.
- `apps/operator/.validation-data/` added to `.gitignore` — real retrieved business data.
- The nine decisions this run exercised: DEC-083 through DEC-091.

## Out of scope — explicitly not validated

- **The React event wiring.** The harness calls the same functions `main.ts` wires to IPC, but not through the interface. DEC-091's dead end was found by reasoning about the UI, not by running it; the interface itself still needs a pass.
- **Both DEC-004 gates.** Deliberately unreachable from the harness. No demonstration was published and no outreach was drafted or opened.
- **Web-opportunity measurement.** The harness substitutes a fixed value so it is never the reason a candidate is excluded. Three of `web-opportunity-v2`'s five factors remain permanently `unmeasured` in the product.
- **Proximity accuracy.** The coordinates in use are the Stamford city centroid, not the operator's home base. The 5/15/30-mile bands are the first ranking key, so a centroid can misassign one. **These must be replaced before any real prospect decision**, and the config file says so.

## Evidence

- [`../DECISIONS.md`](../DECISIONS.md) — DEC-083 through DEC-092.
- `apps/operator/.validation-data/horus.sqlite` — 10 raw snapshots from the run, local and gitignored.
- 305 automated tests passing; lint, `tsc -b`, `vite build` and `tsc -p tsconfig.electron.json` all clean on macOS.

## What this checkpoint does not claim

It does not claim Phase 6 is complete. The exit criterion still requires a recorded retain/revise/reject decision on the agent runtime, which does not exist. It does not claim the MVP is finished — the refresh flow, DEC-031's 60-day prompt, persistence of working state, and FUNCTIONAL_DESIGN §6's six named views are all still absent. And it does not authorize a real prospect, publication, or outreach; those remain behind DEC-004's two explicit approvals, unchanged.
