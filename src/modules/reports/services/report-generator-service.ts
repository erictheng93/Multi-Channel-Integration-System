// Report Generator Service
// Handles report data generation, querying, formatting and serialization

import type { Bindings } from '@/types';
import type { drizzle } from 'drizzle-orm/d1';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('ReportGenerator')

import type {
  ReportBase,
  ReportGenerationParams,
  ReportFormat,
  ReportStatus,
  ReportTimeRange,
  ConversationSummaryReportData,
  AgentPerformanceReportData
} from '../types/report-types';

import {
  ReportGenerationError,
  InvalidReportParamsError,
  ReportAccessDeniedError,
  ReportNotFoundError,
  DEFAULT_REPORT_CONFIG,
  isReportTimeRange
} from '../types/report-types';

import type { ReportUtils } from './report-utils';
import { nowISO, nowMs } from '@/utils/timestamp'

type DrizzleDb = ReturnType<typeof drizzle>;
type ReportInsert = typeof import('../../../db/schema').reports.$inferInsert;

export interface ReportDownloadContent {
  body: BodyInit;
  contentType: string;
  filename: string;
  fileSize?: number;
  url: string;
}

interface FormattedReportData {
  reportInfo: {
    title: string;
    type: ReportGenerationParams['type'];
    generatedAt: string;
    parameters: {
      timeRange?: ReportTimeRange;
      filters?: ReportGenerationParams['filters'];
    };
  };
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Handles all report generation, data querying, and formatting
 */
export class ReportGeneratorService {
  private db: D1Database;
  private bucket: R2Bucket;
  constructor(env: Bindings) {
    this.db = env.DB;
    this.bucket = env.R2_BUCKET;
  }

  /**
   * Generate a report (full pipeline: validate → query → format → save)
   */
  async generateReport(
    params: ReportGenerationParams,
    userId: string,
    utils: ReportUtils
  ): Promise<ReportBase> {
    const startTime = nowMs();

    try {
      // Validate params via utils
      const validation = await utils.validateReportParams(params);
      if (!validation.valid) {
        throw new InvalidReportParamsError(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      await utils.checkReportPermission(params.type, userId, 'generate');
      await utils.checkConcurrentGenerations(userId);

      const reportId = crypto.randomUUID();
      const now = nowISO();
      const expiresAt = new Date(Date.now() + DEFAULT_REPORT_CONFIG.reportExpiryDays * 24 * 60 * 60 * 1000).toISOString();

      const report: ReportBase = {
        id: reportId,
        title: params.title,
        description: params.description,
        type: params.type,
        format: params.format,
        status: 'pending',
        createdBy: userId,
        createdAt: now,
        expiresAt,
        metadata: {
          timeRange: params.timeRange,
          startDate: params.startDate,
          endDate: params.endDate,
          filters: params.filters,
          options: params.options
        }
      };

      await this.saveReport(report);

      try {
        await this.updateReportStatus(reportId, 'generating', now);

        const rawData = await this.queryReportData(params);
        const formattedReport = await this.formatReport(rawData, params);
        const reportContent = this.serializeReport(formattedReport, params.format);
        const fileSize = new TextEncoder().encode(reportContent).byteLength;
        const executionTime = Math.floor((Date.now() - startTime) / 1000);
        const downloadUrl = `/api/reports/${reportId}/download`;

        await this.storeReportFile(reportId, reportContent, params.format, {
          title: params.title,
          type: params.type,
          createdBy: userId,
          generatedAt: nowISO()
        });

        await this.updateReportCompletion(reportId, {
          status: 'completed',
          completedAt: nowISO(),
          fileSize,
          executionTime,
          downloadUrl
        });

        return (await this.getReportStatus(reportId))!;
      } catch (genError) {
        const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
        await this.updateReportStatus(reportId, 'failed', nowISO(), errorMessage);
        throw genError;
      }
    } catch (error) {
      log.error('Generate report error', {}, error as Error);
      if (error instanceof InvalidReportParamsError ||
          error instanceof ReportAccessDeniedError) {
        throw error;
      }
      throw new ReportGenerationError('Failed to generate report', error);
    }
  }

  /**
   * Get report status by ID
   */
  async getReportStatus(reportId: string): Promise<ReportBase | null> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reports } = await import('../../../db/schema');
      const { eq } = await import('drizzle-orm');

      const db = drizzle(this.db);
      const report = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .get();

      if (!report) {
        return null;
      }

      return {
        id: report.id,
        title: report.title,
        type: report.type as ReportBase['type'],
        format: report.format as ReportFormat,
        status: report.status as ReportStatus,
        createdBy: report.createdBy,
        createdAt: report.createdAt || nowISO(),
        updatedAt: report.updatedAt || undefined,
        startedAt: report.generationStartedAt || undefined,
        completedAt: report.completedAt || undefined,
        downloadUrl: report.downloadUrl || undefined,
        fileSize: report.fileSize || undefined,
        teamId: report.teamId || undefined,
        errorMessage: report.errorMessage || undefined,
        metadata: report.options ? JSON.parse(report.options) : undefined
      };
    } catch (error) {
      log.error('Get report status error', {}, error as Error);
      return null;
    }
  }

  /**
   * Download report
   */
  async downloadReport(
    reportId: string,
    userId: string,
    utils: ReportUtils
  ): Promise<ReportDownloadContent | null> {
    try {
      const report = await this.getReportStatus(reportId);
      if (!report) {
        throw new ReportNotFoundError(reportId);
      }

      await utils.checkDownloadPermission(report, userId);

      if (report.status !== 'completed' || !report.downloadUrl) {
        return null;
      }

      const objectKey = this.getReportObjectKey(report.id, report.format);
      const object = await this.bucket.get(objectKey);
      if (!object) {
        log.error('Report object missing from R2', { reportId, objectKey });
        return null;
      }

      await this.logDownload(reportId, userId);

      const filename = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${this.getReportExtension(report.format)}`;
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType || this.getReportContentType(report.format),
        filename,
        fileSize: object.size,
        url: report.downloadUrl
      };
    } catch (error) {
      log.error('Download report error', {}, error as Error);
      if (error instanceof ReportNotFoundError ||
          error instanceof ReportAccessDeniedError) {
        throw error;
      }
      return null;
    }
  }

  // =================== Private: DB Operations ===================

  private async saveReport(report: ReportBase): Promise<void> {
    const { drizzle } = await import('drizzle-orm/d1');
    const { reports } = await import('../../../db/schema');

    const db = drizzle(this.db);

    const metadata = report.metadata ?? {};
    const insertData: ReportInsert = {
      id: report.id,
      title: report.title,
      description: report.description ?? null,
      type: report.type,
      format: report.format,
      status: report.status,
      createdBy: report.createdBy,
      createdAt: report.createdAt,
      expiresAt: report.expiresAt ?? null,
      timeRange: isReportTimeRange(metadata.timeRange) ? metadata.timeRange : null,
      startDate: typeof metadata.startDate === 'string' ? metadata.startDate : null,
      endDate: typeof metadata.endDate === 'string' ? metadata.endDate : null,
      filters: isRecord(metadata.filters) ? JSON.stringify(metadata.filters) : null,
      options: isRecord(metadata.options) ? JSON.stringify(metadata.options) : null
    };

    await db.insert(reports).values(insertData);
  }

  private async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    timestamp: string,
    errorMessage?: string
  ): Promise<void> {
    const { drizzle } = await import('drizzle-orm/d1');
    const { reports } = await import('../../../db/schema');
    const { eq } = await import('drizzle-orm');

    const db = drizzle(this.db);

    const updates: Partial<ReportInsert> = { status, updatedAt: timestamp };

    if (status === 'generating') {
      updates.generationStartedAt = timestamp;
    } else if (status === 'failed') {
      updates.failedAt = timestamp;
      updates.errorMessage = errorMessage || 'Unknown error';
    }

    await db.update(reports).set(updates).where(eq(reports.id, reportId));
  }

  private async updateReportCompletion(reportId: string, data: {
    status: 'completed';
    completedAt: string;
    fileSize: number;
    executionTime: number;
    downloadUrl: string;
  }): Promise<void> {
    const { drizzle } = await import('drizzle-orm/d1');
    const { reports } = await import('../../../db/schema');
    const { eq } = await import('drizzle-orm');

    const db = drizzle(this.db);

    await db.update(reports).set({
      status: data.status,
      completedAt: data.completedAt,
      fileSize: data.fileSize,
      executionTime: data.executionTime,
      downloadUrl: data.downloadUrl,
      updatedAt: data.completedAt
    }).where(eq(reports.id, reportId));
  }

  async logDownload(reportId: string, userId: string): Promise<void> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reportDownloadHistory } = await import('../../../db/schema');
      const { generateId } = await import('../../../utils/id-generator');

      const db = drizzle(this.db);
      const downloadId = generateId('download');
      const now = nowISO();

      await db.insert(reportDownloadHistory).values({
        id: downloadId,
        reportId,
        downloadedBy: userId,
        downloadedAt: now,
        ipAddress: null,
        userAgent: null
      });

      log.info(`Download logged: ${reportId} by ${userId}`);
    } catch (error) {
      log.error('Failed to log download', {}, error as Error);
    }
  }

  async deleteReportFile(downloadUrl: string): Promise<void> {
    const match = downloadUrl.match(/\/api\/reports\/([^/]+)\/download$/);
    if (!match?.[1]) {
      return;
    }

    await Promise.allSettled(
      (['json', 'csv'] as ReportFormat[]).map(format =>
        this.bucket.delete(this.getReportObjectKey(match[1], format))
      )
    );
  }

  // =================== Private: Data Querying ===================

  private async queryReportData(params: ReportGenerationParams) {
    const { drizzle } = await import('drizzle-orm/d1');

    const db = drizzle(this.db);
    const { startDate, endDate } = this.calculateDateRange(params.timeRange, params.startDate, params.endDate);

    switch (params.type) {
      case 'conversation_summary':
        return await this.queryConversationSummary(db, startDate, endDate, params.filters);
      case 'agent_performance':
        return await this.queryAgentPerformance(db, startDate, endDate, params.filters);
      case 'message_statistics':
        return await this.queryMessageStatistics(db, startDate, endDate, params.filters);
      default:
        throw new Error(`Unsupported report type: ${params.type}`);
    }
  }

  calculateDateRange(timeRange?: ReportTimeRange, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (timeRange === 'custom' && customStart && customEnd) {
      let tempStart = new Date(customStart);
      let tempEnd = new Date(customEnd);

      if (tempStart > tempEnd) {
        [tempStart, tempEnd] = [tempEnd, tempStart];
      }

      startDate = tempStart;
      startDate.setHours(0, 0, 0, 0);
      endDate = tempEnd;
      endDate.setHours(23, 59, 59, 999);
    } else {
      const timeRangeMap: Record<string, number> = {
        '24h': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365,
        'last_24_hours': 1, 'last_7_days': 7, 'last_30_days': 30,
        'last_90_days': 90, 'last_year': 365,
        'current_month': 30, 'last_month': 30,
        'current_quarter': 90, 'last_quarter': 90,
        'current_year': 365, 'custom': 30
      };
      const days = timeRangeMap[timeRange || '30d'] || 30;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  private async queryConversationSummary(db: DrizzleDb, startDate: string, endDate: string, _filters: unknown): Promise<ConversationSummaryReportData> {
    const { conversations } = await import('../../../db/schema');
    const { gte, lte, count, and } = await import('drizzle-orm');

    const baseConditions = [
      gte(conversations.createdAt, startDate),
      lte(conversations.createdAt, endDate)
    ];

    const conversationStats = await db
      .select({ total: count(), status: conversations.status })
      .from(conversations)
      .where(and(...baseConditions))
      .groupBy(conversations.status);

    const totalConversations = conversationStats.reduce((sum: number, s) => sum + s.total, 0);
    const activeConversations = conversationStats.find((s) => s.status === 'active')?.total || 0;
    const closedConversations = conversationStats.find((s) => s.status === 'closed')?.total || 0;

    // Message stats query available if needed:
    // await db.select({ total: count() }).from(messages).where(and(gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));

    return {
      period: { startDate, endDate },
      totalConversations,
      activeConversations,
      completedConversations: closedConversations,
      averageResponseTime: 0,
      averageResolutionTime: 0,
      conversationsByPlatform: {},
      conversationsByPriority: {},
      conversationsByTeam: {},
      hourlyDistribution: [],
      dailyTrends: [],
      topTags: []
    };
  }

  private async queryAgentPerformance(db: DrizzleDb, startDate: string, endDate: string, _filters: unknown): Promise<AgentPerformanceReportData> {
    const { messages, agents } = await import('../../../db/schema');
    const { gte, lte, count, eq, and, isNotNull } = await import('drizzle-orm');

    const agentStats = await db
      .select({ agentId: messages.agentSenderId, messageCount: count() })
      .from(messages)
      .where(and(
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate),
        isNotNull(messages.agentSenderId)
      ))
      .groupBy(messages.agentSenderId);

    const agentPerformance = await Promise.all(
      agentStats
        .filter((stat): stat is typeof stat & { agentId: string } => stat.agentId !== null)
        .map(async (stat) => {
        const agent = await db
          .select()
          .from(agents)
          .where(eq(agents.id, stat.agentId))
          .get();

        const messageCount = await db
          .select({ total: count() })
          .from(messages)
          .where(and(
            eq(messages.agentSenderId, stat.agentId),
            gte(messages.createdAt, startDate),
            lte(messages.createdAt, endDate)
          ));

        return {
          agentId: stat.agentId,
          agentName: agent?.displayName || 'Unknown',
          teamId: null as number | null,
          teamName: '',
          conversationsHandled: stat.messageCount,
          messagesSent: messageCount[0]?.total || 0,
          avgResponseTime: 0,
          satisfactionScore: null as number | null
        };
      })
    );

    return {
      period: { startDate, endDate },
      totalAgents: agentPerformance.length,
      activeAgents: agentPerformance.length,
      agentMetrics: agentPerformance.map(agent => ({
        agentId: agent.agentId || '',
        agentName: agent.agentName || '',
        teamId: agent.teamId?.toString() || '',
        teamName: agent.teamName || '',
        conversationsHandled: agent.conversationsHandled || 0,
        messagesHandled: agent.messagesSent || 0,
        averageResponseTime: agent.avgResponseTime || 0,
        customerSatisfactionScore: agent.satisfactionScore || 0,
        resolutionRate: 0,
        activeHours: 0,
        efficiency: 0
      })),
      teamComparisons: [],
      performanceTrends: []
    };
  }

  private async queryMessageStatistics(db: DrizzleDb, startDate: string, endDate: string, _filters: unknown) {
    const { messages } = await import('../../../db/schema');
    const { sql, count } = await import('drizzle-orm');

    const messageStats = await db
      .select({
        total: count(),
        senderType: messages.senderType,
        messageType: messages.messageType
      })
      .from(messages)
      .where(sql`${messages.createdAt} >= ${startDate} AND ${messages.createdAt} <= ${endDate}`)
      .groupBy(messages.senderType, messages.messageType);

    return {
      period: { startDate, endDate },
      summary: {
        totalMessages: messageStats.reduce((sum: number, s) => sum + s.total, 0),
        customerMessages: messageStats.filter((s) => s.senderType === 'customer').reduce((sum: number, s) => sum + s.total, 0),
        agentMessages: messageStats.filter((s) => s.senderType === 'agent').reduce((sum: number, s) => sum + s.total, 0)
      },
      messagesByType: messageStats
    };
  }

  // =================== Private: Formatting ===================

  private async formatReport(data: unknown, params: ReportGenerationParams): Promise<FormattedReportData> {
    return {
      reportInfo: {
        title: params.title,
        type: params.type,
        generatedAt: nowISO(),
        parameters: { timeRange: params.timeRange, filters: params.filters }
      },
      data
    };
  }

  serializeReport(data: FormattedReportData, format: ReportFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private async storeReportFile(
    reportId: string,
    content: string,
    format: ReportFormat,
    metadata: Record<string, string>
  ): Promise<void> {
    await this.bucket.put(this.getReportObjectKey(reportId, format), content, {
      httpMetadata: {
        contentType: this.getReportContentType(format),
        contentDisposition: `attachment; filename="${reportId}.${this.getReportExtension(format)}"`
      },
      customMetadata: metadata
    });
  }

  private getReportObjectKey(reportId: string, format: ReportFormat): string {
    return `reports/${reportId}.${this.getReportExtension(format)}`;
  }

  private getReportExtension(format: ReportFormat): string {
    return format === 'excel' ? 'csv' : format;
  }

  private getReportContentType(format: ReportFormat): string {
    switch (format) {
      case 'json':
        return 'application/json; charset=utf-8';
      case 'csv':
      case 'excel':
        return 'text/csv; charset=utf-8';
      case 'html':
        return 'text/html; charset=utf-8';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  private convertToCSV(data: FormattedReportData): string {
    const lines: string[] = [];
    lines.push(`Report: ${data.reportInfo.title}`);
    lines.push(`Generated: ${data.reportInfo.generatedAt}`);
    lines.push('');

    if (isRecord(data.data) && isRecord(data.data.summary)) {
      lines.push('Summary');
      Object.entries(data.data.summary).forEach(([key, value]) => {
        lines.push(`${key},${value}`);
      });
    }

    return lines.join('\n');
  }
}
