# Checkpoint: Phase 6 — A Real, End-to-End MVP Pipeline (Discovery Through Demonstration Preview)

- Date: 2026-08-08
- Phase: 6 — Validation and Hardening (**continues the work of the 2026-08-07 partial checkpoint; the phase is still not complete**)
- Owner: Javier Napoles, founder and sole operator of HORUS
- Approval status: **not approved.** Recorded as evidence of work performed in one working session, not as a completed phase or a request for sign-off on all twelve decisions below at once. Each decision (DEC-068 through DEC-079) stands on its own in `docs/DECISIONS.md` and should be reviewed there if any one of them needs to be revised.

## Why this is a partial checkpoint

`docs/checkpoints/` holds evidence of completed phases. Phase 6 is not complete: `AGENT_ARCHITECTURE.md`'s validation sequence steps 4–8 remain exactly where the 2026-08-07 checkpoint left them, and — new as of this session — real publication to Cloudflare Pages and real outreach composition do not exist in any form, wired or unwired.

This document exists because a full day's work turned charter sections 9 through 15 from paper specification into real, tested, mostly live-verified code, in one continuous session, and that shouldn't sit undocumented until some future "Phase 6 complete" checkpoint that may be weeks away. It should be superseded by a full Phase 6 checkpoint, not treated as one.

## Outcome achieved

At the start of this session, `reputation-scoring-v1` and `web-opportunity-v2` existed only as charter prose, and `App.tsx`'s search screen had never called the real SerpApi integration — both flagged as the two largest gaps between the specification and the running application. Neither is true anymore.

**The full charter §9–§12 pipeline now runs on real data, mostly confirmed live in the packaged app:** a real SerpApi discovery search (with a G1/G2 quick screen, review-history retrieval, and a real `reputation-scoring-v1` computation) and a real, partial `web-opportunity-v2` measurement (PageSpeed performance, HTTPS, a `tel:`-link check) were both exercised live by the operator, spending real credits, on 2026-08-07 (DEC-073) — the reputation score for a real business (TwoGen Landscaping) correctly withheld qualification despite exceeding the 70-point threshold, the first live proof that the operator-judgment gates (G4–G6) actually gate rather than being silently satisfied.

Built on top of that in this session: real proximity from the home base (DEC-074), a real shortlist ranked exactly per DEC-013/DEC-017's rule (DEC-075), a consolidated in-memory prospect-selection record (DEC-076), a live-discovered correction to a request-size bug plus real discovery-result caching so a repeat search stops spending credits (DEC-077), an on-request website screenshot shown next to a selected prospect (DEC-078), and — the last piece added today — a real, pure, unpublished demonstration-site HTML generator that turns a selected prospect's already-verified evidence into a previewable single-page concept site (DEC-079).

**What this adds up to:** for the first time, an operator can open the app, run a real search, watch qualification and opportunity get scored from real evidence, see a real ranked shortlist, select a prospect, look at their website, and preview what a demonstration for them could look like — all without spending an unbounded number of credits, without ever inventing a fact, and without any step crossing either of DEC-004's two approval gates. What is still missing is everything on the far side of "preview": real Cloudflare publication and the outreach draft.

## Included scope

- `reputation-scoring-v1` (charter §9) as real, tested code — six gates, five factors, the 9.6 missing-data principle (DEC-068).
- Real SerpApi discovery reachable from the interface, separate from the Phase 4 fixture workflow (DEC-069).
- A G1/G2 quick screen from bare listing data (DEC-070).
- Real review-history retrieval and end-to-end reputation scoring per candidate (DEC-071).
- Real `web-opportunity-v2` measurement for 2 of 5 factors: PageSpeed performance and no-HTTPS (DEC-072).
- Live confirmation of all of the above in the packaged app, spending real SerpApi and PageSpeed credits (DEC-073).
- Real proximity from a configured home base, straight-line distance and charter-band bucketing (DEC-074).
- Real shortlist ranking — proximity band, then web-opportunity, then reputation as tiebreak (DEC-075).
- A consolidated, in-memory, read-only prospect-selection record (DEC-076).
- A corrected `maxExamined` cap and real discovery-result caching, so a repeat category+city search costs nothing (DEC-077).
- An on-request website screenshot, captured via a hidden Electron window, shown only in the prospect record (DEC-078).
- A real, pure demonstration-site HTML generator with a live preview, honest about every missing field (DEC-079).
- A candidate `phone` field, needed for the demonstration's click-to-call link.

## Out of scope

- Real Cloudflare Pages publication. `electron/integrations/cloudflare.ts` still only builds a manual-dashboard-upload plan; nothing in the app can deploy the DEC-079 preview anywhere.
- The DEC-004 publication approval gate. There is no publish action yet for it to gate.
- Outreach composition, language selection (DEC-027), and the Gmail draft handoff (DEC-041) for a real prospect. `openLocalGmailHandoff` exists only in the Phase 4 fixture workflow.
- The DEC-004 outreach approval gate, for the same reason.
- Business photos or labelled placeholders in the demonstration (DEC-025) — the current preview is text-only.
- Persisting a selected prospect, a generated demonstration, or a published concept to SQLite. Everything from DEC-076 onward is in-memory and discarded on app close, by deliberate, stated choice.
- `AGENT_ARCHITECTURE.md` validation steps 4–8, unchanged since 2026-08-07.
- 3 of 5 `web-opportunity-v2` factors (mobile responsiveness, the other six obsolete-appearance indicators, a real broken-link crawl, commercial ineffectiveness) — still `unmeasured` by design.
- UI/UX design. Explicitly deferred at the operator's own repeated instruction ("no nos compliquemos aun... despues al tener el mvp funcionando nos ponemos con la UI/UX") until this pipeline works end to end.

## Validation performed

| Check | Result | Evidence |
| --- | --- | --- |
| Automated tests | 170 of 170 passing across 23 files | `npx vitest run`, isolated sandbox, 2026-08-08 |
| Lint | 0 warnings, 0 errors on 58 files | `oxlint src electron tests`, isolated sandbox |
| Type checking | Clean | `tsc -b` (renderer) and `tsc -p tsconfig.electron.json` (electron), isolated sandbox |
| Production build | Clean | `vite build`, isolated sandbox |
| Real discovery search | Confirmed live | 20-candidate landscaping/Norwalk search, real evidence snapshot, real credit spent (DEC-073) |
| Real G1/G2 screening | Confirmed live | Correctly suppressed measurement for a no-website listing (DEC-073) |
| Real reputation scoring | Confirmed live | TwoGen Landscaping: 71.1/100, G1–G3 passed, G4–G6 correctly `insufficient_data`, `qualified: false` despite exceeding the threshold (DEC-073) |
| Real web-opportunity measurement | Confirmed live | Same candidate: 8.2/12 performance, rest honestly `unmeasured`, real `tel:` link found (DEC-073) |
| Real discovery-result caching | **Not yet exercised live** | Built and unit-tested (DEC-077); the operator has not yet run the same search twice in the packaged app to confirm the second run spends no credit |
| Real proximity | **Not yet exercised live** | Built and unit-tested (DEC-074); requires `home_base.latitude`/`longitude` configured in `config/local.json`, not yet confirmed present |
| Real shortlist ranking | **Not yet exercised live** | Built and unit-tested (DEC-075) |
| Prospect selection | **Not yet exercised live** | Built and unit-tested (DEC-076) |
| Website screenshot capture | **Not yet exercised live** | Built and unit-tested (DEC-078); depends on Electron's offscreen `BrowserWindow.capturePage`, only provable in the real packaged app |
| Demonstration preview | **Not yet exercised live** | Built and unit-tested (DEC-079) |

## Known limitations

- **Nothing past "preview" exists.** The pipeline stops at a demonstration the operator can look at inside the app. Publishing it anywhere, or drafting outreach about it, requires new work and new approval-gate wiring that has not started.
- **Discovery caching is not retroactive.** Snapshots stored before DEC-077 recorded their request as a bare URL string, not the new `{ requestUrl, category, city }` object the cache lookup matches against — those older snapshots will never be served from cache.
- **The website-screenshot and website-inspection URL safety checks are a literal hostname denylist, not DNS-aware.** Documented as proportionate for a single-operator tool, not a solved SSRF defense, since DEC-059/066; DEC-078 inherits the same limitation via its own copy in `electron/agent/url-safety.ts`.
- **The demonstration preview has no images.** DEC-078's screenshot capture is available in the same view but is not wired into the demonstration itself — doing so would need its own decision under DEC-025's real-photos-or-placeholders rule.
- **Five of the six pieces built after DEC-073 have never been run in the actual packaged app**, only against unit tests and fakes in the isolated sandbox — see the validation table above. This checkpoint does not claim otherwise.
- UI/UX remains exactly where DEC-036 left it — restrained-editorial-workbench, not the dark/"game-like" direction the operator expressed interest in and then explicitly deferred.

## Related decisions

DEC-068 through DEC-079 — all accepted, each with the operator's own delegation or direct instruction recorded in its own entry in `docs/DECISIONS.md`.

## Next authorized step

None automatically. Two real choices are open, and neither is decided by this checkpoint:

1. **Live-test what's built but unverified** — configure `home_base.latitude`/`longitude`, run `npm run dev`, and exercise caching, proximity, shortlist, prospect selection, screenshot capture, and the demonstration preview against real data, the same way DEC-073 verified the earlier pieces.
2. **Continue building toward the full charter §4 loop** — real Cloudflare publication behind the DEC-004 gate, then outreach composition and the Gmail handoff behind the second DEC-004 gate, then the tracker.

No public concept, prospect contact, or outreach is authorized by this checkpoint. Both DEC-004 approval gates remain fully intact and unbypassed — there is, as of this checkpoint, still no code path in the repository that could publish or contact a business even if invoked.
