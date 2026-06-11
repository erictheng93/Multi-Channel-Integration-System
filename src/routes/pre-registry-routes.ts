import type { Hono } from 'hono';
import { isOriginAllowed } from '@/config/cors';
import { nowISO } from '@/utils/timestamp';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';
import websocketHealthApp from '@modules/websocket/handlers/websocket-health';
import websocketDashboardApp from '@modules/websocket/handlers/websocket-dashboard';
import websocketMainHandler from '@modules/websocket/handlers/websocket-main';
import { getConfigCheck } from '@modules/system/handlers/health-main';
import { comparisonAPI } from '@modules/analytics/handlers/comparison-api';
import kvOptimizationMonitoringHandler from '@modules/system/handlers/kv-optimization-monitoring';
import monitoringMainHandler from '@modules/monitoring/handlers/monitoring-main';
import corsMonitoringHandler from '@modules/monitoring/handlers/cors-monitoring';
import securityMonitoringHandler from '@modules/monitoring/handlers/security-monitoring';
import securityDashboardHandler from '@modules/monitoring/handlers/security-dashboard';
import kvManagementHandler from '@modules/monitoring/handlers/kv-management-main';
import fileProxyHandler from '@modules/file-management/handlers/file-proxy';
import adminMigrationsHandler from '@modules/system/handlers/admin-migrations';
import { webhookHandler } from '@modules/integrations/handlers/webhook';
import { customerMessagesHandler, customerWsHandler } from '@modules/customer-conversations/handlers';
import channelHandler from '@modules/integrations/handlers/channel-handler';
import liffHandler from '@modules/liff/handlers/liff';
import adminLiffQRBatchHandler from '@modules/liff/handlers/admin-liff-qr-batch';
import taskReminderHandler from '@modules/system/handlers/task-reminder-main';
import { operationalDrillRoutes } from './operational-drill-routes';

const log = createContextLogger('PreRegistryRoutes');

export function registerPreRegistryRoutes(app: Hono<{ Bindings: Bindings }>): void {
  // Protect sensitive WebSocket endpoints (leave /health, /readiness, /liveness, /migration-status public)
  app.use('/api/websocket/metrics', jwtAuth);
  app.use('/api/websocket/health-detail', jwtAuth);

  app.route('/api/websocket', websocketHealthApp);
  log.info('Public WebSocket health endpoints registered', {
    endpoints: [
      'GET /api/websocket/health',
      'GET /api/websocket/migration-status',
      'GET /api/websocket/readiness',
      'GET /api/websocket/liveness'
    ]
  });

  app.route('/api/websocket', websocketMainHandler);
  log.info('WebSocket connection endpoints registered', {
    endpoints: [
      'GET /api/websocket/connect (with websocketAuth)',
      'POST /api/websocket/disconnect (with websocketAuth)'
    ]
  });

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

  app.get('/api/system/config-check', jwtAuth, requireAdmin(), getConfigCheck);
  log.info('Configuration check endpoint registered (admin only)', {
    endpoint: 'GET /api/system/config-check (admin auth required)'
  });

  app.route('/api/ops/drills', operationalDrillRoutes);
  log.info('Operational drill endpoint registered', {
    endpoint: 'POST /api/ops/drills/run (staging token required)'
  });

  app.get('/api/r2-public/:folder/:filename', async (c) => {
    try {
      const { folder, filename } = c.req.param();
      const objectKey = `${folder}/${filename}`;
      const { verifyFileSignature } = await import('@/utils/file-signed-url');
      const sig = c.req.query('sig');
      const exp = c.req.query('exp');
      const sigValid = await verifyFileSignature(objectKey, sig, exp, c.env.JWT_SECRET);
      if (!sigValid) {
        return c.json({ error: 'File not found' }, 404);
      }

      const object = await c.env.R2_BUCKET.get(objectKey);
      if (!object) {
        return c.json({ error: 'File not found' }, 404);
      }

      const headers = new Headers();
      const origin = c.req.header('Origin');
      if (origin && isOriginAllowed(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', '*');
        headers.set('Access-Control-Expose-Headers', 'ETag, Content-Length, Content-Type');
        headers.set('Access-Control-Max-Age', '3600');
      }

      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('ETag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000');
      headers.set('Content-Length', object.size.toString());

      return new Response(object.body, { headers });
    } catch (error) {
      log.error('R2 proxy error', { error });
      return c.json({ error: 'Failed to fetch file' }, 500);
    }
  });

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

  app.use('/api/analytics/comparison/*', jwtAuth);
  app.route('/api/analytics/comparison', comparisonAPI);
  log.info('Analytics Comparison API registered', {
    endpoints: ['/api/analytics/comparison/* (with internal OPTIONS handler)']
  });

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

  app.use('/api/cors/stats', jwtAuth);
  app.use('/api/cors/events', jwtAuth);
  app.use('/api/cors/rejected-origins', jwtAuth);
  app.use('/api/cors/cleanup', jwtAuth);
  app.route('/api/cors', corsMonitoringHandler);
  log.info('CORS monitoring endpoints PRE-REGISTERED (before unified route system)', {
    endpoints: [
      'GET /api/cors/stats (Admin only)',
      'GET /api/cors/events (Admin only)',
      'GET /api/cors/rejected-origins (Admin only)'
    ]
  });

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

  app.route('/api/kv', kvManagementHandler);
  log.info('KV Management endpoints registered', {
    endpoints: [
      'GET /api/kv/stats (Admin only)',
      'GET /api/kv/health (Auth required)',
      'POST /api/kv/cleanup (Admin only)',
      'GET /api/kv/naming-convention (Public)'
    ]
  });

  app.route('/api/files', fileProxyHandler);
  log.info('File proxy endpoints PRE-REGISTERED (public access)', {
    endpoints: [
      'GET /api/files/public/* (R2 path proxy)',
      'GET /api/files/download/:attachmentId (attachment ID proxy)'
    ]
  });

  app.route('/api/admin/migrations', adminMigrationsHandler);
  log.info('Admin migration endpoints PRE-REGISTERED (admin only)', {
    endpoints: [
      'POST /api/admin/migrations/backfill-legacy-filenames (dryRun, limit, cursor)'
    ]
  });

  app.post('/api/webhook', (c) => webhookHandler.line(c));
  app.get('/api/webhook', (c) => {
    return c.json({
      success: true,
      message: 'LINE Webhook endpoint is ready',
      timestamp: nowISO(),
      endpoint: '/api/webhook',
      method: 'POST'
    });
  });
  log.info('LINE Webhook endpoint PRE-REGISTERED', {
    endpoint: 'POST /api/webhook'
  });

  app.all('/api/webhooks/facebook', webhookHandler.facebook);
  log.info('Facebook Webhook endpoint PRE-REGISTERED', {
    endpoint: 'GET/POST /api/webhooks/facebook'
  });

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

  app.use('/api/channels', jwtAuth);
  app.use('/api/channels/*', jwtAuth);
  app.route('/api/channels', channelHandler);
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

  app.route('/api/admin/liff-qr', adminLiffQRBatchHandler);
  log.info('Admin LIFF QR batch generation endpoints registered (admin only)', {
    endpoints: [
      'POST /api/admin/liff-qr/batch-generate - Batch generate LIFF QR Codes',
      'GET  /api/admin/liff-qr/status - Check LIFF QR Code coverage'
    ]
  });

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
}
