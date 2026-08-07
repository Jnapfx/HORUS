import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
