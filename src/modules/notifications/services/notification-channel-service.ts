// src/modules/notifications/services/notification-channel-service.ts
// 通知通道管理服務

import {
  NotificationBase,
  ChannelType,
  ChannelAdapter,
  ChannelMessage,
  DeliveryResult,
  ChannelRoutingRule,
  ChannelRouterConfig,
  BulkDeliveryJob,
  NotificationSettings
} from '../types';

// 導入所有適配器 (Phase 2: SSE removed)
// REMOVED: SSEAdapter (Phase 2 cleanup - SSE removed)
// import { SSEAdapter } from '@modules/notifications/adapters/sse-adapter';
import { WebSocketAdapter } from '@modules/notifications/adapters/websocket-adapter';
import { EmailAdapter } from '@modules/notifications/adapters/email-adapter';
import { PushAdapter } from '@modules/notifications/adapters/push-adapter';

export class NotificationChannelService {
  private adapters = new Map<ChannelType, ChannelAdapter>();
  private routerConfig: ChannelRouterConfig;
  private userSettings = new Map<number, NotificationSettings>();

  constructor() {
    this.initializeAdapters();
    this.initializeRouter();
  }

  private initializeAdapters(): void {
    // 初始化所有通道適配器 (Phase 2: SSE removed)
    // REMOVED: SSEAdapter (Phase 2 cleanup - SSE removed)
    // this.adapters.set('sse', new SSEAdapter());
    this.adapters.set('websocket', new WebSocketAdapter());
    this.adapters.set('email', new EmailAdapter());
    this.adapters.set('push', new PushAdapter());
  }

  private initializeRouter(): void {
    this.routerConfig = {
      defaultChannels: ['sse'],
      rules: [],
      fallbackEnabled: true,
      fallbackChannels: ['sse']
    };
  }

  // 發送通知到指定通道
  async send(notification: NotificationBase, channels?: ChannelType[]): Promise<{
    results: Record<ChannelType, DeliveryResult>;
    summary: {
      totalChannels: number;
      successfulChannels: number;
      failedChannels: number;
    };
  }> {
    const targetChannels = channels || await this.determineChannels(notification);
    const results: Record<ChannelType, DeliveryResult> = {} as any;
    let successfulChannels = 0;
    let failedChannels = 0;

    for (const channelType of targetChannels) {
      const adapter = this.adapters.get(channelType);

      if (!adapter || !adapter.isEnabled()) {
        results[channelType] = {
          success: false,
          errorMessage: `Channel ${channelType} is not available or disabled`
        };
        failedChannels++;
        continue;
      }

      const channelMessage: ChannelMessage = {
        id: crypto.randomUUID(),
        notification,
        channel: channelType,
        recipientId: notification.userId.toString(),
        status: 'pending',
        attempts: 0
      };

      try {
        const result = await adapter.send(channelMessage);
        results[channelType] = result;

        if (result.success) {
          successfulChannels++;
        } else {
          failedChannels++;
        }
      } catch (error) {
        results[channelType] = {
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
        failedChannels++;
      }
    }

    // 如果所有通道都失敗且啟用了後備機制
    if (successfulChannels === 0 && this.routerConfig.fallbackEnabled && channels) {
      // 嘗試使用後備通道
      for (const fallbackChannel of this.routerConfig.fallbackChannels) {
        if (!targetChannels.includes(fallbackChannel)) {
          const adapter = this.adapters.get(fallbackChannel);
          if (adapter && adapter.isEnabled()) {
            const channelMessage: ChannelMessage = {
              id: crypto.randomUUID(),
              notification,
              channel: fallbackChannel,
              recipientId: notification.userId.toString(),
              status: 'pending',
              attempts: 0
            };

            try {
              const result = await adapter.send(channelMessage);
              results[fallbackChannel] = result;

              if (result.success) {
                successfulChannels++;
                break;
              }
            } catch (error) {
              results[fallbackChannel] = {
                success: false,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          }
        }
      }
    }

    return {
      results,
      summary: {
        totalChannels: Object.keys(results).length,
        successfulChannels,
        failedChannels: Object.keys(results).length - successfulChannels
      }
    };
  }

  // 發送到預設通道
  async sendToDefault(notification: NotificationBase): Promise<{
    results: Record<ChannelType, DeliveryResult>;
    summary: {
      totalChannels: number;
      successfulChannels: number;
      failedChannels: number;
    };
  }> {
    const defaultChannels = await this.determineChannels(notification);
    return this.send(notification, defaultChannels);
  }

  // 批量發送通知
  async sendBulk(notifications: NotificationBase[]): Promise<{
    results: Array<{
      notification: NotificationBase;
      channelResults: Record<ChannelType, DeliveryResult>;
    }>;
    summary: {
      totalNotifications: number;
      successfulNotifications: number;
      failedNotifications: number;
      totalChannelAttempts: number;
      successfulChannelAttempts: number;
    };
  }> {
    const results: Array<{
      notification: NotificationBase;
      channelResults: Record<ChannelType, DeliveryResult>;
    }> = [];

    let totalChannelAttempts = 0;
    let successfulChannelAttempts = 0;
    let successfulNotifications = 0;

    // 按通道分組通知以提高效率
    const channelGroups = await this.groupNotificationsByChannels(notifications);

    // 並行處理每個通道
    const channelPromises = Array.from(channelGroups.entries()).map(async ([channelType, channelNotifications]) => {
      const adapter = this.adapters.get(channelType);

      if (!adapter || !adapter.isEnabled()) {
        return channelNotifications.map(notification => ({
          notification,
          channelType,
          result: {
            success: false,
            errorMessage: `Channel ${channelType} is not available or disabled`
          }
        }));
      }

      const channelMessages: ChannelMessage[] = channelNotifications.map(notification => ({
        id: crypto.randomUUID(),
        notification,
        channel: channelType,
        recipientId: notification.userId.toString(),
        status: 'pending',
        attempts: 0
      }));

      let channelResults: DeliveryResult[];

      try {
        if (adapter.sendBulk) {
          channelResults = await adapter.sendBulk(channelMessages);
        } else {
          // 後備：逐個發送
          channelResults = await Promise.all(
            channelMessages.map(message => adapter.send(message))
          );
        }
      } catch (error) {
        channelResults = channelMessages.map(() => ({
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }));
      }

      return channelNotifications.map((notification, index) => ({
        notification,
        channelType,
        result: channelResults[index] || {
          success: false,
          errorMessage: 'No result returned'
        }
      }));
    });

    const allChannelResults = await Promise.all(channelPromises);
    const flatResults = allChannelResults.flat();

    // 重新組織結果
    const resultMap = new Map<string, {
      notification: NotificationBase;
      channelResults: Record<ChannelType, DeliveryResult>;
    }>();

    for (const { notification, channelType, result } of flatResults) {
      const key = notification.id;

      if (!resultMap.has(key)) {
        resultMap.set(key, {
          notification,
          channelResults: {} as Record<ChannelType, DeliveryResult>
        });
      }

      const entry = resultMap.get(key)!;
      entry.channelResults[channelType] = result;

      totalChannelAttempts++;
      if (result.success) {
        successfulChannelAttempts++;
      }
    }

    // 計算成功的通知數量
    for (const entry of resultMap.values()) {
      const hasSuccessfulChannel = Object.values(entry.channelResults).some(result => result.success);
      if (hasSuccessfulChannel) {
        successfulNotifications++;
      }
      results.push(entry);
    }

    return {
      results,
      summary: {
        totalNotifications: notifications.length,
        successfulNotifications,
        failedNotifications: notifications.length - successfulNotifications,
        totalChannelAttempts,
        successfulChannelAttempts
      }
    };
  }

  // 根據用戶設定和路由規則決定通道
  private async determineChannels(notification: NotificationBase): Promise<ChannelType[]> {
    const userSettings = this.userSettings.get(notification.userId);

    // 檢查用戶設定
    if (userSettings) {
      const allowedChannels = this.getEnabledChannelsFromSettings(userSettings, notification.type);
      if (allowedChannels.length > 0) {
        return allowedChannels;
      }
    }

    // 檢查路由規則
    for (const rule of this.routerConfig.rules) {
      if (rule.enabled && this.matchesRule(notification, rule)) {
        return rule.channels.filter(channel => this.adapters.get(channel)?.isEnabled());
      }
    }

    // 使用預設通道
    return this.routerConfig.defaultChannels.filter(channel =>
      this.adapters.get(channel)?.isEnabled()
    );
  }

  private getEnabledChannelsFromSettings(
    settings: NotificationSettings,
    notificationType: string
  ): ChannelType[] {
    const channels: ChannelType[] = [];

    // 檢查通道偏好
    const channelPreferences = settings.channelPreferences[notificationType as keyof typeof settings.channelPreferences];
    if (channelPreferences && channelPreferences.length > 0) {
      return channelPreferences.filter(channel => this.adapters.get(channel)?.isEnabled());
    }

    // 檢查全域設定
    if (settings.sseEnabled) channels.push('sse');
    if (settings.websocketEnabled) channels.push('websocket');
    if (settings.emailEnabled) channels.push('email');
    if (settings.pushEnabled) channels.push('push');

    return channels.filter(channel => this.adapters.get(channel)?.isEnabled());
  }

  private matchesRule(notification: NotificationBase, rule: ChannelRoutingRule): boolean {
    return rule.conditions.every(condition => this.evaluateCondition(notification, condition));
  }

  private evaluateCondition(notification: NotificationBase, condition: any): boolean {
    const { field, operator, value } = condition;

    let fieldValue: any;
    switch (field) {
      case 'type':
        fieldValue = notification.type;
        break;
      case 'priority':
        fieldValue = notification.priority;
        break;
      case 'userId':
        fieldValue = notification.userId;
        break;
      default:
        return false;
    }

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      default:
        return false;
    }
  }

  private async groupNotificationsByChannels(
    notifications: NotificationBase[]
  ): Promise<Map<ChannelType, NotificationBase[]>> {
    const groups = new Map<ChannelType, NotificationBase[]>();

    for (const notification of notifications) {
      const channels = await this.determineChannels(notification);

      for (const channel of channels) {
        if (!groups.has(channel)) {
          groups.set(channel, []);
        }
        groups.get(channel)!.push(notification);
      }
    }

    return groups;
  }

  // 適配器管理
  getAdapter(channelType: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channelType);
  }

  enableChannel(channelType: ChannelType): void {
    const adapter = this.adapters.get(channelType);
    if (adapter && typeof (adapter as any).enable === 'function') {
      (adapter as any).enable();
    }
  }

  disableChannel(channelType: ChannelType): void {
    const adapter = this.adapters.get(channelType);
    if (adapter && typeof (adapter as any).disable === 'function') {
      (adapter as any).disable();
    }
  }

  // 用戶設定管理
  setUserSettings(userId: number, settings: NotificationSettings): void {
    this.userSettings.set(userId, settings);
  }

  getUserSettings(userId: number): NotificationSettings | undefined {
    return this.userSettings.get(userId);
  }

  // 路由配置
  addRoutingRule(rule: ChannelRoutingRule): void {
    this.routerConfig.rules.push(rule);
    // 按優先級排序
    this.routerConfig.rules.sort((a, b) => a.priority - b.priority);
  }

  removeRoutingRule(ruleId: string): void {
    const index = this.routerConfig.rules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.routerConfig.rules.splice(index, 1);
    }
  }

  updateRoutingRule(ruleId: string, updates: Partial<ChannelRoutingRule>): void {
    const rule = this.routerConfig.rules.find(rule => rule.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      // 重新排序
      this.routerConfig.rules.sort((a, b) => a.priority - b.priority);
    }
  }

  // 統計和監控
  getChannelStats(): Record<ChannelType, {
    enabled: boolean;
    type: ChannelType;
    stats?: any;
  }> {
    const stats: Record<ChannelType, any> = {} as any;

    for (const [channelType, adapter] of this.adapters.entries()) {
      stats[channelType] = {
        enabled: adapter.isEnabled(),
        type: adapter.type,
        stats: typeof (adapter as any).getStats === 'function'
          ? (adapter as any).getStats()
          : undefined
      };
    }

    return stats;
  }

  getRouterConfig(): ChannelRouterConfig {
    return { ...this.routerConfig };
  }

  // 測試功能
  async testChannel(
    channelType: ChannelType,
    userId: number,
    testMessage?: string
  ): Promise<DeliveryResult> {
    const adapter = this.adapters.get(channelType);

    if (!adapter || !adapter.isEnabled()) {
      return {
        success: false,
        errorMessage: `Channel ${channelType} is not available or disabled`
      };
    }

    const testNotification: NotificationBase = {
      id: 'test-notification',
      userId,
      type: 'system',
      title: 'Test Notification',
      content: testMessage || `This is a test notification for ${channelType} channel`,
      priority: 'normal',
      isRead: false,
      createdAt: new Date().toISOString()
    };

    const channelMessage: ChannelMessage = {
      id: crypto.randomUUID(),
      notification: testNotification,
      channel: channelType,
      recipientId: userId.toString(),
      status: 'pending',
      attempts: 0
    };

    return adapter.send(channelMessage);
  }
}