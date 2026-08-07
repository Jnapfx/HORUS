# Roadmap

This roadmap describes outcomes, not speculative dates. Dates should be added only after scope, capacity, and dependencies have been confirmed.

Revised 2026-08-05, after Phase 0 closed. The original plan assumed architecture would follow requirements; that still holds, but Phase 0 produced something it did not anticipate — two scoring models built entirely from reasoning, with no contact with real data. Calibration is therefore inserted ahead of design rather than deferred to validation.

## Phase 0 — Definition · complete

Outcome: a concise, approved V1 specification exists.

- [x] Define the problem and primary user.
- [x] Define the primary workflow, end to end.
- [x] Set the scope and exclusions.
- [x] Define success criteria.
- [x] Identify data sources, access, and constraints.
- [x] Define qualification, ranking, publication, delivery, and interface.

**Exit criterion:** met, with a qualification. Three questions remain open in charter section 8. Two are reclassified below as Phase 1 calibration work because they cannot be answered without real businesses; the third is a budget decision for the operator.

Evidence: [`checkpoints/2026-08-05_phase-0-definition.md`](checkpoints/2026-08-05_phase-0-definition.md).

## Phase 1 — Calibration · complete with deferred validation

Outcome: the scoring models have met real businesses, and their thresholds are grounded rather than guessed.

This phase exists because Phase 0 produced `reputation-scoring-v1` and `web-opportunity-v2` without scoring a single business. Designing an interface around numbers that may be wrong would build the wrong thing carefully.

- [x] Retrieve 30 representative businesses from Stamford and Norwalk across three categories.
- [x] Cache all raw responses (DEC-020), so rescoring costs nothing thereafter.
- [x] Measure actual credit consumption and reconcile it against the account balance.
- [x] Score the set and inspect the distribution, gate outcomes, and boundary cases.
- [x] Test the 70 threshold, 400-review saturation, and Factor 4's full-credit floor.
- [x] Review representative qualified and boundary businesses by eye, recording model disagreement and operator judgment.
- [ ] Validate the 5/15/30-mile driving bands, `SOCIAL_ONLY_BASE`, and Factor-5 false positives in later real use; they were not represented or measurable without a routing capability in this calibration set.

**Prerequisites:** the home base must be set (charter 8.1) and a SerpApi free-tier key obtained.

**Exit criterion:** met. After review of the observed data, the operator approved retaining `reputation-scoring-v1` and `web-opportunity-v2` unchanged. The untested items are explicit limitations, not silently accepted assumptions.

Evidence: [`checkpoints/2026-08-05_phase-1-calibration.md`](checkpoints/2026-08-05_phase-1-calibration.md).

## Phase 2 — Functional Design · complete

Outcome: the workflow can be evaluated before it is built.

Evidence: [`FUNCTIONAL_DESIGN.md`](FUNCTIONAL_DESIGN.md), approved by Javier Napoles on 2026-08-06, and [`checkpoints/2026-08-06_phase-2-functional-design.md`](checkpoints/2026-08-06_phase-2-functional-design.md).

- [x] Specify inputs, transformations, outputs, and errors for each of the ten workflow steps.
- [x] Design the six interface views of charter section 18.
- [x] Define the demonstration template and visual direction (`DESIGN_REFERENCES.md`).
- [x] Define the evidence presentation — how a prospect's qualification is shown so the operator can judge it, not merely read a number.
- [x] Agree on acceptance criteria per step.

**Exit criterion:** met. The workflow has been reviewed and broken down into implementable tasks without selecting an implementation architecture.

## Phase 3 — Technical Foundation · complete and approved

Outcome: an executable, tested, and documented skeleton exists.

Initial architecture proposal and Gmail/Cloudflare verification: [`TECHNICAL_FOUNDATION.md`](TECHNICAL_FOUNDATION.md). DEC-041 resolves the Gmail safety boundary; architecture approval is required before the executable foundation is created.

- [x] Choose an architecture based on confirmed requirements (DEC-042).
- [x] Configure the environment and automated quality checks.
- [x] Establish the storage layer required by charter section 14, separating immutable raw data from derived scores.
- [x] Complete the credential-free Gmail compose-handoff confirmation with a syntactically valid reserved-domain test address; Gmail recognized the recipient and no Send control was invoked.
- [x] Verify a Cloudflare Dashboard Direct Upload with a test-only static asset; deployed at `https://spring-night-6be6.javiernpls.workers.dev` without Wrangler or a Cloudflare API token.
- [x] Document installation and configuration.

**Exit criterion:** met and approved on 2026-08-06. The project can be run and verified from a clean checkout.

## Phase 4 — First Vertical Workflow · complete and approved

Outcome: the operator can complete the primary workflow from start to finish.

- [x] Implement the happy path across all ten steps in a local representative workflow.
- [x] Implement both approval gates as blocking (DEC-004).
- [x] Handle essential errors, empty states, and the missing-data rules of charter 9.6 and 10.4.
- [x] Add acceptance tests.
- [x] Validate with a representative case that contacts no one.

**Exit criterion:** met and approved on 2026-08-06.

## Phase 5 — First Real Use · complete

Outcome: one qualified prospect, one live demonstration, one approved outreach, one tracked opportunity.

This is the success criterion of charter section 5, and the reason the project exists.

- [x] Run a real 20-result landscaping search in Stamford, Connecticut, with raw responses cached locally.
- [x] Select Finescape and Sons as a no-website opportunity, review public-source evidence, and approve a bounded concept demonstration; later reputation evidence scored it below threshold, so it was not pursued.
- [x] Publish and retire a bounded no-contact concept at `https://horus-finescape-concept.pages.dev`; the retained project now serves a neutral noindex page with no business content.
- [x] Qualify SEASONS EATS from fresh public evidence at a conservative 73.06/100 lower bound, with the operator accepting the required judgment review.
- [x] Prepare, locally approve, publish, and verify the bounded public `noindex` concept at `https://horus-seasons-eats-concept.pages.dev`.
- [x] Prepare and approve an outreach draft; hand it off to Gmail without sending automatically. The operator confirmed manual send.
- [x] Record the sent confirmation and next action: await a response, then record and assess it.
- [x] Compare the run with Phase 0 assumptions: approval gates, source bounds, fresh-at-contact evidence, and operator-declared send status all held in practice.

Evidence: [`checkpoints/2026-08-06_phase-5-first-live-concept.md`](checkpoints/2026-08-06_phase-5-first-live-concept.md).

**Exit criterion:** met. The V1 success criteria were measured against one real, operator-approved run. A business response is a tracked sales outcome, not a prerequisite for closing this phase.

## Phase 6 — Validation and Hardening

Outcome: V1 is reliable enough for repeated use.

- [ ] Correct the high-priority foundation findings before agent tools are enabled: redact credential-bearing request data, preserve each retrieval as a distinct historical snapshot, and validate workflow commands and approvals in the Electron main process.
- [ ] Implement the provider-neutral local agent boundary proposed in [`AGENT_ARCHITECTURE.md`](AGENT_ARCHITECTURE.md), beginning with a subscription-backed Claude Code availability/authentication check and one queued, bounded analyst task.
- [ ] Keep scoring, freshness, state transitions, approval validity, publication authorization, Gmail handoff, and delivery declaration deterministic and outside model authority.
- [ ] Record agent instructions, evidence IDs, tool activity, structured output, runtime identity, failure state, and operator disposition without storing credentials.
- [ ] Replay Finescape and Sons and SEASONS EATS in shadow mode and compare the agent output with retained evidence and historical operator decisions.
- [ ] Add concept and outreach composition only after the analyst replay passes its evidence and missing-data checks.
- [ ] Review security, prompt-injection resistance, privacy, subscription limits, product terms, and the handling of third-party business data.
- [ ] Confirm minimum performance, repeatability, SerpApi consumption, and model-runtime availability per prospect.
- [ ] Prepare and test recovery procedures for interrupted agent runs and removal/recovery procedures for published demonstrations.
- [ ] Run no additional real prospect, publication, or outreach until separately authorized after shadow-mode validation.

**Exit criterion:** the corrected foundation and shadow-mode agent workflow pass their acceptance checks, Claude unavailability is recoverable without corrupting state, no agent can bypass either approval gate, and a decision is recorded on whether to retain the subscription-backed runtime, change provider/runtime, revise V1, or reconsider the approach.
