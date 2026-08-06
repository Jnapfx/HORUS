# Current State

Last updated: 2026-08-06

## Summary

HORUS is a company being founded. HORUS V1 is the first internal operating system built for it, used by the founder to acquire HORUS's first client.

The repository contains documentation and locally cached calibration evidence only. HORUS V1 is fully specified end to end in `PROJECT_CHARTER.md`; no application code or implementation architecture has been created.

Thirty real businesses have now calibrated the models. The operator approved retaining `reputation-scoring-v1` and `web-opportunity-v2` unchanged; the remaining unvalidated assumptions are recorded below rather than treated as settled.

## Active phase

**Phase 0 — Definition: complete and approved** by Javier Napoles on 2026-08-05. Evidence: [`checkpoints/2026-08-05_phase-0-definition.md`](checkpoints/2026-08-05_phase-0-definition.md).

**Phase 1 — Calibration: complete and approved** by Javier Napoles on 2026-08-05. Evidence: [`checkpoints/2026-08-05_phase-1-calibration.md`](checkpoints/2026-08-05_phase-1-calibration.md).

**Phase 2 — Functional Design: complete and approved** by Javier Napoles on 2026-08-06. Evidence: [`FUNCTIONAL_DESIGN.md`](FUNCTIONAL_DESIGN.md) and [`checkpoints/2026-08-06_phase-2-functional-design.md`](checkpoints/2026-08-06_phase-2-functional-design.md). It defines behavior and interface review criteria only; it does not authorize implementation, publication, or outreach.

Phase 2 turned the approved workflow and calibrated scoring behavior into a reviewed, implementable functional design without selecting technical architecture or writing application code. The retained calibration evidence now gives the interface's evidence presentation and ranking behavior an observed basis.

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
- [x] Complete Phase 1 calibration and retain both scoring-model versions after operator review.
- [x] Complete Phase 2 functional design: ten-step behavior, six views, evidence standard, approval gates, and the V1 demonstration-template baseline.

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

**Phase 3 — Technical Foundation** is the recommended next step, subject to a separate operator authorization. It may choose architecture, configure the development environment, and verify the Gmail/Cloudflare integration paths; it does not authorize publication or outreach.

## Blockers

**None for Phase 2.** Phase 3 requires separate operator authorization.

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
