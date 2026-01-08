// 模組化重組後的主入口檔案
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import type { Bindings } from './types';
import { getAllowedOrigins } from './config/cors';

// 模組導入
import { authMainHandler } from '@modules/auth';
import { conversationsMainHandler } from '@modules/conversations';
import { teamMainHandler } from '@modules/teams';
import { systemMainHandler } from '@modules/system';
import { customerRouter } from '@modules/customer';
import { sessionRouter } from '@modules/session';
import { messageRouter } from '@modules/messaging';
import { qrCodeRouter } from '@modules/qrcode';
import { delayedMessageControllers } from '@modules/delayed-message';
import { reportsHandler } from '@modules/reports';
// import { realTimeHandlers } from './modules/real-time';

// Import Durable Objects for WebSocket + Durable Objects Architecture
import { ConversationRoom } from './durable-objects/ConversationRoom';
import { UserConnection } from './durable-objects/UserConnection';
import { MessageBroadcaster } from './durable-objects/MessageBroadcaster';
import { DelayedMessageScheduler } from './durable-objects/DelayedMessageScheduler';
import { LockCoordinator } from './services/distributed-lock-service';

// 創建 Hono 應用實例
const app = new Hono<{ Bindings: Bindings }>();

// 全域中間件
app.use('*', logger());
app.use('*', timing());
// CORS 使用動態配置 (從環境變量讀取)
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = getAllowedOrigins(c.env);
    return allowed.includes(origin) ? origin : allowed[0] || 'http://localhost:3000';
  },
  credentials: true,
}));

// 健康檢查端點
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0-modular'
  });
});

// 模組路由註冊
app.route('/api/auth', authMainHandler);
app.route('/api/conversations', conversationsMainHandler);
app.route('/api/teams', teamMainHandler);
app.route('/api/system', systemMainHandler);
app.route('/api/customers', customerRouter);
app.route('/api/sessions', sessionRouter);
app.route('/api/messages', messageRouter);
app.route('/api/qrcode', qrCodeRouter);
app.route('/api/delayed-messages', delayedMessageControllers);
app.route('/api/reports', reportsHandler);

// 根路由
app.get('/', (c) => {
  return c.text('Multi-Channel Customer Support System - Modular Architecture');
});

// WebSocket 升級處理（待實現）
app.get('/api/ws', async (c) => {
  if (c.req.header('upgrade') !== 'websocket') {
    return c.text('Expected websocket', 426);
  }

  // WebSocket 升級邏輯將在 real-time 模組中實現
  return new Response(null, { status: 101 });
});

// 錯誤處理
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// 404 處理
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// ==================== Queue Consumer ====================

// ⚠️ REMOVED: AgentQueueService has been deprecated
// Delayed messages are now handled by DelayedMessageScheduler Durable Object

export default {
  fetch: app.fetch,
  queue: async (batch: any, env: Bindings) => {
    try {
      const queueName = batch.queue;
      console.log(`Processing queue: ${queueName}, messages: ${batch.messages.length}`);

      if (queueName === 'realtime-events') {
        // Handle realtime events
        const { handleLatestMessageQueue } = await import('./workers/latest-message-worker');
        await handleLatestMessageQueue(batch, env);
        console.log('Realtime events processed');

      } else if (queueName === 'agent-queue') {
        // ⚠️ DEPRECATED: agent-queue is no longer processed
        // Delayed messages are now handled by DelayedMessageScheduler Durable Object
        console.warn('⚠️ [DEPRECATED] agent-queue is deprecated. Messages will be ignored.');
      } else {
        console.warn(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing queue: ${errorMessage}`);
    }
  }
};

// Export Durable Objects for Cloudflare Workers
export { ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageScheduler, LockCoordinator };