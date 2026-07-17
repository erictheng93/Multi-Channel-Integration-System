// Shared 4-way permission check for customer conversation endpoints
// Extracted from src/index.ts — eliminates 3x duplication of identical auth logic

import type { Bindings } from '@/types';
import { getUserById } from '@/utils/auth';
import { validateAccessTokenPayload } from '@/middleware/auth';
import { canConversationBeAccessedBy } from '@/services/conversation-access';
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
 * 3. Unassigned — no team assigned (agent pool; agents/admins only)
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
    payload = await validateAccessTokenPayload(env, sessionId) as unknown as ConversationAccessResult['payload'];
  } catch (authError) {
    log.error(`${contextLabel}: Authentication failed`, { error: authError instanceof Error ? authError.message : String(authError) });
    const status = typeof (authError as { status?: unknown }).status === 'number'
      ? (authError as { status: number }).status
      : 401;
    throw Object.assign(new Error(status === 503 ? 'Service temporarily unavailable' : 'Invalid or expired session'), { status });
  }

  let currentAllowedTeamIds: number[] = [];
  if (payload.role === 'admin' || payload.role === 'agent') {
    try {
      const user = await getUserById(env.DB, payload.userId);
      if (!user.isActive) {
        throw Object.assign(new Error('User account is inactive'), { status: 401 });
      }
      payload = {
        ...payload,
        userId: user.id,
        role: user.role,
        displayName: user.displayName,
        primaryTeamId: user.primaryTeamId
      };
      currentAllowedTeamIds = user.allowedTeamIds || [];
    } catch (error) {
      if (typeof (error as { status?: unknown }).status === 'number') {
        throw error;
      }
      log.error(`${contextLabel}: Current user lookup failed`, {
        userId: payload.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
    }
  }

  const decision = await canConversationBeAccessedBy(env, {
    userId: payload.userId,
    role: payload.role,
    allowedTeamIds: currentAllowedTeamIds,
  }, conversationId);

  if (!decision.conversation) {
    throw Object.assign(new Error('Conversation not found'), { status: 404 });
  }

  if (!decision.allowed) {
    log.warn(`${contextLabel}: Access denied`, {
      userId: payload.userId,
      conversationId,
      assignedTeamId: decision.conversation.assignedTeamId
    });
    throw Object.assign(new Error('Access denied to this conversation'), { status: 403 });
  }

  return { payload, conversation: decision.conversation };
}
