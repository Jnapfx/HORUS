# Checkpoint: Phase 0 — Product Definition

- Date: 2026-08-05
- Phase: 0 — Definition
- Owner: founder of HORUS (sole operator)
- Commit or version: none — documentation only, no repository history created

## Outcome achieved

HORUS V1 can now be described end to end by someone who was not present for the conversation that defined it.

Before this phase, the repository contained a documentation scaffold and the word "HORUS" with no stated meaning. It is now specified: what HORUS is, who operates it, what one complete run produces, how a prospect qualifies, how the shortlist is ordered, where data comes from and what it costs, where demonstrations are published and for how long, how outreach reaches a prospect, and what the operator sees.

Thirty-one decisions are recorded with their context, the options considered, and their consequences. One has been superseded rather than deleted.

## Included scope

**Product definition** — problem, primary user, value proposition, and a ten-step workflow from category-and-city input through to a tracked sales opportunity (charter sections 1–4).

**Qualification** — `reputation-scoring-v1`: six gates, five weighted factors over 100 points, a 70-point threshold, auto-rejects separated from operator flags, and missing-data behavior (section 9).

**Opportunity** — `web-opportunity-v1`: four factors over 100 points across three web-presence situations (section 10).

**Ranking** — reputation qualifies, proximity bands order, web opportunity orders within a band, reputation breaks ties (section 11).

**Search behavior** — run to `TARGET_QUALIFIED` bounded by `MAX_EXAMINED`, cheapest-first evaluation, standards never relaxed to fill a quota (section 12).

**Data and cost** — SerpApi for candidates and review history, PageSpeed Insights for performance, with a credit cost model and the free tier accepted for first use (section 13).

**Storage** — local caching of immutable raw responses with recomputable derived scores, and a 30-day freshness limit at the point of contact (section 14).

**Publication** — Cloudflare Pages, demonstration scope and limits, mandatory requirements, image sourcing, and a 60-day operator-decided lifetime (section 15).

**Market, language, delivery, interface** — Stamford and Norwalk CT; English by default with an evidence-based Spanish exception; Gmail drafts under a compose-only scope; a visual application with six views (sections 16–18).

## Out of scope

- Any implementation. No application code, no dependencies, no technology selection beyond the external services named above.
- Repository history. No commits, branches, or pull requests were created.
- Calibration of any threshold against real businesses.
- Anything reused from a previous version of HORUS.

## Validation performed

| Check | Result | Evidence |
| --- | --- | --- |
| Scoring arithmetic recomputed programmatically | Passed, one error found and corrected | Minimum score was reported as 14; recomputation showed a steady gate-passer scores 29. Both are recorded in charter 9.3 |
| Both models sum to exactly 100 at maximum | Passed | Verified by computation |
| Volume factor doubling property exact | Passed | 0 / 6.25 / 12.5 / 18.75 / 25 across 25→400 reviews |
| All `DEC-XXX` references resolve to a defined decision | Passed | Checked across all Markdown files |
| Superseded decision marked, not deleted | Passed | DEC-013 marked superseded by DEC-017 |
| Charter section and question numbering | Passed | No duplicates or gaps |
| Review-history availability | Confirmed against source documentation | SerpApi Google Maps Reviews API returns `iso_date` per review and supports `sort_by=newestFirst` |
| Cost model | **Not validated** | Estimate derived from documented page sizes; never measured against a real run |
| Every scoring threshold | **Not validated** | No business has been scored |

## Known limitations

**Nothing has touched reality.** Every number in both scoring models was reasoned from principle. No business has been retrieved, scored, or contacted. The models are internally consistent and externally untested.

**The 70-point threshold is the least trustworthy number.** It lands near "4.7 stars, 110+ reviews, steady activity." A 4.7 business with 85 reviews and slight softening scores 67 and fails — defensible, but arbitrary until tested.

**Placeholder values produce real orderings.** `NO_SITE_BASE` and `SOCIAL_ONLY_BASE` sit at 70 as an explicit non-decision, yet they will rank businesses. Any ordering V1 produces between the three web-presence situations is an artifact.

**Two capabilities are named but undesigned.** Detecting non-functional buttons and dead links requires executing pages, which PageSpeed Insights does not cover. Franchise and centralized-marketing detection has no rule.

**Operator-dependent integrity.** Send status is declared, not observed (DEC-028). Demonstration removal depends on the operator answering a repeated prompt (DEC-031).

**No visual identity exists.** HORUS has no brand, and demonstrations need a visual direction.

## Related decisions

DEC-001 through DEC-031. Of particular structural weight:

- **DEC-003** — HORUS V1 is an internal operating tool, not a product.
- **DEC-004** — two blocking approval gates, later made technically enforceable by DEC-028's compose-only scope.
- **DEC-005** — no fabricated information, which constrains DEC-025's image rule.
- **DEC-008** — operator flags never auto-reject.
- **DEC-017** — proximity bands rank first, superseding DEC-013.
- **DEC-020** — caching, which made calibration affordable and materially relaxed DEC-019's budget constraint.

## Addendum — same day, after this checkpoint was written

Three decisions closed the questions this checkpoint left open:

- **DEC-032** — the data budget: stay on the free tier, lower `TARGET_QUALIFIED` to 5 and `MAX_EXAMINED` to 60. Caching made calibration fit within a single month's free allowance.
- **DEC-033** — web-presence ordering: a poor site outranks social-only, which outranks no site. `NO_SITE_BASE` 50, `SOCIAL_ONLY_BASE` 60. Reasoned, not observed.
- **DEC-034** — commercial ineffectiveness added as Factor 5, worth 20 points, with the other four factors rebalanced to preserve a 100-point total. The model becomes `web-opportunity-v2`, and DEC-011 is superseded in part.

The scoring figures recorded above under "Included scope" describe `web-opportunity-v1`. Section 10 of the charter now describes v2. The v1 figures are retained here because a checkpoint records what was true when it was written.

## Next authorized step

**Phase 1 — Calibration**, on operator approval of the charter.

Charter section 8 now lists no blocking questions. What remains is calibration, which is what Phase 1 exists to perform.

Two prerequisites: the home base must be set, and a SerpApi key obtained. Approval authorizes retrieving and scoring real businesses — it does not authorize contacting anyone.
