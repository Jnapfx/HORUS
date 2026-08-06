import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('horus', {
  foundation: {
    getStatus: () => ipcRenderer.invoke('foundation:status'),
    getIntegrationContracts: () => ipcRenderer.invoke('foundation:integration-contracts'),
  },
})
