import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('horus', {
  foundation: {
    getStatus: () => ipcRenderer.invoke('foundation:status'),
    getIntegrationContracts: () => ipcRenderer.invoke('foundation:integration-contracts'),
  },
  workflow: {
    getRepresentative: () => ipcRenderer.invoke('workflow:representative:get'),
    saveRepresentative: (state: unknown) => ipcRenderer.invoke('workflow:representative:save', state),
  },
})
