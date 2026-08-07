import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectPublicWebsiteReadOnly, WebsiteInspectionRejected } from '../electron/agent/website-inspector'

// A real local HTTP server, not a mock of fetch — proves the tool's actual
// GET request, timeout, and truncation behavior against real bytes on the
// wire, the same standard the rest of this codebase holds itself to.
function startServer(handler: http.RequestListener) {
  const server = http.createServer(handler)
  return new Promise<{ server: http.Server; port: number }>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as AddressInfo).port }))
  })
}

const servers: http.Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))))
})

// The tool only accepts https, but we can't stand up TLS trivially in a test;
// these tests exercise the http-vs-https rejection with a plain http.invalid
// scheme check, and use a real http server only for what actually needs
// bytes on the wire, via an https-shaped URL rewritten through fetchImpl's
// base — instead we test the network path by injecting a fetchImpl wrapper
// that redirects an https:// URL to the local http server, proving the rest
// of the pipeline (timeout, size cap, response shape) without needing a cert.

describe('inspectPublicWebsiteReadOnly', () => {
  it('rejects a non-https URL before making any request', async () => {
    await expect(inspectPublicWebsiteReadOnly('http://example.com')).rejects.toThrow(WebsiteInspectionRejected)
  })

  it('rejects obviously local/internal hostnames before making any request', async () => {
    for (const url of ['https://localhost/', 'https://127.0.0.1/', 'https://10.0.0.5/', 'https://192.168.1.1/']) {
      await expect(inspectPublicWebsiteReadOnly(url)).rejects.toThrow(WebsiteInspectionRejected)
    }
  })

  it('rejects a malformed URL', async () => {
    await expect(inspectPublicWebsiteReadOnly('not a url')).rejects.toThrow(WebsiteInspectionRejected)
  })

  it('fetches real bytes over GET and reports status, content-type, and body', async () => {
    const { server, port } = await startServer((req, res) => {
      expect(req.method).toBe('GET')
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body>Example Landscaping Co</body></html>')
    })
    servers.push(server)

    const fetchImpl: typeof fetch = (_input, init) => fetch(`http://127.0.0.1:${port}/`, init)

    const result = await inspectPublicWebsiteReadOnly('https://example-landscaping.invalid/', { fetchImpl })

    expect(result.statusCode).toBe(200)
    expect(result.contentType).toBe('text/html')
    expect(result.textExcerpt).toContain('Example Landscaping Co')
    expect(result.truncated).toBe(false)
  })

  it('truncates a response larger than maxBytes and reports truncated: true', async () => {
    const big = 'x'.repeat(1000)
    const { server, port } = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(big)
    })
    servers.push(server)

    const fetchImpl: typeof fetch = (_input, init) => fetch(`http://127.0.0.1:${port}/`, init)

    const result = await inspectPublicWebsiteReadOnly('https://example.invalid/', { fetchImpl, maxBytes: 100 })

    expect(result.textExcerpt).toHaveLength(100)
    expect(result.truncated).toBe(true)
  })

  it('rejects with a clear error when the request times out', async () => {
    const { server, port } = await startServer((_req, res) => {
      // Never respond — proves the timeout actually fires rather than hanging.
      setTimeout(() => res.end(), 60_000)
    })
    servers.push(server)

    const fetchImpl: typeof fetch = (_input, init) => fetch(`http://127.0.0.1:${port}/`, init)

    await expect(
      inspectPublicWebsiteReadOnly('https://example.invalid/', { fetchImpl, timeoutMs: 50 }),
    ).rejects.toThrow(/timed out/)
  })
})
