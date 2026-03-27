// Messaging Export Routes
// 訊息匯出功能端點

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { eq, and, desc, gte, lte, count, isNull } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings, JWTPayload } from '@/types';
import { messages, conversations, agents, customers } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import { BULK_OPERATION_LIMITS } from '@/constants/limits';
import { nowISO, nowMs } from '@/utils/timestamp'

const EXPORT_LIMIT = BULK_OPERATION_LIMITS.EXPORT_MAX_RECORDS;

const exportRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 取得匯出篩選選項 - 客戶列表
 * GET /api/messages/export/customers
 */
exportRoutes.get('/export/customers', jwtAuth, async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    const customerList = await db
      .select({
        id: customers.id,
        displayName: customers.displayName,
        platform: customers.platform,
        platformUserId: customers.platformUserId
      })
      .from(customers)
      .where(isNull(customers.deletedAt))
      .orderBy(customers.displayName)
      .limit(200);

    return c.json({
      success: true,
      data: customerList,
      timestamp: nowISO()
    });
  } catch (error) {
    console.error('Get export customers error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get customers',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 取得匯出篩選選項 - 客服列表
 * GET /api/messages/export/agents
 */
exportRoutes.get('/export/agents', jwtAuth, async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    const agentList = await db
      .select({
        id: agents.id,
        displayName: agents.displayName,
        role: agents.role
      })
      .from(agents)
      .where(eq(agents.isActive, true))
      .orderBy(agents.displayName)
      .limit(200);

    return c.json({
      success: true,
      data: agentList,
      timestamp: nowISO()
    });
  } catch (error) {
    console.error('Get export agents error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get agents',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 匯出記錄計數（輕量查詢）
 * GET /api/messages/export/count
 * 回傳符合篩選條件的訊息數量，用於前端匯出前確認
 */
exportRoutes.get('/export/count', jwtAuth, async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    const conversationId = c.req.query('conversationId');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const customerId = c.req.query('customerId');
    const agentId = c.req.query('agentId');

    const whereConditions: any[] = [
      eq(messages.isRecalled, false)
    ];

    if (conversationId) {
      whereConditions.push(eq(messages.conversationId, conversationId));
    }

    if (dateFrom) {
      whereConditions.push(gte(messages.createdAt, dateFrom));
    }
    if (dateTo) {
      whereConditions.push(lte(messages.createdAt, dateTo));
    }

    if (customerId) {
      whereConditions.push(eq(conversations.customerId, parseInt(customerId)));
    }

    if (agentId) {
      whereConditions.push(eq(messages.agentSenderId, agentId));
    }

    const result = await db
      .select({ value: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(...whereConditions));

    const totalCount = result[0]?.value ?? 0;
    const limit = EXPORT_LIMIT;

    return c.json({
      success: true,
      data: {
        count: totalCount,
        limit,
        willBeTruncated: totalCount > limit
      },
      timestamp: nowISO()
    });
  } catch (error) {
    console.error('Export count error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get export count',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * 匯出訊息 (JSON/CSV/TXT)
 * GET /api/messages/export
 */
exportRoutes.get('/export', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    // 取得查詢參數
    const format = c.req.query('format') || 'json';
    const conversationId = c.req.query('conversationId');
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const customerId = c.req.query('customerId');
    const agentId = c.req.query('agentId');
    const limit = Math.min(EXPORT_LIMIT, parseInt(c.req.query('limit') || '100'));

    // 驗證格式
    if (!['json', 'csv', 'txt'].includes(format)) {
      return c.json({
        success: false,
        error: 'Invalid format. Must be "json", "csv", or "txt"',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // 構建查詢條件
    const whereConditions: any[] = [
      eq(messages.isRecalled, false)
    ];

    if (conversationId) {
      whereConditions.push(eq(messages.conversationId, conversationId));
    }

    // 日期篩選
    if (dateFrom) {
      whereConditions.push(gte(messages.createdAt, dateFrom));
    }
    if (dateTo) {
      whereConditions.push(lte(messages.createdAt, dateTo));
    }

    // 客戶篩選
    if (customerId) {
      whereConditions.push(eq(conversations.customerId, parseInt(customerId)));
    }

    // 客服人員篩選
    if (agentId) {
      whereConditions.push(eq(messages.agentSenderId, agentId));
    }

    // 獲取訊息列表
    const messageList = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        senderName: messages.senderName,
        content: messages.content,
        messageType: messages.messageType,
        sentAt: messages.sentAt,
        deliveryStatus: messages.deliveryStatus,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        agentName: agents.displayName,
        customerName: customers.displayName
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .where(and(...whereConditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // 取得發送者名稱（優先使用持久化的 senderName）
    const getSenderName = (msg: typeof messageList[0]): string => {
      if (msg.senderName) return msg.senderName;
      return msg.senderType === 'agent' ? (msg.agentName || '') : (msg.customerName || '');
    };

    if (format === 'json') {
      return c.json({
        success: true,
        data: {
          messages: messageList.map(msg => ({
            id: msg.id,
            conversationId: msg.conversationId,
            senderType: msg.senderType,
            senderName: getSenderName(msg),
            content: msg.content,
            messageType: msg.messageType,
            sentAt: msg.sentAt,
            deliveryStatus: msg.deliveryStatus,
            metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
            createdAt: msg.createdAt
          })),
          exportInfo: {
            format: 'json',
            totalRecords: messageList.length,
            exportedAt: nowISO(),
            exportedBy: userPayload.userId.toString(),
            filters: {
              conversationId,
              dateFrom,
              dateTo,
              customerId,
              agentId,
              limit
            }
          }
        },
        timestamp: nowISO()
      });

    } else if (format === 'csv') {
      const csvHeaders = [
        'Message ID',
        'Conversation ID',
        'Sender Type',
        'Sender Name',
        'Content',
        'Message Type',
        'Sent At',
        'Delivery Status',
        'Created At'
      ].join(',');

      const csvRows = messageList.map(msg => {
        return [
          msg.id,
          msg.conversationId,
          msg.senderType,
          `"${(getSenderName(msg)).replace(/"/g, '""')}"`,
          `"${msg.content.replace(/"/g, '""')}"`,
          msg.messageType,
          msg.sentAt || '',
          msg.deliveryStatus || '',
          msg.createdAt || ''
        ].join(',');
      });

      const csvContent = [csvHeaders, ...csvRows].join('\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="messages_export_${nowMs()}.csv"`
        }
      });

    } else {
      // TXT 純文字格式匯出
      const lines: string[] = [];

      lines.push('========================================');
      lines.push('  對話記錄匯出');
      lines.push('========================================');
      lines.push(`匯出時間: ${nowISO()}`);
      lines.push(`總筆數: ${messageList.length}`);
      if (conversationId) lines.push(`對話 ID: ${conversationId}`);
      if (dateFrom) lines.push(`起始日期: ${dateFrom}`);
      if (dateTo) lines.push(`結束日期: ${dateTo}`);
      if (customerId) lines.push(`客戶 ID: ${customerId}`);
      if (agentId) lines.push(`客服 ID: ${agentId}`);
      lines.push('========================================');
      lines.push('');

      // 按 conversationId 分組
      const grouped = new Map<string, typeof messageList>();
      for (const msg of messageList) {
        const convId = msg.conversationId;
        if (!grouped.has(convId)) {
          grouped.set(convId, []);
        }
        grouped.get(convId)!.push(msg);
      }

      for (const [convId, convMessages] of grouped) {
        lines.push(`--- 對話: ${convId} ---`);
        lines.push('');

        const sorted = [...convMessages].sort((a, b) =>
          (a.createdAt || '').localeCompare(b.createdAt || '')
        );

        for (const msg of sorted) {
          const time = msg.createdAt
            ? new Date(msg.createdAt).toLocaleString('zh-TW', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
              })
            : '未知時間';
          const name = getSenderName(msg) || msg.senderType || '未知';
          lines.push(`[${time}] ${name}: ${msg.content}`);
        }

        lines.push('');
      }

      const txtContent = lines.join('\n');

      return new Response(txtContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="chat_export_${nowMs()}.txt"`
        }
      });
    }

  } catch (error) {
    console.error('Export messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export messages',
      timestamp: nowISO()
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

export default exportRoutes;
