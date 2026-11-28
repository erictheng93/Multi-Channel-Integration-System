/**
 * Shopee Chat Phase 1 shared contract (docs/specs/shopee-chat-phase-1.md).
 * App-level secrets (partner id/key, push key) come from env; everything per shop
 * lives in one channel_integrations row with platform = 'shopee'.
 */

export const SHOPEE_PLATFORM = 'shopee' as const;

/** Shown to agents for every outbound attempt until the Chat API is granted. Never retried. */
export const SHOPEE_SEND_NOT_ENABLED_ERROR = '尚未開通 Shopee Chat API 發訊權限';

/** Push codes Phase 1 acts on; every other code is acked (2xx, empty body) and ignored. */
export const SHOPEE_PUSH_CODE = {
  SHOP_AUTHORIZATION: 1,
  SHOP_AUTHORIZATION_CANCELED: 2,
  WEBCHAT: 10,
  AUTHORIZATION_EXPIRY: 12,
} as const;

export type ShopeeAuthStatus = 'active' | 'expiring' | 'revoked' | 'reauth_required';

/** channel_integrations.config (plain JSON) for platform = 'shopee'. */
export interface ShopeeChannelConfig {
  shopId: number;
  env: 'sandbox' | 'live';
  shopName?: string;
  region?: string;
  authStatus: ShopeeAuthStatus;
  /** Seller-chosen authorization end (unix seconds), when known. */
  authExpireAt?: number;
  /** Last status change reason, e.g. push code or refresh error. */
  authStatusReason?: string;
}

/** channel_integrations.credentials (encrypted JSON) for platform = 'shopee'. */
export interface ShopeeChannelCredentials {
  accessToken: string;
  refreshToken: string;
  /** access_token expiry, unix seconds. */
  accessExpireAt: number;
}

/**
 * messages.platform_message_id is globally unique across platforms, so Shopee ids are namespaced.
 */
export function shopeePlatformMessageId(shopId: number | string, messageId: string): string {
  return `shopee:${shopId}:${messageId}`;
}

/**
 * customers are unique per (platform, platform_user_id) and conversations per customer, so the buyer id
 * is scoped by shop: the same buyer talking to two shops gets two conversations, each replyable from its shop.
 */
export function shopeePlatformUserId(shopId: number | string, buyerUserId: number | string): string {
  return `${shopId}:${buyerUserId}`;
}
