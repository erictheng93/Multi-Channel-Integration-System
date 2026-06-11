import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../functions/_middleware'

function parseCsp(csp: string): Record<string, string[]> {
  return csp.split(';').reduce<Record<string, string[]>>((directives, rawDirective) => {
    const parts = rawDirective.trim().split(/\s+/).filter(Boolean)
    const [name, ...values] = parts
    if (name) {
      directives[name] = values
    }
    return directives
  }, {})
}

function readStaticHeadersCsp(): string {
  const headers = readFileSync(join(process.cwd(), '_headers'), 'utf8')
  const cspLine = headers
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('Content-Security-Policy:'))

  if (!cspLine) {
    throw new Error('Content-Security-Policy header not found in frontend/_headers')
  }

  return cspLine.replace('Content-Security-Policy:', '').trim()
}

function expectLiffSources(csp: string): void {
  const directives = parseCsp(csp)

  expect(directives['script-src']).toEqual(expect.arrayContaining([
    'https://static.line-scdn.net'
  ]))
  expect(directives['connect-src']).toEqual(expect.arrayContaining([
    'https://api.line.me',
    'https://access.line.me',
    'https://liffsdk.line-scdn.net',
    'https://*.line-scdn.net'
  ]))
  expect(directives['img-src']).toContain('https:')
  expect(directives['frame-src']).toEqual(["'none'"])
}

function expectNoUnsafeScriptSources(csp: string): void {
  const directives = parseCsp(csp)
  const scriptSources = directives['script-src'] ?? []

  expect(scriptSources).not.toContain("'unsafe-inline'")
  expect(scriptSources).not.toContain("'unsafe-eval'")
}

describe('LIFF CSP smoke coverage', () => {
  it('keeps LIFF sources in the dynamic Cloudflare Pages middleware CSP', async () => {
    const response = await onRequest({
      request: new globalThis.Request('https://app.example.com/liff/team-join.html'),
      functionPath: '/liff/team-join.html',
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      next: vi.fn(async () => new globalThis.Response('ok')),
      env: {
        BACKEND_URL: 'https://api.example.com',
        STORAGE_URL: 'https://storage.example.com'
      },
      params: {},
      data: {}
    })

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expectLiffSources(csp ?? '')
    expectNoUnsafeScriptSources(csp ?? '')

    const directives = parseCsp(csp ?? '')
    expect(directives['connect-src']).toEqual(expect.arrayContaining([
      'https://api.example.com',
      'wss://api.example.com',
      'https://storage.example.com'
    ]))
  })

  it('keeps LIFF sources in the static _headers CSP fallback', () => {
    const csp = readStaticHeadersCsp()

    expectLiffSources(csp)
    expectNoUnsafeScriptSources(csp)
  })
})
