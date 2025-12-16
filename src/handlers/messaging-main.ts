// Messaging Main Handler - Full Featured Version
// 訊息主要處理器 - 功能完整版本

import { Hono } from 'hono';
import { eq, and, desc, count, isNull } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import type { Bindings, JWTPayload } from '../types';
import { messages, conversations, customers, agents, fileAttachments } from '@shared/database/schema';
import type { MessageSearchQuery } from '@modules/messaging/types/message-types';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import { jwtAuth } from '../middleware/auth';
// 🔔 @提及通知整合
import { parseMentions, getMentionedUserIds } from '../utils/mention-parser';
import { triggerMentionNotification } from '../utils/notification-trigger';

const app = new Hono<{ Bindings: Bindings }>();

// ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
// ✅ ROUTES REORDERED - All conflicts resolved following Hono's first-registered, first-matched priority
//
// CORRECTED ORDER (0 conflicts):
//   Priority 1: STATIC GET routes
//     - GET /health, /info, /search, /stats, /tags, /export
//   Priority 2: STATIC POST routes (specific paths)
//     - POST /bulk-create, /bulk-delete
//   Priority 3: SPECIFIC multi-segment GET
//     - GET /conversation/:conversationId
//   Priority 4: MULTI-SEGMENT with /:id prefix
//     - GET /:id/attachments
//     - POST /:id/attachments
//     - POST /:id/forward
//     - PUT /:id/tags
//   Priority 5: SINGLE PARAM
//     - GET /:id
//     - PUT /:id
//     - DELETE /:id
//   Priority 6: WILDCARD (registered LAST to avoid intercepting other routes)
//     - POST /
//
// Key fix: POST / moved to END to prevent intercepting POST /:id/attachments and POST /:id/forward
// ====================================================================================

// ======================== Health Check Routes ========================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'messaging',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'messaging',
      version: '2.0.0',
      status: 'operational',
      features: [
        'Message CRUD operations',
        'Conversation message listing',
        'Advanced search functionality',
        'Message statistics',
        'Real-time message support',
        'Bulk operations (create/delete)',
        'File attachment management',
        'Message forwarding',
        'Message tagging system',
        'Data export (JSON/CSV)'
      ],
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST / - Create new message',
        'GET /:id - Get message by ID',
        'PUT /:id - Update message',
        'DELETE /:id - Delete message',
        'GET /conversation/:conversationId - Get conversation messages',
        'GET /search - Search messages',
        'GET /stats - Message statistics',
        'POST /bulk-create - Bulk create messages',
        'POST /bulk-delete - Bulk delete messages',
        'GET /:id/attachments - Get message attachments',
        'POST /:id/attachments - Upload message attachment',
        'POST /:id/forward - Forward message to conversations',
        'PUT /:id/tags - Add/update message tags',
        'GET /tags - Get all available tags',
        'GET /export - Export messages (JSON/CSV)'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// ======================== Basic API Endpoints ========================
//
// ⚠️  ROUTE ORDERING NOTE:
// Due to file size (1895 lines) and complexity, routes are organized by functionality.
// However, for optimal routing, GET routes should follow this priority:
//   Priority 1: STATIC routes (/health, /info, /search, /stats, /tags, /export)
//   Priority 2: SPECIFIC multi-segment (/conversation/:conversationId, /:id/attachments)
//   Priority 3: PARAMETERIZED single-segment (/:id)
//
// TODO: Consider refactoring to group routes by HTTP method and priority
// Current conflicts (detection script warnings):
//   - GET /:id (line 510) registered before GET /conversation/:conversationId (line 892)
//   - GET /:id (line 510) registered before GET /:id/attachments (line 1365)
//
// These may not cause runtime issues in Hono due to smart matching, but should be
// verified through integration testing.
// ========================

/**
 * 創建新訊息
 * POST /api/messages
 */


app.get('/search', jwtAuth, async (c) => {
  try {
    const query = c.req.query('q') || '';
    const conversationId = c.req.query('conversationId');
    const messageType = c.req.query('messageType') as 'text' | 'image' | 'file' | 'sticker' | undefined;
    const senderType = c.req.query('senderType') as 'customer' | 'agent' | undefined;
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const isRecalled = c.req.query('isRecalled') === 'true' ? true : c.req.query('isRecalled') === 'false' ? false : undefined;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // 構建搜尋條件
    const searchQuery: MessageSearchQuery = {
      limit,
      offset
    };

    if (query) {
      searchQuery.content = query;
    }
    if (conversationId) {
      searchQuery.conversationId = conversationId;
    }
    if (messageType) {
      searchQuery.messageType = messageType;
    }
    if (senderType) {
      searchQuery.senderType = senderType;
    }
    if (dateFrom) {
      searchQuery.dateFrom = dateFrom;
    }
    if (dateTo) {
      searchQuery.dateTo = dateTo;
    }
    if (isRecalled !== undefined) {
      searchQuery.isRecalled = isRecalled;
    }

    // 使用 MessageCrudService 進行搜尋
    const messageCrudService = new MessageCrudService(c.env.DB);
    const searchResult = await messageCrudService.searchMessages(searchQuery);

    return c.json({
      success: true,
      data: searchResult,
      query: searchQuery,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Search messages error:', error);
    return c.json({
      success: false,
      error: 'Failed to search messages',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});


/**
 * 獲取訊息統計 (極度簡化版本，避開路徑問題)
 * GET /api/messages/stats
 */


app.get('/stats', jwtAuth, async (c) => {
  try {
    // 使用正確的資料庫連接
    const db = createDbClient(c.env.DB);

    // 簡化版本：只提供基本統計，不做複雜查詢
    const basicStats = await db
      .select({
        total: count(),
      })
      .from(messages)
      .get();

    const totalMessages = basicStats?.total || 0;

    return c.json({
      success: true,
      data: {
        overview: {
          totalMessages,
          todayMessages: 0, // 簡化版本不計算
          activeConversations: 0, // 簡化版本不計算
          averagePerDay: Math.round(totalMessages / 30), // 簡單估算
          recalledMessages: 0 // 簡化版本不計算
        },
        breakdown: {
          byMessageType: {}, // 簡化版本不計算
          bySenderType: {} // 簡化版本不計算
        },
        scope: 'global',
        note: 'Simplified version to avoid path resolution issues. Basic message count only.',
        generatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get message statistics error:', error);
    return c.json({
      success: false,
      error: 'Failed to get message statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});


/**
 * 獲取所有可用標籤
 * GET /api/messages/tags
 */


app.get('/tags', jwtAuth, async (c) => {
  try {
    const db = createDbClient(c.env.DB);

    // 從訊息元數據中提取所有唯一的標籤
    const messagesWithTags = await db
      .select({
        metadata: messages.metadata
      })
      .from(messages)
      .where(eq(messages.isRecalled, false));

    // 提取並統計所有標籤
    const tagStats: Record<string, number> = {};

    for (const msg of messagesWithTags) {
      if (msg.metadata) {
        try {
          const metadata = JSON.parse(msg.metadata);
          if (metadata.tags && Array.isArray(metadata.tags)) {
            for (const tag of metadata.tags) {
              tagStats[tag] = (tagStats[tag] || 0) + 1;
            }
          }
        } catch (e) {
          // 忽略解析錯誤
        }
      }
    }

    // 轉換為數組並排序
    const tagList = Object.entries(tagStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return c.json({
      success: true,
      data: {
        tags: tagList,
        total: tagList.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get message tags error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message tags',
      timestamp: new Date().toISOString()
    }, 500);
  }
});


// ======================== 訊息匯出功能 (Message Export) ========================

/**
 * 匯出訊息為JSON/CSV格式
 * GET /api/messages/export
 */


app.get('/export', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    // 取得查詢參數
    const format = c.req.query('format') || 'json'; // 'json' or 'csv'
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
        // 發送者資訊
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
      // JSON格式匯出
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
          `"${msg.content.replace(/"/g, '""')}"`, // Escape quotes
          msg.messageType,
          msg.sentAt || '',
          msg.deliveryStatus || '',
          msg.createdAt || ''
        ].join(',');
      });

      const csvContent = [csvHeaders, ...csvRows].join('\n');

      // Return Response directly with correct CSV headers
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


/**
 * 獲取特定訊息
 * GET /api/messages/:id
 *
 * ⚠️  ROUTING PRIORITY NOTE:
 * This route should ideally be registered AFTER:
 *   - GET /conversation/:conversationId (currently at line ~892)
 *   - GET /:id/attachments (currently at line ~1365)
 * However, Hono's smart routing may handle this correctly.
 * Verify through integration testing if issues arise.
 */


app.post('/bulk-create', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    let requestData: {
      messages: {
        conversationId: string;
        content: string;
        messageType?: string;
        metadata?: any;
      }[];
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const { messages: messagesToCreate } = requestData;

    // 驗證
    if (!messagesToCreate || !Array.isArray(messagesToCreate) || messagesToCreate.length === 0) {
      return c.json({
        success: false,
        error: 'Messages array is required and must not be empty',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 批量操作限制 (最多100條)
    if (messagesToCreate.length > 100) {
      return c.json({
        success: false,
        error: 'Bulk operation limited to 100 messages at a time',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);
    const results: any[] = [];
    const errors: any[] = [];

    // 批量處理
    for (let i = 0; i < messagesToCreate.length; i++) {
      const msgData = messagesToCreate[i];

      try {
        // 基本驗證
        if (!msgData.conversationId || !msgData.content || msgData.content.trim().length === 0) {
          errors.push({
            index: i,
            conversationId: msgData.conversationId,
            error: 'Conversation ID and content are required'
          });
          continue;
        }

        // 檢查對話是否存在
        const conversation = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, msgData.conversationId))
          .get();

        if (!conversation) {
          errors.push({
            index: i,
            conversationId: msgData.conversationId,
            error: 'Conversation not found'
          });
          continue;
        }

        // 生成訊息ID
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 準備訊息數據
        const messageData = {
          id: messageId,
          conversationId: msgData.conversationId,
          senderType: 'agent' as const,
          agentSenderId: userPayload.userId.toString(),
          content: msgData.content,
          messageType: msgData.messageType || 'text',
          metadata: msgData.metadata ? JSON.stringify(msgData.metadata) : null,
          isSent: true,
          deliveryStatus: 'sent',
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        // 插入訊息
        await db.insert(messages).values(messageData);

        // 更新對話的最後訊息時間
        await db
          .update(conversations)
          .set({
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(conversations.id, msgData.conversationId));

        results.push({
          index: i,
          id: messageId,
          conversationId: msgData.conversationId,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          index: i,
          conversationId: msgData.conversationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return c.json({
      success: true,
      data: {
        totalRequested: messagesToCreate.length,
        successCount: results.length,
        failureCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Bulk operation completed: ${results.length} succeeded, ${errors.length} failed`,
      timestamp: new Date().toISOString()
    }, 201);

  } catch (error) {
    console.error('Bulk create messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk create messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 批量刪除訊息 (批量撤回)
 * POST /api/messages/bulk-delete
 */


app.post('/bulk-delete', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    let requestData: {
      messageIds: string[];
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const { messageIds } = requestData;

    // 驗證
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return c.json({
        success: false,
        error: 'Message IDs array is required and must not be empty',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 批量操作限制 (最多100條)
    if (messageIds.length > 100) {
      return c.json({
        success: false,
        error: 'Bulk operation limited to 100 messages at a time',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);
    const results: any[] = [];
    const errors: any[] = [];

    // 批量處理
    for (const messageId of messageIds) {
      try {
        // 檢查訊息是否存在以及用戶權限
        const existingMessage = await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            agentSenderId: messages.agentSenderId,
            senderType: messages.senderType,
            isRecalled: messages.isRecalled,
            recallDeadline: messages.recallDeadline
          })
          .from(messages)
          .where(eq(messages.id, messageId))
          .get();

        if (!existingMessage) {
          errors.push({
            messageId,
            error: 'Message not found'
          });
          continue;
        }

        // 檢查權限：只有發送者或管理員可以撤回
        if (existingMessage.senderType === 'agent' &&
            existingMessage.agentSenderId !== userPayload.userId.toString() &&
            userPayload.role !== 'admin') {
          errors.push({
            messageId,
            error: 'Permission denied'
          });
          continue;
        }

        // 檢查訊息是否已被撤回
        if (existingMessage.isRecalled) {
          errors.push({
            messageId,
            error: 'Message already recalled'
          });
          continue;
        }

        // 檢查撤回時限（如果設定了）
        if (existingMessage.recallDeadline) {
          const deadline = new Date(existingMessage.recallDeadline);
          const now = new Date();
          if (now > deadline) {
            errors.push({
              messageId,
              error: 'Recall deadline has passed'
            });
            continue;
          }
        }

        const recalledAt = new Date().toISOString();

        // 撤回訊息 (軟刪除)
        await db
          .update(messages)
          .set({
            isRecalled: true,
            recalledAt: recalledAt,
            content: '[This message has been recalled]'
          })
          .where(eq(messages.id, messageId));

        results.push({
          messageId,
          conversationId: existingMessage.conversationId,
          recalledAt,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return c.json({
      success: true,
      data: {
        totalRequested: messageIds.length,
        successCount: results.length,
        failureCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Bulk delete completed: ${results.length} succeeded, ${errors.length} failed`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk delete messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk delete messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ======================== 附件管理端點 (Attachment Management) ========================

/**
 * 獲取訊息的附件列表
 * GET /api/messages/:id/attachments
 */


app.get('/conversation/:conversationId', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.param('conversationId');

    // 取得分頁參數
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;

    // 取得過濾參數
    const messageType = c.req.query('messageType');
    const senderType = c.req.query('senderType');
    const includeRecalled = c.req.query('includeRecalled') === 'true';

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 構建查詢條件
    const whereConditions: any[] = [eq(messages.conversationId, conversationId)];

    if (!includeRecalled) {
      whereConditions.push(eq(messages.isRecalled, false));
    }

    if (messageType) {
      whereConditions.push(eq(messages.messageType, messageType));
    }

    if (senderType) {
      whereConditions.push(eq(messages.senderType, senderType));
    }

    // 獲取訊息總數
    const totalResult = await db
      .select({ count: count() })
      .from(messages)
      .where(and(...whereConditions))
      .get();

    const total = totalResult?.count || 0;

    // 獲取分頁訊息列表
    const messageList = await db
      .select({
        // 訊息欄位
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        isRecalled: messages.isRecalled,
        recalledAt: messages.recalledAt,
        isSent: messages.isSent,
        sentAt: messages.sentAt,
        deliveryStatus: messages.deliveryStatus,
        replyToMessageId: messages.replyToMessageId,
        threadId: messages.threadId,
        sessionId: messages.sessionId,
        sessionSequence: messages.sessionSequence,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        // 發送者資訊
        customerName: customers.displayName,
        customerPlatform: customers.platform,
        agentName: agents.displayName,
        agentRole: agents.role
      })
      .from(messages)
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .where(and(...whereConditions))
      .orderBy(desc(messages.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 格式化回應數據
    const formattedMessages = messageList.map(msg => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderType: msg.senderType,
      senderInfo: msg.senderType === 'agent' ? {
        id: msg.agentSenderId,
        name: msg.agentName,
        role: msg.agentRole
      } : msg.senderType === 'customer' ? {
        id: msg.customerSenderId,
        name: msg.customerName,
        platform: msg.customerPlatform
      } : null,
      content: msg.content,
      messageType: msg.messageType,
      isRecalled: Boolean(msg.isRecalled),
      recalledAt: msg.recalledAt,
      isSent: Boolean(msg.isSent),
      sentAt: msg.sentAt,
      deliveryStatus: msg.deliveryStatus,
      replyToMessageId: msg.replyToMessageId,
      threadId: msg.threadId,
      sessionId: msg.sessionId,
      sessionSequence: msg.sessionSequence,
      metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      createdAt: msg.createdAt
    }));

    const totalPages = Math.ceil(total / pageSize);

    return c.json({
      success: true,
      data: {
        messages: formattedMessages,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasMore: page < totalPages
        },
        filters: {
          messageType,
          senderType,
          includeRecalled
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get conversation messages error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversation messages',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ======================== 批量操作端點 (Bulk Operations) ========================

/**
 * 批量創建訊息
 * POST /api/messages/bulk-create
 */


app.get('/:id/attachments', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 獲取附件列表
    const { fileAttachments } = await import('../shared/database/schema');
    const attachmentList = await db
      .select({
        id: fileAttachments.id,
        messageId: fileAttachments.messageId,
        filename: fileAttachments.filename,
        mimeType: fileAttachments.mimeType,
        fileSize: fileAttachments.fileSize,
        fileUrl: fileAttachments.fileUrl,
        r2Key: fileAttachments.r2Key,
        url: fileAttachments.url,
        createdAt: fileAttachments.createdAt
      })
      .from(fileAttachments)
      .where(eq(fileAttachments.messageId, messageId));

    return c.json({
      success: true,
      data: {
        messageId,
        conversationId: message.conversationId,
        attachments: attachmentList,
        count: attachmentList.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get message attachments error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message attachments',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 上傳訊息附件
 * POST /api/messages/:id/attachments
 */


app.post('/:id/attachments', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 檢查權限：只有發送者或管理員可以添加附件
    if (message.senderType === 'agent' &&
        message.agentSenderId !== userPayload.userId.toString() &&
        userPayload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Permission denied: Only the sender or admin can add attachments',
        timestamp: new Date().toISOString()
      }, 403);
    }

    // 獲取上傳的檔案
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({
        success: false,
        error: 'File is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 檢查檔案大小 (10MB 限制)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return c.json({
        success: false,
        error: `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 檢查MIME類型
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return c.json({
        success: false,
        error: 'File type not allowed',
        details: { allowedTypes: allowedMimeTypes },
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 生成R2 key
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const r2Key = `attachments/${message.conversationId}/${messageId}/${timestamp}_${randomStr}.${fileExtension}`;

    // 上傳到 R2
    try {
      const arrayBuffer = await file.arrayBuffer();
      await c.env.R2_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type
        }
      });
    } catch (error) {
      console.error('R2 upload error:', error);
      return c.json({
        success: false,
        error: 'Failed to upload file to storage',
        timestamp: new Date().toISOString()
      }, 500);
    }

    // 生成公開URL - 使用 API 代理端點而非直接 R2 URL
    const requestUrl = new URL(c.req.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const fileUrl = `${baseUrl}/api/files/public/${r2Key}`;
    console.log(`[Upload] Generated proxy URL: ${fileUrl}`);

    // 保存附件記錄到資料庫
    const { fileAttachments } = await import('../shared/database/schema');
    const attachmentId = `att_${timestamp}_${randomStr}`;

    await db.insert(fileAttachments).values({
      id: attachmentId,
      messageId,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileUrl,
      r2Key,
      // url 字段已棄用，只使用 fileUrl
      createdAt: new Date().toISOString()
    });

    return c.json({
      success: true,
      data: {
        attachmentId,
        messageId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        url: fileUrl,
        createdAt: new Date().toISOString()
      },
      message: 'Attachment uploaded successfully',
      timestamp: new Date().toISOString()
    }, 201);

  } catch (error) {
    console.error('Upload attachment error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload attachment',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ======================== 訊息轉發功能 (Message Forwarding) ========================

/**
 * 轉發訊息到其他對話
 * POST /api/messages/:id/forward
 */


app.post('/:id/forward', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    let requestData: {
      targetConversationIds: string[];
      comment?: string;
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const { targetConversationIds, comment } = requestData;

    // 驗證
    if (!targetConversationIds || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
      return c.json({
        success: false,
        error: 'Target conversation IDs array is required and must not be empty',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 限制一次最多轉發到20個對話
    if (targetConversationIds.length > 20) {
      return c.json({
        success: false,
        error: 'Maximum 20 conversations allowed per forward operation',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 獲取原始訊息
    const originalMessage = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        messageType: messages.messageType,
        metadata: messages.metadata,
        senderType: messages.senderType,
        agentSenderId: messages.agentSenderId,
        customerSenderId: messages.customerSenderId
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!originalMessage) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    const results: any[] = [];
    const errors: any[] = [];

    // 轉發到每個目標對話
    for (const targetConversationId of targetConversationIds) {
      try {
        // 檢查目標對話是否存在
        const targetConversation = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, targetConversationId))
          .get();

        if (!targetConversation) {
          errors.push({
            conversationId: targetConversationId,
            error: 'Target conversation not found'
          });
          continue;
        }

        // 生成新訊息ID
        const newMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 準備轉發的訊息內容
        let forwardedContent = `[Forwarded Message]\n${originalMessage.content}`;
        if (comment) {
          forwardedContent += `\n\n📝 Comment: ${comment}`;
        }

        // 準備元數據
        const forwardMetadata = {
          forwardedFrom: {
            messageId: originalMessage.id,
            conversationId: originalMessage.conversationId,
            originalSenderType: originalMessage.senderType
          },
          comment: comment || null,
          forwardedBy: userPayload.userId.toString(),
          forwardedAt: new Date().toISOString()
        };

        // 創建轉發的訊息
        const forwardedMessageData = {
          id: newMessageId,
          conversationId: targetConversationId,
          senderType: 'agent' as const,
          agentSenderId: userPayload.userId.toString(),
          content: forwardedContent,
          messageType: originalMessage.messageType,
          metadata: JSON.stringify(forwardMetadata),
          isSent: true,
          deliveryStatus: 'sent',
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        // 插入轉發的訊息
        await db.insert(messages).values(forwardedMessageData);

        // 更新對話的最後訊息時間
        await db
          .update(conversations)
          .set({
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(conversations.id, targetConversationId));

        results.push({
          conversationId: targetConversationId,
          newMessageId,
          status: 'success'
        });

      } catch (error) {
        errors.push({
          conversationId: targetConversationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return c.json({
      success: true,
      data: {
        originalMessageId: messageId,
        totalTargets: targetConversationIds.length,
        successCount: results.length,
        failureCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Message forwarded: ${results.length} succeeded, ${errors.length} failed`,
      timestamp: new Date().toISOString()
    }, 201);

  } catch (error) {
    console.error('Forward message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to forward message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ======================== 訊息標記系統 (Message Tagging) ========================

/**
 * 為訊息添加/更新標籤
 * PUT /api/messages/:id/tags
 */


app.put('/:id/tags', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    let requestData: {
      tags: string[];
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const { tags: tagNames } = requestData;

    // 驗證
    if (!tagNames || !Array.isArray(tagNames)) {
      return c.json({
        success: false,
        error: 'Tags array is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 限制標籤數量
    if (tagNames.length > 10) {
      return c.json({
        success: false,
        error: 'Maximum 10 tags allowed per message',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        metadata: messages.metadata
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 解析現有的元數據
    let existingMetadata: any = {};
    if (message.metadata) {
      try {
        existingMetadata = JSON.parse(message.metadata);
      } catch (e) {
        existingMetadata = {};
      }
    }

    // 更新標籤
    existingMetadata.tags = tagNames;
    existingMetadata.tagsUpdatedAt = new Date().toISOString();
    existingMetadata.tagsUpdatedBy = userPayload.userId.toString();

    // 更新訊息
    await db
      .update(messages)
      .set({
        metadata: JSON.stringify(existingMetadata)
      })
      .where(eq(messages.id, messageId));

    return c.json({
      success: true,
      data: {
        messageId,
        conversationId: message.conversationId,
        tags: tagNames,
        updatedAt: existingMetadata.tagsUpdatedAt
      },
      message: 'Message tags updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update message tags error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update message tags',
      timestamp: new Date().toISOString()
    }, 500);
  }
});



app.get('/:id', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 獲取訊息詳細資訊，包含相關的對話和發送者資訊
    const messageQuery = await db
      .select({
        // 訊息資訊
        id: messages.id,
        conversationId: messages.conversationId,
        senderType: messages.senderType,
        customerSenderId: messages.customerSenderId,
        agentSenderId: messages.agentSenderId,
        content: messages.content,
        messageType: messages.messageType,
        platformMessageId: messages.platformMessageId,
        isRecalled: messages.isRecalled,
        recallDeadline: messages.recallDeadline,
        recalledAt: messages.recalledAt,
        isSent: messages.isSent,
        sentAt: messages.sentAt,
        deliveryStatus: messages.deliveryStatus,
        replyToMessageId: messages.replyToMessageId,
        threadId: messages.threadId,
        sessionId: messages.sessionId,
        sessionSequence: messages.sessionSequence,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        // 對話資訊
        conversationStatus: conversations.status,
        conversationPriority: conversations.priority,
        // 代理人資訊
        agentName: agents.displayName,
        agentRole: agents.role,
        // 客戶資訊
        customerName: customers.displayName,
        customerPlatform: customers.platform
      })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .leftJoin(agents, eq(messages.agentSenderId, agents.id))
      .leftJoin(customers, eq(messages.customerSenderId, customers.id))
      .where(eq(messages.id, messageId))
      .get();

    if (!messageQuery) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 構造回應數據
    const messageDetail = {
      id: messageQuery.id,
      conversationId: messageQuery.conversationId,
      senderType: messageQuery.senderType,
      senderInfo: messageQuery.senderType === 'agent' ? {
        id: messageQuery.agentSenderId,
        name: messageQuery.agentName,
        role: messageQuery.agentRole
      } : messageQuery.senderType === 'customer' ? {
        id: messageQuery.customerSenderId,
        name: messageQuery.customerName,
        platform: messageQuery.customerPlatform
      } : null,
      content: messageQuery.content,
      messageType: messageQuery.messageType,
      platformMessageId: messageQuery.platformMessageId,
      isRecalled: Boolean(messageQuery.isRecalled),
      recallDeadline: messageQuery.recallDeadline,
      recalledAt: messageQuery.recalledAt,
      isSent: Boolean(messageQuery.isSent),
      sentAt: messageQuery.sentAt,
      deliveryStatus: messageQuery.deliveryStatus,
      replyToMessageId: messageQuery.replyToMessageId,
      threadId: messageQuery.threadId,
      sessionId: messageQuery.sessionId,
      sessionSequence: messageQuery.sessionSequence,
      metadata: messageQuery.metadata ? JSON.parse(messageQuery.metadata) : null,
      createdAt: messageQuery.createdAt,
      conversationInfo: {
        status: messageQuery.conversationStatus,
        priority: messageQuery.conversationPriority
      }
    };

    return c.json({
      success: true,
      data: messageDetail,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 更新訊息
 * PUT /api/messages/:id
 */


app.put('/:id', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    let updateData: {
      content?: string;
      messageType?: string;
      metadata?: any;
    };

    try {
      updateData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在以及用戶權限
    const existingMessage = await db
      .select({
        id: messages.id,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType,
        isRecalled: messages.isRecalled,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!existingMessage) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 檢查權限：只有發送者或管理員可以編輯
    if (existingMessage.senderType === 'agent' &&
        existingMessage.agentSenderId !== userPayload.userId.toString() &&
        userPayload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Permission denied: Only the sender or admin can update this message',
        timestamp: new Date().toISOString()
      }, 403);
    }

    // 檢查訊息是否已被撤回
    if (existingMessage.isRecalled) {
      return c.json({
        success: false,
        error: 'Cannot update a recalled message',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 準備更新數據
    const updateValues: any = {
      updatedAt: new Date().toISOString()
    };

    if (updateData.content !== undefined) {
      if (!updateData.content.trim()) {
        return c.json({
          success: false,
          error: 'Content cannot be empty',
          timestamp: new Date().toISOString()
        }, 400);
      }
      updateValues.content = updateData.content;
    }

    if (updateData.messageType !== undefined) {
      updateValues.messageType = updateData.messageType;
    }

    if (updateData.metadata !== undefined) {
      updateValues.metadata = JSON.stringify(updateData.metadata);
    }

    // 執行更新
    await db
      .update(messages)
      .set(updateValues)
      .where(eq(messages.id, messageId));

    // 獲取更新後的訊息
    const updatedMessage = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        content: messages.content,
        messageType: messages.messageType,
        metadata: messages.metadata,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    return c.json({
      success: true,
      data: {
        ...updatedMessage,
        metadata: updatedMessage?.metadata ? JSON.parse(updatedMessage.metadata) : null
      },
      message: 'Message updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 刪除訊息 (撤回訊息)
 * DELETE /api/messages/:id
 */


app.delete('/:id', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在以及用戶權限
    const existingMessage = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType,
        isRecalled: messages.isRecalled,
        recallDeadline: messages.recallDeadline,
        content: messages.content,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!existingMessage) {
      return c.json({
        success: false,
        error: 'Message not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 檢查權限：只有發送者或管理員可以撤回
    if (existingMessage.senderType === 'agent' &&
        existingMessage.agentSenderId !== userPayload.userId.toString() &&
        userPayload.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Permission denied: Only the sender or admin can recall this message',
        timestamp: new Date().toISOString()
      }, 403);
    }

    // 檢查訊息是否已被撤回
    if (existingMessage.isRecalled) {
      return c.json({
        success: false,
        error: 'Message has already been recalled',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 檢查撤回時限（如果設定了）
    if (existingMessage.recallDeadline) {
      const deadline = new Date(existingMessage.recallDeadline);
      const now = new Date();
      if (now > deadline) {
        return c.json({
          success: false,
          error: 'Message recall deadline has passed',
          timestamp: new Date().toISOString()
        }, 400);
      }
    }

    const recalledAt = new Date().toISOString();

    // 撤回訊息 (軟刪除，保留記錄)
    await db
      .update(messages)
      .set({
        isRecalled: true,
        recalledAt: recalledAt,
        content: '[This message has been recalled]' // 替換內容
      })
      .where(eq(messages.id, messageId));

    // 可以在這裡記錄撤回日誌到 messageRecallLogs 表
    // const recallLogId = `recall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // await db.insert(messageRecallLogs).values({
    //   id: recallLogId,
    //   messageId,
    //   recalledBy: userPayload.userId.toString(),
    //   recalledAt,
    //   reason: 'User requested recall'
    // });

    return c.json({
      success: true,
      data: {
        id: messageId,
        conversationId: existingMessage.conversationId,
        isRecalled: true,
        recalledAt,
        recalledBy: {
          id: userPayload.userId.toString(),
          name: userPayload.displayName || 'Unknown User'
        }
      },
      message: 'Message recalled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recall message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 獲取對話訊息列表
 * GET /api/messages/conversation/:conversationId
 */

app.post('/', jwtAuth, async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;

    let requestData: {
      conversationId: string;
      content: string;
      messageType?: string;
      replyToMessageId?: string;
      metadata?: any;
      attachmentIds?: string[];  // 🔧 FIX: 添加附件ID数组支持
    };

    try {
      requestData = await c.req.json();
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON data',
        timestamp: new Date().toISOString()
      }, 400);
    }

    const { conversationId, content, messageType, replyToMessageId, metadata, attachmentIds } = requestData;  // 🔧 FIX: 提取 attachmentIds

    // 基本驗證
    if (!conversationId || !content || content.trim().length === 0) {
      return c.json({
        success: false,
        error: 'Conversation ID and content are required',
        timestamp: new Date().toISOString()
      }, 400);
    }

    // 創建資料庫連線
    const db = createDbClient(c.env.DB);

    // 檢查對話是否存在
    const conversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({
        success: false,
        error: 'Conversation not found',
        timestamp: new Date().toISOString()
      }, 404);
    }

    // 生成訊息ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 準備訊息數據
    const messageData = {
      id: messageId,
      conversationId,
      senderType: 'agent' as const,
      agentSenderId: userPayload.userId.toString(),
      content,
      messageType: messageType || 'text',
      replyToMessageId: replyToMessageId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      isSent: true,
      deliveryStatus: 'sent',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // 插入訊息
    await db.insert(messages).values(messageData);

    // 更新對話的最後訊息時間
    await db
      .update(conversations)
      .set({
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(conversations.id, conversationId));

    // 🔧 FIX: 處理附件關聯
    // 如果有附件ID，更新 file_attachments 表將附件關聯到此消息
    if (attachmentIds && attachmentIds.length > 0) {
      for (const attachmentId of attachmentIds) {
        await db
          .update(fileAttachments)
          .set({ messageId: messageId })
          .where(
            and(
              eq(fileAttachments.id, attachmentId),
              isNull(fileAttachments.messageId)  // 只更新未關聯的附件
            )
          );
      }
    }

    // 🔧 FIX: 查詢關聯的附件
    let attachments: any[] = [];
    if (attachmentIds && attachmentIds.length > 0) {
      attachments = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.messageId, messageId))
        .all();
    }

    // 🔔 @提及通知檢測與觸發
    const mentionedUserIds = getMentionedUserIds(content);
    if (mentionedUserIds.length > 0) {
      // 獲取發送者的顯示名稱
      const senderName = userPayload.displayName || userPayload.username || 'Agent';

      // 為每個被提及的用戶發送通知 (排除自己)
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== userPayload.userId.toString()) {
          triggerMentionNotification(c.env, {
            mentionedUserId,
            mentionerName: senderName,
            mentionerId: userPayload.userId,
            conversationId,
            messagePreview: content.substring(0, 100)
          }).catch(err => {
            console.warn('Failed to trigger mention notification:', err);
          });
        }
      }
    }

    return c.json({
      success: true,
      data: {
        id: messageId,
        conversationId,
        content,
        messageType: messageType || 'text',
        senderType: 'agent',
        agentSenderId: userPayload.userId.toString(),
        sentAt: messageData.sentAt,
        createdAt: messageData.createdAt,
        file_attachments: attachments,  // 🔧 FIX: 包含附件數據
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined  // 🔔 返回被提及的用戶 ID
      },
      message: 'Message created successfully',
      timestamp: new Date().toISOString()
    }, 201);

  } catch (error) {
    console.error('Create message error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create message',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 搜尋訊息
 * GET /api/messages/search
 */


export default app;