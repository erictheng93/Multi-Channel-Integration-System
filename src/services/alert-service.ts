// Alert Service
// Multi-channel alert notification system for security events

import type { Bindings } from '@/types';
import { nowISO } from '@/utils/timestamp'

/**
 * Alert channel configuration types
 */
export type AlertChannelType = 'email' | 'slack' | 'webhook';

/**
 * Email alert configuration
 */
export interface EmailConfig {
  to: string[];
  from: string;
  subject?: string;
}

/**
 * Slack webhook configuration
 */
export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

/**
 * Generic webhook configuration
 */
export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
}

/**
 * Alert channel definition
 */
export interface AlertChannel {
  type: AlertChannelType;
  config: EmailConfig | SlackConfig | WebhookConfig;
  enabled: boolean;
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Alert metadata
 */
export interface AlertMetadata {
  platform?: string;
  integrationId?: string;
  sourceIP?: string;
  eventType?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Slack message formatting
 */
interface SlackMessage {
  text?: string;
  blocks?: unknown[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

/**
 * Alert Service
 * Sends security alerts through multiple channels (Email, Slack, Webhook)
 */
export class AlertService {
  private channels: AlertChannel[];
  private env: Bindings;

  constructor(channels: AlertChannel[], env: Bindings) {
    this.channels = channels;
    this.env = env;

    console.log(`[AlertService] Initialized with ${channels.length} channels (${channels.filter(c => c.enabled).length} enabled)`);
  }

  /**
   * Send alert through all enabled channels
   *
   * @param title - Alert title
   * @param message - Alert message body
   * @param severity - Alert severity level
   * @param metadata - Additional context data
   */
  async sendAlert(
    title: string,
    message: string,
    severity: AlertSeverity,
    metadata?: AlertMetadata
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Filter channels by enabled status and minimum severity
    const enabledChannels = this.channels.filter(channel => {
      if (!channel.enabled) return false;

      // Check minimum severity if configured
      if (channel.minSeverity) {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        if (severityOrder[severity] < severityOrder[channel.minSeverity]) {
          return false;
        }
      }

      return true;
    });

    console.log(`[AlertService] Sending "${severity}" alert to ${enabledChannels.length} channels: ${title}`);

    // Send alerts to all enabled channels in parallel
    const promises = enabledChannels.map(async channel => {
      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailAlert(channel.config as EmailConfig, title, message, severity, metadata);
            break;
          case 'slack':
            await this.sendSlackAlert(channel.config as SlackConfig, title, message, severity, metadata);
            break;
          case 'webhook':
            await this.sendWebhookAlert(channel.config as WebhookConfig, title, message, severity, metadata);
            break;
        }
        results.success++;
        console.log(`[AlertService] Successfully sent ${channel.type} alert`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to send ${channel.type} alert: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(`[AlertService] ${errorMsg}`);
      }
    });

    await Promise.allSettled(promises);

    return results;
  }

  /**
   * Send email alert
   * Note: Requires email service configuration in environment
   */
  private async sendEmailAlert(
    config: EmailConfig,
    title: string,
    message: string,
    severity: AlertSeverity,
    metadata?: AlertMetadata
  ): Promise<void> {
    // Check if email service is configured
    if (!this.env.EMAIL_API_KEY || !this.env.EMAIL_API_ENDPOINT) {
      throw new Error('Email service not configured (EMAIL_API_KEY or EMAIL_API_ENDPOINT missing)');
    }

    const severityEmoji = {
      low: '',
      medium: '',
      high: '',
      critical: ''
    };

    const emailBody = `
${severityEmoji[severity]} Security Alert: ${title}

Severity: ${severity.toUpperCase()}

${message}

${metadata ? `
Details:
- Platform: ${metadata.platform || 'N/A'}
- Event Type: ${metadata.eventType || 'N/A'}
- Source IP: ${metadata.sourceIP || 'N/A'}
- Integration ID: ${metadata.integrationId || 'N/A'}
- Timestamp: ${metadata.timestamp || nowISO()}
` : ''}

---
This is an automated security alert from Multi-Channel Customer Support System.
    `.trim();

    // Send email via configured email API
    const response = await fetch(this.env.EMAIL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: config.from,
        to: config.to,
        subject: config.subject || `[${severity.toUpperCase()}] ${title}`,
        text: emailBody
      })
    });

    if (!response.ok) {
      throw new Error(`Email API returned ${response.status}: ${await response.text()}`);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    config: SlackConfig,
    title: string,
    message: string,
    severity: AlertSeverity,
    metadata?: AlertMetadata
  ): Promise<void> {
    const severityEmoji = {
      low: ':information_source:',
      medium: ':warning:',
      high: ':rotating_light:',
      critical: ':fire:'
    };

    const slackMessage: SlackMessage = {
      text: `${severityEmoji[severity]} *${title}*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${severityEmoji[severity]} ${title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${severity.toUpperCase()}`
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${metadata?.timestamp || nowISO()}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    };

    // Add metadata fields if available
    if (metadata) {
      const fields: unknown[] = [];
      if (metadata.platform) fields.push({ type: 'mrkdwn', text: `*Platform:*\n${metadata.platform}` });
      if (metadata.eventType) fields.push({ type: 'mrkdwn', text: `*Event:*\n${metadata.eventType}` });
      if (metadata.sourceIP) fields.push({ type: 'mrkdwn', text: `*Source IP:*\n${metadata.sourceIP}` });
      if (metadata.integrationId) fields.push({ type: 'mrkdwn', text: `*Integration:*\n${metadata.integrationId}` });

      if (fields.length > 0) {
        slackMessage.blocks!.push({
          type: 'section',
          fields
        });
      }
    }

    // Add color bar (divider with color)
    slackMessage.blocks!.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: ` Security Alert • Multi-Channel Support System`
        }
      ]
    });

    // Optional configuration
    if (config.channel) slackMessage.channel = config.channel;
    if (config.username) slackMessage.username = config.username;
    if (config.iconEmoji) slackMessage.icon_emoji = config.iconEmoji;

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}: ${await response.text()}`);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    config: WebhookConfig,
    title: string,
    message: string,
    severity: AlertSeverity,
    metadata?: AlertMetadata
  ): Promise<void> {
    const payload = {
      title,
      message,
      severity,
      metadata: metadata || {},
      timestamp: nowISO()
    };

    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
    }
  }

  /**
   * Get active channels count
   */
  getActiveChannelsCount(): number {
    return this.channels.filter(c => c.enabled).length;
  }

  /**
   * Get channels by type
   */
  getChannelsByType(type: AlertChannelType): AlertChannel[] {
    return this.channels.filter(c => c.type === type && c.enabled);
  }
}

/**
 * Default alert channels configuration
 * Can be overridden via environment variables or database
 */
export function getDefaultAlertChannels(env: Bindings): AlertChannel[] {
  const channels: AlertChannel[] = [];

  // Email channel (if configured)
  if (env.ALERT_EMAIL_ENABLED === 'true' && env.ALERT_EMAIL_TO) {
    channels.push({
      type: 'email',
      enabled: true,
      minSeverity: 'high', // Only send high/critical alerts via email
      config: {
        from: env.ALERT_EMAIL_FROM || 'alerts@example.com',
        to: env.ALERT_EMAIL_TO.split(','),
        subject: env.ALERT_EMAIL_SUBJECT || 'Security Alert'
      }
    });
  }

  // Slack channel (if configured)
  if (env.ALERT_SLACK_ENABLED === 'true' && env.ALERT_SLACK_WEBHOOK_URL) {
    channels.push({
      type: 'slack',
      enabled: true,
      minSeverity: 'medium', // Send medium+ alerts to Slack
      config: {
        webhookUrl: env.ALERT_SLACK_WEBHOOK_URL,
        channel: env.ALERT_SLACK_CHANNEL,
        username: env.ALERT_SLACK_USERNAME || 'Security Bot',
        iconEmoji: ':shield:'
      }
    });
  }

  // Webhook channel (if configured)
  if (env.ALERT_WEBHOOK_ENABLED === 'true' && env.ALERT_WEBHOOK_URL) {
    channels.push({
      type: 'webhook',
      enabled: true,
      minSeverity: 'low', // Send all alerts to webhook
      config: {
        url: env.ALERT_WEBHOOK_URL,
        headers: env.ALERT_WEBHOOK_HEADERS ? JSON.parse(env.ALERT_WEBHOOK_HEADERS) : undefined,
        method: (env.ALERT_WEBHOOK_METHOD as 'POST' | 'PUT') || 'POST'
      }
    });
  }

  return channels;
}
