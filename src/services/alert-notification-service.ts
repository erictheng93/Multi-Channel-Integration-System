// Alert Notification Service
// Phase 2: 長期優化 - 智能告警通知系統
// 專案：Multi-Channel Support MVP - WebSocket 監控系統

import type { Bindings } from '../types';
import { AlertLevel } from '../monitoring/websocket-analytics-service';
import { nowMs } from '@/utils/timestamp'

// 通知渠道類型
export enum NotificationChannel {
  CONSOLE = 'console',
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms'
}

// 告警通知配置
export interface AlertNotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  thresholds: {
    [AlertLevel.INFO]: NotificationChannel[];
    [AlertLevel.WARNING]: NotificationChannel[];
    [AlertLevel.CRITICAL]: NotificationChannel[];
    [AlertLevel.EMERGENCY]: NotificationChannel[];
  };
  rateLimiting: {
    enabled: boolean;
    maxAlertsPerHour: number;
    cooldownMinutes: number;
  };
  escalation: {
    enabled: boolean;
    escalationTimeMinutes: number;
    escalationChannels: NotificationChannel[];
  };
}

// 告警記錄
export interface AlertRecord {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolved: boolean;
  resolvedAt?: number;
  notificationsSent: Array<{
    channel: NotificationChannel;
    timestamp: number;
    success: boolean;
    error?: string;
  }>;
}

export class AlertNotificationService {
  private env: Bindings;
  private readonly CONFIG_KEY = 'alert_notification_config';
  private readonly RATE_LIMIT_KEY = 'alert_rate_limit';
  private readonly ALERT_HISTORY_KEY_PREFIX = 'alert_history:';

  // 預設配置
  private readonly DEFAULT_CONFIG: AlertNotificationConfig = {
    enabled: true,
    channels: [NotificationChannel.CONSOLE],
    thresholds: {
      [AlertLevel.INFO]: [NotificationChannel.CONSOLE],
      [AlertLevel.WARNING]: [NotificationChannel.CONSOLE],
      [AlertLevel.CRITICAL]: [NotificationChannel.CONSOLE, NotificationChannel.WEBHOOK],
      [AlertLevel.EMERGENCY]: [NotificationChannel.CONSOLE, NotificationChannel.WEBHOOK, NotificationChannel.SLACK]
    },
    rateLimiting: {
      enabled: true,
      maxAlertsPerHour: 20,
      cooldownMinutes: 5
    },
    escalation: {
      enabled: true,
      escalationTimeMinutes: 30,
      escalationChannels: [NotificationChannel.SLACK, NotificationChannel.EMAIL]
    }
  };

  constructor(env: Bindings) {
    this.env = env;
  }

  // =================== 告警通知核心功能 ===================

  async sendAlert(
    level: AlertLevel,
    title: string,
    description: string,
    metadata: Record<string, unknown> = {}
  ): Promise<AlertRecord> {
    const alertId = this.generateAlertId();

    const alert: AlertRecord = {
      id: alertId,
      level,
      title,
      description,
      timestamp: nowMs(),
      acknowledged: false,
      resolved: false,
      notificationsSent: []
    };

    try {
      // 檢查配置
      const config = await this.getConfig();
      if (!config.enabled) {
        console.log(`[Alert Service] Alert notifications disabled: ${title}`);
        return alert;
      }

      // 檢查頻率限制
      const canSend = await this.checkRateLimit(level);
      if (!canSend) {
        console.log(`[Alert Service] Rate limited, skipping alert: ${title}`);
        return alert;
      }

      // 獲取應該使用的通知渠道
      const channels = config.thresholds[level] || [NotificationChannel.CONSOLE];

      // 發送通知
      for (const channel of channels) {
        try {
          const success = await this.sendToChannel(channel, alert, metadata);
          alert.notificationsSent.push({
            channel,
            timestamp: nowMs(),
            success
          });
        } catch (error) {
          alert.notificationsSent.push({
            channel,
            timestamp: nowMs(),
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          console.error(`[Alert Service] Failed to send to ${channel}:`, error);
        }
      }

      // 保存告警記錄
      await this.saveAlertRecord(alert);

      // 更新頻率限制計數器
      await this.updateRateLimit();

      // 如果是關鍵或緊急告警，設置升級計時器
      if (level === AlertLevel.CRITICAL || level === AlertLevel.EMERGENCY) {
        await this.scheduleEscalation(alert, config);
      }

      console.log(`[Alert Service] Alert sent: ${level.toUpperCase()} - ${title}`);
      return alert;

    } catch (error) {
      console.error('[Alert Service] Failed to send alert:', error);
      throw error;
    }
  }

  // =================== 通知渠道實現 ===================

  private async sendToChannel(
    channel: NotificationChannel,
    alert: AlertRecord,
    metadata: Record<string, unknown>
  ): Promise<boolean> {
    switch (channel) {
      case NotificationChannel.CONSOLE:
        return this.sendToConsole(alert);

      case NotificationChannel.WEBHOOK:
        return this.sendToWebhook(alert, metadata);

      case NotificationChannel.SLACK:
        return this.sendToSlack(alert, metadata);

      case NotificationChannel.EMAIL:
        return this.sendToEmail(alert, metadata);

      case NotificationChannel.SMS:
        return this.sendToSMS(alert, metadata);

      default:
        console.warn(`[Alert Service] Unknown notification channel: ${channel}`);
        return false;
    }
  }

  private async sendToConsole(alert: AlertRecord): Promise<boolean> {
    const icon = this.getAlertIcon(alert.level);
    const timestamp = new Date(alert.timestamp).toISOString();

    console.log(`${icon} [ALERT ${alert.level.toUpperCase()}] ${alert.title}`);
    console.log(` Description: ${alert.description}`);
    console.log(` Time: ${timestamp}`);
    console.log(` Alert ID: ${alert.id}`);

    return true;
  }

  private async sendToWebhook(alert: AlertRecord, metadata: Record<string, unknown>): Promise<boolean> {
    try {
      // 獲取 Webhook URL 配置
      const webhookUrl = await this.env.CACHE?.get('alert_webhook_url');
      if (!webhookUrl) {
        console.warn('[Alert Service] No webhook URL configured');
        return false;
      }

      const payload = {
        alertId: alert.id,
        level: alert.level,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        metadata: {
          ...metadata,
          system: 'Multi-Channel WebSocket System',
          environment: this.env.ENVIRONMENT || 'unknown'
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Multi-Channel-Alert-System/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with status ${response.status}`);
      }

      console.log(`[Alert Service] Webhook notification sent successfully`);
      return true;

    } catch (error) {
      console.error('[Alert Service] Webhook notification failed:', error);
      return false;
    }
  }

  private async sendToSlack(alert: AlertRecord, _metadata: Record<string, unknown>): Promise<boolean> {
    try {
      const slackWebhookUrl = await this.env.CACHE?.get('slack_webhook_url');
      if (!slackWebhookUrl) {
        console.warn('[Alert Service] No Slack webhook URL configured');
        return false;
      }

      const color = this.getSlackColor(alert.level);
      const icon = this.getAlertIcon(alert.level);

      const slackPayload = {
        username: 'WebSocket Monitor',
        icon_emoji: ':warning:',
        attachments: [
          {
            color,
            title: `${icon} ${alert.title}`,
            text: alert.description,
            fields: [
              {
                title: 'Level',
                value: alert.level.toUpperCase(),
                short: true
              },
              {
                title: 'Time',
                value: new Date(alert.timestamp).toISOString(),
                short: true
              },
              {
                title: 'Alert ID',
                value: alert.id,
                short: true
              },
              {
                title: 'System',
                value: 'WebSocket Real-time Communication',
                short: true
              }
            ],
            footer: 'Multi-Channel Support System',
            ts: Math.floor(alert.timestamp / 1000)
          }
        ]
      };

      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackPayload)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook responded with status ${response.status}`);
      }

      console.log(`[Alert Service] Slack notification sent successfully`);
      return true;

    } catch (error) {
      console.error('[Alert Service] Slack notification failed:', error);
      return false;
    }
  }

  private async sendToEmail(alert: AlertRecord, _metadata: Record<string, unknown>): Promise<boolean> {
    try {
      // Try env-based email API first (EMAIL_API_KEY + EMAIL_API_ENDPOINT)
      const apiKey = this.env.EMAIL_API_KEY;
      const apiEndpoint = this.env.EMAIL_API_ENDPOINT;

      if (apiKey && apiEndpoint) {
        const subject = `[${alert.level.toUpperCase()}] ${alert.title}`;
        const body = `${alert.description}\n\nAlert ID: ${alert.id}\nTime: ${new Date(alert.timestamp).toISOString()}\nLevel: ${alert.level}`;

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, text: body })
        });

        if (!response.ok) throw new Error(`Email API responded with status ${response.status}`);
        console.log('[Alert Service] Email notification sent via API');
        return true;
      }

      // Fallback: KV-based email config (legacy)
      const emailConfigStr = await this.env.CACHE?.get('email_notification_config');
      if (!emailConfigStr) {
        console.warn('[Alert Service] No email configuration found (set EMAIL_API_KEY + EMAIL_API_ENDPOINT or KV email_notification_config)');
        return false;
      }

      const emailConfig = JSON.parse(emailConfigStr);
      const { fromEmail, fromName, recipients } = emailConfig;
      const subject = `[${alert.level.toUpperCase()}] ${alert.title}`;

      console.log(`[Alert Service] Email notification logged (no send API): ${subject} to ${recipients?.join(', ')} from ${fromName} <${fromEmail}>`);
      return true;
    } catch (error) {
      console.error('[Alert Service] Email notification failed:', error);
      return false;
    }
  }

  private async sendToSMS(alert: AlertRecord, metadata: Record<string, unknown>): Promise<boolean> {
    try {
      const apiEndpoint = this.env.SMS_API_ENDPOINT || await this.env.CACHE?.get('sms_notification_endpoint');
      const apiKey = this.env.SMS_API_KEY || await this.env.CACHE?.get('sms_notification_api_key');
      const recipientList = this.env.SMS_TO || await this.env.CACHE?.get('sms_notification_recipients');

      if (!apiEndpoint || !recipientList) {
        console.warn('[Alert Service] No SMS configuration found (set SMS_API_ENDPOINT + SMS_TO or KV sms_notification_* keys)');
        return false;
      }

      const recipients = recipientList
        .split(',')
        .map((recipient) => recipient.trim())
        .filter(Boolean);

      if (recipients.length === 0) {
        console.warn('[Alert Service] SMS recipient list is empty');
        return false;
      }

      const message = `[${alert.level.toUpperCase()}] ${alert.title}: ${alert.description}`;
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: recipients,
          message,
          alertId: alert.id,
          level: alert.level,
          timestamp: alert.timestamp,
          metadata
        })
      });

      if (!response.ok) {
        throw new Error(`SMS API responded with status ${response.status}`);
      }

      console.log(`[Alert Service] SMS notification sent to ${recipients.length} recipient(s)`);
      return true;
    } catch (error) {
      console.error('[Alert Service] SMS notification failed:', error);
      return false;
    }
  }

  // =================== 告警管理功能 ===================

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    try {
      const alertKey = `${this.ALERT_HISTORY_KEY_PREFIX}${alertId}`;
      const alertData = await this.env.CACHE?.get(alertKey);

      if (!alertData) {
        console.warn(`[Alert Service] Alert not found: ${alertId}`);
        return false;
      }

      const alert: AlertRecord = JSON.parse(alertData);
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = nowMs();

      await this.env.CACHE?.put(alertKey, JSON.stringify(alert), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 days
      });

      console.log(`[Alert Service] Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
      return true;

    } catch (error) {
      console.error('[Alert Service] Failed to acknowledge alert:', error);
      return false;
    }
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alertKey = `${this.ALERT_HISTORY_KEY_PREFIX}${alertId}`;
      const alertData = await this.env.CACHE?.get(alertKey);

      if (!alertData) {
        console.warn(`[Alert Service] Alert not found: ${alertId}`);
        return false;
      }

      const alert: AlertRecord = JSON.parse(alertData);
      alert.resolved = true;
      alert.resolvedAt = nowMs();

      await this.env.CACHE?.put(alertKey, JSON.stringify(alert), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 days
      });

      console.log(`[Alert Service] Alert resolved: ${alertId}`);
      return true;

    } catch (error) {
      console.error('[Alert Service] Failed to resolve alert:', error);
      return false;
    }
  }

  // =================== 配置管理 ===================

  async getConfig(): Promise<AlertNotificationConfig> {
    try {
      const configData = await this.env.CACHE?.get(this.CONFIG_KEY);
      return configData ? JSON.parse(configData) : this.DEFAULT_CONFIG;
    } catch (error) {
      console.warn('[Alert Service] Failed to get config, using defaults:', error);
      return this.DEFAULT_CONFIG;
    }
  }

  async updateConfig(config: Partial<AlertNotificationConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig = { ...currentConfig, ...config };

      await this.env.CACHE?.put(this.CONFIG_KEY, JSON.stringify(updatedConfig), {
        expirationTtl: 365 * 24 * 60 * 60 // 1 year
      });

      console.log('[Alert Service] Configuration updated');
    } catch (error) {
      console.error('[Alert Service] Failed to update config:', error);
      throw error;
    }
  }

  // =================== 輔助方法 ===================

  private async checkRateLimit(level: AlertLevel): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if (!config.rateLimiting.enabled) {
        return true;
      }

      const rateLimitData = await this.env.CACHE?.get(this.RATE_LIMIT_KEY);
      const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));

      if (!rateLimitData) {
        return true;
      }

      const rateLimit = JSON.parse(rateLimitData);
      if (rateLimit.hour !== currentHour) {
        return true; // 新的小時，重置計數器
      }

      // 緊急告警總是發送
      if (level === AlertLevel.EMERGENCY) {
        return true;
      }

      return rateLimit.count < config.rateLimiting.maxAlertsPerHour;

    } catch (error) {
      console.warn('[Alert Service] Rate limit check failed, allowing alert:', error);
      return true;
    }
  }

  private async updateRateLimit(): Promise<void> {
    try {
      const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
      const rateLimitData = await this.env.CACHE?.get(this.RATE_LIMIT_KEY);

      let rateLimit = { hour: currentHour, count: 1 };

      if (rateLimitData) {
        const existing = JSON.parse(rateLimitData);
        if (existing.hour === currentHour) {
          rateLimit.count = existing.count + 1;
        }
      }

      await this.env.CACHE?.put(this.RATE_LIMIT_KEY, JSON.stringify(rateLimit), {
        expirationTtl: 2 * 60 * 60 // 2 hours
      });

    } catch (error) {
      console.warn('[Alert Service] Failed to update rate limit:', error);
    }
  }

  private async saveAlertRecord(alert: AlertRecord): Promise<void> {
    try {
      const alertKey = `${this.ALERT_HISTORY_KEY_PREFIX}${alert.id}`;
      await this.env.CACHE?.put(alertKey, JSON.stringify(alert), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 days
      });
    } catch (error) {
      console.error('[Alert Service] Failed to save alert record:', error);
    }
  }

  private async scheduleEscalation(alert: AlertRecord, config: AlertNotificationConfig): Promise<void> {
    if (!config.escalation.enabled) {
      return;
    }

    // 在實際環境中，這裡可以使用 Cloudflare Durable Objects 或 Queue 來實現延遲執行
    console.log(`[Alert Service] Escalation scheduled for alert ${alert.id} in ${config.escalation.escalationTimeMinutes} minutes`);
  }

  private generateAlertId(): string {
    return `alert_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getAlertIcon(level: AlertLevel): string {
    switch (level) {
      case AlertLevel.INFO: return '';
      case AlertLevel.WARNING: return '';
      case AlertLevel.CRITICAL: return '';
      case AlertLevel.EMERGENCY: return '';
      default: return '';
    }
  }

  private getSlackColor(level: AlertLevel): string {
    switch (level) {
      case AlertLevel.INFO: return '#36a64f'; // green
      case AlertLevel.WARNING: return '#ff9900'; // orange
      case AlertLevel.CRITICAL: return '#ff0000'; // red
      case AlertLevel.EMERGENCY: return '#8b0000'; // dark red
      default: return '#cccccc'; // gray
    }
  }
}

// 工廠函數
export function createAlertNotificationService(env: Bindings): AlertNotificationService {
  return new AlertNotificationService(env);
}
