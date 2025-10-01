// Delayed Message Handler - New Modular Implementation Bridge
// 延遲訊息處理器 - 新模組化實現橋接器

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { DelayedMessageController } from '@modules/delayed-message';

/**
 * 新的延遲訊息處理器 - 使用模組化架構
 *
 * 此處理器直接返回模組化控制器的路由器
 * 提供最簡潔的實現
 */

// 工廠函數來生成處理器
export function createDelayedMessageHandler(env: Bindings): Hono<{ Bindings: Bindings }> {
  const controller = new DelayedMessageController(env);
  return controller.getRouter();
}

// 為了兼容現有的 handler 模式，我們需要創建一個適配器
const delayedMessageModularHandler = new Hono<{ Bindings: Bindings }>();

// 使用中間件來處理所有請求
delayedMessageModularHandler.all('*', async (c) => {
  // 為每個請求創建新的控制器實例
  const controller = new DelayedMessageController(c.env);
  const router = controller.getRouter();

  // 將請求轉發給控制器路由器
  return router.fetch(c.req.raw, c.env);
});

export default delayedMessageModularHandler;