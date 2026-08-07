/**
 * DEC-057. Creates the isolated working directory each Claude Code invocation
 * runs from. Never the HORUS repository: without `--bare` (refused by DEC-045,
 * see DEC-056), Claude Code auto-discovers the current directory's `CLAUDE.md`,
 * hooks, plugins and MCP servers, and this repository's `CLAUDE.md` is written
 * for a human maintaining HORUS, not for a bounded agent reasoning only over
 * supplied evidence.
 *
 * A fresh, empty directory guarantees none of that exists to discover. It is
 * created under the application's own data directory rather than the shared OS
 * temp directory, so agent-run artifacts are found in the same place as every
 * other piece of HORUS state.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { PrepareIsolatedWorkingDirectory } from './runtime.js'

function sanitizeForPath(value: string): string {
  const cleaned = value.replaceAll(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned.length > 0 ? cleaned : 'task'
}

/**
 * `root` should be a directory under HORUS's own data directory, e.g.
 * `path.join(app.getPath('userData'), 'data', 'agent-runs')`. Each call creates
 * a new, empty subdirectory and returns its absolute path; it never reuses one.
 */
export function createWorkingDirectoryPreparer(root: string): PrepareIsolatedWorkingDirectory {
  return async (taskId: string) => {
    const unique = `${sanitizeForPath(taskId)}-${crypto.randomUUID()}`
    const directory = path.join(root, unique)
    fs.mkdirSync(directory, { recursive: true })

    // Fails loudly rather than silently running with inherited context if
    // something has already put a CLAUDE.md here — which should be
    // impossible given the UUID suffix, but the check is cheap and the
    // consequence of skipping it is exactly the problem DEC-057 exists to
    // prevent.
    const forbidden = ['CLAUDE.md', '.claude']
    const found = forbidden.find((name) => fs.existsSync(path.join(directory, name)))
    if (found) {
      throw new Error(`Isolated agent working directory unexpectedly contains ${found}; refusing to run`)
    }

    return directory
  }
}
