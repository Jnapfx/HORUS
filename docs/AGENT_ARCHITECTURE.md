# Agent Architecture — Phase 6 Proposal

## Document status

- Status: proposed implementation design; runtime direction accepted in DEC-045
- Phase: 6 — Validation and Hardening
- Owner: Javier Napoles, founder and sole operator of HORUS
- Recorded: 2026-08-07
- Implementation status: not started

## 1. Objective

Phase 6 will evaluate whether locally orchestrated agents can make the completed HORUS workflow repeatable without weakening its evidence, approval, privacy, or cost boundaries.

The first pilot uses the operator's existing Claude subscription through a locally authenticated Claude Code installation. It does not add an Anthropic API key or usage-metered Anthropic API billing. This is an internal, single-operator evaluation, not a deployment model for a product offered to other users.

Claude supplies reasoning and drafting only. HORUS remains the authority for workflow state, calculations, evidence, approvals, and external actions.

## 2. Runtime shape

```text
Electron / React operator interface
        |
        v
Electron main-process coordinator
        |
        +-- SQLite state and append-only events
        +-- immutable source snapshots
        +-- deterministic scoring and validation
        +-- approved HORUS tools
        |
        v
Claude Code local subprocess
        |
        v
structured proposal returned to HORUS
```

The renderer never invokes Claude directly. It requests a bounded task from the Electron main process. The main process selects the allowed evidence and tools, starts Claude Code non-interactively, validates the returned structure, records the run, and presents the result to the operator.

An illustrative subprocess shape is:

```text
claude -p <bounded-task> --output-format json --max-turns <limit>
```

The exact command, flags, authentication behavior, and licensing suitability must be verified during Phase 6 before HORUS depends on them. No shell-composed command may contain operator input; an implementation must spawn the executable with an explicit argument array.

## 3. What an agent is in HORUS

An agent consists of:

1. A named task and a narrow system instruction.
2. A selected set of retained evidence references.
3. An allowlist of HORUS tools.
4. A required structured output schema.
5. Turn, time, and concurrency limits.
6. A recorded model/runtime identity and execution result.

Conversation history is not authoritative memory. SQLite records and immutable evidence snapshots remain the source of truth.

## 4. Initial agent responsibilities

Phase 6 should begin with one Claude runtime executing three separately bounded roles. Separate long-running agents are added only if evaluation shows that context isolation materially improves correctness.

### 4.1 Opportunity analyst

- Summarizes retrieved business and website evidence.
- Identifies observable signals and missing information.
- Proposes which candidate deserves operator review.
- Links every observation to retained evidence.
- Never calculates or changes model scores independently; deterministic HORUS code owns scores and gates.

### 4.2 Concept composer

- Receives only approved facts, source references, placeholders, and template options.
- Produces structured content and presentation choices, not unrestricted application code.
- Maps each business-specific element to evidence.
- Cannot publish a demonstration.

### 4.3 Outreach composer

- Receives the approved prospect record, actual published URL, language decision, and fresh evidence.
- Produces a source-bounded draft with claim-to-evidence references.
- Cannot open Gmail, mark a message sent, or contact a business.

A later verifier role may review outputs for unsupported claims, stale evidence, contradictions, and missing provenance. It is not required for the first pilot.

## 5. Deterministic boundaries

The following remain ordinary code and are never delegated to model judgment:

- Reputation, web-opportunity, and proximity calculations.
- Search stopping rules and model versions.
- Freshness calculation and blocking status.
- Workflow state transitions.
- Approval creation, validation, and invalidation after edits.
- Publication authorization.
- Gmail handoff authorization.
- Delivery declaration and follow-up state.
- Evidence storage and provenance.

The main process must validate all agent outputs and sensitive commands. Renderer state or model text is never proof of approval.

## 6. Tool and permission policy

An agent receives only the tools required for its current role. Initial read/analysis tools may include:

- Read a selected evidence snapshot.
- Request a previously authorized SerpApi or PageSpeed operation.
- Inspect a selected public website without submitting forms.
- Run deterministic scoring against stored inputs.
- Save an agent draft or recommendation.
- Request operator review.

No agent receives tools named or equivalent to:

- Send email.
- Publish without an independently validated approval.
- Delete or retire a deployment without operator confirmation.
- Read raw credential values.
- Change scoring-model parameters.
- Modify or overwrite immutable evidence.

External page content is untrusted data. Instructions found in a business website, source response, or retrieved document never override HORUS instructions or permissions.

## 7. Subscription-backed Claude boundary

The first pilot intends to use Claude Code authenticated locally with the operator's existing eligible Claude subscription. This avoids adding a separately metered Anthropic API integration during the initial internal evaluation, but it does not mean unlimited or offline operation.

Expected constraints:

- Claude Code requires internet access and a valid local login.
- Subscription usage limits and temporary capacity limits still apply.
- HORUS begins with a single execution queue rather than parallel Claude processes.
- Authentication expiry or a usage limit produces a visible, recoverable blocked state.
- HORUS records no Claude credential and never returns authentication material to the renderer.
- The subscription-backed path is re-evaluated before any multi-user, hosted, distributed, or customer-facing use.

The runtime must sit behind a provider-neutral interface so a future version can use the Anthropic API, another hosted provider, or a local model without changing the workflow and approval layers.

## 8. Traceability for every run

Each agent execution records:

- Agent role and instruction version.
- Runtime/provider and available model identity when reported.
- Start and completion timestamps.
- Prospect, workflow, and evidence snapshot IDs supplied.
- Tool names invoked and sanitized inputs/results.
- Structured output or failure state.
- Turn count and usage information exposed by the runtime.
- Operator acceptance, revision, or rejection.

Prompts and logs must never retain API keys, home-base details unrelated to the task, browser sessions, or other credentials.

## 9. Failure behavior

The application must distinguish at least:

- Claude Code not installed.
- Authentication required or expired.
- Subscription usage limit reached.
- Runtime timeout or cancellation.
- Invalid or incomplete structured output.
- Tool denied or unavailable.
- Evidence missing or stale.
- Agent result awaiting operator review.

Failure never advances the prospect, creates an approval, publishes a demonstration, opens Gmail, or marks outreach sent. A failed task remains retryable without duplicating completed external work.

## 10. Phase 6 validation sequence

1. Correct the credential, evidence-snapshot, and main-process validation findings before agents can invoke tools.
2. Add a provider-neutral local agent boundary and a Claude Code availability/authentication check.
3. Implement one bounded analyst task with structured output and no external side effects.
4. Replay the retained Finescape and Sons and SEASONS EATS cases in shadow mode.
5. Compare agent observations with retained evidence and the operator's historical decisions.
6. Add concept and outreach composition only after the analyst path passes evaluation.
7. Run one supervised prospect only after the operator separately authorizes real use.
8. Record whether the subscription-backed runtime is reliable enough to retain, needs an API/provider change, or should be removed.

## 11. Acceptance criteria

The agent evaluation is complete only when:

- No usage-metered model API is required for the initial Claude Code pilot.
- Every business-specific claim in evaluated output references retained evidence.
- Missing data remains missing and is never converted into a negative claim.
- Deterministic scores match recomputation from the stored inputs.
- Agents cannot create or bypass publication and outreach approvals.
- A material edit invalidates the relevant prior approval.
- Claude unavailability is visible and recoverable without state corruption.
- Finescape remains below qualification and cannot advance to outreach.
- The SEASONS EATS replay preserves the recorded qualification uncertainty and approval boundaries.
- The operator records an explicit decision to retain, revise, or reject the agent runtime.

## 12. Explicit non-goals

- No autonomous business contact.
- No unattended publication.
- No browser automation that presses Gmail Send.
- No multi-user Claude login sharing.
- No hosted agent service in the initial pilot.
- No assumption that a personal subscription is a permanent production deployment mechanism.
- No agent-generated scoring-model change without a new recorded model version and operator decision.

## 13. Primary external references

- Anthropic, [Claude Code setup](https://code.claude.com/docs/en/getting-started): supported local installation and subscription/Console authentication requirements.
- Anthropic, [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview): programmatic agent loop, structured integration, tools, permissions, sessions, and subprocess use.

These references were verified on 2026-08-07. Product access and terms may change; Phase 6 must re-check them before implementation.
