// 主要入口點 - Handler-based 架構 + 統一路由管理
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAllowedOrigins, isOriginAllowed, createCorsPreflightResponse, createCorsBlockedResponse } from '@/config/cors';
import { logger as honoLogger } from 'hono/logger';
import type { Bindings } from './types';
import { logger, createContextLogger, configureLogger } from './utils/logger';
import { templateService } from './services/template-service';

// Context logger for main entry point
const log = createContextLogger('Main');

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

// REMOVED: Old QR Code module - migrated to new LIFF QR Code system
// import { qrCodeRouter } from '@modules/qrcode/handlers/index';

// Direct import for messaging handler (troubleshooting)
import messagingMainHandler from './handlers/messaging-main';

// 🆕 Phase 3: LINE Message Queue Consumer
import { handleLineMessageQueue } from './handlers/line-message-queue';
import type { LineMessageQueuePayload } from './types/bindings';

// Debug: Log messaging handler
log.debug('messagingMainHandler imported', { type: typeof messagingMainHandler });
log.debug('messagingMainHandler object', { handler: messagingMainHandler ? 'defined' : 'undefined' });

// Import additional handlers
import { activityHandler } from './handlers/activity';
import websocketMainHandler from './handlers/websocket-main';
import delayedMessageBufferHandler from './handlers/delayed-message-buffer';
import { feedbackHandler } from './handlers/feedback-main';

// 🆕 KV Optimization Monitoring (P0 - 2025-01-08)
import kvOptimizationMonitoringHandler from './handlers/kv-optimization-monitoring';

// 🆕 Monitoring and Alerting API (2025-01-08)
import monitoringMainHandler from './handlers/monitoring-main';

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
// ❌ LEGACY TEAM HANDLER IMPORTS REMOVED
// All team management functions now in modular handlers:
// - src/modules/teams/handlers/members.ts
// - src/modules/teams/handlers/password.ts
// - src/modules/teams/handlers/invitations.ts

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
import { signJWT, verifyJWT } from './utils/auth';
import { getSecurityConfig, getSecurityHeaders } from './config/security';
import { globalErrorHandler } from './middleware/error-handler';

const app = new Hono<{ Bindings: Bindings }>();

// ==================== 🔥 CORS 中間件 - 必須在所有路由之前註冊 ====================
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
});

log.info('Global CORS middleware registered successfully');

// ==================== 統一路由管理系統初始化 ====================
log.info('Initializing Unified Route Management System');

// 驗證路由配置
const routeValidation = validateRouteConfig();
if (!routeValidation.valid) {
  log.error('Route configuration validation failed', { issues: routeValidation.issues });
  throw new Error('Invalid route configuration');
}

// 🔧 Pre-register public WebSocket endpoints BEFORE unified route system
// This ensures they are NOT covered by any auth middleware from the route system
import websocketHealthApp from './handlers/websocket-health';
import websocketDashboardApp from './handlers/websocket-dashboard';

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

// ⚠️  CRITICAL: Register WebSocket main handler AFTER health app to avoid route conflicts
// websocketMainHandler provides /connect endpoint with websocketAuth middleware
app.route('/api/websocket', websocketMainHandler);
log.info('WebSocket connection endpoints registered', {
  endpoints: [
    'GET /api/websocket/connect (with websocketAuth)',
    'POST /api/websocket/disconnect (with websocketAuth)'
  ]
});

// 🔧 Pre-register DelayedMessageScheduler health endpoint BEFORE unified route system
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
    timestamp: new Date().toISOString()
  });
});
log.info('DelayedMessageScheduler public endpoint registered', {
  endpoint: 'GET /api/delayed-messages-v2/health (public, no auth)'
});

// 🆕 Pre-register Configuration Check endpoint BEFORE unified route system
// This is a PUBLIC endpoint for debugging CORS and environment variable issues
// It should be accessible without authentication to help diagnose configuration problems
import { getConfigCheck } from './handlers/health-main';
app.get('/api/system/config-check', getConfigCheck);
log.info('Configuration check endpoint registered (public)', {
  endpoint: 'GET /api/system/config-check (public, no auth)'
});

// 🔧 Pre-register R2 Public Proxy Endpoint (QR Code Fix)
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

// 🔧 Pre-register Analytics Comparison API BEFORE unified route system
// This prevents the /api/analytics/* catch-all from intercepting these routes
app.route('/api/analytics/comparison', comparisonAPI);
log.info('Analytics Comparison API registered', {
  endpoints: ['/api/analytics/comparison/* (with internal OPTIONS handler)']
});

// 🔧 Pre-register KV Optimization Monitoring BEFORE unified route system
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

// 🔧 Pre-register Monitoring & Alerting API BEFORE unified route system
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

// ==================== 🔧 CRITICAL: PRE-REGISTER CORS 監控端點 ====================
//
// ⚠️  ROUTE REGISTRATION ORDER IS CRITICAL IN HONO FRAMEWORK
//
// WHY THIS MUST BE REGISTERED *BEFORE* UNIFIED ROUTE SYSTEM:
//
// 1. Route Priority in Hono:
//    - Routes registered first have higher priority
//    - Later routes CANNOT override earlier catch-all routes
//    - Unified route system (Line ~252) may create catch-all routes
//
// 2. The Problem (Fixed in Version d51fc6c8):
//    - Previously registered AFTER unified system (Line 425+)
//    - Resulted in 401 "Missing or invalid authorization header" errors
//    - Public endpoints (/health, /config) were incorrectly blocked
//
// 3. The Solution:
//    - Register BEFORE unified route system (current location: Line 221)
//    - Establishes route priority before any catch-all routes
//    - Allows public endpoints to work without authentication
//
// 4. Verification:
//    - ✅ All 12 E2E CORS tests passing (100% success rate)
//    - ✅ curl /api/cors/health returns 200 OK (not 401)
//    - ✅ curl /api/cors/config returns configuration (not 401)
//
// 📚 For detailed explanation, see:
//    - CLAUDE.md: "Route Registration Order (⚠️ Critical)" section
//    - docs/architecture/ROUTE_REGISTRATION_ORDER.md
//
// ⚠️  DO NOT MOVE THIS REGISTRATION TO AFTER UNIFIED ROUTE SYSTEM
//     OR YOU WILL REINTRODUCE THE 401 ERROR BUG!
//
// =================================================================================

import corsMonitoringHandler from './handlers/cors-monitoring';
import securityMonitoringHandler from './handlers/security-monitoring';
import securityDashboardHandler from './handlers/security-dashboard';

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

// 🆕 Register Security Dashboard handler (P2-7) - Real-time Analytics
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

// 🆕 Register KV Management handler - KV Namespace management and cleanup
import kvManagementHandler from './handlers/kv-management-main';
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
// 🆕 PUBLIC FILE PROXY - R2 文件代理下載 (無需認證)
// =================================================================================
// 用於代理 R2 文件下載，解決 R2 公開訪問未配置的問題
// 客服和 LINE 消費者都可以通過此端點下載文件
// =================================================================================

import fileProxyHandler from './handlers/file-proxy';

app.route('/api/files', fileProxyHandler);
log.info('File proxy endpoints PRE-REGISTERED (public access)', {
  endpoints: [
    'GET /api/files/public/* (R2 path proxy)',
    'GET /api/files/download/:attachmentId (attachment ID proxy)'
  ]
});

// =================================================================================
// ⚠️  CRITICAL: WEBHOOK ROUTES - PRIORITY 1 (PRE-REGISTER BEFORE UNIFIED SYSTEM)
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

import { webhookHandler } from './handlers/webhook';
import { handleLineWebhookMultiTenant, handleLineWebhookLegacy } from './handlers/webhook-multitenant';

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
    timestamp: new Date().toISOString(),
    endpoint: '/api/webhook',
    method: 'POST'
  });
});

app.get('/api/webhooks/line', (c) => {
  return c.json({
    success: true,
    message: 'LINE Webhook endpoint is ready',
    timestamp: new Date().toISOString(),
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
// 🔒 添加 JWT 認證中間件保護所有 Dashboard 端點
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

// ==================== 🔧 CUSTOMER CONVERSATION SYSTEM (Chat-Style) ====================
//
// NEW: Simplified conversation system inspired by Chat Project architecture
// Routes for customer conversations with WebSocket real-time communication
//
// Architecture:
// - CustomerConversationDO: WebSocket connection management
// - CustomerMessageDO: Message CRUD operations and R2 file uploads
//
// ⚠️  Registered BEFORE unified route system to prevent route conflicts
// =================================================================================

// WebSocket upgrade endpoint for customer conversations
app.get('/api/customer-ws', async (c) => {
  const conversationId = c.req.query('conversationId');
  const sessionId = c.req.query('sessionId');

  if (!conversationId || !sessionId) {
    return c.json({
      success: false,
      error: 'Missing required parameters: conversationId and sessionId'
    }, 400);
  }

  // SECURITY: Validate the session token
  if (!c.env.JWT_SECRET) {
    log.error('Customer WebSocket: JWT_SECRET not configured');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    // Verify the session token is a valid JWT
    const payload = await verifyJWT(sessionId, c.env.JWT_SECRET);

    // Validate user has access to this conversation
    const { drizzle } = await import('drizzle-orm/d1');
    const { eq } = await import('drizzle-orm');
    const schema = await import('./db/schema');
    const db = drizzle(c.env.DB, { schema });

    const { and } = await import('drizzle-orm');

    // Note: Individual assignment (assignedUserId) removed - only team-based access control is supported now
    const conversation = await db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedTeamId: schema.conversations.assignedTeamId,
    }).from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, 404);
    }

    // Permission check - team-based access control
    const isAdmin = payload.role === 'admin';
    const isCustomer = String(conversation.customerId) === String(payload.userId);

    // Check if conversation is unassigned (public pool - everyone can access)
    const isUnassigned = !conversation.assignedTeamId;

    // Check if user belongs to the assigned team
    let isTeamMember = false;
    if (conversation.assignedTeamId && !isAdmin && !isCustomer) {
      const membership = await db.select({ id: schema.agentTeams.id })
        .from(schema.agentTeams)
        .where(
          and(
            eq(schema.agentTeams.agentId, String(payload.userId)),
            eq(schema.agentTeams.teamId, conversation.assignedTeamId)
          )
        )
        .limit(1);
      isTeamMember = membership.length > 0;
    }

    if (!isAdmin && !isCustomer && !isUnassigned && !isTeamMember) {
      log.warn('Customer WebSocket: Access denied', { userId: payload.userId, conversationId, assignedTeamId: conversation.assignedTeamId });
      return c.json({ success: false, error: 'Access denied to this conversation' }, 403);
    }

    log.info('Customer WebSocket authenticated connection', {
      conversationId,
      userId: payload.userId,
      role: payload.role
    });

    // Forward to Durable Object with validated user info
    // This eliminates redundant KV session validation in the DO
    try {
      const doId = c.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
      const doStub = c.env.CUSTOMER_CONVERSATION_DO.get(doId);

      // Build URL with validated user info (DO will trust this since index.ts validated)
      const url = new URL(c.req.url);
      url.pathname = '/ws';
      // Pass validated user info to DO - this skips redundant KV validation
      url.searchParams.set('validatedUserId', String(payload.userId));
      url.searchParams.set('validatedRole', payload.role || 'agent');
      url.searchParams.set('validatedDisplayName', payload.displayName || 'User');
      url.searchParams.set('validated', 'true');

      const modifiedRequest = new Request(url.toString(), c.req.raw);

      return doStub.fetch(modifiedRequest);
    } catch (error) {
      log.error('Customer WebSocket: Connection error', { error: error instanceof Error ? error.message : String(error) });
      return c.json({
        success: false,
        error: 'Failed to establish WebSocket connection'
      }, 500);
    }
  } catch (authError) {
    log.error('Customer WebSocket: Authentication failed', { error: authError instanceof Error ? authError.message : String(authError) });
    return c.json({ success: false, error: 'Invalid or expired session' }, 401);
  }
});

// Message operations endpoint (GET messages, POST new message)
app.all('/api/customer-conversations/:id/messages', async (c) => {
  // CRITICAL: Read body FIRST before any other c.req operations that might consume it
  // This prevents "body already consumed" errors when forwarding to Durable Object
  const requestMethod = c.req.method;
  const bodyText = requestMethod === 'POST' ? await c.req.text() : undefined;

  const conversationId = c.req.param('id');

  if (!conversationId) {
    return c.json({
      success: false,
      error: 'Missing conversation ID'
    }, 400);
  }

  // SECURITY: Validate the session token from header
  const sessionId = c.req.header('x-session-id') || c.req.header('X-Session-Id') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  if (!c.env.JWT_SECRET) {
    log.error('Customer Messages: JWT_SECRET not configured');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    // Verify the session token is a valid JWT
    const payload = await verifyJWT(sessionId, c.env.JWT_SECRET);

    // Validate user has access to this conversation
    const { drizzle } = await import('drizzle-orm/d1');
    const { eq } = await import('drizzle-orm');
    const schema = await import('./db/schema');
    const db = drizzle(c.env.DB, { schema });

    const { and } = await import('drizzle-orm');

    // Note: Individual assignment (assignedUserId) removed - only team-based access control is supported now
    const conversation = await db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedTeamId: schema.conversations.assignedTeamId,
    }).from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, 404);
    }

    // Permission check - team-based access control
    const isAdmin = payload.role === 'admin';
    const isCustomer = String(conversation.customerId) === String(payload.userId);

    // Check if conversation is unassigned (public pool - everyone can access)
    const isUnassigned = !conversation.assignedTeamId;

    // Check if user belongs to the assigned team
    let isTeamMember = false;
    if (conversation.assignedTeamId && !isAdmin && !isCustomer) {
      const membership = await db.select({ id: schema.agentTeams.id })
        .from(schema.agentTeams)
        .where(
          and(
            eq(schema.agentTeams.agentId, String(payload.userId)),
            eq(schema.agentTeams.teamId, conversation.assignedTeamId)
          )
        )
        .limit(1);
      isTeamMember = membership.length > 0;
    }

    if (!isAdmin && !isCustomer && !isUnassigned && !isTeamMember) {
      log.warn('Customer Messages: Access denied', { userId: payload.userId, conversationId, assignedTeamId: conversation.assignedTeamId });
      return c.json({ success: false, error: 'Access denied to this conversation' }, 403);
    }

    log.debug('Customer Messages: Authenticated request', { method: requestMethod, conversationId, userId: payload.userId });
  } catch (authError) {
    log.error('Customer Messages: Authentication failed', { error: authError instanceof Error ? authError.message : String(authError) });
    return c.json({ success: false, error: 'Invalid or expired session' }, 401);
  }

  try {
    // Get CustomerMessageDO instance by conversationId
    const doId = c.env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
    const doStub = c.env.CUSTOMER_MESSAGE_DO.get(doId);

    // Create a new request with conversation ID and session ID in headers
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-Conversation-Id', conversationId);

    // Pass through session ID (already validated)
    if (sessionId) {
      headers.set('X-Session-Id', sessionId);
    }

    // Create the target URL for CustomerMessageDO
    const url = new URL(c.req.url);
    url.pathname = '/messages';

    // Create request with buffered body text
    const doRequest = new Request(url.toString(), {
      method: requestMethod,
      headers: headers,
      body: bodyText
    });

    log.debug('Proxy: Forwarding to CustomerMessageDO', { method: requestMethod, conversationId });
    return doStub.fetch(doRequest);
  } catch (error) {
    log.error('Customer Messages: Operation error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to process message operation'
    }, 500);
  }
});

// File upload endpoint
app.post('/api/customer-conversations/:id/upload', async (c) => {
  const conversationId = c.req.param('id');

  if (!conversationId) {
    return c.json({
      success: false,
      error: 'Missing conversation ID'
    }, 400);
  }

  // SECURITY: Validate the session token from header
  const sessionId = c.req.header('x-session-id') || c.req.header('X-Session-Id') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  if (!c.env.JWT_SECRET) {
    log.error('Customer Upload: JWT_SECRET not configured');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    // Verify the session token is a valid JWT
    const payload = await verifyJWT(sessionId, c.env.JWT_SECRET);

    // Validate user has access to this conversation
    // Note: Individual assignment (assignedUserId) removed - only team-based access control is supported now
    const { drizzle } = await import('drizzle-orm/d1');
    const { eq, and } = await import('drizzle-orm');
    const schema = await import('./db/schema');
    const db = drizzle(c.env.DB, { schema });

    const conversation = await db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedTeamId: schema.conversations.assignedTeamId,
    }).from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, 404);
    }

    // Permission check - team-based access control
    const isAdmin = payload.role === 'admin';
    const isCustomer = String(conversation.customerId) === String(payload.userId);
    const isUnassigned = !conversation.assignedTeamId;

    // Check if user belongs to the assigned team
    let isTeamMember = false;
    if (conversation.assignedTeamId && !isAdmin && !isCustomer) {
      const membership = await db.select({ id: schema.agentTeams.id })
        .from(schema.agentTeams)
        .where(
          and(
            eq(schema.agentTeams.agentId, String(payload.userId)),
            eq(schema.agentTeams.teamId, conversation.assignedTeamId)
          )
        )
        .limit(1);
      isTeamMember = membership.length > 0;
    }

    if (!isAdmin && !isCustomer && !isUnassigned && !isTeamMember) {
      log.warn('Customer Upload: Access denied', { userId: payload.userId, conversationId, assignedTeamId: conversation.assignedTeamId });
      return c.json({ success: false, error: 'Access denied to this conversation' }, 403);
    }

    log.debug('Customer Upload: Authenticated', { conversationId, userId: payload.userId });
  } catch (authError) {
    log.error('Customer Upload: Authentication failed', { error: authError instanceof Error ? authError.message : String(authError) });
    return c.json({ success: false, error: 'Invalid or expired session' }, 401);
  }

  try {
    // Get CustomerMessageDO instance by conversationId
    const doId = c.env.CUSTOMER_MESSAGE_DO.idFromName(`conversation-${conversationId}`);
    const doStub = c.env.CUSTOMER_MESSAGE_DO.get(doId);

    // Create a new request with conversation ID and session ID in headers
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-Conversation-Id', conversationId);

    // Pass through session ID (already validated)
    if (sessionId) {
      headers.set('X-Session-Id', sessionId);
    }

    // Clone the request to avoid body consumption issues
    const clonedRequest = c.req.raw.clone();

    const modifiedRequest = new Request(clonedRequest.url, {
      method: 'POST',
      headers: headers,
      body: clonedRequest.body
    });

    // Modify URL to use DO internal path
    const url = new URL(modifiedRequest.url);
    url.pathname = '/upload';

    return doStub.fetch(new Request(url.toString(), modifiedRequest));
  } catch (error) {
    log.error('Customer Upload: Upload error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      success: false,
      error: 'Failed to upload file'
    }, 500);
  }
});

// 🔧 DEBUG: Endpoint to check CustomerConversationDO connection status
app.get('/api/customer-conversations/:id/debug/connections', async (c) => {
  const conversationId = c.req.param('id');

  if (!conversationId) {
    return c.json({ success: false, error: 'Conversation ID is required' }, 400);
  }

  try {
    // Get the same DO instance that handles WebSocket connections
    const doId = c.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
    const doStub = c.env.CUSTOMER_CONVERSATION_DO.get(doId);

    // Forward request to DO's debug endpoint
    const debugRequest = new Request('https://fake-host/debug/connections', {
      method: 'GET'
    });

    const response = await doStub.fetch(debugRequest);
    const data = await response.json() as Record<string, unknown>;

    return c.json({
      success: true,
      requestedConversationId: conversationId,
      doIdString: doId.toString(),
      ...data
    });
  } catch (error) {
    log.error('Debug connections error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, error: 'Failed to get connection info' }, 500);
  }
});

log.info('Customer Conversation System (Chat-Style) endpoints registered', {
  endpoints: [
    'GET /api/customer-ws (WebSocket upgrade)',
    'GET /api/customer-conversations/:id/messages',
    'POST /api/customer-conversations/:id/messages',
    'POST /api/customer-conversations/:id/upload',
    'GET /api/customer-conversations/:id/debug/connections (DEBUG)'
  ]
});

// ==================== 🔧 CHANNEL INTEGRATION MANAGEMENT ====================
//
// Multi-tenant channel configuration system (LINE, Facebook, WhatsApp)
// Allows customers to configure their own messaging platform credentials
//
// ⚠️  Registered BEFORE unified route system to prevent route conflicts
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
import liffHandler from './handlers/liff';

// Test endpoint for debugging LIFF routes
app.get('/api/liff-test', (c) => {
  return c.json({ status: 'ok', message: 'LIFF test endpoint working' });
});

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
import adminLiffQRBatchHandler from './handlers/admin-liff-qr-batch';
app.route('/api/admin/liff-qr', adminLiffQRBatchHandler);

log.info('Admin LIFF QR batch generation endpoints registered (admin only)', {
  endpoints: [
    'POST /api/admin/liff-qr/batch-generate - Batch generate LIFF QR Codes',
    'GET  /api/admin/liff-qr/status - Check LIFF QR Code coverage'
  ]
});

// ==================== Task Reminder System (Phase 4: Notification Integration) ====================
import taskReminderHandler, { handleScheduledEvent } from './handlers/task-reminder-main';
app.route('/api/reminders', taskReminderHandler);

log.info('Task Reminder System registered', {
  endpoints: [
    'GET    /api/reminders',
    'GET    /api/reminders/upcoming',
    'GET    /api/reminders/stats',
    'POST   /api/reminders',
    'GET    /api/reminders/:id',
    'PUT    /api/reminders/:id',
    'PUT    /api/reminders/:id/complete',
    'DELETE /api/reminders/:id',
    'POST   /api/reminders/process (Admin)'
  ]
});

log.info('Channel Integration Management endpoints registered', {
  endpoints: [
    'GET    /api/channels',
    'POST   /api/channels (Admin only)',
    'GET    /api/channels/:id',
    'PUT    /api/channels/:id (Admin only)',
    'DELETE /api/channels/:id (Admin only)',
    'POST   /api/channels/:id/verify',
    'GET    /api/channels/:id/stats',
    'GET    /api/channels/:id/health'
  ]
});

// ❌ LEGACY PRE-REGISTRATION REMOVED
// GET /api/teams/members is now handled by the new modular team handler
// (src/modules/teams/handlers/team.ts:319)

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
  📊 Groups: ${stats.groups}
  📈 Modules: ${stats.registeredModules}/${stats.totalModules}
  ✅ Enabled: ${stats.enabledModules}
  ⏸️ Disabled: ${stats.disabledModules}
  📋 Registration Rate: ${stats.registrationRate}%`);

// ==================== 模組化架構系統初始化 ====================
log.info('Initializing Modular Architecture System');

// 導入模組化系統組件
import { globalModularSystemManager, modularSystemApiHandler } from './core/modular-system-integration';
import { globalErrorHandler as modularSystemErrorHandler, errorHandlingMiddleware } from './core/error-handler';

// 模組化系統初始化狀態追蹤
let modularSystemInitialized = false;
let modularSystemInitPromise: Promise<void> | null = null;

// Collaboration 模組初始化狀態追蹤
let collaborationInitialized = false;

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
      log.info(`Modular Architecture System initialized successfully:
  📦 Modules: ${initResult.modules.discovered} discovered, ${initResult.modules.registered} registered
  🚀 Routes: ${initResult.routes.groups} groups, ${initResult.routes.modules} modules
  🏥 Health: ${initResult.health.status} (monitoring: ${initResult.health.monitoring})
  ⚡ System: ${initResult.success ? 'Ready' : 'Partial'}`);

      if (initResult.warnings.length > 0) {
        log.warn('Modular system warnings', { warnings: initResult.warnings });
      }
      if (initResult.errors.length > 0) {
        log.error('Modular system errors', { errors: initResult.errors });
      }

      modularSystemInitialized = true;
    } catch (error) {
      log.error('Failed to initialize modular architecture system', { error: error instanceof Error ? error.message : String(error) });
      // 重置 promise 以允許重試
      modularSystemInitPromise = null;
      throw error;
    }
  })();

  return modularSystemInitPromise;
}

// 延遲初始化 P1 Optimizations（在第一個請求時執行）
async function initializeP1Optimizations(env: Bindings) {
  try {
    log.debug('Initializing P1 Optimizations');
    const { initializeP1Optimizations: init } = await import('./services/p1-optimizations');
    await init(env);
    log.debug('P1 Optimizations initialized successfully');
  } catch (error) {
    log.error('Failed to initialize P1 Optimizations', { error: error instanceof Error ? error.message : String(error) });
    // P1 優化失敗不應阻塞系統啟動
  }
}

// 延遲初始化 Collaboration 模組（在第一個請求時執行）
async function initializeCollaboration(env: Bindings) {
  if (collaborationInitialized) {
    return;
  }

  try {
    log.debug('Initializing Collaboration Module');

    // 先初始化 P1 優化
    await initializeP1Optimizations(env);

    const { Collaboration } = await import('@modules/collaboration');

    const config = {
      defaultProtocol: 'websocket' as const,
      enableWebSocket: true,
      typingExpirationSeconds: 5,
      presenceExpirationSeconds: 300,
      cleanupIntervalSeconds: 60,
      maxViewersPerConversation: 50,
      persistEvents: false
    };

    await Collaboration.initialize(env, config);

    collaborationInitialized = true;

    log.info('Collaboration Module initialized', { protocol: 'WebSocket', environment: env.ENVIRONMENT || 'unknown' });
  } catch (error) {
    log.error('Failed to initialize Collaboration Module', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// 註冊模組化系統管理API端點
app.get('/api/modular/status', modularSystemApiHandler.getSystemStatus.bind(modularSystemApiHandler));
app.get('/api/modular/modules', modularSystemApiHandler.getModules.bind(modularSystemApiHandler));
app.post('/api/modular/modules', modularSystemApiHandler.createModule.bind(modularSystemApiHandler));
app.get('/api/modular/health', modularSystemApiHandler.getModuleHealth.bind(modularSystemApiHandler));

// 添加全域錯誤處理中間件

// ==================== 自動化健康監控系統啟動 ====================
log.info('Initializing Automated Health Monitoring');

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

// NOTE: CORS monitoring endpoints已經在統一路由系統之前註冊 (見 line 221-238)
// 這裡不再重複註冊

// 啟動自動化監控（延遲3秒以確保所有系統已初始化）
// setTimeout(() => {
//   console.log('⚡ Starting automated health monitoring...');
//   automatedHealthMonitoring.start();
//   console.log('✅ Automated health monitoring started successfully');
// }, 3000);

// ==================== 原有配置繼續 ====================

// 獲取安全配置
// Note: In Cloudflare Workers, env is passed to handler, not available globally
// Default to 'production' for security; actual env is accessed in handlers
const environment = (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV) || 'production';
const securityConfig = getSecurityConfig(environment);

// 添加中間件
app.use('*', honoLogger());

// 🏗️ 延遲初始化模組化系統（在第一個請求時執行）
app.use('*', async (c, next) => {
  if (!modularSystemInitialized) {
    try {
      await initializeModularSystem();
    } catch (error) {
      log.error('Modular system initialization failed (continuing anyway)', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // 🤝 初始化 Collaboration 模組
  if (!collaborationInitialized) {
    try {
      await initializeCollaboration(c.env);
    } catch (error) {
      log.error('Collaboration module initialization failed (continuing anyway)', { error: error instanceof Error ? error.message : String(error) });
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
      log.debug('Startup: Latest message cache warmup initiated');
    } catch (error) {
      log.warn('Startup: Cache warmup failed (non-critical)', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  await next();
});

// 🔥 全域錯誤處理中間件 (在其他 middleware 之後)
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
// Note: /api/system/config-check is registered as a PUBLIC endpoint at the top of this file

// 憑證管理路由 - 細粒度控制 (保留)
app.post('/api/credentials', jwtAuth, storeCredential);
app.get('/api/credentials/:platform/:type', jwtAuth, getCredential);
app.get('/api/credentials', jwtAuth, getAllCredentials);
app.delete('/api/credentials/:platform', jwtAuth, clearPlatformCredentials);
app.get('/api/credentials/backup', jwtAuth, backupCredentials);

// ========================================================================
// 🚀 TEAM MANAGEMENT API ROUTES - FULLY MIGRATED TO MODULAR ARCHITECTURE
// ========================================================================
//
// ❌ LEGACY ROUTES REMOVED - All team member management has been migrated to:
//    src/modules/teams/handlers/members.ts
//    src/modules/teams/handlers/password.ts
//    src/modules/teams/handlers/invitations.ts
//
// ✅ NEW MODULAR ROUTES (via unified route system):
//    POST   /api/teams/members                     → Add member
//    PUT    /api/teams/members/:memberId/status    → Update status
//    PUT    /api/teams/members/:memberId/role      → Update role
//    PUT    /api/teams/members/:memberId           → Update member
//    DELETE /api/teams/members/:memberId           → Delete member
//    POST   /api/teams/members/:memberId/reset     → Reset password (admin)
//    POST   /api/teams/invitations                 → Send invitation
//    GET    /api/teams/invitations                 → List invitations
//    DELETE /api/teams/invitations/:id             → Revoke invitation
//
// 🔧 SPECIAL ROUTE: Password change endpoint needs to be under /api/auth
// ========================================================================

import passwordHandler from '@modules/teams/handlers/password';

// Mount change-password under /api/auth (user self-service)
app.route('/api/auth', passwordHandler);

// ========================================================================
// All other legacy team routes have been removed
// They are now handled by the unified route system + modular handlers
// ========================================================================

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
// ✅ Sessions, Notifications, Health, Analytics, Reports, Activities
// ✅ WebSocket, User Experience, Phase2 Auth, Alert Config, Data Optimization
// ✅ Realtime, Queue Monitor
// 這些模組現在通過 RouteRegistry 自動註冊

// 細粒度 Real-time 路由 - 保留以支援特定端點
// Note: These routes are kept separate for explicit endpoint control
import { realtime } from '@modules/realtime';
app.post('/api/realtime/typing', jwtAuth, realtime.handlers.main.sendTypingStatus);
app.post('/api/realtime/broadcast', jwtAuth, realtime.handlers.main.broadcastToConversation);
app.get('/api/realtime/conversation/:id/status', jwtAuth, realtime.handlers.main.getConversationStatus);
app.post('/api/realtime/online-status', jwtAuth, realtime.handlers.main.updateOnlineStatus);
app.get('/api/realtime/config', jwtAuth, realtime.handlers.management.getConfig);
app.put('/api/realtime/config', jwtAuth, realtime.handlers.management.updateConfig);
app.get('/api/realtime/stats', jwtAuth, realtime.handlers.management.getStats);
app.get('/api/realtime/health', realtime.handlers.management.healthCheck);
app.get('/api/realtime/monitoring/dashboard', jwtAuth, realtime.monitoring.dashboard as any);
app.get('/api/realtime/monitoring/metrics', jwtAuth, realtime.monitoring.metricsHistory);
app.get('/api/realtime/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
app.post('/api/realtime/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
app.get('/api/realtime/monitoring/health', realtime.monitoring.health);
app.get('/api/realtime/monitoring/config', jwtAuth, realtime.monitoring.config);
app.post('/api/realtime/monitoring/config', jwtAuth, realtime.monitoring.config);

// 活動記錄路由
// Only register the main activities handler here
app.route('/api/activities', activityHandler);

// 客户满意度反馈路由 - Customer Feedback (Migration 0032)
app.route('/api/feedback', feedbackHandler);

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
        teamId: user.primaryTeamId || 1,
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
    timestamp: new Date().toISOString()
  }, 404);
});

// ==================== Queue Consumer ====================

// ⚠️ REMOVED: AgentQueueService has been deprecated
// Delayed messages are now handled by DelayedMessageBuffer Durable Object
// 使用統一的 Real-time 模組處理即時事件

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
  RateLimiterDO
};

// Export legacy Delayed Message DO names (kept for backward compatibility)
export { DelayedMessageScheduler as DelayedMessageBuffer };
export { DelayedMessageScheduler as DelayedMessageProcessor };

// ==================== 導出 Worker 處理器 ====================
// ✅ LINE Message Queue Consumer
// Purpose: Async LINE message delivery for better UX
// Benefits:
//   - Immediate response to agents (~10ms vs ~100-500ms)
//   - Automatic retry with exponential backoff
//   - Built-in dead letter queue handling
export default {
  fetch: app.fetch,

  // 🆕 LINE Message Queue Consumer
  async queue(
    batch: MessageBatch<LineMessageQueuePayload>,
    env: Bindings
  ): Promise<void> {
    log.info('LINE Queue received batch', { messageCount: batch.messages.length });
    await handleLineMessageQueue(batch, env);
  },

  // ⏰ Scheduled Handler for Task Reminders (Phase 4)
  async scheduled(
    event: ScheduledEvent,
    env: Bindings,
    _ctx: ExecutionContext
  ): Promise<void> {
    log.info('Scheduled event triggered', { cron: event.cron, scheduledTime: event.scheduledTime });
    await handleScheduledEvent(env);
  }
};
