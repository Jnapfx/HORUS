# Decision Log

This file serves as an index. Complex decisions may later be moved to individual documents without losing their identifiers.

## Convention

- Status: `proposed`, `accepted`, `superseded`, or `rejected`.
- An accepted decision is never edited to hide the past; add a new decision that supersedes it.
- Record only decisions with lasting consequences.

## Decisions

### DEC-001 — Independent repository

- Date: 2026-08-05
- Status: accepted
- Context: the previous implementation contains changes that should not be incorporated automatically into the new version.
- Decision: HORUS V1 will be developed in a clean, independent repository.
- Consequences: project history starts from scratch; any legacy material must be imported explicitly and reviewed.

### DEC-002 — Documentation before implementation

- Date: 2026-08-05
- Status: accepted
- Context: the project requires greater control, traceability, and clarity of scope.
- Decision: do not select an architecture or implement features until the minimum product definition is approved.
- Consequences: the initial phase focuses on answering the questions in `PROJECT_CHARTER.md`.

### DEC-003 — HORUS V1 is an internal operating tool

- Date: 2026-08-05
- Status: accepted
- Context: HORUS is the name of the company being founded. The first system built under that name could be read as either an internal tool or a future commercial product.
- Decision: HORUS V1 is an internal operating system used by the founder to acquire HORUS's first client. It is not a customer-facing product, and no design decision may assume it will become one.
- Consequences: single-user and single-operator assumptions are acceptable. Multi-tenancy, account onboarding, billing, and public-facing UX are out of scope. A change of direction requires a superseding decision.
- Supersedes: not applicable

### DEC-004 — Mandatory human approval gates

- Date: 2026-08-05
- Status: accepted
- Context: HORUS generates public artifacts and outbound messages that represent a real third-party business and reflect on HORUS itself.
- Options considered: fully automated pipeline; single approval before sending; two blocking gates.
- Decision: two blocking approval gates — one before a demonstration is published, one before an outreach message is sent. Neither can be bypassed.
- Consequences: there is no autonomous path to publication or sending. Any workflow or interface design must make both gates explicit and reviewable, and must support editing before approval.
- Supersedes: not applicable

### DEC-005 — No fabricated information in demonstrations

- Date: 2026-08-05
- Status: accepted
- Context: demonstration websites depict real businesses and are shown to those businesses' owners. Unsupported content would be both misleading and commercially damaging.
- Decision: only verified, publicly available information may appear in a demonstration. No invented services, credentials, claims, testimonials, pricing, or history.
- Consequences: every content element must be traceable to a source. Information gaps are left empty or handled with neutral placeholder content, never filled by inference or generation.
- Supersedes: not applicable

### DEC-006 — Google reviews as the sole reputation source for V1

- Date: 2026-08-05
- Status: accepted
- Context: reputation can be assembled from many sources — Google, Yelp, Facebook, industry directories, the business's own site. Mixing them makes prospects incomparable, because coverage and rating culture differ by platform.
- Options considered: multiple sources blended into one score; multiple sources scored separately; a single source.
- Decision: HORUS V1 evaluates reputation from Google reviews only, so every prospect is measured against the same basis.
- Consequences: businesses strong on other platforms but thin on Google may be missed. This is accepted for V1 in exchange for comparability. Adding a source later requires a superseding decision and a new scoring model version.
- Supersedes: not applicable

### DEC-007 — `reputation-scoring-v1` is provisional and requires calibration

- Date: 2026-08-05
- Status: accepted
- Context: the gates, weights, curve parameters, and the 70-point qualification threshold were reasoned from principle, not derived from observed data. The 400-review saturation point and the 70 threshold in particular are estimates.
- Decision: the model is adopted as a provisional V1 baseline under the version identifier `reputation-scoring-v1`. All thresholds and curve parameters are configurable. The model must be tested against approximately 30–50 representative businesses before its output is relied upon.
- Consequences: scoring output is treated as indicative until calibration. Every stored result records its model version and configuration so past runs remain interpretable after the model changes. Any parameter change produces a new version identifier rather than silently altering v1. Thresholds are expected to eventually vary by category and market.
- Supersedes: not applicable

### DEC-008 — Operator flags never cause automatic rejection

- Date: 2026-08-05
- Status: accepted
- Context: some disqualifying signals are objective and reproducible; others — manipulation, reputational risk, franchise ownership, being overwhelmed — require context and judgment. Automating the second group would make HORUS issue conclusions it cannot justify.
- Decision: rejection conditions are split. Auto-rejects are limited to objective, verifiable, reproducible conditions. All judgment-dependent signals are surfaced as operator flags. A flag never rejects a business on its own; the operator makes and records the final decision.
- Consequences: HORUS must explain every rejection and every flag with supporting evidence. The workflow requires a review surface for flagged prospects, and the operator's decision and rationale become part of the retained evidence.
- Supersedes: not applicable

### DEC-009 — Web presence scores, it does not filter

- Date: 2026-08-05
- Status: accepted
- Context: three web-presence situations occur among reputable local businesses — no website at all, a social-only presence such as a Facebook or Instagram page, and a real but poor website. It was unclear whether any of these should exclude a business from the shortlist.
- Options considered: require the absence of a website; exclude businesses with any functioning site; treat web presence as a scoring dimension.
- Decision: all three situations are eligible. Web presence contributes to a prospect's score and ranking, and never acts as a qualification gate.
- Consequences: the shortlist is ordered by opportunity rather than filtered by web presence. A web-presence scoring model is still required, and the relative priority between the three situations is deliberately left open (see charter section 8). Reputation criteria and `reputation-scoring-v1` are unaffected.
- Supersedes: not applicable

### DEC-010 — Obsolete appearance is one grouped signal

- Date: 2026-08-05
- Status: accepted
- Context: three appearance problems were identified — visual inconsistency, unpersonalized templates, and dated design. They overlap heavily: a generic 2012 template triggers all three simultaneously.
- Options considered: three independent scoring signals; one grouped signal with multiple indicators.
- Decision: they are scored as a single signal, "obsolete appearance," confirmed by a list of indicators. A site is not penalized three times for one underlying defect.
- Consequences: a business whose only weakness is a dated site cannot outrank one with several distinct problems through triple counting. HORUS must report which indicators it found, so the grouping does not reduce explainability. Excluded from scope: comparing the site against the Google profile for inconsistencies such as outdated services, phone, or address — considered and set aside.
- Supersedes: not applicable

### DEC-011 — `web-opportunity-v1` is provisional and encodes no situation ordering

- Date: 2026-08-05
- Status: superseded by DEC-033 and DEC-034
- Context: the web-opportunity model requires numeric values for businesses with no website and with social-only presence, but the relative priority between those situations and a poor website is deliberately undecided (DEC-009).
- Decision: the model is adopted as a provisional baseline under the version identifier `web-opportunity-v1`. `NO_SITE_BASE` and `SOCIAL_ONLY_BASE` are set equal, at a provisional 70, as an explicit placeholder that expresses no preference.
- Consequences: any ranking between the three presence situations produced by V1 is an artifact of placeholder values and must not be read as intentional. These two constants are where the section 8.1 question will be answered once real sales experience or calibration provides it. As with `reputation-scoring-v1`, every stored result records its model version and configuration, and parameter changes produce a new version identifier.
- Supersedes: not applicable

### DEC-012 — PageSpeed Insights as the measurement source for site performance

- Date: 2026-08-05
- Status: accepted
- Context: section 10.4 requires a fixed, recorded mobile profile for load timing, since the measurement is meaningless without one. Building that measurement capability from scratch would be costly and unauditable.
- Decision: PageSpeed Insights supplies Factor 4 in full, and serves as an auxiliary input to Factor 1. The Lighthouse mobile profile is the fixed profile section 10.4 requires.
- Consequences: performance measurement becomes reproducible and independently verifiable — a third party can re-run the same check on the same URL. Factor 1 gains measured inputs (viewport tag, tap-target size, legible font size, horizontal scrolling) in place of judgment, and Factor 2 gains the HTTPS indicator. Factor 3 and the remaining Factor 2 indicators are not covered and still require HORUS's own analysis. Two items require verification before Phase 1 exits: API usage limits, and the fact that field data is typically unavailable for small local businesses, leaving only lab measurements of simulated conditions.
- Supersedes: not applicable

### DEC-013 — Web opportunity ranks the shortlist; reputation qualifies it

- Date: 2026-08-05
- Status: superseded by DEC-017
- Context: reputation and web opportunity produce two independent scores. Where they disagree — an excellent business with an adequate site versus a good business with a catastrophic one — the shortlist needs a rule.
- Options considered: rank by reputation; rank by a weighted blend of both; rank by web opportunity.
- Decision: reputation acts as a qualification gate, and web opportunity determines the order. A business must be reputation-qualified to appear at all, and among qualified businesses the one with the weaker web presence ranks higher.
- Consequences: the two scores keep distinct roles rather than being blended into an uninterpretable number — reputation answers "is this business worth approaching," web opportunity answers "how much value can HORUS add." A reputation-qualified business is by definition already good enough, so further reputation advantage does not outrank a larger opportunity. The reputation score is retained and used only to break ties in web opportunity. Both scores remain visible with their evidence; neither is hidden behind a composite.
- Supersedes: not applicable

### DEC-014 — Search runs to a target, bounded by an operator-set ceiling

- Date: 2026-08-05
- Status: accepted
- Context: a category-and-area search can return hundreds of businesses. Web analysis costs an external API call and page execution per business, so examining all of them is not viable. A fixed cap risks missing good prospects; an unbounded search has unpredictable cost.
- Options considered: fixed cap on businesses examined; search until a target number of qualified prospects is found; both, under operator control.
- Decision: the search continues until it collects `TARGET_QUALIFIED` prospects, bounded by `MAX_EXAMINED`. Both are set by the operator per search. The run stops at whichever is reached first and reports which one ended it.
- Consequences: cost is bounded and predictable while completeness stays under operator control. If the ceiling is reached first, HORUS returns fewer prospects and never relaxes a gate or threshold to fill the quota. Evaluation runs cheapest-first — reputation gates and scoring from listing data, then web analysis only on reputation-qualified survivors. Every run records both parameters, which limit ended it, and the counts at each stage, so a disappointing search is diagnosable and the data feeds the calibration required by DEC-007 and DEC-011.
- Supersedes: not applicable

### DEC-015 — Geographic area is expressed as a city name

- Date: 2026-08-05
- Status: accepted
- Context: the search area could be expressed as a city name, a postal code, or a radius around a point. Each trades precision against how the operator actually reasons about a market.
- Options considered: city name; postal codes; radius around a coordinate.
- Decision: the operator supplies a city name. Postal codes are exact but do not match how a market is conceived; a radius is precise but forces an arbitrary centre point.
- Consequences: two problems must be handled rather than ignored. City names are not unique, so the city must be resolved with its state or region and the resolved location recorded with the run. City boundaries are also fuzzy in practice — a business in an adjacent suburb may serve the same market — so whether the search follows administrative limits or a broader metropolitan interpretation must be decided and recorded per run, or results will not be comparable across searches.
- Supersedes: not applicable

### DEC-016 — Proximity is measured from a stored home base, not from detected location

- Date: 2026-08-05
- Status: accepted
- Context: the operator wants to prioritize businesses close enough to visit in person. Location could be detected automatically at run time or configured once and stored.
- Options considered: automatic detection per run; a stored home base; a stored base with detection offered as an initial suggestion.
- Decision: proximity is measured from a home base the operator configures and HORUS stores. Automatic detection may be offered once as a convenience when setting it, never as the live source of truth.
- Consequences: results stay reproducible. Automatic detection is imprecise and varies with the network in use, so the same search run from home and from a café would produce different distances for the same businesses — breaking the snapshot reproducibility required throughout this project. The home base and the distance calculation method are recorded with every run.
- Supersedes: not applicable

### DEC-017 — Proximity bands rank first; web opportunity ranks within a band

- Date: 2026-08-05
- Status: accepted
- Context: the operator intends to follow up in person, so a nearby business is worth more than a distant one of equal quality. DEC-013 had web opportunity ranking the shortlist alone, with no notion of travel cost.
- Options considered: proximity shown as information only; strict ordering by exact distance; ordering by proximity bands with web opportunity ranking inside each band.
- Decision: qualified prospects are grouped into travel bands measured from the home base. A nearer band always outranks a farther one. Within a band, web opportunity determines the order, and reputation breaks ties.
- Consequences: proximity always takes precedence, as the operator requires, without the absurdity of exact-distance ordering — where a business 200 metres closer would outrank one with far greater opportunity. Band boundaries are provisional and configurable, and are expected to change once real travel experience exists. This introduces a third dimension to the shortlist; all three scores remain visible with their evidence.
- Supersedes: DEC-013

### DEC-018 — SerpApi supplies candidate discovery and review history

- Date: 2026-08-05
- Status: accepted
- Context: sections 9 through 12 assume a source that returns local businesses for a category and city together with their reputation data. The largest open risk in the project was that individual review timestamps — required by four of the five reputation factors — might not be obtainable, since listing aggregates alone do not provide them.
- Decision: SerpApi supplies both candidate discovery, through its Google Maps API, and review history, through its Google Maps Reviews API.
- Consequences: the review-history risk is closed. Each review carries an `iso_date`, and `sort_by=newestFirst` returns reviews in reverse chronological order, so HORUS can paginate from the newest and stop at the 365-day boundary rather than retrieving a full history. Two cost consequences follow and are recorded in charter section 13: gates G1 and G2 are checked from free listing data before any paid retrieval, and Factor 5 is left as `longevity_unknown` rather than paying full-history pagination for a 5-point factor. Verified against SerpApi's published documentation on 2026-08-05; the cost estimate is derived from documented page sizes and must be confirmed against a real run.
- Supersedes: not applicable

### DEC-019 — The free tier is accepted for the first real use only

- Date: 2026-08-05
- Status: accepted
- Context: SerpApi's free tier provides 250 searches per month. At the estimated ~80 credits per search with `MAX_EXAMINED` at 100, this allows roughly three searches monthly.
- Decision: V1 proceeds on the free tier. Its purpose is to acquire one qualified prospect, not to prospect continuously, and three searches are sufficient for that.
- Consequences: `MAX_EXAMINED` must stay modest, and the credit budget is a real constraint on how the workflow is designed — retries, re-runs, and calibration passes all consume the same allowance. Calibration against 30–50 businesses (DEC-007, DEC-011) will likely require a paid plan or must be spread over several months. Moving beyond the first client requires a budget decision, recorded as charter question 4.
- Supersedes: not applicable

### DEC-020 — External responses are cached locally and never re-fetched by default

- Date: 2026-08-05
- Status: accepted
- Context: SerpApi bills per request and the free tier allows roughly three searches per month (DEC-019). Re-running a search, retrying after an error, or revisiting a city would repeat the cost. Separately, section 9.7 requires that any run be reproducible as a historical snapshot.
- Decision: every external response is stored locally on first retrieval, verbatim, with the request that produced it and its retrieval timestamp. Subsequent work reads from that store. Raw responses are immutable; scores are derived and recomputable from them.
- Consequences: calibration becomes affordable — the 30–50 business test required by DEC-007 and DEC-011 can rescore cached data under any number of model versions at zero credit cost, which materially reduces the constraint recorded in DEC-019. Evidence becomes literal rather than summarized. Two obligations follow: the store must separate immutable raw data from derived scores so rescoring cannot corrupt evidence, and a staleness policy is required, since data cached long enough to age could produce claims that are no longer true and violate DEC-005. The staleness policy is undecided and recorded as charter question 6. No storage technology is selected by this decision.
- Supersedes: not applicable

### DEC-021 — Cached data may be at most 30 days old at the point of contact

- Date: 2026-08-05
- Status: accepted
- Context: DEC-020 caches external responses to protect the credit budget, but cached reputation data ages. Contacting a business with figures from months earlier risks stating something no longer true, which DEC-005 forbids.
- Options considered: refresh at search time; refresh before contact; no policy.
- Decision: data used in a published demonstration or a sent outreach message must be no more than 30 days old. The rule is enforced at the two approval gates of DEC-004, not at search time. Browsing and ranking a shortlist may use cached data of any age.
- Consequences: refreshing costs credits, and only one prospect from a shortlist is ever pursued, so enforcing at the gates avoids refreshing data the operator will never use. When a selected prospect's data has aged past 30 days, HORUS refreshes it and shows what changed before proceeding — a dropped rating or a new complaint is information the operator needs before making contact. Every figure appearing in a demonstration or outreach message carries the retrieval date of its underlying data in the stored evidence.
- Supersedes: not applicable

### DEC-022 — Cloudflare Pages on a free subdomain is the provisional V1 deployment

- Date: 2026-08-05
- Status: accepted
- Context: demonstrations must be published at a shareable URL. The operator owns `javiernapoles.com` with DNS already on Cloudflare, but does not want to purchase a HORUS domain yet.
- Options considered: a subdomain of the operator's personal domain; the free `pages.dev` subdomain; purchasing a HORUS domain now; Vercel.
- Decision: Cloudflare Pages, published at `https://horus-demos.pages.dev/{prospect-slug}`. The personal domain is not used. Vercel is documented as a possible future alternative only.
- Consequences: no cost and no DNS changes. A demonstration sent to a business that did not request it is not tied to the operator's personal identity — a consideration that outweighed the credibility advantage of an established domain. The trade-off is accepted: a free-hosting URL carries less weight in a cold outreach message and may attract more scrutiny from corporate spam filtering. Migration is cheap: a HORUS domain can later be attached to the same project, and the `pages.dev` address keeps working, so demonstrations already sent do not break. Because the domain is expected to change, each demonstration records the URL as it was actually sent, not merely the current one.
- Supersedes: not applicable

### DEC-023 — A demonstration is a real navigable website, not a mockup

- Date: 2026-08-05
- Status: accepted
- Context: the demonstration could be a visual mockup, faster to produce, or a working site, more persuasive but heavier to build.
- Decision: a real, responsive, navigable website the prospect can open on a phone or computer. It may include responsive pages or sections, navigation, verified business information, click-to-call and email links, calls to action, and representative styling and content. It must not include authentication, payments, appointment management, a CMS, or any backend.
- Consequences: the prospect experiences the improvement rather than being shown a picture of it. Forms must not collect or transmit real customer information without explicit operator authorization and configuration; where a form appears it is shown visibly disabled, since a form that silently does nothing is a defect the prospect will find in precisely the area the demonstration exists to sell.
- Supersedes: not applicable

### DEC-024 — Mandatory requirements for every published demonstration

- Date: 2026-08-05
- Status: accepted
- Context: a demonstration depicts a real business, is published publicly, and is sent to that business unsolicited. Several protections are required and must not be optional.
- Decision: every published demonstration uses verified public information or clearly identified placeholders; contains no unsupported claims, services, credentials, or testimonials; displays a visible notice that it is a HORUS concept demonstration and not the business's official website; carries `noindex`; has explicit operator approval before publication; records its prospect, URL, publication date, and status; and can be removed or disabled by the operator at any time.
- Consequences: these are conditions of publication, not features. A demonstration failing any of them must not go live. The notice and `noindex` together prevent the demonstration from being mistaken for, or competing with, the business's real web presence.
- Supersedes: not applicable

### DEC-025 — Demonstration images come from the business itself or are labelled placeholders

- Date: 2026-08-05
- Status: accepted
- Context: "representative visual styling and content" conflicts with DEC-005 where images are concerned. A stock photograph of finished work on a contractor's demonstration asserts that the contractor did that work, with or without accompanying words.
- Decision: images are either the business's own public photographs, taken from its Google listing or existing site, or clearly generic and labelled as placeholders. Generic imagery presented as the business's own work is prohibited.
- Consequences: some demonstrations will look sparser than a fully dressed template. This is accepted. Beyond the honesty requirement, stock imagery is one of the seven indicators by which section 10 penalizes an inadequate website — a demonstration using it would undermine the argument it exists to make.
- Supersedes: not applicable

### DEC-026 — The first target market is Stamford and Norwalk, Connecticut

- Date: 2026-08-05
- Status: accepted
- Context: every threshold in the qualification and ranking models was reasoned in the abstract, without reference to a specific market. Review culture, business density, and typical review volumes vary by region.
- Decision: the first real searches target Stamford and Norwalk, Connecticut, roughly 14 miles apart in Fairfield County.
- Consequences: this is the market against which the provisional models must first be calibrated (DEC-007, DEC-011). Distances are expressed in miles rather than kilometres, and the proximity bands of charter section 11.1 are restated accordingly. Compliance constraints for commercial outreach follow United States and Connecticut rules.
- Supersedes: not applicable

### DEC-027 — English by default; Spanish only on recorded evidence

- Date: 2026-08-05
- Status: accepted
- Context: the target market has a significant Spanish-speaking business population, but writing to a business in the wrong language damages a first contact. The operator's instruction was English unless it is obvious the client speaks Spanish, which required a testable definition of "obvious."
- Decision: English is the default for all demonstrations and outreach. Spanish is used only where positive evidence exists, in order of strength: the owner's own replies to reviews are predominantly in Spanish; the business's website or listing description is in Spanish; a clear majority of reviews are in Spanish. A Spanish business name alone is not evidence.
- Consequences: where evidence is absent or mixed, English is used. Owner review-replies are weighted highest because they are the owner's own public writing; review language is weighted lowest because it describes customers rather than the owner. Language selection is surfaced with its evidence at the outreach approval gate and can be overridden by the operator, consistent with DEC-008 — HORUS proposes, the operator decides.
- Supersedes: not applicable

### DEC-028 — HORUS drafts outreach in Gmail; the operator sends

- Date: 2026-08-05
- Status: superseded by DEC-041
- Context: outreach could be sent by HORUS from the operator's business email, or prepared for the operator to send. Sending directly would require managing bounces, deliverability, and sender reputation, and would place an automated system between HORUS and a real business owner.
- Options considered: HORUS sends directly; HORUS displays the message for manual copying; HORUS creates a draft in the operator's Gmail account.
- Decision: HORUS creates the message as a draft in the operator's Gmail account and marks it pending send in its own interface. The operator reviews the draft and sends it personally. HORUS never sends.
- Consequences: HORUS requests the Gmail scope permitting draft creation only, not sending. This converts the approval gate of DEC-004 from a rule the software is asked to respect into something it is technically incapable of violating — no bug or future change can cause an unapproved message to reach a business owner, because the credential does not permit it. The cost is that HORUS cannot observe that a message was sent, so send status is recorded as operator-declared rather than verified, and the two are distinguished in the stored data. Automatic verification would require mailbox read access, a broader permission deliberately not requested in V1.
- Supersedes: not applicable

### DEC-029 — HORUS V1 is an application with a visual interface

- Date: 2026-08-05
- Status: accepted
- Context: nothing had established whether HORUS is a command-line tool, a script, or an application with screens. The decision to show drafted outreach as pending send implied persistent visible state, which made the question unavoidable.
- Decision: HORUS V1 has a visual interface with persistent state. It is not a command-line tool.
- Consequences: this follows from the workflow rather than preference — a message pending send, a demonstration awaiting approval, and a prospect with a follow-up date are states that exist between sessions and must be visible when the operator returns. Six views are implied by the section 4 workflow: search, shortlist, prospect detail, demonstration review, outreach review, and tracker. Single operator on a single machine, consistent with DEC-003: no accounts, no roles, no sharing. Visual identity, device priorities, and accessibility requirements remain undecided.
- Supersedes: not applicable

### DEC-030 — In-person follow-up is an operator action recorded by HORUS, not a workflow HORUS runs

- Date: 2026-08-05
- Status: accepted
- Context: proximity ranks the shortlist because the operator intends to visit prospects (DEC-017), but the section 4 workflow ends at an approved message sent and a next step recorded. Ranking for a channel V1 did not support was an open inconsistency.
- Decision: a visit happens only after a prospect shows interest. It is an operator action, recorded in the tracker as a follow-up activity and outcome. HORUS does not schedule visits, prepare materials for them, or manage them.
- Consequences: the inconsistency is resolved without expanding V1's scope. The tracker must accept a visit as a follow-up type alongside its outcome and date. Proximity ranking remains justified, but its payoff is conditional — it matters only for prospects who respond, while web opportunity affects whether they respond at all. Whether proximity-first ordering costs more in response rate than it gains in visit convenience is a calibration question, recorded in charter section 11.1.
- Supersedes: not applicable

### DEC-031 — After 60 days HORUS asks the operator whether to remove a demonstration

- Date: 2026-08-05
- Status: accepted
- Context: a published demonstration stays public while its underlying data ages. DEC-021 guarantees freshness at the moment of contact but not afterwards, so a page could display figures months out of date. Accumulating demonstrations for businesses that never responded also leaves dead pages naming real companies.
- Decision: at 60 days from publication without a response, HORUS notifies the operator that the demonstration has been live for two months and asks whether to remove it. The operator decides. Nothing is taken down automatically. Where a prospect has engaged, the demonstration is not subject to this prompt.
- Consequences: removal stays an operator decision, consistent with DEC-008 — HORUS surfaces the situation, the operator judges it. The cost is that an ignored prompt leaves a demonstration public with ageing data, which is the risk the rule exists to address. Two mitigations: the prompt repeats rather than firing once, and the tracker shows the demonstration in an explicit "expired, awaiting decision" state rather than letting it look current. When the operator does remove one, the URL serves a neutral unavailable page that does not name the business, since the page's disappearance should not itself become a public statement about them. The record retains the URL, publication date, and removal date and reason so the history stays reconstructable.
- Supersedes: not applicable

### DEC-032 — Stay on the free tier; lower the search defaults

- Date: 2026-08-05
- Status: accepted
- Context: charter question 3 asked what budget is available for data retrieval. The free tier provides 250 searches monthly; the provisional defaults of `TARGET_QUALIFIED` 10 and `MAX_EXAMINED` 100 consume roughly 80 credits per search.
- Options considered: upgrade to Starter at $25/month; stay free and lower the defaults; stay free and accept fewer searches.
- Decision: remain on the free tier. Lower `TARGET_QUALIFIED` from 10 to **5** and `MAX_EXAMINED` from 100 to **60**.
- Consequences: caching (DEC-020) changed the arithmetic — calibration of 30–50 businesses costs roughly 100–155 credits once, and every subsequent rescoring is free. That fits inside a single month's free allowance, so no paid plan is needed to complete Phase 1. Lowering `TARGET_QUALIFIED` reflects the actual goal: V1 needs one client, and a shortlist of five gives real choice without collecting prospects that will never be contacted. The budget is revisited only when continuous prospecting begins, which is beyond V1's scope. Charter question 3 is closed.
- Supersedes: not applicable

### DEC-033 — A poor website outranks social-only, which outranks no website

- Date: 2026-08-05
- Status: accepted
- Context: DEC-009 established that all three web-presence situations are eligible, and DEC-011 deliberately left their relative priority undecided with both constants at 70. That placeholder still produced an ordering, which was an artifact rather than a decision. Charter question 1.
- Options considered: leave undecided; prefer businesses with no site; prefer businesses with a poor site.
- Decision: `NO_SITE_BASE` is set to **50** and `SOCIAL_ONLY_BASE` to **60**, so a genuinely broken site outranks both, and both outrank a merely dated but functional one.
- Consequences: the reasoning is commercial. A business with a bad site has already decided a website matters and paid to prove it — the pitch is "what you have is working against you," and the existing site supplies the services, positioning, and tone the demonstration needs. A business with nothing requires selling the concept first, a longer conversation with less material. Social-only sits between: they value being findable but have not invested in a site. This ordering is reasoned, not observed, and is the first thing real sales conversations should test. Charter question 1 is closed provisionally.
- Supersedes: DEC-011, in part

### DEC-034 — Commercial ineffectiveness becomes Factor 5; the model becomes `web-opportunity-v2`

- Date: 2026-08-05
- Status: accepted
- Context: every factor in `web-opportunity-v1` detected a site that was broken. A site that loads fast, works on mobile, and has no dead links can still list no services, show no call to action, and give no reason to call. That business is a legitimate prospect and scored as though adequate. Charter question 2.
- Decision: a fifth factor, commercial ineffectiveness, worth 20 points, scored on six absence indicators using the same concave curve as Factor 2. The remaining factors are rebalanced to preserve a 100-point total: mobile 35→30, obsolete appearance 25→20, broken elements 20→18, load performance 20→12. The model becomes `web-opportunity-v2`.
- Consequences: load performance loses the most weight, which is deliberate — it was the easiest signal to measure, not the most commercially meaningful, and weighting by ease of measurement is how scoring models drift away from what they are meant to represent. Absences are cheaper to detect than defects but easier to get wrong, since content may exist where HORUS did not look; every indicator must record where the search was performed, and a business scoring high on this factor alone is surfaced as an operator flag rather than trusted. Per DEC-011's versioning rule, this is a new model version rather than an edit to v1. Charter question 2 is closed.
- Supersedes: DEC-011, in part

### DEC-035 — Operator configuration lives outside version control

- Date: 2026-08-05
- Status: accepted
- Context: the home base required by DEC-016 is the operator's residential address. Search defaults, API keys, and OAuth credentials are similarly operator-specific. A repository that may later be pushed to a hosting service is the wrong place for any of it, and a home address committed once remains in Git history even after deletion.
- Decision: operator configuration lives in `config/local.json`, excluded from version control. A committed `config/local.json.example` documents the structure with empty values. Documentation refers to the home base without recording where it is.
- Consequences: the repository can be made public or shared without exposing the operator's address or credentials. The configuration file must be backed up separately, since version control will not protect it. Values recorded there on 2026-08-05: operator name, home base in Stamford CT, and the search defaults of DEC-032. Credentials remain empty until Phase 1 execution.
- Supersedes: not applicable

### DEC-036 — HORUS uses a restrained evidence-workbench visual baseline

- Date: 2026-08-06
- Status: accepted
- Context: the operator interface must present evidence, uncertainty, and approval states without behaving like a customer-facing marketing surface. HORUS had no approved visual direction.
- Options considered: a dense dashboard aesthetic; a highly branded sales-tool aesthetic; a restrained evidence workbench with semantic state cues.
- Decision: the operator interface uses a restrained editorial evidence-workbench baseline: neutral foundations, scannable panels, and semantic accents for information, caution, blocked actions, and completed approvals. Demonstrations may adapt only verified business cues such as a public logo or colours.
- Consequences: visual decoration, gamified scores, and generic dashboard theatre are excluded from V1. This decision is a V1 interface baseline, not a complete public brand identity for HORUS.
- Supersedes: not applicable

### DEC-037 — Demonstrations use a common mobile-first template with bounded adaptation

- Date: 2026-08-06
- Status: accepted
- Context: individually designing every concept site would add time and risk unsupported or inconsistent content, while one inflexible template would undermine the promise of a customized demonstration.
- Options considered: a fully bespoke demonstration for every prospect; one fixed template; one common template with bounded per-prospect adaptation.
- Decision: V1 uses one common, mobile-first demonstration template. It may adapt verified identity cues and source-supported sections, but its structure, safety requirements, and responsive behavior remain controlled.
- Consequences: demonstrations can be created consistently and reviewed against a stable publication checklist. Sparse source material results in a simpler demonstration rather than invented pages or claims.
- Supersedes: not applicable

### DEC-038 — V1 adopts a practical WCAG AA-equivalent accessibility baseline

- Date: 2026-08-06
- Status: accepted
- Context: the operator needs a concrete accessibility expectation for the application and the published demonstrations, but Phase 2 does not choose the technical stack or test tooling required for formal conformance verification.
- Options considered: defer accessibility entirely; claim formal conformance now; adopt a practical AA-equivalent baseline and define verification in Phase 3.
- Decision: V1 requires keyboard-operable approval and destructive controls, visible focus, semantic heading structure, text alternatives for images, sufficient contrast, and no colour-only meaning. Phase 3 defines the technical verification method.
- Consequences: accessibility is a design constraint from the first implementation work, while no unsupported formal compliance claim is made before a test strategy exists.
- Supersedes: not applicable

### DEC-039 — Administrative city boundary is the default search interpretation

- Date: 2026-08-06
- Status: accepted
- Context: DEC-015 requires the market interpretation to be recorded because city boundaries are ambiguous in practice, but did not select a repeatable V1 default.
- Options considered: always use a broader market; force a choice with no default; use the administrative city by default and require confirmation for a broader market.
- Decision: HORUS defaults each search to the administrative city boundary. A broader-market interpretation is allowed only after the operator explicitly confirms it for that run, and the choice is recorded.
- Consequences: repeated searches have a consistent default while the operator may deliberately include adjacent markets when appropriate. Results from the two interpretations stay distinguishable.
- Supersedes: not applicable

### DEC-040 — Demonstration editing is structured, not free-form source editing

- Date: 2026-08-06
- Status: accepted
- Context: free-form source editing would make it easier to add unsupported content or break template safeguards, while no editing capability would prevent necessary source-backed refinement.
- Options considered: no operator edits; unrestricted source editing; structured content and layout editing.
- Decision: V1 allows structured edits to source-backed content and approved layout options only. It does not expose free-form source editing.
- Consequences: every business-specific element can stay in the evidence inventory and approved template safeguards remain enforceable. One-off bespoke changes beyond the structured options are out of scope for V1.
- Supersedes: not applicable

### DEC-041 — HORUS hands approved outreach to Gmail without Gmail API credentials

- Date: 2026-08-06
- Status: accepted
- Context: Phase 3 verified that the Gmail API scope required to create a draft, `gmail.compose`, also permits sending email. The credential-level guarantee asserted in DEC-028 is therefore unavailable: using that scope would allow HORUS to send even if its application code chose not to.
- Options considered: retain Gmail API draft creation and accept an application-level send block; hand approved content to the operator's Gmail composition flow without OAuth credentials; remove Gmail integration and require manual copying.
- Decision: after explicit outreach approval, HORUS prepares a Gmail compose handoff for the operator. HORUS holds no Gmail OAuth credential and does not call the Gmail API. The operator reviews, saves if desired, and sends the message in Gmail personally, then declares the result in HORUS.
- Consequences: HORUS is technically incapable of sending because it has no Gmail credential or sending path. The system no longer claims to create a Gmail API draft automatically; it records that the handoff was opened, while the send status remains operator-declared. The exact compose-handoff mechanism is a Phase 3 implementation concern and must not transmit the message before approval.
- Sources: Google documents that `gmail.compose` “manages drafts and sends email,” while the draft-create endpoint accepts that same scope. Verified 2026-08-06.
- Supersedes: DEC-028

### DEC-042 — HORUS V1 uses a local Electron, React, TypeScript, Vite, and SQLite foundation

- Date: 2026-08-06
- Status: accepted
- Context: Phase 3 needed an implementation foundation consistent with one operator on one laptop, durable and inspectable evidence, a visual interface, immutable raw responses, and controlled static demonstration publication.
- Options considered: hosted web application with remote storage; Electron local application with React/TypeScript and SQLite; a local browser-only application using browser storage.
- Decision: HORUS V1 is a local-first Electron desktop application. Its interface uses React, TypeScript, and Vite; persistent derived records and event history use SQLite; immutable raw source responses are stored as content-addressed JSON files referenced by SQLite manifests. Demonstrations are static bundles for Cloudflare Pages Direct Upload through Wrangler after an approved publication command.
- Consequences: no accounts, remote database, or synchronization are introduced. Credentials and external access remain outside the renderer process. The Cloudflare demo project intentionally uses Direct Upload rather than automatic Git deployment, which preserves the publication gate but means that Pages project cannot later switch to Git integration without creating a new project. The Gmail integration remains credential-free under DEC-041.
- Supersedes: not applicable

### DEC-043 — Phase 3 validates Cloudflare upload through the dashboard, not Wrangler

- Date: 2026-08-06
- Status: accepted
- Context: the evaluated Wrangler versions introduced known development dependency findings, including a high-severity `pages deploy` command-injection advisory in npm's proposed downgrade. The operator still needed proof that a test-only static asset can be deployed without introducing that client into HORUS.
- Options considered: install the current Wrangler; accept npm's proposed downgrade; postpone the test; use Cloudflare Dashboard Direct Upload manually.
- Decision: Phase 3 uses Cloudflare Dashboard Direct Upload manually for one approved, test-only static HTML asset. The asset was deployed at `https://spring-night-6be6.javiernpls.workers.dev`; no API token, Wrangler installation, business data, contact, or production demonstration was used.
- Consequences: the test proves an approved dashboard upload path while keeping the local dependency audit clean. It does not replace DEC-022's Cloudflare Pages target or select a production deployment client; that decision remains open until a safe, reviewable Pages workflow is available.
- Supersedes: the Wrangler deployment-client portion of DEC-042 only; the local-first application architecture remains accepted.

### DEC-044 — Phase 5 uses approved Wrangler Direct Upload for an explicitly approved Pages concept

- Date: 2026-08-06
- Status: accepted
- Context: DEC-043 deliberately limited Phase 3 to a test-only dashboard upload while a production Pages client remained unresolved. Phase 5 required publication of one operator-approved, static concept while preserving the review and publication gates.
- Options considered: repeat a manual dashboard upload; postpone public review; authenticate the current Wrangler CLI and use Pages Direct Upload for this one approved concept.
- Decision: after explicit operator approval, authenticate Wrangler 4.119.0 through Cloudflare OAuth and deploy the reviewed static bundle to the `horus-finescape-concept` Pages project. The public URL is `https://horus-finescape-concept.pages.dev`.
- Consequences: the project now has a repeatable, operator-authenticated direct-upload path, but no credential or Wrangler dependency is committed to the repository. The deployment remains a concept, not an official business website: it has a visible HORUS notice, `noindex, nofollow`, and no form, contact route, pricing, testimonial, or unsupported claim. Publication does not authorize outreach or contact; those retain their separate gates under DEC-004 and DEC-041.
- Supersedes: the production-client uncertainty described in DEC-043; its Phase 3 test-only conclusion remains historical.

### DEC-045 — Phase 6 evaluates subscription-backed Claude Code as the first local agent runtime

- Date: 2026-08-07
- Status: accepted for Phase 6 evaluation; implementation pending
- Context: HORUS needs reasoning support for evidence interpretation, concept composition, and outreach drafting, but the operator does not want to introduce usage-metered model API billing during the initial internal pilot. HORUS is a local, single-operator application, and the operator already has an eligible Claude subscription.
- Options considered: integrate the usage-metered Anthropic API immediately; use Claude Free through manual copy and paste; use a local open-weight model; invoke a locally authenticated Claude Code runtime under the operator's existing subscription; defer agents entirely.
- Decision: Phase 6 first evaluates Claude Code as a local subprocess authenticated by the operator's existing subscription. The Electron main process, never the renderer, coordinates bounded agent tasks and validates structured results. No Anthropic API key or separately metered Anthropic API dependency is added for the initial pilot. The runtime is placed behind a provider-neutral boundary, and the detailed proposal is recorded in `AGENT_ARCHITECTURE.md`.
- Consequences: subscription limits, authentication state, network availability, and product terms become explicit runtime dependencies. The first implementation uses one execution queue and shadow-mode replay before any new real prospect. Claude supplies analysis and drafts only: deterministic scoring, evidence retention, approval validity, publication, Gmail handoff, and delivery state remain controlled by HORUS code. This decision applies only to the founder's local internal use and must be reconsidered before any hosted, multi-user, distributed, or customer-facing use.
- Sources: Anthropic's Claude Code setup and Agent SDK documentation, verified 2026-08-07, document eligible subscription authentication, non-interactive/programmatic execution, structured output, tools, permissions, and sessions.
- Supersedes: not applicable

## Template

### DEC-XXX — Title

- Date: YYYY-MM-DD
- Status: proposed
- Context:
- Options considered:
- Decision:
- Consequences:
- Supersedes: not applicable
