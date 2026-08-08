/**
 * DEC-078. Captures a screenshot of a candidate's own public website home
 * page, shown alongside `ProspectRecord` (DEC-076) so the operator can see
 * what the site actually looks like without leaving the app. Free and
 * simple, per the operator's own instruction: no third-party screenshot
 * service, no new credential in `config/local.json`, no new dependency —
 * a hidden Electron window loads the page and `capturePage()` reads back
 * the pixels, capability Electron already ships.
 *
 * The window itself is not constructed here. `createWindow` is injected so
 * this module never imports the `electron` package — importing it outside a
 * real Electron process resolves to a path string, not the API surface, so
 * doing that here would make this file untestable under plain Node/vitest,
 * the same reason `node-spawn.ts`'s real spawn implementation is injected
 * into `runtime.ts` rather than constructed inline. The real window factory
 * lives in `main.ts`, next to where `BrowserWindow` is already imported.
 *
 * In-memory only, same as DEC-076: the captured image is handed back to the
 * renderer as a data URL and never written to evidence storage. It is a
 * visual aid for the operator, not a source of any scored or claimed fact —
 * DEC-005/DEC-025's rules about fabricated or misattributed imagery govern
 * what may appear in a demonstration; this is not that, and is not to be
 * treated as such if demonstration-building is ever wired to reuse it.
 */

import { PublicUrlRejected, validatePublicHttpsUrl } from './agent/url-safety.js'

export type ScreenshotWindow = {
  loadURL(url: string): Promise<void>
  capturePage(): Promise<{ toDataURL(): string }>
  destroy(): void
}

export type ScreenshotResult =
  | { status: 'captured'; dataUrl: string; capturedAt: string; url: string }
  | { status: 'rejected'; reason: string }
  | { status: 'failed'; reason: string }

export async function captureWebsiteScreenshot(
  rawUrl: string,
  options: { timeoutMs?: number; now?: () => Date; createWindow: () => ScreenshotWindow },
): Promise<ScreenshotResult> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const now = options.now ?? (() => new Date())

  let parsed: URL
  try {
    parsed = validatePublicHttpsUrl(rawUrl)
  } catch (error) {
    if (error instanceof PublicUrlRejected) return { status: 'rejected', reason: error.message }
    throw error
  }

  const win = options.createWindow()
  try {
    await Promise.race([
      win.loadURL(parsed.toString()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)),
    ])
    const image = await win.capturePage()
    return { status: 'captured', dataUrl: image.toDataURL(), capturedAt: now().toISOString(), url: parsed.toString() }
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) }
  } finally {
    win.destroy()
  }
}
