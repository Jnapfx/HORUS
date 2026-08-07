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

export const nodeSpawn: SpawnImpl = (executable, args, options) =>
  new Promise<SpawnResult>((resolve) => {
    const child = spawn(executable, args, { cwd: options.cwd, shell: false })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, options.timeoutMs)

    const finish = (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
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
