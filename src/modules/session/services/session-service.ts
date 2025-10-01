// Session Service Implementation
// 對話會話管理服務的完整實現

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, asc, sql, count, avg, like } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { conversationSessions, messages } from '../../../db/schema';
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
  SessionValidationError,
  SessionOperationError,
  DEFAULT_SESSION_CONFIG,
  DEFAULT_PAGINATION
} from '../types/session-types';

/**
 * Session Service 主要實現
 * 提供完整的對話會話管理功能
 */
export class SessionService implements SessionServiceInterface {
  private db: DrizzleD1Database;
  private config: typeof DEFAULT_SESSION_CONFIG;

  constructor(database: D1Database, config?: Partial<typeof DEFAULT_SESSION_CONFIG>) {
    this.db = drizzle(database);
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
  }

  // ======================== 基本CRUD操作 ========================

  /**
   * 創建新會話
   */
  async create(data: CreateSessionData): Promise<ConversationSession> {
    const sessionId = `session_${data.conversation_id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    // 智能提取主題
    const topic = data.topic || (data.messageContent ? await this.extractTopic(data.messageContent) : null);

    const sessionData = {
      id: sessionId,
      conversation_id: data.conversation_id,
      sessionType: data.sessionType || 'continuous',
      topic: topic,
      startTime: now,
      endTime: null,
      lastActivity: now,
      messageCount: 0,
      isActive: true,
      createdAt: now,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null
    };

    try {
      await this.db.insert(conversationSessions).values(sessionData as any);

      console.log(`🆕 [SessionService] 創建新會話: ${sessionId}, 主題: ${topic || '未知'}`);

      return this.transformDbSession(sessionData as any);
    } catch (error) {
      console.error('[SessionService] 創建會話失敗:', error);
      throw new SessionOperationError('Failed to create session', 'create');
    }
  }

  /**
   * 獲取會話詳情
   */
  async get(sessionId: string): Promise<ConversationSession | null> {
    try {
      const session = await this.db
        .select()
        .from(conversationSessions)
        .where(eq(conversationSessions.id, sessionId))
        .get();

      return session ? this.transformDbSession(session) : null;
    } catch (error) {
      console.error('[SessionService] 獲取會話失敗:', error);
      throw new SessionOperationError('Failed to get session', 'get');
    }
  }

  /**
   * 更新會話
   */
  async update(sessionId: string, data: UpdateSessionData): Promise<ConversationSession> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const updateData: any = {
      // updatedAt: new Date().toISOString() // 不存在於 schema 中
    };

    if (data.topic !== undefined) updateData.topic = data.topic;
    if (data.sessionType !== undefined) updateData.sessionType = data.sessionType;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    // priority 和 sentiment 欄位不存在於 conversationSessions 表中
    // if (data.priority !== undefined) updateData.priority = data.priority;
    // if (data.sentiment !== undefined) updateData.sentiment = data.sentiment;
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

      console.log(`🔄 [SessionService] 更新會話: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      console.error('[SessionService] 更新會話失敗:', error);
      throw new SessionOperationError('Failed to update session', 'update');
    }
  }

  /**
   * 刪除會話
   */
  async delete(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    try {
      await this.db
        .delete(conversationSessions)
        .where(eq(conversationSessions.id, sessionId));

      console.log(`🗑️ [SessionService] 刪除會話: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('[SessionService] 刪除會話失敗:', error);
      throw new SessionOperationError('Failed to delete session', 'delete');
    }
  }

  // ======================== 列表和搜尋 ========================

  /**
   * 獲取會話列表
   */
  async list(query: SessionListQuery): Promise<SessionListResponse> {
    const page = query.page || DEFAULT_PAGINATION.page;
    const pageSize = Math.min(query.pageSize || DEFAULT_PAGINATION.pageSize, DEFAULT_PAGINATION.maxPageSize);
    const offset = (page - 1) * pageSize;

    // 構建查詢條件
    const conditions = [];
    if (query.conversation_id) conditions.push(eq(conversationSessions.conversationId, query.conversation_id));
    if (query.isActive !== undefined) conditions.push(eq(conversationSessions.isActive, query.isActive));
    if (query.sessionType) conditions.push(eq(conversationSessions.sessionType, query.sessionType));
    // 注意：priority 和 sentiment 欄位在 conversationSessions 表中不存在
    // if (query.priority) conditions.push(eq(conversationSessions.priority, query.priority));
    // if (query.sentiment) conditions.push(eq(conversationSessions.sentiment, query.sentiment));
    if (query.startDate) conditions.push(sql`${conversationSessions.startTime} >= ${query.startDate}`);
    if (query.endDate) conditions.push(sql`${conversationSessions.startTime} <= ${query.endDate}`);
    if (query.topic) conditions.push(like(conversationSessions.topic, `%${query.topic}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    try {
      // 獲取總數
      const totalResult = await this.db
        .select({ count: count() })
        .from(conversationSessions)
        .where(whereClause)
        .get();

      const total = totalResult?.count || 0;
      const totalPages = Math.ceil(total / pageSize);

      // 獲取會話列表
      const sessions = await this.db
        .select()
        .from(conversationSessions)
        .where(whereClause)
        .orderBy(desc(conversationSessions.lastActivity))
        .limit(pageSize)
        .offset(offset)
        .all();

      // 獲取摘要統計
      const summary = await this.generateListSummary(whereClause);

      return {
        sessions: sessions.map(s => this.transformDbSession(s)),
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        summary
      };
    } catch (error) {
      console.error('[SessionService] 獲取會話列表失敗:', error);
      throw new SessionOperationError('Failed to list sessions', 'list');
    }
  }

  /**
   * 搜尋會話
   */
  async search(query: SessionSearchQuery): Promise<ConversationSession[]> {
    const limit = Math.min(query.limit || 10, 50);

    const conditions = [
      like(conversationSessions.topic, `%${query.query}%`)
    ];

    if (query.conversation_id) conditions.push(eq(conversationSessions.conversationId, query.conversation_id));
    if (query.sessionType) conditions.push(eq(conversationSessions.sessionType, query.sessionType));

    try {
      const sessions = await this.db
        .select()
        .from(conversationSessions)
        .where(and(...conditions))
        .orderBy(desc(conversationSessions.lastActivity))
        .limit(limit)
        .all();

      return sessions.map(s => this.transformDbSession(s));
    } catch (error) {
      console.error('[SessionService] 搜尋會話失敗:', error);
      throw new SessionOperationError('Failed to search sessions', 'search');
    }
  }

  // ======================== 會話管理 ========================

  /**
   * 獲取或創建會話 (核心邏輯)
   */
  async getOrCreate(
    conversation_id: string,
    messageContent: string,
    senderType: 'customer' | 'agent' | 'system'
  ): Promise<ConversationSession> {
    try {
      // 1. 查找當前活躍的會話
      const activeSession = await this.db
        .select()
        .from(conversationSessions)
        .where(
          and(
            eq(conversationSessions.conversationId, conversation_id),
            eq(conversationSessions.isActive, true)
          )
        )
        .orderBy(desc(conversationSessions.lastActivity))
        .limit(1)
        .get();

      // 2. 判斷是否需要創建新會話
      const activeSessionTransformed = activeSession ? this.transformDbSession(activeSession) : null;
      const boundaryDetection = await this.detectSessionBoundary(
        activeSessionTransformed,
        messageContent,
        senderType
      );

      if (!activeSession || boundaryDetection.shouldCreateNew) {
        // 關閉舊會話
        if (activeSession) {
          await this.closeSession(activeSession.id);
        }

        // 創建新會話
        return await this.create({
          conversation_id: conversation_id,
          messageContent,
          senderType,
          topic: boundaryDetection.suggestedTopic
        });
      }

      // 3. 更新現有會話
      await this.updateSessionActivity(activeSession.id);
      return this.transformDbSession(activeSession);
    } catch (error) {
      console.error('[SessionService] getOrCreate 失敗:', error);
      throw new SessionOperationError('Failed to get or create session', 'getOrCreate');
    }
  }

  /**
   * 關閉會話
   */
  async closeSession(sessionId: string): Promise<boolean> {
    const now = new Date().toISOString();

    try {
      await this.db
        .update(conversationSessions)
        .set({
          isActive: false,
          endTime: now
          // updatedAt: now // 不存在於 schema 中
        })
        .where(eq(conversationSessions.id, sessionId));

      console.log(`🔚 [SessionService] 關閉會話: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('[SessionService] 關閉會話失敗:', error);
      throw new SessionOperationError('Failed to close session', 'close');
    }
  }

  /**
   * 重新開啟會話
   */
  async reopenSession(sessionId: string): Promise<boolean> {
    const now = new Date().toISOString();

    try {
      await this.db
        .update(conversationSessions)
        .set({
          isActive: true,
          endTime: null,
          lastActivity: now
          // updatedAt: now // 不存在於 schema 中
        })
        .where(eq(conversationSessions.id, sessionId));

      console.log(`🔄 [SessionService] 重新開啟會話: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('[SessionService] 重新開啟會話失敗:', error);
      throw new SessionOperationError('Failed to reopen session', 'reopen');
    }
  }

  // ======================== 訊息相關 ========================

  /**
   * 獲取會話訊息
   */
  async getMessages(sessionId: string, page = 1, pageSize = 20): Promise<SessionMessagesResponse> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const offset = (page - 1) * pageSize;

    try {
      // 獲取總數
      const totalResult = await this.db
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .get();

      const total = totalResult?.count || 0;
      const totalPages = Math.ceil(total / pageSize);

      // 獲取訊息列表
      const messageList = await this.db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(asc(messages.sessionSequence), asc(messages.createdAt))
        .limit(pageSize)
        .offset(offset)
        .all();

      const transformedMessages: SessionMessage[] = messageList.map(msg => ({
        id: msg.id.toString(),
        sessionId: sessionId,
        conversation_id: msg.conversationId.toString(),
        senderId: msg.agentSenderId || msg.customerSenderId?.toString() || 'unknown',
        senderType: msg.senderType as any,
        content: msg.content,
        messageType: msg.messageType as any,
        sessionSequence: msg.sessionSequence || 0,
        ...(msg.platformMessageId && { platformMessageId: msg.platformMessageId }),
        createdAt: msg.createdAt || new Date().toISOString(),
        ...(msg.metadata ? { metadata: JSON.parse(msg.metadata) } : {})
      }));

      return {
        sessionId,
        messages: transformedMessages,
        messageCount: total,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('[SessionService] 獲取會話訊息失敗:', error);
      throw new SessionOperationError('Failed to get session messages', 'getMessages');
    }
  }

  /**
   * 新增訊息到會話
   */
  async addMessage(sessionId: string, messageData: Omit<SessionMessage, 'id' | 'sessionId' | 'sessionSequence' | 'createdAt'>): Promise<SessionMessage> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // 獲取下一個序列編號
    const sequenceResult = await this.db
      .select({
        nextSequence: sql<number>`COALESCE(MAX(${messages.sessionSequence}), 0) + 1`
      })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .get();

    const sessionSequence = sequenceResult?.nextSequence || 1;
    const now = new Date().toISOString();

    const messageRecord = {
      conversation_id: parseInt(messageData.conversation_id),
      sessionId: sessionId,
      senderType: messageData.senderType,
      agentSenderId: messageData.senderType === 'agent' ? messageData.senderId : null,
      customerSenderId: messageData.senderType === 'customer' ? parseInt(messageData.senderId) : null,
      content: messageData.content,
      messageType: messageData.messageType,
      sessionSequence: sessionSequence,
      platformMessageId: messageData.platformMessageId || null,
      metadata: messageData.metadata ? JSON.stringify(messageData.metadata) : null,
      createdAt: now
    };

    try {
      await this.db.insert(messages).values(messageRecord as any);

      // 更新會話活動和訊息計數
      await this.updateSessionActivity(sessionId, true);

      // Get the actual inserted message to return the correct ID
      const insertedMessage = await this.db
        .select()
        .from(messages)
        .where(and(
          eq(messages.sessionId, sessionId),
          eq(messages.sessionSequence, sessionSequence),
          eq(messages.createdAt, now)
        ))
        .limit(1);

      const message = insertedMessage[0];
      if (!message) {
        throw new SessionOperationError('Failed to retrieve inserted message', 'addMessage');
      }

      return {
        id: message.id.toString(),
        sessionId,
        conversation_id: messageData.conversation_id,
        senderId: messageData.senderId,
        senderType: messageData.senderType,
        content: messageData.content,
        messageType: messageData.messageType,
        sessionSequence,
        ...(messageData.platformMessageId && { platformMessageId: messageData.platformMessageId }),
        createdAt: now,
        ...(messageData.metadata && { metadata: messageData.metadata })
      };
    } catch (error) {
      console.error('[SessionService] 新增會話訊息失敗:', error);
      throw new SessionOperationError('Failed to add message to session', 'addMessage');
    }
  }

  // ======================== 統計和分析 ========================

  /**
   * 獲取會話統計
   */
  async getStats(conversationId?: string): Promise<SessionStats> {
    const baseCondition = conversationId ? eq(conversationSessions.conversationId, conversationId) : undefined;

    try {
      // 基本統計
      const basicStats = await this.db
        .select({
          totalSessions: count(),
          activeSessions: sql<number>`SUM(CASE WHEN ${conversationSessions.isActive} = 1 THEN 1 ELSE 0 END)`,
          avgMessages: avg(conversationSessions.messageCount),
        })
        .from(conversationSessions)
        .where(baseCondition)
        .get();

      // 按類型統計
      const typeStats = await this.db
        .select({
          sessionType: conversationSessions.sessionType,
          count: count()
        })
        .from(conversationSessions)
        .where(baseCondition)
        .groupBy(conversationSessions.sessionType)
        .all();

      // 按優先級統計 (通過 metadata 實現)
      // TODO: 實現通過 metadata 欄位的優先級統計
      const priorityStats: Array<{ priority: string; count: number }> = [];

      // 按情感統計 (通過 metadata 實現)
      // TODO: 實現通過 metadata 欄位的情感統計
      const sentimentStats: Array<{ sentiment: string; count: number }> = [];

      const total = basicStats?.totalSessions || 0;
      const active = basicStats?.activeSessions || 0;

      return {
        totalSessions: total,
        activeSessions: active,
        inactiveSessions: total - active,
        averageMessagesPerSession: Math.round(Number(basicStats?.avgMessages) || 0),
        averageSessionDuration: 0, // TODO: Calculate from session duration
        sessionsByType: this.arrayToRecord(typeStats, 'sessionType', 'continuous'),
        sessionsByPriority: { low: 0, medium: total, high: 0, urgent: 0 }, // 預設值，因為資料庫中沒有 priority 欄位
        sessionsBySentiment: { positive: 0, negative: 0, neutral: total }, // 預設值，因為資料庫中沒有 sentiment 欄位
        topicsDistribution: [], // TODO: Implement topic analysis
        dailyStats: [] // TODO: Implement daily statistics
      };
    } catch (error) {
      console.error('[SessionService] 獲取統計失敗:', error);
      throw new SessionOperationError('Failed to get statistics', 'getStats');
    }
  }

  /**
   * 獲取活動統計
   */
  async getActivityStats(query: Omit<SessionActivityStats, 'activities' | 'summary'>): Promise<SessionActivityStats> {
    // TODO: Implement activity statistics
    return {
      conversation_id: query.conversation_id || '',
      timeRange: query.timeRange,
      activities: [],
      summary: {
        totalActivity: 0,
        avgSessionsPerDay: 0,
        avgMessagesPerSession: 0,
        peakActivityHour: 12,
        leastActivityHour: 3
      }
    };
  }

  // ======================== 批量操作 ========================

  /**
   * 批量操作會話
   */
  async batchOperation(operation: BatchSessionOperation): Promise<BatchOperationResult> {
    const results: BatchOperationResult['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const sessionId of operation.sessionIds) {
      try {
        switch (operation.action) {
          case 'close':
            await this.closeSession(sessionId);
            break;
          case 'reopen':
            await this.reopenSession(sessionId);
            break;
          case 'update_priority':
            // priority 欄位不存在於 conversationSessions 表中
            // if (operation.data?.priority) {
            //   await this.update(sessionId, { priority: operation.data.priority });
            // }
            break;
          case 'add_tags':
            // TODO: Implement tag operations
            break;
          case 'remove_tags':
            // TODO: Implement tag operations
            break;
          case 'delete':
            await this.delete(sessionId);
            break;
        }

        results.push({ sessionId, success: true });
        successCount++;
      } catch (error) {
        results.push({
          sessionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      totalRequested: operation.sessionIds.length,
      successCount,
      failedCount,
      results
    };
  }

  // ======================== 工具方法 ========================

  /**
   * 檢測會話邊界
   */
  async detectSessionBoundary(
    currentSession: ConversationSession | null,
    messageContent: string,
    senderType: 'customer' | 'agent' | 'system'
  ): Promise<SessionBoundaryDetection> {
    if (!currentSession) {
      return {
        shouldCreateNew: true,
        reason: 'first_session',
        confidence: 1.0
      };
    }

    const lastActivity = new Date(currentSession.lastActivity);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    // 1. 時間間隔檢查
    if (timeDiffMinutes > this.config.timeGapThreshold) {
      return {
        shouldCreateNew: true,
        reason: 'time_gap',
        confidence: 0.9,
        metadata: { timeDiffMinutes }
      };
    }

    // 2. 訊息數量檢查
    if (currentSession.messageCount >= this.config.maxMessagesPerSession) {
      return {
        shouldCreateNew: true,
        reason: 'message_limit',
        confidence: 0.8,
        metadata: { currentMessageCount: currentSession.messageCount }
      };
    }

    // 3. 會話持續時間檢查
    const sessionStart = new Date(currentSession.startTime);
    const sessionDurationHours = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
    if (sessionDurationHours > this.config.maxSessionDuration) {
      return {
        shouldCreateNew: true,
        reason: 'duration_limit',
        confidence: 0.7,
        metadata: { sessionDurationHours }
      };
    }

    // 4. 主題變化檢查
    if (senderType === 'customer' && this.config.enableTopicDetection) {
      const hasTopicChange = this.config.topicChangeKeywords.some(keyword =>
        messageContent.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasTopicChange) {
        const suggestedTopic = await this.extractTopic(messageContent);
        return {
          shouldCreateNew: true,
          reason: 'topic_change',
          confidence: 0.6,
          suggestedTopic: suggestedTopic || 'unknown',
          metadata: { detectedKeywords: this.config.topicChangeKeywords.filter(k => messageContent.toLowerCase().includes(k)) }
        };
      }
    }

    return {
      shouldCreateNew: false,
      reason: 'manual',
      confidence: 0.1
    };
  }

  /**
   * 提取主題
   */
  async extractTopic(messageContent: string): Promise<string | null> {
    const content = messageContent.toLowerCase();

    const topicKeywords = {
      '產品諮詢': ['產品', '功能', '特色', '介紹', 'product', 'feature'],
      '技術支援': ['問題', '錯誤', '故障', '不能', '無法', 'error', 'bug', 'issue'],
      '訂單查詢': ['訂單', '購買', '付款', '配送', 'order', 'payment', 'delivery'],
      '帳戶問題': ['帳戶', '登入', '密碼', '註冊', 'account', 'login', 'password'],
      '投訴建議': ['投訴', '建議', '不滿', '改善', 'complaint', 'feedback', 'suggestion'],
      '一般諮詢': ['你好', '哈囉', '請問', 'hello', 'hi', 'question']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return topic;
      }
    }

    return null;
  }

  /**
   * 分析會話健康度
   */
  async analyzeSessionHealth(sessionId: string): Promise<{ healthy: boolean; issues: string[]; suggestions: string[] }> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    // 檢查會話時長
    if (session.isActive) {
      const now = new Date();
      const startTime = new Date(session.startTime);
      const durationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      if (durationHours > 48) {
        issues.push('會話持續時間過長');
        suggestions.push('考慮關閉此會話並開始新會話');
      }
    }

    // 檢查訊息數量
    if (session.messageCount > 100) {
      issues.push('會話訊息數量過多');
      suggestions.push('考慮分割會話以提高管理效率');
    }

    // 檢查活動頻率
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const inactiveMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    if (session.isActive && inactiveMinutes > this.config.inactiveThreshold) {
      issues.push('會話長時間無活動');
      suggestions.push('考慮主動聯繫客戶或關閉會話');
    }

    return {
      healthy: issues.length === 0,
      issues,
      suggestions
    };
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 轉換資料庫會話物件
   */
  private transformDbSession(dbSession: any): ConversationSession {
    return {
      id: dbSession.id,
      conversation_id: dbSession.conversation_id,
      sessionType: dbSession.sessionType,
      topic: dbSession.topic,
      startTime: dbSession.startTime,
      endTime: dbSession.endTime,
      lastActivity: dbSession.lastActivity,
      messageCount: dbSession.messageCount || 0,
      isActive: !!dbSession.isActive,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt,
      // priority 和 sentiment 欄位不存在於資料庫 schema 中
      priority: 'medium', // 預設值
      sentiment: 'neutral' as const, // 預設值
      tags: dbSession.tags ? JSON.parse(dbSession.tags) : [],
      metadata: dbSession.metadata ? JSON.parse(dbSession.metadata) : {}
    };
  }

  /**
   * 更新會話活動時間
   */
  private async updateSessionActivity(sessionId: string, incrementMessageCount = false): Promise<void> {
    const updateData: any = {
      lastActivity: new Date().toISOString()
    };

    if (incrementMessageCount) {
      updateData.messageCount = sql`${conversationSessions.messageCount} + 1`;
    }

    await this.db
      .update(conversationSessions)
      .set(updateData)
      .where(eq(conversationSessions.id, sessionId));
  }

  /**
   * 生成列表摘要
   */
  private async generateListSummary(whereClause: any) {
    try {
      const totalResult = await this.db
        .select({ count: count() })
        .from(conversationSessions)
        .where(whereClause)
        .get();

      const activeResult = await this.db
        .select({ count: count() })
        .from(conversationSessions)
        .where(and(whereClause, eq(conversationSessions.isActive, true)))
        .get();

      const total = totalResult?.count || 0;
      const active = activeResult?.count || 0;

      return {
        totalSessions: total,
        activeSessions: active,
        inactiveSessions: total - active,
        byType: {} as any,
        byPriority: {} as any
      };
    } catch (error) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        inactiveSessions: 0,
        byType: {} as any,
        byPriority: {} as any
      };
    }
  }

  /**
   * 將陣列轉換為記錄物件
   */
  private arrayToRecord(array: any[], keyField: string, defaultValue: string): Record<string, number> {
    const result: Record<string, number> = {};
    array.forEach(item => {
      result[item[keyField] || defaultValue] = item.count;
    });
    return result;
  }
}