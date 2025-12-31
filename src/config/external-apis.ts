/**
 * External API Configuration
 *
 * Centralized configuration for all external API endpoints.
 * This file provides a single source of truth for third-party API integrations.
 *
 * @module config/external-apis
 */

/**
 * LINE Messaging API Configuration
 */
export const LINE_API = {
  /** LINE Messaging API base URL */
  baseUrl: 'https://api.line.me/v2/bot',

  /** LINE Data API base URL */
  dataApiUrl: 'https://api-data.line.me/v2/bot',

  /** LINE Messaging API endpoints */
  endpoints: {
    /** Reply to a message */
    reply: '/message/reply',

    /** Push a message */
    push: '/message/push',

    /** Send multicast message */
    multicast: '/message/multicast',

    /** Broadcast message */
    broadcast: '/message/broadcast',

    /** Get message quota */
    quota: '/message/quota',

    /** Get message quota consumption */
    quotaConsumption: '/message/quota/consumption',

    /** Get user profile */
    profile: '/profile/{userId}',

    /** Get group member profile */
    groupMember: '/group/{groupId}/member/{userId}',

    /** Get bot info */
    info: '/info',

    /** Get webhook endpoint */
    webhook: '/channel/webhook/endpoint',

    /** Get message content (images, videos, audio) */
    messageContent: '/message/{messageId}/content'
  },

  /** LINE OAuth endpoints */
  oauth: {
    /** Verify access token */
    verify: 'https://api.line.me/v2/oauth/verify'
  },

  /** LINE sticker CDN URLs */
  stickers: {
    /** LINE Sticker Shop CDN (Android) */
    shopAndroid: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/{stickerId}/android/sticker.png',

    /** LINE Sticker Shop CDN (iPhone) */
    shopIphone: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/{stickerId}/iPhone/sticker.png',

    /** LINE OBS CDN (Android) */
    obsAndroid: 'https://obs.line-scdn.net/{packageId}/{stickerId}/android/sticker.png',

    /** LINE OBS CDN (iOS) */
    obsIos: 'https://obs.line-scdn.net/{packageId}/{stickerId}/ios/sticker.png',

    /** Legacy Naver CDN */
    naver: 'http://dl.stickershop.line.naver.jp/products/0/0/1/{packageId}/android/sticker.png'
  },

  /** LIFF (LINE Front-end Framework) */
  liff: {
    /** LIFF SDK URL */
    sdk: 'https://static.line-scdn.net/liff/edge/2/sdk.js'
  }
} as const;

/**
 * Facebook Graph API Configuration
 */
export const FACEBOOK_API = {
  /** Facebook Graph API base URL (v18.0) */
  baseUrl: 'https://graph.facebook.com/v18.0',

  /** Facebook Graph API endpoints */
  endpoints: {
    /** Send messages */
    sendMessage: '/me/messages',

    /** Get user info */
    userInfo: '/{userId}',

    /** Get page info */
    pageInfo: '/{pageId}',

    /** Refresh access token */
    tokenRefresh: '/oauth/access_token'
  },

  /** Page-specific fields */
  pageFields: {
    /** Basic page info */
    basic: 'id,name,access_token',

    /** Extended page info */
    extended: 'id,name,access_token,picture,category'
  },

  /** User-specific fields */
  userFields: {
    /** Basic user info */
    basic: 'first_name,last_name,profile_pic',

    /** Extended user info */
    extended: 'first_name,last_name,profile_pic,locale,timezone,gender'
  }
} as const;

/**
 * QR Code Generation API Configuration
 */
export const QR_CODE_API = {
  /** QR Code API base URL */
  baseUrl: 'https://api.qrserver.com/v1',

  /** QR Code API endpoints */
  endpoints: {
    /** Create QR code */
    create: '/create-qr-code/'
  },

  /** Default QR code settings */
  defaults: {
    /** Default size in pixels */
    size: '200x200',

    /** Default error correction level (L, M, Q, H) */
    errorCorrection: 'M',

    /** Default format (png, svg, eps) */
    format: 'png'
  }
} as const;

/**
 * Cloudflare API Configuration (for Web Installer)
 */
export const CLOUDFLARE_API = {
  /** Cloudflare Dashboard URL */
  dashboardUrl: 'https://dash.cloudflare.com',

  /** Cloudflare API base URL */
  apiUrl: 'https://api.cloudflare.com/client/v4',

  /** OAuth endpoints */
  oauth: {
    /** OAuth authorization endpoint */
    auth: 'https://dash.cloudflare.com/oauth2/auth',

    /** OAuth token endpoint */
    token: 'https://dash.cloudflare.com/oauth2/token'
  },

  /** API endpoints */
  endpoints: {
    /** User info */
    user: '/user',

    /** Accounts */
    accounts: '/accounts',

    /** D1 databases */
    d1: '/accounts/{accountId}/d1/database',

    /** KV namespaces */
    kv: '/accounts/{accountId}/storage/kv/namespaces',

    /** R2 buckets */
    r2: '/accounts/{accountId}/r2/buckets',

    /** Workers */
    workers: '/accounts/{accountId}/workers/scripts',

    /** Pages */
    pages: '/accounts/{accountId}/pages/projects'
  }
} as const;

/**
 * Email Service API Configuration (Resend for Web Installer)
 */
export const EMAIL_API = {
  /** Resend API base URL */
  baseUrl: 'https://api.resend.com',

  /** Resend API endpoints */
  endpoints: {
    /** Send email */
    send: '/emails'
  }
} as const;

/**
 * External Content APIs
 */
export const CONTENT_APIS = {
  /** Unicode Emoji Data */
  unicode: {
    /** Emoji test data URL */
    emojiTest: 'https://unicode.org/Public/emoji/15.1/emoji-test.txt'
  },

  /** Google Fonts */
  googleFonts: {
    /** Google Fonts CSS API */
    css: 'https://fonts.googleapis.com/css2',

    /** Google Fonts static CDN */
    static: 'https://fonts.gstatic.com'
  },

  /** Twemoji (Twitter Emoji) */
  twemoji: {
    /** Twemoji CDN base URL */
    cdn: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72'
  }
} as const;

/**
 * Helper function to build LINE API URL
 */
export function buildLineApiUrl(endpoint: string, params?: Record<string, string>): string {
  let url = LINE_API.baseUrl + endpoint;

  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });
  }

  return url;
}

/**
 * Helper function to build LINE Data API URL
 */
export function buildLineDataApiUrl(endpoint: string, params?: Record<string, string>): string {
  let url = LINE_API.dataApiUrl + endpoint;

  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });
  }

  return url;
}

/**
 * Helper function to build Facebook API URL
 */
export function buildFacebookApiUrl(endpoint: string, params?: Record<string, string>): string {
  let url = FACEBOOK_API.baseUrl + endpoint;

  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });
  }

  return url;
}

/**
 * Helper function to build QR Code API URL
 */
export function buildQrCodeApiUrl(data: string, options?: {
  size?: string;
  errorCorrection?: string;
  format?: string;
}): string {
  const params = new URLSearchParams({
    data: data,
    size: options?.size || QR_CODE_API.defaults.size,
    ecc: options?.errorCorrection || QR_CODE_API.defaults.errorCorrection,
    format: options?.format || QR_CODE_API.defaults.format
  });

  return `${QR_CODE_API.baseUrl}${QR_CODE_API.endpoints.create}?${params.toString()}`;
}

/**
 * Helper function to build Cloudflare API URL
 */
export function buildCloudflareApiUrl(endpoint: string, params?: Record<string, string>): string {
  let url = CLOUDFLARE_API.apiUrl + endpoint;

  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });
  }

  return url;
}

/**
 * Get LINE sticker URL
 */
export function getLineStickerUrl(packageId: string, stickerId: string, platform: 'android' | 'ios' = 'android'): string {
  if (platform === 'android') {
    // Try OBS CDN first
    return LINE_API.stickers.obsAndroid
      .replace('{packageId}', packageId)
      .replace('{stickerId}', stickerId);
  } else {
    // iOS uses OBS CDN
    return LINE_API.stickers.obsIos
      .replace('{packageId}', packageId)
      .replace('{stickerId}', stickerId);
  }
}

/**
 * Get LINE message content URL
 */
export function getLineMessageContentUrl(messageId: string): string {
  return buildLineDataApiUrl(LINE_API.endpoints.messageContent, { messageId });
}

/**
 * Get Twemoji image URL
 */
export function getTwemojiUrl(emojiCode: string): string {
  return `${CONTENT_APIS.twemoji.cdn}/${emojiCode}.png`;
}

/**
 * All external API configurations
 */
export const EXTERNAL_APIS = {
  line: LINE_API,
  facebook: FACEBOOK_API,
  qrCode: QR_CODE_API,
  cloudflare: CLOUDFLARE_API,
  email: EMAIL_API,
  content: CONTENT_APIS
} as const;
