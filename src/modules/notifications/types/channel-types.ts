// src/modules/notifications/types/channel-types.ts
// 通知通道系統類型定義

import { NotificationBase } from '@modules/notifications/types/notification-types';

export interface NotificationChannelConfig {
  type: ChannelType;
  priority: number; // 通道優先級，數字越小優先級越高
  enabled: boolean;
  config: ChannelConfig;
}

export type ChannelType = 'database' | 'websocket' | 'email' | 'push' | 'webhook' | 'sms';

export interface ChannelConfig {
  retryAttempts: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
  batchSize?: number; // for bulk operations
  [key: string]: any; // channel-specific configurations
}

export interface ChannelMessage {
  id: string;
  notification: NotificationBase;
  channel: ChannelType;
  recipientId: string;
  status: DeliveryStatus;
  attempts: number;
  lastAttempt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
  deliveryTime?: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface ChannelAdapter {
  type: ChannelType;
  isEnabled(): boolean;
  validateConfig(config: ChannelConfig): boolean;
  send(message: ChannelMessage): Promise<DeliveryResult>;
  sendBulk?(messages: ChannelMessage[]): Promise<DeliveryResult[]>;
  getStatus?(messageId: string): Promise<DeliveryStatus>;
  cancel?(messageId: string): Promise<boolean>;
}

// WebSocket 特定類型
export interface WebSocketMessage {
  type: 'notification' | 'ping' | 'pong' | 'error' | 'subscribe' | 'unsubscribe';
  data?: any;
  timestamp: string;
  userId?: string | number;  // 支援字串和數字格式的 userId
  messageId?: string;
}

// Email 特定類型
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
}

export interface EmailConfig extends ChannelConfig {
  fromAddress: string;
  fromName: string;
  templateId?: string;
  useTemplate: boolean;
}

// Push 通知特定類型
export interface PushConfig extends ChannelConfig {
  provider: 'fcm' | 'apns' | 'webpush';
  credentials: Record<string, any>;
  defaultSound?: string;
  defaultIcon?: string;
}

export interface PushSubscription {
  userId: number;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceInfo?: {
    platform: string;
    browser?: string;
    version?: string;
  };
}

// Channel Router 類型
export interface ChannelRoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RoutingCondition[];
  channels: ChannelType[];
  priority: number;
}

export interface RoutingCondition {
  field: keyof NotificationBase | 'userSettings' | 'timeRange';
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

export interface ChannelRouterConfig {
  defaultChannels: ChannelType[];
  rules: ChannelRoutingRule[];
  fallbackEnabled: boolean;
  fallbackChannels: ChannelType[];
}

// 批量處理類型
export interface BulkDeliveryJob {
  id: string;
  messages: ChannelMessage[];
  channel: ChannelType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results?: DeliveryResult[];
  errorMessage?: string;
}

// 監控和統計類型
export interface ChannelMetrics {
  channel: ChannelType;
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    averageDeliveryTime: number;
    successRate: number;
    errorRate: number;
  };
  timestamp: string;
}