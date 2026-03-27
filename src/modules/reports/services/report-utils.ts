// Report Utilities — validation, templates, previews, permission checks

import type { ReportBase, ReportGenerationParams, ReportType } from '../types/report-types';
import { ReportAccessDeniedError, REPORT_TYPE_CONFIG, DEFAULT_REPORT_CONFIG } from '../types/report-types';
import { SampleDataGenerators } from './sample-data-generators';
import logger from '@/utils/logger';

export class ReportUtils {
  private db: D1Database | null;
  constructor(db?: D1Database) { this.db = db ?? null; }

  async validateReportParams(params: ReportGenerationParams): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!params.type) errors.push('Report type is required');
    else if (!Object.keys(REPORT_TYPE_CONFIG).includes(params.type)) errors.push('Invalid report type');
    if (!params.title || params.title.length < 1) errors.push('Report title is required');
    else if (params.title.length > 200) errors.push('Report title too long (max 200 characters)');
    if (!params.format) errors.push('Report format is required');
    else if (params.type && REPORT_TYPE_CONFIG[params.type]) {
      if (!REPORT_TYPE_CONFIG[params.type].supportedFormats.includes(params.format)) errors.push(`Format '${params.format}' not supported for report type '${params.type}'`);
    }
    if (params.timeRange === 'custom') {
      if (!params.startDate || !params.endDate) errors.push('Start date and end date are required for custom time range');
      else { const s = new Date(params.startDate); const e = new Date(params.endDate); if (isNaN(s.getTime()) || isNaN(e.getTime())) errors.push('Invalid date format'); }
    }
    return { valid: errors.length === 0, errors };
  }

  async getAvailableTemplates(type: ReportType): Promise<Array<{ name: string; description: string; options: any }>> {
    const templates = {
      conversation_summary: [
        { name: 'Standard Summary', description: 'Basic conversation metrics and trends', options: { includeCharts: true, includeSummary: true, includeDetails: false } },
        { name: 'Detailed Analysis', description: 'Comprehensive conversation analysis', options: { includeCharts: true, includeSummary: true, includeDetails: true, includeRawData: false } }
      ],
      agent_performance: [
        { name: 'Performance Overview', description: 'Key performance indicators for all agents', options: { includeCharts: true, groupBy: ['team', 'agent'], chartType: 'bar' } }
      ]
    };
    const k = type as keyof typeof templates;
    return (k in templates ? templates[k] : []) as Array<{ name: string; description: string; options: any }>;
  }

  async previewReport(params: ReportGenerationParams): Promise<any> {
    const d = SampleDataGenerators.getSampleData(params.type);
    return d === null ? { message: 'Preview not available for this report type' } : d;
  }

  async checkReportPermission(type: ReportType, userId: string, action: string): Promise<void> {
    const config = REPORT_TYPE_CONFIG[type];
    if (!config) throw new ReportAccessDeniedError(`Unknown report type: ${type}`);
    const role = await this.getUserRole(userId);
    if (role === 'admin') return;
    const adminOnly = ['reports.system.view', 'reports.custom.create'];
    if (config.requiredPermissions.some(p => adminOnly.includes(p)))
      throw new ReportAccessDeniedError(`Report type '${type}' requires admin permissions (action: ${action})`);
  }

  async checkConcurrentGenerations(userId: string): Promise<void> {
    if (!this.db) return;
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { reports } = await import('../../../db/schema');
      const { eq, and, count } = await import('drizzle-orm');
      const result = await drizzle(this.db).select({ n: count() }).from(reports).where(and(eq(reports.createdBy, userId), eq(reports.status, 'generating'))).get();
      if ((result?.n ?? 0) >= DEFAULT_REPORT_CONFIG.maxConcurrentGenerations)
        throw new ReportAccessDeniedError(`Concurrent generation limit reached (${DEFAULT_REPORT_CONFIG.maxConcurrentGenerations}). Please wait for current reports to complete.`);
    } catch (error) {
      if (error instanceof ReportAccessDeniedError) throw error;
      logger.warn('Failed to check concurrent generations, allowing operation');
    }
  }

  async checkDownloadPermission(report: ReportBase, userId: string): Promise<void> {
    if (report.createdBy === userId) return;
    if ((await this.getUserRole(userId)) === 'admin') return;
    if (this.db && report.teamId) {
      try {
        const { drizzle } = await import('drizzle-orm/d1');
        const { agentTeams } = await import('../../../db/schema');
        const { eq, and } = await import('drizzle-orm');
        const m = await drizzle(this.db).select({ agentId: agentTeams.agentId }).from(agentTeams).where(and(eq(agentTeams.agentId, userId), eq(agentTeams.teamId, report.teamId))).get();
        if (m) return;
      } catch { /* fall through */ }
    }
    throw new ReportAccessDeniedError('You do not have permission to download this report');
  }

  async checkDeletePermission(report: ReportBase, userId: string): Promise<void> {
    if (report.createdBy === userId) return;
    if ((await this.getUserRole(userId)) === 'admin') return;
    throw new ReportAccessDeniedError('You can only delete your own reports');
  }

  private async getUserRole(userId: string): Promise<'admin' | 'agent'> {
    if (!this.db) return 'agent';
    try {
      const { drizzle } = await import('drizzle-orm/d1');
      const { agents } = await import('../../../db/schema');
      const { eq } = await import('drizzle-orm');
      const u = await drizzle(this.db).select({ role: agents.role }).from(agents).where(eq(agents.id, userId)).get();
      return u?.role === 'admin' ? 'admin' : 'agent';
    } catch {
      logger.warn('Failed to look up user role, defaulting to agent');
      return 'agent';
    }
  }
}
