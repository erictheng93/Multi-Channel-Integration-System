/**
 * Cloudflare Queue Consumer - 延遲訊息處理
 * Queue Consumer for Delayed Message Processing
 *
 * ⚠️ DEPRECATED: Delayed Message 處理部分已棄用
 *
 * 原因：已從 Cloudflare Queues 遷移到 Durable Objects + Alarm API
 * 新實現：DelayedMessageBuffer Durable Object 自動處理延遲發送
 *
 * 此文件保留用於其他 Queue 處理，但 delayed message 相關代碼已標記為 deprecated
 *
 * @deprecated (延遲訊息部分) 使用 Durable Objects Alarm API 替代
 */

import type { Bindings } from './types';
import { MessageRecallService } from './services/message-recall-service';

export interface QueueMessage {
  messageId: string;
  action: string;
  timestamp: string;
}

/**
 * Queue Consumer 處理延遲訊息
 * 當 Queue 中的訊息到達預定時間時，此函數會被自動調用
 *
 * ⚠️ DEPRECATED: 此函數不再處理延遲訊息
 * Durable Objects + Alarm API 已接管所有延遲訊息處理
 */
async function handleQueueMessage(
  batch: MessageBatch<QueueMessage>,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  const recallService = new MessageRecallService(env);

  // 處理批次中的每個訊息
  for (const message of batch.messages) {
    try {
      const { messageId, action } = message.body;

      console.log(`Processing queue message: ${messageId}, action: ${action}`);

      if (action === 'send_delayed_message') {
        // ⚠️ DEPRECATED: 延遲訊息現在由 Durable Objects 處理
        console.warn('⚠️ [DEPRECATED] Delayed message processing via Queue is deprecated. Use Durable Objects instead.');
        message.ack(); // 直接確認，不再處理
        continue;
      }

      // 其他未知 action
      console.warn(`Unknown action: ${action} for message ${messageId}`);
      message.ack();

    } catch (error) {
      console.error(`Error processing queue message:`, error);
      
      // 對於未預期的錯誤，進行重試
      message.retry();
    }
  }
}

/**
 * 判斷錯誤是否可重試
 */
function isRetryableError(error?: string): boolean {
  if (!error) return false;

  const retryableErrors = [
    'network error',
    'timeout',
    'rate limit',
    'temporary failure',
    'service unavailable'
  ];

  return retryableErrors.some(retryableError => 
    error.toLowerCase().includes(retryableError)
  );
}

/**
 * Queue Consumer 的主要導出函數
 * 這個函數會被 Cloudflare Workers 自動調用
 */
export default async function queue(batch: MessageBatch<QueueMessage>, env: Bindings, ctx: ExecutionContext): Promise<void> {
  await handleQueueMessage(batch, env, ctx);
}