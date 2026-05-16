// Customer conversation message operations handler
// Extracted from src/index.ts — handles message CRUD, file upload, and debug

import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import { verifyConversationAccess } from '../utils/conversation-auth';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CustomerMessages');

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

// Message operations endpoint (GET messages, POST new message)
router.all('/:id/messages', async (c) => {
  // CRITICAL: Read body FIRST before any other c.req operations that might consume it
  // This prevents "body already consumed" errors when forwarding to Durable Object
  const requestMethod = c.req.method;
  const bodyText = requestMethod === 'POST' ? await c.req.text() : undefined;

  const conversationId = c.req.param('id');

  if (!conversationId) {
    return c.json({
      success: false,
      error: 'Missing conversation ID'
    }, 400);
  }

  // Extract session token from header
  const sessionId = c.req.header('x-session-id') || c.req.header('X-Session-Id') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  try {
    await verifyConversationAccess(c.env, sessionId, conversationId, 'Customer Messages');
    log.debug('Customer Messages: Authenticated request', { method: requestMethod, conversationId });
  } catch (authError: unknown) {
    const { status, message } = getAuthErrorResponse(authError);
    return c.json({ success: false, error: message }, status);
  }

  try {
    // Get CustomerMessageDO instance by conversationId
    const doId = c.env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
    const doStub = c.env.CUSTOMER_MESSAGE_DO.get(doId);

    // Create a new request with conversation ID and session ID in headers
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-Conversation-Id', conversationId);

    // Pass through session ID (already validated)
    if (sessionId) {
      headers.set('X-Session-Id', sessionId);
    }

    // Create the target URL for CustomerMessageDO
    const url = new URL(c.req.url);
    url.pathname = '/messages';

    // Create request with buffered body text
    const doRequest = new Request(url.toString(), {
      method: requestMethod,
      headers: headers,
      body: bodyText
    });

    log.debug('Proxy: Forwarding to CustomerMessageDO', { method: requestMethod, conversationId });
    return doStub.fetch(doRequest);
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// File upload endpoint
router.post('/:id/upload', async (c) => {
  const conversationId = c.req.param('id');

  if (!conversationId) {
    return c.json({
      success: false,
      error: 'Missing conversation ID'
    }, 400);
  }

  // Extract session token from header
  const sessionId = c.req.header('x-session-id') || c.req.header('X-Session-Id') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  try {
    await verifyConversationAccess(c.env, sessionId, conversationId, 'Customer Upload');
    log.debug('Customer Upload: Authenticated', { conversationId });
  } catch (authError: unknown) {
    const { status, message } = getAuthErrorResponse(authError);
    return c.json({ success: false, error: message }, status);
  }

  try {
    // Get CustomerMessageDO instance by conversationId
    const doId = c.env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
    const doStub = c.env.CUSTOMER_MESSAGE_DO.get(doId);

    // Create a new request with conversation ID and session ID in headers
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-Conversation-Id', conversationId);

    // Pass through session ID (already validated)
    if (sessionId) {
      headers.set('X-Session-Id', sessionId);
    }

    // Clone the request to avoid body consumption issues
    const clonedRequest = c.req.raw.clone();

    const modifiedRequest = new Request(clonedRequest.url, {
      method: 'POST',
      headers: headers,
      body: clonedRequest.body
    });

    // Modify URL to use DO internal path
    const url = new URL(modifiedRequest.url);
    url.pathname = '/upload';

    return doStub.fetch(new Request(url.toString(), modifiedRequest));
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default router;
