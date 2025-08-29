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
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema';

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
            .orderBy(desc(schema.messages.createdAt))
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
                    const { pushLineMessage, createTextMessage } = await import('../utils/line');
                    let messages: any[] = [];
                    
                    if (content) {
                        messages.push(createTextMessage(content));
                    }

                    if (messages.length > 0) {
                        sendResult = await pushLineMessage(
                            c.env.LINE_CHANNEL_ACCESS_TOKEN, 
                            conversationWithCustomer.platformUserId, 
                            messages
                        );
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
                        const attachments = await c.env.DB.prepare(`
                            SELECT * FROM file_attachments 
                            WHERE id IN (${attachmentIds.map(() => '?').join(',')})
                        `).bind(...attachmentIds).all();

                        for (const attachment of attachments.results) {
                            const att = attachment as any;
                            const fileUrl = att.file_url || att.url;
                            
                            if (fileUrl) {
                                let attachmentResult = false;
                                
                                if (att.mime_type?.startsWith('image/')) {
                                    attachmentResult = await facebookAdapter.sendImageMessage(String(conversationWithCustomer.platformUserId), fileUrl);
                                } else if (att.mime_type?.startsWith('video/')) {
                                    attachmentResult = await facebookAdapter.sendVideoMessage(String(conversationWithCustomer.platformUserId), fileUrl);
                                } else if (att.mime_type?.startsWith('audio/')) {
                                    attachmentResult = await facebookAdapter.sendAudioMessage(String(conversationWithCustomer.platformUserId), fileUrl);
                                } else {
                                    attachmentResult = await facebookAdapter.sendFileMessage(String(conversationWithCustomer.platformUserId), fileUrl, att.filename || 'File');
                                }
                                
                                if (!attachmentResult) {
                                    console.error('Failed to send Facebook attachment:', att.filename);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to send ${conversationWithCustomer.platform} message:`, error);
                // errorMessage = error instanceof Error ? error.message : 'Unknown error'; // 暫時未使用
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

            // ✅ 記錄活動以觸發 SSE 更新
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
                        sendResult: sendResult
                    }
                });

                if (activity) {
                    console.log('✅ [Agent Message] Activity recorded, triggering SSE broadcast...');
                    
                    // 🚨 關鍵：觸發 SSE 推送
                    const { broadcastActivity } = await import('./activity-stream');
                    await broadcastActivity(c.env, activity);
                    
                    console.log('📢 [Agent Message] SSE broadcast triggered successfully');
                } else {
                    console.warn('⚠️ [Agent Message] Failed to create activity, skipping SSE broadcast');
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

            // 構建搜索查詢
            let query = `
                SELECT DISTINCT m.*,
                       c.id as conversation_id,
                       cu.display_name as customer_name,
                       cu.platform,
                       cu.platform_user_id,
                       cu.avatar_url,
                       u.display_name as agent_name,
                       u.email as agent_email,
                       t.name as team_name
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                LEFT JOIN customers cu ON c.customer_id = cu.id
                LEFT JOIN users u ON m.sender_type = 'agent' AND m.agent_sender_id = u.id
                LEFT JOIN teams t ON c.assigned_team_id = t.id
            `;

            const whereConditions: string[] = [];
            const params: any[] = [];

            // 權限控制：非管理員只能搜索自己團隊的對話
            if (payload?.role !== 'admin' && payload?.teamId) {
                whereConditions.push('(c.assigned_team_id = ? OR c.assigned_team_id IS NULL)');
                params.push(payload.teamId);
            }

            // 全文搜索
            whereConditions.push('m.content LIKE ?');
            params.push(`%${q}%`);

            // 特定對話
            if (conversationId) {
                whereConditions.push('m.conversation_id = ?');
                params.push(parseInt(conversationId));
            }

            // 發送者類型
            if (senderType) {
                whereConditions.push('m.sender_type = ?');
                params.push(senderType);
            }

            // 訊息類型
            if (messageType) {
                whereConditions.push('m.message_type = ?');
                params.push(messageType);
            }

            // 日期範圍
            if (dateFrom) {
                whereConditions.push('m.created_at >= ?');
                params.push(dateFrom);
            }
            if (dateTo) {
                whereConditions.push('m.created_at <= ?');
                params.push(dateTo);
            }

            // 平台篩選
            if (platform) {
                whereConditions.push('cu.platform = ?');
                params.push(platform);
            }

            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            // 執行搜索
            const result = await c.env.DB.prepare(query).bind(...params).all();

            // 計算總數
            let countQuery = `
                SELECT COUNT(DISTINCT m.id) as total
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                LEFT JOIN customers cu ON c.customer_id = cu.id
                LEFT JOIN teams t ON c.assigned_team_id = t.id
            `;

            if (whereConditions.length > 0) {
                countQuery += ' WHERE ' + whereConditions.join(' AND ');
            }

            const countParams = params.slice(0, -2); // 移除 LIMIT 和 OFFSET
            const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

            // 格式化結果並高亮顯示
            const messages = result.results.map((row: any) => {
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
            const sortedMessages = messages.sort((a, b) => b.relevanceScore - a.relevanceScore);

            const paginationMeta: ExtendedPaginationMeta = {
                page: parseInt(page),
                limit,
                total: (countResult?.total as number) || 0,
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
            const suggestions = await c.env.DB.prepare(`
                SELECT DISTINCT 
                    CASE 
                        WHEN LENGTH(content) > 50 THEN SUBSTR(content, 1, 50) || '...'
                        ELSE content
                    END as suggestion,
                    COUNT(*) as frequency
                FROM messages 
                WHERE content LIKE ? 
                    AND LENGTH(content) > 5
                    AND LENGTH(content) < 100
                GROUP BY suggestion
                ORDER BY frequency DESC, suggestion ASC
                LIMIT ?
            `).bind(`%${q}%`, parseInt(limit)).all();

            const formattedSuggestions = suggestions.results.map((row: any) => ({
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

            let query = `
                SELECT DISTINCT m.*,
                       c.id as conversation_id,
                       c.priority,
                       cu.display_name as customer_name,
                       cu.platform,
                       u.display_name as agent_name,
                       GROUP_CONCAT(tag.name, ',') as tag_names
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                LEFT JOIN customers cu ON c.customer_id = cu.id
                LEFT JOIN users u ON m.sender_type = 'agent' AND m.agent_sender_id = u.id
                LEFT JOIN conversation_tags ct ON c.id = ct.conversation_id
                LEFT JOIN tags tag ON ct.tag_id = tag.id AND tag.is_active = TRUE
            `;

            const whereConditions: string[] = [];
            const params: any[] = [];

            // 權限控制
            if (payload?.role !== 'admin' && payload?.teamId) {
                whereConditions.push('(c.assigned_team_id = ? OR c.assigned_team_id IS NULL)');
                params.push(payload.teamId);
            }

            // 搜索查詢
            if (searchQuery) {
                if (exact === 'true') {
                    whereConditions.push('m.content = ?');
                    params.push(searchQuery);
                } else {
                    whereConditions.push('m.content LIKE ?');
                    params.push(`%${searchQuery}%`);
                }
            }

            // 排除詞
            if (exclude) {
                whereConditions.push('m.content NOT LIKE ?');
                params.push(`%${exclude}%`);
            }

            // 客戶名稱
            if (customerName) {
                whereConditions.push('cu.display_name LIKE ?');
                params.push(`%${customerName}%`);
            }

            // 客服名稱
            if (agentName) {
                whereConditions.push('u.display_name LIKE ?');
                params.push(`%${agentName}%`);
            }

            // 包含附件
            if (hasAttachments === 'true') {
                whereConditions.push('m.message_type != ?');
                params.push('text');
            } else if (hasAttachments === 'false') {
                whereConditions.push('m.message_type = ?');
                params.push('text');
            }

            // 已撤回訊息
            if (isRecalled === 'true') {
                whereConditions.push('m.is_recalled = TRUE');
            } else if (isRecalled === 'false') {
                whereConditions.push('m.is_recalled = FALSE');
            }

            // 會話ID
            if (sessionId) {
                whereConditions.push('m.session_id = ?');
                params.push(sessionId);
            }

            // 對話優先級
            if (priority) {
                whereConditions.push('c.priority = ?');
                params.push(priority);
            }

            // 標籤
            if (tags && Array.isArray(tags) && tags.length > 0) {
                const tagPlaceholders = tags.map(() => '?').join(',');
                whereConditions.push(`tag.id IN (${tagPlaceholders})`);
                params.push(...tags);
            }

            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const result = await c.env.DB.prepare(query).bind(...params).all();

            // 計算總數
            let countQuery = `
                SELECT COUNT(DISTINCT m.id) as total
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                LEFT JOIN customers cu ON c.customer_id = cu.id
                LEFT JOIN users u ON m.sender_type = 'agent' AND m.agent_sender_id = u.id
                LEFT JOIN conversation_tags ct ON c.id = ct.conversation_id
                LEFT JOIN tags tag ON ct.tag_id = tag.id AND tag.is_active = TRUE
            `;

            if (whereConditions.length > 0) {
                countQuery += ' WHERE ' + whereConditions.join(' AND ');
            }

            const countParams = params.slice(0, -2);
            const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

            const messages = result.results.map((row: any) => ({
                id: row.id,
                conversationId: row.conversation_id,
                conversation: {
                    priority: row.priority,
                    tags: row.tag_names ? row.tag_names.split(',') : []
                },
                senderType: row.sender_type,
                senderName: row.sender_type === 'customer' ? row.customer_name : 
                           row.sender_type === 'agent' ? row.agent_name : 'System',
                content: row.content,
                messageType: row.message_type,
                isRecalled: Boolean(row.is_recalled),
                sessionId: row.session_id,
                createdAt: row.created_at,
                platform: row.platform
            }));

            const paginationMeta: ExtendedPaginationMeta = {
                page: parseInt(page),
                limit,
                total: (countResult?.total as number) || 0,
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

            return paginatedResponse(c, messages, paginationMeta);

        } catch (error) {
            return handleApiError(error, c);
        }
    }
};