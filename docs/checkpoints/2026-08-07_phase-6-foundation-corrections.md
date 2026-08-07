# Checkpoint: Phase 6 — Foundation Corrections and Agent Boundary

- Date: 2026-08-07
- Phase: 6 — Validation and Hardening (**steps 1–3 only; the phase is not complete**)
- Owner: Javier Napoles, founder and sole operator of HORUS
- Approval status: **not approved.** Recorded as evidence of work performed, not as a completed phase.

## Why this is a partial checkpoint

`docs/checkpoints/` holds evidence of completed phases. Phase 6 is not complete: steps 4 to 8 of the `AGENT_ARCHITECTURE.md` validation sequence — the shadow-mode replay of Finescape and SEASONS EATS, the comparison against the operator's historical decisions, and the recorded retain/revise/reject decision on the agent runtime — have not been started.

This document exists because steps 1 to 3 produced a verified result and five unplanned findings that should not sit undocumented until the phase closes. It should be superseded by a full Phase 6 checkpoint, not treated as one.

## Outcome achieved

**The application runs.** Before today it had never started successfully on the operator's machine, and `horus.sqlite` had never been created. The renderer-to-store chain now executes end to end: a stage advance in the interface reaches the Electron main process, passes validation, and produces an append-only domain event in SQLite.

The three foundation findings that `AGENT_ARCHITECTURE.md` step 1 requires to be corrected before agents may invoke tools are corrected, and the provider-neutral agent boundary and single bounded analyst task of steps 2 and 3 are implemented and unit-tested.

## Included scope

- Credential removed from retrieval provenance; the executed URL and the recorded URL are built as separate objects (DEC-046).
- One `raw_snapshots` row per retrieval, with a `user_version` migration; content remains stored once on disk (DEC-047).
- Main-process validation of renderer-submitted workflow state, with approvals append-only, stages advancing one at a time, and recorded events immutable (DEC-048).
- Provider-neutral `LocalAgentRuntime`, forbidden-tool enforcement, the section 9 failure taxonomy, and the bounded opportunity-analyst task with its output parser (DEC-049).
- Four corrections required to make the application start at all: build output layout (DEC-051), CommonJS preload (DEC-052), and IPv4 dev-server binding (DEC-055).

## Out of scope

- Verification of the Claude Code command shape, flags, authentication behaviour and error wording against a real installation. `classifyFailure` matches on strings that have not been observed.
- Wiring the agent boundary to an IPC handler or the interface. The modules are tested in isolation; nothing calls them.
- Steps 4 to 8 of the validation sequence.
- Any remedy for DEC-053 or DEC-054.
- `reputation-scoring-v1`, which remains unimplemented (DEC-050).

## Validation performed

| Check | Result | Evidence |
| --- | --- | --- |
| Automated tests | 53 of 53 passing across 9 files | `npm run test`, 2026-08-07 |
| Live Claude Code invocation | Succeeded from an isolated directory; found DEC-058 | `claude -p` run by the operator, 2026-08-07 |
| Lint | 0 warnings, 0 errors on 25 files | `oxlint src electron tests` |
| Type checking and build | Clean | `tsc -b`, `vite build`, `tsc -p tsconfig.electron.json` |
| DEC-047 migration | Executed | `PRAGMA user_version` returns `1` |
| DEC-047 schema | Correct | `.schema raw_snapshots` shows `payload_hash TEXT NOT NULL`, no `UNIQUE`, both indexes present |
| Renderer-to-store chain | Working | A stage advance produced `domain_events = 1`, `workflow.snapshot_saved` |
| Application launch | Working | Window opens, renderer loads, preload exposes `window.horus` |
| DEC-048 refusal path | **Not exercised** | A deliberately malformed save has not been attempted |
| Claude Code contract | Checked against documentation only | Anthropic CLI reference and headless docs, 2026-08-07 (DEC-056) |
| Claude Code runtime | **Not exercised** | Claude Code is installed on the operator's machine but was never invoked by HORUS |

## Known limitations

- **The interface advances independently of the record.** While the preload was broken, the workflow was walked from stage 01 to stage 07 — past the demonstration approval gate — with nothing persisted. `App.tsx` calls `setWorkflow` and `persist` with no relationship between them. In validation mode the consequence is cosmetic; the same mechanism would operate in a real run. Recorded as DEC-053; remedy deferred deliberately.
- The store writes to Electron's generic `Application Support/Electron` directory, shared with any other unpackaged Electron application on the machine (DEC-054).
- The renderer runs with no Content-Security-Policy (DEC-054).
- `WORKFLOW_STEPS` is declared twice, in `electron/workflow-state.ts` and `src/domain/representative-workflow.ts`, pending the command-based refactor.

## A correction to the historical record

The Phase 3 and Phase 4 checkpoints describe SQLite-backed persistence and state resumption. Those descriptions were accurate about the code and its automated tests, but the application had never run, so `appendRawSnapshot` and `saveWorkflowState` had only ever executed inside tests. The Phase 1 calibration evidence lives in `cache/raw/serpapi/google_maps/` as 362 timestamped files, not in the SQLite store.

Per the convention that accepted records are never edited to hide the past, those checkpoints are left unchanged. This note is the correction.

## Related decisions

DEC-046 through DEC-058 — all currently `proposed` and none approved by the operator.

## Next authorized step

None. The operator should first review and accept, revise or reject DEC-046 through DEC-058.

The live invocation this checkpoint performed confirmed the runtime contract (DEC-056, DEC-057) and found a real gap: `task.allowedTools` was validated as data but never reached Claude Code's actual permission surface. `--permission-mode dontAsk` now contains that, but the designed control — real HORUS evidence-reading tools registered and allow-listed by name — does not exist yet. A genuine analyst task attempted today would run with no tool access at all. Implementing those tools, or accepting an analyst that can reason only from what is inlined in its prompt, is the next real decision before step 3 can be considered functionally complete.

No public concept, prospect, or outreach is authorized by this checkpoint.
