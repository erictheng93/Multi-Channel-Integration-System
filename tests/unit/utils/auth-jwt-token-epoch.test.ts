import { describe, it, expect, vi, afterEach } from 'vitest'
import { bumpTokensValidAfter, isIssuedBeforeTokenEpoch } from '@/utils/auth-jwt'

function kv() {
  const m = new Map<string, string>()
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v) } } as unknown as KVNamespace
}

const tok = () => ({ userId: 1, iat: Math.floor(Date.now() / 1000), iatMs: Date.now() })

describe('token epoch', () => {
  afterEach(() => vi.useRealTimers())

  it('rejects a token minted earlier in the same second as the bump', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:00.100Z'))
    const cache = kv(); const old = tok()
    vi.setSystemTime(new Date('2026-10-19T00:00:00.900Z'))
    await bumpTokensValidAfter(cache, 1)
    expect(await isIssuedBeforeTokenEpoch(cache, old)).toBe(true)
  })

  it('accepts a token minted right after the bump, even in the same second', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:00.100Z'))
    const cache = kv()
    expect(await isIssuedBeforeTokenEpoch(cache, tok())).toBe(false)
    await bumpTokensValidAfter(cache, 1)
    vi.setSystemTime(new Date('2026-10-19T00:00:00.300Z'))
    expect(await isIssuedBeforeTokenEpoch(cache, tok())).toBe(false)
  })

  it('treats a legacy token without iatMs by its iat second', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:10.500Z'))
    const cache = kv(); await bumpTokensValidAfter(cache, 1)
    const now = Math.floor(Date.now() / 1000)
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat: now - 1 })).toBe(true)
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat: now + 1 })).toBe(false)
  })

  it('reads a legacy seconds-valued epoch', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:10.000Z'))
    const cache = kv(); const now = Math.floor(Date.now() / 1000)
    await cache.put('tokens-valid-after:1', String(now))
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat: now - 5, iatMs: (now - 5) * 1000 })).toBe(true)
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat: now + 1, iatMs: (now + 1) * 1000 })).toBe(false)
  })
})
