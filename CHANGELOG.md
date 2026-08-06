# Changelog

All significant changes to HORUS V1 will be documented here.

The format uses the categories `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`. Versions will be released once software exists; until then, changes are listed under `Unreleased`.

## [Unreleased]

### Added

- Initial project documentation foundation.
- Project charter, current state, roadmap, decision log, design references, checkpoints, and historical archive.
- Complete V1 product definition: problem, primary user, value proposition, and a ten-step workflow from category-and-city input to a tracked sales opportunity.
- `reputation-scoring-v1` — six qualification gates, five weighted factors over 100 points, a 70-point threshold, auto-rejects separated from operator flags.
- `web-opportunity-v1` — four factors over 100 points across three web-presence situations.
- Shortlist ranking: reputation qualifies, proximity bands order, web opportunity orders within a band.
- Search scope, stopping rules, and cheapest-first evaluation order.
- Data sources and credit cost model: SerpApi for candidates and review history, PageSpeed Insights for performance.
- Storage and caching requirements, with a 30-day freshness limit at the point of contact.
- Demonstration publication: deployment, scope, mandatory requirements, image sourcing, and a 60-day operator-decided lifetime.
- Market, language policy, outreach delivery, and interface definition.
- `web-opportunity-v2` — commercial ineffectiveness added as a fifth factor, distinguishing a site that fails to sell from one that is merely broken.
- Decisions DEC-003 through DEC-034.
- Phase 0 checkpoint: `docs/checkpoints/2026-08-05_phase-0-definition.md`.
- Git repository initialized with a `.gitignore` excluding operator configuration, credentials, and cached responses.
- `config/local.json.example` documenting operator configuration structure (DEC-035).
- Charter approved by Javier Napoles on 2026-08-05; Phase 1 — Calibration authorized.
- Phase 1 calibration checkpoint: `docs/checkpoints/2026-08-05_phase-1-calibration.md`.
- Approved Phase 2 functional design: ten workflow-step specifications, six interface views, evidence presentation standard, approval-gate behavior, and a demonstration-template baseline.
- Phase 2 checkpoint: `docs/checkpoints/2026-08-06_phase-2-functional-design.md`.
- Decisions DEC-036 through DEC-040: visual baseline, common demonstration template, accessibility baseline, administrative-city search default, and structured demonstration editing.
- Electron/React/TypeScript/Vite operator foundation with a typed Electron preload boundary, SQLite persistence, immutable raw-evidence manifest, and append-only event log (DEC-042).
- Automated workflow, compose-handoff, and persistence-invariant tests, plus build and lint commands.
- Non-production SerpApi, PageSpeed, Gmail compose-handoff, and Cloudflare Dashboard upload contracts, with no renderer credential access or network execution.
- Gmail compose-handoff recipient validation, which rejects values Gmail cannot interpret as email addresses before a browser handoff is opened.
- Credential-free Gmail compose-handoff browser verification using `horus-test@example.invalid`; Gmail recognized the recipient and HORUS did not invoke Send.
- Test-only Cloudflare Dashboard Direct Upload validation at `https://spring-night-6be6.javiernpls.workers.dev`, without Wrangler or a Cloudflare API token (DEC-043).
- A main-process-only SerpApi discovery executor, with a contract test that verifies key handling and the Google Maps city-in-query request shape.
- The source-bounded Finescape and Sons concept at `https://horus-finescape-concept.pages.dev`, including a visible non-official notice, `noindex, nofollow`, no contact route, and no unsupported claims.
- Phase 5 in-progress checkpoint: `docs/checkpoints/2026-08-06_phase-5-first-live-concept.md`.

### Changed

- Phase 4 — First Vertical Workflow completed and approved by Javier Napoles on 2026-08-06.
- Phase 3 — Technical Foundation completed and approved by Javier Napoles on 2026-08-06.
- The Gmail handoff test now uses a syntactically valid address at the reserved `.invalid` domain; a bare `example.invalid` is rejected locally after Gmail rejected it in the approved no-send browser check.
- DEC-028 superseded by DEC-041 after Phase 3 verification established that Gmail's `gmail.compose` scope permits sending as well as draft management. HORUS now uses a credential-free Gmail compose handoff after explicit approval.
- Phase 3 Cloudflare verification now uses a manually approved Dashboard upload for test-only assets; it does not change the future Cloudflare Pages target or choose a production client.
- ROADMAP restructured from five phases to seven. Calibration inserted as Phase 1, ahead of design, because Phase 0 produced two scoring models with no contact with real data.
- DEC-013 superseded by DEC-017 after proximity was added as a ranking dimension.
- DEC-011 superseded in part by DEC-033 and DEC-034, which replaced the deliberate non-ordering of web-presence situations with a reasoned one.
- Web-opportunity factor weights rebalanced for v2: mobile 35→30, obsolete appearance 25→20, broken elements 20→18, load performance 20→12, commercial ineffectiveness 0→20. Load performance lost the most weight because it was the easiest signal to measure, not the most commercially meaningful.
- Search defaults lowered: `TARGET_QUALIFIED` 10→5, `MAX_EXAMINED` 100→60 (DEC-032).
- Charter section 8 now lists no questions blocking development.
- `DESIGN_REFERENCES.md` updated to separate the operator interface from the demonstration websites, which have different audiences and constraints.
- Phase 5 moved to in progress after a real 20-result Stamford landscaping search, explicit concept approval, and verified Cloudflare Pages publication. Outreach remains unprepared and unsent.
