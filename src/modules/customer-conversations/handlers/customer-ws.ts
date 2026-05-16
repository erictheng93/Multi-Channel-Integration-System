// Customer conversation WebSocket upgrade handler
// Extracted from src/index.ts — handles GET /api/customer-ws

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import { verifyConversationAccess } from '../utils/conversation-auth';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CustomerWS');

const router = new Hono<{ Bindings: Bindings }>();

function getAuthErrorResponse(error: unknown): { status: ContentfulStatusCode; message: string } {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { status?: unknown; message?: unknown };
    return {
      status: (typeof candidate.status === 'number' ? candidate.status : 401) as ContentfulStatusCode,
      message: typeof candidate.message === 'string' ? candidate.message : 'Authentication failed'
    };
  }

  return { status: 401, message: 'Authentication failed' };
}

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
      return globalErrorHandler.handleError(c, error);
    }
  } catch (authError: unknown) {
    const { status, message } = getAuthErrorResponse(authError);
    return c.json({ success: false, error: message }, status);
  }
});

export default router;
