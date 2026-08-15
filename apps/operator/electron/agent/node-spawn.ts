/**
 * DEC-060. The real `SpawnImpl` — the piece `createClaudeCodeRuntime` has
 * required since DEC-049, but that until now only existed as fakes inside
 * tests. Nothing in this codebase could actually launch Claude Code without
 * this file.
 *
 * Uses `child_process.spawn` with an argument array, never `exec` or a
 * composed shell string, matching the requirement `runtime.ts` states at
 * `SpawnImpl`'s definition. `shell` is left at its default `false`.
 */

import { spawn } from 'node:child_process'
import type { SpawnImpl, SpawnResult } from './runtime.js'

/**
 * A real "Compose failed: timeout"/"Qualification agent failed: timeout" run
 * was diagnosed (DEC-132's captured-output detail made this visible) as the
 * child's own `claude` process having already reported a terminal result
 * (`"type":"result"`, `"duration_ms":115467` — well under this run's own
 * 120s budget) before HORUS's timeout ever fired — meaning the process, or a
 * child of it (an MCP server it spawned), kept running without emitting
 * `close`, and this code waited out the full timeout regardless. SIGTERM
 * asks a process to exit; it does not guarantee it will. `KILL_GRACE_MS`
 * gives a process that direction a real chance to act on before escalating
 * to SIGKILL, which a process cannot ignore — so a genuinely hung run now
 * ends close to `timeoutMs` instead of however long it takes an unresponsive
 * process (or an orphaned child of it) to close its own stdio pipes.
 */
const KILL_GRACE_MS = 5_000

export const nodeSpawn: SpawnImpl = (executable, args, options) =>
  new Promise<SpawnResult>((resolve) => {
    const child = spawn(executable, args, { cwd: options.cwd, shell: false })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    let killTimer: ReturnType<typeof setTimeout> | undefined

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      killTimer = setTimeout(() => {
        if (!settled) child.kill('SIGKILL')
      }, KILL_GRACE_MS)
    }, options.timeoutMs)

    const finish = (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(killTimer)
      resolve({ code, stdout, stderr, timedOut })
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    // A spawn failure — executable not found, permission denied — never throws
    // here. It resolves like any other completed process, with the OS error
    // in stderr, so `classifyFailure` is the single place that interprets it.
    child.on('error', (error) => {
      stderr += `\n${error.message}`
      finish(null)
    })
    child.on('close', (code) => {
      finish(code)
    })
  })
