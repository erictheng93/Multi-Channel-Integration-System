/**
 * HMAC-signed file proxy URLs
 *
 * Background: the /api/files/public/*, /api/files/download/:attachmentId,
 * and /api/r2-public/:folder/:filename endpoints serve R2 content
 * unauthenticated by design — LINE/Facebook customers download attachments
 * via these proxies and don't have JWTs.
 *
 * That made any of those endpoints an IDOR vector: an attacker who could
 * guess (or harvest from logs / DOM / WebSocket broadcasts) an r2Key or
 * attachment id could read any file in the bucket. F7 closes the gap by
 * requiring an HMAC signature attached to the URL.
 *
 * Format:
 *   ${baseUrl}?sig=${urlSafeBase64}&exp=${unixSeconds}
 *
 * Verifier recomputes HMAC-SHA256(secret, `file-url-v1|${r2Key}|${exp}`)
 * and constant-time compares with the supplied sig. Expired signatures
 * (now > exp) are rejected. The "file-url-v1" prefix domain-separates the
 * HMAC from any other use of JWT_SECRET, so cross-protocol reuse is safe.
 *
 * Key reuse note: we sign with JWT_SECRET to avoid introducing a new
 * Wrangler secret binding. The domain prefix in the signed message
 * prevents cross-protocol confusion (a JWT signature can't be replayed
 * as a file URL signature and vice versa).
 */

const HMAC_DOMAIN = 'file-url-v1';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h — long enough for LINE caches

/** Constant-time string compare to avoid timing oracles on sig mismatch. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function urlSafeBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) {
    bin += String.fromCharCode(u8[i]);
  }
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return urlSafeBase64(sig);
}

/**
 * Sign an r2Key for use in a Worker proxy URL.
 *
 * @returns `{ sig, exp }` ready to be appended as `?sig=&exp=`
 */
export async function signFileUrl(
  r2Key: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<{ sig: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmacSign(secret, `${HMAC_DOMAIN}|${r2Key}|${exp}`);
  return { sig, exp };
}

/**
 * Verify a sig/exp pair against the r2Key. Returns true only when the HMAC
 * matches AND the signature is not expired. Use this in proxy handlers
 * before serving any file.
 */
export async function verifyFileSignature(
  r2Key: string,
  sig: string | null | undefined,
  expStr: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!sig || !expStr) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;

  const expected = await hmacSign(secret, `${HMAC_DOMAIN}|${r2Key}|${exp}`);
  return constantTimeEqual(sig, expected);
}
