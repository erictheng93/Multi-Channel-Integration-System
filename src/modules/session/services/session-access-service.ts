import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { conversationSessions, conversations, agentTeams } from '@/db/schema';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('SessionService');

export class SessionAccessService {
  constructor(private db: DrizzleD1Database) {}

  async canAccessSession(sessionId: string, userId: string, userRole: 'admin' | 'agent'): Promise<boolean> {
    try {
      if (userRole === 'admin') { log.debug('Admin granted access to session', { userId, sessionId }); return true; }
      const session = await this.db.select().from(conversationSessions).where(eq(conversationSessions.id, sessionId)).get();
      if (!session) { log.warn('Session not found for access check', { sessionId }); return false; }
      const conversation = await this.db.select().from(conversations).where(eq(conversations.id, session.conversationId)).get();
      if (!conversation) { log.warn('Conversation not found for session access check', { conversationId: session.conversationId, sessionId }); return false; }
      if (conversation.assignedTeamId) {
        const membership = await this.db.select({ teamId: agentTeams.teamId }).from(agentTeams).where(and(eq(agentTeams.agentId, userId), eq(agentTeams.teamId, conversation.assignedTeamId))).limit(1).get();
        if (membership) { log.debug('Agent has team access to conversation', { userId, conversationId: conversation.id, teamId: membership.teamId }); return true; }
      }
      log.warn('Agent denied access to session - no assignment or team match', { userId, sessionId });
      return false;
    } catch (error) {
      log.error('Permission check error', {}, error instanceof Error ? error : String(error));
      return false;
    }
  }
}
