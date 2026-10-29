// Verify a LIFF ID token with LINE and return the verified LINE userId (`sub`).
// https://developers.line.biz/en/reference/line-login/#verify-id-token
// The LIFF app id is "<loginChannelId>-<suffix>", so client_id is its prefix.

// A LINE ID token is a compact JWT: three base64url segments, well under 4 KB. Anything else cannot
// verify, so it is rejected before the (anonymous-callable) request spends an outbound LINE call.
const MAX_ID_TOKEN_LENGTH = 4096;
const ID_TOKEN_SHAPE = /^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]*$/;

export function isPlausibleIdToken(idToken: unknown): idToken is string {
  return typeof idToken === 'string' && idToken.length <= MAX_ID_TOKEN_LENGTH && ID_TOKEN_SHAPE.test(idToken);
}

/**
 * `rejected` means LINE answered and said no (4xx, wrong audience, expired). `unavailable` means we could not get
 * an answer (network error, LINE 5xx, missing config). Only `rejected` is evidence of a bad caller; rate limiting
 * must never count `unavailable`, or a LINE outage would lock out real customers.
 */
export type LiffIdTokenResult =
  | { kind: 'verified'; lineUserId: string }
  | { kind: 'rejected' }
  | { kind: 'unavailable' };

export async function verifyLiffIdTokenDetailed(
  idToken: unknown,
  liffId: string | undefined
): Promise<LiffIdTokenResult> {
  if (!liffId) return { kind: 'unavailable' };
  // A malformed token is rejected locally and costs nothing, so it is not counted as a LINE rejection either.
  if (!isPlausibleIdToken(idToken)) return { kind: 'unavailable' };
  const clientId = liffId.split('-')[0];
  if (!clientId) return { kind: 'unavailable' };
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    if (res.status >= 400 && res.status < 500) return { kind: 'rejected' };
    if (!res.ok) return { kind: 'unavailable' };
    const data = (await res.json()) as { sub?: string; aud?: string; exp?: number };
    if (!data.sub || data.aud !== clientId) return { kind: 'rejected' };
    if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return { kind: 'rejected' };
    return { kind: 'verified', lineUserId: data.sub };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function verifyLiffIdToken(
  idToken: unknown,
  liffId: string | undefined
): Promise<string | null> {
  const result = await verifyLiffIdTokenDetailed(idToken, liffId);
  return result.kind === 'verified' ? result.lineUserId : null;
}
