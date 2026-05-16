// 對話查詢處理器
// Handles: GET /:id (conversation detail), GET / (conversation list)

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq, inArray, desc, and, like, sql } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, customers, teams, conversationTags, customerTags } from '@/db/schema';
import type { Bindings } from '@/types';
import { PermissionService } from '@/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { createContextLogger } from '@/utils/logger';
import { getDisplayContent } from '../utils/message-helpers';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('ConversationQueriesHandler');

interface LatestConversationMessageRow {
  messageId: string;
  content: string;
  createdAt: string;
  senderType: string;
  messageType: string;
}

interface UnreadCountRow {
  unreadCount: number;
}

interface ConversationListLatestMessageRow extends LatestConversationMessageRow {
  conversationId: string;
}

interface ConversationUnreadCountRow extends UnreadCountRow {
  conversationId: string;
}

const conversationQueriesHandler = new Hono<{ Bindings: Bindings }>();

// ==================== Priority 4: SINGLE PARAM routes ====================

// 獲取特定對話詳情
conversationQueriesHandler.get('/:id', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;

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

    // FIX: 使用完整的 JOIN 查詢，返回與 assign/unassign API 相同的數據結構
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
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    // FIX: 查詢該對話的最新訊息
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
      `).bind(conversationId).first<LatestConversationMessageRow>();

      if (latestMessageResult) {
        lastMessageData = latestMessageResult;
      }
    } catch (msgError) {
      log.warn('Failed to fetch latest message for conversation', { conversationId, error: msgError });
    }

    // Query unread count for this conversation
    // "Unread" = customer messages after MAX(last_agent_reply, last_read_at)
    let unreadCount = 0;
    try {
      const unreadResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as unreadCount
        FROM messages m
        WHERE m.conversation_id = ?
          AND m.sender_type = 'customer'
          AND m.deleted_at IS NULL
          AND m.created_at > MAX(
            COALESCE(
              (SELECT MAX(m2.created_at) FROM messages m2
               WHERE m2.conversation_id = m.conversation_id
               AND m2.sender_type IN ('agent', 'system')
               AND m2.deleted_at IS NULL),
              '1970-01-01'
            ),
            COALESCE(
              (SELECT last_read_at FROM conversations WHERE id = m.conversation_id),
              '1970-01-01'
            )
          )
      `).bind(conversationId).first<UnreadCountRow>();

      if (unreadResult) {
        unreadCount = Number(unreadResult.unreadCount) || 0;
      }
    } catch (unreadError) {
      log.warn('Failed to fetch unread count for conversation', { conversationId, error: unreadError });
    }

    const displayContent = lastMessageData ? getDisplayContent(lastMessageData.content, lastMessageData.messageType) : null;

    // 構建完整的對話對象，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData: unknown = {
      ...result.conversations,
      // 包含完整的 assignedTeam 對象（如果已指派）
      assignedTeam: result.teams || undefined,
      // 包含完整的 customer 對象
      customer: result.customers ? {
        id: result.customers.id,
        name: result.customers.displayName, //  FIX: 添加 name 字段以匹配前端類型定義
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
      // FIX: 添加 lastMessage 相關字段，與 list API 保持一致
      lastMessage: (lastMessageData && displayContent) ? {
        id: lastMessageData.messageId || '',
        content: displayContent,
        createdAt: lastMessageData.createdAt,
        senderType: lastMessageData.senderType || 'agent',
        messageType: lastMessageData.messageType || 'text'
      } : null,
      lastMessageContent: displayContent,
      lastMessageAtActual: lastMessageData?.createdAt || null,
      lastMessageType: lastMessageData?.messageType || null,
      // Unread count: customer messages awaiting agent response
      unreadCount
    };

    return c.json({
      success: true,
      data: conversationData,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
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
    const searchQuery = c.req.query('search')?.trim() || '';

    const customerNameQuery = c.req.query('customerName')?.trim() || '';
    const updatedAfter = c.req.query('updatedAfter')?.trim() || '';
    const updatedBefore = c.req.query('updatedBefore')?.trim() || '';

    log.debug('Conversation Handler filter params', { tagIds, searchQuery });

    const visibleConversationIds = await PermissionService.getVisibleConversations(user.id, c.env.DB);

    log.debug('Conversation Handler visible conversations', { count: visibleConversationIds.length });

    // 如果沒有可見對話，返回空列表
    if (visibleConversationIds.length === 0) {
      log.debug('Conversation Handler no visible conversations found');
      return c.json({
        success: true,
        data: [],
        timestamp: nowISO()
      });
    }

    // FIX: 使用完整 JOIN 查詢，返回嵌套對象結構 (統一類型定義)
    log.debug('Conversation Handler querying conversation data');
    const drizzleDb = createDbClient(c.env.DB);

    // 如果有標籤篩選，先獲取有這些標籤的對話 ID
    // 同時檢查 conversation_tags（對話標籤）和 customer_tags（客戶標籤）
    let filteredConversationIds = visibleConversationIds;
    if (tagIds.length > 0) {
      // 1. 直接在 conversation_tags 上有標籤的對話
      const directTagged = await drizzleDb
        .selectDistinct({ conversationId: conversationTags.conversationId })
        .from(conversationTags)
        .where(
          and(
            inArray(conversationTags.conversationId, visibleConversationIds),
            inArray(conversationTags.tagId, tagIds)
          )
        );

      // 2. 透過客戶標籤關聯的對話（客戶被打標籤 → 該客戶的對話也應匹配）
      const customerTagged = await drizzleDb
        .selectDistinct({ conversationId: conversations.id })
        .from(conversations)
        .innerJoin(customerTags, eq(conversations.customerId, customerTags.customerId))
        .where(
          and(
            inArray(conversations.id, visibleConversationIds),
            inArray(customerTags.tagId, tagIds)
          )
        );

      // 合併兩者（去重）
      const allMatchedIds = new Set([
        ...directTagged.map(tc => tc.conversationId),
        ...customerTagged.map(tc => tc.conversationId)
      ]);
      filteredConversationIds = [...allMatchedIds];

      log.debug('Conversation Handler filtered by tags', {
        originalCount: visibleConversationIds.length,
        directTaggedCount: directTagged.length,
        customerTaggedCount: customerTagged.length,
        filteredCount: filteredConversationIds.length,
        tagIds
      });

      // 如果篩選後沒有對話，返回空列表
      if (filteredConversationIds.length === 0) {
        return c.json({
          success: true,
          data: [],
          timestamp: nowISO()
        });
      }
    }

    // 如果有搜尋關鍵字，篩選匹配客戶名稱的對話
    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      const matchedConversations = await drizzleDb
        .select({ id: conversations.id })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(
          and(
            inArray(conversations.id, filteredConversationIds),
            like(customers.displayName, searchPattern)
          )
        );
      filteredConversationIds = matchedConversations.map(c => c.id);

      log.debug('Conversation Handler filtered by search', {
        searchQuery,
        filteredCount: filteredConversationIds.length
      });

      if (filteredConversationIds.length === 0) {
        return c.json({
          success: true,
          data: [],
          timestamp: nowISO()
        });
      }
    }

    const conversationResults = await drizzleDb
      .select()
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(and(
        inArray(conversations.id, filteredConversationIds),
        ...(customerNameQuery ? [sql`${customers.displayName} LIKE ${'%' + customerNameQuery + '%'}`] : []),
        ...(updatedAfter ? [sql`${conversations.updatedAt} >= ${updatedAfter}`] : []),
        ...(updatedBefore ? [sql`${conversations.updatedAt} <= ${updatedBefore}`] : [])
      ))
      .orderBy(desc(conversations.updatedAt));

    // 構建完整的對話對象數組，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData = conversationResults.map(result => ({
      ...result.conversations,
      // 完整的 customer 對象 (匹配前端類型定義)
      customer: result.customers ? {
        id: result.customers.id,
        name: result.customers.displayName, //  映射到 name 字段
        displayName: result.customers.displayName, // 保留向後兼容
        platform: result.customers.platform,
        platformUserId: result.customers.platformUserId,
        avatarUrl: result.customers.avatarUrl,
        createdAt: result.customers.createdAt
      } : undefined,
      // 完整的 assignedTeam 對象
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

    // Phase B: 直接 DB 查詢獲取最新訊息（移除 KV 快取層以保證數據一致性）
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
      // D1 enforces a hard cap of 100 bound parameters per query.
      // The previous implementation bound conversationIds TWICE (once for
      // the subquery and once for a redundant outer WHERE), which pushed
      // the system over the limit at 51 conversations — every conversation
      // then showed "暫無訊息" in the list view because the query threw
      // and the catch below silently swallowed the failure.
      //
      // Fix:
      //   (A) Remove the redundant outer WHERE — the INNER JOIN with the
      //       subquery already restricts m.conversation_id to IDs in the
      //       IN list, so the outer filter was logically a no-op.
      //   (B) Chunk the IDs so each query stays well under the 100 cap
      //       regardless of how many conversations the caller can see.
      //
      // CHUNK_SIZE=90 leaves a safety margin under 100 while keeping the
      // number of round trips minimal (e.g. 1 query for N=90, 2 for N=180).
      const CHUNK_SIZE = 90;

      for (let offset = 0; offset < conversationIds.length; offset += CHUNK_SIZE) {
        const chunk = conversationIds.slice(offset, offset + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
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
        `;

        try {
          const result = await c.env.DB.prepare(latestMessagesQuery)
            .bind(...chunk)
            .all();

          if (result.results) {
            for (const row of result.results as unknown as ConversationListLatestMessageRow[]) {
              lastMessagesMap.set(row.conversationId, {
                messageId: row.messageId,
                content: row.content,
                createdAt: row.createdAt,
                senderType: row.senderType,
                messageType: row.messageType
              });
            }
          }
        } catch (dbError) {
          // Defense in depth: write directly to console.error in addition
          // to log.error, so the failure is visible even if the structured
          // logger misbehaves (as it did during the 2026-04-14 incident
          // where enableConsole=false hid the error for weeks).
          const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
          console.error(
            `[ConversationQueries] Latest-messages query failed ` +
            `(chunk ${offset}-${offset + chunk.length}, size ${chunk.length}): ${errMsg}`
          );
          log.error('Conversation Handler failed to fetch latest messages', {
            chunkStart: offset,
            chunkSize: chunk.length,
            totalCount: conversationIds.length,
            error: errMsg
          });
          // Continue processing remaining chunks — partial results are
          // strictly better than dropping every conversation's lastMessage.
        }
      }

      log.debug('Conversation Handler fetched latest messages from DB', {
        requestedCount: conversationIds.length,
        foundCount: lastMessagesMap.size
      });
    }

    // Batch query: count unread customer messages per conversation
    // "Unread" = customer messages after MAX(last_agent_reply, last_read_at)
    let unreadCountMap = new Map<string, number>();

    if (conversationIds.length > 0) {
      const unreadPlaceholders = conversationIds.map(() => '?').join(',');
      const unreadCountQuery = `
        SELECT
          m.conversation_id as conversationId,
          COUNT(*) as unreadCount
        FROM messages m
        WHERE m.conversation_id IN (${unreadPlaceholders})
          AND m.sender_type = 'customer'
          AND m.deleted_at IS NULL
          AND m.created_at > MAX(
            COALESCE(
              (SELECT MAX(m2.created_at) FROM messages m2
               WHERE m2.conversation_id = m.conversation_id
               AND m2.sender_type IN ('agent', 'system')
               AND m2.deleted_at IS NULL),
              '1970-01-01'
            ),
            COALESCE(
              (SELECT last_read_at FROM conversations WHERE id = m.conversation_id),
              '1970-01-01'
            )
          )
        GROUP BY m.conversation_id
      `;

      try {
        const unreadResult = await c.env.DB.prepare(unreadCountQuery)
          .bind(...conversationIds)
          .all();

        if (unreadResult.results) {
          for (const row of unreadResult.results as unknown as ConversationUnreadCountRow[]) {
            unreadCountMap.set(row.conversationId, Number(row.unreadCount));
          }
        }
      } catch (unreadError) {
        log.warn('Failed to fetch unread counts', {
          error: unreadError instanceof Error ? unreadError.message : String(unreadError)
        });
        // Continue with empty map — unreadCount will default to 0
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
        lastMessageType: lastMsg?.messageType || null,
        // Unread count: customer messages awaiting agent response
        unreadCount: unreadCountMap.get(conv.id) || 0
      };
    });

    return c.json({
      success: true,
      data: combinedData,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationQueriesHandler;
