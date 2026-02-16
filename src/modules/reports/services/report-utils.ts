// Report Utilities
// Handles validation, templates, previews, and permission checks

import type {
  ReportBase,
  ReportGenerationParams,
  ReportType
} from '../types/report-types';

import {
  ReportAccessDeniedError,
  REPORT_TYPE_CONFIG
} from '../types/report-types';

import { SampleDataGenerators } from './sample-data-generators';

/**
 * Utility methods for report validation, templates, and permissions
 */
export class ReportUtils {
  /**
   * Validate report generation parameters
   */
  async validateReportParams(params: ReportGenerationParams): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic field validation
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

    // Time range validation
    if (params.timeRange === 'custom') {
      if (!params.startDate || !params.endDate) {
        errors.push('Start date and end date are required for custom time range');
      } else {
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          errors.push('Invalid date format');
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get available report templates for a given type
   */
  async getAvailableTemplates(type: ReportType): Promise<Array<{ name: string; description: string; options: any }>> {
    const templates = {
      conversation_summary: [
        {
          name: 'Standard Summary',
          description: 'Basic conversation metrics and trends',
          options: { includeCharts: true, includeSummary: true, includeDetails: false }
        },
        {
          name: 'Detailed Analysis',
          description: 'Comprehensive conversation analysis with detailed breakdowns',
          options: { includeCharts: true, includeSummary: true, includeDetails: true, includeRawData: false }
        }
      ],
      agent_performance: [
        {
          name: 'Performance Overview',
          description: 'Key performance indicators for all agents',
          options: { includeCharts: true, groupBy: ['team', 'agent'], chartType: 'bar' }
        }
      ]
    };

    const templateKey = type as keyof typeof templates;
    return (templateKey in templates ? templates[templateKey] : []) as Array<{ name: string; description: string; options: any }>;
  }

  /**
   * Preview report with sample data
   */
  async previewReport(params: ReportGenerationParams): Promise<any> {
    const sampleData = SampleDataGenerators.getSampleData(params.type);
    if (sampleData === null) {
      return { message: 'Preview not available for this report type' };
    }
    return sampleData;
  }

  /**
   * Check if user has permission to generate/access a report type
   */
  async checkReportPermission(_type: ReportType, _userId: string, _action: string): Promise<void> {
    // TODO: Implement permission checks
    const _requiredPermissions = REPORT_TYPE_CONFIG[_type]?.requiredPermissions || [];
    // Currently allows all operations
  }

  /**
   * Check concurrent report generation limits
   */
  async checkConcurrentGenerations(_userId: string): Promise<void> {
    // TODO: Check concurrent generation limits
  }

  /**
   * Check download permission for a report
   */
  async checkDownloadPermission(report: ReportBase, _userId: string): Promise<void> {
    // TODO: Implement download permission checks
    if (report.createdBy !== _userId) {
      // Check if user has relevant permissions
    }
  }

  /**
   * Check delete permission for a report
   */
  async checkDeletePermission(report: ReportBase, userId: string): Promise<void> {
    // TODO: Implement full permission checks
    if (report.createdBy !== userId) {
      throw new ReportAccessDeniedError('You can only delete your own reports');
    }
  }
}
