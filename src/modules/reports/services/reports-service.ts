// Reports Service — Facade
// Delegates to focused sub-services for generation, management, scheduling, and utilities

import type { Bindings } from '@/types';
import type {
  ReportBase,
  ReportDetails,
  ReportGenerationParams,
  ReportListQuery,
  ReportListResponse,
  ReportStatistics,
  ReportType,
  ReportTimeRange,
  BatchReportOperation,
  BatchOperationResult,
  ScheduledReport,
  ReportsServiceInterface
} from '../types/report-types';

import { ReportGeneratorService } from './report-generator-service';
import { ReportManagerService } from './report-manager-service';
import { ReportSchedulerService } from './report-scheduler-service';
import { ReportUtils } from './report-utils';

/**
 * Reports Service Facade
 * Implements ReportsServiceInterface by delegating to focused sub-services.
 * Each sub-service handles a single responsibility:
 * - ReportGeneratorService: report generation pipeline, data queries, formatting
 * - ReportManagerService: CRUD, listing, statistics, batch operations
 * - ReportSchedulerService: scheduled report lifecycle
 * - ReportUtils: validation, templates, previews, permission checks
 */
export class ReportsService implements ReportsServiceInterface {
  private generator: ReportGeneratorService;
  private manager: ReportManagerService;
  private scheduler: ReportSchedulerService;
  private utils: ReportUtils;

  constructor(env: Bindings) {
    this.generator = new ReportGeneratorService(env);
    this.manager = new ReportManagerService(env);
    this.scheduler = new ReportSchedulerService(env);
    this.utils = new ReportUtils();
  }

  // ======================== Report Generation ========================

  async generateReport(params: ReportGenerationParams, userId: string): Promise<ReportBase> {
    return this.generator.generateReport(params, userId, this.utils);
  }

  async getReportStatus(reportId: string): Promise<ReportBase | null> {
    return this.generator.getReportStatus(reportId);
  }

  async downloadReport(reportId: string, userId: string): Promise<{ url: string; filename: string } | null> {
    return this.generator.downloadReport(reportId, userId, this.utils);
  }

  // ======================== Report Management ========================

  async listReports(query: ReportListQuery): Promise<ReportListResponse> {
    return this.manager.listReports(query);
  }

  async getReportDetails(reportId: string): Promise<ReportDetails | null> {
    return this.manager.getReportDetails(reportId, this.generator);
  }

  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    return this.manager.deleteReport(reportId, userId, this.generator, this.utils);
  }

  // ======================== Statistics ========================

  async getReportStatistics(timeRange: ReportTimeRange = 'last_30_days'): Promise<ReportStatistics> {
    return this.manager.getReportStatistics(timeRange);
  }

  // ======================== Batch Operations ========================

  async batchOperation(operation: BatchReportOperation, userId: string): Promise<BatchOperationResult> {
    return this.manager.batchOperation(operation, userId, this.generator, this.utils);
  }

  // ======================== Scheduled Reports ========================

  async createScheduledReport(
    config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>,
    userId: string
  ): Promise<ScheduledReport> {
    return this.scheduler.createScheduledReport(config, userId);
  }

  async updateScheduledReport(
    id: string,
    updates: Partial<ScheduledReport>,
    userId: string
  ): Promise<ScheduledReport> {
    return this.scheduler.updateScheduledReport(id, updates, userId);
  }

  async deleteScheduledReport(id: string, userId: string): Promise<boolean> {
    return this.scheduler.deleteScheduledReport(id, userId);
  }

  async listScheduledReports(userId?: string): Promise<ScheduledReport[]> {
    return this.scheduler.listScheduledReports(userId);
  }

  // ======================== Utility Methods ========================

  async validateReportParams(params: ReportGenerationParams): Promise<{ valid: boolean; errors: string[] }> {
    return this.utils.validateReportParams(params);
  }

  async getAvailableTemplates(type: ReportType): Promise<Array<{ name: string; description: string; options: any }>> {
    return this.utils.getAvailableTemplates(type);
  }

  async previewReport(params: ReportGenerationParams): Promise<any> {
    return this.utils.previewReport(params);
  }
}
