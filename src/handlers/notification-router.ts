// Notification Router - 統一通知路由處理器
// 將模組化的 NotificationHandler 封裝為 Hono app 實例

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { createNotificationHandlerMethods } from '@modules/notifications/handlers/notification-main';
// REMOVED: createNotificationSSEHandlerMethods (Phase 2 cleanup - SSE removed)

const app = new Hono<{ Bindings: Bindings }>();

// 健康檢查端點 (無需認證)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'notifications',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 模組資訊端點
app.get('/info', (c) => {
  return c.json({
    success: true,
    module: 'notifications',
    description: 'Unified multi-channel notification system',
    features: [
      'Multi-channel notification delivery',
      'Real-time SSE notifications',
      'Bulk operations',
      'Advanced caching',
      'Statistics and monitoring'
    ],
    timestamp: new Date().toISOString()
  });
});

// ======================== Main Notification Routes ========================

// 獲取通知列表
app.get('/', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.list(c as any);
});

// 創建通知
app.post('/', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.create(c as any);
});

// 批量創建通知
app.post('/bulk', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.createBulk(c as any);
});

// 獲取通知統計
app.get('/stats', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getStats(c as any);
});

// 獲取未讀數量
app.get('/unread-count', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getUnreadCount(c as any);
});

// 獲取最近通知
app.get('/recent', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getRecent(c as any);
});

// 獲取單個通知
app.get('/:id', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getById(c as any);
});

// 標記為已讀
app.put('/:id/read', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.markAsRead(c as any);
});

// 批量標記已讀
app.put('/mark-all-read', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.markAllAsRead(c as any);
});

// 刪除通知
app.delete('/:id', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.delete(c as any);
});

// ======================== Admin Routes ========================

// 清理過期通知
app.delete('/cleanup', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.cleanup(c as any);
});

// 通道統計
app.get('/channels/stats', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.getChannelStats(c as any);
});

// 測試通道
app.post('/channels/:channelType/test', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.testChannel(c as any);
});

// ======================== Convenience Routes ========================

// 新訊息通知
app.post('/new-message', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.notifyNewMessage(c as any);
});

// 對話指派通知
app.post('/conversation-assigned', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.notifyConversationAssigned(c as any);
});

// 系統通知
app.post('/system', jwtAuth, async (c) => {
  const handlers = createNotificationHandlerMethods(c.env.DB, c.env.CACHE);
  return handlers.notifySystem(c as any);
});

// ======================== SSE Routes REMOVED ========================
// REMOVED: All SSE routes (Phase 2 cleanup - SSE removed, WebSocket only)
// - app.get('/sse', ...)
// - app.post('/sse/send', ...)
// - app.post('/sse/broadcast', ...)
// - app.get('/sse/stats', ...)
// - app.post('/sse/cleanup', ...)
// - app.get('/sse/connections/count', ...)

export default app;