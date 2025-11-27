// 訊息處理器 - 使用 Drizzle ORM 以獲得完整類型安全
import type { Context } from 'hono';
import type { 
  Bindings, 
  Message, 
  ExtendedPaginationMeta
} from '../types';
import type { HonoContext } from '../types/bindings';
import { 
  successResponse, 
  paginatedResponse,
  validationErrorResponse, 
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';
import { eq, and, inArray, like, count, or, lte, gte, aliasedTable } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createDbClient } from '../db/drizzle-factory';
import { sql } from 'drizzle-orm';
import { messages, conversations, customers, agents, teams } from '../db/schema';
import { logger } from '../utils/logger';
import { WebSocketBroadcastService } from '../services/websocket-broadcast-service';

export const messageHandler = {
    // 獲取對話訊息列表 - 使用 Drizzle ORM 獲得類型安全
    list: async (c: Context<HonoContext>) => {
        try {
            const conversationId = c.req.param('id');
            const page = parseInt(c.req.query('page') || '1');
            const pageSize = parseInt(c.req.query('pageSize') || '50');
            
            // 取得 DatabaseService 實例（由 middleware 注入）
            const dbService = c.get('dbService');
            if (!dbService) {
                throw new Error('DatabaseService not available');
            }

            const offset = (page - 1) * pageSize;

            // ✅ 使用 Drizzle ORM 進行類型安全查詢
            const db = c.get('db');
            const messagesWithSender = await db.select({
                // Message fields
                id: schema.messages.id,
                conversationId: schema.messages.conversationId,
                senderType: schema.messages.senderType,
                customerSenderId: schema.messages.customerSenderId,
                agentSenderId: schema.messages.agentSenderId,
                content: schema.messages.content,
                messageType: schema.messages.messageType,
                createdAt: schema.messages.createdAt,
                // Customer info
                customerName: schema.customers.displayName,
                // Agent info
                agentName: schema.agents.displayName,
            })
            .from(schema.messages)
            .leftJoin(schema.customers, 
                and(
                    eq(schema.messages.senderType, 'customer'),
                    eq(schema.messages.customerSenderId, schema.customers.id)
                )
            )
            .leftJoin(schema.agents,
                and(
                    eq(schema.messages.senderType, 'agent'),
                    eq(schema.messages.agentSenderId, schema.agents.id)
                )
            )
            .where(eq(schema.messages.conversationId, conversationId))
            .orderBy(schema.messages.createdAt) // ASC: 舊消息在前，新消息在後
            .limit(pageSize)
            .offset(offset);

            // ✅ 類型安全的計數查詢 - 使用 Drizzle count 函數
            const { sql } = await import('drizzle-orm');
            const [totalResult] = await db.select({ 
                total: sql<number>`count(${schema.messages.id})` 
            })
            .from(schema.messages)
            .where(eq(schema.messages.conversationId, conversationId));

            const total = totalResult?.total || 0;

            // ✅ 類型安全的數據轉換
            const items: Message[] = messagesWithSender.map(row => ({
                id: row.id,
                conversationId: row.conversationId,
                senderType: row.senderType === 'customer' ? 'user' as const : 'agent' as const,
                senderId: row.senderType === 'customer' 
                    ? row.customerSenderId?.toString() || '' 
                    : row.agentSenderId || '',
                content: row.content,
                mediaUrl: '', // 需要從 metadata 或其他表獲取
                mediaType: row.messageType as 'text' | 'image' | 'video' | 'file',
                platform: 'line' as const, // 需要從 conversation->customer 獲取
                createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now()
            }));

            // 🚀 WebSocket Broadcasting: Typing Indicator (if applicable)
            // This could be triggered by query parameters for real-time typing indicators
            const triggerTyping = c.req.query('typing');
            if (triggerTyping === 'start' || triggerTyping === 'stop') {
                try {
                    const broadcastService = new WebSocketBroadcastService(c.env);
                    const user = c.get('user') || c.get('agent');
                    if (user) {
                        await broadcastService.broadcastTypingEvent({
                            type: triggerTyping === 'start' ? 'typing_start' : 'typing_stop',
                            conversationId,
                            userId: String(user.id),
                            userName: user.displayName,
                            data: {
                                timestamp: Date.now()
                            }
                        });
                        console.log(`✅ [WebSocket] Typing ${triggerTyping} event broadcasted`);
                    }
                } catch (broadcastError) {
                    console.warn(`⚠️ [WebSocket] Typing ${triggerTyping} broadcast failed:`, broadcastError);
                }
            }

            return paginatedResponse(c, items, {
                page,
                limit: pageSize,
                total
            }, 'Messages retrieved successfully');

        } catch (error) {
            return handleApiError(error, c);
        }
    },

    // 發送訊息 - 使用 Drizzle ORM 獲得類型安全
    send: async (c: Context<HonoContext>) => {
        try {
            const conversationId = c.req.param('id');
            const agent = c.get('agent'); // 從 auth middleware 獲取
            if (!agent) {
                return c.json({ error: 'Authentication required' }, 401);
            }
            
            const { content, mediaUrl, mediaType, attachmentIds } = await c.req.json();

            if (!content && !mediaUrl && (!attachmentIds || attachmentIds.length === 0)) {
                return validationErrorResponse(c, [
                    { field: 'content', message: 'Content, media, or attachments are required' }
                ]);
            }

            const db = c.get('db');
            const dbService = c.get('dbService');
            if (!db || !dbService) {
                throw new Error('Database services not available');
            }

            // ✅ 使用 Drizzle ORM 獲取對話資訊（類型安全）
            const [conversationWithCustomer] = await db.select({
                // Conversation fields
                id: schema.conversations.id,
                customerId: schema.conversations.customerId,
                assignedUserId: schema.conversations.assignedUserId,
                status: schema.conversations.status,
                // Customer platform info
                platform: schema.customers.platform,
                platformUserId: schema.customers.platformUserId,
            })
            .from(schema.conversations)
            .innerJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
            .where(eq(schema.conversations.id, conversationId))
            .limit(1);

            if (!conversationWithCustomer) {
                return notFoundResponse(c, 'Conversation');
            }

            // 生成訊息 ID
            const messageId = crypto.randomUUID();
            const hasAttachments = attachmentIds && attachmentIds.length > 0;

            // ✅ 使用 Drizzle ORM 插入訊息（類型安全）
            await db.insert(schema.messages).values({
                id: messageId,
                conversationId: conversationId,
                senderType: 'agent',
                agentSenderId: agent.id, // 使用已認證的 agent.id
                content: content || '',
                messageType: mediaType || (hasAttachments ? 'file' : 'text'),
                isSent: false,
                deliveryStatus: 'pending',
                metadata: hasAttachments ? JSON.stringify({ attachmentIds }) : null,
                createdAt: new Date().toISOString()
            });

            // 🚀 Trigger latest message cache update
            try {
                const { LatestMessageJobQueue } = await import('../workers/latest-message-worker');
                const jobQueue = new LatestMessageJobQueue(c.env);
                await jobQueue.updateLatestMessage(conversationId, messageId, 'normal');
                console.log(`📤 [Message Handler] Triggered cache update for conversation ${conversationId}`);
            } catch (error) {
                console.warn(`⚠️ [Message Handler] Failed to trigger cache update:`, error);
                // Don't fail the message creation for cache update failures
            }

            // ✅ 如果有附件，使用 Drizzle ORM 更新附件
            if (hasAttachments) {
                const { inArray } = await import('drizzle-orm');
                await db.update(schema.fileAttachments)
                    .set({ 
                        messageId: messageId
                    })
                    .where(inArray(schema.fileAttachments.id, attachmentIds));
            }

            let sendResult = false;
            try {
                if (conversationWithCustomer.platform === 'line') {
                    const { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } = await import('../utils/line');
                    let messages: any[] = [];

                    // 🔧 FIX: 檢查是否為純文件描述訊息
                    // 如果有附件且內容只是文件描述，則不發送文字訊息
                    const isFileOnlyContent = content && (
                        /^Sent a file:\s*.+$/i.test(content) ||        // "Sent a file: xxx"
                        /^Sent \d+ files$/i.test(content) ||           // "Sent 2 files", "Sent 3 files"
                        /^\[(?:檔案|圖片)\]\s*.+$/.test(content)       // "[檔案] xxx", "[圖片] xxx"
                    );

                    // 只有在有實際內容（非純文件描述）時才發送文字訊息
                    if (content && !isFileOnlyContent) {
                        messages.push(createTextMessage(content));
                    } else if (content && isFileOnlyContent && !hasAttachments) {
                        // 如果是文件描述但沒有附件，還是要發送（fallback）
                        messages.push(createTextMessage(content));
                    }

                    // 處理附件 - LINE 發送 (使用 Flex Message 卡片樣式)
                    if (hasAttachments) {
                        // 獲取附件資訊
                        const lineAttachments = await db.select()
                            .from(schema.fileAttachments)
                            .where(inArray(schema.fileAttachments.id, attachmentIds));

                        for (const attachment of lineAttachments) {
                            const fileUrl = attachment.fileUrl;

                            if (fileUrl) {
                                if (attachment.mimeType?.startsWith('image/')) {
                                    // 圖片訊息 - 使用原生圖片訊息以顯示預覽
                                    messages.push(createImageMessage(fileUrl));
                                    console.log(`📷 [LINE] Adding image attachment: ${attachment.filename}`);
                                } else {
                                    // 🔧 FIX: 使用 Flex Message 卡片樣式發送檔案
                                    // 這樣 LINE 用戶會看到漂亮的檔案卡片，而非純文字
                                    const flexMessage = createFileFlexMessage(
                                        fileUrl,
                                        attachment.filename || 'File',
                                        attachment.mimeType || '',
                                        attachment.fileSize || 0
                                    );
                                    messages.push(flexMessage);
                                    console.log(`📎 [LINE] Adding file Flex Message card: ${attachment.filename} (${attachment.mimeType})`);
                                }
                            }
                        }
                    }

                    if (messages.length > 0) {
                        sendResult = await pushLineMessage(
                            c.env.LINE_CHANNEL_ACCESS_TOKEN,
                            conversationWithCustomer.platformUserId,
                            messages
                        );

                        if (sendResult) {
                            console.log(`✅ [LINE] Message sent successfully with ${messages.length} item(s)`);
                        } else {
                            console.error(`❌ [LINE] Failed to send message to ${conversationWithCustomer.platformUserId}`);
                        }
                    }
                } else if (conversationWithCustomer.platform === 'facebook') {
                    // 發送 Facebook Messenger 訊息
                    const { FacebookAdapter } = await import('../integrations/platform-adapter');
                    const facebookAdapter = new FacebookAdapter(
                        c.env.FB_APP_SECRET || '', 
                        c.env.FB_PAGE_ACCESS_TOKEN || ''
                    );
                    
                    if (mediaType && mediaUrl) {
                        // 發送多媒體訊息
                        switch (mediaType) {
                            case 'image':
                                sendResult = await facebookAdapter.sendImageMessage(String(conversationWithCustomer.platformUserId), mediaUrl);
                                break;
                            case 'video':
                                sendResult = await facebookAdapter.sendVideoMessage(String(conversationWithCustomer.platformUserId), mediaUrl);
                                break;
                            case 'audio':
                                sendResult = await facebookAdapter.sendAudioMessage(String(conversationWithCustomer.platformUserId), mediaUrl);
                                break;
                            case 'file':
                                sendResult = await facebookAdapter.sendFileMessage(String(conversationWithCustomer.platformUserId), mediaUrl, content || 'File');
                                break;
                            default:
                                if (content) {
                                    sendResult = await facebookAdapter.sendTextMessage(String(conversationWithCustomer.platformUserId), content);
                                }
                        }
                    } else if (content) {
                        sendResult = await facebookAdapter.sendTextMessage(String(conversationWithCustomer.platformUserId), content);
                    }

                    // 處理附件 - Facebook 發送
                    if (hasAttachments && sendResult) {
                        // 獲取附件資訊
                        const attachments = await db.select()
                            .from(schema.fileAttachments)
                            .where(inArray(schema.fileAttachments.id, attachmentIds));

                        for (const attachment of attachments) {
                            const fileUrl = attachment.fileUrl;
                            
                            if (fileUrl) {
                                let attachmentResult = false;
                                
                                if (attachment.mimeType?.startsWith('image/')) {
                                    attachmentResult = await facebookAdapter.sendImageMessage(String(conversationWithCustomer.platformUserId), fileUrl);
                                } else if (attachment.mimeType?.startsWith('video/')) {
                                    attachmentResult = await facebookAdapter.sendVideoMessage(String(conversationWithCustomer.platformUserId), fileUrl);
                                } else if (attachment.mimeType?.startsWith('audio/')) {
                                    attachmentResult = await facebookAdapter.sendAudioMessage(String(conversationWithCustomer.platformUserId), fileUrl);
                                } else {
                                    attachmentResult = await facebookAdapter.sendFileMessage(String(conversationWithCustomer.platformUserId), fileUrl, attachment.filename || 'File');
                                }
                                
                                if (!attachmentResult) {
                                    console.error('Failed to send Facebook attachment:', attachment.filename);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error(`Failed to send ${conversationWithCustomer.platform} message`, 'MessageHandler', {
                    conversationId,
                    platform: conversationWithCustomer.platform,
                    messageType: mediaType || 'text'
                }, error instanceof Error ? error : new Error(String(error)));
                sendResult = false;
            }

            // ✅ 使用 Drizzle ORM 更新訊息發送狀態（類型安全）
            await db.update(schema.messages)
                .set({
                    isSent: sendResult,
                    deliveryStatus: sendResult ? 'sent' : 'failed',
                    sentAt: new Date().toISOString()
                })
                .where(eq(schema.messages.id, messageId));

            // ✅ 使用 Drizzle ORM 更新對話的最後訊息時間（類型安全）
            await db.update(schema.conversations)
                .set({
                    lastMessageAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                .where(eq(schema.conversations.id, conversationId));

            // 🚀 WebSocket Broadcasting: Message Sent
            try {
                const broadcastService = new WebSocketBroadcastService(c.env);
                await broadcastService.broadcastMessageEvent({
                    type: sendResult ? 'message_sent' : 'message_recall_failed',
                    conversationId: conversationId,
                    messageId: messageId,
                    agentId: agent.id,
                    data: {
                        content: content,
                        messageType: mediaType || 'text',
                        sender: {
                            id: agent.id,
                            name: agent.displayName,
                            role: agent.role
                        },
                        platform: conversationWithCustomer.platform,
                        hasAttachments: hasAttachments,
                        attachmentCount: hasAttachments ? (attachmentIds?.length || 0) : 0,
                        deliveryStatus: sendResult ? 'sent' : 'failed',
                        timestamp: new Date().toISOString()
                    },
                    priority: 'normal'
                });
                console.log('✅ [WebSocket] Message sent event broadcasted');
            } catch (broadcastError) {
                console.warn('⚠️ [WebSocket] Message broadcast failed, continuing with fallback:', broadcastError);
            }

            // ✅ 記錄活動以觸發 SSE 更新 (為了向後相容性保留)
            try {
                const { ActivityService } = await import('../services/activity-service');
                const activityService = new ActivityService(c.env.DB);
                const activity = await activityService.logActivity({
                    userId: agent.id,
                    userName: agent.displayName,
                    userRole: agent.role,
                    action: 'message_sent',
                    resourceType: 'conversation',
                    resourceId: conversationId,
                    details: {
                        conversationId: conversationId,
                        customerId: conversationWithCustomer.customerId,
                        platform: conversationWithCustomer.platform,
                        messageType: mediaType || 'text',
                        messageId: messageId,
                        content: content?.substring(0, 100) || '[Media/Attachment]', // 只記錄前100字元
                        sendResult: sendResult,
                        broadcastMethod: 'websocket_primary_sse_fallback'
                    }
                });

                if (activity) {
                    console.log('✅ [Agent Message] Activity recorded');

                    // REMOVED: SSE broadcast (Phase 4 cleanup - replaced by WebSocket real-time events)
                    // const { broadcastActivity } = await import('./activity-stream');
                    // await broadcastActivity(c.env as any, activity);

                    // Note: WebSocket real-time events are now handled by websocket-broadcast-service
                } else {
                    console.warn('⚠️ [Agent Message] Failed to create activity');
                }
            } catch (activityError) {
                console.warn('❌ [Agent Message] Failed to record activity:', activityError);
            }

            const message: Message = {
                id: messageId,
                conversationId: conversationId,
                senderType: 'agent',
                senderId: agent.id,
                content: content,
                mediaUrl,
                mediaType,
                platform: conversationWithCustomer.platform as 'line' | 'facebook',
                createdAt: Date.now()
            };

            return successResponse(c, message, 'Message sent successfully');

        } catch (error) {
            return handleApiError(error, c);
        }
    },

    // 全文搜索訊息
    search: async (c: Context<{ Bindings: Bindings }>) => {
        try {
            const payload = c.get('jwtPayload');
            const { 
                q,                    // 搜索關鍵字
                conversationId,       // 特定對話ID
                senderType,           // 發送者類型：customer, agent, system
                messageType,          // 訊息類型：text, image, video, audio, file
                dateFrom,             // 開始日期
                dateTo,               // 結束日期
                platform,             // 平台：line, facebook
                page = '1',
                pageSize = '20',
                highlight = 'true'    // 是否高亮顯示搜索結果
            } = c.req.query();

            if (!q || q.length < 2) {
                return validationErrorResponse(c, [
                    { field: 'q', message: 'Search query must be at least 2 characters' }
                ]);
            }

            const offset = (parseInt(page) - 1) * parseInt(pageSize);
            const limit = parseInt(pageSize);

            // 使用 Drizzle ORM 構建搜索查詢
            const db = createDbClient(c.env.DB);
            
            // 構建 WHERE 條件
            const whereConditions = [];

            // 權限控制：非管理員只能搜索自己團隊的對話
            if (payload?.role !== 'admin' && payload?.teamId) {
                whereConditions.push(
                    or(
                        eq(conversations.assignedTeamId, payload.teamId),
                        sql`${conversations.assignedTeamId} IS NULL`
                    )
                );
            }

            // 全文搜索
            whereConditions.push(like(messages.content, `%${q}%`));

            // 特定對話
            if (conversationId) {
                whereConditions.push(eq(messages.conversationId, conversationId));
            }

            // 發送者類型
            if (senderType) {
                whereConditions.push(eq(messages.senderType, senderType));
            }

            // 訊息類型
            if (messageType) {
                whereConditions.push(eq(messages.messageType, messageType));
            }

            // 日期範圍
            if (dateFrom) {
                whereConditions.push(gte(messages.createdAt, dateFrom));
            }
            if (dateTo) {
                whereConditions.push(lte(messages.createdAt, dateTo));
            }

            // 平台篩選
            if (platform) {
                whereConditions.push(eq(customers.platform, platform));
            }

            // 執行搜索查詢
            const result = await db
                .select({
                    id: messages.id,
                    conversationId: messages.conversationId,
                    senderType: messages.senderType,
                    customerSenderId: messages.customerSenderId,
                    agentSenderId: messages.agentSenderId,
                    content: messages.content,
                    messageType: messages.messageType,
                    createdAt: messages.createdAt,
                    customerName: customers.displayName,
                    platform: customers.platform,
                    platformUserId: customers.platformUserId,
                    avatarUrl: customers.avatarUrl,
                    agentName: agents.displayName,
                    agentEmail: agents.email,
                    teamName: teams.name
                })
                .from(messages)
                .innerJoin(conversations, eq(messages.conversationId, conversations.id))
                .leftJoin(customers, eq(conversations.customerId, customers.id))
                .leftJoin(agents, and(
                    eq(messages.senderType, 'agent'),
                    eq(messages.agentSenderId, agents.id)
                ))
                .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
                .where(and(...whereConditions))
                .orderBy(messages.createdAt) // ASC: 保持一致的排序
                .limit(limit)
                .offset(offset);

            // 計算總數
            const countResult = await db
                .select({ total: count(messages.id) })
                .from(messages)
                .innerJoin(conversations, eq(messages.conversationId, conversations.id))
                .leftJoin(customers, eq(conversations.customerId, customers.id))
                .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
                .where(and(...whereConditions));

            // 格式化結果並高亮顯示
            const searchMessages = result.map((row: any) => {
                let highlightedContent = row.content;
                
                if (highlight === 'true') {
                    // 高亮顯示搜索關鍵字
                    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    highlightedContent = row.content.replace(regex, '<mark>$1</mark>');
                }

                return {
                    id: row.id,
                    conversationId: row.conversation_id,
                    conversation: {
                        id: row.conversation_id,
                        customer: {
                            name: row.customer_name,
                            platform: row.platform,
                            platformUserId: row.platform_user_id,
                            avatarUrl: row.avatar_url
                        },
                        assignedTeam: row.team_name,
                        assignedAgent: row.agent_name
                    },
                    senderType: row.sender_type,
                    senderId: row.sender_type === 'customer' ? row.customer_sender_id?.toString() || '' : row.agent_sender_id?.toString() || '',
                    senderName: row.sender_type === 'customer' ? row.customer_name : 
                               row.sender_type === 'agent' ? row.agent_name : 'System',
                    content: row.content,
                    highlightedContent, // 高亮版本
                    messageType: row.message_type,
                    createdAt: row.created_at,
                    platform: row.platform,
                    // 計算相關性分數（簡化版）
                    relevanceScore: messageHandler.calculateRelevance(row.content, q || '')
                };
            });

            // 按相關性排序
            const sortedMessages = searchMessages.sort((a, b) => b.relevanceScore - a.relevanceScore);

            const paginationMeta: ExtendedPaginationMeta = {
                page: parseInt(page),
                limit,
                total: countResult[0]?.total || 0,
                searchQuery: q
            };

            return paginatedResponse(c, sortedMessages, paginationMeta);

        } catch (error) {
            return handleApiError(error, c);
        }
    },

    // 搜索建議（自動完成）
    searchSuggestions: async (c: Context<{ Bindings: Bindings }>) => {
        try {
            const { q, limit = '10' } = c.req.query();
            
            if (!q || q.length < 1) {
                return successResponse(c, [], 'No suggestions');
            }

            // 獲取常見搜索詞（基於訊息內容）
            const db = createDbClient(c.env.DB);
            
            const suggestions = await db
                .select({
                    suggestion: sql`CASE 
                        WHEN LENGTH(${messages.content}) > 50 
                        THEN SUBSTR(${messages.content}, 1, 50) || '...'
                        ELSE ${messages.content}
                    END`,
                    frequency: count().as('frequency')
                })
                .from(messages)
                .where(and(
                    like(messages.content, `%${q}%`),
                    sql`LENGTH(${messages.content}) > 5`,
                    sql`LENGTH(${messages.content}) < 100`
                ))
                .groupBy(sql`suggestion`)
                .orderBy(sql`frequency DESC`, sql`suggestion ASC`)
                .limit(parseInt(limit));

            const formattedSuggestions = suggestions.map((row: any) => ({
                text: row.suggestion,
                frequency: row.frequency,
                type: 'content'
            }));

            return successResponse(c, formattedSuggestions, 'Search suggestions retrieved successfully');

        } catch (error) {
            return handleApiError(error, c);
        }
    },

    // 計算搜索結果相關性分數
    calculateRelevance: (content: string, query: string): number => {
        const contentLower = content.toLowerCase();
        const queryLower = query.toLowerCase();
        
        let score = 0;
        
        // 完全匹配加分
        if (contentLower.includes(queryLower)) {
            score += 10;
        }
        
        // 關鍵字出現次數
        const matches = contentLower.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
        if (matches) {
            score += matches.length * 5;
        }
        
        // 關鍵字在開頭出現加分
        if (contentLower.startsWith(queryLower)) {
            score += 15;
        }
        
        // 內容長度影響（較短的內容相關性更高）
        score += Math.max(0, 50 - content.length / 10);
        
        return score;
    },

    // 高級搜索（支持更複雜的查詢）
    advancedSearch: async (c: Context<{ Bindings: Bindings }>) => {
        try {
            const payload = c.get('jwtPayload');
            const {
                query: searchQuery,   // 搜索查詢
                exact,               // 精確匹配
                exclude,             // 排除詞
                customerName,        // 客戶名稱
                agentName,           // 客服名稱
                hasAttachments,      // 包含附件
                isRecalled,          // 已撤回
                sessionId,           // 會話ID
                priority,            // 對話優先級
                tags,                // 標籤
                conversationId,      // 對話ID
                senderType,          // 發送者類型
                messageType,         // 訊息類型
                startDate,           // 開始日期
                endDate,             // 結束日期
                page = '1',
                pageSize = '20'
            } = await c.req.json();

            const offset = (parseInt(page) - 1) * parseInt(pageSize);
            const limit = parseInt(pageSize);

            // 使用 Drizzle ORM 進行高級搜索
            const db = createDbClient(c.env.DB);
            
            // 定義表別名用於 JOIN
            const ct = aliasedTable(schema.conversationTags, 'ct');
            const tag = aliasedTable(schema.tags, 'tag');
            const cu = aliasedTable(customers, 'cu');
            const u = aliasedTable(agents, 'u');
            const conv = aliasedTable(conversations, 'conv');

            // 構建 WHERE 條件
            const whereConditions = [];

            // 權限控制
            if (payload?.role !== 'admin' && payload?.teamId) {
                whereConditions.push(
                    or(
                        eq(conv.assignedTeamId, payload.teamId),
                        sql`${conv.assignedTeamId} IS NULL`
                    )
                );
            }

            // 搜索查詢
            if (searchQuery) {
                if (exact === 'true') {
                    whereConditions.push(eq(messages.content, searchQuery));
                } else {
                    whereConditions.push(like(messages.content, `%${searchQuery}%`));
                }
            }

            // 排除詞
            if (exclude) {
                whereConditions.push(sql`${messages.content} NOT LIKE ${'%' + exclude + '%'}`);
            }

            // 客戶名稱
            if (customerName) {
                whereConditions.push(like(cu.displayName, `%${customerName}%`));
            }

            // 客服名稱
            if (agentName) {
                whereConditions.push(like(u.displayName, `%${agentName}%`));
            }

            // 包含附件
            if (hasAttachments === 'true') {
                whereConditions.push(sql`${messages.messageType} != 'text'`);
            } else if (hasAttachments === 'false') {
                whereConditions.push(eq(messages.messageType, 'text'));
            }

            // 已撤回訊息
            if (isRecalled === 'true') {
                whereConditions.push(eq(messages.isRecalled, true));
            } else if (isRecalled === 'false') {
                whereConditions.push(eq(messages.isRecalled, false));
            }

            // 會話ID
            if (sessionId) {
                whereConditions.push(eq(messages.sessionId, sessionId));
            }

            // 對話優先級
            if (priority) {
                whereConditions.push(eq(conv.priority, priority));
            }

            // 標籤
            if (tags && Array.isArray(tags) && tags.length > 0) {
                whereConditions.push(inArray(tag.id, tags));
            }

            // 執行查詢
            const result = await db
                .select({
                    id: messages.id,
                    conversationId: messages.conversationId,
                    senderType: messages.senderType,
                    agentSenderId: messages.agentSenderId,
                    content: messages.content,
                    messageType: messages.messageType,
                    isRecalled: messages.isRecalled,
                    sessionId: messages.sessionId,
                    createdAt: messages.createdAt,
                    priority: conv.priority,
                    customerName: cu.displayName,
                    platform: cu.platform,
                    agentName: u.displayName,
                    tagNames: sql`GROUP_CONCAT(${tag.name}, ',')`.as('tag_names')
                })
                .from(messages)
                .innerJoin(conv, eq(messages.conversationId, conv.id))
                .leftJoin(cu, eq(conv.customerId, cu.id))
                .leftJoin(u, and(
                    eq(messages.senderType, 'agent'),
                    eq(messages.agentSenderId, u.id)
                ))
                .leftJoin(ct, eq(conv.id, ct.conversationId))
                .leftJoin(tag, and(
                    eq(ct.tagId, tag.id),
                    eq(tag.isActive, true)
                ))
                .where(and(...whereConditions))
                .groupBy(messages.id)
                .orderBy(messages.createdAt) // ASC: 保持一致的排序
                .limit(limit)
                .offset(offset);

            // 計算總數
            const countResult = await db
                .select({ total: count(messages.id) })
                .from(messages)
                .innerJoin(conv, eq(messages.conversationId, conv.id))
                .leftJoin(cu, eq(conv.customerId, cu.id))
                .leftJoin(u, and(
                    eq(messages.senderType, 'agent'),
                    eq(messages.agentSenderId, u.id)
                ))
                .leftJoin(ct, eq(conv.id, ct.conversationId))
                .leftJoin(tag, and(
                    eq(ct.tagId, tag.id),
                    eq(tag.isActive, true)
                ))
                .where(and(...whereConditions));

            const searchResults = result.map((row: any) => ({
                id: row.id,
                conversationId: row.conversationId,
                conversation: {
                    priority: row.priority,
                    tags: row.tagNames ? row.tagNames.split(',') : []
                },
                senderType: row.senderType,
                senderName: row.senderType === 'customer' ? row.customerName : 
                           row.senderType === 'agent' ? row.agentName : 'System',
                content: row.content,
                messageType: row.messageType,
                isRecalled: Boolean(row.isRecalled),
                sessionId: row.sessionId,
                createdAt: row.createdAt,
                platform: row.platform
            }));

            const paginationMeta: ExtendedPaginationMeta = {
                page: parseInt(page),
                limit,
                total: countResult[0]?.total || 0,
                searchCriteria: {
                    ...(conversationId && { conversationId: parseInt(conversationId) }),
                    ...(senderType && { senderType }),
                    ...(messageType && { messageType }),
                    ...(startDate && endDate && { 
                        dateRange: {
                            start: startDate,
                            end: endDate
                        }
                    })
                }
            };

            return paginatedResponse(c, searchResults, paginationMeta);

        } catch (error) {
            return handleApiError(error, c);
        }
    }
};