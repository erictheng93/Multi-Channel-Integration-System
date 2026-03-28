// src/modules/notifications/adapters/email-adapter.ts
// Email 通道適配器 (準備用於未來擴展)

import {
  ChannelAdapter,
  ChannelMessage,
  DeliveryResult,
  ChannelType,
  EmailTemplate,
  EmailConfig,
  ChannelConfig
} from '../types';
import { nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('EmailAdapter')


export class EmailAdapter implements ChannelAdapter {
  readonly type: ChannelType = 'email';
  private enabled = false; // 目前停用，等待 Email 服務設定
  private config: EmailConfig;
  private templates = new Map<string, EmailTemplate>();

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 5000,
      timeout: 30000,
      batchSize: 20,
      fromAddress: '',
      fromName: 'Multi-Channel Support System',
      useTemplate: true,
      ...config
    };

    this.loadDefaultTemplates();
  }

  isEnabled(): boolean {
    return this.enabled && !!this.config.fromAddress;
  }

  validateConfig(config: ChannelConfig): boolean {
    const emailConfig = config as EmailConfig;
    return (
      config.retryAttempts >= 0 &&
      config.retryDelay >= 0 &&
      config.timeout > 0 &&
      !!emailConfig.fromAddress &&
      !!emailConfig.fromName
    );
  }

  async send(message: ChannelMessage): Promise<DeliveryResult> {
    if (!this.isEnabled()) {
      return {
        success: false,
        errorMessage: 'Email adapter is not enabled or not configured',
        deliveryTime: 0
      };
    }

    const startTime = nowMs();

    try {
      // 在實際實作中，這裡會呼叫真正的 email 服務
      // 例如 SendGrid, AWS SES, 或其他 email provider

      const emailData = await this.prepareEmailData(message);

      // 模擬 email 發送（實際實作時替換為真正的服務調用）
      const result = await this.sendEmail(emailData);

      return {
        success: result.success,
        messageId: result.messageId,
        errorMessage: result.errorMessage,
        deliveryTime: Date.now() - startTime,
        metadata: {
          recipient: message.recipientId,
          subject: emailData.subject,
          template: emailData.templateId
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
        errorMessage: 'Email adapter is not enabled or not configured',
        deliveryTime: 0
      }));
    }

    const results: DeliveryResult[] = [];

    // Email 通常有速率限制，所以分小批處理
    const batchSize = Math.min(this.config.batchSize || 20, 20);
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => this.send(message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 較長的延遲以遵守 email 服務的速率限制
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  private async prepareEmailData(message: ChannelMessage): Promise<{
    to: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    templateId?: string;
  }> {
    const notification = message.notification;

    // 根據通知類型選擇範本
    const templateId = this.getTemplateId(notification.type);
    const template = this.templates.get(templateId);

    if (!template || !this.config.useTemplate) {
      // 使用預設格式
      return {
        to: message.recipientId, // 在實際實作中需要從用戶 ID 轉換為 email 地址
        subject: notification.title,
        htmlContent: this.generateDefaultHtml(notification),
        textContent: this.generateDefaultText(notification)
      };
    }

    // 使用範本
    const variables = {
      title: notification.title,
      content: notification.content,
      type: notification.type,
      priority: notification.priority,
      createdAt: new Date(notification.createdAt).toLocaleString(),
      data: notification.data || {}
    };

    return {
      to: message.recipientId,
      subject: this.replaceVariables(template.subject, variables),
      htmlContent: this.replaceVariables(template.htmlContent, variables),
      textContent: template.textContent ? this.replaceVariables(template.textContent, variables) : '',
      templateId: template.id
    };
  }

  private async sendEmail(_emailData: {
    to: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    templateId?: string;
  }): Promise<{ success: boolean; messageId?: string; errorMessage?: string }> {
    // 這裡是模擬實作，實際使用時需要整合真正的 email 服務

    try {
      // 模擬網路延遲
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      // 模擬成功率（實際實作中不需要）
      const success = Math.random() > 0.05; // 95% 成功率

      if (success) {
        return {
          success: true,
          messageId: `email_${nowMs()}_${Math.random().toString(36).substring(2)}`
        };
      } else {
        return {
          success: false,
          errorMessage: 'Simulated email delivery failure'
        };
      }

    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getTemplateId(notificationType: string): string {
    const templateMap: Record<string, string> = {
      new_message: 'new_message_template',
      conversation_assigned: 'assignment_template',
      conversation_transferred: 'transfer_template',
      mention: 'mention_template',
      system: 'system_template',
      priority_changed: 'priority_template',
      customer_responded: 'response_template',
      task_reminder: 'reminder_template'
    };

    return templateMap[notificationType] || 'default_template';
  }

  private loadDefaultTemplates(): void {
    // 新訊息範本
    this.templates.set('new_message_template', {
      id: 'new_message_template',
      name: 'New Message Notification',
      subject: '新訊息通知 - {{title}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">{{title}}</h2>
          <p>{{content}}</p>
          <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p><strong>優先級:</strong> {{priority}}</p>
            <p><strong>時間:</strong> {{createdAt}}</p>
          </div>
          <p style="color: #666; font-size: 12px;">
            這是一則自動發送的通知郵件，請勿直接回覆。
          </p>
        </div>
      `,
      textContent: '{{title}}\n\n{{content}}\n\n優先級: {{priority}}\n時間: {{createdAt}}',
      variables: ['title', 'content', 'priority', 'createdAt']
    });

    // 對話指派範本
    this.templates.set('assignment_template', {
      id: 'assignment_template',
      name: 'Conversation Assignment',
      subject: '對話指派通知 - {{title}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2196F3;">{{title}}</h2>
          <p>{{content}}</p>
          <div style="background: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2196F3;">
            <p><strong>優先級:</strong> {{priority}}</p>
            <p><strong>指派時間:</strong> {{createdAt}}</p>
          </div>
          <a href="#" style="display: inline-block; background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            查看對話
          </a>
        </div>
      `,
      variables: ['title', 'content', 'priority', 'createdAt']
    });

    // 系統通知範本
    this.templates.set('system_template', {
      id: 'system_template',
      name: 'System Notification',
      subject: '系統通知 - {{title}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF9800;">{{title}}</h2>
          <p>{{content}}</p>
          <div style="background: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #FF9800;">
            <p><strong>通知時間:</strong> {{createdAt}}</p>
          </div>
        </div>
      `,
      variables: ['title', 'content', 'createdAt']
    });

    // 預設範本
    this.templates.set('default_template', {
      id: 'default_template',
      name: 'Default Notification',
      subject: '通知 - {{title}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>{{title}}</h2>
          <p>{{content}}</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            發送時間: {{createdAt}}
          </p>
        </div>
      `,
      variables: ['title', 'content', 'createdAt']
    });
  }

  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }

    return result;
  }

  private generateDefaultHtml(notification: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${notification.title}</h2>
        <p>${notification.content}</p>
        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>類型:</strong> ${notification.type}</p>
          <p><strong>優先級:</strong> ${notification.priority}</p>
          <p><strong>時間:</strong> ${new Date(notification.createdAt).toLocaleString()}</p>
        </div>
      </div>
    `;
  }

  private generateDefaultText(notification: any): string {
    return `${notification.title}\n\n${notification.content}\n\n類型: ${notification.type}\n優先級: ${notification.priority}\n時間: ${new Date(notification.createdAt).toLocaleString()}`;
  }

  // 範本管理
  addTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
  }

  removeTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }

  getTemplate(templateId: string): EmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  // 設定 email 服務 (實際實作時使用)
  configure(config: Partial<EmailConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 啟用/停用適配器
  enable(): void {
    if (!this.config.fromAddress) {
      throw new Error('Email fromAddress is required to enable email adapter');
    }
    this.enabled = true;
    log.info('Email adapter enabled');
  }

  disable(): void {
    this.enabled = false;
    log.info('Email adapter disabled');
  }

  // 獲取適配器統計
  getStats(): {
    enabled: boolean;
    templatesCount: number;
    config: EmailConfig;
  } {
    return {
      enabled: this.isEnabled(),
      templatesCount: this.templates.size,
      config: { ...this.config }
    };
  }
}