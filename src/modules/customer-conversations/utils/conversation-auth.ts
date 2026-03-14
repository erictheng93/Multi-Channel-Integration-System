// Shared 4-way permission check for customer conversation endpoints
// Extracted from src/index.ts — eliminates 3x duplication of identical auth logic

import type { Bindings } from '@/types';
import { verifyJWT } from '@/utils/auth';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ConversationAuth');

export interface ConversationAccessResult {
  payload: {
    userId: string | number;
    role?: string;
    displayName?: string;
    [key: string]: unknown;
  };
  conversation: {
    id: string;
    customerId: string | number | null;
    assignedTeamId: string | number | null;
  };
}

/**
 * Verifies that a session token is valid and the user has access to the
 * given conversation. Implements the 4-way permission check:
 * 1. Admin — always allowed
 * 2. Customer — owner of the conversation
 * 3. Unassigned — no team assigned (public pool, everyone can access)
 * 4. Team member — user belongs to the assigned team
 *
 * @throws Error with message suitable for client response
 */
export async function verifyConversationAccess(
  env: Bindings,
  sessionId: string,
  conversationId: string,
  contextLabel = 'ConversationAccess'
): Promise<ConversationAccessResult> {
  if (!env.JWT_SECRET) {
    log.error(`${contextLabel}: JWT_SECRET not configured`);
    throw Object.assign(new Error('Server configuration error'), { status: 500 });
  }

  // Verify JWT
  let payload: ConversationAccessResult['payload'];
  try {
    payload = await verifyJWT(sessionId, env.JWT_SECRET) as unknown as ConversationAccessResult['payload'];
  } catch (authError) {
    log.error(`${contextLabel}: Authentication failed`, { error: authError instanceof Error ? authError.message : String(authError) });
    throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  }

  // Fetch conversation
  const { drizzle } = await import('drizzle-orm/d1');
  const { eq, and } = await import('drizzle-orm');
  const schema = await import('@/db/schema');
  const db = drizzle(env.DB, { schema });

  const conversation = await db.select({
    id: schema.conversations.id,
    customerId: schema.conversations.customerId,
    assignedTeamId: schema.conversations.assignedTeamId,
  }).from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .get();

  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { status: 404 });
  }

  // 4-way permission check
  const isAdmin = payload.role === 'admin';
  const isCustomer = String(conversation.customerId) === String(payload.userId);
  const isUnassigned = !conversation.assignedTeamId;

  let isTeamMember = false;
  if (conversation.assignedTeamId && !isAdmin && !isCustomer) {
    const membership = await db.select({ id: schema.agentTeams.id })
      .from(schema.agentTeams)
      .where(
        and(
          eq(schema.agentTeams.agentId, String(payload.userId)),
          eq(schema.agentTeams.teamId, conversation.assignedTeamId)
        )
      )
      .limit(1);
    isTeamMember = membership.length > 0;
  }

  if (!isAdmin && !isCustomer && !isUnassigned && !isTeamMember) {
    log.warn(`${contextLabel}: Access denied`, {
      userId: payload.userId,
      conversationId,
      assignedTeamId: conversation.assignedTeamId
    });
    throw Object.assign(new Error('Access denied to this conversation'), { status: 403 });
  }

  return { payload, conversation };
}
