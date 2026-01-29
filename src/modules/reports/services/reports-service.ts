// Reports 服務實現
// Comprehensive reporting service with generation, management and analytics

import type { Bindings } from '@/types';
import type {
  ReportBase,
  ReportDetails,
  ReportGenerationParams,
  ReportListQuery,
  ReportListResponse,
  ReportStatistics,
  ReportType,
  ReportFormat,
  ReportStatus,
  ReportTimeRange,
  BatchReportOperation,
  BatchOperationResult,
  ScheduledReport,
  ScheduledReportExecution,
  ReportsServiceInterface,
  // Type imports for query methods
  ConversationSummaryReportData,
  AgentPerformanceReportData
} from '../types/report-types';

// Import sample data generators (extracted for maintainability)
import { SampleDataGenerators } from './sample-data-generators';

// 導入錯誤類和配置常數（作為值而不是類型）
import {
  ReportNotFoundError,
  ReportGenerationError,
  InvalidReportParamsError,
  ReportAccessDeniedError,
  DEFAULT_REPORT_CONFIG,
  REPORT_TYPE_CONFIG
} from '../types/report-types';

/**
 * Reports Service 實現
 * 提供完整的報告生成、管理和分析功能
 */
export class ReportsService implements ReportsServiceInterface {
  private db: D1Database;
  private env: Bindings;

  constructor(env: Bindings) {
    this.db = env.DB;
    this.env = env;
  }

  // ======================== 報告生成 ========================

  /**
   * 生成報告
   */
  async generateReport(params: ReportGenerationParams, userId: string): Promise<ReportBase> {
    const startTime = Date.now();

    try {
      // 驗證參數
      const validation = await this.validateReportParams(params);
      if (!validation.valid) {
        throw new InvalidReportParamsError(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      // 檢查權限
      await this.checkReportPermission(params.type, userId, 'generate');

      // 檢查並發限制
      await this.checkConcurrentGenerations(userId);

      const reportId = `report_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + DEFAULT_REPORT_CONFIG.reportExpiryDays * 24 * 60 * 60 * 1000).toISOString();

      // 創建報告記錄
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

      // 儲存到資料庫
      await this.saveReport(report);

      // 立即開始生成報告 (同步生成以簡化實作)
      try {
        // 更新狀態為 generating
        await this.updateReportStatus(reportId, 'generating', now);

        // 1. 查詢數據
        const rawData = await this.queryReportData(params);

        // 2. 格式化報告
        const formattedReport = await this.formatReport(rawData, params);

        // 3. 存儲報告文件 (這裡先存儲為 JSON 字符串，未來可擴展到 R2)
        const reportContent = this.serializeReport(formattedReport, params.format);
        const fileSize = new Blob([reportContent]).size;

        // 計算執行時間
        const executionTime = Math.floor((Date.now() - startTime) / 1000);

        // 更新報告狀態為完成
        await this.updateReportCompletion(reportId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          fileSize,
          executionTime,
          // 簡化實作：使用 data URL (生產環境應使用 R2)
          downloadUrl: `/api/reports/${reportId}/download`
        });

        // 重新查詢報告以獲取最新狀態
        return (await this.getReportStatus(reportId))!;

      } catch (genError) {
        // 生成失敗，更新狀態
        const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
        await this.updateReportStatus(reportId, 'failed', new Date().toISOString(), errorMessage);
        throw genError;
      }

    } catch (error) {
      console.error('Generate report error:', error);
      if (error instanceof InvalidReportParamsError ||
          error instanceof ReportAccessDeniedError) {
        throw error;
      }
      throw new ReportGenerationError('Failed to generate report', error);
    }
  }

  /**
   * 儲存報告記錄到數據庫
   */
  private async saveReport(report: ReportBase): Promise<void> {
    const { drizzle } = await import('drizzle-orm/d1');
    const { reports } = await import('../../../db/schema');

    const db = drizzle(this.db);

    await db.insert(reports).values({
      id: report.id,
      title: report.title,
      description: report.description,
      type: report.type,
      format: report.format,
      status: report.status,
      createdBy: report.createdBy,
      createdAt: report.createdAt,
      expiresAt: report.expiresAt,
      timeRange: report.metadata?.timeRange,
      startDate: report.metadata?.startDate,
      endDate: report.metadata?.endDate,
      filters: report.metadata?.filters ? JSON.stringify(report.metadata.filters) : null,
      options: report.metadata?.options ? JSON.stringify(report.metadata.options) : null
    });
  }

  /**
   * 更新報告狀態
   */
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

    const updates: any = {
      status,
      updatedAt: timestamp
    };

    if (status === 'generating') {
      updates.generationStartedAt = timestamp;
    } else if (status === 'failed') {
      updates.failedAt = timestamp;
      updates.errorMessage = errorMessage || 'Unknown error';
    }

    await db.update(reports).set(updates).where(eq(reports.id, reportId));
  }

  /**
   * 更新報告完成狀態
   */
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

  /**
   * 查詢報告所需數據
   */
  private async queryReportData(params: ReportGenerationParams): Promise<any> {
    const { drizzle } = await import('drizzle-orm/d1');
    const { conversations, messages, customers, agents } = await import('../../../db/schema');
    const { sql, eq, and, gte, lte, count, desc } = await import('drizzle-orm');

    const db = drizzle(this.db);

    // 計算日期範圍
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

  /**
   * 計算日期範圍
   */
  private calculateDateRange(timeRange?: ReportTimeRange, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (timeRange === 'custom' && customStart && customEnd) {
      // 自訂日期範圍 - 設置開始時間為 00:00:00.000，結束時間為 23:59:59.999
      let tempStart = new Date(customStart);
      let tempEnd = new Date(customEnd);

      // 自動調整：如果開始日期晚於結束日期，則交換它們
      if (tempStart > tempEnd) {
        [tempStart, tempEnd] = [tempEnd, tempStart];
      }

      startDate = tempStart;
      startDate.setHours(0, 0, 0, 0);

      endDate = tempEnd;
      endDate.setHours(23, 59, 59, 999);
    } else {
      // 預設時間範圍 - 支持簡化格式 (7d, 30d) 和完整格式 (last_7_days, last_30_days)
      const timeRangeMap: Record<string, number> = {
        // 簡化格式
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
        // 完整格式
        'last_24_hours': 1,
        'last_7_days': 7,
        'last_30_days': 30,
        'last_90_days': 90,
        'last_year': 365,
        // 其他格式
        'current_month': 30,
        'last_month': 30,
        'current_quarter': 90,
        'last_quarter': 90,
        'current_year': 365,
        'custom': 30
      };
      const days = timeRangeMap[timeRange || '30d'] || 30;

      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  /**
   * 查詢對話摘要數據
   */
  private async queryConversationSummary(db: any, startDate: string, endDate: string, filters: any): Promise<ConversationSummaryReportData> {
    const { conversations, messages, customers } = await import('../../../db/schema');
    const { sql, gte, lte, count, eq, and } = await import('drizzle-orm');

    // 基礎查詢條件
    const baseConditions = [
      gte(conversations.createdAt, startDate),
      lte(conversations.createdAt, endDate)
    ];

    // 添加過濾條件
    if (filters?.platform) {
      // 需要 join customers 表來過濾平台
    }

    // 查詢對話統計
    const conversationStats = await db
      .select({
        total: count(),
        status: conversations.status
      })
      .from(conversations)
      .where(and(...baseConditions))
      .groupBy(conversations.status);

    // 計算統計數據
    const totalConversations = conversationStats.reduce((sum: number, s: any) => sum + s.total, 0);
    const activeConversations = conversationStats.find((s: any) => s.status === 'active')?.total || 0;
    const closedConversations = conversationStats.find((s: any) => s.status === 'closed')?.total || 0;

    // 查詢消息統計
    const messageStats = await db
      .select({
        total: count()
      })
      .from(messages)
      .where(and(
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate)
      ));

    const totalMessages = messageStats[0]?.total || 0;

    return {
      period: { startDate, endDate },
      totalConversations,
      activeConversations,
      completedConversations: closedConversations,
      averageResponseTime: 0, // TODO: 實作平均響應時間計算
      averageResolutionTime: 0, // TODO: 實作平均解決時間計算
      conversationsByPlatform: {}, // TODO: 從 conversations 表中計算
      conversationsByPriority: {}, // TODO: 從 conversations 表中計算
      conversationsByTeam: {}, // TODO: 從 conversations 表中計算
      hourlyDistribution: [],
      dailyTrends: [],
      topTags: []
    };
  }

  /**
   * 查詢客服績效數據
   */
  private async queryAgentPerformance(db: any, startDate: string, endDate: string, filters: any): Promise<AgentPerformanceReportData> {
    const { conversations, messages, agents } = await import('../../../db/schema');
    const { sql, gte, lte, count, eq, and, isNotNull } = await import('drizzle-orm');

    // Note: Individual assignment (assignedUserId) removed - using team-based reports
    // 查詢每個團隊的對話數
    const teamStats = await db
      .select({
        teamId: conversations.assignedTeamId,
        conversationCount: count(),
      })
      .from(conversations)
      .where(and(
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate),
        isNotNull(conversations.assignedTeamId)
      ))
      .groupBy(conversations.assignedTeamId);

    // Get agent stats by counting messages sent per agent
    const agentStats = await db
      .select({
        agentId: messages.agentSenderId,
        messageCount: count(),
      })
      .from(messages)
      .where(and(
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate),
        isNotNull(messages.agentSenderId)
      ))
      .groupBy(messages.agentSenderId);

    // 獲取客服詳細資訊
    const agentPerformance = await Promise.all(
      agentStats.map(async (stat: any) => {
        const agent = await db
          .select()
          .from(agents)
          .where(eq(agents.id, stat.agentId))
          .get();

        // 查詢該客服的消息數
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
          conversationsHandled: stat.conversationCount,
          messagesSent: messageCount[0]?.total || 0,
          avgResponseTime: 0, // 簡化實作
          satisfactionScore: null as number | null // 簡化實作
        };
      })
    );

    return {
      period: { startDate, endDate },
      totalAgents: agentPerformance.length,
      activeAgents: agentPerformance.length, // TODO: 計算實際活躍客服數
      agentMetrics: agentPerformance.map(agent => ({
        agentId: agent.agentId || '',
        agentName: agent.agentName || '',
        teamId: agent.teamId?.toString() || '',
        teamName: agent.teamName || '',
        conversationsHandled: agent.conversationsHandled || 0,
        messagesHandled: agent.messagesSent || 0,
        averageResponseTime: agent.avgResponseTime || 0,
        customerSatisfactionScore: agent.satisfactionScore || 0,
        resolutionRate: 0, // TODO: 計算解決率
        activeHours: 0, // TODO: 計算工作時數
        efficiency: 0 // TODO: 計算效率
      })),
      teamComparisons: [],
      performanceTrends: []
    };
  }

  /**
   * 查詢消息統計數據
   */
  private async queryMessageStatistics(db: any, startDate: string, endDate: string, filters: any): Promise<any> {
    const { messages } = await import('../../../db/schema');
    const { sql, gte, lte, count } = await import('drizzle-orm');

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
        totalMessages: messageStats.reduce((sum: number, s: any) => sum + s.total, 0),
        customerMessages: messageStats.filter((s: any) => s.senderType === 'customer').reduce((sum: number, s: any) => sum + s.total, 0),
        agentMessages: messageStats.filter((s: any) => s.senderType === 'agent').reduce((sum: number, s: any) => sum + s.total, 0)
      },
      messagesByType: messageStats
    };
  }

  /**
   * 格式化報告數據
   */
  private async formatReport(data: any, params: ReportGenerationParams): Promise<any> {
    // 添加報告元數據
    return {
      reportInfo: {
        title: params.title,
        type: params.type,
        generatedAt: new Date().toISOString(),
        parameters: {
          timeRange: params.timeRange,
          filters: params.filters
        }
      },
      data
    };
  }

  /**
   * 序列化報告
   */
  private serializeReport(data: any, format: ReportFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        return this.convertToCSV(data);

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * 轉換為 CSV 格式
   */
  private convertToCSV(data: any): string {
    // 簡化的 CSV 轉換
    const lines: string[] = [];

    // 添加標題
    lines.push(`Report: ${data.reportInfo.title}`);
    lines.push(`Generated: ${data.reportInfo.generatedAt}`);
    lines.push('');

    // 根據報告類型生成 CSV
    if (data.data.summary) {
      lines.push('Summary');
      Object.entries(data.data.summary).forEach(([key, value]) => {
        lines.push(`${key},${value}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 獲取報告狀態
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

      // 轉換資料庫記錄為 ReportBase 對象
      return {
        id: report.id,
        title: report.title,
        type: report.type as 'conversation_summary' | 'agent_performance' | 'message_statistics' | 'custom',
        format: report.format as 'json' | 'csv' | 'excel' | 'pdf',
        status: report.status as 'pending' | 'generating' | 'completed' | 'failed',
        createdBy: report.createdBy,
        createdAt: report.createdAt || new Date().toISOString(),
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
      console.error('Get report status error:', error);
      return null;
    }
  }

  /**
   * 下載報告
   */
  async downloadReport(reportId: string, userId: string): Promise<{ url: string; filename: string } | null> {
    try {
      const report = await this.getReportStatus(reportId);
      if (!report) {
        throw new ReportNotFoundError(reportId);
      }

      // 檢查下載權限
      await this.checkDownloadPermission(report, userId);

      if (report.status !== 'completed' || !report.downloadUrl) {
        return null;
      }

      // 記錄下載歷史
      await this.logDownload(reportId, userId);

      const filename = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.${report.format}`;
      return {
        url: report.downloadUrl,
        filename
      };
    } catch (error) {
      console.error('Download report error:', error);
      if (error instanceof ReportNotFoundError ||
          error instanceof ReportAccessDeniedError) {
        throw error;
      }
      return null;
    }
  }

  // ======================== 報告管理 ========================

  /**
   * 報告列表
   */
  async listReports(query: ReportListQuery): Promise<ReportListResponse> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reports } = await import('../../../db/schema');
      const { eq, and, gte, lte, like, desc, count } = await import('drizzle-orm');

      const db = drizzle(this.db);
      const page = query.page || 1;
      const pageSize = Math.min(query.pageSize || 20, DEFAULT_REPORT_CONFIG.maxPageSize);
      const offset = (page - 1) * pageSize;

      // 構建查詢條件
      const conditions = [];

      if (query.type) {
        conditions.push(eq(reports.type, query.type));
      }
      if (query.status) {
        conditions.push(eq(reports.status, query.status));
      }
      if (query.createdBy) {
        conditions.push(eq(reports.createdBy, query.createdBy));
      }
      if (query.teamId) {
        conditions.push(eq(reports.teamId, query.teamId));
      }
      if (query.startDate) {
        conditions.push(gte(reports.createdAt, query.startDate));
      }
      if (query.endDate) {
        conditions.push(lte(reports.createdAt, query.endDate));
      }
      if (query.search) {
        conditions.push(like(reports.title, `%${query.search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 查詢總數
      const totalResult = await db
        .select({ count: count() })
        .from(reports)
        .where(whereClause)
        .get();

      const total = totalResult?.count || 0;

      // 查詢報告列表（帶分頁）
      const reportRecords = await db
        .select()
        .from(reports)
        .where(whereClause)
        .orderBy(desc(reports.createdAt))
        .limit(pageSize)
        .offset(offset)
        .all();

      // 轉換為 ReportBase 對象
      const reportsList: ReportBase[] = reportRecords.map(report => ({
        id: report.id,
        title: report.title,
        type: report.type as 'conversation_summary' | 'agent_performance' | 'message_statistics' | 'custom',
        format: report.format as 'json' | 'csv' | 'excel' | 'pdf',
        status: report.status as 'pending' | 'generating' | 'completed' | 'failed',
        createdBy: report.createdBy,
        createdAt: report.createdAt || new Date().toISOString(),
        updatedAt: report.updatedAt || undefined,
        startedAt: report.generationStartedAt || undefined,
        completedAt: report.completedAt || undefined,
        downloadUrl: report.downloadUrl || undefined,
        fileSize: report.fileSize || undefined,
        teamId: report.teamId || undefined,
        errorMessage: report.errorMessage || undefined,
        metadata: report.options ? JSON.parse(report.options) : undefined
      }));

      // 查詢統計摘要（不帶分頁條件）
      const summaryConditions = [];
      if (query.teamId) {
        summaryConditions.push(eq(reports.teamId, query.teamId));
      }
      if (query.createdBy) {
        summaryConditions.push(eq(reports.createdBy, query.createdBy));
      }

      const summaryWhere = summaryConditions.length > 0 ? and(...summaryConditions) : undefined;
      const allReports = await db
        .select()
        .from(reports)
        .where(summaryWhere)
        .all();

      return {
        reports: reportsList,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1
        },
        summary: {
          totalReports: allReports.length,
          pendingReports: allReports.filter(r => r.status === 'pending').length,
          completedReports: allReports.filter(r => r.status === 'completed').length,
          failedReports: allReports.filter(r => r.status === 'failed').length
        }
      };
    } catch (error) {
      console.error('List reports error:', error);
      throw new ReportGenerationError('Failed to list reports');
    }
  }

  /**
   * 報告詳情
   */
  async getReportDetails(reportId: string): Promise<ReportDetails | null> {
    try {
      const report = await this.getReportStatus(reportId);
      if (!report) {
        return null;
      }

      // 擴展詳細資訊
      const details: ReportDetails = {
        ...report,
        generationLog: [
          '2025-09-01T00:00:00.000Z - Report generation started',
          '2025-09-01T00:01:00.000Z - Data collection completed',
          '2025-09-01T00:03:00.000Z - Report formatting completed',
          '2025-09-01T00:05:00.000Z - Report generation completed'
        ],
        executionTime: 300, // seconds
        dataSource: {
          tables: ['conversations', 'messages', 'users'],
          filters: report.metadata?.filters || {},
          recordCount: 15000
        },
        downloadHistory: [
          {
            downloadedAt: '2025-09-01T10:00:00.000Z',
            downloadedBy: 'user123',
            ipAddress: '192.168.1.100'
          }
        ]
      };

      return details;
    } catch (error) {
      console.error('Get report details error:', error);
      return null;
    }
  }

  /**
   * 刪除報告
   */
  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    try {
      const report = await this.getReportStatus(reportId);
      if (!report) {
        throw new ReportNotFoundError(reportId);
      }

      // 檢查刪除權限
      await this.checkDeletePermission(report, userId);

      // TODO: 從資料庫刪除
      // await this.deleteReportFromDb(reportId);

      // 如果有下載檔案，也要刪除
      if (report.downloadUrl) {
        await this.deleteReportFile(report.downloadUrl);
      }

      return true;
    } catch (error) {
      console.error('Delete report error:', error);
      if (error instanceof ReportNotFoundError ||
          error instanceof ReportAccessDeniedError) {
        throw error;
      }
      return false;
    }
  }

  // ======================== 統計分析 ========================

  /**
   * 報告統計
   */
  async getReportStatistics(timeRange: ReportTimeRange = 'last_30_days'): Promise<ReportStatistics> {
    try {
      // TODO: 實現真實統計查詢
      const mockStats: ReportStatistics = {
        totalReports: 156,
        reportsByType: {
          // Phase 0: 基礎報表類型
          conversation_summary: 45,
          agent_performance: 32,
          team_analytics: 28,
          customer_satisfaction: 25,
          platform_usage: 15,
          message_statistics: 8,
          response_time_analysis: 2,
          workload_distribution: 1,
          system_health: 0,
          custom: 0,
          // Phase 1: 新增企業級報表類型
          cost_analysis: 12,
          sla_compliance: 8,
          anomaly_detection: 6,
          audit_trail: 4,
          resource_utilization: 3,
          // Phase 2: 商業智能增強
          trend_forecast: 7,
          customer_insights: 5,
          channel_integration: 4,
          goal_achievement: 6,
          automation_effectiveness: 3,
          // Phase 3: 高級分析功能
          security_risk: 2,
          knowledge_base: 3,
          call_quality: 1,
          executive_summary: 8
        },
        reportsByFormat: {
          excel: 78,
          pdf: 45,
          json: 20,
          csv: 10,
          html: 3
        },
        reportsByStatus: {
          completed: 140,
          failed: 8,
          generating: 5,
          pending: 3,
          expired: 0
        },
        averageGenerationTime: 42.5,
        popularReports: [
          {
            type: 'conversation_summary',
            count: 45,
            averageSize: 2.5 * 1024 * 1024
          },
          {
            type: 'agent_performance',
            count: 32,
            averageSize: 1.8 * 1024 * 1024
          }
        ],
        usageByUser: [
          {
            userId: 'admin',
            username: 'Administrator',
            reportCount: 45,
            lastGenerated: '2025-09-25T10:00:00.000Z'
          },
          {
            userId: 'manager1',
            username: 'Team Manager 1',
            reportCount: 28,
            lastGenerated: '2025-09-24T15:30:00.000Z'
          }
        ],
        monthlyTrends: [
          {
            month: '2025-09',
            reportsGenerated: 45,
            totalSize: 95 * 1024 * 1024
          },
          {
            month: '2025-08',
            reportsGenerated: 52,
            totalSize: 110 * 1024 * 1024
          }
        ]
      };

      return mockStats;
    } catch (error) {
      console.error('Get report statistics error:', error);
      throw new ReportGenerationError('Failed to get report statistics');
    }
  }

  // ======================== 批量操作 ========================

  /**
   * 批量操作
   */
  async batchOperation(operation: BatchReportOperation, userId: string): Promise<BatchOperationResult> {
    try {
      const results: BatchOperationResult['results'] = [];

      for (const reportId of operation.reportIds) {
        try {
          const report = await this.getReportStatus(reportId);
          if (!report) {
            results.push({
              reportId,
              success: false,
              error: 'Report not found'
            });
            continue;
          }

          let success = false;
          let downloadUrl: string | undefined;

          switch (operation.action) {
            case 'delete':
              success = await this.deleteReport(reportId, userId);
              break;
            case 'regenerate':
              // TODO: 實現重新生成
              success = true;
              break;
            case 'download':
              const downloadResult = await this.downloadReport(reportId, userId);
              success = !!downloadResult;
              downloadUrl = downloadResult?.url;
              break;
            case 'export':
              // TODO: 實現匯出功能
              success = true;
              break;
          }

          results.push({
            reportId,
            success,
            downloadUrl
          });
        } catch (error) {
          results.push({
            reportId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      return {
        success: failedCount === 0,
        totalRequested: operation.reportIds.length,
        successCount,
        failedCount,
        results
      };
    } catch (error) {
      console.error('Batch operation error:', error);
      throw new ReportGenerationError('Failed to execute batch operation');
    }
  }

  // ======================== 排程報告 ========================

  /**
   * 創建排程報告
   */
  async createScheduledReport(
    config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>,
    userId: string
  ): Promise<ScheduledReport> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const nextRun = this.calculateNextRun(config.schedule);

      const scheduledReport: ScheduledReport = {
        ...config,
        id,
        createdBy: userId,
        createdAt: now,
        nextRun
      };

      // TODO: 儲存到資料庫
      // await this.saveScheduledReport(scheduledReport);

      return scheduledReport;
    } catch (error) {
      console.error('Create scheduled report error:', error);
      throw new ReportGenerationError('Failed to create scheduled report');
    }
  }

  /**
   * 更新排程報告
   */
  async updateScheduledReport(
    id: string,
    updates: Partial<ScheduledReport>,
    userId: string
  ): Promise<ScheduledReport> {
    try {
      // TODO: 從資料庫獲取現有報告
      // const existing = await this.getScheduledReport(id);

      // 模擬更新
      const updatedReport: ScheduledReport = {
        id,
        name: updates.name || 'Updated Report',
        type: updates.type || 'conversation_summary',
        format: updates.format || 'excel',
        schedule: updates.schedule || {
          frequency: 'daily',
          time: '09:00'
        },
        filters: updates.filters || {},
        options: updates.options || {},
        recipients: updates.recipients || [],
        isActive: updates.isActive !== undefined ? updates.isActive : true,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        nextRun: this.calculateNextRun(updates.schedule || {
          frequency: 'daily',
          time: '09:00'
        })
      };

      // TODO: 更新到資料庫
      // await this.updateScheduledReportInDb(updatedReport);

      return updatedReport;
    } catch (error) {
      console.error('Update scheduled report error:', error);
      throw new ReportGenerationError('Failed to update scheduled report');
    }
  }

  /**
   * 刪除排程報告
   */
  async deleteScheduledReport(id: string, userId: string): Promise<boolean> {
    try {
      // TODO: 檢查權限和刪除
      return true;
    } catch (error) {
      console.error('Delete scheduled report error:', error);
      return false;
    }
  }

  /**
   * 排程報告列表
   */
  async listScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    try {
      // TODO: 從資料庫查詢
      const mockReports: ScheduledReport[] = [
        {
          id: '1',
          name: '每日對話摘要',
          type: 'conversation_summary',
          format: 'excel',
          schedule: {
            frequency: 'daily',
            time: '09:00'
          },
          filters: {},
          options: {
            includeCharts: true,
            includeSummary: true
          },
          recipients: [
            {
              email: 'manager@company.com',
              name: 'Manager',
              role: 'team'
            }
          ],
          isActive: true,
          createdBy: userId || 'admin',
          createdAt: '2025-09-01T00:00:00.000Z',
          nextRun: '2025-09-26T09:00:00.000Z'
        }
      ];

      return mockReports;
    } catch (error) {
      console.error('List scheduled reports error:', error);
      return [];
    }
  }

  // ======================== 工具方法 ========================

  /**
   * 驗證報告參數
   */
  async validateReportParams(params: ReportGenerationParams): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 基本欄位驗證
    if (!params.type) {
      errors.push('Report type is required');
    } else if (!Object.keys(REPORT_TYPE_CONFIG).includes(params.type)) {
      errors.push('Invalid report type');
    }

    if (!params.title || params.title.length < 1) {
      errors.push('Report title is required');
    } else if (params.title.length > 200) {
      errors.push('Report title too long (max 200 characters)');
    }

    if (!params.format) {
      errors.push('Report format is required');
    } else if (params.type && REPORT_TYPE_CONFIG[params.type]) {
      const supportedFormats = REPORT_TYPE_CONFIG[params.type].supportedFormats;
      if (!supportedFormats.includes(params.format)) {
        errors.push(`Format '${params.format}' not supported for report type '${params.type}'`);
      }
    }

    // 時間範圍驗證
    if (params.timeRange === 'custom') {
      if (!params.startDate || !params.endDate) {
        errors.push('Start date and end date are required for custom time range');
      } else {
        // 驗證日期格式是否有效
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          errors.push('Invalid date format');
        }
        // Note: 不驗證日期順序，允許系統自動調整
        // 也不限制未來日期，提供更大彈性
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 獲取可用模板
   */
  async getAvailableTemplates(type: ReportType): Promise<Array<{ name: string; description: string; options: any }>> {
    const templates = {
      conversation_summary: [
        {
          name: 'Standard Summary',
          description: 'Basic conversation metrics and trends',
          options: {
            includeCharts: true,
            includeSummary: true,
            includeDetails: false
          }
        },
        {
          name: 'Detailed Analysis',
          description: 'Comprehensive conversation analysis with detailed breakdowns',
          options: {
            includeCharts: true,
            includeSummary: true,
            includeDetails: true,
            includeRawData: false
          }
        }
      ],
      agent_performance: [
        {
          name: 'Performance Overview',
          description: 'Key performance indicators for all agents',
          options: {
            includeCharts: true,
            groupBy: ['team', 'agent'],
            chartType: 'bar'
          }
        }
      ]
    };

    // Type-safe template lookup with fallback to empty array
    const templateKey = type as keyof typeof templates;
    return (templateKey in templates ? templates[templateKey] : []) as Array<{ name: string; description: string; options: any }>;
  }

  /**
   * 預覽報告
   */
  async previewReport(params: ReportGenerationParams): Promise<any> {
    // 使用 SampleDataGenerators 生成樣本數據
    const sampleData = SampleDataGenerators.getSampleData(params.type);
    if (sampleData === null) {
      return { message: 'Preview not available for this report type' };
    }
    return sampleData;
  }

  // ======================== 私有方法 ========================

  private async checkReportPermission(type: ReportType, userId: string, action: string): Promise<void> {
    // TODO: 實現權限檢查
    const requiredPermissions = REPORT_TYPE_CONFIG[type]?.requiredPermissions || [];
    // 暫時允許所有操作
  }

  private async checkConcurrentGenerations(userId: string): Promise<void> {
    // TODO: 檢查並發生成限制
  }

  private async checkDownloadPermission(report: ReportBase, userId: string): Promise<void> {
    // TODO: 檢查下載權限
    if (report.createdBy !== userId) {
      // 檢查是否有相關權限
    }
  }

  private async checkDeletePermission(report: ReportBase, userId: string): Promise<void> {
    // TODO: 檢查刪除權限
    if (report.createdBy !== userId) {
      throw new ReportAccessDeniedError('You can only delete your own reports');
    }
  }

  private async startReportGeneration(report: ReportBase): Promise<void> {
    // TODO: 啟動後台生成任務
    // 可以使用 Cloudflare Queues 或 Durable Objects
  }

  private async logDownload(reportId: string, userId: string): Promise<void> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reportDownloadHistory } = await import('../../../db/schema');
      const { generateId } = await import('../../../utils/id-generator');

      const db = drizzle(this.db);
      const downloadId = generateId('download');
      const now = new Date().toISOString();

      await db.insert(reportDownloadHistory).values({
        id: downloadId,
        reportId,
        downloadedBy: userId,
        downloadedAt: now,
        ipAddress: null, // 可從 request headers 獲取
        userAgent: null  // 可從 request headers 獲取
      });

      console.log(`Download logged: ${reportId} by ${userId}`);
    } catch (error) {
      console.error('Failed to log download:', error);
      // 不拋出錯誤，避免影響下載流程
    }
  }

  private async deleteReportFile(downloadUrl: string): Promise<void> {
    // TODO: 刪除 R2 存儲的檔案
  }

  private calculateNextRun(schedule: ScheduledReport['schedule']): string {
    const now = new Date();
    const [hour, minute] = schedule.time.split(':').map(Number);

    let nextRun = new Date(now);
    nextRun.setHours(hour, minute, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case 'weekly':
        const targetDay = schedule.dayOfWeek || 1; // Monday
        const currentDay = nextRun.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0 || (daysToAdd === 0 && nextRun <= now)) {
          daysToAdd += 7;
        }
        nextRun.setDate(nextRun.getDate() + daysToAdd);
        break;
      case 'monthly':
        const targetDate = schedule.dayOfMonth || 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
      case 'quarterly':
        // 每季的第一天
        const currentQuarter = Math.floor(nextRun.getMonth() / 3);
        nextRun.setMonth(currentQuarter * 3, 1);
        if (nextRun <= now) {
          nextRun.setMonth((currentQuarter + 1) * 3, 1);
        }
        break;
    }

    return nextRun.toISOString();
  }

  // ======================== Sample Data Generators ========================
  // NOTE: All generateSample* methods have been extracted to sample-data-generators.ts
  // for better maintainability and testability. Use SampleDataGenerators class instead.
}
