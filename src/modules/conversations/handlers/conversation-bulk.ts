// 對話批量操作處理器
// Handles: POST /bulk (assign, close, reopen, set_priority, add_tags, remove_tags)

import { Hono } from 'hono';
import { inArray, and, sql } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations, conversationTags } from '@/db/schema';
import type { Bindings } from '@/types';
import { getConversationVisibilitySql } from '@/services/conversation-visibility';
import { jwtAuth } from '@/middleware/auth';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { successResponse, errorResponse, validationErrorResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('ConversationBulkHandler');

const D1_MAX_BOUND_PARAMETERS = 100;
const D1_SAFE_BOUND_PARAMETERS = 90;

function getSafeIdChunkSize(extraBoundParams = 0): number {
  return Math.max(
    1,
    Math.min(D1_SAFE_BOUND_PARAMETERS, D1_MAX_BOUND_PARAMETERS - extraBoundParams)
  );
}

function getSafeInsertBatchSize(paramsPerRow: number): number {
  return Math.max(1, Math.floor(D1_SAFE_BOUND_PARAMETERS / paramsPerRow));
}

function chunkItems<T>(items: T[], chunkSize = D1_SAFE_BOUND_PARAMETERS): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += chunkSize) {
    chunks.push(items.slice(offset, offset + chunkSize));
  }
  return chunks;
}

const conversationBulkHandler = new Hono<{ Bindings: Bindings }>();

// 批量操作端點 - POST /bulk
// 支援操作: assign, close, reopen, set_priority, add_tags, remove_tags
// 優化版本：添加權限檢查、批量操作優化、WebSocket 廣播
conversationBulkHandler.post('/bulk', jwtAuth, async (c) => {
  const drizzleDb = createDbClient(c.env.DB);
  try {
    const { operation, conversationIds, data } = await c.req.json();
    const payload = c.get('jwtPayload');
    const user = c.get('user');

    // 驗證 conversationIds
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return validationErrorResponse(c, [
        { field: 'conversationIds', message: 'Conversation IDs array is required' }
      ]);
    }

    // 限制批量操作數量
    const conversationIdsArray = conversationIds as string[];

    // P1 優化：添加權限檢查 - 驗證用戶是否有權訪問這些對話
    const visibility = getConversationVisibilitySql(user, 'assigned_team_id');
    const authorizedIds = new Set<string>();

    for (const idChunk of chunkItems(
      conversationIdsArray,
      getSafeIdChunkSize(visibility.params.length)
    )) {
      const placeholders = idChunk.map(() => '?').join(',');
      const result = await c.env.DB.prepare(`
        SELECT id
        FROM conversations
        WHERE id IN (${placeholders})
          AND ${visibility.clause}
      `).bind(...idChunk, ...visibility.params).all<{ id: string }>();

      for (const row of result.results ?? []) {
        authorizedIds.add(row.id);
      }
    }

    const unauthorizedIds = conversationIdsArray.filter(id => !authorizedIds.has(id));

    if (unauthorizedIds.length > 0) {
      log.warn('User attempted to access unauthorized conversations', { userId: user.id, unauthorizedIds });
      return errorResponse(c, `Permission denied for ${unauthorizedIds.length} conversation(s). You can only perform bulk operations on conversations you have access to.`, 403);
    }

    // 用於追蹤標籤操作，以便後續 WebSocket 廣播
    let tagOperation: 'add' | 'remove' | null = null;
    let affectedTagIds: number[] = [];

    switch (operation) {
      case 'assign': {
        // Note: Individual assignment (userId) removed - only team assignment is supported now
        if (!data?.teamId) {
          return validationErrorResponse(c, [
            { field: 'data', message: 'Team ID is required for assignment' }
          ]);
        }

        for (const idChunk of chunkItems(conversationIdsArray, getSafeIdChunkSize(2))) {
          await drizzleDb.update(conversations)
            .set({
              assignedTeamId: data.teamId,
              status: 'assigned',
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversations.id, idChunk));
        }

        log.debug('Bulk Assign completed', { teamId: data.teamId, conversationCount: conversationIdsArray.length });
        break;
      }

      // Note: 'close' and 'reopen' bulk operations removed - closed status no longer exists

      case 'close':
      case 'reopen':
        return validationErrorResponse(c, [
          { field: 'operation', message: 'close/reopen operations are no longer supported' }
        ]);

      case 'set_priority':
        if (!data?.priority) {
          return validationErrorResponse(c, [
            { field: 'data.priority', message: 'Priority is required' }
          ]);
        }
        for (const idChunk of chunkItems(conversationIdsArray, getSafeIdChunkSize(1))) {
          await drizzleDb.update(conversations)
            .set({
              priority: data.priority,
              updatedAt: sql`datetime('now')`
            })
            .where(inArray(conversations.id, idChunk));
        }

        // Note: Individual agent notifications removed - only team-based assignment now
        // Priority change notifications can be handled via WebSocket broadcast to team members
        log.debug('Bulk priority change completed', {
          priority: data.priority,
          conversationCount: conversationIdsArray.length
        });
        break;

      case 'add_tags':
        if (!data?.tagIds || !Array.isArray(data.tagIds)) {
          return validationErrorResponse(c, [
            { field: 'data.tagIds', message: 'Tag IDs array is required' }
          ]);
        }

        // P2 優化：使用 Drizzle 批量插入（單條 SQL 語句）
        // 構建所有需要插入的值
        const tagInsertValues: { conversationId: string; tagId: number; assignedBy: string }[] = [];
        const parsedTagIds: number[] = data.tagIds.map((id: string | number) => parseInt(String(id)));

        for (const convId of conversationIdsArray) {
          for (const tagId of parsedTagIds) {
            tagInsertValues.push({
              conversationId: convId,
              tagId: tagId,
              assignedBy: payload?.userId ? String(payload.userId) : 'system'
            });
          }
        }

        // 使用 Drizzle 批量插入（每批最多 100 條記錄以避免 SQL 語句過長）
        const INSERT_PARAMS_PER_ROW = 3;
        const INSERT_BATCH_SIZE = getSafeInsertBatchSize(INSERT_PARAMS_PER_ROW);
        for (let i = 0; i < tagInsertValues.length; i += INSERT_BATCH_SIZE) {
          const batch = tagInsertValues.slice(i, i + INSERT_BATCH_SIZE);
          if (batch.length > 0) {
            // Drizzle 支持 values() 接受數組，生成單條 INSERT 語句
            await drizzleDb.insert(conversationTags)
              .values(batch)
              .onConflictDoNothing();
          }
        }

        log.info(`Inserted ${tagInsertValues.length} tag associations using batch insert`);

        // 記錄標籤操作以便 WebSocket 廣播
        tagOperation = 'add';
        affectedTagIds = parsedTagIds;
        break;

      case 'remove_tags':
        if (!data?.tagIds || !Array.isArray(data.tagIds)) {
          return validationErrorResponse(c, [
            { field: 'data.tagIds', message: 'Tag IDs array is required' }
          ]);
        }

        // P3 優化：使用單條 SQL 批量刪除（替代嵌套循環 + 順序 await）
        const tagIdsToRemove: number[] = data.tagIds.map((id: string | number) => parseInt(String(id)));

        for (const tagChunk of chunkItems(tagIdsToRemove, D1_SAFE_BOUND_PARAMETERS)) {
          const idChunkSize = getSafeIdChunkSize(tagChunk.length);
          for (const idChunk of chunkItems(conversationIdsArray, idChunkSize)) {
            await drizzleDb.delete(conversationTags)
              .where(
                and(
                  inArray(conversationTags.conversationId, idChunk),
                  inArray(conversationTags.tagId, tagChunk)
                )
              );
          }
        }

        log.info(`Removed tags from ${conversationIdsArray.length} conversations using chunked SQL`);

        // 記錄標籤操作以便 WebSocket 廣播
        tagOperation = 'remove';
        affectedTagIds = tagIdsToRemove;
        break;

      default:
        return validationErrorResponse(c, [
          { field: 'operation', message: `Invalid operation: ${operation}. Valid operations: assign, close, reopen, set_priority, add_tags, remove_tags` }
        ]);
    }

    // P4 優化：添加 WebSocket 廣播 - 通知其他用戶標籤變更
    if (tagOperation && affectedTagIds.length > 0) {
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);

        // 為每個受影響的對話廣播事件
        const broadcastPromises = conversationIdsArray.map(conversationId =>
          broadcastService.broadcastConversationEvent({
            type: 'conversation_status_changed',
            conversationId,
            userId: String(user.id),
            data: {
              changeType: 'tags_updated',
              tagOperation,
              tagIds: affectedTagIds,
              updatedBy: {
                id: user.id,
                name: user.displayName,
                role: user.role
              },
              timestamp: nowISO()
            },
            priority: 'normal'
          })
        );

        await Promise.allSettled(broadcastPromises);
        log.debug('WebSocket bulk tag broadcast completed', { tagOperation, conversationCount: conversationIdsArray.length });
      } catch (broadcastError) {
        log.warn('WebSocket: Bulk tag broadcast failed, continuing', { error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError) });
        // 不中斷主流程，廣播失敗不影響操作結果
      }
    }

    log.info('Conversations bulk operation completed', { operation, count: conversationIdsArray.length });
    return successResponse(c, {
      operation,
      affectedCount: conversationIdsArray.length,
      conversationIds: conversationIdsArray
    }, `Bulk ${operation} completed successfully`);

  } catch (error) {
    log.error('Conversations: Bulk operation error', { error: error instanceof Error ? error.message : String(error) });
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to perform bulk operation', 500);
  }
});

export default conversationBulkHandler;
