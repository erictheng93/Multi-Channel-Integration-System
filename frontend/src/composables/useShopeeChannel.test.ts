import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shopeeInfo, shopeeRedirectNotice } from './useShopeeChannel'
import { getShopeeAuthorizeUrl } from '@/api/channels'
import { channelGlyph, platformName } from '@/composables/conversation/useConversationRowMeta'
import type { ChannelIntegration } from '@/api/channels'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('@/api/authenticatedFetch', () => ({ authenticatedFetch: fetchMock }))

const channel = (cfg: Record<string, unknown>) => ({ id: 1, teamId: 3, platform: 'shopee', config: JSON.stringify(cfg) }) as unknown as ChannelIntegration

describe('shopee channel helpers', () => {
  beforeEach(() => fetchMock.mockReset())

  it.each([
    ['active', '已授權', false],
    ['expiring', '即將到期', true],
    ['revoked', '已取消授權', true],
    ['reauth_required', '需要重新授權', true]
  ])('maps %s to zh-TW label', (status, label, reauth) => {
    const info = shopeeInfo(channel({ shopId: 99, env: 'live', shopName: 'S', authStatus: status }))
    expect(info).toMatchObject({ statusLabel: label, needsReauth: reauth, env: '正式', shopId: '99', shopName: 'S' })
  })

  it('treats unknown status as needing reauthorization', () => {
    expect(shopeeInfo(channel({ shopId: 1, env: 'sandbox' })).status).toBe('reauth_required')
  })

  it('builds notices from the redirect query', () => {
    expect(shopeeRedirectNotice({ shopee: 'connected' })?.type).toBe('success')
    expect(shopeeRedirectNotice({ shopee: 'error', reason: 'access_denied' })).toMatchObject({ type: 'error' })
    expect(shopeeRedirectNotice({})).toBeNull()
  })

  it('requests the authorize url for the team', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { url: 'https://shopee.example/auth' } }) })
    await expect(getShopeeAuthorizeUrl(3)).resolves.toBe('https://shopee.example/auth')
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/api/integrations/shopee/authorize-url?teamId=3')
  })

  it('throws when the backend refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: 'nope' }) })
    await expect(getShopeeAuthorizeUrl(3)).rejects.toThrow('nope')
  })

  it('has a glyph tile and label for shopee', () => {
    expect(channelGlyph('shopee')?.cls).toBe('ui-ch-shopee')
    expect(channelGlyph(null)).toBeNull()
    expect(platformName('shopee')).toBe('蝦皮')
  })
})
