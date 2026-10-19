// Verify a LIFF ID token with LINE and return the verified LINE userId (`sub`).
// https://developers.line.biz/en/reference/line-login/#verify-id-token
// The LIFF app id is "<loginChannelId>-<suffix>", so client_id is its prefix.

export async function verifyLiffIdToken(
  idToken: unknown,
  liffId: string | undefined
): Promise<string | null> {
  if (typeof idToken !== 'string' || !idToken || !liffId) return null;
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
