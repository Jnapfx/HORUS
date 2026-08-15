/**
 * `impeccable` ships no TypeScript types — it is plain ESM `.mjs`. This is the
 * narrow declaration for the one export HORUS uses, `detectHtml`, the static
 * engine. Deliberately does NOT declare `detectUrl` / `createBrowserDetector`:
 * those launch a real Chromium through the optional `puppeteer` dependency
 * that `package.json`'s `allowScripts` refuses, and nothing in HORUS may reach
 * a live URL from the QA path. If a future change needs them, the missing
 * declaration is the first thing that will say so.
 *
 * The finding shape below was read off `cli/engine/findings.mjs` at v3.5.0,
 * where every finding is built by one factory:
 *   `{ antipattern, name, description, severity, category, file, line, snippet }`
 * `severity` defaults to `'warning'`; the registry sets `'error'` on two rules
 * and `'advisory'` on eleven.
 */
declare module 'impeccable' {
  export interface ImpeccableRawFinding {
    antipattern: string
    name: string
    description: string
    severity: string
    category: string | null
    file: string
    line: number
    snippet: string
  }

  /** Static engine: parses the file at `filePath` with htmlparser2 + css-tree. Never opens a socket. */
  export function detectHtml(filePath: string, options?: Record<string, unknown>): Promise<ImpeccableRawFinding[]>
}
