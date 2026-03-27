import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, like, count, sql } from 'drizzle-orm';
import { conversationSessions } from '@/db/schema';
import type { ConversationSession, SessionListQuery, SessionSearchQuery, SessionListResponse } from '../types/session-types';
import { SessionOperationError, DEFAULT_PAGINATION } from '../types/session-types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('SessionService');

export function transformDbSession(dbSession: Record<string, unknown>): ConversationSession {
  return {
    id: dbSession.id as string, conversationId: dbSession.conversationId as string,
    sessionType: dbSession.sessionType as ConversationSession['sessionType'],
    topic: dbSession.topic as string | null | undefined,
    startTime: dbSession.startTime as string, endTime: dbSession.endTime as string | null | undefined,
    lastActivity: dbSession.lastActivity as string, messageCount: (dbSession.messageCount as number) || 0,
    isActive: !!dbSession.isActive, createdAt: dbSession.createdAt as string,
    updatedAt: dbSession.updatedAt as string | undefined,
    priority: 'medium', sentiment: 'neutral' as const,
    tags: dbSession.tags ? JSON.parse(dbSession.tags as string) : [],
    metadata: dbSession.metadata ? JSON.parse(dbSession.metadata as string) : {}
  };
}

export class SessionQueryService {
  constructor(private db: DrizzleD1Database) {}

  async list(query: SessionListQuery): Promise<SessionListResponse> {
    const page = query.page || DEFAULT_PAGINATION.page;
    const pageSize = Math.min(query.pageSize || DEFAULT_PAGINATION.pageSize, DEFAULT_PAGINATION.maxPageSize);
    const offset = (page - 1) * pageSize;
    const conditions = [];
    if (query.conversationId) conditions.push(eq(conversationSessions.conversationId, query.conversationId));
    if (query.isActive !== undefined) conditions.push(eq(conversationSessions.isActive, query.isActive));
    if (query.sessionType) conditions.push(eq(conversationSessions.sessionType, query.sessionType));
    if (query.startDate) conditions.push(sql`${conversationSessions.startTime} >= ${query.startDate}`);
    if (query.endDate) conditions.push(sql`${conversationSessions.startTime} <= ${query.endDate}`);
    if (query.topic) conditions.push(like(conversationSessions.topic, `%${query.topic}%`));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    try {
      const totalResult = await this.db.select({ count: count() }).from(conversationSessions).where(whereClause).get();
      const total = totalResult?.count || 0;
      const totalPages = Math.ceil(total / pageSize);
      const sessions = await this.db.select().from(conversationSessions).where(whereClause).orderBy(desc(conversationSessions.lastActivity)).limit(pageSize).offset(offset).all();
      const summary = await this.generateListSummary(whereClause);
      return { sessions: sessions.map(s => transformDbSession(s as unknown as Record<string, unknown>)), pagination: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }, summary };
    } catch (error) {
      log.error('Failed to list sessions', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to list sessions', 'list');
    }
  }

  async search(query: SessionSearchQuery): Promise<ConversationSession[]> {
    const limit = Math.min(query.limit || 10, 50);
    const conditions = [like(conversationSessions.topic, `%${query.query}%`)];
    if (query.conversationId) conditions.push(eq(conversationSessions.conversationId, query.conversationId));
    if (query.sessionType) conditions.push(eq(conversationSessions.sessionType, query.sessionType));
    try {
      const sessions = await this.db.select().from(conversationSessions).where(and(...conditions)).orderBy(desc(conversationSessions.lastActivity)).limit(limit).all();
      return sessions.map(s => transformDbSession(s as unknown as Record<string, unknown>));
    } catch (error) {
      log.error('Failed to search sessions', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to search sessions', 'search');
    }
  }

  arrayToRecord(array: Array<Record<string, unknown>>, keyField: string, defaultValue: string): Record<string, number> {
    const result: Record<string, number> = {};
    array.forEach(item => { result[(item[keyField] as string) || defaultValue] = item.count as number; });
    return result;
  }

  async generateListSummary(whereClause: ReturnType<typeof and>) {
    try {
      const totalResult = await this.db.select({ count: count() }).from(conversationSessions).where(whereClause).get();
      const activeResult = await this.db.select({ count: count() }).from(conversationSessions).where(and(whereClause, eq(conversationSessions.isActive, true))).get();
      const total = totalResult?.count || 0;
      const active = activeResult?.count || 0;
      return { totalSessions: total, activeSessions: active, inactiveSessions: total - active, byType: {} as Record<string, number>, byPriority: {} as Record<string, number> };
    } catch (_error) {
      return { totalSessions: 0, activeSessions: 0, inactiveSessions: 0, byType: {} as Record<string, number>, byPriority: {} as Record<string, number> };
    }
  }
}
