# Current State

Last updated: 2026-08-07

## Summary

HORUS is a company being founded. HORUS V1 is the first internal operating system built for it, used by the founder to acquire HORUS's first client.

The repository contains the approved product documents, locally cached calibration evidence, and an executable Electron/React/TypeScript foundation. HORUS V1 is fully specified end to end in `PROJECT_CHARTER.md`; its local SQLite and immutable-evidence foundation is implemented and tested. Phase 5 has completed the first real, approval-gated prospect run, including a public source-bounded concept and operator-confirmed manual outreach.

Thirty real businesses have now calibrated the models. The operator approved retaining `reputation-scoring-v1` and `web-opportunity-v2` unchanged; the remaining unvalidated assumptions are recorded below rather than treated as settled.

**DEC-046 through DEC-062 approved by Javier Napoles, 2026-08-07**, closing out Phase 6 steps 1–3 as accepted history rather than proposals awaiting review.

**DEC-063 and DEC-064 approved by Javier Napoles, 2026-08-07.**

**DEC-063:** before running the AGENT_ARCHITECTURE.md step 4 shadow replay, direct inspection of `cache/phase5/horus.sqlite` found that DEC-062's fix does not fully cover it. Finescape and Sons' 3 evidence rows are all reachable with `evidenceBasePath` set to the repository root, exactly as DEC-062 verified. SEASONS EATS is different: its own discovery/listing row is one of 10 rows in that database with a NULL `id` and can never be read by `read_evidence_snapshot`; only 2 near-duplicate review-page snapshots for it have a real id, and both need `evidenceBasePath` set to `apps/operator`, not the repository root, to resolve. `scripts/run-shadow-replay.ts` (new; `npm run agent:shadow-replay -- finescape` or `... seasons`) takes a per-case `evidenceBasePath` and runs the SEASONS EATS side as an explicitly partial replay.

**DEC-064:** both replays were then run live. Finescape (full evidence): the analyst read a 4.7/30 Maps rating, no `website` field, strongly positive reviews, and proposed the candidate for review — a qualitative read that does not match the retained historical outcome (retired at 48.1/100 by `reputation-scoring-v1`). This is expected, not a defect: the analyst never computes a score (rule 3) and only saw 3 snapshots, not the full retrieval the real deterministic model scored. It shows concretely why `reputation-scoring-v1` remaining unimplemented (DEC-050) matters — an agent's plausible qualitative read can diverge from the real model, and only the deterministic score is authoritative. SEASONS EATS (partial evidence, per DEC-063): the analyst proposed nothing, marking web-presence, full review population, and review text all `insufficient_data` — correct, evidence-honest abstention given a partial input, not a failure to reproduce the 73.06/100 approval it never had the evidence to see. AGENT_ARCHITECTURE.md step 4 is closed for both cases (one fully, one partially, as DEC-063 documents). Steps 5+ and the four unimplemented `ANALYST_TOOLS`/IPC-UI wiring remain open and unscheduled.

## Active phase

**Phase 0 — Definition: complete and approved** by Javier Napoles on 2026-08-05. Evidence: [`checkpoints/2026-08-05_phase-0-definition.md`](checkpoints/2026-08-05_phase-0-definition.md).

**Phase 1 — Calibration: complete and approved** by Javier Napoles on 2026-08-05. Evidence: [`checkpoints/2026-08-05_phase-1-calibration.md`](checkpoints/2026-08-05_phase-1-calibration.md).

**Phase 2 — Functional Design: complete and approved** by Javier Napoles on 2026-08-06. Evidence: [`FUNCTIONAL_DESIGN.md`](FUNCTIONAL_DESIGN.md) and [`checkpoints/2026-08-06_phase-2-functional-design.md`](checkpoints/2026-08-06_phase-2-functional-design.md). It defines behavior and interface review criteria only; it does not authorize implementation, publication, or outreach.

**Phase 3 — Technical Foundation: complete and approved** by Javier Napoles on 2026-08-06. Evidence: [`TECHNICAL_FOUNDATION.md`](TECHNICAL_FOUNDATION.md) and [`checkpoints/2026-08-06_phase-3-technical-foundation.md`](checkpoints/2026-08-06_phase-3-technical-foundation.md). Gmail recognized the final reserved-domain test recipient and HORUS did not invoke Send. A test-only Cloudflare Worker is public at `https://spring-night-6be6.javiernpls.workers.dev`; it contains no business data, contact, or operational capability. No HORUS credential, production demonstration, or outreach has been created.

**Phase 4 — First Vertical Workflow: complete and approved** by Javier Napoles on 2026-08-06. It validates the full local representative workflow with no external search, publication, Gmail opening, or contact.

Evidence: [`checkpoints/2026-08-06_phase-4-first-vertical-workflow.md`](checkpoints/2026-08-06_phase-4-first-vertical-workflow.md).

**Phase 5 — First Real Use: complete and approved** by Javier Napoles on 2026-08-06. An initial Finescape and Sons concept was retired when later review-history evidence scored 48.1/100, below the threshold. A subsequent SEASONS EATS run achieved a conservative lower-bound reputation score of 73.06/100, received the required operator judgment review, and was separately approved for local review and public deployment. Its public concept is `https://horus-seasons-eats-concept.pages.dev`, marked `noindex, nofollow` and without a form or contact route. A fresh public-data check preceded the approved Gmail compose handoff; the operator confirmed manual send. No email was sent by HORUS. The response and next follow-up remain pending tracked work.

Evidence: [`checkpoints/2026-08-06_phase-5-first-live-concept.md`](checkpoints/2026-08-06_phase-5-first-live-concept.md).

**Phase 6 — Validation and Hardening: pending.** Its proposed implementation sequence now includes correcting the foundation findings, then evaluating locally orchestrated agents through the operator's existing Claude subscription and Claude Code before considering a usage-metered model API. The agent runtime is documented but not implemented. Phase 6 begins in shadow mode and does not authorize additional public concepts or outreach by itself (DEC-045, `AGENT_ARCHITECTURE.md`).

### Phase 6 working draft — written 2026-08-07, not approved and not executed

Steps 1 to 3 of the validation sequence are **written and verified**, statically and at runtime, on macOS on 2026-08-07: oxlint clean, 52 of 52 tests passing, `tsc -b`, `vite build` and `tsc -p tsconfig.electron.json` clean, the DEC-047 migration executed and confirmed by inspecting the schema, and a workflow save recorded end to end.

The agent runtime contract was checked against Anthropic's published CLI documentation (DEC-056). The analyst task is schema-constrained through `--json-schema`, so prose is refused rather than accepted, and `session_id`, `total_cost_usd` and `num_turns` are recorded per run. That review found a conflict with DEC-045: `--bare`, the recommended mode for scripted calls, bypasses the subscription login and requires an API key, so HORUS does not use it — which otherwise would have meant Claude Code auto-discovering this repository's own `CLAUDE.md` on every analyst run.

That gap is now closed (DEC-057): `--system-prompt` replaces the default system prompt with the task's own instruction, and every run gets a fresh, empty working directory created under HORUS's own data directory, confirmed on creation to contain no `CLAUDE.md` or `.claude`.

**The operator then ran the exact command HORUS constructs, for the first time, from an isolated directory.** It succeeded: `structured_output`, `session_id` and `total_cost_usd` all arrived exactly as DEC-056 predicted from documentation, confirming the runtime contract against a live process. It also surfaced DEC-058 — Claude Code attempted a tool call in a run that supplied none, revealing that `task.allowedTools` had only ever been validated as data, never passed to Claude Code's actual permission surface. `--permission-mode dontAsk` contained the gap but was not the designed control.

**DEC-059 closes the first piece of that gap.** `read_evidence_snapshot` — one of `ANALYST_TOOLS`' five names — now has a real implementation: a stdio MCP server (`electron/agent/evidence-mcp-server.ts`) built on the officially supported `@modelcontextprotocol/sdk` v1.x, backed by a database connection opened with better-sqlite3's `readonly: true` (`electron/agent/evidence-store.ts`), proven to reject writes in a unit test against a real handle. `buildClaudeCodeArgs` now allow-lists exactly this tool when wired. The other four `ANALYST_TOOLS` names remain unwired and still resolve to no access, per DEC-058.

**Verified live.** `npm install` pulled `@modelcontextprotocol/sdk` and `zod` cleanly, 61 of 61 tests pass, and the operator then ran `claude -p` with `--mcp-config` pointing at the compiled server against a real, hand-seeded row in `horus.sqlite`. Claude Code called `read_evidence_snapshot` and returned the row's exact contents — data it had no way to produce except by reading it, with `permission_denials: []` confirming the DEC-059 allow-list worked as designed. This is the first tool in `ANALYST_TOOLS` to go from name, to code, to a live call, in one session.

What's left before a real analyst task can run end to end: this test used a hand-built prompt and a single seeded row, not `buildAnalystTask`'s actual instruction, schema, and evidence references together with the tool active. That combined run — schema-constrained output *and* a working tool in the same invocation — is next.

**DEC-060 found that gap was one level deeper than expected.** Every verification so far — the schema, the isolation, the permission lockdown, the tool call — used either a test fake or the operator typing `claude -p` directly into a terminal. No code in the repository had ever actually launched Claude Code; `SpawnImpl` had no real implementation. `electron/agent/node-spawn.ts` is that implementation now, tested against real subprocesses including a timeout kill and an argument-injection check. `npm run agent:live-check` assembles the full path — real evidence seeded, real task built by `buildAnalystTask`, real tool wired, real spawn, real isolated directory — and checks the result with `parseAnalystOutput`. **It found a real bug on the first run, and passed cleanly on the second (DEC-061).** The first run showed Claude Code had guessed nonexistent evidence-snapshot ids, because `buildKickoffPrompt` said how many snapshots existed but never named which ones. Fixed, and rerun: given the real ids, Claude Code called `read_evidence_snapshot` against both, produced three evidence-cited observations (the listing's 4.6 rating and 212 reviews, and PageSpeed's 41/11.2s performance figures — reported as observed facts, never as a score field), correctly marked category, location, and contact information as `insufficient_data` rather than guessing, and proposed the candidate for review with a rationale citing both snapshots.

**This is the first fully live, end-to-end confirmation of `AGENT_ARCHITECTURE.md` step 3.** Real task built by `buildAnalystTask`, real evidence tool, real spawn (`node-spawn.ts`, DEC-060), real isolated working directory, schema-constrained output, and HORUS's own `parseAnalystOutput` acceptance check — all operating together, against evidence the analyst had never seen before, not a hand-built prompt or a single hand-seeded row.

**Before attempting step 4, checked whether the real Finescape and Sons and SEASONS EATS evidence the roadmap names actually exists anywhere reachable.** It does — `cache/phase5/horus.sqlite`, a separate database from the one the Electron app writes, holding 64 real rows across discovery, reviews, PageSpeed, and manual website-analysis sources. But its `storage_path` values are relative to the repository root, in two different spellings, and the isolated directory DEC-057 deliberately runs the evidence server from is never the repository root — so reading this real evidence would have failed the moment step 4 tried it. DEC-062 adds a `basePath` to `evidence-store.ts`, consulted only for a relative path; every snapshot HORUS's own write path has ever produced is already absolute, so nothing about normal operation changes.

**Proven twice: a unit test, then the real file.** The operator ran `claude -p` from `/tmp/horus-finescape-check` — sharing nothing with the repository — pointed at the actual `cache/phase5/horus.sqlite`. It correctly reported "Position 11: Finescape and Sons," reading the real historical listing from its original, relative-path record. The evidence step 4 needs exists, is real, and is now reachable from an isolated agent run.

Getting there required four corrections that were not in the Phase 6 plan, because **the application had never actually run before**:

- The Electron build emitted one directory too deep, breaking both the dev script and the renderer path (DEC-051).
- The preload compiled as an ES module, which Electron's sandboxed loader rejects. `window.horus` was undefined and every save was a silent no-op (DEC-052).
- The dev server bound to IPv6 while Electron requested IPv4 (DEC-055).
- The store writes to Electron's generic application directory, and the renderer has no Content-Security-Policy (DEC-054, recorded without remedy).

Two consequences worth carrying forward:

- **`horus.sqlite` did not exist until today.** The Phase 1 calibration evidence lives in `cache/raw/serpapi/google_maps/` as 362 timestamped files. `appendRawSnapshot` had only ever run inside tests, so the persistence layer described in earlier checkpoints was implemented and tested but had never been the system of record.
- **The interface advances independently of the record.** While the preload was broken, the workflow was walked from stage 01 to stage 07 — past the demonstration approval gate — with nothing persisted at all. That is a defect in `App.tsx`, not in the preload, and it is recorded in DEC-053 with the remedy deliberately deferred.

Written:

- The three foundation corrections: credential-free provenance (DEC-046), one snapshot row per retrieval with a `user_version` migration (DEC-047), and main-process validation of renderer-submitted workflow state (DEC-048).
- The provider-neutral agent boundary and the single bounded analyst task, with the section 11 acceptance criteria enforced in the output parser (DEC-049).
- Twenty new automated tests — two for the integration and persistence corrections, seven for main-process state validation, eleven for the agent boundary — bringing the suite from 25 to 45 if they pass as written.

Not written, and still required before Phase 6 can be called complete:

- Verification of the Claude Code command shape, flags, authentication behaviour and error wording against a real installation. `classifyFailure` currently matches on strings nobody has observed (`AGENT_ARCHITECTURE.md` section 2).
- Steps 4 to 8: the Finescape and SEASONS EATS shadow-mode replay, the comparison against the operator's historical decisions, and the retain/revise/reject decision on the runtime. All of these require execution.
- Wiring the agent boundary into an IPC handler and the interface. The modules exist and are tested in isolation; nothing calls them yet.

Known consequence to check on first run: DEC-047 changes `rawSnapshotCount` from a count of distinct payloads to a count of retrievals, so the foundation status number will move. The migration rewrites a table holding real Phase 1 calibration evidence and should be run against a copy of the database first.

A separate finding, outside Phase 6 scope: `reputation-scoring-v1` is specified in charter section 9 but implemented nowhere in the code, so the calibration and SEASONS EATS reputation figures are not reproducible from this repository (DEC-050).

## Completed

- [x] Create an independent repository for HORUS V1.
- [x] Create the initial documentation structure.
- [x] Define HORUS as the company and HORUS V1 as an internal operating tool (DEC-003).
- [x] Define the primary user: the founder, sole operator.
- [x] Define the primary workflow end to end, from category and area through to a tracked opportunity.
- [x] Define the hard constraints: two blocking approval gates (DEC-004) and no fabricated content (DEC-005).
- [x] Define the V1 out-of-scope list and initial success criteria.
- [x] Define reputation qualification: six minimum gates, a five-factor 100-point model (`reputation-scoring-v1`), and a 70-point qualification threshold (charter section 9).
- [x] Choose Google reviews as the sole V1 reputation source (DEC-006).
- [x] Split rejection into objective auto-rejects and judgment-based operator flags, with flags never rejecting automatically (DEC-008).
- [x] Define evidence-retention requirements so any scoring run is reproducible as a historical snapshot.
- [x] Establish that web presence scores rather than filters; all three presence situations are eligible (DEC-009).
- [x] Define web opportunity as a 100-point model, with obsolete appearance grouped as one signal (DEC-010, DEC-011).
- [x] Adopt PageSpeed Insights as the measurement source for site performance, with the Lighthouse mobile profile as the fixed profile (DEC-012).
- [x] Define shortlist ranking: reputation qualifies, web opportunity ranks, reputation breaks ties (DEC-013, charter section 11).
- [x] Define search scope: run to `TARGET_QUALIFIED`, bounded by `MAX_EXAMINED`, both operator-set; standards never relaxed to fill the quota (DEC-014, charter section 12).
- [x] Express the search area as a city name, with resolution and boundary caveats recorded (DEC-015).
- [x] Add proximity as a third ranking dimension, measured from a stored home base, ranked in bands (DEC-016, DEC-017 — supersedes DEC-013).
- [x] Choose SerpApi for candidate discovery and review history, closing the review-data risk (DEC-018, charter section 13).
- [x] Establish the credit cost model and accept the free tier for the first real use (DEC-019).
- [x] Require local caching of all external responses, with immutable raw data and recomputable derived scores (DEC-020, charter section 14).
- [x] Set a 30-day maximum data age at the point of contact, enforced at the approval gates rather than at search time (DEC-021).
- [x] Choose Cloudflare Pages on a free `pages.dev` subdomain as provisional deployment, with a HORUS domain as the expected migration (DEC-022).
- [x] Define the demonstration as a real navigable website with explicit limits, mandatory publication requirements, and an image-sourcing rule (DEC-023, DEC-024, DEC-025, charter section 15).
- [x] Set the first target market as Stamford and Norwalk, Connecticut, with distances in miles (DEC-026).
- [x] Set the language policy: English by default, Spanish only on recorded evidence, operator-overridable (DEC-027).
- [x] Decide outreach delivery: HORUS hands an approved message to Gmail without API credentials; the operator composes and sends (DEC-041, supersedes DEC-028).
- [x] Establish that HORUS V1 is an application with a visual interface and persistent state (DEC-029).
- [x] Resolve in-person follow-up: an operator action logged in the tracker after a prospect shows interest, not a workflow HORUS runs (DEC-030).
- [x] Set demonstration lifetime: at 60 days without a response HORUS prompts the operator to decide on removal; nothing is removed automatically (DEC-031).
- [x] Record the Phase 0 checkpoint and restructure the ROADMAP around calibration.

- [x] Close all three remaining charter questions: data budget, web-presence ordering, commercial ineffectiveness (DEC-032, DEC-033, DEC-034).
- [x] Extend the web model to `web-opportunity-v2` with a fifth factor and rebalanced weights.

- [x] Sign the charter — approved by Javier Napoles, 2026-08-05, first authorized phase: Phase 1.
- [x] Set the home base in Stamford CT, stored outside version control (DEC-035).
- [x] Initialize the Git repository with a `.gitignore` protecting the operator configuration.
- [x] Complete Phase 1 calibration and retain both scoring-model versions after operator review.
- [x] Complete Phase 2 functional design: ten-step behavior, six views, evidence standard, approval gates, and the V1 demonstration-template baseline.
- [x] Establish the Phase 3 local Electron/React/TypeScript application foundation, typed preload boundary, SQLite store, immutable raw-evidence manifest, and append-only event log (DEC-042).
- [x] Add automated workflow, compose-handoff, persistence-invariant, and non-production integration-contract tests; local build and lint checks pass.
- [x] Add credential-safe contracts for SerpApi, PageSpeed, Gmail compose handoff, and Cloudflare Dashboard upload; no contract performs a network call.
- [x] Validate Cloudflare Dashboard Direct Upload with a 939 B, test-only static HTML asset; deployed without Wrangler or a Cloudflare API token (DEC-043).
- [x] Execute a real, explicitly approved 20-result landscaping search in Stamford and retain the returned raw evidence locally; the discovery request uses the documented SerpApi Maps query form with the city embedded in `q`.
- [x] Add a main-process-only SerpApi discovery executor and an automated contract test proving that the API key is never returned in the payload.
- [x] Publish and subsequently retire the Finescape and Sons concept after a documented reputation score below threshold; the retained Cloudflare Pages project now serves no business content.
- [x] Complete the first qualified real prospect run with SEASONS EATS: evidence-gated qualification, separately approved public concept, fresh outreach evidence, Gmail draft handoff, operator-confirmed manual send, and pending follow-up record.
- [x] Record the Phase 6 agent-runtime direction: evaluate a locally authenticated, subscription-backed Claude Code process behind a provider-neutral main-process boundary, without adding usage-metered model API billing to the initial pilot (DEC-045).

## Phase 1 evidence

**Phase 1 — Calibration, complete.**

The controlled calibration retrieval covered restaurants in Stamford, plumbing in Stamford, and landscaping in Norwalk. Restaurant discovery returned 60 rows representing 58 unique businesses; 37 passed G1/G2. Plumbing returned 13 G1/G2 survivors, of which 8 have a verified Stamford address; one is in Greenwich and four lack a verifiable address. Landscaping returned 10 G1/G2 survivors, of which 9 have a verified Norwalk address; one is in Wilton. The selected calibration set has 30 businesses: 13 restaurants stratified by review volume, 8 plumbers, and 9 landscapers.

Every selected business has cached raw candidate and initial-review responses. Thirty of the review histories have been paginated as needed through up to three pages: 21 cross the 365-day boundary, one has no further page and is complete within the data available, and 8 remain `partial_data` with a further page available. A test history jumped from June 2026 to February 2024 on its second page, so a pagination gap is never interpreted as proof that reviews are absent. The current decision is to stop before further pagination and assess the cost pattern. Raw responses and HTTP headers are cached locally outside version control.

Cost reconciliation, 2026-08-05: the SerpApi account balance is the billing source of truth and reports 159 of 250 free searches remaining; calibration has therefore consumed 91 credits (36.4% of the monthly allowance). The raw cache contains 92 successful payloads and 23 invalid payloads, so a raw-success count must not be treated as a debit ledger; the invalid pagination requests did not consume a credit. Thirty-two successful payloads are page-2 or page-3 review continuations. Completing the next available page for each of the 8 partial histories is bounded at 8 additional credits, but is not needed to preserve the current conservative lower-bound scores and will not be spent without an explicit decision. The 91-credit observed calibration is within DEC-032's 100–155 one-time calibration allowance; it does not validate the separate ~48-credit estimate for a normal five-prospect run because this exercise deliberately retrieved 30 businesses across three categories and included diagnostic requests.

A provisional reputation calculation under `reputation-scoring-v1` is complete, without changing any parameter. Of the 22 complete histories, 8 fail G3 on complete data and are auto-rejects; 14 pass G3, of which 6 score at least 70. Their score range is 49.5–85.1, with a median of 67.0. The 8 partial histories all already prove G3; scored conservatively with Factor 4 at zero and Factor 5 as `longevity_unknown`, two have a lower bound at or above 70. These results are calibration evidence, not final prospect qualification or a threshold decision.

Review-volume saturation check: the selected listings span 28–6,326 published reviews; 12 have fewer than 100 reviews, 6 have 100–399, and 12 are at or above the 400-review Factor 2 plateau. The boundary is represented by Tuff Lawn (314 reviews, 22.8 Factor-2 points), CINCO DE MAYO (392, 24.8), and Teed and Brown (435, 25.0), showing the logarithmic curve reaches the plateau smoothly rather than creating a large boundary jump. The many plateaued businesses confirm that volume beyond 400 should not be treated as a proxy for commercial maturity; the existing operator-flag treatment remains appropriate. This sample alone does not justify changing the 400-review parameter or creating a new model version.

Factor-4 floor check: 23 of the 30 selected businesses have at least five retrieved trailing-year reviews and can receive a consistency score. Fourteen receive the full 15 points, 9 receive a reduction for a negative delta, and 7 do not meet the input minimum. The full-credit floor is therefore common but not automatic in the observed set. The reduced cases include CINCO DE MAYO (2.4 Factor-4 points), Wonder Stamford (1.5), Teff (5.2), and Mecha Noodle Bar (8.8); this shows that measured decline is already capable of materially restraining otherwise strong listings. The evidence does not show that Factor 4 systematically makes the reputation gate too easy, so no parameter change is justified yet.

Manual boundary review, 2026-08-05: the operator would approach **CINCO DE MAYO** (68.3, complete data) and **United Sewer & Water** (65.6, complete data), but would not approach **Tuff Lawn** (73.6, complete data), **Mashed Burgers** (68.3, partial), **Barcelona Wine Bar** (65.4, complete data), or **FAIRCONN Plumbing** (65.0, partial). The stated reasoning: CINCO DE MAYO has a Wix site that is not responsive and a poor-quality logo; United has a poor design despite being responsive and offering a chatbot; Tuff Lawn appears to be a more consolidated company. In this small review, the 70-point threshold creates two false negatives and one false positive. The first two rationales are web-opportunity signals rather than reasons to weaken reputation qualification; the third is a judgment-dependent maturity signal, so it belongs as an operator flag rather than an auto-reject. This is evidence to examine the threshold and factor behavior; it is not sufficient to change a versioned model without a broader review and explicit decision.

Additional manual calibration review, 2026-08-05: the operator agrees that **TwoGen Landscaping** and **JNR Plumbing** should not be approached despite their stronger model signals; both present mature, complete local-service websites and are poor web-opportunity cases. **A Plus Ornamental & Turf Specialists** is retained as a `maybe`: its site is functional but has weaker copy quality, 46 reviews, and mobile performance 62. **LT Landscaping & Masonry** is not an approach candidate: it has no website URL in the listing but its weaker reputation evidence does not make absence of a site sufficient reason to pursue it. This supports the intended separation: web opportunity ranks reputation-qualified candidates, while commercial maturity is an operator judgment and a no-site state does not override weak qualification.

Direct site inspection adds evidence to the boundary review. CINCO DE MAYO is publicly hosted on a Wix subdomain and displays Wix branding; its visible phone-number link routes to a Google search rather than `tel:`, so it is a broken contact path under Factor 3. The operator reports that the site is not responsive. United presents working `tel:` links, service descriptions, a service-scheduling CTA, and a chat widget, so its opportunity is visual rather than a missing-contact-path case. Its retained COVID-safety link is a possible dated-content indicator, but not enough to score obsolete appearance on its own.

PageSpeed check, 2026-08-05: the initial unauthenticated mobile request returned HTTP 429 because the default consumer has a daily quota of zero. PageSpeed Insights was then enabled in the HORUS Google Cloud project and a locally stored key was created with an API restriction to PageSpeed Insights only. The fixed mobile Lighthouse responses and headers are cached locally. CINCO DE MAYO scores 84 performance (FCP 2.41 s, LCP 4.02 s, TBT 0 ms, CLS 0); United scores 61 (FCP 3.01 s, LCP 14.48 s, TBT 286 ms, CLS 0.00004). This independently supports a substantial performance opportunity for United and lets Factor 4 and the Lighthouse-derived portion of Factor 1 be evaluated.

The complete PageSpeed pass covers 28 of 29 public website URLs in the 30-business calibration set: valid mobile performance scores range from 14 to 87, with a median of 60.5; 13 are below 60 and 16 have LCP above 10 seconds. LT Landscaping & Masonry has no website URL in its discovery record, while Wonder Stamford returned no PageSpeed response after two attempts with a 120-second cap, so neither receives an invented performance score. Repeated runs can vary materially (EarlyGreen measured 59 and 51 on separate runs), therefore these are lab-run calibration evidence rather than stable production claims. The results reinforce the need to keep business maturity as an operator flag separate from web opportunity: Tuff Lawn appears commercially consolidated but measured 21 performance, LCP 25.2 s, and CLS 0.92.

## Next

Phase 6 may review and harden the process from the completed SEASONS EATS run. It should first correct the credential, historical-snapshot, and main-process validation findings, then implement one bounded Claude Code analyst task and replay Finescape and SEASONS EATS in shadow mode. The pending SEASONS EATS response should be recorded when the operator reports it. Sunshine Cuisine and Caribbean Bakery & Mini Mart remain separate discovery candidates; reputation, fresh evidence, explicit approvals, and separate real-use authorization remain required before any new outreach.

## Blockers

**No current technical blocker.** Wrangler 4.119.0 was authenticated through the operator's Cloudflare OAuth flow and used as a one-off direct Pages deployment client; no Wrangler dependency or credential was added to the repository. Cloudflare cannot delete an active production deployment, so the Finescape concept was retired by replacing it with a neutral static page while retaining the Pages project. The SEASONS EATS outreach was sent manually by the operator after a Gmail draft handoff.

## Known limitations carried forward

These do not block starting. They are what calibration exists to resolve, and they should be watched deliberately rather than discovered by surprise.

**Untested numbers**

- The 70-point threshold, 400-review saturation point, and Factor-4 floor were tested in one representative calibration set and retained, not proven universally correct (DEC-007).
- `NO_SITE_BASE` at 50 was observed once; `SOCIAL_ONLY_BASE` at 60 remains unobserved (DEC-033).
- The 5 / 15 / 30-mile driving bands, and whether distance should eventually yield to travel time.
- The ~48-credit estimate for a normal five-prospect run remains unmeasured; the 91-credit calibration was deliberately broader and is not comparable.
- Whether proximity-first ranking costs more in response rate than it gains in convenience (DEC-030).

**Undefined capabilities**

- Detecting non-functional buttons and dead links requires executing pages; PageSpeed Insights does not cover it.
- Franchise and centralized-marketing detection has no rule, though both are operator flags rather than auto-rejects.
- Whether a city search follows administrative or metropolitan boundaries (DEC-015).
- PageSpeed Insights usage limits are unverified, and field data is typically unavailable for small local businesses.

**Accepted trade-offs**

- Send status is operator-declared, not observed (DEC-041).
- Demonstration removal depends on the operator answering a repeated prompt (DEC-031).
- A free-hosting URL carries less credibility in cold outreach than an established domain (DEC-022).
- Factor 5 measures absences, which are easy to detect and easy to get wrong when content exists where HORUS did not look (DEC-034).

**Not yet designed**

- Production deployment automation is not selected; the Phase 3 Cloudflare Worker was test-only and does not replace the future Pages project.

## Technical status

| Area | Status |
| --- | --- |
| Application code | Electron/React foundation implemented and now buildable; never launched (DEC-051) |
| Tests | 45 automated tests passing, lint and build clean as of 2026-08-07 |
| Infrastructure | SQLite store implemented and tested but never used; retained evidence lives in `cache/` as plain files |
| Integrations | Non-production contracts implemented; Gmail compose handoff exercised with operator-confirmed manual send |
| Agents | Boundary and one bounded analyst task written and unit-testable; runtime unverified against a real Claude Code installation, and nothing calls it yet |
| Design | Functional design and visual baseline approved |
| Deployment | Cloudflare Pages direct deployments verified for bounded public concepts |

## Update rule

Update this file at the end of every significant work session. In under two minutes, it should explain what exists, what remains, and which next step is authorized.
