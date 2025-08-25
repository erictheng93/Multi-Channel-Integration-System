// 主要入口點 - Handler-based 架構
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { 
  Bindings, 
  LineEvent, 
  LineWebhookBody
} from './types';
import { findOrCreateCustomer, findOrCreateConversation, saveMessage } from './utils/database';
import { sendLineReply, verifyLineSignature, createTextMessage } from './utils/line';

// 導入所有 handlers
import {
  authMainHandler,
  teamMainHandler,
  delayedMessageMainHandler,
  conversationMainHandler,
  systemMainHandler,
  customerMainHandler,
  qrcodeMainHandler,
  sessionMainHandler
} from './handlers';
import { activityHandler } from './handlers/activity';
import { activityStreamHandler } from './handlers/activity-stream';
import {
  getSystemInfo,
  getSettings,
  updateSettings,
  testIntegration,
  getMetrics,
  backupDatabase,
  getBackups,
  restoreDatabase,
  clearCache,
  restartSystem,
  healthCheck,
  getApiStatus
} from './handlers/system';
import { 
  getTeamMembers, 
  addTeamMember, 
  inviteMember, 
  updateMemberStatus,
  updateMemberRole,
  resetMemberPassword,
  resetPasswordWithPolicy,
  changePassword,
  deleteMember, 
  getInvitations, 
  revokeInvitation,
  getMemberPassword,
  updateMember,
  migratePasswords
} from './handlers/team';
import {
  storeCredential,
  getCredential,
  getAllCredentials,
  clearPlatformCredentials,
  backupCredentials
} from './handlers/credentials';
import { jwtAuth } from './middleware/auth';

const app = new Hono<{ Bindings: Bindings }>();

// 添加中間件
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ==================== 基礎路由 ====================

// 根路由
app.get('/', (c) => {
  return c.json({
    message: 'Hello! My LINE Bot Worker is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});


// ==================== 路由註冊 ====================

// 系統相關路由 (健康檢查、統計等)
app.route('/', systemMainHandler);
app.route('/api', systemMainHandler);

// 系統設定路由
app.get('/api/system/info', jwtAuth, getSystemInfo);
app.get('/api/system/settings', jwtAuth, getSettings);
app.put('/api/system/settings', jwtAuth, updateSettings);
app.post('/api/system/integrations/:platform/test', jwtAuth, testIntegration);
app.get('/api/system/metrics', jwtAuth, getMetrics);
app.post('/api/system/database/backup', jwtAuth, backupDatabase);
app.get('/api/system/database/backups', jwtAuth, getBackups);
app.post('/api/system/database/restore/:backupId', jwtAuth, restoreDatabase);
app.post('/api/system/cache/clear', jwtAuth, clearCache);
app.post('/api/system/restart', jwtAuth, restartSystem);
app.get('/api/system/health', healthCheck);
app.get('/api/system/api-status', getApiStatus);

// 憑證管理路由
app.post('/api/credentials', jwtAuth, storeCredential);
app.get('/api/credentials/:platform/:type', jwtAuth, getCredential);
app.get('/api/credentials', jwtAuth, getAllCredentials);
app.delete('/api/credentials/:platform', jwtAuth, clearPlatformCredentials);
app.get('/api/credentials/backup', jwtAuth, backupCredentials);

// 認證相關路由
app.route('/api/auth', authMainHandler);

// 團隊管理路由
app.route('/api/teams', teamMainHandler);

// 新的團隊管理 API 路由
app.get('/api/team/members', jwtAuth, getTeamMembers);
app.post('/api/team/members', jwtAuth, addTeamMember);
app.post('/api/team/invite', jwtAuth, inviteMember);
app.put('/api/team/members/:id/status', jwtAuth, updateMemberStatus);
app.put('/api/team/members/:id/role', jwtAuth, updateMemberRole);
app.get('/api/team/members/:id/password', jwtAuth, getMemberPassword);
app.put('/api/team/members/:id', jwtAuth, updateMember);
app.post('/api/team/members/:id/reset-password', jwtAuth, resetMemberPassword);
app.post('/api/team/members/:id/reset-password-policy', jwtAuth, resetPasswordWithPolicy);
app.post('/api/auth/change-password', changePassword);
app.delete('/api/team/members/:id', jwtAuth, deleteMember);
app.get('/api/team/invitations', jwtAuth, getInvitations);
app.delete('/api/team/invitations/:id', jwtAuth, revokeInvitation);
app.post('/api/team/migrate-passwords', jwtAuth, migratePasswords); // 臨時遷移端點

// 延遲訊息路由
app.route('/api/delayed-messages', delayedMessageMainHandler);

// 對話管理路由
app.route('/api/conversations', conversationMainHandler);

// 客戶管理路由
app.route('/api/customers', customerMainHandler);

// QR Code 相關路由
app.route('/api/qr-codes', qrcodeMainHandler);
app.route('/', qrcodeMainHandler); // 為了 /join 路由

// 會話管理路由
app.route('/api/sessions', sessionMainHandler);

// 活動記錄路由
app.get('/api/activities', jwtAuth, activityHandler.list);
app.get('/api/activities/users/:userId/stats', jwtAuth, activityHandler.getUserStats);
app.get('/api/activities/overview', jwtAuth, activityHandler.getOverview);
app.delete('/api/activities/cleanup', jwtAuth, activityHandler.cleanup);

// SSE 活動流路由 (不使用 jwtAuth 中間件，在處理器內部驗證)
app.get('/api/activities/stream', activityStreamHandler.connect);

// ==================== Webhook 處理 ====================

// 處理 LINE Webhook 的路由（保持原有實現）
app.post('/api/webhook', async (c) => {
  try {
    const rawBody = await c.req.text();
    const body: LineWebhookBody = JSON.parse(rawBody);
    
    console.log(`Received webhook: ${JSON.stringify(body, null, 2)}`);

    const { events } = body;

    // LINE Signature 驗證（生產環境建議啟用）
    const signature = c.req.header('x-line-signature');
    const isValidSignature = await verifyLineSignature(rawBody, signature, c.env.LINE_CHANNEL_SECRET);
    
    if (!isValidSignature) {
      console.warn('Invalid LINE signature');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!events || events.length === 0) {
      return c.json({ message: 'No events received' }, 200);
    }

    // 準備一個 Promise 陣列來處理所有事件的非同步任務
    const tasks = events.map((event: LineEvent) => {
      switch (event.type) {
        case 'message':
          if (event.message?.type === 'text') {
            return handleTextMessageEvent(c, event);
          }
          break;
        case 'follow':
          return handleFollowEvent(c, event);
        case 'unfollow':
          return handleUnfollowEvent(c, event);
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      return Promise.resolve();
    });

    // 使用 waitUntil 來確保所有背景任務在回覆後也能完成
    c.executionCtx.waitUntil(Promise.all(tasks));

    // 立即回覆 LINE 一個 OK，表示已收到請求
    return c.json({ message: 'OK' }, 200);

  } catch (error) {
    console.error('Error processing webhook:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// ==================== Webhook 事件處理函數 ====================

/**
 * 處理文字訊息事件
 */
async function handleTextMessageEvent(
  c: { env: Bindings }, 
  event: LineEvent
): Promise<void> {
  const lineUserId = event.source.userId;
  const messageText = event.message?.text;
  const messageId = event.message?.id;

  if (!messageText || !messageId || !event.replyToken) {
    console.error('Missing required message data');
    return;
  }

  try {
    console.log(`📱 處理來自用戶 ${lineUserId} 的訊息: "${messageText}"`);

    // 1. 尋找或建立客戶
    const customer = await findOrCreateCustomer(c.env.DB, 'line', lineUserId);
    console.log(`👤 客戶處理完成 - ID: ${customer.id}, 平台: ${customer.platform}`);
    
    // 2. 尋找或建立對話
    const conversation = await findOrCreateConversation(c.env.DB, customer.id);
    console.log(`💬 對話處理完成 - ID: ${conversation.id}, 狀態: ${conversation.status}`);
    
    // 3. 生成線程ID（用於關聯這組對話）
    const threadId = `thread_${conversation.id}_${Date.now()}`;
    
    // 4. 儲存傳入的訊息到 D1 資料庫
    const inboundMessage = await saveMessage(c.env.DB, {
      id: messageId,
      conversationId: conversation.id,
      senderType: 'customer',
      senderId: customer.id,
      content: messageText,
      messageType: 'text',
      platformMessageId: messageId,
      direction: 'inbound',
      threadId: threadId,
      metadata: {
        lineUserId: lineUserId,
        replyToken: event.replyToken,
        webhookEventId: (event as any).webhookEventId,
        timestamp: event.timestamp
      }
    });
    console.log(`💾 傳入訊息已儲存 - ID: ${inboundMessage.id}`);

    // 5. 生成回覆訊息
    const replyText = generateReplyText(messageText);
    const replyMessage = createTextMessage(replyText);
    console.log(`🤖 生成回覆訊息: "${replyText}"`);

    // 6. 發送回覆到 LINE 平台
    const success = await sendLineReply(
      c.env.LINE_CHANNEL_ACCESS_TOKEN,
      event.replyToken,
      [replyMessage]
    );

    if (success) {
      // 7. 儲存發送的回覆訊息到 D1 資料庫
      const replyId = `reply_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const outboundMessage = await saveMessage(c.env.DB, {
        id: replyId,
        conversationId: conversation.id,
        senderType: 'agent',
        content: replyText,
        messageType: 'text',
        direction: 'outbound',
        replyToMessageId: messageId,
        threadId: threadId,
        metadata: {
          originalMessageId: messageId,
          originalContent: messageText,
          replyMethod: 'line_reply_api',
          generatedAt: new Date().toISOString()
        }
      });
      console.log(`💾 回覆訊息已儲存 - ID: ${outboundMessage.id}`);
      console.log(`✅ 完整流程完成: 手機 → LINE → Worker → D1 → Worker → LINE → 手機`);
    } else {
      console.error('❌ 發送回覆失敗，未儲存回覆訊息');
    }

  } catch (error) {
    console.error('❌ 處理文字訊息時發生錯誤:', error);
  }
}

/**
 * 處理用戶關注事件
 */
async function handleFollowEvent(
  c: { env: Bindings }, 
  event: LineEvent
): Promise<void> {
  const lineUserId = event.source.userId;

  try {
    // 建立或更新客戶資料
    await findOrCreateCustomer(c.env.DB, 'line', lineUserId);
    
    if (event.replyToken) {
      const welcomeMessage = createTextMessage('歡迎加入！我是您的專屬客服助手，有任何問題都可以問我喔！');
      await sendLineReply(
        c.env.LINE_CHANNEL_ACCESS_TOKEN,
        event.replyToken,
        [welcomeMessage]
      );
    }

    console.log(`User ${lineUserId} followed the bot`);
  } catch (error) {
    console.error('Error handling follow event:', error);
  }
}

/**
 * 處理用戶取消關注事件
 */
async function handleUnfollowEvent(
  _c: { env: Bindings }, 
  event: LineEvent
): Promise<void> {
  const lineUserId = event.source.userId;
  console.log(`User ${lineUserId} unfollowed the bot`);
  
  // 可以在這裡記錄取消關注的事件，但不需要回覆訊息
}

/**
 * 生成回覆文字
 */
function generateReplyText(inputText: string): string {
  // 簡單的鸚鵡回覆邏輯，未來可以擴展為更智能的回覆
  const responses = [
    `您說了：「${inputText}」`,
    `我收到您的訊息：${inputText}`,
    `謝謝您的訊息：${inputText}，我會盡快為您處理！`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)] || responses[0] || '謝謝您的訊息！';
}

// ==================== 錯誤處理 ====================

// 全域錯誤處理
app.onError((err, c) => {
  console.error('Global error handler:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

// ==================== 靜態檔案服務 ====================

// 管理後台 HTML
app.get('/admin-dashboard.html', (c) => {
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多渠道客服管理系統</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e1e5e9;
        }

        .card h3 {
            color: #2d3748;
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 0.5rem;
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background: #5a67d8;
        }

        .btn-secondary {
            background: #718096;
        }

        .btn-secondary:hover {
            background: #4a5568;
        }

        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }

        .status-online {
            background-color: #48bb78;
        }

        .status-offline {
            background-color: #f56565;
        }

        .quick-actions {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            margin-top: 1rem;
        }

        .alert {
            background: #fed7d7;
            border: 1px solid #feb2b2;
            color: #c53030;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
        }

        .alert-info {
            background: #bee3f8;
            border: 1px solid #90cdf4;
            color: #2b6cb0;
        }

        @media (max-width: 768px) {
            .container {
                padding: 0 0.5rem;
            }
            
            .dashboard-grid {
                grid-template-columns: 1fr;
            }
            
            .quick-actions {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 多渠道客服管理系統</h1>
    </div>

    <div class="container">
        <div class="alert alert-info">
            <strong>歡迎使用管理後台！</strong> 這是一個基本的管理介面，用於監控系統狀態和管理客服對話。
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <h3>📊 系統狀態</h3>
                <div class="stat-number" id="system-status">
                    <span class="status-indicator status-online"></span>
                    運行中
                </div>
                <p>系統正常運行</p>
                <div class="quick-actions">
                    <button class="btn" onclick="checkSystemHealth()">檢查健康狀態</button>
                </div>
            </div>

            <div class="card">
                <h3>💬 對話統計</h3>
                <div class="stat-number" id="conversation-count">載入中...</div>
                <p>總對話數量</p>
                <div class="quick-actions">
                    <button class="btn" onclick="loadConversations()">查看對話</button>
                </div>
            </div>

            <div class="card">
                <h3>👥 客戶統計</h3>
                <div class="stat-number" id="customer-count">載入中...</div>
                <p>總客戶數量</p>
                <div class="quick-actions">
                    <button class="btn" onclick="loadCustomers()">管理客戶</button>
                </div>
            </div>

            <div class="card">
                <h3>📱 LINE 整合</h3>
                <div class="stat-number">
                    <span class="status-indicator status-online"></span>
                    已連接
                </div>
                <p>LINE Bot 狀態</p>
                <div class="quick-actions">
                    <button class="btn" onclick="testLineConnection()">測試連接</button>
                </div>
            </div>

            <div class="card">
                <h3>🔧 快速操作</h3>
                <div class="quick-actions">
                    <button class="btn" onclick="viewLogs()">查看日誌</button>
                    <button class="btn btn-secondary" onclick="exportData()">匯出資料</button>
                    <button class="btn btn-secondary" onclick="systemSettings()">系統設定</button>
                </div>
            </div>

            <div class="card">
                <h3>📈 最近活動</h3>
                <div id="recent-activity">
                    <p>載入最近活動...</p>
                </div>
                <div class="quick-actions">
                    <button class="btn" onclick="refreshActivity()">重新整理</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 基本的 JavaScript 功能
        const API_BASE = window.location.origin;

        // 載入統計資料
        async function loadStats() {
            try {
                const response = await fetch(\`\${API_BASE}/api/stats\`);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('conversation-count').textContent = data.data.totalConversations || 0;
                    document.getElementById('customer-count').textContent = data.data.totalCustomers || 0;
                }
            } catch (error) {
                console.error('載入統計資料失敗:', error);
                document.getElementById('conversation-count').textContent = '錯誤';
                document.getElementById('customer-count').textContent = '錯誤';
            }
        }

        // 檢查系統健康狀態
        async function checkSystemHealth() {
            try {
                const response = await fetch(\`\${API_BASE}/api/health\`);
                const data = await response.json();
                
                if (data.status === 'healthy') {
                    alert('✅ 系統健康狀態良好！');
                } else {
                    alert('⚠️ 系統狀態異常，請檢查日誌');
                }
            } catch (error) {
                alert('❌ 無法檢查系統狀態：' + error.message);
            }
        }

        // 其他功能的佔位符
        function loadConversations() {
            alert('對話管理功能開發中...');
        }

        function loadCustomers() {
            alert('客戶管理功能開發中...');
        }

        function testLineConnection() {
            alert('LINE 連接測試功能開發中...');
        }

        function viewLogs() {
            alert('日誌查看功能開發中...');
        }

        function exportData() {
            alert('資料匯出功能開發中...');
        }

        function systemSettings() {
            alert('系統設定功能開發中...');
        }

        function refreshActivity() {
            document.getElementById('recent-activity').innerHTML = '<p>重新整理中...</p>';
            setTimeout(() => {
                document.getElementById('recent-activity').innerHTML = '<p>暫無最近活動</p>';
            }, 1000);
        }

        // 頁面載入時執行
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            
            // 每30秒重新整理統計資料
            setInterval(loadStats, 30000);
        });
    </script>
</body>
</html>`;

  return c.html(html);
});

// 404 處理
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint was not found',
    timestamp: new Date().toISOString()
  }, 404);
});

// ==================== Queue Consumer ====================

import { MessageRecallService } from './services/message-recall-service';

interface QueueMessage {
  messageId: string;
  action: string;
  timestamp: string;
}

/**
 * 判斷錯誤是否可重試
 */
function isRetryableError(error?: string): boolean {
  if (!error) return false;

  const retryableErrors = [
    'network error',
    'timeout',
    'rate limit',
    'temporary failure',
    'service unavailable'
  ];

  return retryableErrors.some(retryableError => 
    error.toLowerCase().includes(retryableError)
  );
}

/**
 * Queue Consumer 處理延遲訊息
 * 這個函數會被 Cloudflare Workers 自動調用
 */
export async function queue(
  batch: MessageBatch<QueueMessage>,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  console.log(`Processing queue batch with ${batch.messages.length} messages`);
  
  const recallService = new MessageRecallService(env);

  // 處理批次中的每個訊息
  for (const message of batch.messages) {
    try {
      const { messageId, action } = message.body;

      console.log(`Processing queue message: ${messageId}, action: ${action}`);

      if (action === 'send_delayed_message') {
        const result = await recallService.processQueueMessage(messageId);
        
        if (result.success) {
          if (result.skipped) {
            console.log(`Message ${messageId} was cancelled, skipped sending`);
          } else {
            console.log(`Message ${messageId} sent successfully`);
          }
          
          // 確認訊息處理完成
          message.ack();
        } else {
          console.error(`Failed to process message ${messageId}:`, result.error);
          
          // 重試機制
          if (isRetryableError(result.error)) {
            console.log(`Retrying message ${messageId}`);
            message.retry();
          } else {
            console.log(`Acknowledging failed message ${messageId}`);
            message.ack();
          }
        }
      } else {
        console.warn(`Unknown action: ${action} for message ${messageId}`);
        message.ack();
      }

    } catch (error) {
      console.error(`Error processing queue message:`, error);
      message.retry();
    }
  }
  
  console.log(`Finished processing queue batch`);
}

// ==================== 導出 ====================

// 匯出 Worker 處理器
export default {
  fetch: app.fetch,
  queue: queue
};