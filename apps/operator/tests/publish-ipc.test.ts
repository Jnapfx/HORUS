import { describe, expect, it } from 'vitest'
import { publishDemonstrationSite, slugifyBusinessName } from '../electron/publish-ipc'
import type { SpawnImpl } from '../electron/agent/runtime'

function fakePrepareSiteDirectory(cleaned: { value: boolean } = { value: false }) {
  return async (html: string) => {
    expect(html).toBeTruthy()
    return { dir: '/tmp/fake-site-dir', cleanup: async () => { cleaned.value = true } }
  }
}

describe('slugifyBusinessName', () => {
  it('lowercases, hyphenates, and strips punctuation', () => {
    expect(slugifyBusinessName('SEASONS EATS')).toBe('seasons-eats')
    expect(slugifyBusinessName("Tuff Lawn & Landscaping, LLC.")).toBe('tuff-lawn-landscaping-llc')
  })

  it('falls back to "concept" for a name with no usable characters', () => {
    expect(slugifyBusinessName('!!!')).toBe('concept')
  })
})

describe('publishDemonstrationSite', () => {
  it('creates the project, deploys, and extracts the live pages.dev URL from wrangler output', async () => {
    const calls: { executable: string; args: readonly string[] }[] = []
    const spawnImpl: SpawnImpl = async (executable, args) => {
      calls.push({ executable, args })
      if (args.includes('deploy')) {
        return { code: 0, stdout: '✨ Deployment complete! Take a peek over at https://abc123.horus-tuff-lawn-concept.pages.dev\n', stderr: '', timedOut: false }
      }
      return { code: 0, stdout: 'Success! Created project.\n', stderr: '', timedOut: false }
    }

    const result = await publishDemonstrationSite({
      html: '<html></html>',
      businessName: 'Tuff Lawn',
      spawnImpl,
      prepareSiteDirectory: fakePrepareSiteDirectory(),
      now: () => new Date('2026-08-08T12:00:00.000Z'),
    })

    expect(result).toEqual({
      status: 'published',
      url: 'https://abc123.horus-tuff-lawn-concept.pages.dev',
      projectName: 'horus-tuff-lawn-concept',
      publishedAt: '2026-08-08T12:00:00.000Z',
      deployOutput: '✨ Deployment complete! Take a peek over at https://abc123.horus-tuff-lawn-concept.pages.dev\n',
    })
    expect(calls[0]).toMatchObject({ executable: 'wrangler', args: ['pages', 'project', 'create', 'horus-tuff-lawn-concept', '--production-branch', 'main'] })
    expect(calls[1]).toMatchObject({ executable: 'wrangler', args: ['pages', 'deploy', '/tmp/fake-site-dir', '--project-name', 'horus-tuff-lawn-concept', '--branch', 'main'] })
  })

  it('still deploys successfully when the project-create step fails (project already exists)', async () => {
    const spawnImpl: SpawnImpl = async (_executable, args) => {
      if (args.includes('deploy')) return { code: 0, stdout: 'Deployed to https://xyz.horus-seasons-eats-concept.pages.dev\n', stderr: '', timedOut: false }
      return { code: 1, stdout: '', stderr: 'A project with this name already exists.', timedOut: false }
    }

    const result = await publishDemonstrationSite({
      html: '<html></html>',
      businessName: 'SEASONS EATS',
      spawnImpl,
      prepareSiteDirectory: fakePrepareSiteDirectory(),
    })

    expect(result).toMatchObject({ status: 'published', url: 'https://xyz.horus-seasons-eats-concept.pages.dev' })
  })

  it('reports a failed deploy with wrangler stderr as the detail, and never returns a partial success', async () => {
    const spawnImpl: SpawnImpl = async (_executable, args) => {
      if (args.includes('deploy')) return { code: 1, stdout: '', stderr: 'Error: Not authenticated. Run `wrangler login`.', timedOut: false }
      return { code: 0, stdout: '', stderr: '', timedOut: false }
    }

    const result = await publishDemonstrationSite({
      html: '<html></html>',
      businessName: 'Tuff Lawn',
      spawnImpl,
      prepareSiteDirectory: fakePrepareSiteDirectory(),
    })

    expect(result).toMatchObject({ status: 'failed', reason: 'deploy_failed', detail: expect.stringContaining('Not authenticated') })
  })

  it('reports a timeout distinctly from a failure', async () => {
    const spawnImpl: SpawnImpl = async (_executable, args) => {
      if (args.includes('deploy')) return { code: null, stdout: '', stderr: '', timedOut: true }
      return { code: 0, stdout: '', stderr: '', timedOut: false }
    }

    const result = await publishDemonstrationSite({
      html: '<html></html>',
      businessName: 'Tuff Lawn',
      spawnImpl,
      prepareSiteDirectory: fakePrepareSiteDirectory(),
      timeoutMs: 5000,
    })

    expect(result).toMatchObject({ status: 'failed', reason: 'deploy_timed_out' })
  })

  it('always calls cleanup, even when the deploy fails', async () => {
    const cleaned = { value: false }
    const spawnImpl: SpawnImpl = async () => ({ code: 1, stdout: '', stderr: 'boom', timedOut: false })

    await publishDemonstrationSite({
      html: '<html></html>',
      businessName: 'Tuff Lawn',
      spawnImpl,
      prepareSiteDirectory: fakePrepareSiteDirectory(cleaned),
    })

    expect(cleaned.value).toBe(true)
  })

  it('returns a null url rather than throwing when wrangler succeeds but prints no recognizable URL', async () => {
    const spawnImpl: SpawnImpl = async (_executable, args) => {
      if (args.includes('deploy')) return { code: 0, stdout: 'Deployed successfully.\n', stderr: '', timedOut: false }
      return { code: 0, stdout: '', stderr: '', timedOut: false }
    }

    const result = await publishDemonstrationSite({
      html: '<html></html>',
      businessName: 'Tuff Lawn',
      spawnImpl,
      prepareSiteDirectory: fakePrepareSiteDirectory(),
    })

    expect(result).toMatchObject({ status: 'published', url: null })
  })
})
