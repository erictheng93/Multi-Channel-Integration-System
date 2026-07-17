import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations } from '@/db/schema';
import type { Bindings } from '@/types';

export interface ConversationAccessPrincipal {
  userId: string | number;
  role?: string;
  allowedTeamIds?: number[];
}

export interface ConversationAccessConversation {
  id: string;
  customerId: string | number | null;
  assignedTeamId: string | number | null;
}

export interface ConversationAccessDecision {
  allowed: boolean;
  conversation: ConversationAccessConversation | null;
}

export async function canConversationBeAccessedBy(
  env: Bindings,
  principal: ConversationAccessPrincipal,
  conversationId: string
): Promise<ConversationAccessDecision> {
  const db = createDbClient(env.DB);
  const conversation = await db
    .select({
      id: conversations.id,
      customerId: conversations.customerId,
      assignedTeamId: conversations.assignedTeamId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) {
    return { allowed: false, conversation: null };
  }

  const isAdmin = principal.role === 'admin';
  const isCustomer = String(conversation.customerId) === String(principal.userId);
  // The unassigned pool is an agent workflow concept: any agent may pick up a
  // conversation no team owns yet. It must never grant a customer access to
  // another customer's conversation — customers only ever match as the owner.
  const isAgent = isAdmin || principal.role === 'agent';
  const isUnassignedPoolAccess = isAgent && !conversation.assignedTeamId;
  const assignedTeamId = Number(conversation.assignedTeamId);
  const isTeamMember =
    Number.isFinite(assignedTeamId) && (principal.allowedTeamIds ?? []).includes(assignedTeamId);

  return {
    allowed: isAdmin || isCustomer || isUnassignedPoolAccess || isTeamMember,
    conversation,
  };
}
