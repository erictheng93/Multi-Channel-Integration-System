// src/modules/notifications/adapters/push-adapter.ts
// Push 通知適配器 (準備用於未來擴展)

import {
  ChannelAdapter,
  ChannelMessage,
  DeliveryResult,
  ChannelType,
  PushConfig,
  PushSubscription,
  ChannelConfig
} from '../types';
import { nowISO, nowMs } from '@/utils/timestamp'

export class PushAdapter implements ChannelAdapter {
  readonly type: ChannelType = 'push';
  private enabled = false; // 目前停用，等待 Push 服務設定
  private config: PushConfig;
  private subscriptions = new Map<number, PushSubscription[]>();

  constructor(config?: Partial<PushConfig>) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 2000,
      timeout: 30000,
      batchSize: 50,
      provider: 'webpush',
      credentials: {},
      defaultSound: 'default',
      defaultIcon: '/icon-192.png',
      ...config
    };
  }

  isEnabled(): boolean {
    return this.enabled && this.hasValidCredentials();
  }

  validateConfig(config: ChannelConfig): boolean {
    const pushConfig = config as PushConfig;
    return (
      config.retryAttempts >= 0 &&
      config.retryDelay >= 0 &&
      config.timeout > 0 &&
      !!pushConfig.provider &&
      !!pushConfig.credentials
    );
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    if (!this.isEnabled()) {
      return {
        success: false,
        errorMessage: 'Push adapter is not enabled or not configured',
        deliveryTime: 0
      };
    }

    const startTime = nowMs();

    try {
      const userSubscriptions = this.subscriptions.get(parseInt(message.recipientId));

      if (!userSubscriptions || userSubscriptions.length === 0) {
        return {
          success: false,
          errorMessage: 'No push subscriptions found for user',
          deliveryTime: Date.now() - startTime
        };
      }

      const pushPayload = this.preparePushPayload(message);
      let deliveredCount = 0;
      let failedCount = 0;
      const results: any[] = [];

      // 發送到所有用戶裝置
      for (const subscription of userSubscriptions) {
        try {
          const result = await this.sendToPushService(subscription, pushPayload);
          if (result.success) {
            deliveredCount++;
          } else {
            failedCount++;
          }
          results.push(result);
        } catch (error) {
          console.error(`Failed to send push to subscription:`, error);
          failedCount++;
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const success = deliveredCount > 0;

      return {
        success,
        messageId: crypto.randomUUID(),
        deliveryTime: Date.now() - startTime,
        metadata: {
          deliveredDevices: deliveredCount,
          failedDevices: failedCount,
          totalDevices: userSubscriptions.length,
          results
        }
      };

    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        deliveryTime: Date.now() - startTime
      };
    }
  }

  async sendBulk(messages: ChannelMessage[]): Promise<DeliveryResult[]> {
    if (!this.isEnabled()) {
      return messages.map(() => ({
        success: false,
        errorMessage: 'Push adapter is not enabled or not configured',
        deliveryTime: 0
      }));
    }

    const results: DeliveryResult[] = [];

    // Push 通知分批處理
    const batchSize = this.config.batchSize || 50;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => this.send(message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 延遲以避免超過 push 服務的速率限制
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  private preparePushPayload(message: ChannelMessage): any {
    const notification = message.notification;

    return {
      title: notification.title,
      body: notification.content,
      icon: this.config.defaultIcon,
      badge: '/badge-icon.png',
      sound: this.config.defaultSound,
      tag: `notification-${notification.id}`,
      data: {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        priority: notification.priority,
        createdAt: notification.createdAt,
        customData: notification.data,
        url: this.getNotificationUrl(notification)
      },
      actions: this.getNotificationActions(notification),
      requireInteraction: notification.priority === 'urgent',
      silent: false,
      timestamp: nowMs()
    };
  }

  private async sendToPushService(
    subscription: PushSubscription,
    payload: any
  ): Promise<{ success: boolean; error?: string }> {
    // 這裡是模擬實作，實際使用時需要整合真正的 push 服務
    // 例如 Web Push, FCM, APNs 等

    try {
      // 模擬網路延遲
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

      // 模擬成功率（實際實作中不需要）
      const success = Math.random() > 0.1; // 90% 成功率

      if (success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Simulated push delivery failure'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getNotificationUrl(notification: any): string {
    // 根據通知類型生成對應的 URL
    switch (notification.type) {
      case 'new_message':
      case 'conversation_assigned':
      case 'conversation_transferred':
        return `/conversations/${notification.data?.conversationId || ''}`;
      case 'mention':
        return `/conversations/${notification.data?.conversationId || ''}`;
      case 'task_reminder':
        return `/tasks/${notification.data?.taskId || ''}`;
      case 'system':
        return '/notifications';
      default:
        return '/dashboard';
    }
  }

  private getNotificationActions(notification: any): any[] {
    const actions = [];

    switch (notification.type) {
      case 'new_message':
      case 'customer_responded':
        actions.push(
          { action: 'reply', title: '回覆', icon: '/icons/reply.png' },
          { action: 'view', title: '查看', icon: '/icons/view.png' }
        );
        break;
      case 'conversation_assigned':
      case 'conversation_transferred':
        actions.push(
          { action: 'accept', title: '接受', icon: '/icons/accept.png' },
          { action: 'view', title: '查看', icon: '/icons/view.png' }
        );
        break;
      case 'task_reminder':
        actions.push(
          { action: 'complete', title: '完成', icon: '/icons/complete.png' },
          { action: 'snooze', title: '延後', icon: '/icons/snooze.png' }
        );
        break;
      default:
        actions.push(
          { action: 'view', title: '查看', icon: '/icons/view.png' }
        );
    }

    return actions;
  }

  // 訂閱管理
  addSubscription(userId: number, subscription: PushSubscription): void {
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, []);
    }

    const userSubscriptions = this.subscriptions.get(userId)!;

    // 移除相同端點的舊訂閱
    const existingIndex = userSubscriptions.findIndex(
      sub => sub.endpoint === subscription.endpoint
    );
    if (existingIndex !== -1) {
      userSubscriptions.splice(existingIndex, 1);
    }

    userSubscriptions.push(subscription);
    console.log(`Push subscription added for user ${userId}`);
  }

  removeSubscription(userId: number, endpoint: string): void {
    const userSubscriptions = this.subscriptions.get(userId);
    if (!userSubscriptions) return;

    const index = userSubscriptions.findIndex(sub => sub.endpoint === endpoint);
    if (index !== -1) {
      userSubscriptions.splice(index, 1);
      console.log(`Push subscription removed for user ${userId}`);

      if (userSubscriptions.length === 0) {
        this.subscriptions.delete(userId);
      }
    }
  }

  getUserSubscriptions(userId: number): PushSubscription[] {
    return this.subscriptions.get(userId) || [];
  }

  getSubscriptionCount(userId: number): number {
    return this.subscriptions.get(userId)?.length || 0;
  }

  getTotalSubscriptionCount(): number {
    let total = 0;
    for (const subscriptions of this.subscriptions.values()) {
      total += subscriptions.length;
    }
    return total;
  }

  // 清理過期的訂閱
  cleanupExpiredSubscriptions(): void {
    // 在實際實作中，會驗證訂閱是否仍然有效
    // 這裡提供一個基本的框架
    console.log('Cleaning up expired push subscriptions...');
  }

  private hasValidCredentials(): boolean {
    switch (this.config.provider) {
      case 'webpush':
        return !!(this.config.credentials.vapidPublicKey && this.config.credentials.vapidPrivateKey);
      case 'fcm':
        return !!(this.config.credentials.serverKey || this.config.credentials.serviceAccountKey);
      case 'apns':
        return !!(this.config.credentials.key && this.config.credentials.keyId && this.config.credentials.teamId);
      default:
        return false;
    }
  }

  // 測試推播
  async sendTestPush(userId: number, title: string = 'Test Notification'): Promise<DeliveryResult> {
    const testMessage: ChannelMessage = {
      id: crypto.randomUUID(),
      notification: {
        id: 'test-notification',
        userId,
        type: 'system',
        title,
        content: 'This is a test push notification',
        priority: 'normal',
        isRead: false,
        createdAt: nowISO()
      },
      channel: 'push',
      recipientId: userId.toString(),
      status: 'pending',
      attempts: 0
    };

    return this.send(testMessage);
  }

  // 設定 Push 服務
  configure(config: Partial<PushConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 啟用/停用適配器
  enable(): void {
    if (!this.hasValidCredentials()) {
      throw new Error('Valid push service credentials are required to enable push adapter');
    }
    this.enabled = true;
    console.log('Push adapter enabled');
  }

  disable(): void {
    this.enabled = false;
    console.log('Push adapter disabled');
  }

  // 獲取適配器統計
  getStats(): {
    enabled: boolean;
    provider: string;
    totalUsers: number;
    totalSubscriptions: number;
    subscriptionsByUser: Record<number, number>;
  } {
    const subscriptionsByUser: Record<number, number> = {};
    let totalSubscriptions = 0;

    for (const [userId, subscriptions] of this.subscriptions.entries()) {
      subscriptionsByUser[userId] = subscriptions.length;
      totalSubscriptions += subscriptions.length;
    }

    return {
      enabled: this.isEnabled(),
      provider: this.config.provider,
      totalUsers: this.subscriptions.size,
      totalSubscriptions,
      subscriptionsByUser
    };
  }
}