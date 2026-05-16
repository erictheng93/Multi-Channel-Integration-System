import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, asc, count, sql } from 'drizzle-orm';
import { messages } from '@/db/schema';
import type { ConversationSession, SessionMessage, SessionMessagesResponse } from '../types/session-types';
import { SessionNotFoundError, SessionOperationError } from '../types/session-types';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('SessionService');

export type GetSessionCallback = (sessionId: string) => Promise<ConversationSession | null>;
export type UpdateSessionActivityCallback = (sessionId: string, incrementMessageCount?: boolean) => Promise<void>;

export class SessionMessageService {
  constructor(private db: DrizzleD1Database) {}

  async getMessages(sessionId: string, page: number, pageSize: number, getSession: GetSessionCallback): Promise<SessionMessagesResponse> {
    const session = await getSession(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    const offset = (page - 1) * pageSize;
    try {
      const totalResult = await this.db.select({ count: count() }).from(messages).where(eq(messages.sessionId, sessionId)).get();
      const total = totalResult?.count || 0;
      const totalPages = Math.ceil(total / pageSize);
      const messageList = await this.db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(asc(messages.sessionSequence), asc(messages.createdAt)).limit(pageSize).offset(offset).all();
      const transformedMessages: SessionMessage[] = messageList.map(msg => ({
        id: msg.id.toString(), sessionId, conversationId: msg.conversationId.toString(),
        senderId: msg.agentSenderId || msg.customerSenderId?.toString() || 'unknown',
        senderType: msg.senderType as SessionMessage['senderType'], content: msg.content,
        messageType: msg.messageType as SessionMessage['messageType'], sessionSequence: msg.sessionSequence || 0,
        ...(msg.platformMessageId && { platformMessageId: msg.platformMessageId }),
        createdAt: msg.createdAt || nowISO(), ...(msg.metadata ? { metadata: JSON.parse(msg.metadata) } : {})
      }));
      return { sessionId, messages: transformedMessages, messageCount: total, pagination: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 } };
    } catch (error) {
      log.error('Failed to get session messages', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to get session messages', 'getMessages');
    }
  }

  async addMessage(sessionId: string, messageData: Omit<SessionMessage, 'id' | 'sessionId' | 'sessionSequence' | 'createdAt'>, getSession: GetSessionCallback, updateSessionActivity: UpdateSessionActivityCallback): Promise<SessionMessage> {
    const session = await getSession(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    const sequenceResult = await this.db.select({ nextSequence: sql<number>`COALESCE(MAX(${messages.sessionSequence}), 0) + 1` }).from(messages).where(eq(messages.sessionId, sessionId)).get();
    const sessionSequence = sequenceResult?.nextSequence || 1;
    const now = nowISO();
    const messageRecord = {
      id: crypto.randomUUID(),
      conversationId: messageData.conversationId, sessionId, senderType: messageData.senderType,
      agentSenderId: messageData.senderType === 'agent' ? messageData.senderId : null,
      customerSenderId: messageData.senderType === 'customer' ? parseInt(messageData.senderId) : null,
      content: messageData.content, messageType: messageData.messageType, sessionSequence,
      platformMessageId: messageData.platformMessageId || null,
      metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null, createdAt: now
    };
    try {
      await this.db.insert(messages).values(messageRecord);
      await updateSessionActivity(sessionId, true);
      const insertedMessage = await this.db.select().from(messages).where(and(eq(messages.sessionId, sessionId), eq(messages.sessionSequence, sessionSequence), eq(messages.createdAt, now))).limit(1).all();
      const message = insertedMessage[0];
      if (!message) throw new SessionOperationError('Failed to retrieve inserted message', 'addMessage');
      return {
        id: message.id.toString(), sessionId, conversationId: messageData.conversationId, senderId: messageData.senderId,
        senderType: messageData.senderType, content: messageData.content, messageType: messageData.messageType, sessionSequence,
        ...(messageData.platformMessageId && { platformMessageId: messageData.platformMessageId }),
        createdAt: now, ...(messageData.metadata && { metadata: messageData.metadata })
      };
    } catch (error) {
      log.error('Failed to add message to session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to add message to session', 'addMessage');
    }
  }
}
