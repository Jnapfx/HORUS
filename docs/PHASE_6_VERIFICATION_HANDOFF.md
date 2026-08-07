# Phase 6 — Verification Handoff

- Written: 2026-08-07
- Status: **static and runtime verification complete for steps 1–3; steps 4–8 not started**
- Author note: the machine that wrote this batch had no working shell, so the code was written without being executed once. The operator ran the checks afterwards on macOS. Sections below are marked with what has since been observed.

This document exists so that the gap between "written" and "verified" is not quietly closed by whoever runs it next.

## 1. Static checks — PASSED 2026-08-07

```bash
cd apps/operator
npm install
npm run lint
npm run test
npm run build
```

Observed: oxlint clean on 27 files, **52 of 52 tests passing** across 9 files, `tsc -b`, `vite build` and `tsc -p tsconfig.electron.json` all clean.

This does not verify runtime behaviour. Vitest transpiles through esbuild, which strips types without checking them; the type checking came from the separate `build` step, and neither executes the migration or the Electron main process.

## 2. Correction — there is no database to back up

An earlier version of this document instructed the operator to back up `raw_snapshots` before first launch, on the assumption that it held the Phase 1 calibration evidence. **That assumption was wrong**, and the instruction is withdrawn.

`find ~/Library/Application\ Support -name horus.sqlite` returns nothing. The database has never been created, because the application has never successfully started (see section 3). The Phase 1 evidence lives instead in `cache/raw/serpapi/google_maps/` as 362 timestamped `.json` and `.headers` files, written by something outside this application.

Consequences worth stating plainly:

- The DEC-047 migration will run against an empty database on first launch. The risk this document ranked highest is inert.
- `appendRawSnapshot` has only ever executed inside tests. The persistence layer described in `CURRENT_STATE.md` as "SQLite-backed local persistence" is implemented and tested, but has never been the system of record for anything.
- This corroborates DEC-050. If the 30-business calibration and the SEASONS EATS score were produced while the application had never run, that entire pipeline executed outside the repository.

## 3. Build output layout — FIXED 2026-08-07 (DEC-051)

`tsconfig.electron.json` set `rootDir: "."`, so TypeScript preserved the `electron/` path segment and emitted to `build/electron/electron/main.js`. This broke two things at once:

- `package.json`'s dev script launches `build/electron/main.js`, which did not exist.
- `main.ts` loads the renderer with `path.join(dirname, '../../dist/index.html')`. With the nested output, `dirname` was `build/electron/electron`, so that path resolved to `build/dist` instead of `apps/operator/dist`.

Together these are why the application had never started. Corrected to `rootDir: "./electron"`, which makes both paths resolve. Verified: `rm -rf build && npm run build` now emits `main.js`, `preload.js`, `persistence.js`, `workflow-state.js`, `agent/` and `integrations/` directly under `build/electron/`.

## 4. Runtime verification — PASSED 2026-08-07

The application now starts, and the full renderer-to-store chain works for the first time in the project's history. Getting there required three further corrections that were not part of the original Phase 6 plan:

| Symptom | Cause | Decision |
| --- | --- | --- |
| Application never started | Build emitted one directory too deep | DEC-051 |
| `window.horus` undefined, every save a silent no-op | Preload compiled as ESM; Electron's sandboxed loader requires CommonJS | DEC-052 |
| `ERR_CONNECTION_REFUSED` on the dev server | Vite bound to IPv6 `localhost`, Electron requested IPv4 `127.0.0.1` | DEC-055 |

Observed after the corrections:

- `PRAGMA user_version` is `1`. The line this document ranked as the riskiest, `database.pragma(\`user_version = ${SCHEMA_VERSION}\`)`, works.
- `.schema raw_snapshots` shows `payload_hash TEXT NOT NULL` with no `UNIQUE`, and both indexes present. **DEC-047 is verified at runtime, not merely by reading.**
- A stage advance produced `domain_events = 1`, `workflow.snapshot_saved`. The preload, the IPC channel and the DEC-048 main-process validation all execute.

Not yet exercised: a deliberately malformed save, which should be refused and recorded as `workflow.state_rejected`. That is the one DEC-048 path still unobserved.

## 5. The defect this exposed

While the preload was broken, the operator walked the interface from stage 01 to stage 07 — past the demonstration approval gate — while the store recorded nothing at all. The interface displayed an approved demonstration and offered to publish it.

This is not the preload bug. `App.tsx` calls `setWorkflow(next)` and `persist(next)` with no relationship between them, so the interface advances whether or not the record was accepted. In validation mode the consequence is cosmetic; in a real run the same mechanism operates. Recorded as DEC-053, remedy deliberately not attempted in this batch.

Two further hardening findings are recorded in DEC-054: the store writes to Electron's generic `Application Support/Electron` directory rather than a HORUS-specific one, and the renderer runs with no Content-Security-Policy.

## 3. What is most likely to break

Ordered by my estimate of probability, highest first. These are the places where reading is weakest.

1. **`Database.Database` as a type in `persistence.ts`.** `migrateRawSnapshots` is typed with the namespace interface from `@types/better-sqlite3`. If `tsc -p tsconfig.electron.json` rejects it, the fix is a local type alias or `Parameters<typeof createHorusStore>`-style indirection. Cosmetic, not behavioural.
2. **`database.pragma(\`user_version = ${SCHEMA_VERSION}\`)`.** better-sqlite3 accepts pragma assignment as a string; if it objects, use `database.pragma('user_version = 1')` literally or `database.exec()`.
3. **The `build/electron` output layout.** `tsconfig.electron.json` sets `rootDir: "."` with `include: ["electron"]`, which should emit to `build/electron/electron/main.js`, but `package.json`'s dev script launches `build/electron/main.js`. I could not reconcile these by reading. If `npm run dev` fails to find main.js, this pre-existed my changes — I added files under `electron/` and `electron/agent/`, which follow whatever the existing rule turns out to be.
4. **`as const satisfies` on `APPROVAL_CHAIN`.** Requires TypeScript 5.0+. `package.json` pins `~6.0.2`, so this should be fine, but it is the newest syntax I used.
5. **Vitest discovering `tests/workflow-state.test.ts` and `tests/agent-boundary.test.ts`.** They follow the existing naming and import style exactly, so this should work, but it is the cheapest thing to confirm.

## 4. What was written

### Foundation corrections — validation sequence step 1

| Finding | File | Decision |
| --- | --- | --- |
| Credential in provenance URL | `electron/integrations/serpapi.ts` | DEC-046 |
| Re-retrieval discarded silently | `electron/persistence.ts` | DEC-047 |
| Renderer state accepted unvalidated | `electron/workflow-state.ts`, `electron/main.ts` | DEC-048 |

### Agent boundary — validation sequence steps 2 and 3

| Module | Contents |
| --- | --- |
| `electron/agent/runtime.ts` | Provider-neutral `LocalAgentRuntime`, forbidden-tool list, failure taxonomy from section 9, injectable spawn, Claude Code implementation |
| `electron/agent/analyst-task.ts` | The single bounded analyst task and its output parser |

The parser is where section 11's acceptance criteria become mechanical: a claim citing evidence the task never received is rejected, an uncited claim is rejected, any score-like field is rejected, and an absence may only be recorded as `insufficient_data`.

## 6. What is NOT done

Phase 6 is not complete. These remain:

- **Verify against a live invocation.** The command shape, flags, output envelope and exit-code behaviour are checked against Anthropic's published CLI documentation (DEC-056), and the working-directory isolation and `--system-prompt` replacement (DEC-057) are unit-tested with real temporary directories — but no Claude Code process has actually been run by this code. The specific failure strings `classifyFailure` matches, and whether `--system-prompt` and an isolated `cwd` are honoured exactly as documented, remain assumptions from reading. This is the one thing standing between here and step 4.
- **Wire the boundary in.** The agent modules are tested in isolation and nothing calls them. No IPC handler, no interface, no `store` integration.
- **Steps 4 to 8.** The Finescape and SEASONS EATS shadow-mode replay, the comparison against the operator's historical decisions, concept and outreach composition, and the recorded retain/revise/reject decision. All require execution.
- **The command-based refactor.** DEC-048 hardens the save channel but the renderer still submits state rather than commands. Section 5 wants the main process to compute every transition. Until then, `WORKFLOW_STEPS` is declared in two places.

## 7. Blocked by something outside Phase 6

`reputation-scoring-v1` is not implemented (DEC-050). This blocks one Phase 6 acceptance criterion outright: "deterministic scores match recomputation from the stored inputs" cannot be checked for reputation, because there is nothing to recompute with. The shadow-mode replay can compare web-opportunity numbers and evidence links, but it cannot verify that Finescape's 48.1 or SEASONS EATS's 73.06 reproduce.

Decide whether the replay proceeds on that basis before running it.

## 8. Approvals unchanged

Nothing in this batch touches the two blocking gates, and nothing here authorises a new public concept, a new prospect, or any outreach. The agent boundary is deliberately incapable of publishing or contacting: `FORBIDDEN_TOOL_PATTERNS` is enforced before a subprocess is reachable, and an `AgentRunOutcome` is inert data awaiting operator review.
