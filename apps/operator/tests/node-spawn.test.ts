import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { nodeSpawn } from '../electron/agent/node-spawn'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }))
})

function tempCwd() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-node-spawn-'))
  temporaryDirectories.push(directory)
  return directory
}

describe('the real SpawnImpl', () => {
  it('runs a real process and captures its stdout', async () => {
    const result = await nodeSpawn('node', ['-e', 'console.log(1 + 1)'], { timeoutMs: 5000, cwd: tempCwd() })

    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('2')
    expect(result.timedOut).toBeFalsy()
  })

  it('passes arguments as an array, never through a shell', async () => {
    // If this ran through a shell, the semicolon would start a second command.
    // Passed as a literal argv element instead, node just prints it back.
    const injectionAttempt = 'hello; rm -rf /tmp/should-not-run'
    const result = await nodeSpawn('node', ['-e', 'console.log(process.argv[1])', injectionAttempt], {
      timeoutMs: 5000,
      cwd: tempCwd(),
    })

    expect(result.stdout.trim()).toBe(injectionAttempt)
  })

  it('runs from the supplied cwd', async () => {
    const cwd = tempCwd()
    const result = await nodeSpawn('node', ['-e', 'console.log(process.cwd())'], { timeoutMs: 5000, cwd })

    // Resolve both sides to handle /tmp vs /private/tmp symlinking on macOS.
    expect(fs.realpathSync(result.stdout.trim())).toBe(fs.realpathSync(cwd))
  })

  it('kills a process that exceeds its time limit and reports timedOut', async () => {
    const result = await nodeSpawn('node', ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 200, cwd: tempCwd() })

    expect(result.timedOut).toBe(true)
  }, 10_000)

  it('resolves, rather than throws, when the executable does not exist', async () => {
    const result = await nodeSpawn('horus-executable-that-does-not-exist', [], { timeoutMs: 5000, cwd: tempCwd() })

    expect(result.code).toBeNull()
    expect(result.stderr.length).toBeGreaterThan(0)
  })
})
