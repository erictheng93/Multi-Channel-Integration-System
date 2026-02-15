// Customer conversation message operations handler
// Extracted from src/index.ts — handles message CRUD, file upload, and debug

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { verifyConversationAccess } from '../utils/conversation-auth';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CustomerMessages');

const router = new Hono<{ Bindings: Bindings }>();

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
  } catch (authError: any) {
    const status = authError.status || 401;
    return c.json({ success: false, error: authError.message || 'Authentication failed' }, status);
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
    log.error('Customer Messages: Operation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to process message operation'
    }, 500);
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
  } catch (authError: any) {
    const status = authError.status || 401;
    return c.json({ success: false, error: authError.message || 'Authentication failed' }, status);
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
    log.error('Customer Upload: Upload error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to upload file'
    }, 500);
  }
});

// DEBUG: Endpoint to check CustomerConversationDO connection status
router.get('/:id/debug/connections', async (c) => {
  const conversationId = c.req.param('id');

  if (!conversationId) {
    return c.json({ success: false, error: 'Conversation ID is required' }, 400);
  }

  try {
    // Get the same DO instance that handles WebSocket connections
    const doId = c.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
    const doStub = c.env.CUSTOMER_CONVERSATION_DO.get(doId);

    // Forward request to DO's debug endpoint
    const debugRequest = new Request('https://fake-host/debug/connections', {
      method: 'GET'
    });

    const response = await doStub.fetch(debugRequest);
    const data = await response.json() as Record<string, unknown>;

    return c.json({
      success: true,
      requestedConversationId: conversationId,
      doIdString: doId.toString(),
      ...data
    });
  } catch (error) {
    log.error('Debug connections error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, error: 'Failed to get connection info' }, 500);
  }
});

export default router;
