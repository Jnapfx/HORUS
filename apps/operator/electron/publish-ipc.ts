/**
 * DEC-080. The first real Cloudflare Pages publication path — until now
 * `electron/integrations/cloudflare.ts` only built a manual-dashboard-upload
 * plan (`credentialRequirement: 'none'`), and Phase 5's one real SEASONS
 * EATS concept (DEC-044) was deployed by the operator typing `wrangler`
 * commands directly, outside the app.
 *
 * Uses the operator's own Wrangler CLI, already authenticated via Cloudflare
 * OAuth since Phase 5, as a real subprocess — the same `SpawnImpl` contract
 * `node-spawn.ts` already implements and tests for the Claude Code runtime,
 * reused here for a different executable. Chosen over calling Cloudflare's
 * REST API directly: research into the "Create deployment" endpoint found it
 * is not a single multipart upload but a multi-step, only partially publicly
 * documented flow (a content-hash manifest, a short-lived upload JWT, and a
 * separate asset-upload endpoint) that lives inside Wrangler's own internals
 * — reimplementing it by hand would mean guessing at undocumented behavior.
 *
 * Two subprocess calls, matching how the operator did this manually:
 *   1. `wrangler pages project create <project> --production-branch main` —
 *      attempted unconditionally. Its result is not treated as authoritative:
 *      if the project already exists this fails harmlessly, and the deploy
 *      step below still succeeds against the existing project. Only the
 *      deploy step's own exit code determines success or failure.
 *   2. `wrangler pages deploy <dir> --project-name <project> --branch main`
 *      — the real publish. Its stdout is scanned for the first
 *      `https://*.pages.dev` URL Wrangler reports, which is what the
 *      operator would read off their own terminal in the manual flow this
 *      replaces.
 *
 * This module performs no approval-gate check itself — DEC-004's gate is
 * enforced by the caller (the renderer requires an explicit checkbox before
 * ever invoking the IPC channel this wires to, and `main.ts` performs no
 * gate logic of its own either, consistent with DEC-045's principle that
 * consequential state stays in HORUS's own code, not scattered checks). This
 * file only knows how to run the two commands and read back the result.
 */

import type { SpawnImpl } from './agent/runtime.js'

export type PublishDemonstrationResult =
  | { status: 'published'; url: string | null; projectName: string; publishedAt: string; deployOutput: string }
  | { status: 'failed'; reason: string; detail: string }

/** `horus-<slug>-concept`, matching the naming the operator already used manually for the one real Phase 5 concept (`horus-seasons-eats-concept`). */
export function slugifyBusinessName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'concept'
}

function extractPagesDevUrl(text: string): string | null {
  const match = text.match(/https:\/\/[a-z0-9.-]+\.pages\.dev\S*/i)
  return match ? match[0] : null
}

export async function publishDemonstrationSite(input: {
  html: string
  businessName: string
  spawnImpl: SpawnImpl
  /** DI so this module never touches `fs`/`os` directly, staying testable without real temp directories, same reasoning as `website-screenshot.ts`'s injected window factory. Real implementation in `main.ts` writes `html` to `<dir>/index.html`. */
  prepareSiteDirectory: (html: string) => Promise<{ dir: string; cleanup: () => Promise<void> }>
  timeoutMs?: number
  now?: () => Date
}): Promise<PublishDemonstrationResult> {
  const timeoutMs = input.timeoutMs ?? 60_000
  const now = input.now ?? (() => new Date())
  const projectName = `horus-${slugifyBusinessName(input.businessName)}-concept`

  const { dir, cleanup } = await input.prepareSiteDirectory(input.html)
  try {
    // Unconditional and non-authoritative — see file comment. Its own
    // failure (project already exists, or any other reason) is not
    // reported; only the deploy step below determines the outcome.
    await input.spawnImpl('wrangler', ['pages', 'project', 'create', projectName, '--production-branch', 'main'], { cwd: dir, timeoutMs })

    const deploy = await input.spawnImpl('wrangler', ['pages', 'deploy', dir, '--project-name', projectName, '--branch', 'main'], { cwd: dir, timeoutMs })

    if (deploy.timedOut) {
      return { status: 'failed', reason: 'deploy_timed_out', detail: `wrangler pages deploy did not complete within ${timeoutMs}ms` }
    }
    if (deploy.code !== 0) {
      return { status: 'failed', reason: 'deploy_failed', detail: deploy.stderr || deploy.stdout || `wrangler exited with code ${deploy.code}` }
    }

    return {
      status: 'published',
      url: extractPagesDevUrl(deploy.stdout) ?? extractPagesDevUrl(deploy.stderr),
      projectName,
      publishedAt: now().toISOString(),
      deployOutput: deploy.stdout,
    }
  } finally {
    await cleanup()
  }
}

export type RemoveDemonstrationResult =
  | { status: 'removed'; projectName: string; removedAt: string; output: string }
  | { status: 'failed'; reason: string; detail: string }

/**
 * DEC-090. Charter section 15 requires a removal path for a published
 * demonstration, FUNCTIONAL_DESIGN 6.4 lists "disable/remove an already
 * published demonstration" as a required action, and the Demonstration state
 * model has a `removed` state. None of it existed: DEC-080 could put a page
 * about a real business on the public internet and the application offered no
 * way to take it down. Phase 5's Finescape concept was retired by the operator
 * typing Wrangler commands directly, outside the app — the same gap DEC-080
 * closed for publishing, still open for the reverse.
 *
 * `wrangler pages project delete` removes the project and every deployment
 * under it, which is what "removed" has to mean for a concept site: disabling
 * one deployment would leave the others reachable.
 *
 * `--yes` is passed because the subprocess has no TTY to answer an interactive
 * confirmation on. **The confirmation this replaces is not skipped — it is
 * moved into HORUS**, where the operator types the project name to confirm
 * before this is ever invoked, the same shape as the DEC-004 approval
 * checkboxes. This module performs no gate check itself, consistent with
 * DEC-080 and DEC-045: it only knows how to run the command.
 *
 * Deliberately not exercised against a live project by the work that added it.
 */
export async function removeDemonstrationSite(input: {
  projectName: string
  spawnImpl: SpawnImpl
  /** Injected rather than defaulted here, so this module never touches `os` — same discipline as `prepareSiteDirectory` above. The command does not read it. */
  cwd: string
  timeoutMs?: number
  now?: () => Date
}): Promise<RemoveDemonstrationResult> {
  const timeoutMs = input.timeoutMs ?? 60_000
  const now = input.now ?? (() => new Date())

  if (!input.projectName.trim()) {
    return { status: 'failed', reason: 'missing_project', detail: 'No project name was supplied.' }
  }

  const result = await input.spawnImpl('wrangler', ['pages', 'project', 'delete', input.projectName, '--yes'], { cwd: input.cwd, timeoutMs })

  if (result.timedOut) {
    return { status: 'failed', reason: 'remove_timed_out', detail: `wrangler pages project delete did not complete within ${timeoutMs}ms` }
  }
  if (result.code !== 0) {
    return { status: 'failed', reason: 'remove_failed', detail: result.stderr || result.stdout || `wrangler exited with code ${result.code}` }
  }

  return { status: 'removed', projectName: input.projectName, removedAt: now().toISOString(), output: result.stdout }
}
