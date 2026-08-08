import { describe, expect, it } from 'vitest'
import { removeDemonstrationSite } from '../electron/publish-ipc'
import type { SpawnImpl } from '../electron/agent/runtime'

/**
 * DEC-090. Charter section 15 requires a removal path for a published
 * demonstration. DEC-080 could put a page about a real business on the public
 * internet; nothing could take it down from the application.
 *
 * No real Cloudflare project is touched by any of this — every call goes
 * through a fake `SpawnImpl` that records what it was asked to run.
 */

function recordingSpawn(result: Partial<Awaited<ReturnType<SpawnImpl>>> = {}) {
  const calls: Array<{ command: string; args: readonly string[] }> = []
  const impl: SpawnImpl = async (command, args) => {
    calls.push({ command, args })
    return { code: 0, stdout: 'Successfully deleted project', stderr: '', timedOut: false, ...result }
  }
  return { impl, calls }
}

describe('DEC-090 — the removal command', () => {
  it('deletes the project, not a single deployment', async () => {
    // A concept site is the whole project: disabling one deployment would
    // leave every earlier one still reachable at its own URL.
    const { impl, calls } = recordingSpawn()
    const result = await removeDemonstrationSite({
      projectName: 'horus-test-concept',
      spawnImpl: impl,
      cwd: '/tmp',
      now: () => new Date('2026-08-08T12:00:00.000Z'),
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].command).toBe('wrangler')
    expect(calls[0].args).toEqual(['pages', 'project', 'delete', 'horus-test-concept', '--yes'])
    expect(result).toMatchObject({ status: 'removed', projectName: 'horus-test-concept', removedAt: '2026-08-08T12:00:00.000Z' })
  })

  it('refuses an empty project name without spawning anything', async () => {
    const { impl, calls } = recordingSpawn()
    const result = await removeDemonstrationSite({ projectName: '   ', spawnImpl: impl, cwd: '/tmp' })
    expect(result).toMatchObject({ status: 'failed', reason: 'missing_project' })
    expect(calls).toHaveLength(0)
  })

  it('reports a non-zero exit as a failure rather than a removal', async () => {
    const { impl } = recordingSpawn({ code: 1, stderr: 'project not found', stdout: '' })
    const result = await removeDemonstrationSite({ projectName: 'horus-missing', spawnImpl: impl, cwd: '/tmp' })
    expect(result).toMatchObject({ status: 'failed', reason: 'remove_failed', detail: 'project not found' })
  })

  it('reports a timeout distinctly, so a slow removal is never read as a done one', async () => {
    const { impl } = recordingSpawn({ timedOut: true, code: null as unknown as number })
    const result = await removeDemonstrationSite({ projectName: 'horus-slow', spawnImpl: impl, cwd: '/tmp', timeoutMs: 1000 })
    expect(result).toMatchObject({ status: 'failed', reason: 'remove_timed_out' })
    expect((result as { detail: string }).detail).toContain('1000ms')
  })

  it('never reports removal on any failure path', async () => {
    for (const failure of [{ code: 1 }, { timedOut: true }, { code: 137 }]) {
      const { impl } = recordingSpawn(failure)
      const result = await removeDemonstrationSite({ projectName: 'horus-x', spawnImpl: impl, cwd: '/tmp' })
      expect(result.status, JSON.stringify(failure)).toBe('failed')
    }
  })
})

describe('DEC-090 — the interface guards the destructive control', () => {
  const source = new URL('../src/views/ProspectRecord.tsx', import.meta.url)
  const text = require('node:fs').readFileSync(source, 'utf8') as string

  it('requires the project name to be typed, not merely clicked', () => {
    // A single click is the wrong shape for an action that cannot be undone
    // from the app. The confirmation Wrangler's own `--yes` skips is moved
    // here rather than removed.
    const button = text.match(/onClick=\{removeDemonstration\}\s+disabled=\{[^}]*\}/)?.[0] ?? ''
    expect(button, 'removal button is not guarded').toContain('removeConfirmation.trim() !== publishResult.projectName')
  })

  it('refuses to act on a mismatched confirmation inside the handler too', () => {
    // Guarded in the handler as well as the disabled attribute, so the check
    // does not live only in a rendering concern.
    const handler = text.match(/const removeDemonstration = \(\) => \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(handler).toContain("publishResult?.status !== 'published'")
    expect(handler).toContain('removeConfirmation.trim() !== publishResult.projectName')
  })

  it('states plainly that removal cannot be undone from HORUS', () => {
    expect(text).toContain('cannot be undone from HORUS')
  })
})
