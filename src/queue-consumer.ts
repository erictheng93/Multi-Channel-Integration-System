// Cloudflare Queue Consumer - 延遲訊息處理
// Queue Consumer for Delayed Message Processing

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
        const result = await recallService.processQueueMessage(messageId);
        
        if (result.success) {
          if (result.skipped) {
            console.log(`Message ${messageId} was cancelled, skipped sending`);
          } else {
            console.log(`Message ${messageId} sent successfully`);
          }
          
          // 確認訊息處理完成
          message.ack();
        } else {
          console.error(`Failed to process message ${messageId}:`, result.error);
          
          // 重試機制：如果是暫時性錯誤，可以選擇不 ack，讓 Queue 重試
          // 如果是永久性錯誤，則 ack 以避免無限重試
          if (isRetryableError(result.error)) {
            message.retry();
          } else {
            message.ack();
          }
        }
      } else {
        console.warn(`Unknown action: ${action} for message ${messageId}`);
        message.ack();
      }

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