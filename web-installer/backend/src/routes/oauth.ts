/**
 * OAuth Routes
 *
 * Handles Cloudflare OAuth authentication flow
 */

import { Hono } from 'hono';
import type { Env, OAuthState, OAuthTokenResponse, CloudflareUserInfo } from '../types';

const oauth = new Hono<{ Bindings: Env }>();

// OAuth configuration
const CLOUDFLARE_OAUTH_URL = 'https://dash.cloudflare.com/oauth2/auth';
const CLOUDFLARE_TOKEN_URL = 'https://dash.cloudflare.com/oauth2/token';
const CLOUDFLARE_USER_INFO_URL = 'https://api.cloudflare.com/client/v4/user';

/**
 * Initiate OAuth flow
 * GET /oauth/authorize
 */
oauth.get('/authorize', async (c) => {
  try {
    const clientId = c.env.CF_CLIENT_ID;
    if (!clientId) {
      return c.json({ error: 'OAuth not configured' }, 500);
    }

    // Generate state and code verifier for PKCE
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Get redirect URI from query or use default
    const redirectUri = c.req.query('redirect_uri') || 'http://localhost:3000/oauth/callback';

    // Store state in KV or memory (for demo, we'll use a simple approach)
    // In production, you'd store this in KV with TTL
    const oauthState: OAuthState = {
      state,
      codeVerifier,
      redirectUri,
      createdAt: Date.now()
    };

    // Build authorization URL
    const authUrl = new URL(CLOUDFLARE_OAUTH_URL);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('scope', 'account:read workers:write d1:write kv:write r2:write queues:write pages:write');

    // Return the authorization URL and state
    return c.json({
      authorizationUrl: authUrl.toString(),
      state,
      // In production, store codeVerifier in session/KV
      // For demo, we'll return it (NOT SECURE, just for development)
      codeVerifier
    });

  } catch (error) {
    console.error('OAuth authorization error:', error);
    return c.json({ error: 'Failed to initiate OAuth' }, 500);
  }
});

/**
 * Handle OAuth callback
 * POST /oauth/callback
 */
oauth.post('/callback', async (c) => {
  try {
    const body = await c.req.json();
    const { code, state, codeVerifier, redirectUri } = body;

    if (!code) {
      return c.json({ error: 'Authorization code required' }, 400);
    }

    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(
      c.env.CF_CLIENT_ID,
      c.env.CF_CLIENT_SECRET,
      code,
      redirectUri || 'http://localhost:3000/oauth/callback',
      codeVerifier
    );

    // Get user info and account ID
    const userInfo = await getUserInfo(tokenResponse.access_token);

    return c.json({
      success: true,
      accessToken: tokenResponse.access_token,
      expiresIn: tokenResponse.expires_in,
      user: {
        id: userInfo.id,
        email: userInfo.email
      },
      accounts: userInfo.accounts
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'OAuth callback failed'
    }, 500);
  }
});

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  if (codeVerifier) {
    body.append('code_verifier', codeVerifier);
  }

  const response = await fetch(CLOUDFLARE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Get user info from Cloudflare API
 */
async function getUserInfo(accessToken: string): Promise<CloudflareUserInfo> {
  const response = await fetch(CLOUDFLARE_USER_INFO_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json() as { result: CloudflareUserInfo };
  return data.result;
}

/**
 * Generate random string for state/verifier
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

/**
 * Generate code challenge for PKCE
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export default oauth;
