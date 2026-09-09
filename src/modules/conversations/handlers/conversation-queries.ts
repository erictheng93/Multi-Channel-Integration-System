// 對話查詢處理器
// Handles: GET /:id (conversation detail), GET / (conversation list)

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq, desc, and, like, sql, count } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, customers, teams } from '@/db/schema';
import type { Bindings } from '@/types';
import { PermissionService } from '@/services/permission-service';
import {
  getConversationVisibilityCondition,
  getConversationVisibilitySql
} from '@/services/conversation-visibility';
import { jwtAuth } from '@/middleware/auth';
import { createContextLogger } from '@/utils/logger';
import { getDisplayContent } from '../utils/message-helpers';
import { nowISO } from '@/utils/timestamp'
import { conversationContracts, type ConversationStats } from '@shared/api-contracts/conversations';
import { contractJson } from '@/utils/api-contract-response';

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
  // 1 when this agent has manually flagged the conversation unread
  // (conversation_read_states.marked_unread_at IS NOT NULL).
  manuallyUnread: number | string | null;
}

// Per-agent unread state for one conversation, as returned by the batch query.
interface ConversationUnreadState {
  unreadCount: number;
  manuallyUnread: boolean;
}

// Applies the manual unread override: a conversation an agent flagged unread
// stays unread even when the derived count is 0 (the agent sent the last
// message). Shared by the list, detail and stats paths so the three cannot
// drift apart.
function applyManualUnreadFloor(derivedUnreadCount: number, manuallyUnread: boolean): number {
  return manuallyUnread ? Math.max(derivedUnreadCount, 1) : derivedUnreadCount;
}

interface ConversationStatsAggregateRow {
  total: number | string | null;
  active: number | string | null;
  assigned: number | string | null;
  pending: number | string | null;
}

interface ConversationUnreadAggregateRow {
  unreadCount: number | string | null;
}

const D1_SAFE_ID_CHUNK_SIZE = 90;

// Per-agent unread counts for a chunk of conversations.
//
// Read state is scoped to one agent via conversation_read_states, so the same
// conversation can be unread for one agent and read for another. The
// last-agent-reply half of the threshold stays global on purpose (decision
// A-1, Migration 0060): a customer message answered by anyone counts as
// handled for everyone.
//
// Binding order is positional: every conversation id first, then the agent id.
// Use `bind(...conversationIds, agentId)`. D1 caps bound parameters at 100 and
// callers chunk ids at D1_SAFE_ID_CHUNK_SIZE (90), leaving room for the agent.
//
// Returns one row per conversation in the chunk — including conversations with
// no unread messages — because `manuallyUnread` has to reach the caller even
// when the derived count is 0.
export function createConversationUnreadCountQuery(conversationIds: string[]): string {
  const unreadValueTuples = conversationIds.map(() => '(?)').join(',');
  return `
        WITH ids(id) AS (VALUES ${unreadValueTuples})
        SELECT
          threshold.id as conversationId,
          threshold.manuallyUnread as manuallyUnread,
          COUNT(customer_message.id) as unreadCount
        FROM (
          SELECT
            c.id as id,
            CASE WHEN rs.marked_unread_at IS NOT NULL THEN 1 ELSE 0 END as manuallyUnread,
            MAX(
              COALESCE(la.last_agent_at, '1970-01-01'),
              COALESCE(rs.last_read_at, '1970-01-01')
            ) as unread_threshold
          FROM conversations c
          LEFT JOIN conversation_read_states rs
            ON rs.conversation_id = c.id
            AND rs.agent_id = ?
          LEFT JOIN (
            SELECT conversation_id, MAX(created_at) as last_agent_at
            FROM messages
            WHERE conversation_id IN (SELECT id FROM ids)
              AND sender_type IN ('agent', 'system')
              AND deleted_at IS NULL
            GROUP BY conversation_id
          ) la ON la.conversation_id = c.id
          WHERE c.id IN (SELECT id FROM ids)
        ) AS threshold
        LEFT JOIN messages AS customer_message
          ON customer_message.conversation_id = threshold.id
          AND customer_message.sender_type = 'customer'
          AND customer_message.deleted_at IS NULL
          AND customer_message.created_at > threshold.unread_threshold
        GROUP BY threshold.id, threshold.manuallyUnread
      `;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPageSize(pageSize: number): number {
  return Math.min(Math.max(pageSize, 1), D1_SAFE_ID_CHUNK_SIZE);
}

function createEmptyConversationStats(): ConversationStats {
  return {
    total: 0,
    active: 0,
    assigned: 0,
    pending: 0,
    unreadCount: 0
  };
}

function toCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

const conversationQueriesHandler = new Hono<{ Bindings: Bindings }>();

// ==================== Priority 3: STATIC routes ====================

// 獲取用戶可見對話統計
conversationQueriesHandler.get('/stats', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const visibility = getConversationVisibilitySql(user, 'assigned_team_id');
    const stats = createEmptyConversationStats();

    const aggregateRow = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
        COALESCE(SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END), 0) as assigned,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending
      FROM conversations
      WHERE ${visibility.clause}
    `).bind(...visibility.params).first<ConversationStatsAggregateRow>();

    stats.total = toCount(aggregateRow?.total);
    stats.active = toCount(aggregateRow?.active);
    stats.assigned = toCount(aggregateRow?.assigned);
    stats.pending = toCount(aggregateRow?.pending);

    // Read state is per-agent (Migration 0060): join this agent's row so the
    // badge total reflects what THIS agent has yet to read. The
    // last-agent-reply term below stays global by design (decision A-1).
    const unreadRow = await c.env.DB.prepare(`
      WITH visible AS (
        SELECT
          conversation.id AS id,
          read_state.last_read_at AS last_read_at,
          read_state.marked_unread_at AS marked_unread_at
        FROM conversations AS conversation
        LEFT JOIN conversation_read_states AS read_state
          ON read_state.conversation_id = conversation.id
          AND read_state.agent_id = ?
        WHERE ${visibility.clause}
      )
      SELECT COALESCE(SUM(
        CASE WHEN per.manuallyUnread = 1 AND per.unreadCount = 0
          THEN 1 ELSE per.unreadCount END
      ), 0) as unreadCount
      FROM (
        SELECT
          threshold.id,
          threshold.manuallyUnread,
          COUNT(customer_message.id) as unreadCount
        FROM (
          SELECT
            visible.id,
            CASE WHEN visible.marked_unread_at IS NOT NULL THEN 1 ELSE 0 END as manuallyUnread,
            MAX(
              COALESCE(last_agent.last_agent_at, '1970-01-01'),
              COALESCE(visible.last_read_at, '1970-01-01')
            ) as unread_threshold
          FROM visible
          LEFT JOIN (
            SELECT message.conversation_id, MAX(message.created_at) as last_agent_at
            FROM messages AS message
            INNER JOIN visible ON visible.id = message.conversation_id
            WHERE message.sender_type IN ('agent', 'system')
              AND message.deleted_at IS NULL
            GROUP BY message.conversation_id
          ) AS last_agent ON last_agent.conversation_id = visible.id
        ) AS threshold
        LEFT JOIN messages AS customer_message
          ON customer_message.conversation_id = threshold.id
          AND customer_message.sender_type = 'customer'
          AND customer_message.deleted_at IS NULL
          AND customer_message.created_at > threshold.unread_threshold
        GROUP BY threshold.id, threshold.manuallyUnread
      ) AS per
    `).bind(user.id, ...visibility.params).first<ConversationUnreadAggregateRow>();

    stats.unreadCount = toCount(unreadRow?.unreadCount);

    return contractJson(c, conversationContracts.stats, {
      success: true,
      data: stats,
      timestamp: nowISO()
    });


  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

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

    // Query unread count for this conversation, for the requesting agent only.
    // "Unread" = customer messages after
    // MAX(last_agent_reply, this agent's last_read_at).
    let unreadCount = 0;
    // Per-agent manual unread override (Migration 0060). Read separately from
    // the count so a failure in either query cannot silently zero the other.
    let manuallyUnread = false;
    try {
      const readStateRow = await c.env.DB.prepare(`
        SELECT marked_unread_at
        FROM conversation_read_states
        WHERE conversation_id = ? AND agent_id = ?
      `).bind(conversationId, user.id).first<{ marked_unread_at: string | null }>();

      manuallyUnread = Boolean(readStateRow?.marked_unread_at);
    } catch (readStateError) {
      log.warn('Failed to fetch per-agent read state', { conversationId, error: readStateError });
    }

    try {
      // Threshold subqueries reference the bound id (not m.conversation_id) so
      // they are uncorrelated and evaluated once, not per message row.
      const unreadResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as unreadCount
        FROM messages m
        WHERE m.conversation_id = ?
          AND m.sender_type = 'customer'
          AND m.deleted_at IS NULL
          AND m.created_at > MAX(
            COALESCE(
              (SELECT MAX(m2.created_at) FROM messages m2
               WHERE m2.conversation_id = ?
               AND m2.sender_type IN ('agent', 'system')
               AND m2.deleted_at IS NULL),
              '1970-01-01'
            ),
            COALESCE(
              (SELECT last_read_at FROM conversation_read_states
               WHERE conversation_id = ? AND agent_id = ?),
              '1970-01-01'
            )
          )
      `).bind(conversationId, conversationId, conversationId, user.id).first<UnreadCountRow>();

      if (unreadResult) {
        unreadCount = Number(unreadResult.unreadCount) || 0;
      }
    } catch (unreadError) {
      log.warn('Failed to fetch unread count for conversation', { conversationId, error: unreadError });
    }

    // Manual unread override: floor the effective count at 1 so a conversation
    // this agent marked unread stays unread even when an agent sent the last
    // message (derived count 0). Cleared by mark-as-read.
    unreadCount = applyManualUnreadFloor(unreadCount, manuallyUnread);

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
    const hasPaginationParams = c.req.query('page') !== undefined || c.req.query('pageSize') !== undefined;
    const page = parsePositiveInt(c.req.query('page'), 1);
    const pageSize = clampPageSize(parsePositiveInt(c.req.query('pageSize'), 20));
    const statusQuery = c.req.query('status')?.trim() || '';
    const platformQuery = c.req.query('platform')?.trim() || '';
    const teamIdParam = c.req.query('teamId');
    const teamIdQuery = teamIdParam ? Number.parseInt(teamIdParam, 10) : undefined;

    const customerNameQuery = c.req.query('customerName')?.trim() || '';
    const updatedAfter = c.req.query('updatedAfter')?.trim() || '';
    const updatedBefore = c.req.query('updatedBefore')?.trim() || '';

    log.debug('Conversation Handler filter params', { tagIds, searchQuery });

    const drizzleDb = createDbClient(c.env.DB);
    const listConditions = [
      getConversationVisibilityCondition(user),
      ...(tagIds.length > 0
        ? [sql`(
            EXISTS (
              SELECT 1
              FROM conversation_tags AS direct_tag
              WHERE direct_tag.conversation_id = ${conversations.id}
                AND direct_tag.tag_id IN (
                  SELECT value FROM json_each(${JSON.stringify(tagIds)})
                )
            )
            OR EXISTS (
              SELECT 1
              FROM customer_tags AS customer_tag
              WHERE customer_tag.customer_id = ${conversations.customerId}
                AND customer_tag.tag_id IN (
                  SELECT value FROM json_each(${JSON.stringify(tagIds)})
                )
            )
          )`]
        : []),
      ...(searchQuery ? [like(customers.displayName, `%${searchQuery}%`)] : []),
      ...(customerNameQuery
        ? [sql`${customers.displayName} LIKE ${'%' + customerNameQuery + '%'}`]
        : []),
      ...(updatedAfter ? [sql`${conversations.updatedAt} >= ${updatedAfter}`] : []),
      ...(updatedBefore ? [sql`${conversations.updatedAt} <= ${updatedBefore}`] : []),
      ...(statusQuery ? [sql`${conversations.status} = ${statusQuery}`] : []),
      ...(platformQuery ? [sql`${customers.platform} = ${platformQuery}`] : []),
      ...(teamIdQuery !== undefined && Number.isFinite(teamIdQuery)
        ? [sql`${conversations.assignedTeamId} = ${teamIdQuery}`]
        : [])
    ];

    const listFilter = and(...listConditions);

    // Pagination is pushed into SQL rather than applied with Array.slice() on a
    // full fetch (issue #23). The LIMIT only pays off because
    // idx_conversations_updated_at (migration 0061) lets SQLite satisfy the
    // ORDER BY by walking the index: without it the planner adds
    // "USE TEMP B-TREE FOR ORDER BY", which reads and sorts every visible row
    // before the LIMIT can discard any of them.
    const listQuery = drizzleDb
      .select()
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(listFilter)
      // id breaks ties so a row cannot repeat or vanish across page boundaries
      // when several conversations share an updatedAt.
      .orderBy(desc(conversations.updatedAt), desc(conversations.id));

    let total: number;
    let pagedConversationResults: Awaited<typeof listQuery>;

    if (hasPaginationParams) {
      // total can no longer come from .length, so it is its own COUNT over the
      // same predicate. customers is joined only when a filter actually reads
      // it — teams never is — so the common unfiltered count stays a single
      // index scan instead of 253 join lookups.
      const countNeedsCustomers = Boolean(searchQuery || customerNameQuery || platformQuery);
      const countBase = drizzleDb.select({ value: count() }).from(conversations);
      const countQuery = countNeedsCustomers
        ? countBase.leftJoin(customers, eq(conversations.customerId, customers.id))
        : countBase;
      const [countRow] = await countQuery.where(listFilter);

      total = Number(countRow?.value ?? 0);
      pagedConversationResults = await listQuery.limit(pageSize).offset((page - 1) * pageSize);
    } else {
      pagedConversationResults = await listQuery;
      total = pagedConversationResults.length;
    }

    log.debug('Conversation Handler query completed', {
      matchedCount: total,
      returnedCount: pagedConversationResults.length
    });


    // 構建完整的對話對象數組，包含嵌套的 customer 和 assignedTeam 對象
    const conversationData = pagedConversationResults.map(result => ({
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
      // D1_SAFE_ID_CHUNK_SIZE=90 leaves a safety margin under 100 while keeping the
      // number of round trips minimal (e.g. 1 query for N=90, 2 for N=180).

      for (let offset = 0; offset < conversationIds.length; offset += D1_SAFE_ID_CHUNK_SIZE) {
        const chunk = conversationIds.slice(offset, offset + D1_SAFE_ID_CHUNK_SIZE);
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

    // Batch query: count unread customer messages per conversation, for THIS
    // agent. "Unread" = customer messages after
    // MAX(last_agent_reply, this agent's last_read_at).
    let unreadStateMap = new Map<string, ConversationUnreadState>();

    if (conversationIds.length > 0) {
      for (let offset = 0; offset < conversationIds.length; offset += D1_SAFE_ID_CHUNK_SIZE) {
        const chunk = conversationIds.slice(offset, offset + D1_SAFE_ID_CHUNK_SIZE);
        // Threshold MUST be computed once per conversation via the derived table.
        // A correlated subquery in the WHERE clause is re-evaluated per candidate
        // row (O(n^2) rows read) and caused a D1 billing incident (2026-07):
        // ~2.2M rows scanned per run on a 3.7k-row table.
        // The ids CTE lets the chunk be referenced twice while binding each id
        // once — D1 caps bound parameters at 100 per query.
        const unreadCountQuery = createConversationUnreadCountQuery(chunk);

      try {
        // Binding order matches the query: chunk ids first, then the agent id
        // that scopes conversation_read_states.
        const unreadResult = await c.env.DB.prepare(unreadCountQuery)
          .bind(...chunk, user.id)
          .all();

        if (unreadResult.results) {
          for (const row of unreadResult.results as unknown as ConversationUnreadCountRow[]) {
            unreadStateMap.set(row.conversationId, {
              unreadCount: Number(row.unreadCount) || 0,
              manuallyUnread: Number(row.manuallyUnread) === 1
            });
          }
        }
      } catch (unreadError) {
        log.warn('Failed to fetch unread counts', {
          chunkStart: offset,
          chunkSize: chunk.length,
          totalCount: conversationIds.length,
          error: unreadError instanceof Error ? unreadError.message : String(unreadError)
        });
        // Continue with empty map — unreadCount will default to 0
      }
      }
    }

    // 結合數據并統一為camelCase格式
    const combinedData = conversationData.map(conv => {
      const lastMsg = lastMessagesMap.get(conv.id);
      const displayContent = lastMsg ? getDisplayContent(lastMsg.content, lastMsg.messageType) : null;
      const unreadState = unreadStateMap.get(conv.id);
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
        // Unread count for the requesting agent only: customer messages
        // awaiting a reply that this agent has not read. The manual unread
        // override floors the count at 1 so mark-as-unread persists even after
        // an agent replied last.
        unreadCount: applyManualUnreadFloor(
          unreadState?.unreadCount ?? 0,
          unreadState?.manuallyUnread ?? false
        )
      };
    });

    const responseData = hasPaginationParams
      ? {
        items: combinedData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total
      }
      : combinedData;

    return c.json({
      success: true,
      data: responseData,
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationQueriesHandler;
