# Technical Foundation — Phase 3

## Document status

- Status: approved architecture; implementation in progress
- Phase: 3 — Technical Foundation
- Owner: Javier Napoles, founder and sole operator of HORUS
- Started: 2026-08-06
- Approval: Javier Napoles, 2026-08-06 (DEC-042)
- Scope: validates technical constraints and defines the foundation. A test-only Cloudflare Worker is the sole external publication; it contains no business data, contact, or operational capability.

## 1. Confirmed foundation requirements

| Requirement | Technical implication |
| --- | --- |
| One operator, one laptop, persistent visible state | Local-first application; no hosted product account system. |
| Immutable raw evidence, recomputable derived data | Raw source files must be append-only and separate from derived records. |
| Inspectable data that survives code changes | The store cannot be an opaque browser cache alone. |
| Demonstrations publish only after approval | A draft build must not automatically reach Cloudflare Pages. |
| Outreach must never be sent by HORUS | No program path invokes Gmail's send endpoint. Credential capabilities require separate verification. |
| Configuration and secrets remain local | Credentials belong in ignored local configuration or an OS-backed secret store, never the repository. |

## 2. Approved local-first architecture

| Layer | Proposal | Rationale |
| --- | --- | --- |
| Operator application | Electron desktop shell with React, TypeScript, and Vite | Delivers the approved visual application on one laptop while retaining Node tooling for local APIs, filesystem access, OAuth callback handling, and test automation. |
| Application/service boundary | Typed local IPC between renderer and main process | Keeps credentials, filesystem writes, outbound requests, and approval-enforced commands outside the visible UI. |
| Derived records and event history | Local SQLite database | Durable, queryable, inspectable state for runs, candidates, score versions, approvals, demonstrations, outreach, and follow-up events. |
| Immutable raw evidence | Content-addressed JSON files under a local data directory, referenced by SQLite manifests | Preserves verbatim source responses independently of rescoring and makes evidence directly inspectable. |
| Scoring and workflow logic | Pure TypeScript modules, isolated from UI and storage | Allows deterministic rescoring from a retained snapshot and focused automated tests for gates, factors, ranking, and state transitions. |
| Demonstrations | Static, source-backed site bundle generated from the approved template | Keeps demos backend-free, portable, and compatible with the concept-site constraints. |
| Demonstration deployment | Cloudflare Pages Direct Upload after an approved publication command | Direct Upload accepts a locally built asset folder and avoids an automatic deployment on every Git push. The production client remains deferred; Phase 3 validates a dashboard-based, test-only upload without installing Wrangler. |

### Why not a hosted web application

The charter requires one local operator and directly inspectable, durable evidence. A hosted application would introduce accounts, remote storage, access control, and a wider privacy surface without solving a V1 need. It also makes a local Gmail OAuth flow and publication gate less direct.

### First proposed repository layout

```text
apps/
  operator/                 Electron + React operator interface
  demo-template/            static concept-site generator/template
packages/
  domain/                   scoring, ranking, workflow states, validation
  persistence/              SQLite schema and raw-evidence manifest access
  integrations/             SerpApi, PageSpeed, compose-handoff, Cloudflare adapters
data/                       ignored local raw evidence and SQLite database
config/local.json           ignored operator configuration
```

This is the selected V1 architecture (DEC-042).

## 3. Gmail compose-only verification — resolved

The charter's safety rule is correct: HORUS must not send email. The planned mechanism, however, is not available exactly as stated through the Gmail API.

Google's `users.drafts.create` endpoint accepts the `gmail.compose` scope. Google's current scope documentation defines `gmail.compose` as permission to **manage drafts and send email**. Therefore, the API can create drafts, but the same granted credential has send capability. There is no Gmail API scope that grants draft creation while technically withholding send capability.

### Consequence

The following statement in DEC-028 cannot be implemented literally: that a draft-only OAuth scope makes HORUS technically incapable of sending. An application can still be designed never to call a send endpoint, but that is an application-level safeguard, not a credential-level impossibility.

### Options considered

| Option | Preserves Gmail draft creation | Credential is technically unable to send | Trade-off |
| --- | --- | --- | --- |
| A. Gmail API with `gmail.compose` | Yes | No | Retains the exact Gmail-draft experience, but DEC-028 must be superseded to state that sending is prevented by HORUS's command boundary and tests, not OAuth scope. |
| B. Browser compose handoff after approval | No API-created draft | Yes — HORUS receives no Gmail credential | HORUS opens a prefilled Gmail compose experience only after approval; the operator owns the draft/send action in Gmail. The workflow changes from “create a Gmail draft” to “prepare a compose handoff.” |
| C. Remove Gmail integration from V1 | No | Yes | Safest technical boundary, but the operator copies the approved message into Gmail manually. |

**Approved: Option B (DEC-041).** HORUS prepares a compose handoff only after outreach approval and holds no Gmail OAuth credential. This preserves the manual Gmail step while keeping HORUS technically unable to send. The exact compose-handoff implementation remains a Phase 3 task.

## 4. Cloudflare deployment verification

Cloudflare Pages supports deploying a prebuilt folder through Direct Upload. Direct Upload is appropriate when assets are built locally, but a Pages project created with Direct Upload cannot later switch to Git integration; automatic Git deployments are therefore intentionally excluded for the demo project. This aligns with the blocking publication gate: only an approved publication command produces a deployable folder and invokes the eventual approved deployment mechanism.

On 2026-08-06, the operator explicitly approved a dashboard-based test. A single 939 B static HTML file, with no business data, contact details, or operational capability, was uploaded through the Cloudflare Dashboard and deployed as a Worker at `https://spring-night-6be6.javiernpls.workers.dev`. No Cloudflare API token or Wrangler client was used.

This proves that an approved local asset can be manually uploaded and deployed through the dashboard. It does **not** change DEC-022's Pages target or select a production deployment client: the dashboard flow created a test Worker on `workers.dev`, not the future Pages project.

## 5. Phase 3 implementation sequence

1. [x] Record the architecture and Gmail decision; update the superseded decision.
2. [x] Scaffold the Electron application, preload boundary, quality checks, and ignored local-data paths.
3. [x] Implement the SQLite schema, raw-evidence manifest, and append-only event model.
4. [x] Implement deterministic tests for approval-state transitions and persistence invariants.
5. [x] Add non-production adapter contracts for SerpApi, PageSpeed, Gmail compose handoff, and Cloudflare. Plans stay in the Electron main-process boundary, carry no credentials, and require raw-evidence retention or an approval ID as applicable.
6. [x] Verify the credential-free Gmail handoff with test-only messages and no business contact. On 2026-08-06, Gmail opened the approved compose with the expected subject and body; it rejected bare `example.invalid` as a recipient, and the Send control was not invoked. The local contract now rejects that malformed input. A final approved test opened `horus-test@example.invalid` (a syntactically valid address in the reserved `.invalid` domain) with the expected recipient, subject, and body. Send was not invoked in either test; both compose windows remain under the operator's control in Gmail.
7. [x] Verify a Cloudflare Dashboard Direct Upload using a test-only static asset. The resulting Worker is public at `https://spring-night-6be6.javiernpls.workers.dev`; it is not a business demonstration or the future Pages project.

## 6. Foundation validation

Completed locally on 2026-08-06:

- `npm test` — 4 test files and 10 tests pass: workflow approval transitions, immutable raw-evidence and append-only event storage, credential-free Gmail compose-handoff URL construction and recipient validation, and non-production integration contracts.
- `npm run build` — React/Vite renderer and Electron main/preload TypeScript compile successfully.
- `npm run lint` — passes for renderer, Electron, and test code.
- `npm run dev` — Vite starts on the fixed local port and the Electron application opens with the initialized SQLite/evidence store.

The local application does not call any external service and does not read operator credentials.

### Dependency audit

The production dependency audit is clean: 0 known vulnerabilities. Wrangler was evaluated for Cloudflare Direct Upload but is not installed in the foundation: version 4.119.0 reported 3 development findings through Miniflare and Undici, while npm's proposed downgrade to 4.35.0 reported 4 high findings including command injection in `wrangler pages deploy`. The downgrade was immediately removed, and the full installed dependency audit is again clean: 0 known vulnerabilities.

The Phase 3 dashboard test completed without Wrangler on 2026-08-06. The production Pages deployment client is intentionally unresolved; no Cloudflare API token is stored by HORUS.

## 7. Sources consulted

- Google, [Gmail `users.drafts.create` authorization](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create): the draft-create endpoint accepts `gmail.compose`.
- Google, [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes?hl=es-419): `gmail.compose` can manage drafts and send email; it is a restricted scope.
- Google, [OAuth 2.0 for desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app): desktop OAuth supports a local loopback redirect with a Desktop client and recommends a system browser.
- Cloudflare, [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/): Wrangler deploys prebuilt assets; Direct Upload projects cannot later switch to Git integration.
