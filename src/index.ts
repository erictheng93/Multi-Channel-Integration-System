// 主要入口點 - Handler-based 架構 + 統一路由管理
import { Hono } from 'hono';
import { isOriginAllowed, createCorsPreflightResponse, createCorsBlockedResponse } from '@/config/cors';
import { logger as honoLogger } from 'hono/logger';
import type { Bindings } from './types';
import { createContextLogger } from './utils/logger';
import { templateService } from './services/template-service';

// Context logger for main entry point
const log = createContextLogger('Main');

// 統一路由管理系統
import { RouteRegistry } from './core/route-registry';
import { routeGroups, validateRouteConfig } from './core/route-config';

// Monitoring dashboard
import { createMonitoringHandlerMethods } from '@modules/monitoring/handlers/monitoring-dashboard';

// Import handlers - consolidated imports


// Import Analytics Module
import { comparisonAPI } from '@modules/analytics/handlers/comparison-api';

// Direct import for messaging handler (modular version)
import messagingMainHandler from '@modules/messaging/handlers/messaging/index';

// Phase 3: LINE Message Queue Consumer
import { handleLineMessageQueue } from '@modules/queue/handlers/line-message-queue';
import type { LineMessageQueuePayload } from './types/bindings';

// Debug: Log messaging handler
log.debug('messagingMainHandler imported', { type: typeof messagingMainHandler });
log.debug('messagingMainHandler object', { handler: messagingMainHandler ? 'defined' : 'undefined' });

// Import additional handlers
import { activityHandler } from '@modules/activities/handlers/activity';
import websocketMainHandler from '@modules/websocket/handlers/websocket-main';
import { feedbackHandler } from '@modules/system/handlers/feedback-main';

// KV Optimization Monitoring (P0 - 2025-01-08)
import kvOptimizationMonitoringHandler from '@modules/system/handlers/kv-optimization-monitoring';

// Monitoring and Alerting API (2025-01-08)
import monitoringMainHandler from '@modules/monitoring/handlers/monitoring-main';

// System-legacy and credential functions now in extracted routers:
//   src/handlers/system-settings-router.ts
//   src/handlers/credentials-router.ts
// Import middleware and utilities
import { jwtAuth, requireAdmin } from './middleware/auth';
import { getSecurityConfig, getSecurityHeaders } from './config/security';
import { globalErrorHandler } from './middleware/error-handler';

const app = new Hono<{ Bindings: Bindings }>();

// ==================== CORS 中間件 - 必須在所有路由之前註冊 ====================
// 統一的 CORS 配置，使用 @/config/cors.ts 中的配置
log.info('Registering global CORS middleware');

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  log.debug('CORS Middleware request', { method: c.req.method, origin, path: c.req.path });

  // 檢查是否允許該 origin - 傳遞環境變量以讀取 FRONTEND_URL/BACKEND_URL
  const allowed = origin && isOriginAllowed(origin, c.env);
  log.debug('CORS Middleware origin check', { origin, allowed });

  // 處理 OPTIONS preflight 請求
  if (c.req.method === 'OPTIONS') {
    log.debug('CORS Middleware handling OPTIONS request');

    if (allowed) {
      log.debug('CORS OPTIONS allowed', { origin });
      return createCorsPreflightResponse(origin, c.env);
    } else {
      log.warn('CORS OPTIONS: Blocked origin', { origin });
      // 使用增強的 CORS 錯誤響應，包含配置指引
      return createCorsBlockedResponse(origin, c.env);
    }
  }

  // 處理實際請求 - 先執行業務邏輯
  await next();

  // 添加 CORS headers 到響應
  if (allowed) {
    c.header('Access-Control-Allow-Origin', origin!);
    c.header('Access-Control-Allow-Credentials', 'true');
    log.debug('CORS allowed origin', { origin });
  } else if (origin) {
    log.warn('CORS: Blocked origin', { origin });
  }
  return;
});

log.info('Global CORS middleware registered successfully');

// ==================== METRICS MIDDLEWARE (after CORS, before auth) ====================
import { metricsMiddleware } from './middleware/metrics'
log.info('Registering metrics collection middleware')
app.use('/api/*', metricsMiddleware)
log.info('Metrics middleware registered')

// ==================== 統一路由管理系統初始化 ====================
log.info('Initializing Unified Route Management System');

// 驗證路由配置
const routeValidation = validateRouteConfig();
if (!routeValidation.valid) {
  log.error('Route configuration validation failed', { issues: routeValidation.issues });
  throw new Error('Invalid route configuration');
}

// Pre-register public WebSocket endpoints BEFORE unified route system
// This ensures they are NOT covered by any auth middleware from the route system
import websocketHealthApp from '@modules/websocket/handlers/websocket-health';
import websocketDashboardApp from '@modules/websocket/handlers/websocket-dashboard';

// Protect sensitive WebSocket endpoints (leave /health, /readiness, /liveness, /migration-status public)
app.use('/api/websocket/metrics', jwtAuth);
app.use('/api/websocket/health-detail', jwtAuth);

// Register health endpoints
app.route('/api/websocket', websocketHealthApp);
log.info('Public WebSocket health endpoints registered', {
  endpoints: [
    'GET /api/websocket/health',
    'GET /api/websocket/migration-status',
    'GET /api/websocket/readiness',
    'GET /api/websocket/liveness'
  ]
});

// CRITICAL: Register WebSocket main handler AFTER health app to avoid route conflicts
// websocketMainHandler provides /connect endpoint with websocketAuth middleware
app.route('/api/websocket', websocketMainHandler);
log.info('WebSocket connection endpoints registered', {
  endpoints: [
    'GET /api/websocket/connect (with websocketAuth)',
    'POST /api/websocket/disconnect (with websocketAuth)'
  ]
});

// Pre-register DelayedMessageScheduler health endpoint BEFORE unified route system
// This ensures /health endpoint is public (no auth required)
app.get('/api/delayed-messages-v2/health', async (c) => {
  return c.json({
    success: true,
    service: 'delayed-message-buffer',
    status: 'healthy',
    features: {
      instantCancel: true,
      preciseScheduling: true,
      durableObjects: true
    },
    timestamp: nowISO()
  });
});
log.info('DelayedMessageScheduler public endpoint registered', {
  endpoint: 'GET /api/delayed-messages-v2/health (public, no auth)'
});

// Pre-register Configuration Check endpoint (admin-only)
// Exposes environment config — requires authentication
import { getConfigCheck } from '@modules/system/handlers/health-main';
app.get('/api/system/config-check', jwtAuth, requireAdmin(), getConfigCheck);
log.info('Configuration check endpoint registered (admin only)', {
  endpoint: 'GET /api/system/config-check (admin auth required)'
});


// Pre-register R2 Public Proxy Endpoint (QR Code Fix)
// This endpoint proxies R2 requests and adds CORS headers
// WHY: R2 Custom Domains don't apply CORS settings, causing download failures
app.get('/api/r2-public/:folder/:filename', async (c) => {
  try {
    const { folder, filename } = c.req.param();
    const objectKey = `${folder}/${filename}`;

    // Fetch from R2
    const object = await c.env.R2_BUCKET.get(objectKey);

    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Create response with CORS headers
    const headers = new Headers();

    // CORS headers for all origins (public files only)
    const origin = c.req.header('Origin');
    if (origin && isOriginAllowed(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      headers.set('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Type');
      headers.set('Access-Control-Max-Age', '3600');
    }

    // Content headers
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
    headers.set('Content-Length', object.size.toString());

    return new Response(object.body, { headers });
  } catch (error) {
    log.error('R2 proxy error', { error });
    return c.json({ error: 'Failed to fetch file' }, 500);
  }
});

// Handle OPTIONS for R2 proxy
app.options('/api/r2-public/:folder/:filename', (c) => {
  const origin = c.req.header('Origin');
  const headers = new Headers();

  if (origin && isOriginAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('Access-Control-Max-Age', '3600');
  }

  return new Response(null, { status: 204, headers });
});

log.info('R2 Public Proxy endpoint registered', {
  endpoints: [
    'GET /api/r2-public/:folder/:filename (public, CORS enabled)',
    'OPTIONS /api/r2-public/:folder/:filename (CORS preflight)'
  ]
});

// Pre-register Analytics Comparison API BEFORE unified route system
// This prevents the /api/analytics/* catch-all from intercepting these routes
app.use('/api/analytics/comparison/*', jwtAuth);
app.route('/api/analytics/comparison', comparisonAPI);
log.info('Analytics Comparison API registered', {
  endpoints: ['/api/analytics/comparison/* (with internal OPTIONS handler)']
});

// Pre-register KV Optimization Monitoring BEFORE unified route system
// P0 Priority: Real-time monitoring for KV write optimization
app.route('/api/monitoring/kv', kvOptimizationMonitoringHandler);
log.info('KV Optimization Monitoring registered', {
  endpoints: [
    'GET /api/monitoring/kv/activity-cache (admin only)',
    'GET /api/monitoring/kv/request-frequency (admin only)',
    'GET /api/monitoring/kv/savings (admin only)',
    'GET /api/monitoring/kv/health (admin only)',
    'POST /api/monitoring/kv/reset (admin only)'
  ]
});

// Pre-register Monitoring & Alerting API BEFORE unified route system
// Provides DO monitoring, Circuit Breaker status, and alerting
app.route('/api/monitoring', monitoringMainHandler);
log.info('Monitoring & Alerting API registered', {
  endpoints: [
    'GET /api/monitoring/health (public)',
    'GET /api/monitoring/metrics (admin only)',
    'GET /api/monitoring/alerts (auth)',
    'GET /api/monitoring/alerts/history (admin only)',
    'GET /api/monitoring/circuit-breaker/status (auth)',
    'POST /api/monitoring/circuit-breaker/reset (admin only)',
    'POST /api/monitoring/circuit-breaker/open (admin only)',
    'GET /api/monitoring/instances/:type (admin only)',
    'POST /api/monitoring/health-check (admin only)'
  ]
});

// CRITICAL: CORS/Security endpoints BEFORE unified route system
// Route priority in Hono: first-registered wins. Moving these after RouteRegistry
// will cause 401 errors on public endpoints. See docs/architecture/ROUTE_REGISTRATION_ORDER.md

import corsMonitoringHandler from '@modules/monitoring/handlers/cors-monitoring';
import securityMonitoringHandler from '@modules/monitoring/handlers/security-monitoring';
import securityDashboardHandler from '@modules/monitoring/handlers/security-dashboard';

// Apply JWT auth to protected CORS monitoring endpoints (leave /health and /config public)
app.use('/api/cors/stats', jwtAuth);
app.use('/api/cors/events', jwtAuth);
app.use('/api/cors/rejected-origins', jwtAuth);
app.use('/api/cors/cleanup', jwtAuth);

// Register CORS handler BEFORE unified route system
app.route('/api/cors', corsMonitoringHandler);
log.info('CORS monitoring endpoints PRE-REGISTERED (before unified route system)', {
  endpoints: [
    'GET /api/cors/stats (Admin only)',
    'GET /api/cors/events (Admin only)',
    'GET /api/cors/rejected-origins (Admin only)'
  ]
});

// Register Security Monitoring handler (P2-4)
app.route('/api/security', securityMonitoringHandler);
log.info('Security monitoring endpoints registered (P2-4)', {
  endpoints: [
    'GET /api/security/health (Public)',
    'GET /api/security/events/stats (Admin only)',
    'GET /api/security/events (Admin only)',
    'POST /api/cors/cleanup (Admin only)',
    'GET /api/cors/health (Public)',
    'GET /api/cors/config (Public)'
  ]
});

// Register Security Dashboard handler (P2-7) - Real-time Analytics
app.route('/api/security/dashboard', securityDashboardHandler);
log.info('Security dashboard endpoints registered (P2-7)', {
  endpoints: [
    'GET /api/security/dashboard/health (Public)',
    'GET /api/security/dashboard/metrics (Admin only)',
    'GET /api/security/dashboard/events/stream (WebSocket)',
    'GET /api/security/dashboard/events/recent (Admin only)',
    'GET /api/security/dashboard/summary (Admin only)'
  ]
});

// Register KV Management handler - KV Namespace management and cleanup
import kvManagementHandler from '@modules/monitoring/handlers/kv-management-main';
app.route('/api/kv', kvManagementHandler);
log.info('KV Management endpoints registered', {
  endpoints: [
    'GET /api/kv/stats (Admin only)',
    'GET /api/kv/health (Auth required)',
    'POST /api/kv/cleanup (Admin only)',
    'GET /api/kv/naming-convention (Public)'
  ]
});

// =================================================================================
// PUBLIC FILE PROXY - R2 文件代理下載 (無需認證)
// =================================================================================
// 用於代理 R2 文件下載，解決 R2 公開訪問未配置的問題
// 客服和 LINE 消費者都可以通過此端點下載文件
// =================================================================================

import fileProxyHandler from '@modules/file-management/handlers/file-proxy';

app.route('/api/files', fileProxyHandler);
log.info('File proxy endpoints PRE-REGISTERED (public access)', {
  endpoints: [
    'GET /api/files/public/* (R2 path proxy)',
    'GET /api/files/download/:attachmentId (attachment ID proxy)'
  ]
});

// =================================================================================
// CRITICAL: WEBHOOK ROUTES - PRIORITY 1 (PRE-REGISTER BEFORE UNIFIED SYSTEM)
// =================================================================================
//
// LINE and Facebook webhooks MUST be registered BEFORE the unified route system
// to prevent 401 authentication errors from catch-all routes.
//
// Why this matters:
// - Webhooks use signature verification (X-Line-Signature, X-Hub-Signature)
// - They do NOT use JWT authentication
// - If registered after unified system, catch-all routes intercept them
// - Results in 401 "Missing or invalid authorization header" errors
//
// Reference: Same fix applied to CORS endpoints (see lines 218-260)
// =================================================================================

import { webhookHandler } from '@modules/integrations/handlers/webhook';
import { handleLineWebhookMultiTenant, handleLineWebhookLegacy } from '@modules/integrations/handlers/webhook-multitenant';

// ==================== Multi-Tenant LINE Webhook (New) ====================
// Route: POST /api/webhooks/line/:teamId/:token
// Supports per-team channel configurations
app.post('/api/webhooks/line/:teamId/:token', handleLineWebhookMultiTenant);

log.info('Multi-Tenant LINE Webhook endpoint PRE-REGISTERED', {
  endpoint: 'POST /api/webhooks/line/:teamId/:token (Team-specific webhook)'
});

// ==================== Legacy LINE Webhook (Backward Compatibility) ====================
// Route: POST /api/webhooks/line (no parameters)
// Uses global LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET from env
app.post('/api/webhook', handleLineWebhookLegacy);
app.post('/api/webhooks/line', handleLineWebhookLegacy);

// GET handlers for webhook verification and browser access
app.get('/api/webhook', (c) => {
  return c.json({
    success: true,
    message: 'LINE Webhook endpoint is ready',
    timestamp: nowISO(),
    endpoint: '/api/webhook',
    method: 'POST'
  });
});

app.get('/api/webhooks/line', (c) => {
  return c.json({
    success: true,
    message: 'LINE Webhook endpoint is ready',
    timestamp: nowISO(),
    endpoint: '/api/webhooks/line',
    method: 'POST'
  });
});

log.warn('Legacy LINE Webhook endpoints PRE-REGISTERED (backward compatibility)', {
  endpoints: [
    'POST /api/webhook (message processing)',
    'GET /api/webhook (verification)',
    'POST /api/webhooks/line (message processing)',
    'GET /api/webhooks/line (verification)'
  ],
  note: 'These use global credentials. Consider migrating to multi-tenant webhook.'
});

// Facebook Webhook 路由
app.all('/api/webhooks/facebook', webhookHandler.facebook);

log.info('Facebook Webhook endpoint PRE-REGISTERED', {
  endpoint: 'GET/POST /api/webhooks/facebook'
});

// Webhook 事件處理由 handlers/webhook.ts 和 handlers/webhook-multitenant.ts 負責

// Register P1 Optimization: WebSocket Dashboard (requires auth)
// 添加 JWT 認證中間件保護所有 Dashboard 端點
app.use('/api/websocket/dashboard/*', jwtAuth);
app.route('/api/websocket/dashboard', websocketDashboardApp);
log.info('WebSocket Dashboard endpoints registered', {
  endpoints: [
    'GET /api/websocket/dashboard/metrics (Admin/Team)',
    'GET /api/websocket/dashboard/connections (Admin/Team)',
    'GET /api/websocket/dashboard/history (Admin/Team)',
    'GET /api/websocket/dashboard/trends (Admin/Team)',
    'GET /api/websocket/dashboard/durable-objects (Admin)',
    'GET /api/websocket/dashboard/alerts (Admin/Team)'
  ]
});

// ==================== Customer Conversation System (Chat-Style) ====================
// WebSocket + Message CRUD + File Upload — extracted to @modules/customer-conversations
// Registered BEFORE unified route system to prevent route conflicts
import { customerWsHandler, customerMessagesHandler } from '@modules/customer-conversations/handlers';
app.route('/api/customer-ws', customerWsHandler);
app.route('/api/customer-conversations', customerMessagesHandler);

log.info('Customer Conversation System (Chat-Style) endpoints registered', {
  endpoints: [
    'GET /api/customer-ws (WebSocket upgrade)',
    'GET /api/customer-conversations/:id/messages',
    'POST /api/customer-conversations/:id/messages',
    'POST /api/customer-conversations/:id/upload'
  ]
});

// ====================  CHANNEL INTEGRATION MANAGEMENT ====================
//
// Multi-tenant channel configuration system (LINE, Facebook, WhatsApp)
// Allows customers to configure their own messaging platform credentials
//
// Registered BEFORE unified route system to prevent route conflicts
// Routes require authentication (jwtAuth middleware)
// Only Admin role can create/update/delete channels
// =============================================================================

import channelHandler from '@modules/integrations/handlers/channel-handler';

// Apply JWT auth middleware to all channel routes
// Note: Must apply to both base path and sub-paths for Hono pattern matching
app.use('/api/channels', jwtAuth);
app.use('/api/channels/*', jwtAuth);

// Register channel management routes
app.route('/api/channels', channelHandler);

// ==================== LIFF Handler (QR Code Team Binding) ====================
import liffHandler from '@modules/liff/handlers/liff';

// LIFF endpoints are PUBLIC (no auth required) - used by LINE users
app.route('/api/liff', liffHandler);

log.info('LIFF endpoints registered (public)', {
  endpoints: [
    'GET  /api/liff/health',
    'GET  /api/liff/config',
    'GET  /api/liff/teams/:teamId',
    'POST /api/liff/assign-team',
    'POST /api/liff/welcome'
  ]
});

// ==================== Admin LIFF QR Batch Generation ====================
import adminLiffQRBatchHandler from '@modules/liff/handlers/admin-liff-qr-batch';
app.route('/api/admin/liff-qr', adminLiffQRBatchHandler);

log.info('Admin LIFF QR batch generation endpoints registered (admin only)', {
  endpoints: [
    'POST /api/admin/liff-qr/batch-generate - Batch generate LIFF QR Codes',
    'GET  /api/admin/liff-qr/status - Check LIFF QR Code coverage'
  ]
});

// ==================== Task Reminder System (Phase 4: Notification Integration) ====================
import taskReminderHandler, { handleScheduledEvent } from '@modules/system/handlers/task-reminder-main';
app.route('/api/reminders', taskReminderHandler);

log.info('Task Reminder System registered', {
  endpoints: [
    'GET /api/reminders',
    'GET /api/reminders/upcoming',
    'GET /api/reminders/stats',
    'POST /api/reminders',
    'GET /api/reminders/:id',
    'PUT /api/reminders/:id',
    'PUT /api/reminders/:id/complete',
    'DELETE /api/reminders/:id',
    'POST /api/reminders/process (Admin)'
  ]
});

log.info('Channel Integration Management endpoints registered', {
  endpoints: [
    'GET /api/channels',
    'POST /api/channels (Admin only)',
    'GET /api/channels/:id',
    'PUT /api/channels/:id (Admin only)',
    'DELETE /api/channels/:id (Admin only)',
    'POST /api/channels/:id/verify',
    'GET /api/channels/:id/stats',
    'GET /api/channels/:id/health'
  ]
});

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
log.info(`Route system initialized successfully:
   Groups: ${stats.groups}
   Modules: ${stats.registeredModules}/${stats.totalModules}
   Enabled: ${stats.enabledModules}
   Disabled: ${stats.disabledModules}
   Registration Rate: ${stats.registrationRate}%`);

// ==================== 模組化架構系統初始化 ====================
log.info('Initializing Modular Architecture System');

// Lazy init for modular system, P1 optimizations, and collaboration
import { createLazyInitMiddleware, errorHandlingMiddleware } from './core/module-initializer';

// Modular system API handler (still needed for /api/modular/* routes)
import { modularSystemApiHandler } from './core/modular-system-integration';
// 註冊模組化系統管理API端點 (admin-only)
app.use('/api/modular/*', jwtAuth, requireAdmin());
app.get('/api/modular/status', modularSystemApiHandler.getSystemStatus.bind(modularSystemApiHandler));
app.get('/api/modular/modules', modularSystemApiHandler.getModules.bind(modularSystemApiHandler));
app.post('/api/modular/modules', modularSystemApiHandler.createModule.bind(modularSystemApiHandler));
app.get('/api/modular/health', modularSystemApiHandler.getModuleHealth.bind(modularSystemApiHandler));

// 添加全域錯誤處理中間件

// ==================== 自動化健康監控系統啟動 ====================
log.info('Initializing Automated Health Monitoring');

// 創建監控處理器
const monitoringHandlers = createMonitoringHandlerMethods();

// 註冊監控API端點 (admin-only — dashboard, config, alerts, metrics)
app.get('/api/monitoring/dashboard', jwtAuth, requireAdmin(), monitoringHandlers.getDashboard);
app.get('/api/monitoring/health/history', jwtAuth, requireAdmin(), monitoringHandlers.getHealthHistory);
app.get('/api/monitoring/alerts', jwtAuth, requireAdmin(), monitoringHandlers.getAlertHistory);
app.put('/api/monitoring/config', jwtAuth, requireAdmin(), monitoringHandlers.updateConfig);
app.post('/api/monitoring/health/check', jwtAuth, requireAdmin(), monitoringHandlers.triggerHealthCheck);
app.get('/api/monitoring/metrics', jwtAuth, requireAdmin(), monitoringHandlers.getMetrics);
app.get('/api/monitoring/stats', jwtAuth, requireAdmin(), monitoringHandlers.getStats);

// ==================== Middleware + Config ====================

// 獲取安全配置
// Note: In Cloudflare Workers, env is passed to handler, not available globally
// Default to 'production' for security; actual env is accessed in handlers
const environment = (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV) || 'production';
const securityConfig = getSecurityConfig(environment);

// 添加中間件
app.use('*', honoLogger());

// Lazy init: modular system + collaboration (on first request)
app.use('*', createLazyInitMiddleware());

// Initialize latest message cache on startup
app.use('*', async (c, next) => {
  // Only run warmup on the first request after deployment
  const shouldWarmup = c.req.header('cf-worker-started') ||
                      c.req.url.includes('__warmup__');

  if (shouldWarmup) {
    try {
      const { LatestMessageJobQueue } = await import('./workers/latest-message-worker');
      const jobQueue = new LatestMessageJobQueue(c.env);
      await jobQueue.warmupCache();
      log.debug('Startup: Latest message cache warmup initiated');
    } catch (error) {
      log.warn('Startup: Cache warmup failed (non-critical)', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  await next();
});

// 全域錯誤處理中間件 (在其他 middleware 之後)
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
    timestamp: nowISO(),
    version: '1.0.0'
  });
});


// ==================== 路由註冊 ====================
// 注意：大部分路由已遷移到統一路由管理系統 (src/core/route-config.ts)
// 此處僅保留特殊的細粒度路由和需要直接註冊的端點

// System settings + credentials — fine-grained routers
import systemSettingsRouter from './handlers/system-settings-router';
import credentialsRouter from './handlers/credentials-router';
app.route('/api/system', systemSettingsRouter);
// Note: /api/system/config-check is registered as a PUBLIC endpoint at the top of this file
app.route('/api/credentials', credentialsRouter);

import passwordHandler from '@modules/teams/handlers/password';

// Mount change-password under /api/auth (user self-service)
app.route('/api/auth', passwordHandler);

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
    log.error('Join team page error', { error: error instanceof Error ? error.message : String(error) });
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
// Period comparison endpoints have been pre-registered (lines 162-167)
// to prevent the main /api/analytics/* handler from intercepting them

// ==================== WebSocket Real-time System ====================
// WebSocket routes are now managed by the Unified Route Registry (src/core/route-config.ts)
// This prevents duplicate mounting and ensures consistent auth handling
// Public endpoints: /api/websocket/health, /api/websocket/migration-status
// Auth required: /api/websocket/connect, /api/websocket/disconnect
log.info('WebSocket routes managed by Unified Route Registry');

// ==================== 以下路由已遷移到統一路由系統 (src/core/route-config.ts) ====================
// Sessions, Notifications, Health, Analytics, Reports, Activities
// WebSocket, User Experience, Phase2 Auth, Alert Config, Data Optimization
// Realtime, Queue Monitor
// 這些模組現在通過 RouteRegistry 自動註冊

// Realtime + Queue monitor — fine-grained routers
import realtimeRouter from './handlers/realtime-router';
import queueMonitorRouter from './handlers/queue-monitor-router';
app.route('/api/realtime', realtimeRouter);

// 活動記錄路由
// Only register the main activities handler here
app.route('/api/activities', activityHandler);

// 客户满意度反馈路由 - Customer Feedback (Migration 0032)
app.route('/api/feedback', feedbackHandler);

app.route('/api/queues', queueMonitorRouter);

// Debug token endpoint (dev only)
import debugTokenRouter from './handlers/debug-token';
if (securityConfig.debug.enabled) {
  app.route('/api/debug', debugTokenRouter);
}

// ==================== Webhook 處理 ====================
// MOVED: Webhook routes now registered BEFORE unified route system (Priority 1)
// See lines ~273-310 for webhook registration
// This prevents 401 errors from catch-all routes in unified system

// ==================== 錯誤處理 ====================

// 全域錯誤處理 - 使用統一的錯誤處理器
app.onError((err, c) => {
  const contextLogger = createContextLogger('GlobalErrorHandler');
  contextLogger.error('Global error occurred', { path: c.req.path, method: c.req.method }, err);

  // 使用統一的錯誤處理器處理所有錯誤
  return globalErrorHandler(err, c);
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
    timestamp: nowISO()
  }, 404);
});

// ==================== Queue Consumer ====================

// ==================== 導出 ====================

// ==================== 導出 Durable Objects ====================
// CRITICAL: These exports are REQUIRED for Cloudflare Workers runtime
// They must match the class_name values in wrangler.toml [[durable_objects.bindings]]

// Import Durable Objects for WebSocket + Durable Objects Architecture
import { ConversationRoom } from './durable-objects/ConversationRoom';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageScheduler } from './durable-objects/DelayedMessageScheduler';
import { LatestMessageCacheCoordinator } from './durable-objects/LatestMessageCacheCoordinator';
import { LockCoordinator } from './services/distributed-lock-service';

// Import Customer Conversation Durable Objects (Chat-Style Architecture)
import { CustomerConversationDO } from './durable-objects/CustomerConversationDO';
import { CustomerMessageDO } from './durable-objects/CustomerMessageDO';

// Import RateLimiterDO for KV optimization (Phase 1: Rate Limiting Migration)
import { RateLimiterDO } from './durable-objects/RateLimiterDO';
import { MetricsCollectorDO } from './durable-objects/MetricsCollectorDO';
import { nowISO } from '@/utils/timestamp'

// Export Durable Objects (must match wrangler.toml class_name exactly)
export {
  ConversationRoom,
  UserConnection,
  MessageBroadcaster,
  LatestMessageCacheCoordinator,
  LockCoordinator,
  // Customer Conversation System (Chat-Style)
  CustomerConversationDO,
  CustomerMessageDO,
  // KV Optimization: Rate Limiter (Phase 1)
  RateLimiterDO,
  // Metrics: API request metrics accumulator
  MetricsCollectorDO
};

// Export legacy Delayed Message DO names (kept for backward compatibility)
export { DelayedMessageScheduler as DelayedMessageBuffer };
export { DelayedMessageScheduler as DelayedMessageProcessor };

// ==================== 導出 Worker 處理器 ====================
// LINE Message Queue Consumer
// Purpose: Async LINE message delivery for better UX
// Benefits:
// - Immediate response to agents (~10ms vs ~100-500ms)
// - Automatic retry with exponential backoff
// - Built-in dead letter queue handling
export default {
  fetch: app.fetch,

  // LINE Message Queue Consumer
  async queue(
    batch: MessageBatch<LineMessageQueuePayload>,
    env: Bindings
  ): Promise<void> {
    log.info('LINE Queue received batch', { messageCount: batch.messages.length });
    await handleLineMessageQueue(batch, env);
  },

  // Scheduled Handler for Task Reminders (Phase 4)
  async scheduled(
    event: ScheduledEvent,
    env: Bindings,
    _ctx: ExecutionContext
  ): Promise<void> {
    log.info('Scheduled event triggered', { cron: event.cron, scheduledTime: event.scheduledTime });
    const [, reportStats] = await Promise.allSettled([
      handleScheduledEvent(env),
      (async () => {
        const { ReportSchedulerService } = await import('@modules/reports/services/report-scheduler-service');
        const scheduler = new ReportSchedulerService(env);
        return scheduler.processScheduledReports();
      })(),
    ]);
    if (reportStats.status === 'fulfilled' && reportStats.value.processed > 0) {
      log.info('Scheduled reports processed', { processed: reportStats.value.processed, succeeded: reportStats.value.succeeded, failed: reportStats.value.failed });
    }
  }
};
