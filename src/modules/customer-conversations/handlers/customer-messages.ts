// Customer conversation message operations handler
// Extracted from src/index.ts — handles message CRUD, file upload, and debug

import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from '@/types';
import { globalErrorHandler } from '@/core/error-handler';
import { AUTH_COOKIE_NAMES, parseCookieHeader } from '@/middleware/auth';
import { verifyConversationAccess } from '../utils/conversation-auth';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CustomerMessages');

const router = new Hono<{ Bindings: Bindings }>();
type CustomerMessageContext = Context<{ Bindings: Bindings }>;

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

function getSessionToken(c: CustomerMessageContext): {
  token: string | undefined;
  usedCookie: boolean;
} {
  const headerToken =
    c.req.header('x-session-id') ||
    c.req.header('X-Session-Id') ||
    c.req.header('Authorization')?.replace('Bearer ', '');

  if (headerToken) {
    return { token: headerToken, usedCookie: false };
  }

  const cookies = parseCookieHeader(c.req.header('Cookie'));
  return { token: cookies[AUTH_COOKIE_NAMES.access], usedCookie: true };
}

function hasValidCsrf(c: CustomerMessageContext): boolean {
  const cookies = parseCookieHeader(c.req.header('Cookie'));
  const csrfCookie = cookies[AUTH_COOKIE_NAMES.csrf];
  const csrfHeader = c.req.header('X-CSRF-Token');
  return Boolean(csrfCookie && csrfHeader && csrfCookie === csrfHeader);
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

  const { token: sessionId, usedCookie } = getSessionToken(c);

  if (!sessionId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  if (usedCookie && requestMethod !== 'GET' && !hasValidCsrf(c)) {
    return c.json({ success: false, error: 'Invalid CSRF token' }, 403);
  }

  let access;
  try {
    access = await verifyConversationAccess(c.env, sessionId, conversationId, 'Customer Messages');
    log.debug('Customer Messages: Authenticated request', { method: requestMethod, conversationId });
  } catch (authError: unknown) {
    const { status, message } = getAuthErrorResponse(authError);
    return c.json({ success: false, error: message }, status);
  }

  try {
    // Get CustomerMessageDO instance by conversationId
    const doId = c.env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
    const doStub = c.env.CUSTOMER_MESSAGE_DO.get(doId);

    // Create a new request with conversation ID and session ID in headers.
    // Strip any inbound X-Authenticated-* headers first — they are a trusted
    // channel between this handler and the DO, and must only ever carry
    // values derived from the validated token, never client input.
    const headers = new Headers(c.req.raw.headers);
    headers.delete('X-Authenticated-User-Id');
    headers.delete('X-Authenticated-Display-Name');
    headers.set('X-Conversation-Id', conversationId);
    headers.set('X-Authenticated-User-Id', String(access.payload.userId));
    if (access.payload.displayName) {
      // Header values must be Latin-1; CJK display names would make
      // Headers.set() throw in Workers. URL-encode here, decode in the DO.
      headers.set('X-Authenticated-Display-Name', encodeURIComponent(String(access.payload.displayName)));
    }

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

  const { token: sessionId, usedCookie } = getSessionToken(c);

  if (!sessionId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  if (usedCookie && !hasValidCsrf(c)) {
    return c.json({ success: false, error: 'Invalid CSRF token' }, 403);
  }

  let access;
  try {
    access = await verifyConversationAccess(c.env, sessionId, conversationId, 'Customer Upload');
    log.debug('Customer Upload: Authenticated', { conversationId });
  } catch (authError: unknown) {
    const { status, message } = getAuthErrorResponse(authError);
    return c.json({ success: false, error: message }, status);
  }

  try {
    // Get CustomerMessageDO instance by conversationId
    const doId = c.env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
    const doStub = c.env.CUSTOMER_MESSAGE_DO.get(doId);

    // Create a new request with conversation ID and session ID in headers.
    // Strip any inbound X-Authenticated-* headers first — they are a trusted
    // channel between this handler and the DO, and must only ever carry
    // values derived from the validated token, never client input.
    const headers = new Headers(c.req.raw.headers);
    headers.delete('X-Authenticated-User-Id');
    headers.delete('X-Authenticated-Display-Name');
    headers.set('X-Conversation-Id', conversationId);
    headers.set('X-Authenticated-User-Id', String(access.payload.userId));
    if (access.payload.displayName) {
      // Header values must be Latin-1; CJK display names would make
      // Headers.set() throw in Workers. URL-encode here, decode in the DO.
      headers.set('X-Authenticated-Display-Name', encodeURIComponent(String(access.payload.displayName)));
    }

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
