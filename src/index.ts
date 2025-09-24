// 主要入口點 - Handler-based 架構
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import type { Bindings } from './types';
import { logger, createContextLogger } from './utils/logger';
import { templateService } from './services/template-service';

// Import handlers - consolidated imports
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

// Import additional handlers
import { activityHandler } from './handlers/activity';
import { activityStreamHandler } from './handlers/activity-stream';
import websocketMainHandler from './handlers/websocket-main';

// Import system functions (grouped by functionality)
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

// Import team functions
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

// Import credential functions
import {
  storeCredential,
  getCredential,
  getAllCredentials,
  clearPlatformCredentials,
  backupCredentials
} from './handlers/credentials';
// Import middleware and utilities
import { jwtAuth } from './middleware/auth';
import { signJWT } from './utils/auth';
import { getSecurityConfig, isOriginAllowed, getSecurityHeaders } from './config/security';

const app = new Hono<{ Bindings: Bindings }>();

// 獲取安全配置
const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'production';
const securityConfig = getSecurityConfig(environment);

// 添加中間件
app.use('*', honoLogger());

// 🔥 Initialize latest message cache on startup
app.use('*', async (c, next) => {
  // Only run warmup on the first request after deployment
  const shouldWarmup = c.req.header('cf-worker-started') ||
                      c.req.url.includes('__warmup__');

  if (shouldWarmup) {
    try {
      const { LatestMessageJobQueue } = await import('./workers/latest-message-worker');
      const jobQueue = new LatestMessageJobQueue(c.env);
      await jobQueue.warmupCache();
      console.log('🔥 [Startup] Latest message cache warmup initiated');
    } catch (error) {
      console.warn('⚠️ [Startup] Cache warmup failed (non-critical):', error);
    }
  }

  await next();
});

// 安全的 CORS 配置
app.use('*', cors({
  origin: (origin) => {
    // Fix CORS origin issue - ensure we return proper string value
    if (!origin) {
      // Allow same-origin requests
      return origin;
    }

    if (isOriginAllowed(origin, securityConfig)) {
      return origin;
    }

    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: securityConfig.cors.allowCredentials,
  maxAge: securityConfig.cors.maxAge
}));

// 安全標頭中間件
app.use('*', async (c, next) => {
  await next();

  // 設置安全標頭
  const isHttps = c.req.url.startsWith('https://');
  const headers = getSecurityHeaders(securityConfig, isHttps);

  Object.entries(headers).forEach(([key, value]) => {
    c.header(key, value);
  });
});

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

// 🚀 WebSocket 即時通訊路由 (WebSocket + Durable Objects 架構)
app.route('/api/websocket', websocketMainHandler);

// 📊 WebSocket 分析和監控路由 (Phase 2: 長期優化)
import websocketAnalyticsHandler from './handlers/websocket-analytics-main';
app.route('/api/websocket/analytics', websocketAnalyticsHandler);

// 👥 用戶體驗監控路由 (Phase 2: 長期優化)
import userExperienceHandler from './handlers/user-experience-main';
app.route('/api/user-experience', userExperienceHandler);

// 🔐 Phase 2 認證管理路由 (認證令牌管理)
import phase2AuthHandler from './handlers/phase2-auth-management';
app.route('/api/phase2-auth', phase2AuthHandler);

// 🚨 告警通知配置管理路由 (Slack, Email, Webhook 設定)
import alertConfigHandler from './handlers/alert-config-management';
app.route('/api/alert-config', alertConfigHandler);

// ⚡ 數據優化管理路由 (緩存、批量操作、索引優化)
import dataOptimizationHandler from './handlers/data-optimization-main';
app.route('/api/data-optimization', dataOptimizationHandler);

// 📡 SSE 性能監控路由 (Phase 2: SSE 完善和部署)
import sseMonitoringHandler from './handlers/sse-monitoring-main';
app.route('/api/sse/monitoring', sseMonitoringHandler);

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

// 🔑 開發環境限定的測試token生成端點
if (securityConfig.debug.enabled) {
  app.post('/api/debug/generate-token', jwtAuth, async (c) => {
    try {
      const user = c.get('user');

      // 只允許管理員使用此端點
      if (user.role !== 'admin') {
        return c.json({
          success: false,
          error: 'Only administrators can generate debug tokens'
        }, 403);
      }

      // 限制可生成的角色
      const { userId = "debug-user", displayName = "Debug User", role = "agent" } = await c.req.json();

      // 防止生成超過當前用戶權限的token
      if (role === 'admin' && user.role !== 'admin') {
        return c.json({
          success: false,
          error: 'Cannot generate admin tokens'
        }, 403);
      }

      const payload = {
        userId,
        displayName,
        role,
        teamId: user.teamId || 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes only
      };

      const token = await signJWT(payload, c.env.JWT_SECRET);

      // 記錄調試token生成（不包含敏感信息）
      // Token generated successfully

      return c.json({
        success: true,
        token,
        expiresAt: new Date((payload.exp * 1000)).toISOString(),
        note: 'Debug token - limited to 30 minutes'
      });

    } catch (error) {
      logger.error('Token generation failed', 'DEBUG', { error: error instanceof Error ? error.message : String(error) });
      return c.json({
        success: false,
        error: 'Token generation failed'
      }, 500);
    }
  });
}

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
  const contextLogger = createContextLogger('GlobalErrorHandler');
  contextLogger.error('Global error occurred', { path: c.req.path, method: c.req.method }, err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

// ==================== 靜態檔案服務 ====================

// 管理後台 HTML - 使用模板服務
app.get('/admin-dashboard.html', (c) => {
  const html = templateService.renderAdminDashboard();
  return c.html(html);
});

// Admin dashboard JavaScript
app.get('/admin-dashboard.js', (c) => {
  const js = templateService.renderAdminDashboardJS();
  c.header('Content-Type', 'application/javascript');
  return c.text(js);
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

// ==================== 導出 Durable Objects ====================

// Import Durable Objects for WebSocket + Durable Objects Architecture
import { ConversationRoom } from './durable-objects/ConversationRoom';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
import { LockCoordinator } from './services/distributed-lock-service';

// Export Durable Objects
export { ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor, LockCoordinator };

// ==================== 導出 Worker 處理器 ====================

export default {
  fetch: app.fetch,
  queue: async (batch: MessageBatch<any>, env: Bindings) => {
    // 檢查隊列名稱並路由到對應處理器
    const queueName = batch.queue;
    const queueLogger = createContextLogger('QueueRouter');
    queueLogger.info('Processing queue', { queueName, messageCount: batch.messages.length });

    try {
      if (queueName === 'realtime-events') {
        // Handle latest message cache updates and other realtime events
        const { handleLatestMessageQueue } = await import('./workers/latest-message-worker');
        await handleLatestMessageQueue(batch, env);
        queueLogger.info('Realtime events processed including latest message cache updates');

      } else if (queueName === 'agent-queue') {
        // 處理代理隊列 (保留 - 延遲消息功能)
        const agentService = new AgentQueueService(env);
        await agentService.processMessageBatch(batch);

      } else {
        queueLogger.warn('Unknown queue', { queueName });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queueLogger.error('Error processing queue', { queueName, error: errorMessage });
      throw error; // 重新抛出錯誤以觸發隊列重試機制
    }
  }
};