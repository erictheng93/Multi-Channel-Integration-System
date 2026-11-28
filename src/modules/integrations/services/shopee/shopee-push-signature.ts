import { timingSafeEqual } from '@/services/webhook-signature-service';

/**
 * Verify a Shopee Push request: Authorization = lowercase hex HMAC-SHA256(pushKey, callbackUrl + '|' + rawBody).
 * `callbackUrl` must be the exact URL registered in the Console (the Worker may see a different host behind a tunnel).
 */
export async function verifyShopeePush(
  callbackUrl: string,
  rawBody: string,
  authorizationHeader: string | null | undefined,
  pushKey: string
): Promise<boolean> {
  if (!authorizationHeader || !pushKey) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pushKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${callbackUrl}|${rawBody}`)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, authorizationHeader.trim().toLowerCase());
}
