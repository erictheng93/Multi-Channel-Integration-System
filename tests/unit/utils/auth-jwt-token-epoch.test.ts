import { describe, it, expect, vi, afterEach } from 'vitest'
import { bumpTokensValidAfter, isIssuedBeforeTokenEpoch } from '@/utils/auth-jwt'

function kv() {
  const m = new Map<string, string>()
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v) } } as unknown as KVNamespace
}

describe('token epoch', () => {
  afterEach(() => vi.useRealTimers())

  it('rejects a token minted earlier in the same second as the bump', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:00.900Z'))
    const cache = kv(); const iat = Math.floor(Date.now() / 1000)
    await bumpTokensValidAfter(cache, 1)
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat })).toBe(true)
  })

  it('accepts a token minted after the bump second and when no epoch exists', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:00.100Z'))
    const cache = kv(); const bumpSec = Math.floor(Date.now() / 1000)
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat: bumpSec })).toBe(false)
    await bumpTokensValidAfter(cache, 1)
    expect(await isIssuedBeforeTokenEpoch(cache, { userId: 1, iat: bumpSec + 1 })).toBe(false)
  })
})
