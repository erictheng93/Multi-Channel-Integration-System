// Report Scheduler Service - 報表排程服務
// 提供定時報表生成、郵件訂閱和分發管理功能

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '../../../types';
import { ReportsService } from '@modules/analytics/services/reports-service';
import { ReportFormat, ChannelType } from '@modules/analytics/types/reports-types';
import type {
  ReportConfig,
  ReportSchedule,
  ReportDistribution,
  ReportBatch,
  DistributionChannel,
  ReportRecipient
} from '../types/reports-types';
import { ScheduleFrequency } from '@modules/analytics/types/reports-types';
import { AnalyticsError } from '@modules/analytics/types/analytics-types';

/**
 * 排程任務
 */
interface ScheduledTask {
  id: string;
  reportId: string;
  schedule: ReportSchedule;
  distribution?: ReportDistribution;
  status: TaskStatus;
  nextRun: string;
  lastRun?: string;
  lastResult?: TaskResult;
  createdAt: string;
  updatedAt: string;
}

/**
 * 任務狀態
 */
enum TaskStatus {
  Active = 'active',
  Paused = 'paused',
  Running = 'running',
  Failed = 'failed',
  Completed = 'completed'
}

/**
 * 任務結果
 */
interface TaskResult {
  status: 'success' | 'failed' | 'partial';
  generationId?: string;
  distributionResults?: DistributionResult[];
  error?: string;
  executedAt: string;
  duration: number;
}

/**
 * 分發結果
 */
interface DistributionResult {
  channel: ChannelType;
  recipient: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * 排程器配置
 */
interface SchedulerOptions {
  enableScheduling?: boolean;
  checkInterval?: number; // 檢查間隔(毫秒)
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  retryDelay?: number; // 重試延遲(毫秒)
  emailConfig?: EmailConfig;
  webhookConfig?: WebhookConfig;
}

/**
 * 郵件配置
 */
interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

/**
 * Webhook 配置
 */
interface WebhookConfig {
  timeout: number;
  retryCount: number;
  headers: Record<string, string>;
}

/**
 * 郵件數據
 */
interface EmailData {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

/**
 * 郵件附件
 */
interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType: string;
}

/**
 * Slack 消息
 */
interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: any[];
}

/**
 * Slack 區塊
 */
interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

const DEFAULT_OPTIONS: SchedulerOptions = {
  enableScheduling: true,
  checkInterval: 60000, // 1分鐘
  maxConcurrentTasks: 10,
  retryAttempts: 3,
  retryDelay: 5000 // 5秒
};

/**
 * 報表排程服務類
 */
export class ReportSchedulerService {
  private reportsService: ReportsService;
  private options: SchedulerOptions;
  private runningTasks = new Map<string, Promise<TaskResult>>();
  private schedulerTimer: NodeJS.Timeout | null = null;

  constructor(
    private db: D1Database,
    private kv: Bindings['KV'],
    options: SchedulerOptions = {}
  ) {
    this.reportsService = new ReportsService(db, kv);
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (this.options.enableScheduling) {
      this.startScheduler();
    }
  }

  /**
   * 創建排程任務
   */
  async createScheduledTask(
    reportId: string,
    schedule: ReportSchedule,
    distribution?: ReportDistribution
  ): Promise<ScheduledTask> {
    try {
      const taskId = this.generateTaskId();
      const now = new Date().toISOString();

      // 計算下次執行時間
      const nextRun = this.calculateNextRun(schedule);

      const task: ScheduledTask = {
        id: taskId,
        reportId,
        schedule,
        distribution,
        status: schedule.enabled ? TaskStatus.Active : TaskStatus.Paused,
        nextRun,
        createdAt: now,
        updatedAt: now
      };

      // 保存到 KV 存儲
      const taskKey = `scheduled_task:${taskId}`;
      await this.kv.put(taskKey, JSON.stringify(task), {
        metadata: {
          type: 'scheduled_task',
          reportId,
          status: task.status,
          nextRun
        }
      });

      return task;

    } catch (error) {
      throw new AnalyticsError('Failed to create scheduled task', 'SCHEDULE_CREATE_ERROR', 500, error);
    }
  }

  /**
   * 獲取排程任務
   */
  async getScheduledTask(taskId: string): Promise<ScheduledTask | null> {
    try {
      const taskKey = `scheduled_task:${taskId}`;
      const taskData = await this.kv.get(taskKey, { type: 'json' });

      return taskData as ScheduledTask || null;

    } catch (error) {
      throw new AnalyticsError('Failed to get scheduled task', 'SCHEDULE_GET_ERROR', 500, error);
    }
  }

  /**
   * 更新排程任務
   */
  async updateScheduledTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    try {
      const existingTask = await this.getScheduledTask(taskId);
      if (!existingTask) {
        throw new AnalyticsError(`Scheduled task not found: ${taskId}`, 'SCHEDULE_NOT_FOUND');
      }

      const updatedTask: ScheduledTask = {
        ...existingTask,
        ...updates,
        id: taskId, // 確保 ID 不被更改
        updatedAt: new Date().toISOString()
      };

      // 如果排程配置更新，重新計算下次執行時間
      if (updates.schedule) {
        updatedTask.nextRun = this.calculateNextRun(updatedTask.schedule);
      }

      const taskKey = `scheduled_task:${taskId}`;
      await this.kv.put(taskKey, JSON.stringify(updatedTask), {
        metadata: {
          type: 'scheduled_task',
          reportId: updatedTask.reportId,
          status: updatedTask.status,
          nextRun: updatedTask.nextRun
        }
      });

      return updatedTask;

    } catch (error) {
      throw new AnalyticsError('Failed to update scheduled task', 'SCHEDULE_UPDATE_ERROR', 500, error);
    }
  }

  /**
   * 刪除排程任務
   */
  async deleteScheduledTask(taskId: string): Promise<void> {
    try {
      const taskKey = `scheduled_task:${taskId}`;
      await this.kv.delete(taskKey);

    } catch (error) {
      throw new AnalyticsError('Failed to delete scheduled task', 'SCHEDULE_DELETE_ERROR', 500, error);
    }
  }

  /**
   * 獲取所有排程任務
   */
  async getAllScheduledTasks(): Promise<ScheduledTask[]> {
    try {
      const listResult = await this.kv.list({ prefix: 'scheduled_task:' });
      const tasks: ScheduledTask[] = [];

      for (const key of listResult.keys) {
        const task = await this.kv.get(key.name, { type: 'json' }) as ScheduledTask;
        if (task) {
          tasks.push(task);
        }
      }

      return tasks.sort((a, b) => a.nextRun.localeCompare(b.nextRun));

    } catch (error) {
      throw new AnalyticsError('Failed to get scheduled tasks', 'SCHEDULE_LIST_ERROR', 500, error);
    }
  }

  /**
   * 手動執行排程任務
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    try {
      const task = await this.getScheduledTask(taskId);
      if (!task) {
        throw new AnalyticsError(`Scheduled task not found: ${taskId}`, 'SCHEDULE_NOT_FOUND');
      }

      // 檢查是否已在執行中
      if (this.runningTasks.has(taskId)) {
        throw new AnalyticsError('Task is already running', 'TASK_ALREADY_RUNNING');
      }

      // 開始執行
      const executionPromise = this.executeTaskInternal(task);
      this.runningTasks.set(taskId, executionPromise);

      try {
        const result = await executionPromise;

        // 更新任務狀態
        await this.updateTaskAfterExecution(task, result);

        return result;

      } finally {
        this.runningTasks.delete(taskId);
      }

    } catch (error) {
      throw new AnalyticsError('Failed to execute task', 'TASK_EXECUTION_ERROR', 500, error);
    }
  }

  /**
   * 暫停排程任務
   */
  async pauseTask(taskId: string): Promise<void> {
    await this.updateScheduledTask(taskId, { status: TaskStatus.Paused });
  }

  /**
   * 恢復排程任務
   */
  async resumeTask(taskId: string): Promise<void> {
    const task = await this.getScheduledTask(taskId);
    if (task) {
      const nextRun = this.calculateNextRun(task.schedule);
      await this.updateScheduledTask(taskId, {
        status: TaskStatus.Active,
        nextRun
      });
    }
  }

  /**
   * 創建郵件訂閱
   */
  async createEmailSubscription(
    reportId: string,
    recipients: ReportRecipient[],
    schedule: ReportSchedule,
    format: ReportFormat = ReportFormat.PDF
  ): Promise<ScheduledTask> {
    const emailDistribution: ReportDistribution = {
      enabled: true,
      channels: [
        {
          type: ChannelType.Email,
          config: {
            format,
            subject: `Scheduled Report: {reportName}`,
            body: `Please find the scheduled report attached.`
          },
          enabled: true
        }
      ],
      recipients
    };

    return await this.createScheduledTask(reportId, schedule, emailDistribution);
  }

  /**
   * 分發報表
   */
  async distributeReport(
    generationId: string,
    distribution: ReportDistribution
  ): Promise<DistributionResult[]> {
    try {
      const results: DistributionResult[] = [];

      for (const channel of distribution.channels) {
        if (!channel.enabled) continue;

        for (const recipient of distribution.recipients) {
          try {
            await this.distributeToChannel(generationId, channel, recipient);
            results.push({
              channel: channel.type,
              recipient: recipient.identifier,
              status: 'success'
            });
          } catch (error) {
            results.push({
              channel: channel.type,
              recipient: recipient.identifier,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

      return results;

    } catch (error) {
      throw new AnalyticsError('Failed to distribute report', 'REPORT_DISTRIBUTION_ERROR', 500, error);
    }
  }

  /**
   * 啟動排程器
   */
  private startScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
    }

    this.schedulerTimer = setInterval(async () => {
      try {
        await this.checkAndExecuteTasks();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, this.options.checkInterval);

    console.log(`Report scheduler started with ${this.options.checkInterval}ms interval`, 'scheduler:start');
  }

  /**
   * 停止排程器
   */
  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * 檢查並執行到期的任務
   */
  private async checkAndExecuteTasks(): Promise<void> {
    try {
      const tasks = await this.getAllScheduledTasks();
      const now = new Date();

      for (const task of tasks) {
        if (task.status !== TaskStatus.Active) continue;
        if (this.runningTasks.has(task.id)) continue;
        if (this.runningTasks.size >= this.options.maxConcurrentTasks!) continue;

        const nextRunTime = new Date(task.nextRun);
        if (nextRunTime <= now) {
          // 異步執行任務
          this.executeTask(task.id).catch(error => {
            console.error(`Failed to execute scheduled task ${task.id}:`, error);
          });
        }
      }

    } catch (error) {
      console.error('Failed to check and execute tasks:', error);
    }
  }

  /**
   * 內部執行任務邏輯
   */
  private async executeTaskInternal(task: ScheduledTask): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // 更新任務狀態為執行中
      await this.updateScheduledTask(task.id, { status: TaskStatus.Running });

      // 生成報表
      const generationResult = await this.reportsService.generateReport(
        task.reportId,
        ReportFormat.PDF // 默認使用 PDF，可以從分發配置中獲取
      );

      // 等待生成完成
      let generation = generationResult;
      while (generation.status === 'pending' || generation.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒
        generation = await this.reportsService.getGenerationStatus(generation.id) || generation;
      }

      if (generation.status !== 'completed') {
        throw new Error(`Report generation failed: ${generation.error}`);
      }

      // 分發報表
      let distributionResults: DistributionResult[] = [];
      if (task.distribution?.enabled) {
        distributionResults = await this.distributeReport(generation.id, task.distribution);
      }

      const result: TaskResult = {
        status: 'success',
        generationId: generation.id,
        distributionResults,
        executedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };

      return result;

    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 執行後更新任務
   */
  private async updateTaskAfterExecution(task: ScheduledTask, result: TaskResult): Promise<void> {
    try {
      // 計算下次執行時間
      const nextRun = this.calculateNextRun(task.schedule);

      const updates: Partial<ScheduledTask> = {
        status: result.status === 'success' ? TaskStatus.Active : TaskStatus.Failed,
        nextRun,
        lastRun: result.executedAt,
        lastResult: result
      };

      await this.updateScheduledTask(task.id, updates);

    } catch (error) {
      console.error('Failed to update task after execution:', error);
    }
  }

  /**
   * 分發到特定通道
   */
  private async distributeToChannel(
    generationId: string,
    channel: DistributionChannel,
    recipient: ReportRecipient
  ): Promise<void> {
    switch (channel.type) {
      case ChannelType.Email:
        await this.distributeViaEmail(generationId, channel, recipient);
        break;
      case ChannelType.WebHook:
        await this.distributeViaWebhook(generationId, channel, recipient);
        break;
      case ChannelType.Slack:
        await this.distributeViaSlack(generationId, channel, recipient);
        break;
      default:
        throw new Error(`Unsupported distribution channel: ${channel.type}`);
    }
  }

  /**
   * 通過郵件分發
   */
  private async distributeViaEmail(
    generationId: string,
    channel: DistributionChannel,
    recipient: ReportRecipient
  ): Promise<void> {
    try {
      // 獲取生成的報表信息
      const generation = await this.reportsService.getGenerationStatus(generationId);
      if (!generation || !generation.filePath) {
        throw new Error(`Generated report not found for ${generationId}`);
      }

      const reportConfig = await this.reportsService.getReport(generation.reportId);
      if (!reportConfig) {
        throw new Error(`Report config not found for ${generation.reportId}`);
      }

      // 準備郵件內容
      const emailData = {
        to: recipient.email || recipient.identifier,
        subject: this.formatEmailSubject(channel.config?.subject, reportConfig),
        body: this.formatEmailBody(channel.config?.body, reportConfig, generation),
        attachments: await this.prepareEmailAttachments(generation)
      };

      // 發送郵件
      await this.sendEmail(emailData);

      console.log(`✅ Email sent successfully to ${emailData.to} for generation ${generationId}`, 'email:success');

    } catch (error) {
      console.error(`Failed to send email for generation ${generationId}:`, error);
      throw new AnalyticsError(`Email distribution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'EMAIL_DISTRIBUTION_ERROR');
    }
  }

  /**
   * 發送郵件
   */
  private async sendEmail(emailData: EmailData): Promise<void> {
    try {
      // 方案 1: 使用 Cloudflare Email Workers
      if (this.isCloudflareEmailAvailable()) {
        await this.sendViaCloudflareEmail(emailData);
        return;
      }

      // 方案 2: 使用外部郵件服務 API (如 SendGrid, Mailgun)
      if (this.options.emailConfig) {
        await this.sendViaExternalAPI(emailData);
        return;
      }

      // 方案 3: 使用傳統 SMTP
      await this.sendViaSMTP(emailData);

    } catch (error) {
      console.error('All email sending methods failed:', error);
      throw new AnalyticsError(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'EMAIL_SEND_ERROR');
    }
  }

  /**
   * 通過 Cloudflare Email Workers 發送
   */
  private async sendViaCloudflareEmail(emailData: EmailData): Promise<void> {
    try {
      // Cloudflare Email Workers 實現
      const emailWorkerUrl = 'https://email-worker.your-domain.workers.dev/send';

      const response = await fetch(emailWorkerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EMAIL_WORKER_TOKEN}` // 需要配置
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.body,
          attachments: emailData.attachments
        })
      });

      if (!response.ok) {
        throw new Error(`Cloudflare Email Worker responded with status: ${response.status}`);
      }

      console.log('Email sent via Cloudflare Email Workers', 'email:cloudflare');

    } catch (error) {
      console.error('Cloudflare Email failed:', error);
      throw error;
    }
  }

  /**
   * 通過外部 API 發送 (SendGrid/Mailgun)
   */
  private async sendViaExternalAPI(emailData: EmailData): Promise<void> {
    try {
      // 使用 SendGrid 作為示例
      const sendGridApiUrl = 'https://api.sendgrid.com/v3/mail/send';

      const sendGridData = {
        personalizations: [{
          to: [{ email: emailData.to }],
          subject: emailData.subject
        }],
        from: {
          email: this.options.emailConfig!.fromAddress,
          name: this.options.emailConfig!.fromName
        },
        content: [{
          type: 'text/html',
          value: emailData.body
        }],
        attachments: emailData.attachments?.map(att => ({
          content: att.content,
          filename: att.filename,
          type: att.contentType
        })) || []
      };

      const response = await fetch(sendGridApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendGridData)
      });

      if (!response.ok) {
        throw new Error(`SendGrid API responded with status: ${response.status}`);
      }

      console.log('Email sent via SendGrid API', 'email:sendgrid');

    } catch (error) {
      console.error('External email API failed:', error);
      throw error;
    }
  }

  /**
   * 通過 SMTP 發送
   */
  private async sendViaSMTP(emailData: EmailData): Promise<void> {
    // SMTP 在 Workers 環境中較難實現，作為回退方案
    console.log('SMTP sending not implemented in Workers environment', 'email:smtp:unsupported');
    console.log('Email data:', {
      to: emailData.to,
      subject: emailData.subject,
      hasAttachments: !!emailData.attachments?.length
    });

    // 在實際實現中，可以將郵件排隊等待其他服務處理
    throw new AnalyticsError('SMTP not available in Workers environment', 'SMTP_NOT_AVAILABLE');
  }

  /**
   * 檢查 Cloudflare Email 是否可用
   */
  private isCloudflareEmailAvailable(): boolean {
    return !!(process.env.EMAIL_WORKER_TOKEN || process.env.CLOUDFLARE_EMAIL_ENABLED);
  }

  /**
   * 格式化郵件主題
   */
  private formatEmailSubject(template: string = '', config: ReportConfig): string {
    const subject = template || `Analytics Report: {reportName}`;
    return subject
      .replace(/\{reportName\}/g, config.name)
      .replace(/\{date\}/g, new Date().toLocaleDateString('zh-TW'));
  }

  /**
   * 格式化郵件內容
   */
  private formatEmailBody(template: string = '', config: ReportConfig, generation: any): string {
    const body = template || `
<h2>Analytics Report: ${config.name}</h2>
<p>您的定期報表已生成完成。</p>
<p><strong>報表名稱:</strong> ${config.name}</p>
<p><strong>生成時間:</strong> ${new Date(generation.generatedAt).toLocaleString('zh-TW')}</p>
<p><strong>格式:</strong> ${generation.format}</p>
${config.description ? `<p><strong>描述:</strong> ${config.description}</p>` : ''}
<p>請查看附件以獲取詳細資訊。</p>
<hr>
<p><small>此郵件由 Analytics 模組自動生成</small></p>
    `;

    return body
      .replace(/\{reportName\}/g, config.name)
      .replace(/\{date\}/g, new Date().toLocaleDateString('zh-TW'))
      .replace(/\{description\}/g, config.description || '');
  }

  /**
   * 準備郵件附件
   */
  private async prepareEmailAttachments(generation: any): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    if (generation.filePath) {
      try {
        // 如果是 base64 數據 URL
        if (generation.filePath.startsWith('data:')) {
          const [mimeInfo, base64Data] = generation.filePath.split(',');
          const contentType = mimeInfo.split(':')[1].split(';')[0];
          const extension = this.getFileExtension(contentType);

          attachments.push({
            filename: `report_${new Date().toISOString().split('T')[0]}.${extension}`,
            content: base64Data,
            contentType: contentType
          });
        }
      } catch (error) {
        console.error('Failed to prepare email attachment:', error);
      }
    }

    return attachments;
  }

  /**
   * 根據 MIME 類型獲取文件擴展名
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/csv': 'csv',
      'application/json': 'json',
      'text/html': 'html'
    };
    return mimeToExt[mimeType] || 'txt';
  }

  /**
   * 通過 Webhook 分發
   */
  private async distributeViaWebhook(
    generationId: string,
    channel: DistributionChannel,
    recipient: ReportRecipient
  ): Promise<void> {
    // TODO: 實現 Webhook 發送邏輯
    console.log(`Sending webhook to ${recipient.identifier} for generation ${generationId}`, 'webhook:send');
  }

  /**
   * 通過 Slack 分發
   */
  private async distributeViaSlack(
    generationId: string,
    channel: DistributionChannel,
    recipient: ReportRecipient
  ): Promise<void> {
    try {
      // 獲取生成的報表信息
      const generation = await this.reportsService.getGenerationStatus(generationId);
      if (!generation) {
        throw new Error(`Generated report not found for ${generationId}`);
      }

      const reportConfig = await this.reportsService.getReport(generation.reportId);
      if (!reportConfig) {
        throw new Error(`Report config not found for ${generation.reportId}`);
      }

      // 準備 Slack 消息
      const slackMessage = this.formatSlackMessage(reportConfig, generation, channel);

      // 發送到 Slack
      await this.sendSlackMessage(recipient.identifier, slackMessage);

      console.log(`✅ Slack message sent successfully to ${recipient.identifier} for generation ${generationId}`, 'slack:success');

    } catch (error) {
      console.error(`Failed to send Slack message for generation ${generationId}:`, error);
      throw new AnalyticsError(`Slack distribution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SLACK_DISTRIBUTION_ERROR');
    }
  }

  /**
   * 發送 Slack 消息
   */
  private async sendSlackMessage(channelOrWebhook: string, message: SlackMessage): Promise<void> {
    try {
      // 判斷是 webhook URL 還是頻道名稱
      if (channelOrWebhook.startsWith('https://hooks.slack.com/')) {
        // 使用 Webhook URL
        await this.sendSlackWebhook(channelOrWebhook, message);
      } else {
        // 使用 Slack API with Bot Token
        await this.sendSlackAPI(channelOrWebhook, message);
      }

    } catch (error) {
      console.error('Slack message sending failed:', error);
      throw new AnalyticsError(`Slack sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SLACK_SEND_ERROR');
    }
  }

  /**
   * 通過 Webhook 發送 Slack 消息
   */
  private async sendSlackWebhook(webhookUrl: string, message: SlackMessage): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Slack webhook responded with status: ${response.status}`);
      }

      console.log('Slack message sent via webhook', 'slack:webhook');

    } catch (error) {
      console.error('Slack webhook failed:', error);
      throw error;
    }
  }

  /**
   * 通過 Slack API 發送消息
   */
  private async sendSlackAPI(channel: string, message: SlackMessage): Promise<void> {
    try {
      const slackApiUrl = 'https://slack.com/api/chat.postMessage';

      const response = await fetch(slackApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: channel,
          ...message
        })
      });

      const result = await response.json() as { ok: boolean; error?: string };

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error || 'Unknown error'}`);
      }

      console.log('Slack message sent via API', 'slack:api');

    } catch (error) {
      console.error('Slack API failed:', error);
      throw error;
    }
  }

  /**
   * 格式化 Slack 消息
   */
  private formatSlackMessage(config: ReportConfig, generation: any, channel: DistributionChannel): SlackMessage {
    const message: SlackMessage = {
      text: `📊 Analytics Report: ${config.name}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📊 ${config.name}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*生成時間:*\n${new Date(generation.generatedAt).toLocaleString('zh-TW')}`
            },
            {
              type: 'mrkdwn',
              text: `*格式:*\n${generation.format.toUpperCase()}`
            },
            {
              type: 'mrkdwn',
              text: `*狀態:*\n${generation.status === 'completed' ? '✅ 完成' : '❌ 失敗'}`
            },
            {
              type: 'mrkdwn',
              text: `*記錄數:*\n${generation.metadata?.recordCount || 'N/A'}`
            }
          ]
        }
      ],
      attachments: []
    };

    // 添加描述
    if (config.description) {
      message.blocks!.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*描述:* ${config.description}`
        }
      });
    }

    // 添加下載連結或文件信息
    if (generation.downloadUrl) {
      message.blocks!.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*下載連結:* <${generation.downloadUrl}|點擊下載報表>`
        }
      });
    } else if (generation.filePath && generation.filePath.startsWith('data:')) {
      message.blocks!.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*報表檔案:* 已生成完成，請聯繫管理員獲取檔案`
        }
      });
    }

    // 添加分隔線和頁腳
    message.blocks!.push(
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🤖 由 Analytics 模組自動生成 | ${new Date().toLocaleString('zh-TW')}`
          }
        ]
      }
    );

    return message;
  }

  /**
   * 計算下次執行時間
   */
  private calculateNextRun(schedule: ReportSchedule): string {
    const now = new Date();
    let nextRun = new Date(now);

    if (schedule.cronExpression) {
      // TODO: 實現 cron 表達式解析
      // 這裡使用簡化的實現
      nextRun.setHours(nextRun.getHours() + 1);
      return nextRun.toISOString();
    }

    switch (schedule.frequency) {
      case ScheduleFrequency.Hourly:
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case ScheduleFrequency.Daily:
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(9, 0, 0, 0); // 每天上午 9 點
        break;
      case ScheduleFrequency.Weekly:
        nextRun.setDate(nextRun.getDate() + 7);
        nextRun.setHours(9, 0, 0, 0);
        break;
      case ScheduleFrequency.Monthly:
        nextRun.setMonth(nextRun.getMonth() + 1, 1);
        nextRun.setHours(9, 0, 0, 0);
        break;
      case ScheduleFrequency.Quarterly:
        nextRun.setMonth(nextRun.getMonth() + 3, 1);
        nextRun.setHours(9, 0, 0, 0);
        break;
      case ScheduleFrequency.Yearly:
        nextRun.setFullYear(nextRun.getFullYear() + 1, 0, 1);
        nextRun.setHours(9, 0, 0, 0);
        break;
      default:
        nextRun.setHours(nextRun.getHours() + 24); // 默認 24 小時後
    }

    return nextRun.toISOString();
  }

  /**
   * 生成任務 ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理資源
   */
  cleanup(): void {
    this.stopScheduler();
    this.runningTasks.clear();
  }
}

export default ReportSchedulerService;