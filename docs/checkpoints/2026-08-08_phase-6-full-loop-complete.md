# Checkpoint: Phase 6 — Charter §4's Full Loop Built, End to End

- Date: 2026-08-08
- Phase: 6 — Validation and Hardening (**continues the 2026-08-08 partial checkpoint from earlier the same day; the phase is still not complete**)
- Owner: Javier Napoles, founder and sole operator of HORUS
- Approval status: **not approved.** Recorded as evidence of work performed in one continuous working session, not as a completed phase, and not as a request to accept DEC-080 through DEC-082 as a bundle — each stands on its own in `docs/DECISIONS.md`.

## Why this is a partial checkpoint

This checkpoint supersedes nothing and completes nothing. It exists because, in the hours since [`2026-08-08_phase-6-real-mvp-pipeline.md`](2026-08-08_phase-6-real-mvp-pipeline.md) was written, the three pieces that checkpoint listed as entirely unbuilt — real Cloudflare publication, outreach composition, and the tracker — were all built in the same session, and charter §4's workflow now runs from a search to a tracked follow-up for the first time. That is a large enough change in what the application can do that it shouldn't wait for some future "Phase 6 complete" checkpoint to be written down.

`AGENT_ARCHITECTURE.md`'s validation sequence steps 4–8 remain exactly where they were on 2026-08-07. This checkpoint does not touch them.

## Outcome achieved

**Charter §4's complete workflow — "one search → one qualified prospect → one approved live demonstration → one approved outreach → one trackable sales opportunity" — now exists as real, tested code, reachable from the interface, for the first time.** Before today, the search-through-demonstration-preview portion existed (per the earlier checkpoint); publication, outreach, and the tracker did not exist in any form.

Three real, consequential capabilities were added, each behind its own explicit operator gate:

- **Real Cloudflare Pages publication** (DEC-080), via the operator's own already-authenticated Wrangler CLI, gated behind a required "I approve publishing this demonstration publicly" checkbox. This is the first action anywhere in the application with a real, public, lasting consequence.
- **Real outreach composition and Gmail handoff** (DEC-081): a drafted subject/body referencing only the business's own verified name, category, and real published URL; a second, distinct approval checkbox; `shell.openExternal` opens a real Gmail compose window in the operator's browser; a separate "I sent it" action records the operator's own send declaration, since HORUS has no way to observe an actual send.
- **The tracker** (DEC-082): a pure projection over the durable event log that DEC-080 and DEC-081 write to, showing every prospect with a real publication, an opened outreach handoff, a declared send, or a scheduled follow-up — the follow-up date and note always operator-supplied, never scheduled or inferred by HORUS (DEC-030).

Both of DEC-004's approval gates are now real, distinct, and enforced by the interface requiring an explicit checkbox before either consequential IPC channel is ever invoked — not a single combined gate, and not something an agent or automated process can satisfy on the operator's behalf (DEC-045).

## Included scope

Everything in the 2026-08-08 partial checkpoint's included scope, plus:

- Real Cloudflare Pages publication via Wrangler CLI subprocess, with URL extraction from Wrangler's own output (DEC-080).
- A durable `demonstration.published` event on successful publish — the first piece of this entire feature arc (DEC-076 onward) that writes to SQLite rather than staying in-memory, because a live public URL is a real, lasting consequence.
- A pure outreach-draft content generator, honest that DEC-027's language-selection rule cannot yet be applied for real — no review or reply text is retrieved anywhere in the codebase (DEC-081).
- A real Gmail compose handoff via `shell.openExternal`, wiring the previously-unused `buildGmailComposeHandoff` for the first time.
- An operator send-declaration action, and durable `outreach.gmail_handoff_opened` / `outreach.declared_sent` events.
- `persistence.ts`'s `listEvents`, the first read-back of the domain-events table by anything other than a test.
- A pure tracker projection (`src/domain/tracker.ts`) and a `follow_up.scheduled` event, operator-supplied only.
- A collapsed-by-default tracker panel in the interface.

## Out of scope

- `AGENT_ARCHITECTURE.md` validation steps 4–8, unchanged since 2026-08-07.
- The remaining 3 of 5 `web-opportunity-v2` factors (unchanged since the earlier checkpoint).
- DEC-025's real-photos-or-labelled-placeholders rule — the demonstration preview is still text-only; DEC-078's screenshot capture exists in the same view but is not wired into the demonstration itself.
- Any outcome field for a completed follow-up (a visit happened, a call happened, what was learned) — DEC-030 anticipated this ("the tracker must accept a visit as a follow-up type alongside its outcome and date"); only the date and note are recorded so far, never an outcome.
- Editing or deleting a scheduled follow-up. A new `follow_up.scheduled` event naturally supersedes an earlier one for the same prospect (the projection takes the latest), but there is no explicit "cancel" action.
- Cross-session prospect identity beyond SerpApi's own `data_id` field, which is only as stable as SerpApi's own listing identifiers.
- DEC-027's language selection, in substance — still English-only, honestly labelled as such rather than a completed feature.
- UI/UX design. Still exactly where DEC-036 left it, per the operator's own repeated, explicit deferral.

## Validation performed

| Check | Result | Evidence |
| --- | --- | --- |
| Automated tests | 190 of 190 passing across 26 files | `npx vitest run`, isolated sandbox, 2026-08-08 |
| Lint | 0 warnings, 0 errors on 64 files | `oxlint src electron tests`, isolated sandbox |
| Type checking | Clean | `tsc -b` and `tsc -p tsconfig.electron.json`, isolated sandbox |
| Production build | Clean | `vite build`, isolated sandbox |
| Real Cloudflare publication | **Not yet exercised live** | Built and unit-tested against a fake `spawnImpl` (DEC-080); deliberately not run against the operator's real Cloudflare account without their explicit go-ahead |
| Real outreach/Gmail handoff | **Not yet exercised live** | Built and unit-tested (DEC-081); `shell.openExternal` has never actually opened a browser window from this code |
| Tracker | **Not yet exercised live** | Built and unit-tested (DEC-082); depends on real events existing from a real publish/outreach run, which hasn't happened yet |
| Everything listed as "not yet exercised live" in the earlier 2026-08-08 checkpoint | **Still not yet exercised live** | Proximity (DEC-074), shortlist ranking (DEC-075), prospect selection (DEC-076), discovery caching (DEC-077), screenshot capture (DEC-078), demonstration preview (DEC-079) — none of these changed status since the earlier checkpoint |
| One live-caught defect during this session | Fixed | An early `buildTrackerView` created a tracker entry for any event whose aggregate type was recognized, even when its event type wasn't. Caught by its own test before shipping, not in production; the fix is now covered by that same test. |

## Known limitations

- **Nothing in this checkpoint's new scope has been run against real infrastructure.** Publication has never actually deployed to Cloudflare from this code; the Gmail handoff has never actually opened a browser; the tracker has never displayed a real recorded prospect. All three are verified only against fakes and unit tests in an isolated sandbox.
- **The Wrangler URL-extraction regex is unverified against Wrangler's current real output format.** If Wrangler's CLI output has changed since the operator's Phase 5 manual run, a successful deploy could still report `url: null` — the UI handles this by directing the operator to check the deploy output or dashboard, but this exact path has not been observed.
- **DEC-027's language rule is not implemented in substance.** Every outreach draft is English regardless of the business, honestly labelled as a limitation rather than silently wrong, but still a real gap if the target market's Spanish-speaking business population (charter's own stated context for Stamford/Norwalk) is contacted.
- **The tracker has no outcome field.** A follow-up date and note exist; nothing records what actually happened at that follow-up.
- Every limitation listed in the earlier 2026-08-08 checkpoint that wasn't specifically addressed here (retroactive caching, URL-safety denylist scope, demonstration images) still applies unchanged.

## Related decisions

DEC-080 through DEC-082 — all accepted, each with the operator's own direct instruction or delegation recorded in its own entry in `docs/DECISIONS.md`. DEC-068 through DEC-079 remain as recorded in the earlier checkpoint.

## Next authorized step

None automatically. Two real choices remain open, unchanged in kind from the earlier checkpoint, but now covering more surface area:

1. **Live-test the entire pipeline** — run a real search, score real candidates, select a real prospect, publish a real demonstration, open a real Gmail draft, and record a real follow-up, confirming every piece built across both of today's checkpoints actually works together against real infrastructure and real data.
2. **Move to UI/UX** — the operator's own stated condition ("al tener el mvp funcionando nos ponemos con la UI/UX") is arguably met now that the full loop is built, though not yet proven live.

No public concept, prospect contact, or outreach is authorized by this checkpoint. Both DEC-004 approval gates remain fully intact — the interface requires an explicit, distinct checkbox before either the publish or the outreach IPC channel can be invoked, and no code path exists that bypasses either one.
