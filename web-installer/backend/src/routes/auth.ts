/**
 * Auth Routes
 *
 * Handles API Token authentication as an alternative to OAuth flow.
 * Validates a Cloudflare API Token by calling the Cloudflare API directly.
 */

import { Hono } from 'hono';
import type { Env } from '../types';

const auth = new Hono<{ Bindings: Env }>();

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Verify an API Token and retrieve account info
 * POST /auth/token
 */
auth.post('/token', async (c) => {
  try {
    const body = await c.req.json();
    const { apiToken, accountId } = body;

    if (!apiToken || !accountId) {
      return c.json({ error: 'API Token and Account ID are required' }, 400);
    }

    // Verify token by calling Cloudflare API
    const verifyResponse = await fetch(`${CLOUDFLARE_API_BASE}/user/tokens/verify`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });

    if (!verifyResponse.ok) {
      return c.json({ error: 'Invalid API Token' }, 401);
    }

    const verifyData = await verifyResponse.json() as {
      success: boolean;
      result: { status: string };
    };

    if (!verifyData.success || verifyData.result.status !== 'active') {
      return c.json({ error: 'API Token is not active' }, 401);
    }

    // Fetch account info to validate accountId and get account name
    const accountResponse = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${accountId}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });

    if (!accountResponse.ok) {
      return c.json({
        error: 'Cannot access this account. Ensure the token has account:read permission.'
      }, 403);
    }

    const accountData = await accountResponse.json() as {
      success: boolean;
      result: { id: string; name: string };
    };

    if (!accountData.success) {
      return c.json({ error: 'Failed to retrieve account information' }, 500);
    }

    return c.json({
      success: true,
      accountId: accountData.result.id,
      accountName: accountData.result.name,
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Token verification failed'
    }, 500);
  }
});

export default auth;
