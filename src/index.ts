// 主要入口點 - Handler-based 架構 + 統一路由管理
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import type { Bindings } from './types';
import { logger, createContextLogger } from './utils/logger';
import { templateService } from './services/template-service';

// 統一路由管理系統
import { RouteRegistry } from './core/route-registry';
import { routeGroups, routeConfigStats, validateRouteConfig } from './core/route-config';

// 自動化健康監控系統
import { automatedHealthMonitoring } from './services/automated-health-monitoring';
import { createMonitoringHandlerMethods } from './handlers/monitoring-dashboard';

// Import handlers - consolidated imports
import {
  authMainHandler,
  teamMainHandler,
  delayedMessageMainHandler,
  conversationMainHandler,
  systemMainHandler,
  customerMainHandler,
  sessionMainHandler,
  agentMainHandler,
  notificationMainHandler,
  healthMainHandler
} from './handlers';

// Import Analytics Module
import { analyticsHandler } from '@modules/analytics/handlers/analytics-main';
import { dashboardHandler } from '@modules/analytics/handlers/dashboard-main';
import { realtimeDashboardHandler } from '@modules/analytics/handlers/realtime-dashboard-main';
import { comparisonAPI } from '@modules/analytics/handlers/comparison-api';

// Import Reports Module (separate from analytics for clarity)
import reportsHandler from '@modules/reports/handlers/reports-main';

// Import modular QR Code handler (complete version with all features)
import { qrCodeRouter } from '@modules/qrcode/handlers/index';

// Direct import for messaging handler (troubleshooting)
import messagingMainHandler from './handlers/messaging-main';

// Debug: Log messaging handler
console.log('🔍 [DEBUG] messagingMainHandler imported:', typeof messagingMainHandler);
console.log('🔍 [DEBUG] messagingMainHandler object:', messagingMainHandler);

// Import additional handlers
import { activityHandler } from './handlers/activity';
import { activityStreamHandler } from './handlers/activity-stream';
import websocketMainHandler from './handlers/websocket-main';
import delayedMessageBufferHandler from './handlers/delayed-message-buffer';

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

// ==================== 統一路由管理系統初始化 ====================
console.log('🚀 Initializing Unified Route Management System...');

// 驗證路由配置
const routeValidation = validateRouteConfig();
if (!routeValidation.valid) {
  console.error('❌ Route configuration validation failed:', routeValidation.issues);
  throw new Error('Invalid route configuration');
}

// 🔧 Pre-register public WebSocket endpoints BEFORE unified route system
// This ensures they are NOT covered by any auth middleware from the route system
import websocketMainHandler from './handlers/websocket-main';
app.get('/api/websocket/health', async (c) => {
  // Forward to websocket handler's health endpoint
  const handler = websocketMainHandler;
  const url = new URL(c.req.url);
  url.pathname = '/health';
  return handler.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});
app.get('/api/websocket/migration-status', async (c) => {
  // Forward to websocket handler's migration-status endpoint
  const handler = websocketMainHandler;
  const url = new URL(c.req.url);
  url.pathname = '/migration-status';
  return handler.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});
console.log('✅ Public WebSocket endpoints pre-registered (health, migration-status)');

// 創建路由註冊器
const routeRegistry = new RouteRegistry(app);

// 註冊所有路由組
routeGroups.forEach(group => {
  routeRegistry.registerGroup(group);
});

// 註冊路由健康檢查端點
routeRegistry.registerHealthEndpoint();

// 顯示路由註冊統計
const stats = routeRegistry.getStats();
console.log(`✅ Route system initialized successfully:
  📊 Groups: ${stats.groups}
  📈 Modules: ${stats.registeredModules}/${stats.totalModules}
  ✅ Enabled: ${stats.enabledModules}
  ⏸️ Disabled: ${stats.disabledModules}
  📋 Registration Rate: ${stats.registrationRate}%`);

// ==================== 模組化架構系統初始化 ====================
console.log('🏗️ Initializing Modular Architecture System...');

// 導入模組化系統組件
import { globalModularSystemManager, modularSystemApiHandler } from './core/modular-system-integration';
import { globalErrorHandler, errorHandlingMiddleware } from './core/error-handler';

// 模組化系統初始化狀態追蹤
let modularSystemInitialized = false;
let modularSystemInitPromise: Promise<void> | null = null;

// 延遲初始化模組化系統（在第一個請求時執行）
async function initializeModularSystem() {
  if (modularSystemInitialized) {
    return;
  }

  if (modularSystemInitPromise) {
    return modularSystemInitPromise;
  }

  modularSystemInitPromise = (async () => {
    try {
      const initResult = await globalModularSystemManager.initialize();
      console.log(`🎉 Modular Architecture System initialized successfully:
  📦 Modules: ${initResult.modules.discovered} discovered, ${initResult.modules.registered} registered
  🚀 Routes: ${initResult.routes.groups} groups, ${initResult.routes.modules} modules
  🏥 Health: ${initResult.health.status} (monitoring: ${initResult.health.monitoring})
  ⚡ System: ${initResult.success ? 'Ready' : 'Partial'}`);

      if (initResult.warnings.length > 0) {
        console.warn('⚠️ Modular system warnings:', initResult.warnings);
      }
      if (initResult.errors.length > 0) {
        console.error('❌ Modular system errors:', initResult.errors);
      }

      modularSystemInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize modular architecture system:', error);
      // 重置 promise 以允許重試
      modularSystemInitPromise = null;
      throw error;
    }
  })();

  return modularSystemInitPromise;
}

// 註冊模組化系統管理API端點
app.get('/api/modular/status', modularSystemApiHandler.getSystemStatus.bind(modularSystemApiHandler));
app.get('/api/modular/modules', modularSystemApiHandler.getModules.bind(modularSystemApiHandler));
app.post('/api/modular/modules', modularSystemApiHandler.createModule.bind(modularSystemApiHandler));
app.get('/api/modular/health', modularSystemApiHandler.getModuleHealth.bind(modularSystemApiHandler));

// 添加全域錯誤處理中間件

// ==================== 自動化健康監控系統啟動 ====================
console.log('🏥 Initializing Automated Health Monitoring...');

// 創建監控處理器
const monitoringHandlers = createMonitoringHandlerMethods();

// 註冊監控API端點
app.get('/api/monitoring/dashboard', monitoringHandlers.getDashboard);
app.get('/api/monitoring/health/history', monitoringHandlers.getHealthHistory);
app.get('/api/monitoring/alerts', monitoringHandlers.getAlertHistory);
app.put('/api/monitoring/config', monitoringHandlers.updateConfig);
app.post('/api/monitoring/health/check', monitoringHandlers.triggerHealthCheck);
app.get('/api/monitoring/metrics', monitoringHandlers.getMetrics);
app.get('/api/monitoring/stats', monitoringHandlers.getStats);

// 啟動自動化監控（延遲3秒以確保所有系統已初始化）
// setTimeout(() => {
//   console.log('⚡ Starting automated health monitoring...');
//   automatedHealthMonitoring.start();
//   console.log('✅ Automated health monitoring started successfully');
// }, 3000);

// ==================== 原有配置繼續 ====================

// 獲取安全配置
const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'production';
const securityConfig = getSecurityConfig(environment);

// 添加中間件
app.use('*', honoLogger());

// 🏗️ 延遲初始化模組化系統（在第一個請求時執行）
app.use('*', async (c, next) => {
  if (!modularSystemInitialized) {
    try {
      await initializeModularSystem();
    } catch (error) {
      console.error('⚠️ Modular system initialization failed (continuing anyway):', error);
    }
  }
  await next();
});

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
    // 🔥 修復 CORS 問題: 確保正確處理 localhost:3000 的跨域請求
    if (!origin) {
      // 同源請求 (no Origin header) - 允許
      return '*';
    }

    if (isOriginAllowed(origin, securityConfig)) {
      console.log(`✅ CORS: Allowed origin: ${origin}`);
      return origin;
    }
    // 不在白名單的 origin - 記錄並拒絕（返回空字串表示拒絕）
    console.warn(`❌ CORS: Blocked origin: ${origin}`);
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: securityConfig.cors.allowCredentials,
  maxAge: securityConfig.cors.maxAge
}));

// 🔥 明確處理 OPTIONS preflight 請求 (必須在所有路由之前)
app.options('*', (c) => {
  // OPTIONS 請求已經由 CORS 中介軟體處理標頭
  // 這裡只需要返回 204 No Content
  return c.body(null, 204);
});

// 🔥 全域錯誤處理中間件 (必須在 CORS 和 OPTIONS 之後)
app.use('*', errorHandlingMiddleware());

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
// 注意：大部分路由已遷移到統一路由管理系統 (src/core/route-config.ts)
// 此處僅保留特殊的細粒度路由和需要直接註冊的端點

// 系統設定路由 - 細粒度控制 (保留，因為 systemMainHandler 可能不包含所有端點)
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

// 憑證管理路由 - 細粒度控制 (保留)
app.post('/api/credentials', jwtAuth, storeCredential);
app.get('/api/credentials/:platform/:type', jwtAuth, getCredential);
app.get('/api/credentials', jwtAuth, getAllCredentials);
app.delete('/api/credentials/:platform', jwtAuth, clearPlatformCredentials);
app.get('/api/credentials/backup', jwtAuth, backupCredentials);

// 新的團隊管理 API 路由 - 細粒度控制 (保留)
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

// 臨時測試路由 - 調試用 (保留，可在生產環境移除)
app.get('/api/messages-test', (c) => {
  return c.json({
    success: true,
    message: 'Direct test route works!',
    timestamp: new Date().toISOString()
  });
});

// QR Code join page (special route) - need to add this to modular router if needed
app.get('/join', async (c) => {
  try {
    const teamQRCode = c.req.query('team');

    if (!teamQRCode) {
      return c.html(`
        <html>
          <head><title>加入團隊</title></head>
          <body>
            <h1>無效的邀請連結</h1>
            <p>請檢查您的邀請連結是否正確。</p>
          </body>
        </html>
      `);
    }

    const { getTeamByQRCode } = await import('./utils/team');
    const team = await getTeamByQRCode(c.env.DB, teamQRCode);

    if (!team) {
      return c.html(`
        <html>
          <head><title>加入團隊</title></head>
          <body>
            <h1>邀請連結已過期</h1>
            <p>此邀請連結無效或已過期，請聯繫團隊管理員獲取新的邀請連結。</p>
          </body>
        </html>
      `);
    }

    return c.html(`
      <html>
        <head>
          <title>加入 ${team.name}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .team-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .btn { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
            .btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>加入團隊邀請</h1>
          <div class="team-info">
            <h2>${team.name}</h2>
            ${team.description ? `<p>${team.description}</p>` : ''}
            <p><strong>團隊 ID:</strong> ${team.id}</p>
          </div>
          <p>您被邀請加入此團隊。請聯繫系統管理員完成帳戶設置。</p>
          <a href="/" class="btn">返回首頁</a>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Join team page error:', error);
    return c.html(`
      <html>
        <head><title>錯誤</title></head>
        <body>
          <h1>發生錯誤</h1>
          <p>處理邀請連結時發生錯誤，請稍後再試。</p>
        </body>
      </html>
    `);
  }
});

// ==================== Analytics Comparison API ====================
// Period comparison endpoints for analytics module
app.route('/api/analytics/comparison', comparisonAPI);

// ==================== WebSocket Real-time System ====================
// WebSocket routes are now managed by the Unified Route Registry (src/core/route-config.ts)
// This prevents duplicate mounting and ensures consistent auth handling
// Public endpoints: /api/websocket/health, /api/websocket/migration-status
// Auth required: /api/websocket/connect, /api/websocket/disconnect
console.log('✅ [Startup] WebSocket routes managed by Unified Route Registry');

// ==================== 以下路由已遷移到統一路由系統 (src/core/route-config.ts) ====================
// ✅ Sessions, Notifications, Health, Analytics, Reports, Activities
// ✅ WebSocket, User Experience, Phase2 Auth, Alert Config, Data Optimization
// ✅ SSE Monitoring, Realtime, Queue Monitor
// 這些模組現在通過 RouteRegistry 自動註冊

// 細粒度 Real-time 路由 - 保留以支援特定端點 (TODO: 考慮整合到 realtime handler)
import { realtime } from '@modules/realtime';
app.get('/api/realtime/sse', realtime.handlers.sse.connect);
app.post('/api/realtime/typing', jwtAuth, realtime.handlers.main.sendTypingStatus);
app.post('/api/realtime/broadcast', jwtAuth, realtime.handlers.main.broadcastToConversation);
app.get('/api/realtime/conversation/:id/status', jwtAuth, realtime.handlers.main.getConversationStatus);
app.post('/api/realtime/online-status', jwtAuth, realtime.handlers.main.updateOnlineStatus);
app.get('/api/realtime/config', jwtAuth, realtime.handlers.management.getConfig);
app.put('/api/realtime/config', jwtAuth, realtime.handlers.management.updateConfig);
app.get('/api/realtime/stats', jwtAuth, realtime.handlers.management.getStats);
app.get('/api/realtime/health', realtime.handlers.management.healthCheck);
app.get('/api/realtime/sse/stats', jwtAuth, realtime.handlers.sse.getStats);
app.post('/api/realtime/sse/cleanup', jwtAuth, realtime.handlers.sse.cleanup);
app.get('/api/realtime/monitoring/dashboard', jwtAuth, realtime.monitoring.dashboard as any);
app.get('/api/realtime/monitoring/metrics', jwtAuth, realtime.monitoring.metricsHistory);
app.get('/api/realtime/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
app.post('/api/realtime/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
app.get('/api/realtime/monitoring/health', realtime.monitoring.health);
app.get('/api/realtime/monitoring/config', jwtAuth, realtime.monitoring.config);
app.post('/api/realtime/monitoring/config', jwtAuth, realtime.monitoring.config);

// 活動記錄路由 - 使用 Hono 路由器掛載
app.route('/api/activities', activityHandler);
app.get('/api/activities/stream', activityStreamHandler.connect);

// 隊列監控細粒度路由 - 保留 (queueMonitorHandler 需要特定方法映射)
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

// Real-time 測試功能
app.post('/api/realtime/test-event', jwtAuth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const { eventType = 'test', eventData = { message: 'Test event' } } = await c.req.json();

    const result = await realtime.createEvent(
      eventType,
      eventData,
      { broadcast: true },
      'low',
      'system'
    );

    return c.json({ success: true, result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

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
// 使用統一的 Real-time 模組處理即時事件

// ==================== 導出 ====================

// ==================== 導出 Durable Objects ====================

// Import Durable Objects for WebSocket + Durable Objects Architecture
import { SimplifiedConversationRoom } from './durable-objects/ConversationRoomSimplified';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageProcessor } from './durable-objects/DelayedMessageProcessor';
import { DelayedMessageBuffer } from './durable-objects/DelayedMessageBuffer';
import { LockCoordinator } from './services/distributed-lock-service';

// Export Durable Objects
export {
  SimplifiedConversationRoom as ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor, DelayedMessageBuffer, LockCoordinator };

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

      } else if (queueName === 'REALTIME_QUEUE') {
        // 處理統一的 Real-time 隊列事件
        const { realtime } = await import('./modules/realtime');
        const realtimeManager = realtime.services.manager;
        await realtimeManager.initialize(env);

        for (const message of batch.messages) {
          try {
            const queueMessage = message.body;
            await realtimeManager.createEvent(
              queueMessage.event.type,
              queueMessage.event.data,
              queueMessage.targets,
              queueMessage.priority,
              'queue'
            );
          } catch (error) {
            queueLogger.error('Error processing realtime message', { error });
          }
        }
        queueLogger.info('Realtime queue processed', { messageCount: batch.messages.length });

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