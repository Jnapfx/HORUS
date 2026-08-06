import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listIntegrationContracts } from './integrations/contracts.js'
import { createHorusStore } from './persistence.js'

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
      preload: path.join(dirname, 'preload.js'),
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
    store.saveWorkflowState({ workflowId: 'representative-local-v1', state, updatedAt: new Date().toISOString() })
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
