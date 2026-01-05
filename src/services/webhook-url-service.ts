/**
 * Webhook URL Management Service
 *
 * Centralized service for generating and managing webhook URLs across all platforms.
 * Provides environment-aware URL generation and validation.
 *
 * @module services/webhook-url-service
 */

import { getBackendUrl, type WorkerEnv } from '@/config/runtime';

/**
 * Supported webhook platforms
 */
export type WebhookPlatform = 'line' | 'facebook' | 'whatsapp' | 'telegram' | 'instagram';

/**
 * Webhook URL configuration
 */
export interface WebhookUrlConfig {
  /** Base URL for the webhook */
  baseUrl: string;

  /** Platform-specific path */
  path: string;

  /** Full webhook URL */
  fullUrl: string;

  /** Environment (development or production) */
  environment: 'development' | 'production';
}

/**
 * Webhook endpoint paths for each platform
 */
const WEBHOOK_PATHS: Record<WebhookPlatform, string> = {
  line: '/webhooks/line',
  facebook: '/webhooks/facebook',
  whatsapp: '/webhooks/whatsapp',
  telegram: '/webhooks/telegram',
  instagram: '/webhooks/instagram'
} as const;

/**
 * Get webhook URL for a specific platform
 *
 * @param env - Cloudflare Workers environment
 * @param platform - Platform identifier (line, facebook, etc.)
 * @returns Complete webhook URL
 *
 * @example
 * ```typescript
 * // Development
 * getWebhookUrl(env, 'line')
 * // => 'http://localhost:8787/webhooks/line'
 *
 * // Production
 * getWebhookUrl(env, 'line')
 * // => 'https://multi-channel.imfinethankyouandyou.com/webhooks/line'
 * ```
 */
export function getWebhookUrl(env: WorkerEnv, platform: WebhookPlatform): string {
  const baseUrl = getBackendUrl(env);
  const path = WEBHOOK_PATHS[platform];

  return `${baseUrl}${path}`;
}

/**
 * Get webhook configuration for a specific platform
 *
 * @param env - Cloudflare Workers environment
 * @param platform - Platform identifier
 * @returns Webhook URL configuration object
 *
 * @example
 * ```typescript
 * const config = getWebhookConfig(env, 'line');
 * console.log(config);
 * // {
 * //   baseUrl: 'https://multi-channel.imfinethankyouandyou.com',
 * //   path: '/webhooks/line',
 * //   fullUrl: 'https://multi-channel.imfinethankyouandyou.com/webhooks/line',
 * //   environment: 'production'
 * // }
 * ```
 */
export function getWebhookConfig(env: WorkerEnv, platform: WebhookPlatform): WebhookUrlConfig {
  const baseUrl = getBackendUrl(env);
  const path = WEBHOOK_PATHS[platform];
  const fullUrl = `${baseUrl}${path}`;
  const environment = env.ENVIRONMENT === 'production' ? 'production' : 'development';

  return {
    baseUrl,
    path,
    fullUrl,
    environment
  };
}

/**
 * Get all webhook URLs for all platforms
 *
 * @param env - Cloudflare Workers environment
 * @returns Map of platform to webhook URL
 *
 * @example
 * ```typescript
 * const urls = getAllWebhookUrls(env);
 * console.log(urls);
 * // {
 * //   line: 'https://multi-channel.imfinethankyouandyou.com/webhooks/line',
 * //   facebook: 'https://multi-channel.imfinethankyouandyou.com/webhooks/facebook',
 * //   ...
 * // }
 * ```
 */
export function getAllWebhookUrls(env: WorkerEnv): Record<WebhookPlatform, string> {
  const baseUrl = getBackendUrl(env);

  return {
    line: `${baseUrl}${WEBHOOK_PATHS.line}`,
    facebook: `${baseUrl}${WEBHOOK_PATHS.facebook}`,
    whatsapp: `${baseUrl}${WEBHOOK_PATHS.whatsapp}`,
    telegram: `${baseUrl}${WEBHOOK_PATHS.telegram}`,
    instagram: `${baseUrl}${WEBHOOK_PATHS.instagram}`
  };
}

/**
 * Validate webhook URL format
 *
 * @param url - URL to validate
 * @returns True if URL is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidWebhookUrl('https://example.com/webhooks/line');  // true
 * isValidWebhookUrl('invalid-url');                         // false
 * isValidWebhookUrl('ftp://example.com/webhooks/line');    // false (invalid protocol)
 * ```
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must use HTTP or HTTPS protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Must have a hostname
    if (!parsed.hostname) {
      return false;
    }

    // Must have a pathname
    if (!parsed.pathname || parsed.pathname === '/') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract platform from webhook URL
 *
 * @param url - Webhook URL
 * @returns Platform identifier if found, null otherwise
 *
 * @example
 * ```typescript
 * extractPlatformFromUrl('https://example.com/webhooks/line');    // 'line'
 * extractPlatformFromUrl('https://example.com/webhooks/facebook'); // 'facebook'
 * extractPlatformFromUrl('https://example.com/api/users');         // null
 * ```
 */
export function extractPlatformFromUrl(url: string): WebhookPlatform | null {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    // Check if path matches pattern: /webhooks/{platform}
    if (pathSegments.length >= 2 && pathSegments[0] === 'webhooks') {
      const platform = pathSegments[1] as WebhookPlatform;

      // Validate platform
      if (Object.keys(WEBHOOK_PATHS).includes(platform)) {
        return platform;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Build webhook URL with query parameters
 *
 * @param env - Cloudflare Workers environment
 * @param platform - Platform identifier
 * @param params - Query parameters to append
 * @returns Webhook URL with query parameters
 *
 * @example
 * ```typescript
 * buildWebhookUrlWithParams(env, 'line', {
 *   verify_token: 'abc123',
 *   mode: 'subscribe'
 * });
 * // => 'https://multi-channel.imfinethankyouandyou.com/webhooks/line?verify_token=abc123&mode=subscribe'
 * ```
 */
export function buildWebhookUrlWithParams(
  env: WorkerEnv,
  platform: WebhookPlatform,
  params: Record<string, string>
): string {
  const baseUrl = getWebhookUrl(env, platform);
  const queryParams = new URLSearchParams(params);

  return `${baseUrl}?${queryParams.toString()}`;
}

/**
 * Compare two webhook URLs (ignoring query parameters and trailing slashes)
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns True if URLs are equivalent, false otherwise
 *
 * @example
 * ```typescript
 * compareWebhookUrls(
 *   'https://example.com/webhooks/line/',
 *   'https://example.com/webhooks/line?token=123'
 * );  // true
 *
 * compareWebhookUrls(
 *   'https://example.com/webhooks/line',
 *   'https://example.com/webhooks/facebook'
 * );  // false
 * ```
 */
export function compareWebhookUrls(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);

    // Normalize paths (remove trailing slashes)
    const path1 = parsed1.pathname.replace(/\/$/, '');
    const path2 = parsed2.pathname.replace(/\/$/, '');

    return (
      parsed1.protocol === parsed2.protocol &&
      parsed1.hostname === parsed2.hostname &&
      parsed1.port === parsed2.port &&
      path1 === path2
    );
  } catch {
    return false;
  }
}

/**
 * Get webhook path for a platform
 *
 * @param platform - Platform identifier
 * @returns Webhook path (e.g., '/webhooks/line')
 */
export function getWebhookPath(platform: WebhookPlatform): string {
  return WEBHOOK_PATHS[platform];
}

/**
 * Check if a URL is a webhook endpoint
 *
 * @param url - URL to check
 * @returns True if URL is a webhook endpoint, false otherwise
 *
 * @example
 * ```typescript
 * isWebhookEndpoint('https://example.com/webhooks/line');  // true
 * isWebhookEndpoint('https://example.com/api/users');      // false
 * ```
 */
export function isWebhookEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    return pathSegments.length >= 2 && pathSegments[0] === 'webhooks';
  } catch {
    return false;
  }
}
