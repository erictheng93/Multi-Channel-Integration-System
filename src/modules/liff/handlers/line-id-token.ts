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

export async function verifyLiffIdToken(
  idToken: unknown,
  liffId: string | undefined
): Promise<string | null> {
  if (!isPlausibleIdToken(idToken) || !liffId) return null;
  const clientId = liffId.split('-')[0];
  if (!clientId) return null;
  try {
    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sub?: string; aud?: string; exp?: number };
    if (!data.sub || data.aud !== clientId) return null;
    if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}
