# Project Charter

## Document status

- Status: approved
- Owner: founder of HORUS (sole operator)
- Last reviewed: 2026-08-05
- Approval: Javier Napoles, 2026-08-05

## 0. Naming

- **HORUS** is the company being founded.
- **HORUS V1** is the first internal operating system built for that company. It is a tool the founder uses, not a product sold to customers. See `DECISIONS.md` DEC-003.

## 1. Problem

HORUS is a new company with no clients. Acquiring the first one requires finding local businesses that are well-regarded but poorly represented online, understanding each well enough to make a credible case, and producing tangible proof of value — work that is slow and manual when done by hand, and easy to abandon before the first client is signed.

Until HORUS has a first paying client, it has no revenue, no reference case, and no validated offer.

## 2. Primary user

| Aspect | Definition |
| --- | --- |
| User type | The founder of HORUS, operating the system directly. Sole user of V1. |
| Usage context | Laptop and business email, working to acquire HORUS's first client. |
| Primary need | Go from a market segment to one qualified prospect with a live demonstration and an approved outreach sent. |
| Technical proficiency | High; the operator is also the builder. |

There are no other users in V1. No personas, no second operator, no client-facing account.

## 3. Value proposition

> HORUS V1 helps **the founder of HORUS** achieve **one qualified prospect with a live demonstration site and an approved outreach sent** through **automated public-data research, defined qualification criteria, and generation of a customized demonstration site under explicit human approval**, while avoiding **the manual effort of prospecting, researching, and building a demonstration by hand for each candidate**.

## 4. Minimum V1 outcome

**One search → one qualified prospect → one approved live demonstration → one approved outreach → one trackable sales opportunity.**

### Primary workflow, end to end

1. The operator enters a business category and a geographic area.
2. HORUS collects publicly available information on local businesses in that segment.
3. HORUS applies defined qualification criteria — strong reputation combined with absent, outdated, generic, or ineffective web presence — and returns a ranked shortlist. Each entry includes evidence for why the business qualifies.
4. The operator reviews the shortlist and selects one prospect.
5. HORUS generates a customized, mobile-friendly demonstration website for that business using only verified public information.
6. The operator reviews, edits, and **explicitly approves** the demonstration before publication.
7. HORUS publishes the approved demonstration at a shareable URL.
8. HORUS prepares a personalized outreach message explaining the opportunity and linking to the demonstration.
9. The operator reviews and **explicitly approves** the outreach before it is sent.
10. HORUS records the prospect, the published demonstration, the outreach activity, its current status, and the next follow-up action.

Beyond step 10, follow-up is the operator's own activity, recorded by HORUS rather than run by it. Where a prospect shows interest, an in-person visit may follow; it is logged in the tracker with its date and outcome alongside any other follow-up. HORUS does not schedule visits or prepare materials for them in V1 (DEC-030).

### What the operator has at the end of one complete run

- One qualified potential client for HORUS.
- Evidence supporting that qualification.
- A live, customized demonstration website.
- An approved outreach message sent to the prospect.
- A documented next step toward converting that prospect into HORUS's first paying client.

### Hard constraints

- The demonstration must not invent services, credentials, claims, testimonials, or any other unsupported information. Every element must trace to a verifiable public source. See DEC-005.
- Nothing is published and nothing is sent without explicit operator approval. Both gates are blocking. See DEC-004.

### Out of scope

- Any customer-facing or multi-user version of this system.
- Serving more than one operator.
- Processing more than one prospect per run.
- Automated sending or publishing without approval.
- Client delivery, billing, contracts, or project management after a prospect responds.
- Reuse of any code or assumption from a previous version of HORUS.

## 5. Success criteria

| Metric | Baseline | V1 target | Measurement method |
| --- | --- | --- | --- |
| Complete runs executed end to end | 0 | 1 | The full ten-step workflow completed without manual workaround |
| Qualified prospects produced | 0 | 1 | Prospect passes the defined qualification criteria with recorded evidence |
| Demonstrations published | 0 | 1 | Live at a shareable URL after operator approval |
| Fabricated content in published demonstration | — | 0 | Operator review against sources before approval |
| Approved outreach sent | 0 | 1 | Recorded in the prospect record |
| Trackable opportunity with a next action | 0 | 1 | Prospect record contains status and next follow-up |

## 6. Constraints

- Budget: to be defined.
- Target date or window: to be defined.
- Required or prohibited technologies: to be defined. Prohibited: any reuse from a previous HORUS version.
- Privacy, security, or compliance: only publicly available business information may be collected. Terms of use of any data source must be respected. Outreach must comply with United States and Connecticut commercial-email rules, the target jurisdiction being Fairfield County (DEC-026).
- External dependencies: data sources, hosting for published demonstrations, and email sending — all to be defined.

## 7. Initial risks

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Data retrieval budget is exhausted before a client is acquired | High | Medium | Free tier allows ~3 searches monthly; filter on free listing data first, keep `MAX_EXAMINED` modest (section 13.3, DEC-019) |
| Per-search credit estimate proves wrong in practice | Medium | Medium | Estimate is derived from documentation, not measured; verify on the first real run before committing to a plan |
| Scoring thresholds are uncalibrated guesses | High | Medium | `reputation-scoring-v1` is provisional; calibrate against 30–50 representative businesses before relying on it (DEC-007) |
| Web-presence criteria remain subjective | High | High | Define explicit, testable criteria before Phase 1 exits |
| Public data sources are unavailable, restricted, or costly | High | High | Confirm sources and their terms during Phase 0 |
| Generated demonstration contains unsupported claims | Medium | High | Source-traceability requirement plus blocking operator review (DEC-005, DEC-004) |
| Outreach damages HORUS's reputation with its first prospects | Medium | High | Blocking approval gate before sending; small volume in V1 |
| Ambiguous scope | Medium | High | Approve this document before implementation |
| Scope drift toward a customer-facing product | Medium | Medium | DEC-003; any change requires a superseding decision |

## 8. Questions blocking development

**None. All questions that blocked development are closed.**

| Question | Closed by |
| --- | --- |
| Which web-presence situation is the better prospect? | DEC-033 — poor site > social-only > no site, provisionally |
| How is commercial ineffectiveness measured? | DEC-034 — Factor 5 of `web-opportunity-v2` |
| What budget is available for data retrieval? | DEC-032 — free tier, defaults lowered |

### 8.1 Home base — set

The home base was configured on 2026-08-05 in Stamford, Connecticut. Proximity can now be computed (DEC-016, DEC-017).

**The address itself is not recorded in this repository.** It lives in `config/local.json`, which is excluded from version control (DEC-035). It is the operator's residential address, and a repository that may later be pushed to a hosting service is the wrong place for it. Documentation refers to the home base; only the local configuration knows where it is.

### 8.2 What remains open is calibration, not definition

Every threshold in sections 9 through 12 was reasoned from principle. None has met a real business. These are not blockers to starting Phase 1 — they are what Phase 1 exists to resolve:

- The 70-point reputation threshold, the 400-review saturation point, and Factor 4's full-credit floor.
- `NO_SITE_BASE` at 50 and `SOCIAL_ONLY_BASE` at 60 — a reasoned ordering, not an observed one.
- The 5 / 15 / 30-mile proximity bands.
- Whether proximity-first ranking costs more in response rate than it gains in convenience.
- The ~48-credit per-search estimate.
- Detection rules for franchise ownership and centralized marketing.
- Whether a city search follows administrative or metropolitan boundaries.

## 9. Qualification criteria — reputation

Model version: **`reputation-scoring-v1`**. Provisional baseline, not validated truth. All thresholds and curve parameters are configurable and must be calibrated against 30–50 representative businesses before being relied upon (DEC-007).

Source: **Google reviews only**, so every prospect is measured against one consistent basis (DEC-006).

A business is **reputation-qualified** when it passes every gate, has no auto-reject condition, and scores **≥ 70/100**.

### 9.1 Minimum gates

All must pass:

| # | Gate |
| --- | --- |
| G1 | Average rating ≥ 4.5 |
| G2 | At least 25 reviews |
| G3 | At least 3 reviews in the last 90 days **or** 10 in the last 12 months |
| G4 | No serious recurring complaint pattern |
| G5 | The business appears active and operational |
| G6 | The reviews belong to the actual business and location |

Thresholds are configurable and should eventually be set per category and market — an Orlando roofer compared against Orlando roofers, not against every local business.

### 9.2 Scoring factors

Scoring uses source values at full available precision; only final displayed points are rounded.

**Factor 1 — Average rating (35 pts)**

Input: the listing's published average across its entire review history, at the precision Google publishes. Never computed from a retrieved sample, and never given manufactured decimal places.

```
4.50 ≤ r ≤ 4.90  →  14 + 21 × (r − 4.50) / 0.40
r > 4.90         →  35
```

Floor 14 at the gate minimum. Plateau above 4.90: differences there are noise, and a lightly reviewed 5.00 must not gain a rating advantage — confidence in the rating is Factor 2's job.

**Factor 2 — Review volume (25 pts)**

Input: total published review count on the listing, not the number of reviews retrieved.

```
25 ≤ n ≤ 400  →  25 × ln(n / 25) / ln(16)
n > 400       →  25
```

Floor 0. Each doubling of review count is worth 6.25 points. Saturation at 400, beyond which volume measures business size rather than confidence in the rating.

**Factor 3 — Review recency (20 pts)**

Inputs: `r365` (reviews in trailing 365 days) and `days_since_latest`, both computed against the stored retrieval timestamp rather than the current clock.

Sustained activity (14 pts):

```
r365 ≤ 10       →  0
10 < r365 ≤ 40  →  14 × ln(r365 / 10) / ln(4)
r365 > 40       →  14
```

Freshness (6 pts):

```
d ≤ 30        →  6
30 < d ≤ 90   →  6 − 3 × (d − 30) / 60
90 < d ≤ 180  →  3 − 3 × (d − 90) / 90
d > 180       →  0
```

**Factor 4 — Recent consistency (15 pts)**

Input: `delta` = (mean rating of trailing-365-day reviews) − (lifetime published average). Requires at least 5 reviews in the window.

```
delta ≥ 0              →  15
−0.30 < delta < 0      →  15 − 7.5 × (|delta| / 0.30)
−0.60 ≤ delta ≤ −0.30  →  7.5 − 7.5 × ((|delta| − 0.30) / 0.30)
delta < −0.60          →  0, plus operator flag `reputation_decline`
```

If the trailing-year mean is below 4.5 in absolute terms, raise `recent_rating_below_gate` regardless of delta.

**Factor 5 — Longevity evidence (5 pts)**

Input: `history_span_years`, from earliest retrievable review to retrieval timestamp. Self-reported "years in business" is never scored; it may be stored as context only.

```
span < 1 yr       →  0
1 ≤ span ≤ 5 yrs  →  5 × (span − 1) / 4
span > 5 yrs      →  5
```

### 9.3 Calibration reference

| Profile | F1 | F2 | F3 | F4 | F5 | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Absolute floor (declining, consistency unverified) | 14.0 | 0.0 | 0.0 | 0.0 | 0.0 | **14.0** |
| Realistic gate minimum (steady, 10 rev/yr, stale) | 14.0 | 0.0 | 0.0 | 15.0 | 0.0 | **29.0** |
| 4.5 · 30 rev · 12/yr · steady · 2 yr | 14.0 | 1.6 | 7.8 | 15.0 | 1.3 | **39.7** |
| 4.7 · 85 rev · 22/yr · −0.1 · 6 yr | 24.5 | 11.0 | 14.0 | 12.5 | 5.0 | **67.0** |
| 4.7 · 120 rev · 30/yr · steady · 6 yr | 24.5 | 14.1 | 17.1 | 15.0 | 5.0 | **75.7** |
| 4.8 · 220 rev · 45/yr · steady · 8 yr | 29.8 | 19.6 | 20.0 | 15.0 | 5.0 | **89.4** |

The 70 threshold lands near "4.7 stars, 110+ reviews, steady recent activity, no decline." The 4.7 · 85-review row is the boundary case calibration should interrogate.

Note that Factor 4 awards its full 15 points for merely holding steady, so a bare gate-passer scores 29 rather than 14. This is the largest single contributor to the floor and the first parameter to revisit if calibration shows the threshold is too easy to reach.

### 9.4 Auto-reject conditions

Objective, verifiable, reproducible. These exclude a business without operator involvement. Every rejection must be explained with the evidence that triggered it.

- Average rating below the G1 threshold.
- Review count below the G2 threshold.
- Review-recency requirement (G3) not met on complete data.
- Listing is closed or marked permanently closed.
- Listing is a duplicate of another listing.
- Business is outside the target market or geographic area.
- Wrong location for the intended prospect.
- `insufficient_data`: required data absent or unparseable — no rating, no review count, or no review timestamps. Recorded as re-checkable, never scored as poor performance.

### 9.5 Operator flags

Contextual signals requiring human judgment. **An operator flag never causes automatic rejection.** HORUS surfaces the flag and its evidence; the operator makes and records the final decision (DEC-008).

- Recurring serious complaints — fraud, unfinished work, unsafe work, aggressive behavior, failure to honor warranties.
- Suspected review manipulation — suspicious bursts, repetitive language, questionable reviewer profiles.
- `reputation_decline` — recent ratings materially below historical.
- `recent_rating_below_gate` — trailing-year mean under 4.5.
- Franchise ownership, large regional operator, or centralized marketing.
- Signs the business is overwhelmed or unreliable.
- Reputational risk to HORUS.
- `volume_anomaly` — review count inconsistent with visible history.
- `consistency_unverified` — fewer than 5 recent reviews.
- `longevity_unknown` — no earliest-review date available.
- Recently renamed listing.

### 9.6 Missing-data principle

**A sample can prove presence, never absence.**

Where only partial review data is retrievable: if the sample already contains enough recent reviews to pass a gate, the gate passes. If it does not, HORUS must not conclude the reviews are missing — the result is `insufficient_data`, re-checkable, never a rejection for inactivity. Scores computed on partial data carry a `partial_data` marker and are treated as a lower bound. Relative timestamps ("3 months ago") are bucketed conservatively and marked `imprecise_dates`.

### 9.7 Evidence retention

Every run must store enough to reproduce its own result as a historical snapshot:

- The scoring model version (`reputation-scoring-v1`) and the configuration values used.
- The listing identifier or source reference.
- The retrieval timestamp — all time-based factors are computed against it, never against the current clock.
- Source values at published precision, unrounded.
- Per-factor points and the inputs that produced them.
- Every auto-reject reason and every operator flag, each with its supporting evidence.
- For flagged prospects, the operator's decision and rationale.

## 10. Qualification criteria — web opportunity

Model version: **`web-opportunity-v2`**. Provisional baseline, not validated truth (DEC-011, DEC-034).

Web presence **scores, it does not filter** (DEC-009). No business is excluded for having a website, for lacking one, or for existing only on social platforms. This model measures how much opportunity a prospect represents, and orders the shortlist.

Score range 0–100. Higher means more opportunity — that is, a weaker current web presence.

### 10.1 The three situations

| Situation | Definition | Score |
| --- | --- | --- |
| No website | No site reachable from the Google listing or from search | `NO_SITE_BASE` — provisional **50** |
| Social-only | Presence limited to social profiles or a Google Business profile; no independent site | `SOCIAL_ONLY_BASE` — provisional **60** |
| Website exists | An independent site is reachable | Sum of the five factors in 10.2 |

**Ordering: a poor website outranks a social-only presence, which outranks no website at all** (DEC-033).

The reasoning is commercial rather than technical. A business with a bad site has already decided that having a website matters and has spent money proving it — the conversation is "what you have is working against you," and the existing site supplies the services, positioning, and tone needed to build the demonstration. A business with nothing requires selling the idea of a website first, which is a longer conversation with less material to work from. Social-only sits between: they have demonstrated they value being findable, but have not yet invested in a site of their own.

The constants place a genuinely broken site (above 60) ahead of both, and a merely dated but functional site (typically under 20) behind both — correctly, since that business has little to gain and is a poor prospect regardless of ordering philosophy.

This ordering is **provisional and unvalidated**. It is a reasoned position, not an observed one, and is the first thing the first real sales conversations should test.

### 10.2 Factors when a website exists

**Factor 1 — Mobile responsiveness (30 pts)**

The heaviest factor: local businesses are searched from phones, and a site that fails there is effectively absent.

| Condition | Points |
| --- | --- |
| Not responsive — no viewport meta tag, fixed-width layout, or horizontal scrolling at a 375px viewport | 30 |
| Responsive but defective — tap targets below 44px, body text below 12px, or the phone number is not a tappable `tel:` link | 13 |
| Fully responsive with no defects | 0 |

**Factor 2 — Obsolete appearance (20 pts)**

A single grouped signal, deliberately not three separate ones (DEC-010). Indicators:

- Four or more distinct font families.
- Six or more distinct non-neutral colours.
- Placeholder or demo content — *lorem ipsum*, unedited theme default strings.
- Stock imagery in place of the business's own work.
- Footer copyright year three or more years old, or absent.
- No HTTPS.
- Obsolete technology markers in the page source.

Scored by how many indicators are present, with diminishing returns:

```
0 indicators → 0    1 → 6    2 → 11    3 → 15    4 → 18    5 or more → 20
```

No single indicator is conclusive. HORUS must report which indicators it found as evidence, never the score alone.

**Factor 3 — Broken elements (18 pts)**

```
Any broken contact path — a form that fails, a dead tel: or mailto: link,
or a non-functional contact button                                → 18
Otherwise: 18 × min(broken_link_ratio / 0.20, 1)
```

A broken contact path scores maximum regardless of ratio: a site the customer cannot act on has failed at the only thing that matters commercially. Detecting non-functional buttons requires actually executing the page, not only parsing its source — the most expensive check in this model.

**Factor 4 — Load performance (12 pts)**

Input: time to interactive, measured on a throttled mobile profile. The profile must be fixed and recorded, since the number is meaningless without it.

```
t ≤ 2.5s        → 0
2.5s < t ≤ 8s   → 12 × (t − 2.5) / 5.5
t > 8s          → 12
```

Measured through PageSpeed Insights using the Lighthouse mobile profile, which serves as the fixed profile this factor requires (DEC-012). PageSpeed Insights also supplies measured inputs to Factor 1 — viewport tag, tap-target size, legible font size, horizontal scrolling — and the HTTPS indicator of Factor 2. It does not cover Factors 3 and 5, or the remaining Factor 2 indicators.

**Factor 5 — Commercial ineffectiveness (20 pts)**

Factors 1 through 4 all detect a site that is *broken*. None detects a site that works perfectly and still fails to sell. This factor closes that gap (DEC-034).

Indicators:

- No services or offerings listed anywhere on the site.
- No visible call to action — nothing asking the visitor to call, book, or get a quote.
- No phone number or contact route reachable from the main page.
- No photographs of the business's own work.
- No service area or location stated.
- No business hours.

Scored on the same concave curve as Factor 2:

```
0 indicators → 0    1 → 6    2 → 11    3 → 15    4 → 18    5 or more → 20
```

These are absences, which makes them cheaper to detect than most defects but easier to get wrong — content may exist somewhere HORUS did not look. Any indicator recorded here must name where HORUS searched, and a business scoring high on this factor alone is surfaced as an operator flag rather than trusted outright.

### 10.3 Reference profiles

| Profile | F1 | F2 | F3 | F4 | F5 | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Modern, fast, responsive, complete | 0 | 0 | 0 | 0 | 0 | **0** |
| Responsive, slightly dated, 4s load, one gap | 0 | 6 | 0 | 3.3 | 6 | **15.3** |
| Responsive but defective, dated, 6s, three gaps | 13 | 15 | 0 | 7.6 | 15 | **50.6** |
| Not responsive, dated, broken contact, 9s, no content | 30 | 20 | 18 | 12 | 20 | **100** |

### 10.4 Missing-data behavior

The presence principle from section 9.6 applies here too: **a failed check proves nothing about the site.**

- **Site unreachable at the time of retrieval:** recorded as `insufficient_data`, re-checkable. It is *not* scored as a broken site, and *not* treated as "no website" — a temporary outage must never be presented to a business owner as evidence their site is broken.
- **Crawling restricted by the site's own rules:** those rules are respected. The factors that cannot be evaluated are recorded as unmeasured, and the score is marked `partial_data` and treated as a lower bound.
- **Any factor unmeasurable:** it contributes 0 and is marked unmeasured. Absence of measurement is never evidence of a defect.

### 10.5 Evidence retention

As in section 9.7, and additionally: the model version and configuration constants used, the exact URL evaluated, the retrieval timestamp, the mobile profile used for Factor 4, and the specific indicators found for Factor 2. Any claim that reaches an outreach message must be traceable to one of these observations (DEC-005).

## 11. Shortlist ranking

Three dimensions with distinct roles, never blended into a single composite number (DEC-017).

| Dimension | Role |
| --- | --- |
| Reputation (section 9) | **Qualifies.** A business must pass every gate, carry no auto-reject condition, and score ≥ 70 to appear on the shortlist at all. |
| Proximity (11.1) | **Ranks first.** A nearer travel band always outranks a farther one. |
| Web opportunity (section 10) | **Ranks within a band.** Among equally reachable businesses, higher web opportunity ranks higher. |
| Reputation, again | **Breaks ties** in web opportunity, and nothing more. |

The reasoning has two parts. Proximity comes first because the operator intends to follow up in person, and a business that can be visited is worth more than an equivalent one that cannot. Web opportunity comes next because a reputation-qualified business is already good enough to approach — further reputation advantage beyond that bar does not make it a better prospect than one with more value to gain.

### 11.1 Proximity bands

Distance is measured from a **home base the operator configures and HORUS stores**, never from a location detected at run time (DEC-016). Automatic detection may be offered once as a convenience when setting the base; it is never the live source of truth, because the same search run from different networks would otherwise produce different results.

Provisional bands, configurable:

| Band | Driving distance from home base |
| --- | --- |
| 1 | ≤ 5 miles |
| 2 | 5–15 miles |
| 3 | 15–30 miles |
| 4 | > 30 miles |

Distances are expressed in miles because the target market is in the United States (DEC-026). For reference, Stamford and Norwalk are roughly 14 miles apart, so a home base in either places most of the other's businesses in band 2.

Bands exist so that proximity takes precedence without ordering by exact distance — a business a few hundred yards closer should not outrank one with far greater opportunity. Boundaries are provisional and expected to change once real travel experience exists.

**A calibration question to carry into the first runs.** Proximity ranks every prospect, but its payoff is conditional: a visit only happens after a prospect shows interest (DEC-030). Web opportunity, by contrast, affects whether they respond at all — a business with a catastrophic site has more reason to reply than one with an adequate one. Ranking proximity first may therefore cost response rate in exchange for convenience that is collected only occasionally. Whether that trade is worth it cannot be settled in the abstract; it should be watched across the first real searches.

Worked example — all three businesses qualify on reputation:

| | Reputation | Web opportunity | Distance | Band | Rank |
| --- | --- | --- | --- | --- | --- |
| Business A | 88 | 20 | 3 mi | 1 | 2nd |
| Business B | 72 | 95 | 24 mi | 3 | 3rd |
| Business C | 75 | 60 | 4 mi | 1 | **1st** |

C wins on web opportunity within band 1. B has the largest opportunity of the three and still ranks last, because it is the only one outside comfortable visiting range.

All three scores remain visible with their supporting evidence at all times. The operator sees why a business qualified, how far away it is, and why it ranks where it does — never a single opaque number.

## 12. Search scope and stopping rules

A search continues until it has collected enough qualified prospects, bounded by a ceiling the operator controls (DEC-014).

### 12.1 Operator parameters

| Parameter | Meaning | Provisional default |
| --- | --- | --- |
| `CATEGORY` | The business category to search | — |
| `CITY` | The geographic area, expressed as a city name | — |
| `TARGET_QUALIFIED` | How many qualified prospects the search aims to collect | 5 |
| `MAX_EXAMINED` | Hard ceiling on how many businesses may be examined | 60 |

The area is expressed as a **city name** — the way the operator actually thinks about a market (DEC-015). This carries two consequences that must be handled rather than ignored:

- **City names are not unique.** The city must be resolved together with its state or region before searching, and the resolved location recorded with the run.
- **City boundaries are fuzzy in practice.** A business in an adjacent suburb may serve the same market while falling outside the municipal boundary. Whether the search follows administrative limits or a broader metropolitan interpretation is undecided, and the choice must be recorded with each run so results stay comparable.

`TARGET_QUALIFIED` and `MAX_EXAMINED` are set per search. The run stops at whichever limit is reached first, and **always reports which one ended it** — a search that stopped at the target and one that hit the ceiling mean very different things about the market, and the operator must never have to guess which happened.

### 12.2 Standards are never relaxed to fill the quota

If `MAX_EXAMINED` is reached before `TARGET_QUALIFIED` is met, HORUS returns fewer prospects. It does not lower a gate, reduce the 70-point threshold, or promote a flagged business to make up the number.

A short list of genuinely qualified businesses is a useful result. A full list padded with businesses that did not qualify is worse than useless, because it destroys the meaning of qualification and sends the operator into a sales conversation without the evidence to support it.

### 12.3 Evaluation order

Businesses are evaluated cheapest-first, and expensive checks run only on those that survive:

1. Retrieve candidates for the category and city.
2. Apply gates G1 and G2 from listing-level data — rating and review count arrive free with the candidate result.
3. Retrieve review history only for survivors, newest first, stopping at the 365-day boundary (section 13.2).
4. Apply the remaining gates and auto-rejects, then score reputation (section 9). Discard anything below 70.
5. **Only then** run web analysis (section 10) on the reputation-qualified set, including the PageSpeed Insights call.
6. Group by proximity band and rank (section 11).

Each stage is more expensive than the last, so each runs on a smaller set. Review retrieval costs API credits per business; web analysis costs an external call and page execution per business. Filtering on free listing data first is what makes a search affordable.

### 12.4 Run record

Every search records: both parameter values, which limit ended the run, how many businesses were examined, how many passed the gates, how many were auto-rejected and why, how many carry operator flags, and the model versions used for both scores.

This makes a disappointing search diagnosable. "Only three qualified out of a hundred examined" tells the operator something real about the market or the thresholds — and is the raw material for the calibration required by DEC-007 and DEC-011.

## 13. Data sources and cost model

### 13.1 Sources

| Purpose | Source | Notes |
| --- | --- | --- |
| Candidate discovery | SerpApi — Google Maps API | Returns local businesses for a category and city, with `data_id` / `place_id`, rating, and review count |
| Review history | SerpApi — Google Maps Reviews API | Returns individual reviews with `iso_date` timestamps |
| Site performance | PageSpeed Insights | Lighthouse mobile profile (DEC-012) |
| Site content and structure | HORUS's own analysis | Factor 3 and most Factor 2 indicators |

Verified 2026-08-05 against SerpApi's published documentation.

### 13.2 Why this closes the largest open risk

Sections 9.2 and 9.6 depend on individual review timestamps, which listing aggregates do not provide. The Google Maps Reviews API supplies them: each review carries an `iso_date`, and `sort_by=newestFirst` returns reviews in reverse chronological order.

That ordering matters for cost as much as for correctness. HORUS can paginate from the newest review and **stop as soon as it crosses the 365-day boundary** — everything Factors 3 and 4 need lies inside that window. The full history never has to be retrieved.

### 13.3 Cost model

SerpApi bills one credit per successful request, regardless of how many results it returns.

| Plan | Searches / month | Cost |
| --- | --- | --- |
| Free | 250 | $0 |
| Starter | 1,000 | $25 |
| Developer | 5,000 | $75 |
| Production | 15,000 | $150 |

Reviews are returned up to 20 per page (default 10; the first page always returns 8), paginated with `next_page_token`.

Estimated cost of one search examining 60 candidates:

| Stage | Credits |
| --- | --- |
| Candidate discovery, 20 per page | ~3 |
| Review retrieval — only for businesses passing G1 and G2, roughly 2–4 pages each | ~45 |
| **Total** | **~48** |

This is an estimate built from the documented page sizes, not a measurement. It must be verified against the first real run.

**V1 runs on the free tier** (DEC-032). Caching changed the arithmetic: calibrating 30–50 businesses costs roughly 100–155 credits once, and every rescoring afterwards is free (DEC-020). That fits inside a single month's 250-credit allowance, so Phase 1 needs no paid plan.

The defaults were lowered accordingly — `TARGET_QUALIFIED` from 10 to 5, `MAX_EXAMINED` from 100 to 60. Five prospects give real choice for a project that needs one client. The budget is revisited only when continuous prospecting begins, which is outside V1's scope.

### 13.4 Cost discipline

Two rules keep a search affordable, and they follow from the evaluation order in 12.3:

**Gates G1 and G2 cost nothing extra.** Average rating and review count arrive with the Maps candidate listing. Any business below 4.5 stars or 25 reviews is discarded before a single review-retrieval credit is spent. On a typical category this removes most candidates.

**Factor 5 is not worth its price.** Longevity requires the *oldest* review, which means paginating the entire history — the most expensive retrieval in the model, for the factor worth the fewest points. HORUS records `longevity_unknown` and scores 0 rather than paying for it, unless the earliest review happens to fall inside data already retrieved. A 5-point factor must never cost more than the 20-point one.

## 14. Storage and caching

Every response retrieved from an external source is stored locally on first retrieval and reused thereafter (DEC-020). No technology is selected here; this section states requirements only.

### 14.1 What is stored

| Layer | Content | Mutable |
| --- | --- | --- |
| Raw responses | Exactly what each source returned, verbatim, with the request that produced it and its retrieval timestamp | Never |
| Derived scores | Reputation, web opportunity, proximity, plus per-factor points and the inputs behind them | Recomputable |
| Prospect record | Selected prospect, published demonstration, outreach activity, status, next follow-up action, operator decisions on flags | Appended to |

Raw responses are never edited or overwritten. A later retrieval for the same business creates a new snapshot alongside the old one, so the history of what a source said and when remains intact.

### 14.2 Why this matters more than convenience

**It makes calibration affordable.** DEC-007 and DEC-011 require testing the scoring models against 30–50 businesses, which appeared to need a paid plan (DEC-019). But scores are *derived* from raw responses. Once a business's reviews are cached, any number of model versions can be scored against them at zero additional credit cost. Calibration becomes a computation over stored data rather than a new round of retrieval.

**It makes evidence real.** Section 9.7 requires that a run be reproducible as a historical snapshot. Storing the raw response is what makes that literally true — the evidence shown to justify a claim in an outreach message is the exact data the source returned, not a summary of it.

**It protects the credit budget.** A re-run, a retry after an error, or a second look at the same city costs nothing for businesses already retrieved.

### 14.3 Requirements

- **Single operator, local.** One user, on one laptop. No multi-user access, no sharing, no synchronization (DEC-003).
- **Inspectable by the operator directly**, without going through HORUS.
- **Survives restarts and code changes.** The stored data outlives any version of the software that wrote it.
- **Records provenance for every stored item:** source, request, retrieval timestamp, and the model version used for anything derived.
- **Separates the immutable from the derived**, so rescoring never risks corrupting the underlying evidence.

### 14.4 Freshness

Cached reputation data ages. A business's rating, review count, and recent activity change, and a demonstration or an outreach message built on stale data could state something no longer true — which DEC-005 forbids.

**Maximum age before contact: 30 days** (DEC-021).

The rule is enforced at the two approval gates of DEC-004, not at search time:

| Stage | Freshness required |
| --- | --- |
| Browsing and ranking the shortlist | None. Cached data of any age may be used to explore a market. |
| Before a demonstration is published | Data must be ≤ 30 days old, or refreshed first. |
| Before an outreach message is sent | Data must be ≤ 30 days old, or refreshed first. |

Enforcing freshness at the gates rather than at search time is deliberate. Refreshing costs credits, and only one prospect out of a shortlist is ever pursued. Refreshing all of them would multiply the cost of a search for data the operator will never use.

If data has aged past 30 days when the operator selects a prospect, HORUS refreshes that business before proceeding and shows what changed. A rating that has dropped or a recent complaint that has appeared is exactly the information the operator needs *before* making contact, not after.

Any figure that appears in a demonstration or an outreach message carries the retrieval date of the data behind it in the stored evidence, so a claim can always be traced to the moment it was true.

## 15. Demonstration publication

### 15.1 Deployment

Provisional V1 deployment is **Cloudflare Pages** (DEC-022).

```
https://horus-demos.pages.dev/{prospect-slug}
```

The free `pages.dev` subdomain is used rather than the operator's personal domain `javiernapoles.com`. Two reasons: a demonstration sent to a business that did not request it should not be tied to the operator's personal identity, and no domain purchase is required yet.

A HORUS domain is expected to be acquired later and attached to the same Cloudflare Pages project. The `pages.dev` address continues to work when a custom domain is added, so demonstrations already sent do not break. This is what makes the decision cheap to reverse.

Vercel is documented as a possible future alternative only. It is not an active option.

### 15.2 What a demonstration is

A **real, responsive, navigable website** — not a screenshot and not a static mockup (DEC-023). The prospect must be able to open it on a phone or a computer and experience what an improved site would look and feel like.

**May include:** responsive pages or sections, navigation, verified business information, click-to-call and email links, calls to action, representative visual styling and content.

**Must not include:** authentication, payments, appointment management, a CMS, or any backend. These are production systems, not demonstration material.

**Forms** must not collect or transmit real customer information unless the operator explicitly authorizes and configures that capability. Where a form appears, it is shown visibly disabled with a note that it activates on engagement. A form that silently does nothing is a defect the prospect will find, in exactly the area the demonstration is meant to sell.

### 15.3 Mandatory requirements

Every published demonstration must (DEC-024):

- Use verified public information, or clearly identified placeholders.
- Contain no unsupported claims, services, credentials, or testimonials (DEC-005).
- Display a visible notice that it is a HORUS concept demonstration and not the business's official website.
- Carry `noindex` protection.
- Have received the operator's explicit approval before publication (DEC-004).
- Be recorded with its prospect, URL, publication date, and status.
- Be removable or disableable by the operator at any time.

### 15.4 Image sourcing

Images in a demonstration are either:

- **The business's own public photographs**, from its Google listing or its existing site, or
- **Clearly generic and labelled as placeholder**.

Generic imagery presented as the business's own work is prohibited. A stock photograph of a finished roof on a roofer's demonstration asserts that the roofer did that work — an unsupported claim under DEC-005, whether or not any words accompany it.

This rule also protects HORUS from its own argument: stock imagery is one of the seven indicators by which section 10 penalizes an inadequate website. A demonstration that uses it undermines the case it exists to make (DEC-025).

### 15.5 Lifetime

At **60 days** from publication without a response, HORUS notifies the operator that the demonstration has been live for two months and **asks whether to remove it**. The operator decides. Nothing is taken down automatically (DEC-031).

Where a prospect has engaged, the demonstration is not subject to this prompt and stays live for as long as the conversation is active.

Keeping removal in the operator's hands is consistent with DEC-008: HORUS surfaces the situation with its evidence, the operator judges it. The cost is real — an ignored prompt leaves a page public with ageing data, which is exactly the risk this rule exists to address. Two mitigations:

- The prompt **repeats** rather than firing once and disappearing.
- The tracker shows the demonstration in an explicit **"expired, awaiting decision"** state, so it never looks current while the question sits unanswered.

When a demonstration is removed, the URL serves a **neutral unavailable page that does not name the business**. A page announcing that a specific company's demonstration has been withdrawn would itself be a public statement about them, which is not HORUS's to make.

### 15.6 Record

Each demonstration records: the prospect, **the URL as it was actually sent**, the publication date, the current status, the removal date and reason if applicable, the data retrieval dates behind any figure it displays (DEC-021), and the operator's approval.

The sent URL is recorded rather than the current one because the deployment domain is expected to change. A prospect contacted before a HORUS domain exists received a `pages.dev` link, and the record must reflect what that person actually saw.

## 16. Market and language

### 16.1 Target market

The first real searches are **Stamford** and **Norwalk, Connecticut** (DEC-026). Both are in Fairfield County, roughly 14 miles apart.

This is the market against which every provisional threshold should first be calibrated. Review culture, business density, and typical review volumes vary by market, and every number in sections 9, 10, and 12 was reasoned in the abstract. Fairfield County is where they meet reality.

### 16.2 Language

**English is the default for all demonstrations and outreach** (DEC-027).

Spanish is used only where there is positive, recorded evidence that the business operates in Spanish. Acceptable evidence, in order of strength:

1. **The owner's own replies to reviews are predominantly in Spanish.** The strongest signal, because it is the owner's own writing in their own public voice.
2. **The business's existing website or Google listing description is in Spanish.**
3. **A clear majority of its reviews are in Spanish.** Weakest of the three: it describes the customers, not the owner.

A Spanish business name alone is **not** evidence. Names persist through generations and say nothing about how the owner prefers to be addressed.

Where evidence is absent or mixed, HORUS uses English. Writing to someone in Spanish on the assumption they prefer it — when their entire public presence is in English — risks reading as presumptuous in a first contact, and a cold outreach message has no margin for that.

Language selection is surfaced to the operator with its supporting evidence at the outreach approval gate (DEC-004), where it can be overridden. HORUS proposes; the operator decides.

## 17. Outreach delivery

### 17.1 HORUS drafts; the operator sends

HORUS creates the outreach message as a **draft in the operator's Gmail account** and marks it in its own interface as pending send. The operator opens the draft, reviews it, and sends it personally (DEC-028).

HORUS never sends.

### 17.2 The permission enforces the gate

HORUS requests the Gmail scope that allows **creating drafts only**, not sending. The approval gate of DEC-004 therefore stops being a rule the software is asked to respect and becomes something it is technically incapable of violating. A bug, a bad prompt, or a future change of intent cannot cause an unapproved message to reach a business owner, because the credential does not permit it.

This is the strongest available form of the guarantee, and it is preferred over any policy-level enforcement.

### 17.3 "Sent" is operator-declared, not observed

Because the operator sends from Gmail directly, HORUS cannot observe that it happened. The prospect record marks send status as **declared by the operator**, never as verified.

This distinction is recorded in the data, not merely in the interface. A status HORUS observed and a status the operator asserted have different evidential weight, and the record must not blur them.

Automatic verification would require read access to the mailbox — a broader permission than drafting. It is deliberately not requested in V1, and is noted as a possible later enhancement if the manual step proves unreliable.

## 18. Interface

HORUS V1 is an application with a visual interface and persistent visible state (DEC-029). It is not a command-line tool and not a script that prints results.

This follows from the workflow rather than from preference. A message pending send, a demonstration awaiting approval, a prospect with a next follow-up date — these are states that exist between sessions and must be visible when the operator returns.

Minimum views implied by the workflow of section 4:

| View | Purpose |
| --- | --- |
| Search | Set category, city, `TARGET_QUALIFIED`, `MAX_EXAMINED`; run and monitor |
| Shortlist | Ranked prospects with all three scores, proximity band, and evidence |
| Prospect detail | Full reputation and web-opportunity evidence, operator flags awaiting decision |
| Demonstration review | Preview, edit, approve or reject before publication |
| Outreach review | Read the drafted message, approve, mark as sent |
| Tracker | All prospects with status, published demonstration URL, next follow-up action, and logged follow-up activity including in-person visits (DEC-030) |

Single operator, single machine (DEC-003). No accounts, no roles, no sharing.

Visual identity, device priorities beyond the operator's laptop, and accessibility requirements remain undecided — see `DESIGN_REFERENCES.md`.

## Approval

- **Approval date:** 2026-08-05
- **Approved by:** Javier Napoles, founder of HORUS
- **First authorized phase:** Phase 1 — Calibration

All eighteen sections are complete and no question blocks development (section 8).

**Prerequisites before the first Phase 1 run:**

1. ~~Set the home base~~ — done, 2026-08-05. Stored in local configuration, not in this repository (section 8.1, DEC-035).
2. Obtain a SerpApi free-tier key. Required only to execute a retrieval, not to authorize the phase.

**What approval authorizes:** retrieving and scoring 30–50 real businesses in Stamford and Norwalk, and revising thresholds from what is observed. It does not authorize contacting anyone. No demonstration is published and no outreach is drafted during calibration — the first real prospect contact belongs to Phase 5 and requires its own authorization at both gates of DEC-004.
