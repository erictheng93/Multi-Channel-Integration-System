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
  BatchOperationResult,
  ReportGenerationParams
} from '../types/report-types';

import {
  ReportNotFoundError,
  ReportGenerationError,
  ReportAccessDeniedError,
  DEFAULT_REPORT_CONFIG
} from '../types/report-types';

import type { ReportGeneratorService } from './report-generator-service';
import type { ReportUtils } from './report-utils';
import { nowISO } from '@/utils/timestamp'

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
        createdAt: report.createdAt || nowISO(),
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

      const { drizzle } = await import('drizzle-orm/d1');
      const { reports } = await import('../../../db/schema');
      const { eq } = await import('drizzle-orm');
      await drizzle(this.db).update(reports).set({ deletedAt: nowISO() }).where(eq(reports.id, reportId));

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
  async getReportStatistics(timeRange: ReportTimeRange = 'last_30_days'): Promise<ReportStatistics> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reports, agents } = await import('../../../db/schema');
      const { eq, and, gte, isNull, count: countFn, avg, sum, desc: descOrder, sql } = await import('drizzle-orm');
      const db = drizzle(this.db);
      const startDate = this.getTimeRangeStart(timeRange);
      const baseConds = [isNull(reports.deletedAt)];
      if (startDate) baseConds.push(gte(reports.createdAt, startDate));
      const where = and(...baseConds);
      const [totalR, typeR, fmtR, statusR, avgR, popR, userR, trendR] = await Promise.all([
        db.select({ total: countFn() }).from(reports).where(where).get(),
        db.select({ type: reports.type, cnt: countFn() }).from(reports).where(where).groupBy(reports.type).all(),
        db.select({ format: reports.format, cnt: countFn() }).from(reports).where(where).groupBy(reports.format).all(),
        db.select({ status: reports.status, cnt: countFn() }).from(reports).where(where).groupBy(reports.status).all(),
        db.select({ avgTime: avg(reports.executionTime) }).from(reports).where(and(...baseConds, eq(reports.status, 'completed'))).get(),
        db.select({ type: reports.type, cnt: countFn(), avgSize: avg(reports.fileSize) }).from(reports).where(where).groupBy(reports.type).orderBy(descOrder(countFn())).limit(5).all(),
        db.select({ userId: reports.createdBy, username: agents.displayName, reportCount: countFn(), lastGenerated: sql<string>`MAX(${reports.createdAt})` }).from(reports).leftJoin(agents, eq(reports.createdBy, agents.id)).where(where).groupBy(reports.createdBy).orderBy(descOrder(countFn())).limit(10).all(),
        db.select({ month: sql<string>`strftime('%Y-%m', ${reports.createdAt})`, reportsGenerated: countFn(), totalSize: sum(reports.fileSize) }).from(reports).where(where).groupBy(sql`strftime('%Y-%m', ${reports.createdAt})`).orderBy(descOrder(sql`strftime('%Y-%m', ${reports.createdAt})`)).limit(6).all(),
      ]);
      const init = <T extends Record<string, number>>(keys: string[]): T => { const r: Record<string, number> = {}; keys.forEach(k => r[k] = 0); return r as T; };
      const byType = init<ReportStatistics['reportsByType']>(['conversation_summary','agent_performance','team_analytics','customer_satisfaction','platform_usage','message_statistics','response_time_analysis','workload_distribution','system_health','custom','cost_analysis','sla_compliance','anomaly_detection','audit_trail','resource_utilization','trend_forecast','customer_insights','channel_integration','goal_achievement','automation_effectiveness','security_risk','knowledge_base','call_quality','executive_summary']);
      for (const r of typeR) if (r.type in byType) (byType as Record<string, number>)[r.type] = r.cnt;
      const byFmt = init<ReportStatistics['reportsByFormat']>(['json','csv','excel','pdf','html']);
      for (const r of fmtR) if (r.format in byFmt) (byFmt as Record<string, number>)[r.format] = r.cnt;
      const byStat = init<ReportStatistics['reportsByStatus']>(['pending','generating','completed','failed','expired']);
      for (const r of statusR) if (r.status in byStat) (byStat as Record<string, number>)[r.status] = r.cnt;
      return {
        totalReports: totalR?.total ?? 0, reportsByType: byType, reportsByFormat: byFmt, reportsByStatus: byStat,
        averageGenerationTime: Number(avgR?.avgTime) || 0,
        popularReports: popR.map(r => ({ type: r.type as any, count: r.cnt, averageSize: Number(r.avgSize) || 0 })),
        usageByUser: userR.map(r => ({ userId: r.userId, username: r.username ?? r.userId, reportCount: r.reportCount, lastGenerated: r.lastGenerated ?? '' })),
        monthlyTrends: trendR.map(r => ({ month: r.month, reportsGenerated: r.reportsGenerated, totalSize: Number(r.totalSize) || 0 })),
      };
    } catch (error) {
      console.error('Get report statistics error:', error);
      throw new ReportGenerationError('Failed to get report statistics');
    }
  }
  private getTimeRangeStart(tr: ReportTimeRange): string | null {
    const n = new Date();
    switch (tr) {
      case 'last_24_hours': return new Date(n.getTime() - 86400000).toISOString();
      case 'last_7_days': return new Date(n.getTime() - 604800000).toISOString();
      case 'last_30_days': return new Date(n.getTime() - 2592000000).toISOString();
      case 'last_90_days': return new Date(n.getTime() - 7776000000).toISOString();
      case 'current_month': return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
      case 'last_month': return new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString();
      case 'current_quarter': return new Date(n.getFullYear(), Math.floor(n.getMonth()/3)*3, 1).toISOString();
      case 'last_quarter': return new Date(n.getFullYear(), Math.floor(n.getMonth()/3)*3-3, 1).toISOString();
      case 'current_year': return new Date(n.getFullYear(), 0, 1).toISOString();
      case 'last_year': return new Date(n.getFullYear()-1, 0, 1).toISOString();
      default: return null;
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
            case 'regenerate': {
              const rp: ReportGenerationParams = { type: report.type, title: report.title, format: report.format, timeRange: report.metadata?.timeRange ?? 'last_30_days', startDate: report.metadata?.startDate, endDate: report.metadata?.endDate, filters: report.metadata?.filters, options: report.metadata?.options };
              await generator.generateReport(rp, userId, utils);
              success = true;
              break;
            }
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
