# CLAUDE.md

Read this before doing anything in this repository.

## What this project is

**HORUS** is a company being founded by Javier Napoles, sole operator. **HORUS V1** is the internal tool he uses to acquire the company's first client. It is **not** a product for sale, and no design decision may assume it will become one (DEC-003).

One complete run: enter a business category and a city → find local businesses with strong reputations but weak web presence → rank them with evidence → the operator picks one → build a customized demonstration website from verified public information → operator approves → publish it → prepare an outreach handoff → operator composes and sends in Gmail → record the prospect and next follow-up.

**One search → one qualified prospect → one approved live demonstration → one approved outreach → one trackable sales opportunity.**

## Hard rules — do not violate these

These are not preferences. Each is a recorded decision with reasoning behind it.

1. **Nothing reaches a business owner without explicit operator approval.** Two blocking gates: before publishing a demonstration, before sending outreach (DEC-004).
2. **HORUS never sends email.** It holds no Gmail API credential. After explicit approval it opens a compose handoff for the operator, who sends personally in Gmail (DEC-041).
3. **Never invent information in a demonstration.** No services, credentials, claims, testimonials, pricing, or history that is not traceable to a verified public source. Gaps stay empty or use labelled placeholders (DEC-005). Images are the business's own public photos or clearly labelled placeholders — never generic imagery presented as their work (DEC-025).
4. **Never commit `config/local.json`.** It contains the operator's home address and API credentials. A home address committed once stays in Git history forever (DEC-035).
5. **Operator flags never auto-reject.** Judgment-dependent signals — suspected review manipulation, franchise ownership, reputational risk — are surfaced for the operator to decide. Only objective, reproducible conditions auto-reject (DEC-008).
6. **A sample proves presence, never absence.** If partial data does not show something, that is `insufficient_data`, not evidence the thing is missing. Never score a business poorly because retrieval failed (charter 9.6, 10.4).
7. **Changing a scoring parameter creates a new model version.** Never edit `reputation-scoring-v1` or `web-opportunity-v2` in place. Stored results record the version that produced them (DEC-007, DEC-011).
8. **Accepted decisions are never edited to hide the past.** Add a superseding decision and mark the old one `superseded by DEC-XXX`. See DEC-011 and DEC-013 for examples.
9. **Agents never own consequential actions.** Claude may analyze evidence and prepare structured drafts, but scoring, freshness, state transitions, approvals, publication authorization, Gmail handoff, and delivery declaration remain enforced by HORUS code. No agent may publish or contact a business (DEC-045).

## Where things are

| File | Contents |
| --- | --- |
| `docs/PROJECT_CHARTER.md` | The full specification, 18 sections. The source of truth. |
| `docs/DECISIONS.md` | 121 decisions with context, options, and consequences. Read before changing anything structural. |
| `docs/CURRENT_STATE.md` | What is done, what is next, known weaknesses. Update at the end of every working session. |
| `docs/ROADMAP.md` | Seven phases, 0 through 6. All complete and approved. |
| `docs/AGENT_ARCHITECTURE.md` | The local-agent architecture, safety boundary, and acceptance criteria. Evaluated and closed by DEC-099. |
| `docs/SECURITY_REVIEW.md` | Phase 6 security and prompt-injection review (DEC-088). Finding F4 is open. |
| `docs/checkpoints/` | Evidence of completed phases. Immutable once written. |
| `config/local.json` | Operator config. Gitignored. Never read its contents into documentation. |
| `config/local.json.example` | Structure, no values. Committed. |

Charter sections worth knowing by number: **9** reputation scoring, **10** web opportunity, **11** ranking, **12** search scope, **13** data sources and cost, **14** storage, **15** publication, **17** outreach, **18** interface.

## Current state

**Every phase of `ROADMAP.md` — 0 through 6 — is complete and approved.** Phase 6 closed on 2026-08-09; evidence in `docs/checkpoints/2026-08-09_phase-6-validation-and-hardening.md`.

Charter §4's loop runs end to end on real data: a real search reached a demonstration preview for the first time on 2026-08-08 (DEC-092), and the deterministic model reproduced a figure recorded live four days earlier to within 0.1. Every reputation number in this repository has been reproduced from retained evidence through the real code (DEC-086, DEC-087). 465 automated tests, 0 lint warnings/errors, clean build — last confirmed by the operator's own toolchain run on 2026-08-11.

**What remains is not a phase.** HORUS V1 exists to acquire the company's first client, and that means taking a real prospect through to publication and outreach. That crosses both DEC-004 gates, needs the operator's explicit approval per action, and cannot be delegated to an agent or inferred from a general go-ahead.

### Before any real prospect decision

**The home base coordinates in `config/local.json` are the Stamford city centroid, not the operator's address.** They were written for pipeline validation and are labelled as such in the file. The 5/15/30-mile bands are the shortlist's first ranking key, so a centroid can put a business in the wrong band — and nothing on screen would show it. Replace them first.

### Known weaknesses

- Two of `web-opportunity-v2`'s five factors are unmeasured, and six of seven obsolete-appearance indicators cannot be checked at all on an http-only site, because the page inspector is https-only. Coverage is stated rather than implied (DEC-098), but this is the dimension that *orders* the shortlist, and every figure recorded before 2026-08-09 was computed with its largest factor absent (DEC-109).
- DEC-018's 3-page review cap means every candidate is `partial_data`; for a business with 314 reviews that is a 9% sample.
- Search does not paginate to `TARGET_QUALIFIED`/`MAX_EXAMINED` — one request, capped at 20.
- `SECURITY_REVIEW.md`'s finding F4 is open: hostile review text could route the analyst to an attacker URL. DEC-099 keeps the agent off the critical path and forbids wiring further tools until this is closed or explicitly accepted.
- The selected prospect (`selectedProspectId`) is still not restored when the application reopens. Web-opportunity audits and reputation scores now are, as of DEC-117 — closing half of the gap this line used to describe.
- A candidate's trailing-window status reads `complete_data` when SerpApi reports no further pages, however few reviews that was (DEC-108).

### Numbers most likely to be wrong

- The 70-point reputation qualification threshold.
- The 400-review saturation point in reputation Factor 2.
- Reputation Factor 4 awarding full credit for merely holding steady — the known weak point in the score floor.
- `NO_SITE_BASE` 50 and `SOCIAL_ONLY_BASE` 60: a reasoned commercial ordering, never observed.
- The 5 / 15 / 30-mile proximity bands.

## Conventions

**Cost discipline.** SerpApi bills one credit per request. The free tier is 250/month (DEC-032). Evaluate cheapest-first: gates G1 and G2 come free with the candidate listing, so filter on those before spending credits on review retrieval. Cache everything — once a business's raw responses are stored, any number of model versions can be scored against them for free (DEC-020).

**Storage separates the immutable from the derived.** Raw API responses are never edited or overwritten; a later retrieval creates a new snapshot beside the old one. Scores are derived and recomputable. Rescoring must never be able to corrupt evidence (charter 14).

**Provenance on everything.** Every stored item records its source, the request that produced it, the retrieval timestamp, and for derived values the model version and configuration used. Time-based factors compute against the stored retrieval timestamp, never the current clock, so a run stays reproducible.

**Evidence over scores.** Any number shown to the operator must be accompanied by what produced it. The operator judges prospects; HORUS shows its work.

**Documentation is part of the work.** A structural change means a new decision in `docs/DECISIONS.md` and an update to `docs/CURRENT_STATE.md`. A completed phase means a checkpoint.

## Working with the operator

Ask before doing anything with lasting consequences. This project was built by asking one focused question at a time and recording the answer — that method is the reason the documentation is worth anything.

Flag ambiguity rather than resolving it silently. If a request is underspecified, say what the readings are and which one you would pick.

State what is uncertain. Several numbers in this repository are guesses that are labelled as guesses; keep them labelled that way until data replaces them.
