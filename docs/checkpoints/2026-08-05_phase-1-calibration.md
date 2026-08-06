# Checkpoint: Phase 1 — Calibration

- Date: 2026-08-05
- Phase: 1 — Calibration
- Owner: Javier Napoles, founder and sole operator of HORUS
- Commit or version: documentation and ignored local evidence only; no application code or repository commit

## Outcome achieved

The two provisional scoring models have been tested against 30 real businesses across restaurants in Stamford, plumbing in Stamford, and landscaping in Norwalk. The operator reviewed the evidence and approved retaining `reputation-scoring-v1` and `web-opportunity-v2` without parameter changes.

This closes the Phase 1 exit criterion: thresholds are now retained from observed calibration evidence rather than remaining wholly untested assumptions. No existing model version was silently edited.

## Included scope

- Candidate discovery, review-history retrieval, and immutable local caching for the 30-business calibration set.
- Reputation scoring and review-history pagination analysis, including complete and `partial_data` handling.
- PageSpeed Insights mobile lab measurements for 28 of 29 listed public websites; one listing had no website and one URL did not return a measurement after two capped attempts.
- Manual operator review of representative and boundary cases, including CINCO DE MAYO, United Sewer & Water, Tuff Lawn, TwoGen Landscaping, JNR Plumbing, A Plus Ornamental & Turf Specialists, and LT Landscaping & Masonry.
- Credit reconciliation: 91 of 250 free SerpApi searches consumed and 159 remaining.
- Targeted tests of the 70-point boundary, the 400-review volume plateau, and Factor 4's full-credit floor.

## Out of scope

- Application implementation, architecture selection, data-store selection, deployment, demonstrations, and outreach.
- Spending additional credits to finish the eight remaining partial review histories.
- Changing either scoring-model version.
- Treating any calibration business as an approved prospect or contacting it.

## Validation performed

| Check | Result | Evidence |
| --- | --- | --- |
| Representative calibration sample | Passed | 30 businesses across three categories; discovery and review responses retained locally |
| Raw-response retention | Passed | Candidate, review, PageSpeed, and HTTP-header snapshots cached outside version control |
| Reputation distribution | Passed | 22 complete histories and 8 conservative `partial_data` histories were scored under `reputation-scoring-v1` |
| Credit reconciliation | Passed | SerpApi account balance reported 159 remaining, establishing 91 consumed credits |
| 400-review plateau | Retained | 12 of 30 listings were at or above 400; the curve is smooth around the boundary |
| Factor-4 floor | Retained | 14 of 30 received full credit, 9 received reductions, and 7 lacked the minimum recent-review input |
| Mobile performance measurement | Passed with coverage limit | 28 valid Lighthouse mobile responses; 13 scores below 60 and 16 LCP values above 10 seconds |
| Operator boundary review | Passed | Reputation and web-opportunity signals were separated from commercial-maturity judgment |
| Model-version decision | Approved | Operator approved retaining `reputation-scoring-v1` and `web-opportunity-v2` unchanged |

## Known limitations

- The 5 / 15 / 30-mile driving bands were not measured because no routing capability is configured; they remain provisional.
- The set contains one no-site case but no social-only case, so `SOCIAL_ONLY_BASE` remains unobserved.
- Factor 5 remains vulnerable to false positives where relevant content exists outside the sources inspected.
- The 91-credit calibration is not a direct measurement of the charter's normal five-prospect, ~48-credit run.
- PageSpeed results are single mobile lab runs; they are not stable field-performance claims.
- The retained thresholds are calibrated to this limited Stamford/Norwalk sample, not yet validated across other markets or real outreach outcomes.

## Related decisions

- DEC-007 — provisional reputation model requiring calibration
- DEC-008 — operator flags never auto-reject
- DEC-011 and DEC-034 — web-opportunity model and commercial ineffectiveness
- DEC-012 — PageSpeed Insights as the fixed mobile measurement source
- DEC-020 — immutable local caching
- DEC-032 and DEC-033 — free-tier budget and web-presence ordering

## Next authorized step

No next phase is authorized by this checkpoint. The recommended next step is Phase 2 — Functional Design, subject to a separate operator authorization. Phase 2 may define the workflow and interface but does not authorize code, publication, or outreach.
