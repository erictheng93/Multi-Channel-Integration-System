import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, count, avg, sql } from 'drizzle-orm';
import { conversationSessions } from '@/db/schema';
import type { SessionStats, SessionActivityStats, BatchSessionOperation, BatchOperationResult } from '../types/session-types';
import { SessionOperationError } from '../types/session-types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('SessionService');

export interface SessionLifecycleCallbacks {
  closeSession: (sessionId: string) => Promise<boolean>;
  reopenSession: (sessionId: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
}

export class SessionStatsService {
  constructor(private db: DrizzleD1Database) {}

  async getStats(conversationId: string | undefined, arrayToRecord: (array: Array<Record<string, unknown>>, keyField: string, defaultValue: string) => Record<string, number>): Promise<SessionStats> {
    const baseCondition = conversationId ? eq(conversationSessions.conversationId, conversationId) : undefined;
    try {
      const basicStats = await this.db.select({ totalSessions: count(), activeSessions: sql<number>`SUM(CASE WHEN ${conversationSessions.isActive} = 1 THEN 1 ELSE 0 END)`, avgMessages: avg(conversationSessions.messageCount) }).from(conversationSessions).where(baseCondition).get();
      const typeStats = await this.db.select({ sessionType: conversationSessions.sessionType, count: count() }).from(conversationSessions).where(baseCondition).groupBy(conversationSessions.sessionType).all();
      const total = basicStats?.totalSessions || 0;
      const active = basicStats?.activeSessions || 0;
      return {
        totalSessions: total, activeSessions: active, inactiveSessions: total - active,
        averageMessagesPerSession: Math.round(Number(basicStats?.avgMessages) || 0), averageSessionDuration: 0,
        sessionsByType: arrayToRecord(typeStats as unknown as Array<Record<string, unknown>>, 'sessionType', 'continuous'),
        sessionsByPriority: { low: 0, medium: total, high: 0, urgent: 0 },
        sessionsBySentiment: { positive: 0, negative: 0, neutral: total },
        topicsDistribution: [], dailyStats: []
      };
    } catch (error) {
      log.error('Failed to get statistics', {}, error instanceof Error ? error : String(error));
      throw new SessionOperationError('Failed to get statistics', 'getStats');
    }
  }

  async getActivityStats(query: Omit<SessionActivityStats, 'activities' | 'summary'>): Promise<SessionActivityStats> {
    return { conversationId: query.conversationId || '', timeRange: query.timeRange, activities: [], summary: { totalActivity: 0, avgSessionsPerDay: 0, avgMessagesPerSession: 0, peakActivityHour: 12, leastActivityHour: 3 } };
  }

  async batchOperation(operation: BatchSessionOperation, callbacks: SessionLifecycleCallbacks): Promise<BatchOperationResult> {
    const results: BatchOperationResult['results'] = [];
    let successCount = 0; let failedCount = 0;
    for (const sessionId of operation.sessionIds) {
      try {
        switch (operation.action) {
          case 'close': await callbacks.closeSession(sessionId); break;
          case 'reopen': await callbacks.reopenSession(sessionId); break;
          case 'update_priority': break; case 'add_tags': break; case 'remove_tags': break;
          case 'delete': await callbacks.deleteSession(sessionId); break;
        }
        results.push({ sessionId, success: true }); successCount++;
      } catch (error) {
        results.push({ sessionId, success: false, error: error instanceof Error ? error.message : 'Unknown error' }); failedCount++;
      }
    }
    return { success: failedCount === 0, totalRequested: operation.sessionIds.length, successCount, failedCount, results };
  }
}
