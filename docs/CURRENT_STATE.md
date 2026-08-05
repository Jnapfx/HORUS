# Current State

Last updated: 2026-08-05

## Summary

HORUS is a company being founded. HORUS V1 is the first internal operating system built for it, used by the founder to acquire HORUS's first client.

The repository is clean and contains documentation only. HORUS V1 is fully specified end to end in `PROJECT_CHARTER.md` across eighteen sections, with thirty-one recorded decisions. No implementation has been authorized and no repository history has been created.

Every threshold in both scoring models was reasoned from principle. Nothing has been tested against a real business.

## Active phase

**Phase 0 — Definition: complete and approved** by Javier Napoles on 2026-08-05. Evidence: [`checkpoints/2026-08-05_phase-0-definition.md`](checkpoints/2026-08-05_phase-0-definition.md).

**Phase 1 — Calibration: authorized, not started.**

Objective: score 30–50 real businesses in Stamford and Norwalk, ground the thresholds in observed data, and close the three remaining charter questions.

Phase 1 was inserted ahead of functional design because both scoring models were built entirely from reasoning. Designing an interface around numbers that may be wrong would build the wrong thing carefully.

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
- [x] Decide outreach delivery: HORUS drafts in Gmail with a compose-only scope, the operator sends (DEC-028).
- [x] Establish that HORUS V1 is an application with a visual interface and persistent state (DEC-029).
- [x] Resolve in-person follow-up: an operator action logged in the tracker after a prospect shows interest, not a workflow HORUS runs (DEC-030).
- [x] Set demonstration lifetime: at 60 days without a response HORUS prompts the operator to decide on removal; nothing is removed automatically (DEC-031).
- [x] Record the Phase 0 checkpoint and restructure the ROADMAP around calibration.

- [x] Close all three remaining charter questions: data budget, web-presence ordering, commercial ineffectiveness (DEC-032, DEC-033, DEC-034).
- [x] Extend the web model to `web-opportunity-v2` with a fifth factor and rebalanced weights.

- [x] Sign the charter — approved by Javier Napoles, 2026-08-05, first authorized phase: Phase 1.
- [x] Set the home base in Stamford CT, stored outside version control (DEC-035).
- [x] Initialize the Git repository with a `.gitignore` protecting the operator configuration.

## In progress

**Phase 1 — Calibration, authorized.** Not yet started.

## Next

1. **Obtain a SerpApi free-tier key** and place it in `config/local.json`. The only remaining prerequisite.
2. **Make the first commit.** The repository is initialized but has no history yet; awaiting authorization.
3. **Run the first retrieval** — one category in Stamford, `MAX_EXAMINED` 60, to measure real credit consumption against the ~48 estimate before committing to a full calibration set.
4. **Retrieve and score 30–50 businesses** across two or three categories, then set thresholds from what is observed.

**Phase 1 does not authorize contacting anyone.** Calibration retrieves and scores only. No demonstration is published and no outreach is drafted; the first real contact belongs to Phase 5 and requires its own approvals at both gates of DEC-004.

## Blockers

**None.** The charter is signed, the home base is set, and Phase 1 is authorized.

The only remaining prerequisite is a SerpApi free-tier key, needed to execute a retrieval rather than to authorize the phase.

## Known weaknesses carried into Phase 1

These do not block starting. They are what calibration exists to resolve, and they should be watched deliberately rather than discovered by surprise.

**Untested numbers**

- The 70-point reputation threshold, the 400-review saturation point, and Factor 4 awarding full credit for merely holding steady — the known weak point in the score floor (DEC-007).
- `NO_SITE_BASE` at 50 and `SOCIAL_ONLY_BASE` at 60: a reasoned commercial ordering, never observed (DEC-033).
- The 5 / 15 / 30-mile proximity bands, and whether distance should be driving distance or travel time.
- The ~48-credit per-search estimate, derived from documentation rather than measured.
- Whether proximity-first ranking costs more in response rate than it gains in convenience (DEC-030).

**Undefined capabilities**

- Detecting non-functional buttons and dead links requires executing pages; PageSpeed Insights does not cover it.
- Franchise and centralized-marketing detection has no rule, though both are operator flags rather than auto-rejects.
- Whether a city search follows administrative or metropolitan boundaries (DEC-015).
- PageSpeed Insights usage limits are unverified, and field data is typically unavailable for small local businesses.

**Accepted trade-offs**

- Send status is operator-declared, not observed (DEC-028).
- Demonstration removal depends on the operator answering a repeated prompt (DEC-031).
- A free-hosting URL carries less credibility in cold outreach than an established domain (DEC-022).
- Factor 5 measures absences, which are easy to detect and easy to get wrong when content exists where HORUS did not look (DEC-034).

**Not yet designed**

- Visual identity does not exist. HORUS has no brand, colours, or typography, and demonstrations need a visual direction.
- Storage requirements are defined (charter section 14) but no technology is selected, per DEC-002.

## Technical status

| Area | Status |
| --- | --- |
| Application code | Not started |
| Tests | Not started |
| Infrastructure | Not defined |
| Integrations | Not defined |
| Design | Interface type decided (DEC-029); visual direction undefined |
| Deployment | Not configured |

## Update rule

Update this file at the end of every significant work session. In under two minutes, it should explain what exists, what remains, and which next step is authorized.
