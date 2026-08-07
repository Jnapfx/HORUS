/**
 * DEC-052. This file is `.cts`, not `.ts`, and that is deliberate.
 *
 * `package.json` declares `"type": "module"`, so a compiled `preload.js` is an
 * ES module. Electron runs preload scripts in a sandboxed context that only
 * accepts CommonJS, and fails with `SyntaxError: Cannot use import statement
 * outside a module` — silently, from the renderer's point of view, leaving
 * `window.horus` undefined and every IPC call a no-op.
 *
 * Under `module: NodeNext`, a `.cts` source emits `.cjs` as CommonJS regardless
 * of the package type. `verbatimModuleSyntax` then requires the `import ... =
 * require()` form here rather than ESM syntax.
 */

import electron = require('electron')

const { contextBridge, ipcRenderer } = electron

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
