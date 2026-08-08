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
  agent: {
    listEvidence: () => ipcRenderer.invoke('agent:analyst:list-evidence'),
    listDrafts: () => ipcRenderer.invoke('agent:analyst:list-drafts'),
    checkAvailability: () => ipcRenderer.invoke('agent:analyst:availability'),
    runAnalyst: (evidence: { snapshotId: string; source: string; retrievedAt: string }[]) =>
      ipcRenderer.invoke('agent:analyst:run', evidence),
  },
  discovery: {
    /** DEC-069. Spends a real SerpApi credit and retrieves real business data — unless DEC-077's cache already has a matching category+city search, in which case no credit is spent. Set forceRefresh to skip the cache. */
    run: (input: { category: string; city: string; maxExamined: number; forceRefresh?: boolean }) => ipcRenderer.invoke('discovery:run', input),
    /** DEC-071. Spends further real SerpApi credits, up to one per page retrieved. */
    fetchReviewHistory: (input: { dataId: string }) => ipcRenderer.invoke('discovery:fetch-review-history', input),
    /** DEC-072. Spends a real PageSpeed quota unit and fetches the candidate's own site once. */
    measureWebOpportunity: (input: { url: string }) => ipcRenderer.invoke('discovery:measure-web-opportunity', input),
    /** DEC-074. Returns only a coordinate pair, or null — never the configured street address. */
    getHomeBaseCoordinates: () => ipcRenderer.invoke('discovery:home-base-coordinates'),
    /** DEC-078. Loads the URL in a hidden window and returns a PNG screenshot as a data URL. In-memory only; nothing is stored. */
    captureScreenshot: (input: { url: string }) => ipcRenderer.invoke('discovery:capture-screenshot', input),
  },
  publish: {
    /** DEC-080. REAL PUBLICATION: deploys to Cloudflare Pages via the operator's authenticated Wrangler CLI. The renderer must obtain explicit DEC-004 approval before ever calling this. */
    demonstration: (input: { html: string; businessName: string; dataId: string | null }) => ipcRenderer.invoke('publish:demonstration', input),
    /** DEC-090. Charter 15's removal path. Destructive: deletes the Pages project and every deployment under it. */
    removeDemonstration: (input: { projectName: string; dataId: string | null }) => ipcRenderer.invoke('publish:remove-demonstration', input),
  },
  outreach: {
    /** DEC-081. Opens a Gmail compose window in the operator's default browser via `shell.openExternal` — no Gmail credential, no send capability (DEC-041). Requires explicit DEC-004 approval before calling. */
    openGmailHandoff: (input: { approvalId: string; to: string; subject: string; body: string; dataId: string | null }) => ipcRenderer.invoke('outreach:open-gmail-handoff', input),
    /** DEC-081. Records the operator's own declaration that they sent the message — charter 17.3, never inferred by HORUS. */
    declareSent: (input: { dataId: string | null; to: string }) => ipcRenderer.invoke('outreach:declare-sent', input),
  },
  tracker: {
    /** DEC-082. Records exactly what the operator typed — HORUS never schedules or infers a follow-up (DEC-030). */
    scheduleFollowUp: (input: { dataId: string | null; to: string | null; date: string; note: string }) => ipcRenderer.invoke('tracker:schedule-follow-up', input),
    /** DEC-082. Read-only projection source for the tracker view. */
    listEvents: () => ipcRenderer.invoke('tracker:list-events'),
  },
})
