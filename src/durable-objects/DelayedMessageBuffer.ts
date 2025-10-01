/**
 * DelayedMessageBuffer Durable Object
 * 專案名稱：Multi-Channel Support MVP - 延遲訊息容錯緩衝區
 *
 * 核心目的：為客服提供「後悔藥」機制，允許即時撤銷剛發送的訊息
 *
 * 設計理念：
 * - 這不是「任務調度器」，而是「撤銷緩衝區」(Undo Buffer)
 * - 訊息在發送前有 5-10 秒的「後悔期」
 * - 客服可以在此期間即時撤銷，響應時間 <100ms
 * - 使用 Alarm API 實現精確的時間控制
 *
 * 適用場景：
 * - 客服發現打錯字
 * - 發錯對象
 * - 發錯內容
 * - 臨時改變主意
 */

import type { Bindings } from '../types';

/**
 * 待發送訊息
 */
interface PendingMessage {
  id: string;
  conversationId: string;
  agentId: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file';
  platform: 'line' | 'facebook';
  recipientPlatformId: string;
  scheduledAt: number; // timestamp
  status: 'pending' | 'sent' | 'cancelled';
  metadata?: Record<string, any>;
  createdAt: number;
}

/**
 * 撤銷結果
 */
interface CancelResult {
  success: boolean;
  reason?: string;
  cancelledAt?: number;
}

/**
 * 狀態查詢結果
 */
interface StatusResult {
  exists: boolean;
  status?: 'pending' | 'sent' | 'cancelled' | 'not_found';
  timeRemaining?: number; // 剩餘秒數
  canCancel?: boolean;
  scheduledAt?: number;
}

/**
 * DelayedMessageBuffer Durable Object
 *
 * 每個 conversation 有一個獨立的 DO 實例
 * 使用 Alarm API 實現精確的延遲發送
 */
export class DelayedMessageBuffer implements DurableObject {
  private state: DurableObjectState;
  private env: Bindings;

  // 內存中的待發送訊息 (關鍵：快速存取)
  private pendingMessages: Map<string, PendingMessage> = new Map();

  // 下一個 Alarm 的時間
  private nextAlarmTime: number | null = null;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;

    // 從持久化存儲中恢復狀態
    this.state.blockConcurrencyWhile(async () => {
      await this.restoreState();
    });
  }

  /**
   * HTTP 請求處理器
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      switch (pathname) {
        case '/schedule':
          return await this.handleSchedule(request);
        case '/cancel':
          return await this.handleCancel(request);
        case '/status':
          return await this.handleStatus(request);
        case '/list':
          return await this.handleList(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ [DelayedMessageBuffer] Request error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * 排程延遲訊息
   *
   * 流程：
   * 1. 存入內存 Map (極快)
   * 2. 設定 Alarm (自動持久化)
   * 3. 即時返回 (無需等待資料庫)
   */
  private async handleSchedule(request: Request): Promise<Response> {
    const data = await request.json() as {
      messageId: string;
      conversationId: string;
      agentId: string;
      content: string;
      messageType?: string;
      platform: string;
      recipientPlatformId: string;
      delaySeconds: number;
      metadata?: Record<string, any>;
    };

    // 驗證參數
    if (!data.messageId || !data.conversationId || !data.content || !data.agentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 驗證延遲時間 (1-120 秒)
    const delaySeconds = data.delaySeconds || 5;
    if (delaySeconds < 1 || delaySeconds > 120) {
      return new Response(
        JSON.stringify({ success: false, error: 'Delay must be between 1-120 seconds' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const scheduledAt = now + (delaySeconds * 1000);

    // 創建待發送訊息
    const message: PendingMessage = {
      id: data.messageId,
      conversationId: data.conversationId,
      agentId: data.agentId,
      content: data.content,
      messageType: (data.messageType as any) || 'text',
      platform: data.platform as any,
      recipientPlatformId: data.recipientPlatformId,
      scheduledAt,
      status: 'pending',
      metadata: data.metadata,
      createdAt: now
    };

    // 1. 存入內存 (毫秒級操作)
    this.pendingMessages.set(message.id, message);

    // 2. 持久化到 Durable Object Storage
    await this.state.storage.put(`msg:${message.id}`, message);

    // 3. 設定或更新 Alarm
    await this.updateAlarm();

    console.log(`⏰ [DelayedMessageBuffer] Scheduled message ${message.id} for ${delaySeconds}s delay`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: message.id,
        scheduledAt,
        canCancelUntil: scheduledAt,
        delaySeconds
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * 撤銷延遲訊息
   *
   * 關鍵優勢：真正的即時撤銷
   * - 直接從內存刪除 (<10ms)
   * - Alarm 不會觸發
   * - 100% 可靠，無競態條件
   */
  private async handleCancel(request: Request): Promise<Response> {
    const data = await request.json() as {
      messageId: string;
      reason?: string;
    };

    if (!data.messageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await this.cancelMessage(data.messageId, data.reason);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  /**
   * 取消訊息的核心邏輯
   */
  private async cancelMessage(messageId: string, reason?: string): Promise<CancelResult> {
    // 1. 檢查訊息是否存在
    const message = this.pendingMessages.get(messageId);

    if (!message) {
      return {
        success: false,
        reason: 'Message not found or already processed'
      };
    }

    // 2. 檢查狀態
    if (message.status !== 'pending') {
      return {
        success: false,
        reason: `Message already ${message.status}`
      };
    }

    // 3. 檢查是否還在可撤銷時間內
    const now = Date.now();
    if (now >= message.scheduledAt) {
      // 已經到時間了，可能正在發送或已發送
      return {
        success: false,
        reason: 'Message send time has passed'
      };
    }

    // 4. 標記為已取消 (內存操作，極快)
    message.status = 'cancelled';
    if (reason) {
      message.metadata = { ...message.metadata, cancelReason: reason };
    }

    // 5. 從內存刪除 (阻止發送)
    this.pendingMessages.delete(messageId);

    // 6. 從持久化存儲刪除
    await this.state.storage.delete(`msg:${messageId}`);

    // 7. 更新 Alarm (如果沒有其他待發訊息，取消 Alarm)
    await this.updateAlarm();

    const cancelledAt = Date.now();

    console.log(`❌ [DelayedMessageBuffer] Cancelled message ${messageId}. Reason: ${reason || 'none'}`);

    return {
      success: true,
      cancelledAt
    };
  }

  /**
   * 查詢訊息狀態
   *
   * 用於前端倒數計時和狀態顯示
   */
  private async handleStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const messageId = url.searchParams.get('messageId');

    if (!messageId) {
      return new Response(
        JSON.stringify({ exists: false, status: 'not_found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = this.pendingMessages.get(messageId);

    if (!message) {
      return new Response(
        JSON.stringify({
          exists: false,
          status: 'not_found'
        } as StatusResult),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const timeRemaining = Math.max(0, message.scheduledAt - now);
    const canCancel = message.status === 'pending' && timeRemaining > 0;

    const result: StatusResult = {
      exists: true,
      status: message.status,
      timeRemaining: Math.ceil(timeRemaining / 1000), // 轉換為秒
      canCancel,
      scheduledAt: message.scheduledAt
    };

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * 列出所有待發送訊息
   */
  private async handleList(_request: Request): Promise<Response> {
    const messages = Array.from(this.pendingMessages.values())
      .filter(msg => msg.status === 'pending')
      .map(msg => ({
        id: msg.id,
        content: msg.content.substring(0, 100),
        scheduledAt: msg.scheduledAt,
        timeRemaining: Math.max(0, msg.scheduledAt - Date.now())
      }));

    return new Response(
      JSON.stringify({
        success: true,
        count: messages.length,
        messages
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm 處理器 - 當時間到達時自動觸發
   *
   * 這是 Durable Objects 的核心功能
   * Cloudflare 會在精確的時間自動調用此方法
   */
  async alarm(): Promise<void> {
    console.log('⏰ [DelayedMessageBuffer] Alarm triggered');

    const now = Date.now();
    const readyMessages: PendingMessage[] = [];

    // 找出所有到時間的訊息
    for (const [_id, message] of this.pendingMessages) {
      if (message.status === 'pending' && message.scheduledAt <= now) {
        readyMessages.push(message);
      }
    }

    console.log(`📤 [DelayedMessageBuffer] Found ${readyMessages.length} messages ready to send`);

    // 並行發送所有到時間的訊息
    const sendPromises = readyMessages.map(msg => this.sendMessage(msg));
    await Promise.allSettled(sendPromises);

    // 設定下一個 Alarm (如果還有待發訊息)
    await this.updateAlarm();
  }

  /**
   * 更新 Alarm 時間
   *
   * 邏輯：
   * - 找出最早需要發送的訊息
   * - 設定 Alarm 在該時間觸發
   * - 如果沒有待發訊息，取消 Alarm
   */
  private async updateAlarm(): Promise<void> {
    let earliestTime: number | null = null;

    // 找出最早的發送時間
    for (const message of this.pendingMessages.values()) {
      if (message.status === 'pending') {
        if (!earliestTime || message.scheduledAt < earliestTime) {
          earliestTime = message.scheduledAt;
        }
      }
    }

    if (earliestTime && earliestTime !== this.nextAlarmTime) {
      // 設定新的 Alarm
      await this.state.storage.setAlarm(earliestTime);
      this.nextAlarmTime = earliestTime;
      console.log(`⏰ [DelayedMessageBuffer] Alarm set for ${new Date(earliestTime).toISOString()}`);
    } else if (!earliestTime && this.nextAlarmTime) {
      // 沒有待發訊息，取消 Alarm
      await this.state.storage.deleteAlarm();
      this.nextAlarmTime = null;
      console.log('⏰ [DelayedMessageBuffer] Alarm cancelled (no pending messages)');
    }
  }

  /**
   * 真正發送訊息到平台
   */
  private async sendMessage(message: PendingMessage): Promise<void> {
    try {
      console.log(`📤 [DelayedMessageBuffer] Sending message ${message.id} to ${message.platform}`);

      // 標記為處理中
      message.status = 'sent';

      let success = false;

      // 根據平台發送
      if (message.platform === 'line') {
        success = await this.sendLineMessage(message);
      } else if (message.platform === 'facebook') {
        success = await this.sendFacebookMessage(message);
      }

      if (success) {
        // 發送成功，從內存和存儲中移除
        this.pendingMessages.delete(message.id);
        await this.state.storage.delete(`msg:${message.id}`);

        // 更新資料庫 (存入正式的 messages 表)
        await this.storeMessageInDatabase(message);

        console.log(`✅ [DelayedMessageBuffer] Message ${message.id} sent successfully`);
      } else {
        // 發送失敗，保留在內存中等待重試
        message.status = 'pending';
        console.error(`❌ [DelayedMessageBuffer] Message ${message.id} send failed`);
      }

    } catch (error) {
      console.error(`❌ [DelayedMessageBuffer] Error sending message ${message.id}:`, error);
      message.status = 'pending'; // 重置狀態以便重試
    }
  }

  /**
   * 發送 LINE 訊息
   */
  private async sendLineMessage(message: PendingMessage): Promise<boolean> {
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: message.recipientPlatformId,
          messages: [{
            type: 'text',
            text: message.content
          }]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('❌ [DelayedMessageBuffer] LINE API error:', error);
      return false;
    }
  }

  /**
   * 發送 Facebook 訊息
   */
  private async sendFacebookMessage(message: PendingMessage): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${this.env.FB_PAGE_ACCESS_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: { id: message.recipientPlatformId },
            message: { text: message.content }
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('❌ [DelayedMessageBuffer] Facebook API error:', error);
      return false;
    }
  }

  /**
   * 存入資料庫 (正式的 messages 表)
   */
  private async storeMessageInDatabase(message: PendingMessage): Promise<void> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { messages, conversations } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const db = drizzle(this.env.DB);
      const now = new Date().toISOString();

      // 插入訊息記錄
      await db.insert(messages).values({
        id: message.id,
        conversationId: message.conversationId,
        senderType: 'agent',
        agentSenderId: message.agentId,
        content: message.content,
        messageType: message.messageType,
        isSent: true,
        deliveryStatus: 'sent',
        sentAt: now,
        metadata: JSON.stringify({
          ...message.metadata,
          wasDelayed: true,
          originalScheduledAt: message.scheduledAt
        }),
        createdAt: now
      });

      // 更新對話的最後訊息時間
      await db
        .update(conversations)
        .set({
          lastMessageAt: now,
          updatedAt: now
        })
        .where(eq(conversations.id, message.conversationId));

      console.log(`💾 [DelayedMessageBuffer] Message ${message.id} stored in database`);
    } catch (error) {
      console.error('❌ [DelayedMessageBuffer] Database error:', error);
    }
  }

  /**
   * 從存儲恢復狀態
   */
  private async restoreState(): Promise<void> {
    try {
      // 恢復所有訊息
      const allMessages = await this.state.storage.list<PendingMessage>({ prefix: 'msg:' });

      for (const [_key, message] of allMessages) {
        if (message.status === 'pending') {
          this.pendingMessages.set(message.id, message);
        }
      }

      // 恢復 Alarm
      const currentAlarm = await this.state.storage.getAlarm();
      this.nextAlarmTime = currentAlarm;

      console.log(`📂 [DelayedMessageBuffer] State restored: ${this.pendingMessages.size} pending messages`);
    } catch (error) {
      console.error('❌ [DelayedMessageBuffer] State restoration error:', error);
    }
  }
}