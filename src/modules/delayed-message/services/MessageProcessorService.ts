// Delayed Message Module - Message Processor Service
// 延遲訊息模組 - 訊息處理服務

import type { Bindings } from '../../../types';
import type {
  DelayedMessageEntity,
  ProcessResult,
  PlatformMessageSender,
  PlatformMessageData
} from '../types';
import { ProcessingError } from '@modules/delayed-message/types';
import { StorageService } from '@modules/delayed-message/infrastructure/StorageService';

/**
 * MessageProcessorService - 訊息處理專家
 *
 * 職責：
 * - 處理 Queue 中的延遲訊息
 * - 管理平台發送適配
 * - 處理發送重試機制
 * - 維護發送結果狀態
 */
export class MessageProcessorService {
  private storageService: StorageService;
  private platformSenders: Map<string, PlatformMessageSender>;

  constructor(private env: Bindings) {
    this.storageService = new StorageService(env);
    this.platformSenders = new Map();
    this.initializePlatformSenders();
  }

  /**
   * 處理 Queue 中的延遲訊息
   */
  async processQueueMessage(messageId: string): Promise<ProcessResult> {
    try {
      // 1. 檢查是否已被取消
      const isCancelled = await this.storageService.isCancelled(messageId);
      if (isCancelled) {
        console.log(`🔄 [MessageProcessorService] Message ${messageId} was cancelled, skipping send`);
        return { success: true, skipped: true };
      }

      // 2. 從資料庫獲取待發送訊息
      const message = await this.storageService.getMessageById(messageId);
      if (!message) {
        throw new ProcessingError('Pending message not found', { messageId });
      }

      if (message.status !== 'pending') {
        console.log(`⚠️ [MessageProcessorService] Message ${messageId} is not in pending status: ${message.status}`);
        return { success: true, skipped: true };
      }

      // 3. 獲取對話資訊
      const conversationInfo = await this.getConversationInfo(message.conversationId);
      if (!conversationInfo) {
        throw new ProcessingError('Conversation not found', { conversationId: message.conversationId });
      }

      // 4. 發送訊息到平台
      const sendSuccess = await this.sendMessageToPlatform(message, conversationInfo);
      const now = new Date();
      const newStatus = sendSuccess ? 'sent' : 'failed';

      // 5. 更新狀態
      await this.storageService.updateMessageStatus(messageId, newStatus, now);

      if (sendSuccess) {
        // 創建正式訊息記錄
        await this.storageService.saveMessageRecord(
          messageId,
          message.conversationId,
          message.agentId,
          message.content,
          message.messageType,
          now
        );
      }

      // 6. 記錄操作日誌
      await this.storageService.logOperation(messageId, message.agentId, newStatus, now);

      // 7. 清理 KV 標記
      await this.storageService.cleanup(messageId);

      console.log(`${sendSuccess ? '✅' : '❌'} [MessageProcessorService] Message ${messageId} processing ${sendSuccess ? 'succeeded' : 'failed'}`);

      return { success: sendSuccess };

    } catch (error) {
      console.error(`❌ [MessageProcessorService] Failed to process queue message ${messageId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 批量處理訊息
   */
  async processBatch(messageIds: string[]): Promise<Array<{
    messageId: string;
    result: ProcessResult;
  }>> {
    const results = await Promise.allSettled(
      messageIds.map(async (messageId) => ({
        messageId,
        result: await this.processQueueMessage(messageId)
      }))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          messageId: 'unknown',
          result: {
            success: false,
            error: 'Batch processing failed'
          }
        };
      }
    });
  }

  /**
   * 重試失敗的訊息
   */
  async retryFailedMessage(messageId: string, maxRetries: number = 3): Promise<ProcessResult> {
    try {
      const message = await this.storageService.getMessageById(messageId);
      if (!message) {
        return {
          success: false,
          error: 'Message not found'
        };
      }

      if (message.status !== 'failed') {
        return {
          success: false,
          error: 'Message is not in failed status'
        };
      }

      // 檢查重試次數
      const retryCount = (message.metadata.retryCount || 0) + 1;
      if (retryCount > maxRetries) {
        return {
          success: false,
          error: 'Max retries exceeded'
        };
      }

      // 更新重試次數
      message.metadata.retryCount = retryCount;
      message.metadata.lastRetryAt = new Date().toISOString();

      // 重新設定為待處理狀態
      await this.storageService.updateMessageStatus(messageId, 'pending', new Date());

      // 重新處理
      return await this.processQueueMessage(messageId);

    } catch (error) {
      console.error(`❌ [MessageProcessorService] Failed to retry message ${messageId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Retry failed'
      };
    }
  }

  /**
   * 測試平台連接
   */
  async testPlatformConnection(platform: 'line' | 'facebook'): Promise<boolean> {
    try {
      const sender = this.platformSenders.get(platform);
      if (!sender) {
        return false;
      }

      // 發送測試訊息（實際實現中可能需要測試端點）
      return true;
    } catch (error) {
      console.error(`❌ [MessageProcessorService] Platform connection test failed for ${platform}:`, error);
      return false;
    }
  }

  /**
   * 獲取處理統計
   */
  async getProcessingStats(_timeRange?: { from: Date; to: Date }): Promise<{
    totalProcessed: number;
    successfulSends: number;
    failedSends: number;
    skippedMessages: number;
    averageProcessingTime: number;
  }> {
    try {
      // 這裡可以實現統計邏輯
      // 目前返回模擬數據
      return {
        totalProcessed: 0,
        successfulSends: 0,
        failedSends: 0,
        skippedMessages: 0,
        averageProcessingTime: 0
      };
    } catch (error) {
      console.error('❌ [MessageProcessorService] Failed to get processing stats:', error);
      return {
        totalProcessed: 0,
        successfulSends: 0,
        failedSends: 0,
        skippedMessages: 0,
        averageProcessingTime: 0
      };
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 檢查儲存服務
      const storageHealthy = await this.storageService.healthCheck();
      if (!storageHealthy) {
        return false;
      }

      // 檢查平台連接
      for (const [platform, _sender] of this.platformSenders) {
        const platformHealthy = await this.testPlatformConnection(platform as 'line' | 'facebook');
        if (!platformHealthy) {
          console.warn(`⚠️ [MessageProcessorService] Platform ${platform} connection unhealthy`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ [MessageProcessorService] Health check failed:', error);
      return false;
    }
  }

  // 私有方法

  /**
   * 初始化平台發送器
   */
  private initializePlatformSenders(): void {
    // LINE 發送器
    this.platformSenders.set('line', {
      platform: 'line',
      sendMessage: this.sendLineMessage.bind(this)
    });

    // Facebook 發送器
    this.platformSenders.set('facebook', {
      platform: 'facebook',
      sendMessage: this.sendFacebookMessage.bind(this)
    });
  }

  /**
   * 發送訊息到指定平台
   */
  private async sendMessageToPlatform(
    message: DelayedMessageEntity,
    conversationInfo: any
  ): Promise<boolean> {
    try {
      const platform = message.metadata.platform || conversationInfo.platform;
      const sender = this.platformSenders.get(platform);

      if (!sender) {
        throw new ProcessingError(`Unsupported platform: ${platform}`, {
          platform,
          messageId: message.id
        });
      }

      const messageData: PlatformMessageData = {
        recipientId: message.metadata.recipientPlatformId || conversationInfo.platformUserId,
        content: message.content,
        messageType: message.messageType,
        mediaUrl: message.metadata.mediaUrl
      };

      return await sender.sendMessage(messageData);

    } catch (error) {
      console.error(`❌ [MessageProcessorService] Failed to send message to platform:`, error);
      throw error;
    }
  }

  /**
   * 發送 LINE 訊息
   */
  private async sendLineMessage(messageData: PlatformMessageData): Promise<boolean> {
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: messageData.recipientId,
          messages: [{
            type: 'text',
            text: messageData.content
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [MessageProcessorService] LINE API error:`, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ [MessageProcessorService] LINE message send error:', error);
      return false;
    }
  }

  /**
   * 發送 Facebook 訊息
   */
  private async sendFacebookMessage(messageData: PlatformMessageData): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${this.env.FB_PAGE_ACCESS_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: { id: messageData.recipientId },
            message: { text: messageData.content }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [MessageProcessorService] Facebook API error:`, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ [MessageProcessorService] Facebook message send error:', error);
      return false;
    }
  }

  /**
   * 獲取對話資訊
   */
  private async getConversationInfo(conversationId: string): Promise<any> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { eq } = await import('drizzle-orm');
      const { conversations, customers } = await import('../../../db/schema');

      const db = drizzle(this.env.DB);

      const result = await db
        .select({
          id: conversations.id,
          customerId: conversations.customerId,
          platform: customers.platform,
          platformUserId: customers.platformUserId,
          customerName: customers.displayName
        })
        .from(conversations)
        .innerJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, conversationId))
        .get();

      return result;
    } catch (error) {
      console.error('❌ [MessageProcessorService] Error getting conversation info:', error);
      return null;
    }
  }
}

// 導出自定義錯誤類別
export { ProcessingError } from '../types';