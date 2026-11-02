// Report Manager Service
// Handles report CRUD, listing, statistics and batch operations

import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('ReportManager')

import type {
  ReportDetails,
  ReportListQuery,
  ReportViewer,
  ReportListResponse,
  ReportStatistics,
  ReportTimeRange,
  ReportType,
  ReportFilters,
  ReportOptions,
  BatchReportOperation,
  BatchOperationResult,
  ReportGenerationParams
} from '../types/report-types';

import {
  ReportNotFoundError,
  ReportGenerationError,
  ReportAccessDeniedError,
  DEFAULT_REPORT_CONFIG,
  isReportTimeRange
} from '../types/report-types';

import type { ReportGeneratorService } from './report-generator-service';
import type { ReportUtils } from './report-utils';
import { nowISO } from '@/utils/timestamp'
import { mapReportRow } from './report-mapper'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Handles report listing, details, deletion, statistics and batch operations
 */
export class ReportManagerService {
  private db: D1Database;

  constructor(env: Bindings) {
    this.db = env.DB;
  }

  /**
   * List reports with filtering and pagination.
   * Soft-deleted rows never appear. Non-admin viewers see their own reports plus their teams' reports.
   */
  async listReports(query: ReportListQuery, viewer?: ReportViewer): Promise<ReportListResponse> {
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reports } = await import('../../../db/schema');
      const { eq, and, or, gte, lte, lt, isNull, inArray, desc, asc, count, sql } = await import('drizzle-orm');
      const { likeEscaped } = await import('@/utils/sql-like');

      const db = drizzle(this.db);
      const page = query.page || 1;
      const pageSize = Math.min(query.pageSize || 20, DEFAULT_REPORT_CONFIG.maxPageSize);
      const offset = (page - 1) * pageSize;
      const now = nowISO();

      // Visibility scope shared by the list, the total and the summary
      const scopeConditions = [isNull(reports.deletedAt)];
      if (viewer && viewer.role !== 'admin') {
        const own = eq(reports.createdBy, viewer.userId);
        scopeConditions.push(
          viewer.teamIds.length > 0 ? or(own, inArray(reports.teamId, viewer.teamIds))! : own
        );
      }

      const conditions = [...scopeConditions];
      if (query.type) conditions.push(eq(reports.type, query.type));
      if (query.status === 'expired') {
        conditions.push(eq(reports.status, 'completed'), lt(reports.expiresAt, now));
      } else if (query.status === 'completed') {
        conditions.push(
          eq(reports.status, 'completed'),
          or(isNull(reports.expiresAt), gte(reports.expiresAt, now))!
        );
      } else if (query.status) {
        conditions.push(eq(reports.status, query.status));
      }
      if (query.format) conditions.push(eq(reports.format, query.format));
      if (query.createdBy) conditions.push(eq(reports.createdBy, query.createdBy));
      if (query.teamId) conditions.push(eq(reports.teamId, query.teamId));
      if (query.startDate) conditions.push(gte(reports.createdAt, query.startDate));
      if (query.endDate) conditions.push(lte(reports.createdAt, query.endDate));
      if (query.search) conditions.push(likeEscaped(reports.title, query.search));

      const whereClause = and(...conditions);

      const sortColumns = {
        createdAt: reports.createdAt,
        completedAt: reports.completedAt,
        title: reports.title,
        type: reports.type,
        status: reports.status,
        format: reports.format
      } as const;
      const sortColumn = sortColumns[(query.sortBy ?? 'createdAt') as keyof typeof sortColumns] ?? reports.createdAt;
      const direction = query.sortOrder === 'asc' ? asc : desc;

      // One GROUP BY status over the visible set (no search/type filters): the "expired" figure is
      // the part of `completed` that is past expiresAt.
      const [totalResult, reportRecords, statusRows] = await Promise.all([
        db.select({ count: count() }).from(reports).where(whereClause).get(),
        db
          .select()
          .from(reports)
          .where(whereClause)
          .orderBy(direction(sortColumn), desc(reports.id))
          .limit(pageSize)
          .offset(offset)
          .all(),
        db
          .select({
            status: reports.status,
            total: count(),
            expired: sql<number>`coalesce(sum(case when ${reports.status} = 'completed' and ${reports.expiresAt} < ${now} then 1 else 0 end), 0)`
          })
          .from(reports)
          .where(and(...scopeConditions))
          .groupBy(reports.status)
          .all()
      ]);
      const total = totalResult?.count || 0;

      const byStatus = new Map(statusRows.map((row) => [row.status, row]));
      const countOf = (status: string) => Number(byStatus.get(status)?.total ?? 0);
      const expiredReports = Number(byStatus.get('completed')?.expired ?? 0);

      return {
        reports: reportRecords.map(mapReportRow),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1
        },
        summary: {
          totalReports: statusRows.reduce((sum, row) => sum + Number(row.total), 0),
          pendingReports: countOf('pending'),
          generatingReports: countOf('generating'),
          completedReports: countOf('completed') - expiredReports,
          failedReports: countOf('failed'),
          expiredReports
        }
      };
    } catch (error) {
      log.error('List reports error', {}, error as Error);
      throw new ReportGenerationError('Failed to list reports');
    }
  }

  /**
   * Get report details. Everything returned is stored data: timestamps, execution time and the
   * download history table. Reports the viewer cannot see are reported as not found.
   */
  async getReportDetails(
    reportId: string,
    generator: ReportGeneratorService,
    viewer?: ReportViewer
  ): Promise<ReportDetails | null> {
    try {
      const report = await generator.getReportStatus(reportId);
      if (!report) return null;

      if (viewer && viewer.role !== 'admin') {
        const visible = report.createdBy === viewer.userId
          || (report.teamId !== undefined && viewer.teamIds.includes(report.teamId));
        if (!visible) return null;
      }

      const { drizzle } = await import('drizzle-orm/d1');
      const { reports, reportDownloadHistory, agents } = await import('../../../db/schema');
      const { eq, desc } = await import('drizzle-orm');
      const db = drizzle(this.db);

      const [row, downloads] = await Promise.all([
        db
          .select({
            executionTime: reports.executionTime,
            failedAt: reports.failedAt,
            filters: reports.filters
          })
          .from(reports)
          .where(eq(reports.id, reportId))
          .get(),
        db
          .select({
            downloadedAt: reportDownloadHistory.downloadedAt,
            downloadedBy: reportDownloadHistory.downloadedBy,
            downloadedByName: agents.displayName,
            ipAddress: reportDownloadHistory.ipAddress
          })
          .from(reportDownloadHistory)
          .leftJoin(agents, eq(agents.id, reportDownloadHistory.downloadedBy))
          .where(eq(reportDownloadHistory.reportId, reportId))
          .orderBy(desc(reportDownloadHistory.downloadedAt))
          .limit(20)
          .all()
      ]);

      const generationLog = [
        `${report.createdAt} - Report requested`,
        report.startedAt ? `${report.startedAt} - Generation started` : null,
        report.completedAt ? `${report.completedAt} - Generation completed` : null,
        row?.failedAt ? `${row.failedAt} - Generation failed${report.errorMessage ? `: ${report.errorMessage}` : ''}` : null
      ].filter((line): line is string => line !== null);

      let filters: ReportFilters = {};
      if (row?.filters) {
        try {
          const parsed: unknown = JSON.parse(row.filters);
          if (isRecord(parsed)) filters = parsed as ReportFilters;
        } catch {
          // malformed stored filters: report none rather than fail the whole details call
        }
      }

      return {
        ...report,
        generationLog,
        executionTime: row?.executionTime ?? undefined,
        dataSource: { filters },
        downloadHistory: downloads.map((d) => ({
          downloadedAt: d.downloadedAt ?? '',
          downloadedBy: d.downloadedBy,
          downloadedByName: d.downloadedByName ?? undefined,
          ipAddress: d.ipAddress ?? undefined
        }))
      };
    } catch (error) {
      log.error('Get report details error', {}, error as Error);
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
      log.error('Delete report error', {}, error as Error);
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
        popularReports: popR.map(r => ({ type: r.type as ReportType, count: r.cnt, averageSize: Number(r.avgSize) || 0 })),
        usageByUser: userR.map(r => ({ userId: r.userId, username: r.username ?? r.userId, reportCount: r.reportCount, lastGenerated: r.lastGenerated ?? '' })),
        monthlyTrends: trendR.map(r => ({ month: r.month, reportsGenerated: r.reportsGenerated, totalSize: Number(r.totalSize) || 0 })),
      };
    } catch (error) {
      log.error('Get report statistics error', {}, error as Error);
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

          // A report the caller cannot see (not theirs, not their team's, not admin) does not exist for
          // them, whatever the action: regenerate in particular has no permission check of its own.
          try {
            await utils.checkDownloadPermission(report, userId);
          } catch (accessError) {
            if (accessError instanceof ReportAccessDeniedError) {
              results.push({ reportId, success: false, error: 'Report not found' });
              continue;
            }
            throw accessError;
          }

          let success = false;
          let downloadUrl: string | undefined;

          switch (operation.action) {
            case 'delete':
              success = await this.deleteReport(reportId, userId, generator, utils);
              break;
            case 'regenerate': {
              const metadata = report.metadata ?? {};
              const rp: ReportGenerationParams = {
                type: report.type,
                title: report.title,
                format: report.format,
                timeRange: isReportTimeRange(metadata.timeRange) ? metadata.timeRange : 'last_30_days',
                startDate: typeof metadata.startDate === 'string' ? metadata.startDate : undefined,
                endDate: typeof metadata.endDate === 'string' ? metadata.endDate : undefined,
                filters: isRecord(metadata.filters) ? metadata.filters as ReportFilters : undefined,
                options: isRecord(metadata.options) ? metadata.options as ReportOptions : undefined
              };
              await generator.generateReport(rp, userId, utils);
              success = true;
              break;
            }
            case 'download':
              const downloadResult = await generator.downloadReport(reportId, userId, utils);
              success = !!downloadResult;
              downloadUrl = downloadResult?.url;
              break;
            case 'export': {
              const exportResult = await generator.downloadReport(reportId, userId, utils);
              success = !!exportResult;
              downloadUrl = exportResult?.url;
              break;
            }
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
      log.error('Batch operation error', {}, error as Error);
      throw new ReportGenerationError('Failed to execute batch operation');
    }
  }
}
