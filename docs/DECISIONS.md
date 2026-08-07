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

## Phase 6 — proposed, not approved

The five decisions below were drafted alongside the Phase 6 foundation corrections. **None has been approved by the operator, and none has been executed or verified on a machine that can run the test suite.** They are recorded as proposals so the reasoning is reviewable before it becomes history. Approve, revise, or reject them; do not treat them as settled.

### DEC-046 — SerpApi provenance records that a credential was used, never its value

- Date: 2026-08-07
- Status: proposed
- Context: `executeSerpApiDiscovery` built the request URL, set `api_key` on it, and returned `requestUrl.toString()` with the credential still attached. `appendRawSnapshot` writes its `request` argument into `raw_snapshots.request_json` and into the raw JSON file on disk, so the operator's SerpApi key was one ordinary call away from being written into the immutable evidence store. The existing contract test asserted only that the key was absent from `payload`, which was true and beside the point.
- Options considered: strip the key from the URL before returning it; return only the query object and let the caller rebuild; return the full URL and require every caller to redact; hash the key into an opaque identifier.
- Decision: the executed URL and the provenance URL are built as two separate objects. The provenance copy is taken before the credential is ever set and then records `api_key=REDACTED_SERPAPI_KEY`, so no code path can serialise the real value. `executeSerpApiDiscovery` also now returns `retrievedAt`, because the caller needs it for the snapshot record and should not invent one.
- Consequences: provenance still proves a credentialled request was made, and remains reproducible except for the secret. The returned `requestUrl` is no longer sufficient to replay the request by itself, which is intended. Any future integration that carries a credential must follow the same two-object pattern; the contract test now asserts against the whole returned object rather than one field.
- Supersedes: not applicable

### DEC-047 — A retrieval is its own record, separate from the content it returned

- Date: 2026-08-07
- Status: proposed
- Context: `raw_snapshots` declared `payload_hash` UNIQUE, derived the row id from that hash, and inserted with `INSERT OR IGNORE`. Retrieving identical content a second time was therefore discarded silently: no second row and no second `retrieved_at`. This contradicts the storage rule that a later retrieval creates a new snapshot beside the old one, and it can starve DEC-021's 30-day freshness check of the current retrieval timestamp it depends on — a business whose listing has not changed would appear to have no recent evidence.
- Options considered: keep content-addressed deduplication and accept the loss; add a separate retrievals table alongside the deduplicated content table; make each row a retrieval and keep content addressed by hash on disk; store the payload again per retrieval.
- Decision: one row per retrieval, with a UUID id. `payload_hash` becomes a non-unique pointer to a content-addressed file that is still written only once, because deduplicating bytes is not the same as deduplicating retrievals. Added indexes on `payload_hash` and on `(source, retrieved_at)`. A `PRAGMA user_version` migration rebuilds the table on existing databases so the calibration evidence already on the operator's machine is preserved.
- Consequences: `rawSnapshotCount` now counts retrievals rather than distinct payloads, so the number in `CURRENT_STATE.md` will move once this runs. Storage on disk does not grow when content is unchanged. The migration rewrites a table that holds real Phase 1 evidence and has not been executed — it should be run against a copy of the database first.
- Supersedes: not applicable

### DEC-048 — The main process validates workflow state submitted by the renderer

- Date: 2026-08-07
- Status: proposed
- Context: `workflow:representative:save` accepted `state: unknown` and wrote it directly to SQLite and to the append-only event log. The renderer sits on the untrusted side of the `contextIsolation` boundary, and the approval-gate guards in `moveWorkflow` live in `src/domain/`, which is renderer code. Every approval flag in the store was therefore renderer-asserted, which is what `AGENT_ARCHITECTURE.md` section 5 says must never be the case.
- Options considered: leave it, since only HORUS's own renderer calls it today; validate the submitted state in the main process; move the domain module to a shared location imported by both sides; replace state saves with commands so the main process computes every transition itself.
- Decision: add `electron/workflow-state.ts`, validating structure and comparing each submitted state against the state the main process already holds. Approvals are append-only, stages advance one at a time, and recorded events may only grow. A rejected save is itself written to the event log as `workflow.state_rejected`.
- Consequences: an approval can no longer be fabricated out of order, revoked, or reached by skipping a stage. It does **not** make the renderer incapable of asserting a single legitimate-looking step; only command-based transitions close that, and that refactor is deliberately not attempted here. The step list is currently declared twice — once in `electron/workflow-state.ts` and once in `src/domain/representative-workflow.ts` — which is duplication accepted temporarily to avoid a cross-directory import that could not be compiled and checked. Consolidating them is the follow-up.
- Supersedes: not applicable

### DEC-049 — A provider-neutral agent boundary, with the analyst's limits enforced by the parser

- Date: 2026-08-07
- Status: proposed
- Context: DEC-045 accepted evaluating Claude Code as the first local runtime and `AGENT_ARCHITECTURE.md` specifies the boundary, but nothing was implemented. Steps 2 and 3 of the Phase 6 validation sequence require the boundary and one bounded analyst task before any replay can happen.
- Options considered: call Claude Code directly from the main process where it is needed; build the full three-role agent set at once; build the runtime interface plus one analyst task; wait until the runtime can be verified on a machine with Claude Code installed.
- Decision: add `electron/agent/runtime.ts` (provider-neutral interface, forbidden-tool list, failure taxonomy, injectable spawn) and `electron/agent/analyst-task.ts` (the single bounded task and its output parser). The parser enforces the section 11 acceptance criteria mechanically: a claim citing evidence the task never received is rejected, an uncited claim is rejected, any score-like field is rejected, and an absence may only be recorded as `insufficient_data`.
- Consequences: the acceptance criteria stop depending on the model's cooperation and become properties of the code. The spawn is injected, in the same style as `fetchImpl`, so the boundary is unit-testable without a Claude Code installation. **The Claude Code command shape, flags, authentication behaviour and error wording are unverified** — `classifyFailure` pattern-matches on messages nobody has observed. Phase 6 step 2 is not complete until that is checked against a real installation, exactly as section 2 requires.
- Supersedes: not applicable

### DEC-050 — `reputation-scoring-v1` exists in the charter but not in the code

- Date: 2026-08-07
- Status: proposed — finding recorded, no remedy authorised
- Context: found while reviewing the repository against its documentation. Charter section 9 specifies six gates, a five-factor 100-point model and a 70-point threshold. `web-opportunity-v2` is fully implemented in `src/domain/web-opportunity-audit.ts`. `reputation-scoring-v1` is not implemented anywhere: the only reputation value in the codebase is the literal `score: 82` in the representative fixture. There is no `scripts/` directory, so the 30-business calibration and the SEASONS EATS lower bound of 73.06 were computed outside the application and cannot be regenerated from this repository.
- Options considered: implement the model as part of Phase 6; record the gap and leave Phase 6 scoped as documented; leave it undocumented until a later phase.
- Decision: record the gap and leave it outside Phase 6. Phase 6 is validation and hardening of what exists; implementing the qualification model is new capability and deserves its own authorisation.
- Consequences: the reputation figures in `CURRENT_STATE.md` and in the Phase 1 and Phase 5 checkpoints remain valid as recorded history, but they are not reproducible from the code, which is in tension with the provenance convention and with `AGENT_ARCHITECTURE.md` acceptance criterion "deterministic scores match recomputation from the stored inputs" — that criterion cannot be met for reputation until the model exists. Until then, no agent replay can check a reputation number against anything.
- Supersedes: not applicable

### DEC-051 — The Electron build emitted one directory too deep, and the application had never started

- Date: 2026-08-07
- Status: proposed — corrected and verified by build, not yet by launching the application
- Context: found while verifying the Phase 6 batch. `tsconfig.electron.json` set `rootDir: "."` with `include: ["electron"]`, so TypeScript preserved the `electron/` path segment and emitted `build/electron/electron/main.js`. The dev script launches `build/electron/main.js`, and `main.ts` resolves the renderer as `path.join(dirname, '../../dist/index.html')`, which under the nested layout pointed at `build/dist` rather than `apps/operator/dist`. Both paths were wrong, and `find` confirmed that `horus.sqlite` has never been created on the operator's machine — the application has never successfully run.
- Options considered: change the dev script to the nested path; change `main.ts` to compensate for the extra level; set `rootDir` to `./electron` so the emitted layout matches what the rest of the project already assumes.
- Decision: set `rootDir: "./electron"`. It is the only option that fixes both the dev script and the renderer path without adding a compensating hack, and it leaves every existing relative path in `main.ts` correct.
- Consequences: `npm run build` now emits `main.js`, `preload.js`, `persistence.js`, `workflow-state.js`, `agent/` and `integrations/` directly under `build/electron/`, which was verified. Launching the application still has not been observed. More significantly, this establishes that the Electron foundation described in the Phase 3 and Phase 4 checkpoints was built and tested but never executed, so the SQLite store has never held real evidence — the calibration data lives in `cache/` as plain files. That does not invalidate the checkpoints, which describe design and automated tests, but it narrows what "implemented" has meant so far and should be read alongside DEC-050.
- Supersedes: not applicable

### DEC-052 — The preload script is CommonJS, and must stay that way

- Date: 2026-08-07
- Status: proposed — compiles clean; runtime not yet confirmed
- Context: with the build layout corrected in DEC-051 the application finally started, and the renderer console showed `Unable to load preload script ... SyntaxError: Cannot use import statement outside a module`, thrown from `executeSandboxedPreloadScripts`. `package.json` declares `"type": "module"`, so the compiled `preload.js` was an ES module, and Electron's sandboxed preload loader accepts only CommonJS. The failure is invisible from the renderer: `window.horus` is simply `undefined`, and because `App.tsx` calls it through optional chaining, every save became a silent no-op. `domain_events` was 0 after a full walk through the workflow.
- Options considered: disable `sandbox` so ESM preload is permitted; emit the preload as `.mjs`; add a separate CommonJS tsconfig for the preload; rename the source to `.cts` so NodeNext emits `.cjs`.
- Decision: rename `electron/preload.ts` to `electron/preload.cts`. Under `module: NodeNext` a `.cts` source emits `.cjs` as CommonJS regardless of the package type, with no extra build step and no weakening of the sandbox. `verbatimModuleSyntax` requires the `import electron = require('electron')` form in that file. `main.ts` now loads `preload.cjs`.
- Consequences: the sandbox stays enabled, which matters because the preload is the only bridge across the `contextIsolation` boundary. Anyone adding to the preload must keep the `.cts` extension and the `require` import form. Disabling `sandbox` to allow ESM would have been the smaller diff and the worse decision.
- Supersedes: not applicable

### DEC-053 — The interface advances independently of the record, and that is the real defect

- Date: 2026-08-07
- Status: proposed — finding recorded, remedy not implemented
- Context: found while diagnosing DEC-052. In `App.tsx`, `updateWorkflow` calls `setWorkflow(next)` and `persist(next)` with no relationship between them. The interface therefore advances whether or not the main process accepted anything. With the preload broken this was demonstrated at full scale: the operator walked from stage 01 to stage 07, past the demonstration approval gate, with the interface displaying an approved demonstration and offering to publish, while `domain_events` remained 0. Nothing durable existed.
- Options considered: leave it, since the workflow is local and re-derivable; roll the interface back when a save is refused; make the main process the source of truth and render only state it has confirmed; require the renderer to send commands rather than state, so a transition exists only once it is recorded.
- Decision: record the finding; do not implement a remedy in this batch. The correct fix is the command-based refactor already identified in DEC-048, and doing it properly means the interface renders confirmed state rather than optimistic state. That is a change to every stage component and should not be bolted on beside two other unverified corrections.
- Consequences: until this is fixed, the interface can display an approval that the system of record never accepted. In validation mode the consequence is cosmetic, because publication is local and fictional. In a real run the same mechanism operates, which is why this is recorded as a defect rather than a preference. The `.catch` added to `persist` in DEC-048 surfaces a refusal to the operator but does not roll the interface back, and should not be mistaken for a fix.
- Supersedes: not applicable

### DEC-054 — Two hardening findings recorded without remedy

- Date: 2026-08-07
- Status: proposed — findings recorded, no remedy authorised
- Context: both observed while the application ran for the first time.
- Findings: (1) the SQLite store was created at `~/Library/Application Support/Electron/data/horus.sqlite`. Electron falls back to the generic name `Electron` for an unpackaged application, so HORUS shares a data directory with any other unpackaged Electron application on the machine — a collision risk for a project whose evidence is meant to be immutable and attributable. `app.setName('HORUS')` before `whenReady` addresses it, and existing data would need moving. (2) The renderer runs with no Content-Security-Policy, which Electron reports as a security warning naming `unsafe-eval`.
- Decision: record both, remedy neither in this batch. Each is a small change with a real chance of breaking startup or the renderer, and two unverified corrections were already in flight.
- Consequences: these belong to Phase 6's hardening half and should be taken before any packaged build. Neither affects the approval gates.
- Supersedes: not applicable

### DEC-055 — The dev server binds to IPv4 explicitly

- Date: 2026-08-07
- Status: proposed — verified working
- Context: with the preload corrected, the application still failed to load the renderer: `Failed to load URL: http://127.0.0.1:5173/ with error: ERR_CONNECTION_REFUSED`. Vite reported itself ready on `localhost:5173`, which on macOS resolves to the IPv6 loopback `::1`, while `dev:desktop` requests the IPv4 address. `wait-on tcp:5173` succeeded, which is why the failure appeared only at the Electron end.
- Options considered: change `VITE_DEV_SERVER_URL` to `localhost` and let resolution decide; bind Vite to `127.0.0.1`; make Electron retry on both addresses.
- Decision: add `--host 127.0.0.1` to `dev:renderer`, so both sides name the same explicit address rather than depending on how `localhost` resolves on a given machine.
- Consequences: development startup no longer depends on loopback resolution order. Nothing about the production build changes; `loadFile` is used there.
- Supersedes: not applicable

### DEC-056 — The analyst task is schema-constrained, and HORUS does not use `--bare`

- Date: 2026-08-07
- Status: proposed — verified against Anthropic's published CLI documentation, not against a live run
- Context: DEC-049 was written before the Claude Code contract had been checked against anything. Reading the documented behaviour of `claude -p` changed two design points and surfaced a conflict with DEC-045.
- Findings: (1) `--output-format json` returns an envelope with the text in `result`, plus `session_id` and `total_cost_usd`. Passing `--json-schema` puts schema-conforming output in `structured_output` instead, which is a far stronger contract than parsing prose. (2) `--bare` is Anthropic's recommended mode for scripted calls, but it does not use the subscription login and requires `ANTHROPIC_API_KEY` — exactly the metered dependency DEC-045 refuses. (3) A failure inside a run, such as missing authentication, is printed as the result on stdout rather than stderr, so a zero exit code does not by itself mean success. (4) SIGTERM produces exit code 143.
- Options considered: use `--bare` and accept API billing; use `--bare` only in tests; omit `--bare` and accept the consequences; abandon the CLI for the TypeScript SDK.
- Decision: pass `--json-schema` with an explicit schema for the analyst task, and treat a missing `structured_output` as a failure rather than falling back to prose. Do not pass `--bare`. Record `session_id`, `total_cost_usd` and `num_turns` in the run record, satisfying the traceability requirement in `AGENT_ARCHITECTURE.md` section 8. Inspect stdout for failure signatures even when the exit code is zero, and map 143 to `cancelled`.
- Consequences: the analyst can no longer answer in prose and have it accepted. Cost per run becomes visible without consulting the usage dashboard. **The cost of omitting `--bare` is real and should be watched:** without it, Claude Code loads the host's hooks, plugins, MCP servers and `CLAUDE.md`. This repository contains a `CLAUDE.md` written for a different audience, and it would be loaded into every analyst run from this working directory. That makes runs less reproducible across machines and creates a path for repository content to influence an agent that is supposed to reason only over supplied evidence. Confining the working directory of the subprocess, or replacing the system prompt with `--system-prompt`, should be evaluated before the shadow-mode replay. The error wording `classifyFailure` matches on remains unverified against a live run.
- Supersedes: not applicable

### DEC-057 — The agent runs from an isolated directory with its own system prompt, not from the HORUS repository

- Date: 2026-08-07
- Status: proposed — written and unit-tested with real temporary directories; not yet exercised against a live Claude Code invocation
- Context: DEC-056 established that HORUS cannot use `--bare` without violating DEC-045's refusal of API-key billing. Without `--bare`, Claude Code auto-discovers the current working directory's `CLAUDE.md`, hooks, plugins and MCP servers. This repository has a `CLAUDE.md`, written to instruct a human maintaining HORUS — not a bounded agent that is supposed to reason only over the evidence a task supplies. Running the analyst from the repository root would have handed it exactly the kind of unbounded context `AGENT_ARCHITECTURE.md` section 3 says an agent must not have.
- Options considered: accept the exposure and rely on the analyst ignoring irrelevant instructions; reduce `CLAUDE.md` to nothing an agent could misuse (weakens it for its actual audience); run every agent invocation from an isolated, empty directory; reconsider `--bare` and accept API billing after all.
- Decision: two changes. `buildClaudeCodeArgs` now passes `--system-prompt`, which replaces Claude Code's default system prompt outright, so the task's own instruction is what governs the run rather than whatever a discovered `CLAUDE.md` would add. The `-p` argument becomes a short kickoff naming the task and evidence count; the rules live entirely in `--system-prompt`. Separately, every run gets a fresh working directory from `electron/agent/working-directory.ts`'s `createWorkingDirectoryPreparer`, created under HORUS's own data directory, never the repository, and confirmed on creation to contain no `CLAUDE.md` or `.claude`.
- Consequences: an agent run no longer has a path to repository-level instructions at all, not merely a system prompt that competes with them. `LocalAgentRuntime.run` and `checkAvailability` now require an injected `prepareWorkingDirectory` function, following the same test-by-injection pattern as `fetchImpl` in the SerpApi module. Unit tests create and inspect real temporary directories rather than asserting against a mock, in the style of `persistence.test.ts`. What remains unverified is exactly what DEC-056 already flagged: no live Claude Code process has been run, so whether `--system-prompt` is honoured as strongly as the documentation states, and whether an isolated `cwd` fully prevents auto-discovery, are still assumptions from reading rather than observations.
- Supersedes: not applicable

### DEC-058 — A live run showed the tool allowlist was never enforced against Claude Code itself

- Date: 2026-08-07
- Status: proposed — the lockdown flag is added and unit-tested; the deeper fix is deferred
- Context: the operator ran the exact command `buildClaudeCodeArgs` constructs, for the first time, from an isolated `/tmp` directory. It succeeded and returned the expected `structured_output`, `session_id` and `total_cost_usd`, confirming DEC-056 and DEC-057 against a real process rather than documentation. It also showed `stop_reason: "tool_use"` and `num_turns: 2` — Claude Code attempted to use a tool during a run that supplied none. Re-reading `buildClaudeCodeArgs` in that light found the gap: `assertTaskIsBounded` checks `task.allowedTools`, a field on the `BoundedAgentTask` data object, for forbidden names. That check has never been connected to Claude Code's actual permission surface. Nothing in `buildClaudeCodeArgs` passed `--allowedTools` or a permission mode, so a real run had Claude Code's default access — Bash and file read/write — regardless of what the task object claimed to allow. `AGENT_ARCHITECTURE.md` section 6 is explicit that an agent must receive only the tools its role needs; before this fix, the code enforced that only on paper.
- Options considered: leave it, since the isolated working directory from DEC-057 already contains the blast radius; pass `--allowedTools` built from `task.allowedTools`; pass `--permission-mode dontAsk` to deny anything not explicitly allowed.
- Decision: add `--permission-mode dontAsk` unconditionally. `--allowedTools` with `task.allowedTools`'s names (`read_evidence_snapshot`, `run_deterministic_scoring`, and so on) was rejected for now: those are names chosen for this codebase's future HORUS-specific tools, not tools that exist yet — no MCP server or custom tool registers them, so allow-listing them today would permit nothing real while looking like a control that does something. `dontAsk` denies everything not explicitly allowed, so a run that allow-lists nothing can execute nothing.
- Consequences: **this is containment, not the designed control.** The correct fix is implementing HORUS's evidence-reading tools as a real MCP server or custom tool set, and allow-listing exactly the ones a role's `allowedTools` names — at which point `--allowedTools` should be added alongside `--permission-mode dontAsk`, and `assertTaskIsBounded`'s check would finally be validating something that reaches the runtime. Until then, an agent task effectively runs with no tool access at all rather than the intended read-only evidence access, which will show up as `tool_denied` or empty output the first time a real analyst task is attempted — a visible failure, not a silent one, but a real limitation to plan around before step 3 can be considered functionally complete. Recorded here because it was found by running the code, not by reading it, which is the reminder this whole batch keeps producing: reading finds shapes; running finds what the shapes don't cover.
- Supersedes: not applicable

### DEC-059 — The analyst's one real tool is a read-only MCP server

- Date: 2026-08-07
- Status: proposed — written, unit-tested against a real SQLite database, and building cleanly against the real `@modelcontextprotocol/sdk` types (`npm install && npm run test && npm run build`, 2026-08-07: 61/61 tests). No live Claude Code invocation has called the tool yet.
- Context: DEC-058 found that `task.allowedTools` was validated as data but never reached Claude Code, and contained it with `--permission-mode dontAsk`. That left every `ANALYST_TOOLS` entry, including `read_evidence_snapshot`, as a name with no implementation — a real analyst task would run with no tool access at all. Closing that requires an actual MCP server, chosen as the operator's decision when asked how to build it (over inlining evidence into the prompt, which would grow unboundedly and remove the agent's ability to ask for only what it needs).
- Options considered: inline all evidence into the prompt instead of a tool (rejected, per the operator's stated preference and the prompt-growth problem); build a full read/write MCP server now; build exactly one read-only tool against the existing evidence store; wait for a later phase.
- Decision: `electron/agent/evidence-store.ts` opens `horus.sqlite` with better-sqlite3's `readonly: true`, a driver-level guarantee rather than a convention — proven directly in `evidence-store.test.ts` by attempting a write through a raw readonly handle and observing it throw. `electron/agent/evidence-mcp-server.ts` is a stdio MCP server, built with the officially supported `@modelcontextprotocol/sdk` v1.x (not the v2 line, which is beta), exposing exactly one tool: `read_evidence_snapshot`. `electron/agent/evidence-tool-wiring.ts` and a new `McpServerWiring` type in `runtime.ts` connect a task's conceptual tool name to the real `mcp__horus-evidence__read_evidence_snapshot` name Claude Code expects, and `buildClaudeCodeArgs` now accepts an optional `evidenceTools` argument that adds `--mcp-config` and `--allowedTools` only for tools that are both requested by the task and present in the wiring's map.
- Consequences: `read_evidence_snapshot` is the first of `ANALYST_TOOLS`' five names with a real implementation; the other four (`inspect_public_website_readonly`, `run_deterministic_scoring`, `save_agent_draft`, `request_operator_review`) remain unwired and, per DEC-058's mechanism, resolve to no access. The unit tests seed and read a real SQLite file through the same `createHorusStore` write path production code uses, which verifies the read side thoroughly, but a Claude Code process actually calling the tool over stdio is still unobserved — that is the next thing to run, not to read.
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
