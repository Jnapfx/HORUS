import { app, BrowserWindow, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOpportunityAnalyst } from './agent/analyst-ipc.js'
import { runConceptComposer } from './agent/concept-composer-ipc.js'
import { createEvidenceToolWiring } from './agent/evidence-tool-wiring.js'
import { nodeSpawn } from './agent/node-spawn.js'
import { createClaudeCodeRuntime } from './agent/runtime.js'
import { createWorkingDirectoryPreparer } from './agent/working-directory.js'
import { buildGmailComposeHandoff } from './compose-handoff.js'
import { OperatorConfigMissing, getHomeBaseCoordinates, loadOperatorConfig, requirePageSpeedApiKey, requireSerpApiKey } from './config.js'
import { extractCandidatesForRestore, runRealDiscoverySearch } from './discovery-ipc.js'
import { listIntegrationContracts } from './integrations/contracts.js'
import { createHorusStore } from './persistence.js'
import { advanceLeadQualification, retryLeadQualification } from './orchestrator/run-lead.js'
import { advanceLeadDemonstration } from './orchestrator/run-demonstration.js'
import { readLeadState } from './orchestrator/lead-store.js'
import { publishDemonstrationSite, removeDemonstrationSite } from './publish-ipc.js'
import { runReviewHistoryRetrieval } from './review-retrieval-ipc.js'
import { readAllRetainedRuns, readLatestRetainedRun } from './review-evidence.js'
import { reconstructMeasurementFromSnapshots, runWebOpportunityMeasurement, type RawSnapshotRecord } from './web-opportunity-ipc.js'
import { captureWebsiteScreenshot } from './website-screenshot.js'
import { WorkflowStateRejected, acceptWorkflowState } from './workflow-state.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f7f8fb',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(dirname, 'preload.cjs'),
    },
  })

  const developmentUrl = process.env.VITE_DEV_SERVER_URL
  if (developmentUrl) {
    void window.loadURL(developmentUrl)
    return
  }

  void window.loadFile(path.join(dirname, '../../dist/index.html'))
}

app.whenReady().then(() => {
  const store = createHorusStore(path.join(app.getPath('userData'), 'data'))
  ipcMain.handle('foundation:status', () => store.getFoundationStatus())
  ipcMain.handle('foundation:integration-contracts', () => listIntegrationContracts())

  // DEC-065. The analyst boundary, reachable from the renderer for the first
  // time — previously only a terminal script (DEC-060) or a manual `claude -p`
  // invocation (DEC-062) could exercise it. This runtime is built once and
  // reused; each call to `agent:analyst:run` is still a single bounded task
  // (AGENT_ARCHITECTURE section 3), never a standing session. The evidence
  // tool points at this app's own store, whose write path (`persistence.ts`)
  // has always used absolute `storage_path` values, so no `evidenceBasePath`
  // is needed here the way the legacy `cache/phase5/horus.sqlite` required
  // (DEC-062, DEC-063).
  const analystRuntime = createClaudeCodeRuntime({
    spawnImpl: nodeSpawn,
    prepareWorkingDirectory: createWorkingDirectoryPreparer(path.join(app.getPath('userData'), 'agent-runs')),
    evidenceTools: createEvidenceToolWiring({
      serverScriptPath: path.join(dirname, 'agent', 'evidence-mcp-server.js'),
      databasePath: store.getFoundationStatus().databasePath,
    }),
  })
  ipcMain.handle('agent:analyst:list-evidence', () => store.listRawSnapshots())
  ipcMain.handle('agent:analyst:list-drafts', () => store.listAgentDrafts())
  ipcMain.handle('agent:analyst:availability', () => analystRuntime.checkAvailability())
  ipcMain.handle('agent:analyst:run', (_event, evidence: { snapshotId: string; source: string; retrievedAt: string }[]) =>
    // Any rejection here (malformed evidence, per assertTaskIsBounded) reaches
    // the renderer as a rejected promise, exactly like `workflow:representative:save`
    // below — the UI is responsible for surfacing it, not this handler.
    // `saveDraft` (DEC-067) only ever receives output that already passed
    // parseAnalystOutput inside runOpportunityAnalyst — never the raw run.
    runOpportunityAnalyst({
      runtime: analystRuntime,
      evidence,
      taskId: `analyst_${Date.now()}`,
      saveDraft: (draft) => store.saveAgentDraft(draft),
    }),
  )
  // DEC-129. `concept_composer`, the second of the three `AgentRole`s made
  // real — reuses `analystRuntime` above rather than building a second
  // `LocalAgentRuntime`: the runtime itself is role-agnostic (it only spawns
  // `claude` with whatever `BoundedAgentTask` it is given), and both roles
  // need the identical evidence-tool wiring. No draft persistence here —
  // unlike the analyst, a composition is only ever used once, inline, to
  // build one demonstration preview; DEC-067's draft store is not extended
  // to this role.
  ipcMain.handle('agent:composer:run', (_event, evidence: { snapshotId: string; source: string; retrievedAt: string }[]) =>
    runConceptComposer({
      runtime: analystRuntime,
      evidence,
      taskId: `composer_${Date.now()}`,
    }),
  )
  // DEC-131. The Orchestrator's own first wired step: DISCOVERED -> QUALIFYING
  // -> QUALIFIED/REJECTED/FAILED, driven by the Qualification Agent (DEC-130).
  // Reuses `analystRuntime` — the runtime is role-agnostic, same reason
  // `agent:composer:run` above reuses it rather than building a second one.
  // `orchestrator:advance-qualification` performs exactly one transition per
  // call and is safe to call again on a lead that has already moved past
  // DISCOVERED (`advanceLeadQualification` reports `status: 'skipped'` rather
  // than erroring), so a renderer trigger can call it once per lead without
  // first checking the lead's current status itself.
  ipcMain.handle('orchestrator:advance-qualification', (_event, input: { dataId: string }) =>
    advanceLeadQualification({ store, runtime: analystRuntime, dataId: input.dataId }),
  )
  // DEC-137. The operator's own explicit "reintentar" action for a lead
  // stuck at FAILED (a real timeout, diagnosed live, left leads with no way
  // back into the pipeline). Only reachable from a button the operator
  // presses — nothing in the automated pipeline calls this.
  ipcMain.handle('orchestrator:retry-qualification', (_event, input: { dataId: string }) =>
    retryLeadQualification({ store, runtime: analystRuntime, dataId: input.dataId }),
  )
  // DEC-140. The Orchestrator's second wired step, and the one that closes
  // the gap `run-lead.ts` documented as unbuildable: QUALIFIED ->
  // WEBSITE_GENERATING -> WEBSITE_GENERATED -> QA_IN_PROGRESS ->
  // QA_PASSED/QA_FAILED, with a bounded correction loop in between. Runs
  // entirely before DEC-004 gate one and touches no publish or outreach
  // channel; its success state, QA_PASSED, means "ready for the operator to
  // review", never "approved". Safe to call on a lead in any other status —
  // it reports `skipped` rather than erroring — and safe to call again on a
  // QA_FAILED lead, which is how the operator retries one the loop could not
  // correct on its own.
  ipcMain.handle('orchestrator:advance-demonstration', (_event, input: { dataId: string }) =>
    advanceLeadDemonstration({
      store,
      runtime: analystRuntime,
      dataId: input.dataId,
      scratchRoot: path.join(app.getPath('userData'), 'qa-runs'),
    }),
  )
  // Read-only: replays a lead's own recorded event history into its current
  // status, per `lead-state.ts`. Costs nothing.
  ipcMain.handle('lead:get-state', (_event, input: { dataId: string }) => readLeadState(store, input.dataId))
  // Real discovery search, distinct from the Phase 4 representative workflow
  // below: this spends a real SerpApi credit and retrieves real business
  // data, so it lives behind its own IPC channel and its own UI surface
  // (App.tsx's "Real discovery search" section) rather than inside the
  // fixture-only stages, which stay accurate to their own "not executed
  // here" notice. See DEC-069.
  const repoRoot = path.join(dirname, '../../../..')
  const operatorConfigPath = path.join(repoRoot, 'config', 'local.json')
  ipcMain.handle('discovery:run', async (_event, input: { category: string; city: string; maxExamined: number; forceRefresh?: boolean }) => {
    try {
      const config = loadOperatorConfig(operatorConfigPath)
      const apiKey = requireSerpApiKey(config)
      return await runRealDiscoverySearch({
        category: input.category,
        city: input.city,
        maxExamined: input.maxExamined,
        forceRefresh: input.forceRefresh,
        apiKey,
        appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
        // DEC-077. Matches on category+city only, case-insensitively; ignores
        // older snapshots stored before this decision, whose `request` field
        // was a plain string rather than `{ requestUrl, category, city }`.
        findCachedSnapshot: (lookup) =>
          store.findLatestRawSnapshot({
            source: 'serpapi.google_maps',
            matches: (request) => {
              if (typeof request !== 'object' || request === null) return false
              const r = request as Record<string, unknown>
              return (
                typeof r.category === 'string' &&
                typeof r.city === 'string' &&
                r.category.trim().toLowerCase() === lookup.category.trim().toLowerCase() &&
                r.city.trim().toLowerCase() === lookup.city.trim().toLowerCase()
              )
            },
          }),
      })
    } catch (error) {
      const reason = error instanceof OperatorConfigMissing ? 'config_missing' : 'config_invalid'
      return { status: 'failed' as const, reason, detail: error instanceof Error ? error.message : String(error) }
    }
  })
  // Review-history retrieval, the second real SerpApi surface (DEC-071),
  // paired with `discovery:run` above. Spends further real credits (one per
  // page, up to the 3-page default) — unless the pages are already retained,
  // in which case DEC-108 serves those and spends nothing.
  // Scoring against `reputation-scoring-v1` happens in the renderer, same
  // layering as `screenListingGates` (DEC-070).
  ipcMain.handle('discovery:fetch-review-history', async (_event, input: { dataId: string; forceRefresh?: boolean }) => {
    try {
      const retainedPages = store.listRawSnapshotsBySource('serpapi.google_maps_reviews')
      // The credential is read lazily: a cache hit must not fail because a key
      // it was never going to use is missing.
      const apiKey = input.forceRefresh || !readLatestRetainedRun(input.dataId, retainedPages)
        ? requireSerpApiKey(loadOperatorConfig(operatorConfigPath))
        : ''
      return await runReviewHistoryRetrieval({
        dataId: input.dataId,
        apiKey,
        appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
        retainedPages,
        forceRefresh: input.forceRefresh,
      })
    } catch (error) {
      const reason = error instanceof OperatorConfigMissing ? 'config_missing' : 'config_invalid'
      return { status: 'failed' as const, reason, detail: error instanceof Error ? error.message : String(error) }
    }
  })
  // Web-opportunity measurement, the third real SerpApi/PageSpeed surface
  // (DEC-072). Spends a real PageSpeed quota unit and makes one real fetch
  // of the candidate's own site. Only two of five `web-opportunity-v2`
  // factors are measurable this way; the rest stay `unmeasured` by design.
  //
  // DEC-117. Unlike review-history retrieval, this had no cache at all until
  // now — every press spent a fresh PageSpeed unit, even for a URL just
  // measured, and nothing was restored on relaunch either. `findCachedSnapshots`
  // is checked first (skipped when `forceRefresh` is set), matching the shape
  // `discovery:run`'s DEC-077 cache and `discovery:fetch-review-history`'s
  // DEC-108 cache already use.
  ipcMain.handle('discovery:measure-web-opportunity', async (_event, input: { url: string; forceRefresh?: boolean }) => {
    try {
      const config = loadOperatorConfig(operatorConfigPath)
      const apiKey = requirePageSpeedApiKey(config)
      return await runWebOpportunityMeasurement({
        url: input.url,
        pagespeedApiKey: apiKey,
        appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
        forceRefresh: input.forceRefresh,
        findCachedSnapshots: () => ({
          pagespeed: store.listRawSnapshotsBySource('pagespeed.mobile'),
          analysis: store.listRawSnapshotsBySource('horus.website-analysis'),
        }),
      })
    } catch (error) {
      const reason = error instanceof OperatorConfigMissing ? 'config_missing' : 'config_invalid'
      return { status: 'failed' as const, reason, detail: error instanceof Error ? error.message : String(error) }
    }
  })
  // DEC-074. Only the derived coordinate pair reaches the renderer — never
  // the street address, city, state, or postal code, which stay in the main
  // process. Proximity math itself runs in the renderer (src/domain/proximity.ts),
  // same layering as reputation and web-opportunity scoring.
  ipcMain.handle('discovery:home-base-coordinates', () => {
    try {
      const config = loadOperatorConfig(operatorConfigPath)
      return getHomeBaseCoordinates(config)
    } catch {
      return null
    }
  })
  // DEC-078. The real window factory `captureWebsiteScreenshot` needs — kept
  // here, not in `website-screenshot.ts`, so that module never imports
  // `electron` and stays testable under plain Node/vitest (see its own file
  // comment). `show: false` plus `offscreen: true` means nothing appears on
  // the operator's screen for a capture that can be triggered mid-review.
  ipcMain.handle('discovery:capture-screenshot', async (_event, input: { url: string }) =>
    captureWebsiteScreenshot(input.url, {
      createWindow: () => {
        // DEC-088. This is the only window in HORUS that loads a third party's
        // page, and unlike `inspect_public_website_readonly` — which fetches
        // inert text — it renders and executes it. Electron 43's defaults
        // already give all three of these, so this is not a fix for a live
        // hole; it is stating them at the one call site where they matter most,
        // rather than inheriting them. The main window above declares the same
        // settings explicitly; this one did not, which is exactly backwards.
        // No preload is attached, so `sandbox: true` stays in force.
        const win = new BrowserWindow({
          show: false,
          width: 1280,
          height: 800,
          webPreferences: {
            offscreen: true,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        })
        return {
          loadURL: (url) => win.loadURL(url),
          capturePage: () => win.webContents.capturePage(),
          destroy: () => win.destroy(),
        }
      },
    }),
  )
  // DEC-080. Real Cloudflare Pages publication via the operator's own
  // authenticated Wrangler CLI. The renderer enforces DEC-004's approval
  // checkbox before ever invoking this channel; nothing here re-checks that
  // — a deliberate choice matching how `discovery:run`'s spend-acknowledgment
  // and every other consequential action in this session works, and DEC-045's
  // principle that this stays HORUS's own code, never agent-decided. A
  // successful publish is recorded as a durable, append-only domain event
  // (DEC-024 requires the record retain the URL as actually published) —
  // the only piece of this session's DEC-076-onward work that writes to
  // SQLite rather than staying in-memory, because a live public URL is a
  // real, lasting consequence unlike a selection or a preview.
  ipcMain.handle('publish:demonstration', async (_event, input: { html: string; businessName: string; dataId: string | null }) => {
    const result = await publishDemonstrationSite({
      html: input.html,
      businessName: input.businessName,
      spawnImpl: nodeSpawn,
      prepareSiteDirectory: async (html) => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'horus-demo-site-'))
        await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8')
        return { dir, cleanup: () => fs.rm(dir, { recursive: true, force: true }) }
      },
    })
    if (result.status === 'published') {
      store.appendEvent({
        aggregateType: 'demonstration',
        aggregateId: input.dataId ?? input.businessName,
        eventType: 'demonstration.published',
        payload: { url: result.url, projectName: result.projectName, businessName: input.businessName },
        occurredAt: result.publishedAt,
      })
    }
    return result
  })
  // DEC-090. Charter 15's removal path — the reverse of the channel above,
  // and the one thing DEC-080 left missing: a page about a real business
  // could be put on the public internet with no way to take it down from the
  // app. Removal is destructive and outward-facing, so the renderer requires
  // the operator to type the project name before invoking this, the same
  // shape as the DEC-004 approval checkboxes. Success is recorded as a
  // durable event so the tracker reflects that the URL is gone.
  ipcMain.handle('publish:remove-demonstration', async (_event, input: { projectName: string; dataId: string | null }) => {
    const result = await removeDemonstrationSite({ projectName: input.projectName, spawnImpl: nodeSpawn, cwd: os.tmpdir() })
    if (result.status === 'removed') {
      store.appendEvent({
        aggregateType: 'demonstration',
        aggregateId: input.dataId ?? input.projectName,
        eventType: 'demonstration.removed',
        payload: { projectName: result.projectName },
        occurredAt: result.removedAt,
      })
    }
    return result
  })
  // DEC-081. The second DEC-004 gate. `buildGmailComposeHandoff` (existing,
  // tested since before this session, never wired) builds a
  // `mail.google.com/mail/?view=cm...` URL — no Gmail API scope, no
  // credential, per DEC-041. `shell.openExternal` hands that URL to the
  // operator's own default browser, already logged into their own Gmail;
  // HORUS never sees the compose window's contents after this point and
  // cannot detect whether the operator actually sends. Recorded as a durable
  // event the moment the handoff opens, and a separate `declareOutreachSent`
  // handler lets the operator record their own send declaration afterward —
  // charter 17.3 requires send status be operator-declared, never inferred.
  ipcMain.handle('outreach:open-gmail-handoff', async (_event, input: { approvalId: string; to: string; subject: string; body: string; dataId: string | null }) => {
    try {
      const url = buildGmailComposeHandoff({ approvalId: input.approvalId, to: input.to, subject: input.subject, body: input.body })
      await shell.openExternal(url)
      const occurredAt = new Date().toISOString()
      store.appendEvent({
        aggregateType: 'outreach',
        aggregateId: input.dataId ?? input.to,
        eventType: 'outreach.gmail_handoff_opened',
        payload: { to: input.to, subject: input.subject },
        occurredAt,
      })
      return { status: 'opened' as const, occurredAt }
    } catch (error) {
      return { status: 'failed' as const, reason: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle('outreach:declare-sent', (_event, input: { dataId: string | null; to: string }) => {
    const occurredAt = new Date().toISOString()
    store.appendEvent({
      aggregateType: 'outreach',
      aggregateId: input.dataId ?? input.to,
      eventType: 'outreach.declared_sent',
      payload: { to: input.to, declaredBy: 'operator' },
      occurredAt,
    })
    return { status: 'recorded' as const, occurredAt }
  })
  // DEC-082. Charter §4's last unbuilt step. `follow_up.scheduled` is purely
  // what the operator typed — a date and a note HORUS neither picks nor
  // validates for plausibility, per DEC-030 (a follow-up is an operator
  // action HORUS records, never one it schedules itself). `tracker:list-events`
  // is a read-only projection source: `buildTrackerView` (src/domain/tracker.ts)
  // does the actual grouping in the renderer, the same layering every other
  // scoring/ranking module in this session already uses.
  ipcMain.handle('tracker:schedule-follow-up', (_event, input: { dataId: string | null; to: string | null; date: string; note: string }) => {
    const occurredAt = new Date().toISOString()
    store.appendEvent({
      aggregateType: 'follow_up',
      aggregateId: input.dataId ?? input.to ?? 'unknown',
      eventType: 'follow_up.scheduled',
      payload: { date: input.date, note: input.note },
      occurredAt,
    })
    return { status: 'recorded' as const, occurredAt }
  })
  // DEC-094. Charter 14: the operator's rationale belongs in the record.
  // DEC-091 left the judgment in component state, where closing the app lost
  // it — and a judgment is the one input to a score that cannot be recomputed
  // from retained evidence, because nothing can reconstruct what the operator
  // concluded from reading the reviews. Written as a durable event and read
  // back as a projection, the same shape DEC-082's tracker uses; a later
  // judgment supersedes an earlier one without deleting it.
  ipcMain.handle('judgment:record', (_event, input: { listingId: string; judgment: unknown }) => {
    const occurredAt = new Date().toISOString()
    store.appendEvent({
      aggregateType: 'prospect',
      aggregateId: input.listingId,
      eventType: 'prospect.judgment_recorded',
      payload: input.judgment,
      occurredAt,
    })
    return { status: 'recorded' as const, occurredAt }
  })
  ipcMain.handle('judgment:list', () => store.listEvents(['prospect']))
  // DEC-126. The operator's own request: the selected prospect should "quede
  // guardado hasta que avance asi cierre la app" — stay selected even across
  // an app restart, not just within one running session. There is exactly one
  // selected prospect at a time, which is workspace navigation state, not a
  // per-listing business fact — the same category of thing the representative
  // workflow's own state already uses `workflow_sessions` for, reused here
  // under its own key rather than modelled as a durable event on a listing.
  const PROSPECT_SELECTION_KEY = 'prospect-selection-v1'
  ipcMain.handle('prospect:set-selected', (_event, input: { dataId: string | null }) => {
    store.saveWorkflowState({
      workflowId: PROSPECT_SELECTION_KEY,
      state: { selectedProspectId: input.dataId },
      updatedAt: new Date().toISOString(),
    })
    return { status: 'saved' as const }
  })
  // DEC-107. Rebuilds the last working session from evidence already retained,
  // so closing the application stops discarding a search the operator paid
  // for. Spends nothing: every byte here is already on disk. Charter §14's own
  // model — immutable evidence, derived state recomputed — rather than a
  // second stored copy of the scores that could drift from the evidence.
  ipcMain.handle('session:restore', () => {
    const discoveries = store.listRawSnapshotsBySource('serpapi.google_maps')
    const latest = discoveries.length > 0 ? discoveries[discoveries.length - 1] : null

    // DEC-108. The same reader the cache uses, so a restored session and a
    // re-scored candidate cannot disagree about what the evidence says. It
    // replays the most recent retrieval run per listing rather than
    // concatenating every page ever retained — which counted a review once
    // per time the operator had pressed the button, and raised the restored
    // reputation score each time.
    const reviewHistories = readAllRetainedRuns(store.listRawSnapshotsBySource('serpapi.google_maps_reviews'))

    // DEC-117. Same reconstruction `discovery:measure-web-opportunity`'s own
    // cache check uses, so a restored audit and a fresh cache hit cannot
    // disagree about what a URL's retained evidence says. Closes the gap
    // CLAUDE.md's own known-weaknesses list named: web-opportunity audits
    // were not restored when the application reopened.
    const pagespeedSnapshots: readonly RawSnapshotRecord[] = store.listRawSnapshotsBySource('pagespeed.mobile')
    const analysisSnapshots: readonly RawSnapshotRecord[] = store.listRawSnapshotsBySource('horus.website-analysis')
    const measuredUrls = new Set<string>()
    for (const snapshot of [...pagespeedSnapshots, ...analysisSnapshots]) {
      const request = snapshot.request
      const targetUrl = typeof request === 'object' && request !== null ? (request as Record<string, unknown>).targetUrl : null
      if (typeof targetUrl === 'string' && targetUrl) measuredUrls.add(targetUrl)
    }
    const webOpportunityMeasurements: Record<string, ReturnType<typeof reconstructMeasurementFromSnapshots>> = {}
    for (const url of measuredUrls) {
      const measurement = reconstructMeasurementFromSnapshots(url, pagespeedSnapshots, analysisSnapshots)
      if (measurement) webOpportunityMeasurements[url] = measurement
    }

    // Candidates are extracted here, from the retained payload, rather than
    // returned raw for the renderer to re-run a search over. A restore that
    // could reach the network is a restore that could spend a credit on
    // startup, which is not a thing this application may do.
    // DEC-126. The last selected prospect, read back the same way the
    // representative workflow's own saved state is — `null` both when
    // nothing was ever selected and when the operator explicitly cleared it,
    // which is the correct default for either case: nothing to restore.
    const prospectSelection = store.getWorkflowState('prospect-selection-v1') as { selectedProspectId?: string | null } | null

    return {
      discovery: latest
        ? {
            request: latest.request,
            retrievedAt: latest.retrievedAt,
            snapshotId: latest.id,
            candidates: extractCandidatesForRestore(latest.payload),
          }
        : null,
      reviewHistories,
      webOpportunityMeasurements,
      selectedProspectId: prospectSelection?.selectedProspectId ?? null,
    }
  })
  // DEC-096. DEC-031 exempts an engaged prospect from the 60-day removal
  // prompt, but nothing could record that a business had responded. HORUS
  // cannot observe a reply any more than it can observe a send (DEC-041,
  // charter 17.3), so this is an operator declaration, like `declare-sent`.
  ipcMain.handle('outreach:record-response', (_event, input: { dataId: string | null; note: string }) => {
    const occurredAt = new Date().toISOString()
    store.appendEvent({
      aggregateType: 'outreach',
      aggregateId: input.dataId ?? 'unknown',
      eventType: 'outreach.response_recorded',
      payload: { note: input.note },
      occurredAt,
    })
    return { status: 'recorded' as const, occurredAt }
  })
  ipcMain.handle('tracker:list-events', () => store.listEvents(['demonstration', 'outreach', 'follow_up']))
  ipcMain.handle('workflow:representative:get', () => store.getWorkflowState('representative-local-v1'))
  ipcMain.handle('workflow:representative:save', (_event, state: unknown) => {
    const workflowId = 'representative-local-v1'
    try {
      // The renderer proposes; the main process decides. See DEC-048.
      const accepted = acceptWorkflowState(store.getWorkflowState(workflowId), state)
      store.saveWorkflowState({ workflowId, state: accepted, updatedAt: new Date().toISOString() })
    } catch (error) {
      if (!(error instanceof WorkflowStateRejected)) throw error
      // A rejected save is itself evidence: it records that the renderer tried
      // to write a state the main process would not accept.
      store.appendEvent({
        aggregateType: 'workflow_session',
        aggregateId: workflowId,
        eventType: 'workflow.state_rejected',
        payload: { reason: error.reason },
        occurredAt: new Date().toISOString(),
      })
      throw error
    }
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
