// 主要入口點 - Handler-based 架構 + 統一路由管理
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ALLOWED_ORIGINS, isOriginAllowed, createCorsPreflightResponse } from '@/config/cors';
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

// 🆕 Phase 3: LINE Message Queue Consumer
import { handleLineMessageQueue } from './handlers/line-message-queue';
import type { LineMessageQueuePayload } from './types/bindings';

// Debug: Log messaging handler
console.log('🔍 [DEBUG] messagingMainHandler imported:', typeof messagingMainHandler);
console.log('🔍 [DEBUG] messagingMainHandler object:', messagingMainHandler);

// Import additional handlers
import { activityHandler } from './handlers/activity';
// REMOVED: activityStreamHandler (Phase 4 cleanup - SSE-based, replaced by WebSocket)
// import { activityStreamHandler } from './handlers/activity-stream';
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

const app = new Hono<{ Bindings: Bindings }>();

// ==================== 🔥 CORS 中間件 - 必須在所有路由之前註冊 ====================
// 統一的 CORS 配置，使用 @/config/cors.ts 中的配置
console.log('🛡️ Registering global CORS middleware...');

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  console.log(`[CORS Middleware] Method: ${c.req.method}, Origin: ${origin}, Path: ${c.req.path}`);

  // 檢查是否允許該 origin
  const allowed = origin && isOriginAllowed(origin);
  console.log(`[CORS Middleware] Origin allowed: ${allowed}`);

  // 處理 OPTIONS preflight 請求
  if (c.req.method === 'OPTIONS') {
    console.log(`[CORS Middleware] Handling OPTIONS request`);

    if (allowed) {
      console.log(`✅ CORS OPTIONS: Allowed origin: ${origin}`);
      return createCorsPreflightResponse(origin);
    } else {
      console.warn(`❌ CORS OPTIONS: Blocked origin: ${origin}`);
      return c.json({ error: 'CORS policy violation' }, 403);
    }
  }

  // 處理實際請求 - 先執行業務邏輯
  await next();

  // 添加 CORS headers 到響應
  if (allowed) {
    c.header('Access-Control-Allow-Origin', origin!);
    c.header('Access-Control-Allow-Credentials', 'true');
    console.log(`✅ CORS: Allowed origin: ${origin}`);
  } else if (origin) {
    console.warn(`❌ CORS: Blocked origin: ${origin}`);
  }
});

console.log('✅ Global CORS middleware registered successfully');

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
import websocketHealthApp from './handlers/websocket-health';
import websocketDashboardApp from './handlers/websocket-dashboard';

// Register health endpoints
app.route('/api/websocket', websocketHealthApp);
console.log('✅ Public WebSocket health endpoints registered:');
console.log('   • GET /api/websocket/health');
console.log('   • GET /api/websocket/migration-status');
console.log('   • GET /api/websocket/readiness');
console.log('   • GET /api/websocket/liveness');

// ⚠️  CRITICAL: Register WebSocket main handler AFTER health app to avoid route conflicts
// websocketMainHandler provides /connect endpoint with websocketAuth middleware
app.route('/api/websocket', websocketMainHandler);
console.log('✅ WebSocket connection endpoints registered:');
console.log('   • GET /api/websocket/connect (with websocketAuth)');
console.log('   • POST /api/websocket/disconnect (with websocketAuth)');

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
console.log('✅ DelayedMessageScheduler public endpoint registered:');
console.log('   • GET /api/delayed-messages-v2/health (public, no auth)');

// 🔧 Pre-register SSE activity stream endpoint BEFORE unified route system
// This prevents auth middleware from being applied (SSE uses query token)
app.options('/api/activities/stream', (c) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = [
    'https://multi-channel.imfinethankyouandyou.com',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8787',
  ];

  // Check if origin matches Cloudflare Pages preview domains
  const isPagesPreview = origin.endsWith('.multi-channel-platform-frontend.pages.dev');

  const response = new Response(null, { status: 204 });

  if ((allowedOrigins.includes(origin) || isPagesPreview) && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Prevent Cloudflare edge caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
});
// REMOVED: SSE activity stream endpoint (Phase 4 cleanup - replaced by WebSocket)
// app.get('/api/activities/stream', activityStreamHandler.connect);
// console.log('✅ SSE activity stream endpoint registered:');
// console.log('   • OPTIONS /api/activities/stream');
// console.log('   • GET /api/activities/stream (query token auth)');

// 🔧 Pre-register Analytics Comparison API BEFORE unified route system
// This prevents the /api/analytics/* catch-all from intercepting these routes
app.route('/api/analytics/comparison', comparisonAPI);
console.log('✅ Analytics Comparison API registered:');
console.log('   • /api/analytics/comparison/* (with internal OPTIONS handler)');

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
console.log('✅ CORS monitoring endpoints PRE-REGISTERED (before unified route system):');
console.log('   • GET /api/cors/stats (Admin only - internal auth check)');
console.log('   • GET /api/cors/events (Admin only - internal auth check)');
console.log('   • GET /api/cors/rejected-origins (Admin only - internal auth check)');

// Register Security Monitoring handler (P2-4)
app.route('/api/security', securityMonitoringHandler);
console.log('✅ Security monitoring endpoints registered (P2-4):');
console.log('   • GET /api/security/health (Public)');
console.log('   • GET /api/security/events/stats (Admin only - requires JWT)');
console.log('   • GET /api/security/events (Admin only - requires JWT)');
console.log('   • POST /api/cors/cleanup (Admin only - internal auth check)');
console.log('   • GET /api/cors/health (Public - no auth required)');
console.log('   • GET /api/cors/config (Public - no auth required)');

// 🆕 Register Security Dashboard handler (P2-7) - Real-time Analytics
app.route('/api/security/dashboard', securityDashboardHandler);
console.log('✅ Security dashboard endpoints registered (P2-7):');
console.log('   • GET /api/security/dashboard/health (Public)');
console.log('   • GET /api/security/dashboard/metrics (Admin only - requires JWT)');
console.log('   • GET /api/security/dashboard/events/stream (Admin only - SSE stream)');
console.log('   • GET /api/security/dashboard/events/recent (Admin only - requires JWT)');
console.log('   • GET /api/security/dashboard/summary (Admin only - requires JWT)');

// =================================================================================
// 🆕 PUBLIC FILE PROXY - R2 文件代理下載 (無需認證)
// =================================================================================
// 用於代理 R2 文件下載，解決 R2 公開訪問未配置的問題
// 客服和 LINE 消費者都可以通過此端點下載文件
// =================================================================================

import fileProxyHandler from './handlers/file-proxy';

app.route('/api/files', fileProxyHandler);
console.log('✅ File proxy endpoints PRE-REGISTERED (public access):');
console.log('   • GET /api/files/public/* (Public - R2 path proxy)');
console.log('   • GET /api/files/download/:attachmentId (Public - attachment ID proxy)');

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

console.log('✅ Multi-Tenant LINE Webhook endpoint PRE-REGISTERED (before unified route system):');
console.log('   • POST /api/webhooks/line/:teamId/:token (Team-specific webhook)');

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

console.log('⚠️  Legacy LINE Webhook endpoints PRE-REGISTERED (backward compatibility):');
console.log('   • POST /api/webhook (message processing)');
console.log('   • GET /api/webhook (verification)');
console.log('   • POST /api/webhooks/line (message processing)');
console.log('   • GET /api/webhooks/line (verification)');
console.log('   Note: These use global credentials. Consider migrating to multi-tenant webhook.');

// Facebook Webhook 路由
app.all('/api/webhooks/facebook', webhookHandler.facebook);

console.log('✅ Facebook Webhook endpoint PRE-REGISTERED:');
console.log('   • GET/POST /api/webhooks/facebook');

// Webhook 事件處理由 handlers/webhook.ts 和 handlers/webhook-multitenant.ts 負責

// Register P1 Optimization: WebSocket Dashboard (requires auth)
// 🔒 添加 JWT 認證中間件保護所有 Dashboard 端點
app.use('/api/websocket/dashboard/*', jwtAuth);
app.route('/api/websocket/dashboard', websocketDashboardApp);
console.log('✅ WebSocket Dashboard endpoints registered:');
console.log('   • GET /api/websocket/dashboard/metrics (Admin/Team)');
console.log('   • GET /api/websocket/dashboard/connections (Admin/Team)');
console.log('   • GET /api/websocket/dashboard/history (Admin/Team)');
console.log('   • GET /api/websocket/dashboard/trends (Admin/Team)');
console.log('   • GET /api/websocket/dashboard/durable-objects (Admin)');
console.log('   • GET /api/websocket/dashboard/alerts (Admin/Team)');

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
    console.error('❌ [Customer WebSocket] JWT_SECRET not configured');
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

    const conversation = await db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedUserId: schema.conversations.assignedUserId,
    }).from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, 404);
    }

    // Allow access if user is assigned, is admin, or owns the conversation
    const isAdmin = payload.role === 'admin';
    const isAssigned = conversation.assignedUserId === String(payload.userId);
    const isCustomer = String(conversation.customerId) === String(payload.userId);

    if (!isAdmin && !isAssigned && !isCustomer) {
      console.warn(`❌ [Customer WebSocket] Access denied: user ${payload.userId} to conversation ${conversationId}`);
      return c.json({ success: false, error: 'Access denied to this conversation' }, 403);
    }

    console.log('🔌 [Customer WebSocket] Authenticated connection:', {
      conversationId,
      userId: payload.userId,
      role: payload.role
    });
  } catch (authError) {
    console.error('❌ [Customer WebSocket] Authentication failed:', authError);
    return c.json({ success: false, error: 'Invalid or expired session' }, 401);
  }

  try {
    // Get CustomerConversationDO instance by conversationId
    const doId = c.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
    const doStub = c.env.CUSTOMER_CONVERSATION_DO.get(doId);

    // Forward the request to the Durable Object
    const url = new URL(c.req.url);
    url.pathname = '/ws';
    const modifiedRequest = new Request(url.toString(), c.req.raw);

    return doStub.fetch(modifiedRequest);
  } catch (error) {
    console.error('❌ [Customer WebSocket] Connection error:', error);
    return c.json({
      success: false,
      error: 'Failed to establish WebSocket connection'
    }, 500);
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
    console.error('❌ [Customer Messages] JWT_SECRET not configured');
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

    const conversation = await db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedUserId: schema.conversations.assignedUserId,
    }).from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, 404);
    }

    // Allow access if user is assigned, is admin, or owns the conversation
    const isAdmin = payload.role === 'admin';
    const isAssigned = conversation.assignedUserId === String(payload.userId);
    const isCustomer = String(conversation.customerId) === String(payload.userId);

    if (!isAdmin && !isAssigned && !isCustomer) {
      console.warn(`❌ [Customer Messages] Access denied: user ${payload.userId} to conversation ${conversationId}`);
      return c.json({ success: false, error: 'Access denied to this conversation' }, 403);
    }

    console.log(`📨 [Customer Messages] Authenticated ${requestMethod} for conversation: ${conversationId} by user ${payload.userId}`);
  } catch (authError) {
    console.error('❌ [Customer Messages] Authentication failed:', authError);
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

    console.log(`📤 [Proxy] Forwarding to CustomerMessageDO: ${requestMethod} ${conversationId}`);
    return doStub.fetch(doRequest);
  } catch (error) {
    console.error('❌ [Customer Messages] Operation error:', error);
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
    console.error('❌ [Customer Upload] JWT_SECRET not configured');
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

    const conversation = await db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedUserId: schema.conversations.assignedUserId,
    }).from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return c.json({ success: false, error: 'Conversation not found' }, 404);
    }

    // Allow access if user is assigned, is admin, or owns the conversation
    const isAdmin = payload.role === 'admin';
    const isAssigned = conversation.assignedUserId === String(payload.userId);
    const isCustomer = String(conversation.customerId) === String(payload.userId);

    if (!isAdmin && !isAssigned && !isCustomer) {
      console.warn(`❌ [Customer Upload] Access denied: user ${payload.userId} to conversation ${conversationId}`);
      return c.json({ success: false, error: 'Access denied to this conversation' }, 403);
    }

    console.log(`📤 [Customer Upload] Authenticated upload for conversation: ${conversationId} by user ${payload.userId}`);
  } catch (authError) {
    console.error('❌ [Customer Upload] Authentication failed:', authError);
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
    console.error('❌ [Customer Upload] Upload error:', error);
    return c.json({
      success: false,
      error: 'Failed to upload file'
    }, 500);
  }
});

console.log('✅ Customer Conversation System (Chat-Style) endpoints registered:');
console.log('   • GET /api/customer-ws (WebSocket upgrade, query: conversationId, sessionId)');
console.log('   • GET /api/customer-conversations/:id/messages (Fetch messages with pagination)');
console.log('   • POST /api/customer-conversations/:id/messages (Create new message)');
console.log('   • POST /api/customer-conversations/:id/upload (Upload file to R2)');

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

console.log('✅ Channel Integration Management endpoints registered:');
console.log('   • GET    /api/channels           (List all channels for team)');
console.log('   • POST   /api/channels           (Create new channel - Admin only)');
console.log('   • GET    /api/channels/:id       (Get channel details)');
console.log('   • PUT    /api/channels/:id       (Update channel - Admin only)');
console.log('   • DELETE /api/channels/:id       (Deactivate channel - Admin only)');
console.log('   • POST   /api/channels/:id/verify (Verify channel configuration)');
console.log('   • GET    /api/channels/:id/stats (Get channel statistics)');
console.log('   • GET    /api/channels/:id/health (Check channel health)');

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

// 延遲初始化 P1 Optimizations（在第一個請求時執行）
async function initializeP1Optimizations(env: Bindings) {
  try {
    console.log('🚀 Initializing P1 Optimizations...');
    const { initializeP1Optimizations: init } = await import('./services/p1-optimizations');
    await init(env);
    console.log('✅ P1 Optimizations initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize P1 Optimizations:', error);
    // P1 優化失敗不應阻塞系統啟動
  }
}

// 延遲初始化 Collaboration 模組（在第一個請求時執行）
async function initializeCollaboration(env: Bindings) {
  if (collaborationInitialized) {
    return;
  }

  try {
    console.log('🤝 Initializing Collaboration Module...');

    // 先初始化 P1 優化
    await initializeP1Optimizations(env);

    const { Collaboration } = await import('@modules/collaboration');

    // 檢測環境：生產環境優先 WebSocket，開發環境使用 SSE
    const isProduction = env.ENVIRONMENT === 'production';
    const hasWebSocketSupport = !!(env.CONVERSATION_ROOM && env.USER_CONNECTION);

    const config = {
      defaultProtocol: (isProduction && hasWebSocketSupport) ? 'websocket' : 'sse',
      enableWebSocket: hasWebSocketSupport, // 如果 Durable Objects 可用則啟用
      typingExpirationSeconds: 5,
      presenceExpirationSeconds: 300,
      cleanupIntervalSeconds: 60,
      maxViewersPerConversation: 50,
      persistEvents: false
    };

    await Collaboration.initialize(env, config);

    collaborationInitialized = true;

    const protocolStatus = hasWebSocketSupport
      ? `WebSocket (primary) + SSE (fallback)`
      : `SSE only`;

    console.log(`✅ Collaboration Module initialized successfully`);
    console.log(`   Protocol: ${protocolStatus}`);
    console.log(`   Environment: ${env.ENVIRONMENT || 'unknown'}`);
  } catch (error) {
    console.error('❌ Failed to initialize Collaboration Module:', error);
    // 降級到僅 SSE 模式
    try {
      console.log('⚠️ Attempting fallback to SSE-only mode...');
      const { Collaboration } = await import('@modules/collaboration');
      await Collaboration.initialize(env, {
        defaultProtocol: 'sse',
        enableWebSocket: false,
        typingExpirationSeconds: 5,
        presenceExpirationSeconds: 300,
        cleanupIntervalSeconds: 60,
        maxViewersPerConversation: 50,
        persistEvents: false
      });
      collaborationInitialized = true;
      console.log('✅ Collaboration Module initialized in SSE fallback mode');
    } catch (fallbackError) {
      console.error('❌ Fallback initialization also failed:', fallbackError);
      throw fallbackError;
    }
  }
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

  // 🤝 初始化 Collaboration 模組
  if (!collaborationInitialized) {
    try {
      await initializeCollaboration(c.env);
    } catch (error) {
      console.error('⚠️ Collaboration module initialization failed (continuing anyway):', error);
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
// Period comparison endpoints have been pre-registered (lines 162-167)
// to prevent the main /api/analytics/* handler from intercepting them

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
// REMOVED: SSE routes (Phase 3 cleanup - SSE removed, WebSocket only)
// app.get('/api/realtime/sse', realtime.handlers.sse.connect);
app.post('/api/realtime/typing', jwtAuth, realtime.handlers.main.sendTypingStatus);
app.post('/api/realtime/broadcast', jwtAuth, realtime.handlers.main.broadcastToConversation);
app.get('/api/realtime/conversation/:id/status', jwtAuth, realtime.handlers.main.getConversationStatus);
app.post('/api/realtime/online-status', jwtAuth, realtime.handlers.main.updateOnlineStatus);
app.get('/api/realtime/config', jwtAuth, realtime.handlers.management.getConfig);
app.put('/api/realtime/config', jwtAuth, realtime.handlers.management.updateConfig);
app.get('/api/realtime/stats', jwtAuth, realtime.handlers.management.getStats);
app.get('/api/realtime/health', realtime.handlers.management.healthCheck);
// REMOVED: SSE stats/cleanup routes (Phase 3 cleanup)
// app.get('/api/realtime/sse/stats', jwtAuth, realtime.handlers.sse.getStats);
// app.post('/api/realtime/sse/cleanup', jwtAuth, realtime.handlers.sse.cleanup);
app.get('/api/realtime/monitoring/dashboard', jwtAuth, realtime.monitoring.dashboard as any);
app.get('/api/realtime/monitoring/metrics', jwtAuth, realtime.monitoring.metricsHistory);
app.get('/api/realtime/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
app.post('/api/realtime/monitoring/alerts', jwtAuth, realtime.monitoring.alerts);
app.get('/api/realtime/monitoring/health', realtime.monitoring.health);
app.get('/api/realtime/monitoring/config', jwtAuth, realtime.monitoring.config);
app.post('/api/realtime/monitoring/config', jwtAuth, realtime.monitoring.config);

// 活動記錄路由 - SSE stream 已在前面註冊 (lines 129-160)
// Only register the main activities handler here
app.route('/api/activities', activityHandler);

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

// ==================== Webhook 處理 ====================
// MOVED: Webhook routes now registered BEFORE unified route system (Priority 1)
// See lines ~273-310 for webhook registration
// This prevents 401 errors from catch-all routes in unified system

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

// Export Durable Objects (must match wrangler.toml class_name exactly)
export {
  ConversationRoom,
  UserConnection,
  MessageBroadcaster,
  LatestMessageCacheCoordinator,
  LockCoordinator,
  // Customer Conversation System (Chat-Style)
  CustomerConversationDO,
  CustomerMessageDO
};

// Export legacy Delayed Message DO names (kept for backward compatibility)
export { DelayedMessageScheduler as DelayedMessageBuffer };
export { DelayedMessageScheduler as DelayedMessageProcessor };

// ==================== 導出 Worker 處理器 ====================
// Phase 2.1: Queue Consumer 部分恢復 (Phase 3: LINE Async)
// - REALTIME_QUEUE 由 LatestMessageCacheCoordinator Durable Object 替代 (保持)
// - AGENT_QUEUE 由 DelayedMessageScheduler DO 替代 (保持)
// - 🆕 LINE_MESSAGE_QUEUE 新增用於 LINE 非同步訊息發送 (Phase 3)

// ✅ LINE Message Queue Consumer (Phase 3 - 2025-01)
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
    console.log(`📨 [LINE Queue] Received batch of ${batch.messages.length} messages`);
    await handleLineMessageQueue(batch, env);
  }
};
