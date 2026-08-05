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

## Phase 1 — Calibration

Outcome: the scoring models have met real businesses, and their thresholds are grounded rather than guessed.

This phase exists because Phase 0 produced `reputation-scoring-v1` and `web-opportunity-v2` without scoring a single business. Designing an interface around numbers that may be wrong would build the wrong thing carefully.

- [ ] Retrieve 30–50 representative businesses from Stamford and Norwalk across two or three categories.
- [ ] Cache all raw responses (DEC-020), so rescoring costs nothing thereafter.
- [ ] Measure actual credit consumption against the section 13.3 estimate.
- [ ] Score the set and inspect the distribution: how many pass the gates, how many clear 70, where the boundary cases fall.
- [ ] Test the known weak points — the 70 threshold, the 400-review saturation, Factor 4's full-credit floor, the 5/15/30-mile bands.
- [ ] Review each qualified business by eye and record where the model disagrees with judgment.
- [ ] Test the web-presence ordering of DEC-033 — `NO_SITE_BASE` 50 and `SOCIAL_ONLY_BASE` 60 are reasoned, not observed.
- [ ] Test Factor 5 for false positives, where content exists somewhere HORUS did not look.

**Prerequisites:** the home base must be set (charter 8.1) and a SerpApi free-tier key obtained.

**Exit criterion:** thresholds are set from observed data, and any parameter change is recorded as a new model version rather than an edit to an existing one.

## Phase 2 — Functional Design

Outcome: the workflow can be evaluated before it is built.

- [ ] Specify inputs, transformations, outputs, and errors for each of the ten workflow steps.
- [ ] Design the six interface views of charter section 18.
- [ ] Define the demonstration template and visual direction (`DESIGN_REFERENCES.md`).
- [ ] Define the evidence presentation — how a prospect's qualification is shown so the operator can judge it, not merely read a number.
- [ ] Agree on acceptance criteria per step.

**Exit criterion:** the workflow has been reviewed and broken down into implementable tasks.

## Phase 3 — Technical Foundation

Outcome: an executable, tested, and documented skeleton exists.

- [ ] Choose an architecture based on confirmed requirements.
- [ ] Configure the environment and automated quality checks.
- [ ] Establish the storage layer required by charter section 14, separating immutable raw data from derived scores.
- [ ] Verify the Gmail compose-only scope and the Cloudflare Pages deployment path.
- [ ] Document installation and configuration.

**Exit criterion:** the project can be run and verified from a clean checkout.

## Phase 4 — First Vertical Workflow

Outcome: the operator can complete the primary workflow from start to finish.

- [ ] Implement the happy path across all ten steps.
- [ ] Implement both approval gates as blocking (DEC-004).
- [ ] Handle essential errors, empty states, and the missing-data rules of charter 9.6 and 10.4.
- [ ] Add acceptance tests.
- [ ] Validate with a representative case that contacts no one.

**Exit criterion:** a reproducible functional checkpoint exists.

## Phase 5 — First Real Use

Outcome: one qualified prospect, one live demonstration, one approved outreach, one tracked opportunity.

This is the success criterion of charter section 5, and the reason the project exists.

- [ ] Run a real search in Stamford or Norwalk.
- [ ] Select a prospect, review its evidence, and approve a demonstration.
- [ ] Publish, approve the outreach, and send it.
- [ ] Record the outcome and the next follow-up action.
- [ ] Compare what happened against the assumptions made in Phase 0.

**Exit criterion:** the V1 success criteria have been measured against one real run.

## Phase 6 — Validation and Hardening

Outcome: V1 is reliable enough for repeated use.

- [ ] Address findings from the first real use.
- [ ] Review security, privacy, and the handling of third-party business data.
- [ ] Confirm minimum performance and cost per prospect.
- [ ] Prepare removal and recovery procedures for published demonstrations.

**Exit criterion:** a decision is recorded on whether to continue with V1 as built, revise it, or reconsider the approach.
