import { app, BrowserWindow, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOpportunityAnalyst } from './agent/analyst-ipc.js'
import { createEvidenceToolWiring } from './agent/evidence-tool-wiring.js'
import { nodeSpawn } from './agent/node-spawn.js'
import { createClaudeCodeRuntime } from './agent/runtime.js'
import { createWorkingDirectoryPreparer } from './agent/working-directory.js'
import { buildGmailComposeHandoff } from './compose-handoff.js'
import { OperatorConfigMissing, getHomeBaseCoordinates, loadOperatorConfig, requirePageSpeedApiKey, requireSerpApiKey } from './config.js'
import { extractCandidatesForRestore, runRealDiscoverySearch } from './discovery-ipc.js'
import { listIntegrationContracts } from './integrations/contracts.js'
import { createHorusStore } from './persistence.js'
import { publishDemonstrationSite, removeDemonstrationSite } from './publish-ipc.js'
import { runReviewHistoryRetrieval } from './review-retrieval-ipc.js'
import { runWebOpportunityMeasurement } from './web-opportunity-ipc.js'
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
  // page, up to the 3-page default). Returns raw isoDate/rating pairs only —
  // scoring them against `reputation-scoring-v1` happens in the renderer,
  // same layering as `screenListingGates` (DEC-070).
  ipcMain.handle('discovery:fetch-review-history', async (_event, input: { dataId: string }) => {
    try {
      const config = loadOperatorConfig(operatorConfigPath)
      const apiKey = requireSerpApiKey(config)
      return await runReviewHistoryRetrieval({
        dataId: input.dataId,
        apiKey,
        appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
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
  ipcMain.handle('discovery:measure-web-opportunity', async (_event, input: { url: string }) => {
    try {
      const config = loadOperatorConfig(operatorConfigPath)
      const apiKey = requirePageSpeedApiKey(config)
      return await runWebOpportunityMeasurement({
        url: input.url,
        pagespeedApiKey: apiKey,
        appendRawSnapshot: (snapshot) => store.appendRawSnapshot(snapshot),
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
  // DEC-107. Rebuilds the last working session from evidence already retained,
  // so closing the application stops discarding a search the operator paid
  // for. Spends nothing: every byte here is already on disk. Charter §14's own
  // model — immutable evidence, derived state recomputed — rather than a
  // second stored copy of the scores that could drift from the evidence.
  ipcMain.handle('session:restore', () => {
    const discoveries = store.listRawSnapshotsBySource('serpapi.google_maps')
    const latest = discoveries.length > 0 ? discoveries[discoveries.length - 1] : null
    const reviewSnapshots = store.listRawSnapshotsBySource('serpapi.google_maps_reviews')

    const histories = new Map<string, { reviews: unknown[]; retrievedAt: string; paginationExhausted: boolean }>()
    for (const snapshot of reviewSnapshots) {
      const payload = snapshot.payload as Record<string, unknown> | null
      const dataId = (payload?.search_parameters as Record<string, unknown> | undefined)?.data_id
      if (typeof dataId !== 'string') continue
      const entry = histories.get(dataId) ?? { reviews: [], retrievedAt: snapshot.retrievedAt, paginationExhausted: false }
      entry.reviews.push(...(Array.isArray(payload?.reviews) ? (payload!.reviews as unknown[]) : []))
      entry.retrievedAt = snapshot.retrievedAt
      entry.paginationExhausted = !(payload?.serpapi_pagination as Record<string, unknown> | undefined)?.next
      histories.set(dataId, entry)
    }

    // Candidates are extracted here, from the retained payload, rather than
    // returned raw for the renderer to re-run a search over. A restore that
    // could reach the network is a restore that could spend a credit on
    // startup, which is not a thing this application may do.
    return {
      discovery: latest
        ? {
            request: latest.request,
            retrievedAt: latest.retrievedAt,
            snapshotId: latest.id,
            candidates: extractCandidatesForRestore(latest.payload),
          }
        : null,
      reviewHistories: Object.fromEntries(histories),
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
