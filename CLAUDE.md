# CLAUDE.md

Read this before doing anything in this repository.

## What this project is

**HORUS** is a company being founded by Javier Napoles, sole operator. **HORUS V1** is the internal tool he uses to acquire the company's first client. It is **not** a product for sale, and no design decision may assume it will become one (DEC-003).

One complete run: enter a business category and a city → find local businesses with strong reputations but weak web presence → rank them with evidence → the operator picks one → build a customized demonstration website from verified public information → operator approves → publish it → draft an outreach email → operator approves and sends → record the prospect and next follow-up.

**One search → one qualified prospect → one approved live demonstration → one approved outreach → one trackable sales opportunity.**

## Hard rules — do not violate these

These are not preferences. Each is a recorded decision with reasoning behind it.

1. **Nothing reaches a business owner without explicit operator approval.** Two blocking gates: before publishing a demonstration, before sending outreach (DEC-004).
2. **HORUS never sends email.** It creates Gmail drafts using a **draft-only OAuth scope**. Never request `gmail.send`. The permission is what makes rule 1 unbreakable rather than merely promised (DEC-028).
3. **Never invent information in a demonstration.** No services, credentials, claims, testimonials, pricing, or history that is not traceable to a verified public source. Gaps stay empty or use labelled placeholders (DEC-005). Images are the business's own public photos or clearly labelled placeholders — never generic imagery presented as their work (DEC-025).
4. **Never commit `config/local.json`.** It contains the operator's home address and API credentials. A home address committed once stays in Git history forever (DEC-035).
5. **Operator flags never auto-reject.** Judgment-dependent signals — suspected review manipulation, franchise ownership, reputational risk — are surfaced for the operator to decide. Only objective, reproducible conditions auto-reject (DEC-008).
6. **A sample proves presence, never absence.** If partial data does not show something, that is `insufficient_data`, not evidence the thing is missing. Never score a business poorly because retrieval failed (charter 9.6, 10.4).
7. **Changing a scoring parameter creates a new model version.** Never edit `reputation-scoring-v1` or `web-opportunity-v2` in place. Stored results record the version that produced them (DEC-007, DEC-011).
8. **Accepted decisions are never edited to hide the past.** Add a superseding decision and mark the old one `superseded by DEC-XXX`. See DEC-011 and DEC-013 for examples.

## Where things are

| File | Contents |
| --- | --- |
| `docs/PROJECT_CHARTER.md` | The full specification, 18 sections. The source of truth. |
| `docs/DECISIONS.md` | 35 decisions with context, options, and consequences. Read before changing anything structural. |
| `docs/CURRENT_STATE.md` | What is done, what is next, known weaknesses. Update at the end of every working session. |
| `docs/ROADMAP.md` | Seven phases. Phase 1 is active. |
| `docs/checkpoints/` | Evidence of completed phases. Immutable once written. |
| `config/local.json` | Operator config. Gitignored. Never read its contents into documentation. |
| `config/local.json.example` | Structure, no values. Committed. |

Charter sections worth knowing by number: **9** reputation scoring, **10** web opportunity, **11** ranking, **12** search scope, **13** data sources and cost, **14** storage, **15** publication, **17** outreach, **18** interface.

## Current state

Phase 0 is complete and approved (2026-08-05). **Phase 1 — Calibration is authorized and not started.**

There is no application code. Nothing has been retrieved, scored, or contacted.

### What Phase 1 is for

Every threshold in both scoring models was reasoned in the abstract. None has met a real business. Phase 1 retrieves and scores 30–50 businesses in Stamford and Norwalk and sets the thresholds from what is observed.

**Phase 1 does not authorize contacting anyone.** No demonstration is published, no outreach is drafted. First real contact is Phase 5 and needs its own approvals.

### Suggested first step

Before writing a full calibration harness, run one small retrieval — a single category in Stamford — and measure actual credit consumption against the ~48 estimate in charter 13.3. That estimate came from documentation, not measurement, and everything downstream depends on it.

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
