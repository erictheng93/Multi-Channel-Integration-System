// 主要入口點 - Handler-based 架構
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Bindings } from './types';

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
import { signJWT } from './utils/auth';

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

// 🚀 事件驅動 SSE 即時通訊路由 (使用新的 V2 處理器)
// 使用簡化版SSE處理器 - 移除複雜的跨Worker同步邏輯
import { simpleRealtimeHandler } from './handlers/realtime-simple';
// 簡化版SSE路由 - 每個連接獨立運行，無跨Worker同步
app.get('/api/realtime/sse', simpleRealtimeHandler.sse);

// 暫時移除複雜功能，專注於核心SSE消息推送
// app.post('/api/realtime/typing', jwtAuth, simpleRealtimeHandler.sendTypingStatus);
// app.post('/api/realtime/broadcast', jwtAuth, simpleRealtimeHandler.broadcastToConversation);
// app.get('/api/realtime/conversation/:id/status', jwtAuth, simpleRealtimeHandler.getConversationStatus);
// app.post('/api/realtime/online-status', jwtAuth, simpleRealtimeHandler.updateOnlineStatus);

// 📊 隊列統一監控路由
import { queueMonitorHandler } from './handlers/queue-monitor';
app.get('/api/queues/stats', jwtAuth, queueMonitorHandler.getUnifiedStats);
app.get('/api/queues/health', jwtAuth, queueMonitorHandler.getHealthCheck);
app.get('/api/queues/performance', jwtAuth, queueMonitorHandler.getPerformanceMetrics);
app.post('/api/queues/maintenance', jwtAuth, queueMonitorHandler.maintenanceOperations);

// 🔑 臨時測試token生成端點 (僅用於調試)
app.post('/api/debug/generate-token', async (c) => {
  try {
    const { userId = "admin-001", displayName = "Debug User", role = "admin" } = await c.req.json();
    
    const payload = {
      userId,
      displayName,
      role,
      teamId: 1,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    const token = await signJWT(payload, c.env.JWT_SECRET);
    console.log('🔑 [DEBUG] Generated test token for:', { userId, displayName, role });
    
    return c.json({
      success: true,
      token,
      payload,
      expiresAt: new Date((payload.exp * 1000)).toISOString()
    });
    
  } catch (error) {
    console.error('🔑 [DEBUG] Token generation failed:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// 簡化版測試事件 - 不再使用Queue，依賴1秒輪詢自動發現
app.post('/api/realtime/test-event', jwtAuth, simpleRealtimeHandler.testEvent);

// ==================== Webhook 處理 ====================

import { webhookHandler } from './handlers/webhook';

// LINE Webhook 路由 - 使用正確的處理器
app.post('/api/webhook', webhookHandler.line);
app.post('/api/webhooks/line', webhookHandler.line);

// Facebook Webhook 路由
app.all('/api/webhooks/facebook', webhookHandler.facebook);

// Webhook 事件處理由 handlers/webhook.ts 負責

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

            <div class="card">
                <h3>🚀 代理隊列監控</h3>
                <div class="stat-number" id="agent-queue-status">
                    <span class="status-indicator status-online"></span>
                    載入中...
                </div>
                <div id="agent-queue-details">
                    <p>延遲消息和撤回功能</p>
                    <small id="agent-queue-metrics">載入中...</small>
                </div>
                <div class="quick-actions">
                    <button class="btn" onclick="refreshQueueStats()">重新整理</button>
                    <button class="btn btn-secondary" onclick="viewQueueDetails()">詳細資訊</button>
                </div>
            </div>

            <div class="card">
                <h3>⚡ 實時隊列監控</h3>
                <div class="stat-number" id="realtime-queue-status">
                    <span class="status-indicator status-online"></span>
                    載入中...
                </div>
                <div id="realtime-queue-details">
                    <p>實時事件推送和SSE管理</p>
                    <small id="realtime-queue-metrics">載入中...</small>
                </div>
                <div class="quick-actions">
                    <button class="btn" onclick="refreshQueueStats()">重新整理</button>
                    <button class="btn btn-secondary" onclick="testRealtimeEvent()">測試事件</button>
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

        // 載入隊列統計資料
        async function loadQueueStats() {
            try {
                const response = await fetch(\`\${API_BASE}/api/queues/stats\`);
                const data = await response.json();
                
                if (data.success) {
                    const queueData = data.data;
                    
                    // 更新代理隊列狀態
                    const agentQueue = queueData.queues.agentQueue;
                    document.getElementById('agent-queue-status').innerHTML = 
                        \`<span class="status-indicator status-\${agentQueue.status === 'healthy' ? 'online' : 'offline'}"></span>
                        \${agentQueue.status === 'healthy' ? '正常運行' : '異常'}\`;
                    
                    document.getElementById('agent-queue-metrics').textContent = 
                        \`批次大小: \${agentQueue.configuration.maxBatchSize}, 平均處理時間: \${agentQueue.metrics.avgProcessingTime}ms\`;
                    
                    // 更新實時隊列狀態
                    const realtimeQueue = queueData.queues.realtimeQueue;
                    document.getElementById('realtime-queue-status').innerHTML = 
                        \`<span class="status-indicator status-\${realtimeQueue.status === 'healthy' ? 'online' : 'offline'}"></span>
                        \${realtimeQueue.status === 'healthy' ? '正常運行' : '異常'}\`;
                    
                    document.getElementById('realtime-queue-metrics').textContent = 
                        \`SSE連接: \${queueData.realtimeConnections.totalConnections}, 平均處理時間: \${realtimeQueue.metrics.avgProcessingTime}ms\`;
                        
                    console.log('📊 隊列統計資料載入成功:', queueData);
                }
            } catch (error) {
                console.error('載入隊列統計資料失敗:', error);
                document.getElementById('agent-queue-status').innerHTML = '<span class="status-indicator status-offline"></span>錯誤';
                document.getElementById('realtime-queue-status').innerHTML = '<span class="status-indicator status-offline"></span>錯誤';
            }
        }

        // 重新整理隊列統計
        function refreshQueueStats() {
            document.getElementById('agent-queue-status').innerHTML = '<span class="status-indicator status-online"></span>載入中...';
            document.getElementById('realtime-queue-status').innerHTML = '<span class="status-indicator status-online"></span>載入中...';
            loadQueueStats();
        }

        // 查看隊列詳細資訊
        function viewQueueDetails() {
            fetch(\`\${API_BASE}/api/queues/performance\`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const metrics = data.data;
                        alert(\`📊 隊列性能指標：

🚀 代理隊列 (AGENT_QUEUE):
  • 吞吐量: \${metrics.agentQueue.throughput.messagesPerSecond}/秒
  • 成功率: \${metrics.agentQueue.reliability.successRate}%
  • 錯誤率: \${metrics.agentQueue.reliability.errorRate}%

⚡ 實時隊列 (REALTIME_QUEUE):
  • 事件吞吐量: \${metrics.realtimeQueue.throughput.eventsPerSecond}/秒
  • 成功率: \${metrics.realtimeQueue.reliability.successRate}%
  • SSE連接: \${metrics.realtimeQueue.sseMetrics.activeConnections}\`);
                    }
                })
                .catch(error => {
                    alert('❌ 無法載入隊列詳細資訊：' + error.message);
                });
        }

        // 測試實時事件
        function testRealtimeEvent() {
            const conversationId = prompt('請輸入對話ID進行測試（或留空使用預設值）:') || '1';
            const message = prompt('請輸入測試消息內容:') || '🧪 系統測試消息';
            
            fetch(\`\${API_BASE}/api/realtime/test-event\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token' // 這裡需要實際的JWT token
                },
                body: JSON.stringify({
                    conversationId: conversationId,
                    message: message
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(\`✅ 測試事件已發送！
事件ID: \${data.eventId}
當前連接數: \${data.currentConnections}\`);
                } else {
                    alert('❌ 測試事件發送失敗: ' + (data.error || '未知錯誤'));
                }
            })
            .catch(error => {
                alert('❌ 測試事件失敗：' + error.message);
            });
        }

        // 頁面載入時執行
        document.addEventListener('DOMContentLoaded', function() {
            loadStats();
            loadQueueStats();
            
            // 每30秒重新整理統計資料
            setInterval(loadStats, 30000);
            // 每15秒重新整理隊列統計
            setInterval(loadQueueStats, 15000);
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

import { AgentQueueService } from './services/agent-queue-service';
// 移除複雜的 RealtimeQueueService - 改用簡化版 SSE 獨立輪詢

// ==================== 導出 ====================

// ==================== 導出 Worker 處理器 ====================

export default {
  fetch: app.fetch,
  queue: async (batch: MessageBatch<any>, env: Bindings) => {
    // 檢查隊列名稱並路由到對應處理器
    const queueName = batch.queue;
    console.log(`🚀 [Queue Router] Processing queue: ${queueName} with ${batch.messages.length} messages`);
    
    try {
      if (queueName === 'realtime-events') {
        // 簡化版：實時事件由 SSE 連接自主輪詢處理，無需隊列
        console.log(`📡 [Queue Router] Realtime events handled by simplified SSE polling - skipping queue processing`);
        
      } else if (queueName === 'agent-queue') {
        // 處理代理隊列 (保留 - 延遲消息功能)
        const agentService = new AgentQueueService(env);
        await agentService.processMessageBatch(batch);
        
      } else {
        console.warn(`⚠️ [Queue Router] Unknown queue: ${queueName}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Queue Router] Error processing queue ${queueName}:`, errorMessage);
      throw error; // 重新抛出錯誤以觸發隊列重試機制
    }
  }
};