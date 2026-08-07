import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOpportunityAnalyst } from './agent/analyst-ipc.js'
import { createEvidenceToolWiring } from './agent/evidence-tool-wiring.js'
import { nodeSpawn } from './agent/node-spawn.js'
import { createClaudeCodeRuntime } from './agent/runtime.js'
import { createWorkingDirectoryPreparer } from './agent/working-directory.js'
import { listIntegrationContracts } from './integrations/contracts.js'
import { createHorusStore } from './persistence.js'
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
  ipcMain.handle('agent:analyst:availability', () => analystRuntime.checkAvailability())
  ipcMain.handle('agent:analyst:run', (_event, evidence: { snapshotId: string; source: string; retrievedAt: string }[]) =>
    // Any rejection here (malformed evidence, per assertTaskIsBounded) reaches
    // the renderer as a rejected promise, exactly like `workflow:representative:save`
    // below — the UI is responsible for surfacing it, not this handler.
    runOpportunityAnalyst({ runtime: analystRuntime, evidence, taskId: `analyst_${Date.now()}` }),
  )
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
