// Alert Notification Configuration Management API Handler
// Phase 2: 告警通知渠道配置和管理

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { AlertNotificationService, NotificationChannel as _NotificationChannel } from '../services/alert-notification-service';
import { AlertLevel } from '../monitoring/websocket-analytics-service';
import { handleApiError } from '../utils/api-response';

const alertConfigHandler = new Hono<{ Bindings: Bindings }>();

// =================== 通知渠道配置 API ===================

// 設置 Slack Webhook URL
alertConfigHandler.post('/channels/slack', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // 只有管理員可以配置通知渠道
    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can configure notification channels'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const { webhookUrl, testMessage = false } = await c.req.json();

    if (!webhookUrl) {
      return c.json({
        error: 'Missing webhook URL',
        message: 'Slack webhook URL is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證 Slack webhook URL 格式
    if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
      return c.json({
        error: 'Invalid Slack webhook URL',
        message: 'URL must be a valid Slack webhook URL'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 保存配置到 KV 存儲
    await c.env.CACHE?.put('slack_webhook_url', webhookUrl, {
      expirationTtl: 365 * 24 * 60 * 60 // 1 年
    });

    // 記錄配置變更
    const configRecord = {
      configuredBy: user.id,
      configuredAt: Date.now(),
      channel: 'slack',
      action: 'set_webhook_url'
    };
    await c.env.CACHE?.put(
      `alert_config_log:slack:${Date.now()}`,
      JSON.stringify(configRecord),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 天
    );

    let testResult = null;

    // 如果請求測試，發送測試消息
    if (testMessage) {
      try {
        const alertService = new AlertNotificationService(c.env);
        const testAlert = await alertService.sendAlert(
          AlertLevel.INFO,
          '🧪 Slack 配置測試',
          `Slack 通知渠道配置成功！配置者：${user.displayName}`,
          {
            configTest: true,
            configuredBy: user.id,
            timestamp: new Date().toISOString()
          }
        );

        testResult = {
          sent: true,
          alertId: testAlert.id,
          notificationStatus: testAlert.notificationsSent.find(n => n.channel === 'slack')
        };

      } catch (error) {
        testResult = {
          sent: false,
          error: error instanceof Error ? error.message : 'Test message failed'
        };
      }
    }

    return c.json({
      success: true,
      message: 'Slack webhook configured successfully',
      configuredBy: user.id,
      testResult,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 設置 Email 通知配置
alertConfigHandler.post('/channels/email', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required',
        message: 'Only administrators can configure notification channels'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const {
      smtpServer,
      smtpPort = 587,
      smtpUser,
      smtpPassword,
      fromEmail,
      fromName = 'WebSocket Monitor',
      recipients,
      testMessage = false
    } = await c.req.json();

    // 驗證必需字段
    const requiredFields = { smtpServer, smtpUser, smtpPassword, fromEmail, recipients };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return c.json({
          error: 'Missing required field',
          message: `${field} is required`
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證收件人格式
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return c.json({
        error: 'Invalid recipients',
        message: 'Recipients must be a non-empty array of email addresses'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證郵箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      return c.json({
        error: 'Invalid email format',
        message: 'fromEmail must be a valid email address'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        return c.json({
          error: 'Invalid recipient email',
          message: `Invalid email format: ${recipient}`
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 保存郵件配置
    const emailConfig = {
      smtpServer,
      smtpPort,
      smtpUser,
      smtpPassword, // 在實際環境中應該加密存儲
      fromEmail,
      fromName,
      recipients,
      configuredAt: Date.now(),
      configuredBy: user.id
    };

    await c.env.CACHE?.put(
      'email_notification_config',
      JSON.stringify(emailConfig),
      { expirationTtl: 365 * 24 * 60 * 60 } // 1 年
    );

    // 記錄配置變更
    const configRecord = {
      configuredBy: user.id,
      configuredAt: Date.now(),
      channel: 'email',
      action: 'set_email_config',
      recipientCount: recipients.length
    };
    await c.env.CACHE?.put(
      `alert_config_log:email:${Date.now()}`,
      JSON.stringify(configRecord),
      { expirationTtl: 30 * 24 * 60 * 60 }
    );

    let testResult = null;

    // 測試郵件發送（如果請求）
    if (testMessage) {
      try {
        const alertService = new AlertNotificationService(c.env);
        const testAlert = await alertService.sendAlert(
          AlertLevel.INFO,
          '📧 Email 配置測試',
          `Email 通知渠道配置成功！\n\n配置詳情:\n- SMTP 服務器: ${smtpServer}:${smtpPort}\n- 發送郵箱: ${fromEmail}\n- 收件人數量: ${recipients.length}\n\n配置者：${user.displayName}`,
          {
            configTest: true,
            configuredBy: user.id,
            timestamp: new Date().toISOString()
          }
        );

        testResult = {
          sent: true,
          alertId: testAlert.id,
          notificationStatus: testAlert.notificationsSent.find(n => n.channel === 'email')
        };

      } catch (error) {
        testResult = {
          sent: false,
          error: error instanceof Error ? error.message : 'Test email failed'
        };
      }
    }

    return c.json({
      success: true,
      message: 'Email notification configured successfully',
      configuration: {
        smtpServer,
        smtpPort,
        fromEmail,
        fromName,
        recipientCount: recipients.length
      },
      configuredBy: user.id,
      testResult,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 設置一般 Webhook 通知
alertConfigHandler.post('/channels/webhook', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const { webhookUrl, headers = {}, testMessage = false } = await c.req.json();

    if (!webhookUrl) {
      return c.json({
        error: 'Webhook URL is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證 URL 格式
    try {
      new URL(webhookUrl);
    } catch {
      return c.json({
        error: 'Invalid webhook URL format'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 保存 Webhook 配置
    await c.env.CACHE?.put('alert_webhook_url', webhookUrl, {
      expirationTtl: 365 * 24 * 60 * 60
    });

    // 保存自定義 headers（如果有）
    if (Object.keys(headers).length > 0) {
      await c.env.CACHE?.put(
        'alert_webhook_headers',
        JSON.stringify(headers),
        { expirationTtl: 365 * 24 * 60 * 60 }
      );
    }

    let testResult = null;

    if (testMessage) {
      try {
        const alertService = new AlertNotificationService(c.env);
        const testAlert = await alertService.sendAlert(
          AlertLevel.INFO,
          '🔗 Webhook 配置測試',
          `通用 Webhook 通知渠道配置成功！配置者：${user.displayName}`,
          { configTest: true, configuredBy: user.id }
        );

        testResult = {
          sent: true,
          alertId: testAlert.id,
          notificationStatus: testAlert.notificationsSent.find(n => n.channel === 'webhook')
        };
      } catch (error) {
        testResult = {
          sent: false,
          error: error instanceof Error ? error.message : 'Test webhook failed'
        };
      }
    }

    return c.json({
      success: true,
      message: 'Webhook configured successfully',
      webhookUrl,
      testResult,
      configuredBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// =================== 通知配置查詢 API ===================

// 獲取當前通知渠道配置狀態
alertConfigHandler.get('/channels/status', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // SECURITY: Admin-only access (2-tier role system)
    if (user.role !== 'admin') {
      return c.json({
        error: 'Insufficient permissions'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查各通知渠道配置狀態
    const [slackUrl, emailConfig, webhookUrl] = await Promise.all([
      c.env.CACHE?.get('slack_webhook_url'),
      c.env.CACHE?.get('email_notification_config'),
      c.env.CACHE?.get('alert_webhook_url')
    ]);

    const emailConfigParsed = emailConfig ? JSON.parse(emailConfig) : null;

    const channelStatus = {
      slack: {
        configured: !!slackUrl,
        configuredAt: null as string | null
      },
      email: {
        configured: !!emailConfigParsed,
        configuredAt: (emailConfigParsed?.configuredAt || null) as string | null,
        recipientCount: emailConfigParsed?.recipients?.length || 0
      },
      webhook: {
        configured: !!webhookUrl,
        configuredAt: null as string | null
      }
    };

    return c.json({
      success: true,
      channels: channelStatus,
      checkedBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// 獲取告警配置日誌
alertConfigHandler.get('/logs', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 獲取最近的配置日誌（簡化版實現）
    const logs = [
      // 實際實現中會從 KV 中查詢配置日誌
      {
        timestamp: Date.now(),
        message: '配置日誌功能已就緒，等待配置操作記錄',
        type: 'info'
      }
    ];

    return c.json({
      success: true,
      logs,
      count: logs.length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

// =================== 測試通知 API ===================

// 發送測試告警到所有配置的渠道
alertConfigHandler.post('/test-alert', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({
        error: 'Admin access required'
      }, HTTP_STATUS.FORBIDDEN);
    }

    const { level = 'warning', title, description } = await c.req.json();

    // 驗證告警級別
    const validLevels = Object.values(AlertLevel);
    if (!validLevels.includes(level as AlertLevel)) {
      return c.json({
        error: 'Invalid alert level',
        message: `Level must be one of: ${validLevels.join(', ')}`
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const alertService = new AlertNotificationService(c.env);

    const testAlert = await alertService.sendAlert(
      level as AlertLevel,
      title || `🧪 測試告警 - ${level.toUpperCase()}`,
      description || `這是一個 ${level} 級別的測試告警。\n\n發送者：${user.displayName}\n時間：${new Date().toISOString()}`,
      {
        testAlert: true,
        triggeredBy: user.id,
        testLevel: level
      }
    );

    return c.json({
      success: true,
      alert: {
        id: testAlert.id,
        level: testAlert.level,
        title: testAlert.title,
        timestamp: testAlert.timestamp
      },
      notificationResults: testAlert.notificationsSent,
      triggeredBy: user.id,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Operation failed:', error);
    return handleApiError(error, c);
  }
});

export default alertConfigHandler;