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

/**
 * The CSP from the static `_headers` file.
 *
 * Two things about this moved on 2026-08-03 and both are deliberate:
 *
 *   - the file lives in public/ now, so Vite copies it to dist on every build.
 *     It used to sit at the frontend root and depend on `copy-pages-config`,
 *     which `deploy:pages` never ran - so the headers had never actually
 *     shipped to production.
 *
 *   - the header is Content-Security-Policy-REPORT-ONLY. Enforcing it was
 *     measured to break Google Tag Manager (two Cloudflare-injected inline
 *     bootstrap scripts) and the HTML report preview (frame-src 'none' vs the
 *     iframe in ReportViewerContent.vue).
 *
 * Both names are accepted so this test keeps working when the policy is
 * eventually switched to enforcing.
 */
function readStaticHeadersCsp(): string {
  const path = join(process.cwd(), 'public', '_headers')
  const headers = readFileSync(path, 'utf8')

  const prefixes = ['Content-Security-Policy-Report-Only:', 'Content-Security-Policy:']
  for (const prefix of prefixes) {
    const line = headers
      .split('\n')
      .map(entry => entry.trim())
      .find(entry => entry.startsWith(prefix))

    if (line) {
      return line.slice(prefix.length).trim()
    }
  }

  throw new Error(`No CSP header (enforcing or report-only) found in ${path}`)
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
