/**
 * Unified R2 public file URL generation
 *
 * Single source of truth for generating public-facing URLs to R2 files.
 * Priority chain:
 *   1. STORAGE_PUBLIC_URL  (e.g., "https://s3.daiwandist.com")
 *   2. R2_CUSTOM_DOMAIN    (e.g., "cdn.example.com")
 *   3. R2_PUBLIC_DOMAIN    (e.g., "r2pub.example.com")
 *   4. Worker proxy fallback via BACKEND_URL
 *
 * Note on types: getBackendUrl() accepts WorkerEnv, Bindings is a superset
 * of WorkerEnv (structural subtyping), so passing Bindings compiles cleanly.
 * Priority 4 (Worker proxy) requires BACKEND_URL to be set. In production
 * this is always the case (wrangler.toml), and priority 1 (STORAGE_PUBLIC_URL)
 * is also always set, so priority 4 is only reached in misconfigured envs.
 */

import type { Bindings } from '@/types';
import { getBackendUrl } from '@/config/runtime';
import { signFileUrl } from '@/utils/file-signed-url';

function isLocalhost(value: string): boolean {
  return value.includes('localhost') || value.includes('127.0.0.1');
}

/**
 * Generate a public URL for an R2 file.
 *
 * @param env - Worker bindings (reads STORAGE_PUBLIC_URL, R2_CUSTOM_DOMAIN, etc.)
 * @param r2Key - The R2 object key (e.g., "media/line/2026/3/abc.jpg")
 * @returns Fully qualified public URL
 */
export function getPublicFileUrl(env: Bindings, r2Key: string): string {
  // Normalize: strip leading slash from r2Key
  const normalizedKey = r2Key.replace(/^\//, '');

  // Priority 1: STORAGE_PUBLIC_URL (canonical production var)
  if (env.STORAGE_PUBLIC_URL) {
    const base = env.STORAGE_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${normalizedKey}`;
  }

  // Priority 2: R2_CUSTOM_DOMAIN (bare domain, no protocol)
  if (env.R2_CUSTOM_DOMAIN) {
    return `https://${env.R2_CUSTOM_DOMAIN.replace(/\/$/, '')}/${normalizedKey}`;
  }

  // Priority 3: R2_PUBLIC_DOMAIN (bare domain, no protocol)
  if (env.R2_PUBLIC_DOMAIN) {
    return `https://${env.R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${normalizedKey}`;
  }

  // Priority 4: Worker proxy fallback (requires BACKEND_URL in production)
  const backendUrl = getBackendUrl(env);
  return `${backendUrl}/api/files/public/${normalizedKey}`;
}

/**
 * F7: signed variant of getPublicFileUrl for callers that explicitly need
 * a Worker-proxy URL with HMAC signature attached. Use this when minting
 * download links that will hit /api/files/public/*, /api/files/download/*,
 * or /api/r2-public/* — those endpoints now reject unsigned requests.
 *
 * Returns the Worker-proxy form (bypassing R2 custom domains) because
 * signature verification lives in the Worker, not in R2 directly.
 *
 * @param env - Worker bindings (JWT_SECRET used for HMAC, BACKEND_URL for hostname)
 * @param r2Key - The R2 object key
 * @param ttlSeconds - Optional TTL, defaults to 24h (long enough for LINE caches)
 */
export async function getSignedFileUrl(
  env: Bindings,
  r2Key: string,
  ttlSeconds?: number,
): Promise<string> {
  const normalizedKey = r2Key.replace(/^\//, '');
  const backendUrl = getBackendUrl(env);
  const { sig, exp } = await signFileUrl(normalizedKey, env.JWT_SECRET, ttlSeconds);
  const params = new URLSearchParams({ sig, exp: String(exp) });
  return `${backendUrl}/api/files/public/${normalizedKey}?${params.toString()}`;
}

/**
 * Signed URL for the explicit "download" action on an attachment.
 *
 * Points at GET /api/files/download/:attachmentId, which (unlike the raw R2
 * public URL or /api/files/public/*) forces `Content-Disposition: attachment`
 * and sends `Access-Control-Allow-Origin: *`. That guarantees the browser
 * saves the file instead of rendering it inline — the raw R2 object is stored
 * with `inline` disposition so an <a download> to it just opens the image.
 *
 * The HMAC signature is computed over the r2Key (matching the verifier in
 * file-proxy.ts), even though the URL path uses attachmentId — the handler
 * resolves attachmentId -> r2Key before verifying.
 *
 * @param env - Worker bindings (JWT_SECRET for HMAC, BACKEND_URL for hostname)
 * @param attachmentId - The fileAttachments row id (URL path segment)
 * @param r2Key - The R2 object key the signature authorizes
 * @param ttlSeconds - Optional TTL, defaults to 24h
 */
export async function getSignedDownloadUrl(
  env: Bindings,
  attachmentId: string,
  r2Key: string,
  ttlSeconds?: number,
): Promise<string> {
  const normalizedKey = r2Key.replace(/^\//, '');
  const backendUrl = getBackendUrl(env);
  const { sig, exp } = await signFileUrl(normalizedKey, env.JWT_SECRET, ttlSeconds);
  const params = new URLSearchParams({ sig, exp: String(exp) });
  return `${backendUrl}/api/files/download/${encodeURIComponent(attachmentId)}?${params.toString()}`;
}

/**
 * Check whether a real public R2 domain is configured (non-localhost).
 * Useful for deciding whether to set R2-level cacheControl headers.
 */
export function isPublicDomainConfigured(env: Bindings): boolean {
  const url = env.STORAGE_PUBLIC_URL || '';
  if (url && !isLocalhost(url)) {
    return true;
  }
  // Also check bare domain vars, filtering out localhost values
  const customDomain = env.R2_CUSTOM_DOMAIN || '';
  if (customDomain && !isLocalhost(customDomain)) {
    return true;
  }
  const publicDomain = env.R2_PUBLIC_DOMAIN || '';
  if (publicDomain && !isLocalhost(publicDomain)) {
    return true;
  }
  return false;
}
