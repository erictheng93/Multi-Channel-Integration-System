// Customer conversation WebSocket upgrade handler
// Extracted from src/index.ts — handles GET /api/customer-ws

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { verifyConversationAccess } from '../utils/conversation-auth';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CustomerWS');

const router = new Hono<{ Bindings: Bindings }>();

// WebSocket upgrade endpoint for customer conversations
router.get('/', async (c) => {
  const conversationId = c.req.query('conversationId');
  const sessionId = c.req.query('sessionId');

  if (!conversationId || !sessionId) {
    return c.json({
      success: false,
      error: 'Missing required parameters: conversationId and sessionId'
    }, 400);
  }

  try {
    const { payload } = await verifyConversationAccess(
      c.env, sessionId, conversationId, 'Customer WebSocket'
    );

    log.info('Customer WebSocket authenticated connection', {
      conversationId,
      userId: payload.userId,
      role: payload.role
    });

    // Forward to Durable Object with validated user info
    try {
      const doId = c.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
      const doStub = c.env.CUSTOMER_CONVERSATION_DO.get(doId);

      // Build URL with validated user info (DO will trust this since we validated)
      const url = new URL(c.req.url);
      url.pathname = '/ws';
      url.searchParams.set('validatedUserId', String(payload.userId));
      url.searchParams.set('validatedRole', (payload.role as string) || 'agent');
      url.searchParams.set('validatedDisplayName', (payload.displayName as string) || 'User');
      url.searchParams.set('validated', 'true');

      const modifiedRequest = new Request(url.toString(), c.req.raw);

      return doStub.fetch(modifiedRequest);
    } catch (error) {
      log.error('Customer WebSocket: Connection error', { error: error instanceof Error ? error.message : String(error) });
      return c.json({
        success: false,
        error: 'Failed to establish WebSocket connection'
      }, 500);
    }
  } catch (authError: any) {
    const status = authError.status || 401;
    return c.json({ success: false, error: authError.message || 'Authentication failed' }, status);
  }
});

export default router;
