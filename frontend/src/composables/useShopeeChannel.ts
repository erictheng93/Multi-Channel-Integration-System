import type { ChannelIntegration } from '@/api/channels'
import { getShopeeAuthorizeUrl, parseConfig } from '@/api/channels'

export type ShopeeAuthStatus = 'active' | 'expiring' | 'revoked' | 'reauth_required'

export const SHOPEE_AUTH_LABELS: Record<ShopeeAuthStatus, string> = {
  active: '已授權',
  expiring: '即將到期',
  revoked: '已取消授權',
  'reauth_required': '需要重新授權'
}

/** Pill tone per status: only a healthy authorization is green */
export const SHOPEE_AUTH_TONES: Record<ShopeeAuthStatus, 'green' | 'orange' | 'red'> = {
  active: 'green',
  expiring: 'orange',
  revoked: 'red',
  'reauth_required': 'red'
}

export interface ShopeeShopInfo {
  shopId: string
  shopName: string
  env: '沙盒' | '正式'
  status: ShopeeAuthStatus
  statusLabel: string
  needsReauth: boolean
}

export function shopeeInfo(channel: ChannelIntegration): ShopeeShopInfo {
  const cfg = parseConfig(channel)
  const raw = String(cfg.authStatus ?? 'reauth_required')
  const status = (raw in SHOPEE_AUTH_LABELS ? raw : 'reauth_required') as ShopeeAuthStatus
  return {
    shopId: cfg.shopId === undefined ? '' : String(cfg.shopId),
    shopName: typeof cfg.shopName === 'string' ? cfg.shopName : '',
    env: cfg.env === 'live' ? '正式' : '沙盒',
    status,
    statusLabel: SHOPEE_AUTH_LABELS[status],
    needsReauth: status !== 'active'
  }
}

/** Open Shopee's authorization page (same tab: Shopee redirects back to /channels?shopee=...). */
export async function startShopeeAuthorization(teamId: number): Promise<void> {
  window.location.assign(await getShopeeAuthorizeUrl(teamId))
}

const ERROR_REASONS: Record<string, string> = {
  state: '授權連結已失效，請重新操作。',
  'access_denied': '您在蝦皮取消了授權。',
  'shop_mismatch': '授權的商店與預期不符。'
}

/** Notice for the `?shopee=` redirect params, or null when absent */
export function shopeeRedirectNotice(query: Record<string, unknown>): { type: 'success' | 'error'; title: string; description?: string } | null {
  const v = Array.isArray(query.shopee) ? query.shopee[0] : query.shopee
  if (v === 'connected') { return { type: 'success', title: '蝦皮商店已連結' } }
  if (v !== 'error') { return null }
  const reason = Array.isArray(query.reason) ? query.reason[0] : query.reason
  const code = typeof reason === 'string' ? reason : ''
  return { type: 'error', title: '蝦皮授權失敗', description: ERROR_REASONS[code] ?? (code ? `原因代碼：${code}` : '請稍後再試。') }
}
