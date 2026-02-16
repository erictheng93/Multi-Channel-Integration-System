// Report Manager Service
// Handles report CRUD, listing, statistics and batch operations

import type { Bindings } from '@/types';
import type {
  ReportBase,
  ReportDetails,
  ReportListQuery,
  ReportListResponse,
  ReportStatistics,
  ReportTimeRange,
  BatchReportOperation,
  BatchOperationResult
} from '../types/report-types';

import {
  ReportNotFoundError,
  ReportGenerationError,
  ReportAccessDeniedError,
  DEFAULT_REPORT_CONFIG
} from '../types/report-types';

import type { ReportGeneratorService } from './report-generator-service';
import type { ReportUtils } from './report-utils';

/**
 * Handles report listing, details, deletion, statistics and batch operations
 */
export class ReportManagerService {
  private db: D1Database;

  constructor(env: Bindings) {
    this.db = env.DB;
  }

  /**
   * List reports with filtering and pagination
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

      // Build query conditions
      const conditions = [];
      if (query.type) conditions.push(eq(reports.type, query.type));
      if (query.status) conditions.push(eq(reports.status, query.status));
      if (query.createdBy) conditions.push(eq(reports.createdBy, query.createdBy));
      if (query.teamId) conditions.push(eq(reports.teamId, query.teamId));
      if (query.startDate) conditions.push(gte(reports.createdAt, query.startDate));
      if (query.endDate) conditions.push(lte(reports.createdAt, query.endDate));
      if (query.search) conditions.push(like(reports.title, `%${query.search}%`));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Query total count
      const totalResult = await db
        .select({ count: count() })
        .from(reports)
        .where(whereClause)
        .get();
      const total = totalResult?.count || 0;

      // Query paginated reports
      const reportRecords = await db
        .select()
        .from(reports)
        .where(whereClause)
        .orderBy(desc(reports.createdAt))
        .limit(pageSize)
        .offset(offset)
        .all();

      const reportsList: ReportBase[] = reportRecords.map((report: any) => ({
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

      // Summary stats (without pagination filters)
      const summaryConditions = [];
      if (query.teamId) summaryConditions.push(eq(reports.teamId, query.teamId));
      if (query.createdBy) summaryConditions.push(eq(reports.createdBy, query.createdBy));
      const summaryWhere = summaryConditions.length > 0 ? and(...summaryConditions) : undefined;
      const allReports = await db.select().from(reports).where(summaryWhere).all();

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
          pendingReports: allReports.filter((r: any) => r.status === 'pending').length,
          completedReports: allReports.filter((r: any) => r.status === 'completed').length,
          failedReports: allReports.filter((r: any) => r.status === 'failed').length
        }
      };
    } catch (error) {
      console.error('List reports error:', error);
      throw new ReportGenerationError('Failed to list reports');
    }
  }

  /**
   * Get report details
   */
  async getReportDetails(reportId: string, generator: ReportGeneratorService): Promise<ReportDetails | null> {
    try {
      const report = await generator.getReportStatus(reportId);
      if (!report) return null;

      const details: ReportDetails = {
        ...report,
        generationLog: [
          '2025-09-01T00:00:00.000Z - Report generation started',
          '2025-09-01T00:01:00.000Z - Data collection completed',
          '2025-09-01T00:03:00.000Z - Report formatting completed',
          '2025-09-01T00:05:00.000Z - Report generation completed'
        ],
        executionTime: 300,
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
   * Delete a report
   */
  async deleteReport(
    reportId: string,
    userId: string,
    generator: ReportGeneratorService,
    utils: ReportUtils
  ): Promise<boolean> {
    try {
      const report = await generator.getReportStatus(reportId);
      if (!report) {
        throw new ReportNotFoundError(reportId);
      }

      await utils.checkDeletePermission(report, userId);

      // TODO: Delete from database
      // await this.deleteReportFromDb(reportId);

      if (report.downloadUrl) {
        await generator.deleteReportFile(report.downloadUrl);
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

  /**
   * Get report statistics
   */
  async getReportStatistics(_timeRange: ReportTimeRange = 'last_30_days'): Promise<ReportStatistics> {
    try {
      // TODO: Implement real statistics query
      const mockStats: ReportStatistics = {
        totalReports: 156,
        reportsByType: {
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
          cost_analysis: 12,
          sla_compliance: 8,
          anomaly_detection: 6,
          audit_trail: 4,
          resource_utilization: 3,
          trend_forecast: 7,
          customer_insights: 5,
          channel_integration: 4,
          goal_achievement: 6,
          automation_effectiveness: 3,
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
          { type: 'conversation_summary', count: 45, averageSize: 2.5 * 1024 * 1024 },
          { type: 'agent_performance', count: 32, averageSize: 1.8 * 1024 * 1024 }
        ],
        usageByUser: [
          { userId: 'admin', username: 'Administrator', reportCount: 45, lastGenerated: '2025-09-25T10:00:00.000Z' },
          { userId: 'manager1', username: 'Team Manager 1', reportCount: 28, lastGenerated: '2025-09-24T15:30:00.000Z' }
        ],
        monthlyTrends: [
          { month: '2025-09', reportsGenerated: 45, totalSize: 95 * 1024 * 1024 },
          { month: '2025-08', reportsGenerated: 52, totalSize: 110 * 1024 * 1024 }
        ]
      };

      return mockStats;
    } catch (error) {
      console.error('Get report statistics error:', error);
      throw new ReportGenerationError('Failed to get report statistics');
    }
  }

  /**
   * Batch operations on reports
   */
  async batchOperation(
    operation: BatchReportOperation,
    userId: string,
    generator: ReportGeneratorService,
    utils: ReportUtils
  ): Promise<BatchOperationResult> {
    try {
      const results: BatchOperationResult['results'] = [];

      for (const reportId of operation.reportIds) {
        try {
          const report = await generator.getReportStatus(reportId);
          if (!report) {
            results.push({ reportId, success: false, error: 'Report not found' });
            continue;
          }

          let success = false;
          let downloadUrl: string | undefined;

          switch (operation.action) {
            case 'delete':
              success = await this.deleteReport(reportId, userId, generator, utils);
              break;
            case 'regenerate':
              success = true; // TODO: Implement regeneration
              break;
            case 'download':
              const downloadResult = await generator.downloadReport(reportId, userId, utils);
              success = !!downloadResult;
              downloadUrl = downloadResult?.url;
              break;
            case 'export':
              success = true; // TODO: Implement export
              break;
          }

          results.push({ reportId, success, downloadUrl });
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
}
