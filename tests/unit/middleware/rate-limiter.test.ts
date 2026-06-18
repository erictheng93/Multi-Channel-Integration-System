import { describe, expect, it } from 'vitest'
import type { Context } from 'hono'
import { getLoginIdentifier } from '@/middleware/rate-limiter'

/**
 * Build a minimal Hono-like Context for identifier unit tests.
 * Only the surface that getLoginIdentifier touches is implemented:
 * req.json() (login body) and req.header() (IP fallback).
 */
function mockContext(
  body: unknown,
  headers: Record<string, string> = {},
  jsonThrows = false
): Context {
  return {
    req: {
      json: async () => {
        if (jsonThrows) {
          throw new Error('invalid json')
        }
        return body
      },
      header: (name: string) => headers[name]
    }
  } as unknown as Context
}

describe('getLoginIdentifier', () => {
  it('keys by account email so colleagues behind one office IP get separate buckets', async () => {
    const sharedIp = { 'CF-Connecting-IP': '203.0.113.45' }

    const seanKey = await getLoginIdentifier(mockContext({ email: 'sean@dacit.net' }, sharedIp))
    const oliviaKey = await getLoginIdentifier(mockContext({ email: 'olivia@dacit.net' }, sharedIp))

    // Same office IP, different accounts -> different rate-limit buckets.
    expect(seanKey).not.toBe(oliviaKey)
    expect(seanKey).toBe('account:sean@dacit.net')
    expect(oliviaKey).toBe('account:olivia@dacit.net')
  })

  it('normalizes email (trim + lowercase) so case/whitespace cannot split or bypass the bucket', async () => {
    const key = await getLoginIdentifier(mockContext({ email: '  Sean@DACIT.net  ' }))
    expect(key).toBe('account:sean@dacit.net')
  })

  it('falls back to client IP when no email is present in the body', async () => {
    const key = await getLoginIdentifier(mockContext({}, { 'CF-Connecting-IP': '198.51.100.7' }))
    expect(key).toBe('198.51.100.7')
  })

  it('falls back to client IP when the request body is not valid JSON', async () => {
    const key = await getLoginIdentifier(
      mockContext(null, { 'CF-Connecting-IP': '198.51.100.7' }, true)
    )
    expect(key).toBe('198.51.100.7')
  })
})
