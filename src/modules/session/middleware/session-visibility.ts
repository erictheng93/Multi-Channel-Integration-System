// Session conversation-visibility guards.
// Authorizes on the D1-reloaded `c.get('user')` (set by the session auth middleware),
// never on raw JWT claims. Rule: admin all; agent = own teams + unassigned pool.

import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { conversationSessions } from '@/db/schema';
import { canConversationBeAccessedBy } from '@/services/conversation-access';
import { HTTP_STATUS } from '@/constants/http-status';
import { nowISO } from '@/utils/timestamp';

type Ctx = Context<{ Bindings: Bindings }>;

const fail = (c: Ctx, status: 401 | 403 | 404, error: string) =>
  c.json({ success: false, error, timestamp: nowISO() }, status);

/** Shared check: may the authenticated user touch this conversation? Returns a Response to short-circuit, or null. */
async function denyUnlessConversationVisible(c: Ctx, conversationId: string | undefined): Promise<Response | null> {
  const user = c.get('user');
  if (!user) return fail(c, HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
  if (!conversationId) return fail(c, HTTP_STATUS.NOT_FOUND, 'Conversation not found');
  const decision = await canConversationBeAccessedBy(
    c.env,
    { userId: user.id, role: user.role, allowedTeamIds: user.allowedTeamIds ?? [] },
    conversationId
  );
  if (!decision.conversation) return fail(c, HTTP_STATUS.NOT_FOUND, 'Conversation not found');
  if (!decision.allowed) return fail(c, HTTP_STATUS.FORBIDDEN, 'Access to this conversation is denied');
  return null;
}

/** Guard for routes whose target conversation id is in the body (POST /, POST /get-or-create). */
export function requireBodyConversationAccess(read: (c: Ctx) => Promise<string | undefined>) {
  return async (c: Ctx, next: Next): Promise<Response | void> => {
    const denied = await denyUnlessConversationVisible(c, await read(c));
    if (denied) return denied;
    await next();
  };
}

/** Guard for routes keyed by a session id (read from `read`): resolves the session's conversation. */
export function requireSessionAccess(read: (c: Ctx) => Promise<string | undefined>) {
  return async (c: Ctx, next: Next): Promise<Response | void> => {
    const sessionId = await read(c);
    if (sessionId === undefined) { await next(); return; } // optional id (e.g. detect-boundary without a session)
    const session = await createDbClient(c.env.DB)
      .select({ conversationId: conversationSessions.conversationId })
      .from(conversationSessions)
      .where(eq(conversationSessions.id, sessionId))
      .get();
    if (!session) return fail(c, HTTP_STATUS.NOT_FOUND, 'Session not found');
    const denied = await denyUnlessConversationVisible(c, session.conversationId);
    if (denied) return denied;
    await next();
  };
}

/** Guard for list-shaped routes that filter by `c.get('user')`: fail closed when it is missing. */
export async function requireVisibilityUser(c: Ctx, next: Next): Promise<Response | void> {
  if (!c.get('user')) return fail(c, HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
  await next();
}
