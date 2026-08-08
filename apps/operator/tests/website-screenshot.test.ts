import { describe, expect, it } from 'vitest'
import { captureWebsiteScreenshot, type ScreenshotWindow } from '../electron/website-screenshot'

function fakeWindow(overrides: Partial<ScreenshotWindow> & { destroyed?: { value: boolean } } = {}): ScreenshotWindow {
  return {
    loadURL: overrides.loadURL ?? (async () => {}),
    capturePage: overrides.capturePage ?? (async () => ({ toDataURL: () => 'data:image/png;base64,fake' })),
    destroy: overrides.destroy ?? (() => {}),
  }
}

describe('captureWebsiteScreenshot', () => {
  it('rejects a non-https URL before ever constructing a window', async () => {
    let created = false
    const result = await captureWebsiteScreenshot('http://example.com', { createWindow: () => { created = true; return fakeWindow() } })
    expect(result).toMatchObject({ status: 'rejected' })
    expect(created).toBe(false)
  })

  it('rejects obviously local/internal hostnames before constructing a window', async () => {
    let created = false
    for (const url of ['https://localhost/', 'https://127.0.0.1/', 'https://192.168.1.1/']) {
      created = false
      const result = await captureWebsiteScreenshot(url, { createWindow: () => { created = true; return fakeWindow() } })
      expect(result).toMatchObject({ status: 'rejected' })
      expect(created).toBe(false)
    }
  })

  it('rejects a malformed URL', async () => {
    const result = await captureWebsiteScreenshot('not a url', { createWindow: () => fakeWindow() })
    expect(result).toMatchObject({ status: 'rejected' })
  })

  it('captures a real page and returns the data URL, always destroying the window afterward', async () => {
    let destroyed = false
    const win = fakeWindow({ destroy: () => { destroyed = true } })
    const result = await captureWebsiteScreenshot('https://example-landscaping.invalid/', {
      createWindow: () => win,
      now: () => new Date('2026-08-08T12:00:00.000Z'),
    })
    expect(result).toEqual({
      status: 'captured',
      dataUrl: 'data:image/png;base64,fake',
      capturedAt: '2026-08-08T12:00:00.000Z',
      url: 'https://example-landscaping.invalid/',
    })
    expect(destroyed).toBe(true)
  })

  it('reports a timeout as a failure and still destroys the window', async () => {
    let destroyed = false
    const win = fakeWindow({
      loadURL: () => new Promise(() => {}), // never resolves
      destroy: () => { destroyed = true },
    })
    const result = await captureWebsiteScreenshot('https://example.invalid/', { createWindow: () => win, timeoutMs: 20 })
    expect(result).toMatchObject({ status: 'failed' })
    if (result.status === 'failed') expect(result.reason).toMatch(/timed out/i)
    expect(destroyed).toBe(true)
  })

  it('reports a load failure as a failed result and still destroys the window', async () => {
    let destroyed = false
    const win = fakeWindow({
      loadURL: async () => { throw new Error('net::ERR_NAME_NOT_RESOLVED') },
      destroy: () => { destroyed = true },
    })
    const result = await captureWebsiteScreenshot('https://example.invalid/', { createWindow: () => win })
    expect(result).toMatchObject({ status: 'failed', reason: expect.stringContaining('ERR_NAME_NOT_RESOLVED') })
    expect(destroyed).toBe(true)
  })
})
