// 訊息處理器
import type { Context } from 'hono';
import type { 
  Bindings, 
  Message, 
  // PaginatedResponse, // 暫時未使用
  // ConversationDbRecord, // 暫時未使用
  // AuthPayload, // 暫時未使用
  // SendMessageRequest, // 暫時未使用
  // MessageSearchParams, // 暫時未使用
  ExtendedPaginationMeta
} from '../types';
import { 
  successResponse, 
  paginatedResponse,
  // errorResponse, // 暫時未使用 
  validationErrorResponse, 
  notFoundResponse,
  handleApiError 
} from '../utils/api-response';

export const messageHandler = {
    // 獲取對話訊息列表
    list: async (c: Context<{ Bindings: Bindings }>) => {
        try {
            const conversationId = c.req.param('id');
            const page = parseInt(c.req.query('page') || '1');
            const pageSize = parseInt(c.req.query('pageSize') || '50');

            const offset = (page - 1) * pageSize;

            // 獲取訊息列表
            const messages = await c.env.DB.prepare(`
        SELECT m.*, 
               CASE 
                 WHEN m.sender_type = 'customer' THEN cu.display_name
                 WHEN m.sender_type = 'agent' THEN u.displayName
                 ELSE 'System'
               END as sender_name
        FROM messages m
        LEFT JOIN customers cu ON m.sender_type = 'customer' AND m.sender_id = cu.id
        LEFT JOIN users u ON m.sender_type = 'agent' AND m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
        LIMIT ? OFFSET ?
      `).bind(conversationId, pageSize, offset).all();

            // 獲取總數
            const totalResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as total
        FROM messages
        WHERE conversation_id = ?
      `).bind(conversationId).first();

            const total = Number(totalResult?.total) || 0;

            // 轉換為新的格式
            const items: Message[] = messages?.results ? messages.results.map((row: any) => ({
                id: row.id,
                conversationId: row.conversation_id.toString(),
                senderType: row.sender_type === 'customer' ? 'user' : 'agent',
                senderId: row.sender_id?.toString() || '',
                content: row.content,
                mediaUrl: '', // 需要根據 message_type 處理
                mediaType: row.message_type as 'text' | 'image' | 'video' | 'file',
                platform: 'line' as const, // 需要從其他地方獲取
                createdAt: new Date(row.created_at).getTime()
            })) : [];

            return paginatedResponse(c, items, {
                page,
                limit: pageSize,
                total
            }, 'Messages retrieved successfully');

        } catch (error) {
            return handleApiError(error, c);
        }
    },

    // 發送訊息
    send: async (c: Context<{ Bindings: Bindings }>) => {
        try {
            const conversationId = c.req.param('id');
            const payload = c.get('jwtPayload');
            const { content, mediaUrl, mediaType, attachmentIds } = await c.req.json();

            if (!content && !mediaUrl && (!attachmentIds || attachmentIds.length === 0)) {
                return validationErrorResponse(c, [
                    { field: 'content', message: 'Content, media, or attachments are required' }
                ]);
            }

            // 獲取對話資訊以確定平台
            const conversation = await c.env.DB.prepare(`
        SELECT c.*, cu.platform, cu.platform_user_id
        FROM conversations c
        JOIN customers cu ON c.customer_id = cu.id
        WHERE c.id = ?
      `).bind(conversationId).first();

            if (!conversation) {
                return notFoundResponse(c, 'Conversation');
            }

            // 生成訊息 ID
            const messageId = crypto.randomUUID();
            const hasAttachments = attachmentIds && attachmentIds.length > 0;

            // 儲存訊息到資料庫
            await c.env.DB.prepare(`
        INSERT INTO messages (
          id, conversation_id, sender_type, sender_id, content, 
          message_type, platform_message_id, is_sent, delivery_status, has_attachments, created_at
        ) VALUES (?, ?, 'agent', ?, ?, ?, ?, 0, 'pending', ?, CURRENT_TIMESTAMP)
      `).bind(
                messageId,
                conversationId,
                payload.userId,
                content || '',
                mediaType || (hasAttachments ? 'file' : 'text'),
                null,
                hasAttachments
            ).run();

            // 如果有附件，更新附件的 message_id
            if (hasAttachments) {
                for (const attachmentId of attachmentIds) {
                    await c.env.DB.prepare(`
            UPDATE file_attachments 
            SET message_id = ?, updated_at = ?
            WHERE id = ? AND conversation_id = ?
          `).bind(messageId, Date.now(), attachmentId, conversationId).run();
                }
            }

            // 根據平台發送訊息
            let sendResult = false;
            // let errorMessage = ''; // 暫時未使用

            try {
                if (conversation.platform === 'line') {
                    // 發送 LINE 訊息 - 使用 Push API 因為沒有 replyToken
                    const { pushLineMessage, createTextMessage, createImageMessage, createVideoMessage, createAudioMessage, createFileMessage } = await import('../utils/line');
                    
                    let messages: any[] = [];
                    
                    if (mediaType && mediaUrl) {
                        // 發送多媒體訊息
                        switch (mediaType) {
                            case 'image':
                                messages.push(createImageMessage(mediaUrl, mediaUrl)); // originalContentUrl, previewImageUrl
                                break;
                            case 'video':
                                messages.push(createVideoMessage(mediaUrl, mediaUrl)); // originalContentUrl, previewImageUrl
                                break;
                            case 'audio':
                                messages.push(createAudioMessage(mediaUrl, 60000)); // originalContentUrl, duration (暫時設為60秒)
                                break;
                            case 'file':
                                messages.push(createFileMessage(mediaUrl, content || 'File'));
                                break;
                            default:
                                if (content) {
                                    messages.push(createTextMessage(content));
                                }
                        }
                    } else if (content) {
                        // 發送文字訊息
                        messages.push(createTextMessage(content));
                    }

                    // 處理附件
                    if (hasAttachments) {
                        // 獲取附件資訊
                        const attachments = await c.env.DB.prepare(`
                            SELECT * FROM file_attachments 
                            WHERE id IN (${attachmentIds.map(() => '?').join(',')})
                        `).bind(...attachmentIds).all();

                        for (const attachment of attachments.results) {
                            const att = attachment as any;
                            const fileUrl = att.file_url || att.url;
                            
                            if (fileUrl) {
                                if (att.mime_type?.startsWith('image/')) {
                                    messages.push(createImageMessage(fileUrl, fileUrl));
                                } else if (att.mime_type?.startsWith('video/')) {
                                    messages.push(createVideoMessage(fileUrl, fileUrl));
                                } else if (att.mime_type?.startsWith('audio/')) {
                                    messages.push(createAudioMessage(fileUrl, 60000));
                                } else {
                                    messages.push(createFileMessage(fileUrl, att.filename || 'File'));
                                }
                            }
                        }
                    }

                    if (messages.length > 0) {
                        sendResult = await pushLineMessage(
                            c.env.LINE_CHANNEL_ACCESS_TOKEN, 
                            String(conversation.platform_user_id), 
                            messages
                        );
                    }
                } else if (conversation.platform === 'facebook') {
                    // 發送 Facebook Messenger 訊息
                    const { FacebookAdapter } = await import('../integrations/platform-adapter');
                    const facebookAdapter = new FacebookAdapter(c.env.FB_APP_SECRET, c.env.FB_PAGE_ACCESS_TOKEN);
                    
                    if (mediaType && mediaUrl) {
                        // 發送多媒體訊息
                        switch (mediaType) {
                            case 'image':
                                sendResult = await facebookAdapter.sendImageMessage(String(conversation.platform_user_id), mediaUrl);
                                break;
                            case 'video':
                                sendResult = await facebookAdapter.sendVideoMessage(String(conversation.platform_user_id), mediaUrl);
                                break;
                            case 'audio':
                                sendResult = await facebookAdapter.sendAudioMessage(String(conversation.platform_user_id), mediaUrl);
                                break;
                            case 'file':
                                sendResult = await facebookAdapter.sendFileMessage(String(conversation.platform_user_id), mediaUrl, content || 'File');
                                break;
                            default:
                                if (content) {
                                    sendResult = await facebookAdapter.sendTextMessage(String(conversation.platform_user_id), content);
                                }
                        }
                    } else if (content) {
                        sendResult = await facebookAdapter.sendTextMessage(String(conversation.platform_user_id), content);
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
                                    attachmentResult = await facebookAdapter.sendImageMessage(String(conversation.platform_user_id), fileUrl);
                                } else if (att.mime_type?.startsWith('video/')) {
                                    attachmentResult = await facebookAdapter.sendVideoMessage(String(conversation.platform_user_id), fileUrl);
                                } else if (att.mime_type?.startsWith('audio/')) {
                                    attachmentResult = await facebookAdapter.sendAudioMessage(String(conversation.platform_user_id), fileUrl);
                                } else {
                                    attachmentResult = await facebookAdapter.sendFileMessage(String(conversation.platform_user_id), fileUrl, att.filename || 'File');
                                }
                                
                                if (!attachmentResult) {
                                    console.error('Failed to send Facebook attachment:', att.filename);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to send ${conversation.platform} message:`, error);
                // errorMessage = error instanceof Error ? error.message : 'Unknown error'; // 暫時未使用
                sendResult = false;
            }

            // 更新訊息發送狀態
            await c.env.DB.prepare(`
        UPDATE messages 
        SET is_sent = ?, delivery_status = ?, sent_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(sendResult ? 1 : 0, sendResult ? 'sent' : 'failed', messageId).run();

            // 更新對話的最後訊息時間
            await c.env.DB.prepare(`
        UPDATE conversations 
        SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(conversationId).run();

            const message: Message = {
                id: messageId,
                conversationId: conversationId,
                senderType: 'agent',
                senderId: payload.userId.toString(),
                content: content,
                mediaUrl,
                mediaType,
                platform: conversation.platform as 'line' | 'facebook',
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
                LEFT JOIN users u ON m.sender_type = 'agent' AND m.sender_id = u.id
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
                    senderId: row.sender_id,
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
                LEFT JOIN users u ON m.sender_type = 'agent' AND m.sender_id = u.id
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
                LEFT JOIN users u ON m.sender_type = 'agent' AND m.sender_id = u.id
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