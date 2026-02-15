// 對話查詢處理器
// Handles: GET /:id (conversation detail), GET / (conversation list)

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, customers, teams, conversationTags, tags } from '@/db/schema';
import type { Bindings } from '@/types';
import { PermissionService } from '@shared/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { createContextLogger } from '@/utils/logger';
import { getDisplayContent } from '../utils/message-helpers';

const log = createContextLogger('ConversationQueriesHandler');

const conversationQueriesHandler = new Hono<{ Bindings: Bindings }>();

// ==================== Priority 4: SINGLE PARAM routes ====================

// 獲取特定對話詳情
conversationQueriesHandler.get('/:id', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id');

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const drizzleDb = createDbClient(c.env.DB);

    // 🔧 FIX: 使用完整的 JOIN 查詢，返回與 assign/unassign API 相同的數據結構
    const [result] = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!result || !result.conversations) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, HTTP_STATUS.NOT_FOUND);
    }

    // 🔧 FIX: 查詢該對話的最新訊息
    let lastMessageData: {
      messageId: string;
      content: string;
      createdAt: string;
      senderType: string;
      messageType: string;
    } | null = null;

    try {
      const latestMessageResult = await c.env.DB.prepare(`
        SELECT id as messageId, content, created_at as createdAt, sender_type as senderType, message_type as messageType
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(conversationId).first();

      if (latestMessageResult) {
        lastMessageData = latestMessageResult as any;
      }
    } catch (msgError) {
      log.warn('Failed to fetch latest message for conversation', { conversationId, error: msgError });
    }

    const displayContent = lastMessageData ? getDisplayContent(lastMessageData.content, lastMessageData.messageType) : null;

    // 構建完整的對話對象，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData: any = {
      ...result.conversations,
      // 包含完整的 assignedTeam 對象（如果已指派）
      assignedTeam: result.teams || undefined,
      // 包含完整的 customer 對象
      customer: result.customers ? {
        id: result.customers.id,
        name: result.customers.displayName, // 🔧 FIX: 添加 name 字段以匹配前端類型定義
        displayName: result.customers.displayName, // 保留向後兼容
        platformUserId: result.customers.platformUserId,
        platform: result.customers.platform,
        avatarUrl: result.customers.avatarUrl,
        email: result.customers.email,
        phone: result.customers.phone,
        sourceTeamId: result.customers.sourceTeamId,
        metadata: result.customers.metadata,
        createdAt: result.customers.createdAt,
        updatedAt: result.customers.updatedAt
      } : undefined,
      // 🔧 FIX: 添加 lastMessage 相關字段，與 list API 保持一致
      lastMessage: (lastMessageData && displayContent) ? {
        id: lastMessageData.messageId || '',
        content: displayContent,
        createdAt: lastMessageData.createdAt,
        senderType: lastMessageData.senderType || 'agent',
        messageType: lastMessageData.messageType || 'text'
      } : null,
      lastMessageContent: displayContent,
      lastMessageAtActual: lastMessageData?.createdAt || null,
      lastMessageType: lastMessageData?.messageType || null
    };

    return c.json({
      success: true,
      data: conversationData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Get conversation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// ==================== Priority 5: WILDCARD routes ====================

// 獲取用戶可見的對話列表
conversationQueriesHandler.get('/', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    log.debug('Conversation Handler GET / - User authenticated', { userId: user.id, userIdType: typeof user.id });

    // 獲取篩選參數
    const tagIdsParam = c.req.query('tagIds'); // e.g., "1,2,3"
    const tagIds = tagIdsParam ? tagIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];

    log.debug('Conversation Handler filter params', { tagIds });

    const visibleConversationIds = await PermissionService.getVisibleConversations(user.id, c.env.DB);

    log.debug('Conversation Handler visible conversations', { count: visibleConversationIds.length });

    // 如果沒有可見對話，返回空列表
    if (visibleConversationIds.length === 0) {
      log.debug('Conversation Handler no visible conversations found');
      return c.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    // 🔧 FIX: 使用完整 JOIN 查詢，返回嵌套對象結構 (統一類型定義)
    log.debug('Conversation Handler querying conversation data');
    const drizzleDb = createDbClient(c.env.DB);

    // 如果有標籤篩選，先獲取有這些標籤的對話 ID
    let filteredConversationIds = visibleConversationIds;
    if (tagIds.length > 0) {
      const taggedConversations = await drizzleDb
        .selectDistinct({ conversationId: conversationTags.conversationId })
        .from(conversationTags)
        .where(
          and(
            inArray(conversationTags.conversationId, visibleConversationIds),
            inArray(conversationTags.tagId, tagIds)
          )
        );
      filteredConversationIds = taggedConversations.map(tc => tc.conversationId);

      log.debug('Conversation Handler filtered by tags', {
        originalCount: visibleConversationIds.length,
        filteredCount: filteredConversationIds.length,
        tagIds
      });

      // 如果篩選後沒有對話，返回空列表
      if (filteredConversationIds.length === 0) {
        return c.json({
          success: true,
          data: [],
          timestamp: new Date().toISOString()
        });
      }
    }

    const conversationResults = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(inArray(conversations.id, filteredConversationIds))
      .orderBy(desc(conversations.updatedAt));

    // 構建完整的對話對象數組，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData = conversationResults.map(result => ({
      ...result.conversations,
      // 🔧 完整的 customer 對象 (匹配前端類型定義)
      customer: result.customers ? {
        id: result.customers.id,
        name: result.customers.displayName,        // 🔧 映射到 name 字段
        displayName: result.customers.displayName, // 保留向後兼容
        platform: result.customers.platform,
        platformUserId: result.customers.platformUserId,
        avatarUrl: result.customers.avatarUrl,
        createdAt: result.customers.createdAt
      } : undefined,
      // 🔧 完整的 assignedTeam 對象
      assignedTeam: result.teams ? {
        id: result.teams.id,
        name: result.teams.name,
        description: result.teams.description
      } : undefined,
      // 保留扁平字段以向後兼容舊版前端
      customerName: result.customers?.displayName,
      platform: result.customers?.platform,
      platformUserId: result.customers?.platformUserId
    }));

    log.debug('Conversation Handler retrieved conversation data', { count: conversationData.length });

    // 🔧 Phase B: 直接 DB 查詢獲取最新訊息（移除 KV 快取層以保證數據一致性）
    // 使用單一批量查詢獲取所有對話的最新訊息
    const conversationIds = conversationData.map(c => c.id);

    let lastMessagesMap = new Map<string, {
      messageId: string;
      content: string;
      createdAt: string;
      senderType: string;
      messageType: string;
    }>();

    if (conversationIds.length > 0) {
      // 使用 SQL 子查詢獲取每個對話的最新訊息
      // SQLite/D1 支持的高效查詢模式
      const placeholders = conversationIds.map(() => '?').join(',');
      const latestMessagesQuery = `
        SELECT
          m.id as messageId,
          m.conversation_id as conversationId,
          m.content,
          m.created_at as createdAt,
          m.sender_type as senderType,
          m.message_type as messageType
        FROM messages m
        INNER JOIN (
          SELECT conversation_id, MAX(created_at) as max_created_at
          FROM messages
          WHERE conversation_id IN (${placeholders})
          GROUP BY conversation_id
        ) latest ON m.conversation_id = latest.conversation_id
                AND m.created_at = latest.max_created_at
        WHERE m.conversation_id IN (${placeholders})
      `;

      try {
        // 🔍 DEBUG: Log conversation IDs being queried (using INFO level for production visibility)
        log.info('LASTMSG_DEBUG: Starting latest messages query', {
          conversationIds: conversationIds.slice(0, 5), // Log first 5 for debugging
          totalCount: conversationIds.length
        });

        // 執行原生 SQL 查詢（參數需要傳遞兩次：一次給子查詢，一次給外層）
        const result = await c.env.DB.prepare(latestMessagesQuery)
          .bind(...conversationIds, ...conversationIds)
          .all();

        // 🔍 DEBUG: Log raw SQL result
        log.info('LASTMSG_DEBUG: SQL query returned', {
          success: result.success,
          resultsCount: result.results?.length || 0
        });

        if (result.results) {
          for (const row of result.results as any[]) {
            lastMessagesMap.set(row.conversationId, {
              messageId: row.messageId,
              content: row.content,
              createdAt: row.createdAt,
              senderType: row.senderType,
              messageType: row.messageType
            });
          }
        }

        // 🔍 DEBUG: Log which conversations have/don't have messages
        const conversationsWithMessages = Array.from(lastMessagesMap.keys());
        const conversationsWithoutMessages = conversationIds.filter(id => !lastMessagesMap.has(id));
        log.info('LASTMSG_DEBUG: Message mapping complete', {
          requestedCount: conversationIds.length,
          foundCount: lastMessagesMap.size,
          withMessages: conversationsWithMessages.slice(0, 3),
          withoutMessages: conversationsWithoutMessages.slice(0, 5)
        });

        log.debug('Conversation Handler fetched latest messages from DB', {
          requestedCount: conversationIds.length,
          foundCount: lastMessagesMap.size
        });

        // 🔍 DEBUG: Check if conversations without messages actually have messages in DB
        if (conversationsWithoutMessages.length > 0) {
          const debugConvId = conversationsWithoutMessages[0];
          const debugQuery = await c.env.DB.prepare(
            'SELECT id, conversation_id, content, created_at, sender_type FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 3'
          ).bind(debugConvId).all();
          log.info('LASTMSG_DEBUG: Direct query for conversation without lastMessage', {
            conversationId: debugConvId,
            messagesFound: debugQuery.results?.length || 0,
            messages: debugQuery.results?.map((m: any) => ({
              id: m.id?.substring(0, 8),
              content: m.content?.substring(0, 30),
              createdAt: m.created_at,
              senderType: m.sender_type
            }))
          });
        }
      } catch (dbError) {
        log.error('Conversation Handler failed to fetch latest messages', {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        // 繼續處理，但 lastMessage 將為 null
      }
    }

    // 結合數據并統一為camelCase格式
    const combinedData = conversationData.map(conv => {
      const lastMsg = lastMessagesMap.get(conv.id);
      const displayContent = lastMsg ? getDisplayContent(lastMsg.content, lastMsg.messageType) : null;
      return {
        ...conv,
        // 構建lastMessage對象以匹配前端期望的結構
        // Now checks if lastMsg exists AND has displayable content (original or placeholder)
        lastMessage: (lastMsg && displayContent) ? {
          id: lastMsg.messageId || '',
          content: displayContent,
          createdAt: lastMsg.createdAt,
          senderType: lastMsg.senderType || 'agent',
          messageType: lastMsg.messageType || 'text'
        } : null,
        // 保留原有字段以確保向後兼容
        lastMessageContent: displayContent,
        lastMessageAtActual: lastMsg?.createdAt || null,
        // 新增: 原始消息類型，供前端判斷顯示樣式
        lastMessageType: lastMsg?.messageType || null
      };
    });

    // 🔍 DEBUG: Log final response data
    const conversationsWithLastMsg = combinedData.filter((c: any) => c.lastMessageContent);
    const conversationsWithoutLastMsg = combinedData.filter((c: any) => !c.lastMessageContent);
    log.info('LASTMSG_DEBUG: Final response data', {
      totalConversations: combinedData.length,
      withLastMessage: conversationsWithLastMsg.length,
      withoutLastMessage: conversationsWithoutLastMsg.length,
      sampleWithMsg: conversationsWithLastMsg[0] ? {
        id: conversationsWithLastMsg[0].id,
        lastMsgContent: conversationsWithLastMsg[0].lastMessageContent?.substring(0, 30)
      } : null,
      sampleWithoutMsg: conversationsWithoutLastMsg[0] ? {
        id: conversationsWithoutLastMsg[0].id,
        lastMsgContent: conversationsWithoutLastMsg[0].lastMessageContent
      } : null
    });

    return c.json({
      success: true,
      data: combinedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('Get conversations error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversations',
      timestamp: new Date().toISOString()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default conversationQueriesHandler;
