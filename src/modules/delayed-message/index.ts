// Delayed Message Module - Main Exports
// 延遲訊息模組 - 主要導出

// Controllers
export { DelayedMessageController } from './controllers';

// Router - 創建標準路由器導出
import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { jwtAuth } from '../../middleware/auth';
import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';

// 創建標準路由器實例
export const delayedMessageRouter = new Hono<{ Bindings: Bindings }>();

// 直接在這裡定義路由，避免控制器的複雜性
delayedMessageRouter.post('/send', jwtAuth, async (c) => {
  try {
    const manager = new DelayedMessageManager(c.env);
    const data = await c.req.json();
    const user = c.get('user');
    const userInfo = { id: user.id.toString(), displayName: user.displayName, role: user.role };
    const result = await manager.sendDelayedMessage(data, userInfo);
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
});

delayedMessageRouter.post('/recall/:messageId', jwtAuth, async (c) => {
  try {
    const manager = new DelayedMessageManager(c.env);
    const messageId = c.req.param('messageId');
    const user = c.get('user');
    const userInfo = { id: user.id.toString(), displayName: user.displayName, role: user.role };
    const result = await manager.recallDelayedMessage(messageId, userInfo);
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
});

delayedMessageRouter.get('/pending', jwtAuth, async (c) => {
  try {
    const manager = new DelayedMessageManager(c.env);
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await manager.getPendingMessages(user.id.toString(), page, pageSize);
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
});

delayedMessageRouter.post('/reschedule/:messageId', jwtAuth, async (c) => {
  try {
    const manager = new DelayedMessageManager(c.env);
    const messageId = c.req.param('messageId');
    const data = await c.req.json();
    const user = c.get('user');
    const userInfo = { id: user.id.toString(), displayName: user.displayName, role: user.role };
    const result = await manager.rescheduleMessage(messageId, data.newDelaySeconds, userInfo);
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 400);
  }
});

// 為了與現有導入兼容，導出路由器
export const delayedMessageControllers = delayedMessageRouter;

// Services (Business Logic Layer)
export {
  DelayedMessageManager,
  MessageSchedulerService,
  MessageProcessorService
} from './services';

// Infrastructure Services
export {
  StorageService,
  ValidationService,
  EventService
} from './infrastructure';

// Types and Interfaces
export type {
  DelayedMessageRequest,
  DelayedMessageEntity,
  SendResult,
  RecallResult,
  ProcessResult,
  PendingMessagesResult,
  DelayedMessageEvent,
  DelayedMessageStorage,
  RecallInfo,
  CancelInfo,
  ValidationRule,
  ValidationResult,
  PlatformMessageSender,
  PlatformMessageData
} from './types';

// Error Classes
export {
  DelayedMessageError,
  ValidationError,
  StorageError,
  SchedulingError,
  ProcessingError
} from './types';

// Factory function to create a controller instance
export function createDelayedMessageController(env: any) {
  const { DelayedMessageController } = require('./controllers');
  return new DelayedMessageController(env);
}