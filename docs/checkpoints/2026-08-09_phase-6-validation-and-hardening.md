# Checkpoint: Phase 6 — Validation and Hardening

- Date: 2026-08-09
- Phase: 6 — Validation and Hardening
- Owner: Javier Napoles, founder and sole operator of HORUS
- Approval status: **approved by Javier Napoles, 2026-08-09.** Every decision it rests on was accepted under delegation during one continuous working session; the phase itself was the operator's to accept, and was.

## What this checkpoint claims, and what it does not

It claims that **Phase 6's exit criterion is met**, criterion by criterion, with the evidence for each named below.

It does **not** claim HORUS V1 is finished, that the MVP is complete, or that anything is authorised to reach a business owner. Charter §4's loop runs end to end, but the operator has never taken a real prospect through it, and DEC-004's two gates remain exactly where they were.

## The exit criterion, part by part

> "the corrected foundation and shadow-mode agent workflow pass their acceptance checks, Claude unavailability is recoverable without corrupting state, no agent can bypass either approval gate, and a decision is recorded on whether to retain the subscription-backed runtime…"

| Part | Status | Evidence |
| --- | --- | --- |
| Corrected foundation | met | DEC-046 credential-free provenance, DEC-047 per-retrieval snapshots, DEC-048 main-process validation |
| Shadow-mode replay passes its checks | met | DEC-063, DEC-064 — run live; SEASONS EATS abstained correctly on partial evidence |
| Unavailability recoverable without corrupting state | met | **DEC-100** — every failure mode returns `failed`, `saveDraft` is never called, the next run succeeds |
| No agent can bypass either approval gate | met | Structural (no publish or contact tool exists) plus DEC-093's clicked gate tests |
| A runtime decision is recorded | met | **DEC-099** — revise |

### AGENT_ARCHITECTURE §11's ten acceptance criteria

Audited one by one rather than in aggregate. That audit is what found DEC-101.

- No usage-metered model API — met by construction (DEC-056 rejected `--bare` precisely because it needs an API key).
- Every business-specific claim references retained evidence — enforced by `parseAnalystOutput` (DEC-049).
- Missing data remains missing — DEC-064's SEASONS EATS abstention.
- Deterministic scores match recomputation from stored inputs — **DEC-086 and DEC-087, exactly**: SEASONS EATS 73.06 against 73.06, Finescape 48.11 against 48.1, four calibration figures to within 0.05.
- Agents cannot create or bypass approvals — structural, plus DEC-093.
- **A material edit invalidates the relevant prior approval — was NOT met.** Found by this audit; fixed in DEC-101.
- Claude unavailability visible and recoverable — DEC-100.
- Finescape stays below qualification — DEC-087 asserts it.
- SEASONS EATS replay preserves the recorded uncertainty — DEC-087 asserts it: above threshold, still `qualified: false`.
- An explicit retain/revise/reject decision — DEC-099.

## What Phase 6 actually produced

Nineteen decisions, DEC-083 through DEC-101. The suite went from 190 tests to 406. Ten SerpApi credits were spent. The work fell into four kinds:

**Things that were wrong and are now right.** Two structural dead ends: no candidate could ever qualify, because charter 9.5's three judgment gates had no interface to answer them (DEC-091); and every candidate was then excluded on proximity, because the home-base coordinates DEC-074 made optional had never been filled in (DEC-092). Only one is visible at a time. Charter 14/15's 30-day freshness rule was specified twice and implemented nowhere, so the MVP would have published a page about a real business, and drafted a message to its owner, from evidence of any age (DEC-089). A published demonstration could not be taken down from the application at all (DEC-090). A redirect escaped the SSRF hostname denylist entirely (DEC-088). An approved outreach message could be edited after approval and sent under it (DEC-101).

**Things that were claimed and are now proven.** Every reputation figure in this repository was computed before `reputation-scoring-v1` existed as code. They reproduce — the calibration set (DEC-086) and both Phase 5 prospects (DEC-087), the latter to the hundredth. DEC-038's accessibility baseline went from prose to enforced (DEC-084, DEC-093).

**Things that were retrieved and never read.** Mobile responsiveness, `web-opportunity-v2`'s largest factor at 30 points, was sitting unread in every PageSpeed response HORUS already paid for (DEC-097). Two obsolete-appearance indicators were sitting in page text already fetched and stored (DEC-098).

**One thing that was measured honestly for the first time.** The pipeline ran end to end, on real business data, and reproduced DEC-073's live figure to within 0.1 (DEC-092).

## Known weaknesses carried forward

- **The home-base coordinates are the Stamford city centroid, not the operator's address.** Written for validation and labelled as such in the config file. The 5/15/30-mile bands are the shortlist's first ranking key, so a centroid can misassign one. **These must be replaced before any real prospect decision.**
- **DEC-088's finding F4 is open.** An analyst that can read retained evidence and fetch an arbitrary public URL has a working exfiltration channel through hostile review text. DEC-099 forbids wiring further agent tools until it is closed or explicitly accepted.
- Three of `web-opportunity-v2`'s five factors and four of seven obsolete-appearance indicators remain unmeasured. Coverage is now stated rather than implied (DEC-098).
- DEC-018's 3-page review cap means every candidate is `partial_data`; for a business with 314 reviews that is a 9% sample (DEC-092).
- FUNCTIONAL_DESIGN §6's six named views do not exist as views; the interface is a workflow shell with appended panels.
- Search does not paginate to `TARGET_QUALIFIED`/`MAX_EXAMINED` — one request, capped at 20.
- Working prospect state beyond the operator's judgment is still in memory only.
- The Electron main process and preload bridge are not covered by interaction tests; real keyboard traversal and focus are unverified.

## Evidence

- [`../DECISIONS.md`](../DECISIONS.md) — DEC-083 through DEC-101.
- [`2026-08-08_phase-6-first-real-pipeline-run.md`](2026-08-08_phase-6-first-real-pipeline-run.md) — the first end-to-end run.
- [`../SECURITY_REVIEW.md`](../SECURITY_REVIEW.md) — six findings, two fixed, one hardened, one open.
- 406 automated tests passing; lint, `tsc -b`, `vite build`, `tsc -p tsconfig.electron.json` clean on macOS.

## What Phase 6 does not authorise

No real prospect, no publication, no outreach. DEC-004's two gates are unchanged, and the SEASONS EATS concept published in Phase 5 remains live and untouched.
