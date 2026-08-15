# HORUS — Gap Analysis vs. `agentic_orchestration.md`

**Date:** 2026-08-11
**Status:** Analysis only — nothing in this document has been implemented.
**Purpose:** Answer "¿qué le hace falta a HORUS para funcionar como describe este documento?" precisely, before any code changes, following this project's own established practice (analyze first, decide, then implement).

Scope confirmed with the operator via three direct questions before writing this:
1. The qualification score will be **agent-decided**, not the current deterministic `reputation-scoring-v1`/`web-opportunity-v2` gate. This reverses part of DEC-045 ("agents never own a score") and needs its own explicit decision record before implementation — see §5.
2. Discovery → Qualification → Website generation → QA will run **automatically**, without a human step in between.
3. Publishing the generated demo **still requires the operator's own review and approval** — DEC-004 gate one is kept, not consolidated into the document's single end-of-pipeline gate. Outreach still requires the operator's own review and approval too (DEC-004 gate two, unchanged).

So the target architecture is the document's pipeline, with the document's own "single gate before Send" replaced by HORUS's existing two gates (before publish, before send) — both preserved as they exist today.

---

## 1. What already exists, mapped to the document's agents

| Document's agent | HORUS today | Gap |
|---|---|---|
| Discovery Agent | `discovery-ipc.ts` — real SerpApi search, deterministic, no LLM | None functionally; it is not "agentic" in the document's sense, but it produces the same output shape. No change needed. |
| Qualification Agent | `reputation-scoring-v1` + `web-opportunity-v2`, both deterministic; `opportunity_analyst` (DEC-049/DEC-128) reads evidence and *proposes* review candidates but never decides qualified/rejected | Full gap. Nothing today lets an agent compute a score or decide qualified/rejected. This is the DEC-045 reversal (§5). |
| Website Agent | `buildDemonstrationSite` (deterministic HTML/CSS) + `concept_composer` (DEC-129, content/structure decisions) | Partial. The generation itself exists and is agent-*assisted*, but nothing triggers it automatically for a newly-qualified lead — today it is a manual button per prospect. |
| QA Agent | Nothing. The only quality check today is the operator's own read of the iframe preview before the DEC-004 publish gate. | Full gap — new agent role needed (§4). |
| Outreach Agent | `buildOutreachDraft` — deterministic template (DEC-081) | Not in scope of the operator's three answers above; left deterministic for now. Flagged in §7 as a later, separate decision if wanted. |
| Orchestrator | Nothing. The operator manually sequences every step by clicking through Search → Score → Judge → Shortlist → Select prospect → Generate demo → Compose → Publish → Outreach → Gmail. | Full gap — this is the actual missing piece, and the biggest one (§3). |
| Lead state machine | No single persisted entity. State is split across React component state (lost on app close in several views) and a handful of durable events (judgment recorded, demonstration published, outreach opened, declared sent, follow-up scheduled). | Full gap (§2). |
| Retry/failure framework | None generically. Each step succeeds or fails in isolation; the operator decides what to do next by hand. | Full gap (§6). |

---

## 2. Missing piece 1 — a persisted Lead entity and state machine

Everything else in this document depends on this existing first. Today a "lead" is implicitly the combination of a discovery candidate record plus whatever scores/judgments/evidence happen to be attached to its `dataId` — there is no single row anywhere that says "this lead is at step X."

**What's needed:**
- A new durable aggregate, `lead`, keyed by `dataId` (the same id every other part of HORUS already uses), with an explicit `status` field using this document's own vocabulary: `DISCOVERED → QUALIFYING → QUALIFIED | REJECTED → WEBSITE_GENERATING → WEBSITE_GENERATED → QA_IN_PROGRESS → QA_FAILED | QA_PASSED → OUTREACH_READY → APPROVED → SENT`, plus `FAILED`.
- Written as append-only events on the existing `store.appendEvent`/event-sourcing mechanism (same pattern `judgment.record`, `demonstration.published`, `outreach.declared_sent` already use) — no new storage engine, reusing `persistence.ts`.
- A projection function (`buildLeadState`, same shape as `buildTrackerView`/`buildShortlist` already use) that replays a lead's events into its current status — never a second mutable copy that could drift from the event log, matching this codebase's existing "evidence over scores, replay over storage" convention.
- Resumability: on app restart, the Orchestrator (§3) reads every lead's current status from this projection and knows exactly where each one is — same principle `session:restore` already applies to search results.

---

## 3. Missing piece 2 — the Orchestrator itself

This is deterministic code, **not an LLM agent** — the document is explicit about this ("The Orchestrator is not counted as a specialized worker agent"), and it matches this project's own `AGENTIC_ARCHITECTURE_AUDIT.md` recommendation from earlier in this session (a plain sequencer, not a model).

**What's needed:**
- A new module, e.g. `electron/orchestrator/run-lead.ts`, that:
  1. Reads a lead's current status (§2).
  2. Dispatches the next step's task (Qualification agent, Website Agent, QA Agent) based on that status.
  3. Validates the returned output against that step's schema (same `parseXOutput` pattern the analyst/composer already use).
  4. Appends the resulting status-transition event.
  5. Stops and waits when it reaches a human gate (publish, send) — these remain exactly the manual `ProspectRecord.tsx` buttons and checkboxes that exist today; the Orchestrator does not press them.
- A trigger surface: most likely a "Run pipeline" action per lead (or per batch of newly-discovered candidates), rather than the individual "Auto-screen," "Analyze candidates," and "Compose with agent" buttons built earlier this session — those become internal steps the Orchestrator calls, not separate operator actions. This is a real UX change worth its own confirmation before building (see §7, question 1).
- Bounded retries per DEC's own convention: `MAX_AGENT_RETRIES = 2`, `MAX_QA_RETRIES = 2` as the document recommends, configurable constants, not hard-coded magic numbers buried in logic.

---

## 4. Missing piece 3 — the Qualification Agent (the DEC-045 reversal)

This is the one the operator explicitly asked to make agent-decided rather than deterministic.

**What changes:**
- A new bounded agent role, `qualification_agent` (extends `AgentRole`, which today only has `opportunity_analyst | concept_composer | outreach_composer`).
- Its task receives the same evidence `opportunity_analyst` already reads (discovery snapshot, review history, web-opportunity measurement) — no new retrieval, reusing `buildCandidateEvidenceReferences`.
- Its schema-validated output includes an `opportunity_score` (0–100) and a `qualified: boolean`, plus `reasons: string[]` citing evidence snapshot ids — same evidence-citation enforcement pattern `parseAnalystOutput`/`parseComposerOutput` already use, so a claim against evidence the task never received is still rejected outright.
- **This is the part that needs its own decision record before it is built**, not folded quietly into a larger one: DEC-045 currently reads "agents never own consequential actions" and has been interpreted throughout this session to include "agents never compute a score — HORUS does." A new decision (draft: DEC-130) needs to state precisely: the qualification score becomes agent-decided *specifically for the automatic pipeline path*; the existing manual scoring UI (`reputation-scoring-v1`/`web-opportunity-v2`, the G4/G5/G6 judgment gates) stays exactly as it is for any lead the operator is working by hand outside the pipeline. The two are not the same score and should not be presented as if they were — the manual path's deterministic score should probably remain visible alongside the agent's decision for comparison, not replaced by it, so a operator spot-checking the pipeline can see when they disagree.
- Worth naming plainly: an agent-decided `qualified: false` now means a lead is dropped before a human ever sees it (Rule 1 in the document: don't generate websites for unqualified leads). That is a real behavior change from today, where nothing is ever auto-rejected (DEC-008). This should be visible somewhere — a "rejected by qualification agent" list the operator can audit, not a silent drop, so a mistaken rejection is discoverable.

---

## 5. Missing piece 4 — the QA Agent

**What's needed:**
- A new bounded agent role, `qa_reviewer`.
- Input: the generated demonstration's own HTML (or a structured description of it) plus the original business evidence, so it can check business-specificity, not just generic markup quality.
- Output: `status: 'QA_PASSED' | 'QA_FAILED'`, `issues: string[]`, `severity`, matching the document's own shape.
- On `QA_FAILED`, the Orchestrator (§3) feeds the issues back into a second `concept_composer` run (or a dedicated correction task) and re-runs QA, up to `MAX_QA_RETRIES`. After that, the lead's status becomes `FAILED` and it is flagged for the operator, exactly as the document specifies — not silently dropped.
- Since QA happens *before* the publish gate (per the operator's confirmed answer in §0), this agent is a pre-filter for the operator's own review, not a replacement for it — consistent with keeping DEC-004 gate one.

---

## 6. Missing piece 5 — retry/failure handling as a shared framework

**What's needed:**
- A small, shared result type every orchestrated step returns — success, retryable failure, or terminal failure — instead of each integration inventing its own ad hoc failure shape (which is currently the case: `discovery-ipc.ts`, `web-opportunity-ipc.ts`, and the agent runtime each have their own `{ status: 'failed', reason, detail }` variants that are similar but not identical).
- The Orchestrator is the only thing that reads this and decides retry vs. stop vs. flag-for-review, matching the document's Rule ("agents should not independently control the global workflow").

---

## 7. Two things worth deciding before implementation starts

1. **UX shape of the trigger.** Today the operator presses four separate buttons per prospect (Auto-screen, Analyze candidates, Compose with agent, Generate demonstration preview) plus two approval gates. Moving to an Orchestrator likely means collapsing the first three into one "Run pipeline for this lead" action (or one for a whole batch of fresh discovery candidates) that runs qualification → website generation → QA automatically and then stops at the existing publish gate. Worth confirming this replaces those buttons rather than sitting alongside them, since having both would be confusing.
2. **Outreach Agent.** Not in scope of what was just confirmed — `buildOutreachDraft` stays a deterministic template unless the operator separately asks to change it. Flagged here only so it is not assumed silently either way.

---

## 8. Recommended build order

Matching this session's own established pattern (smallest safe piece first, each one a reviewable decision before the next):

1. Lead state machine (§2) — pure plumbing, no behavior change yet, nothing to approve beyond the shape.
2. Qualification Agent + its own decision record (§4) — the one genuine policy reversal; should be approved on its own before anything is built on top of it.
3. Orchestrator skeleton wired to discovery → qualification only (§3) — stops there, so it can be tested end to end without yet touching website generation or QA.
4. QA Agent + correction loop (§5), then wire the Orchestrator through website generation → QA → the existing publish gate.
5. Retry/failure framework (§6), formalized once real failure modes from steps 1–4 are observed rather than guessed upfront.

Nothing above has been built yet. This is the plan for review.
