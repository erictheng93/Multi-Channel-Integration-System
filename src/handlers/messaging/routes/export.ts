// Messaging Export Routes
// 訊息匯出功能端點

import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { createDbClient } from '../../../db/drizzle-factory';
import type { Bindings, JWTPayload } from '../../../types';
import { messages, agents, customers } from '@shared/database/schema';
import { jwtAuth } from '../../../middleware/auth';

const exportRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 匯出訊息 (JSON/CSV)
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
    const limit = Math.min(1000, parseInt(c.req.query('limit') || '100'));

    // 驗證格式
    if (!['json', 'csv'].includes(format)) {
      return c.json({
        success: false,
        error: 'Invalid format. Must be "json" or "csv"',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 構建查詢條件
    const whereConditions: any[] = [eq(messages.isRecalled, false)];

    if (conversationId) {
      whereConditions.push(eq(messages.conversationId, conversationId));
    }

    // 獲取訊息列表
    const messageList = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
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
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .where(and(...whereConditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    if (format === 'json') {
      return c.json({
        success: true,
        data: {
          messages: messageList.map(msg => ({
            id: msg.id,
            conversationId: msg.conversationId,
            senderType: msg.senderType,
            senderName: msg.senderType === 'agent' ? msg.agentName : msg.customerName,
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
            exportedAt: new Date().toISOString(),
            exportedBy: userPayload.userId.toString(),
            filters: {
              conversationId,
              dateFrom,
              dateTo,
              limit
            }
          }
        },
        timestamp: new Date().toISOString()
      });

    } else {
      // CSV格式匯出
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
        const senderName = msg.senderType === 'agent' ? msg.agentName : msg.customerName;
        return [
          msg.id,
          msg.conversationId,
          msg.senderType,
          senderName || '',
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
          'Content-Disposition': `attachment; filename="messages_export_${Date.now()}.csv"`
        }
      });
    }

  } catch (error) {
    console.error('Export messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default exportRoutes;
