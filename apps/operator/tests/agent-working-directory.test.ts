import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWorkingDirectoryPreparer } from '../electron/agent/working-directory'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }))
})

describe('isolated agent working directory', () => {
  it('creates a fresh, empty directory per task', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-agent-runs-'))
    temporaryDirectories.push(root)
    const prepare = createWorkingDirectoryPreparer(root)

    const directory = await prepare('task_1')

    expect(fs.existsSync(directory)).toBe(true)
    expect(fs.readdirSync(directory)).toEqual([])
    expect(directory.startsWith(root)).toBe(true)
  })

  it('never reuses a directory across calls, even for the same task id', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-agent-runs-'))
    temporaryDirectories.push(root)
    const prepare = createWorkingDirectoryPreparer(root)

    const first = await prepare('task_1')
    const second = await prepare('task_1')

    expect(first).not.toBe(second)
  })

  it('produces a safe path even for a task id with unusual characters', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-agent-runs-'))
    temporaryDirectories.push(root)
    const prepare = createWorkingDirectoryPreparer(root)

    const directory = await prepare('../../etc/passwd; rm -rf ~')

    expect(directory.startsWith(root)).toBe(true)
    expect(fs.existsSync(directory)).toBe(true)
  })

  it('the produced directory never contains CLAUDE.md or .claude', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horus-agent-runs-'))
    temporaryDirectories.push(root)
    const prepare = createWorkingDirectoryPreparer(root)

    const directory = await prepare('task_1')

    expect(fs.existsSync(path.join(directory, 'CLAUDE.md'))).toBe(false)
    expect(fs.existsSync(path.join(directory, '.claude'))).toBe(false)
  })
})
