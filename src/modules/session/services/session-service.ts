// Session Service - Thin Orchestrator
// Delegates to sub-services for query, access, messaging, stats, and boundary logic

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { conversationSessions } from '@/db/schema';
import {
  ConversationSession,
  CreateSessionData,
  UpdateSessionData,
  SessionListQuery,
  SessionSearchQuery,
  SessionListResponse,
  SessionStats,
  SessionActivityStats,
  SessionMessage,
  SessionMessagesResponse,
  BatchSessionOperation,
  BatchOperationResult,
  SessionBoundaryDetection,
  SessionServiceInterface,
  SessionNotFoundError,
  SessionOperationError,
  DEFAULT_SESSION_CONFIG,
} from '../types/session-types';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

import { SessionAccessService } from './session-access-service';
import { SessionQueryService, transformDbSession } from './session-query-service';
import { SessionMessageService } from './session-message-service';
import { SessionStatsService } from './session-stats-service';
import { SessionBoundaryService } from './session-boundary-service';

const log = createContextLogger('SessionService');

/**
 * Session Service - Orchestrator
 * Delegates to specialized sub-services while keeping core lifecycle methods
 */
export class SessionService implements SessionServiceInterface {
  private db: DrizzleD1Database;
  private config: typeof DEFAULT_SESSION_CONFIG;

  private accessService: SessionAccessService;
  private queryService: SessionQueryService;
  private messageService: SessionMessageService;
  private statsService: SessionStatsService;
  private boundaryService: SessionBoundaryService;

  constructor(database: D1Database, config?: Partial<typeof DEFAULT_SESSION_CONFIG>) {
    this.db = drizzle(database);
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };

    this.accessService = new SessionAccessService(this.db);
    this.queryService = new SessionQueryService(this.db);
    this.messageService = new SessionMessageService(this.db);
    this.statsService = new SessionStatsService(this.db);
    this.boundaryService = new SessionBoundaryService(this.config);
  }

  // ======================== Core CRUD (kept in orchestrator) ========================

  async create(data: CreateSessionData): Promise<ConversationSession> {
    const sessionId = `session_${data.conversationId}_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = nowISO();

    const topic = data.topic || (data.messageContent ? await this.extractTopic(data.messageContent) : null);

    const sessionData = {
      id: sessionId,
      conversationId: data.conversationId,
      sessionType: data.sessionType || 'continuous',
      topic: topic,
      startTime: now,
      endTime: null as string | null,
      lastActivity: now,
      messageCount: 0,
      isActive: true,
      createdAt: now,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.db.insert(conversationSessions).values(sessionData as any);
      log.info('Created session', { sessionId, topic: topic || 'unknown' });
      return transformDbSession(sessionData as unknown as Record<string, unknown>);
    } catch (error) {
      log.error('Failed to create session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to create session', 'create');
    }
  }

  async get(
    sessionId: string,
    userId?: string,
    userRole?: 'admin' | 'agent'
  ): Promise<ConversationSession | null> {
    try {
      if (userId && userRole) {
        const hasAccess = await this.canAccessSession(sessionId, userId, userRole);
        if (!hasAccess) {
          log.warn('Access denied', { userId, userRole, sessionId });
          return null;
        }
      }

      const session = await this.db
        .select()
        .from(conversationSessions)
        .where(eq(conversationSessions.id, sessionId))
        .get();

      return session ? transformDbSession(session as unknown as Record<string, unknown>) : null;
    } catch (error) {
      log.error('Failed to get session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to get session', 'get');
    }
  }

  async update(sessionId: string, data: UpdateSessionData): Promise<ConversationSession> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const updateData: Record<string, unknown> = {};

    if (data.topic !== undefined) updateData.topic = data.topic;
    if (data.sessionType !== undefined) updateData.sessionType = data.sessionType;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);

    try {
      await this.db
        .update(conversationSessions)
        .set(updateData)
        .where(eq(conversationSessions.id, sessionId));

      const updatedSession = await this.get(sessionId);
      if (!updatedSession) {
        throw new SessionOperationError('Session disappeared after update', 'update');
      }

      log.info('Updated session', { sessionId });
      return updatedSession;
    } catch (error) {
      log.error('Failed to update session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to update session', 'update');
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    try {
      await this.db
        .delete(conversationSessions)
        .where(eq(conversationSessions.id, sessionId));

      log.info('Deleted session', { sessionId });
      return true;
    } catch (error) {
      log.error('Failed to delete session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to delete session', 'delete');
    }
  }

  // ======================== Core Lifecycle (kept in orchestrator) ========================

  async getOrCreate(
    conversationId: string,
    messageContent: string,
    senderType: 'customer' | 'agent' | 'system'
  ): Promise<ConversationSession> {
    try {
      const activeSession = await this.db
        .select()
        .from(conversationSessions)
        .where(
          and(
            eq(conversationSessions.conversationId, conversationId),
            eq(conversationSessions.isActive, true)
          )
        )
        .orderBy(desc(conversationSessions.lastActivity))
        .limit(1)
        .get();

      const activeSessionTransformed = activeSession
        ? transformDbSession(activeSession as unknown as Record<string, unknown>)
        : null;
      const boundaryDetection = await this.detectSessionBoundary(
        activeSessionTransformed,
        messageContent,
        senderType
      );

      if (!activeSession || boundaryDetection.shouldCreateNew) {
        if (activeSession) {
          await this.closeSession(activeSession.id);
        }
        return await this.create({
          conversationId,
          messageContent,
          senderType,
          topic: boundaryDetection.suggestedTopic
        });
      }

      await this.updateSessionActivity(activeSession.id);
      return transformDbSession(activeSession as unknown as Record<string, unknown>);
    } catch (error) {
      log.error('getOrCreate failed', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to get or create session', 'getOrCreate');
    }
  }

  async closeSession(sessionId: string): Promise<boolean> {
    const now = nowISO();

    try {
      await this.db
        .update(conversationSessions)
        .set({
          isActive: false,
          endTime: now
        })
        .where(eq(conversationSessions.id, sessionId));

      log.info('Closed session', { sessionId });
      return true;
    } catch (error) {
      log.error('Failed to close session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to close session', 'close');
    }
  }

  async reopenSession(sessionId: string): Promise<boolean> {
    const now = nowISO();

    try {
      await this.db
        .update(conversationSessions)
        .set({
          isActive: true,
          endTime: null,
          lastActivity: now
        })
        .where(eq(conversationSessions.id, sessionId));

      log.info('Reopened session', { sessionId });
      return true;
    } catch (error) {
      log.error('Failed to reopen session', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to reopen session', 'reopen');
    }
  }

  // ======================== Delegated to sub-services ========================

  async canAccessSession(
    sessionId: string,
    userId: string,
    userRole: 'admin' | 'agent'
  ): Promise<boolean> {
    return this.accessService.canAccessSession(sessionId, userId, userRole);
  }

  async list(query: SessionListQuery): Promise<SessionListResponse> {
    return this.queryService.list(query);
  }

  async search(query: SessionSearchQuery): Promise<ConversationSession[]> {
    return this.queryService.search(query);
  }

  async getMessages(sessionId: string, page = 1, pageSize = 20): Promise<SessionMessagesResponse> {
    return this.messageService.getMessages(
      sessionId,
      page,
      pageSize,
      (id: string) => this.get(id)
    );
  }

  async addMessage(
    sessionId: string,
    messageData: Omit<SessionMessage, 'id' | 'sessionId' | 'sessionSequence' | 'createdAt'>
  ): Promise<SessionMessage> {
    return this.messageService.addMessage(
      sessionId,
      messageData,
      (id: string) => this.get(id),
      (id: string, inc?: boolean) => this.updateSessionActivity(id, inc)
    );
  }

  async getStats(conversationId?: string): Promise<SessionStats> {
    return this.statsService.getStats(
      conversationId,
      (arr: Array<Record<string, unknown>>, key: string, def: string) =>
        this.queryService.arrayToRecord(arr, key, def)
    );
  }

  async getActivityStats(
    query: Omit<SessionActivityStats, 'activities' | 'summary'>
  ): Promise<SessionActivityStats> {
    return this.statsService.getActivityStats(query);
  }

  async batchOperation(operation: BatchSessionOperation): Promise<BatchOperationResult> {
    return this.statsService.batchOperation(operation, {
      closeSession: (id: string) => this.closeSession(id),
      reopenSession: (id: string) => this.reopenSession(id),
      deleteSession: (id: string) => this.delete(id)
    });
  }

  async detectSessionBoundary(
    currentSession: ConversationSession | null,
    messageContent: string,
    senderType: 'customer' | 'agent' | 'system'
  ): Promise<SessionBoundaryDetection> {
    return this.boundaryService.detectSessionBoundary(currentSession, messageContent, senderType);
  }

  async extractTopic(messageContent: string): Promise<string | null> {
    return this.boundaryService.extractTopic(messageContent);
  }

  async analyzeSessionHealth(
    sessionId: string
  ): Promise<{ healthy: boolean; issues: string[]; suggestions: string[] }> {
    return this.boundaryService.analyzeSessionHealth(sessionId, (id: string) => this.get(id));
  }

  // ======================== Private helpers (kept in orchestrator) ========================

  private async updateSessionActivity(sessionId: string, incrementMessageCount = false): Promise<void> {
    const updateData: Record<string, unknown> = {
      lastActivity: nowISO()
    };

    if (incrementMessageCount) {
      updateData.messageCount = sql`${conversationSessions.messageCount} + 1`;
    }

    await this.db
      .update(conversationSessions)
      .set(updateData)
      .where(eq(conversationSessions.id, sessionId));
  }
}
