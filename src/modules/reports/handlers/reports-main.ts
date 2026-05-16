// Reports 主要處理器
// Main reports request handlers with comprehensive reporting operations

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('ReportsMain')

import type { Bindings } from '@/types';
import { ReportsService } from '@modules/reports/services/reports-service';
import {
  REPORT_TYPE_CONFIG,
  GENERATABLE_REPORT_FORMATS,
  GENERATABLE_REPORT_TYPES,
  ReportGenerationParams,
  BatchReportOperation,
  ReportType,
  ReportTimeRange,
  ScheduledReport,
  isReportTimeRange
} from '@modules/reports/types/report-types';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';

// 中間件導入
import {
  checkReportsAccess,
  checkReportsViewPermission,
  checkReportsGeneratePermission,
  checkReportsDownloadPermission,
  checkReportsDeletePermission,
  checkReportsStatsPermission,
  checkReportsBatchPermission,
  checkScheduledReportsPermission,
  checkSpecialReportTypePermission,
  validateRequestSize,
  validateRateLimit,
  validateReportId,
  validateScheduledReportId,
  validateReportGenerationParams,
  validateReportListQuery,
  validateBatchReportOperation,
  validateScheduledReportData,
  validateReportPreviewRequest,
  logReportsOperation
} from '../middleware/index';
import { nowISO } from '@/utils/timestamp'

// 創建報告路由實例
const reportsHandler = new Hono<{ Bindings: Bindings }>();

// ======================== 健康檢查和資訊端點 ========================

/**
 * 健康檢查端點
 * GET /api/reports/health
 */
reportsHandler.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'reports',
    timestamp: nowISO(),
    version: '1.0.0'
  });
});

/**
 * 模組資訊端點
 * GET /api/reports/info
 */
reportsHandler.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'reports',
      version: '1.0.0',
      description: 'Comprehensive reporting system with multiple report types and export formats',
      features: [
        `Report generation (${GENERATABLE_REPORT_TYPES.length} production-backed types: ${GENERATABLE_REPORT_TYPES.join(', ')})`,
        `Export formats (${GENERATABLE_REPORT_FORMATS.join(', ')})`,
        'Scheduled reports with automated delivery',
        'Batch operations for report management',
        'Report preview functionality',
        'Statistical analysis and reporting',
        'Advanced filtering and customization',
        'Real-time report status tracking',
        'Report templates and presets',
        'Download history and access control'
      ],
      reportTypes: GENERATABLE_REPORT_TYPES.map((type) => `${type} - ${REPORT_TYPE_CONFIG[type].name}`),
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST / - Generate report',
        'GET / - List reports',
        'GET /:id - Get report details',
        'GET /:id/download - Download report',
        'DELETE /:id - Delete report',
        'GET /stats - Report statistics',
        'POST /batch - Batch operations',
        'GET /templates/:type - Get report templates',
        'POST /preview - Preview report',
        'POST /scheduled - Create scheduled report',
        'GET /scheduled - List scheduled reports',
        'PUT /scheduled/:id - Update scheduled report',
        'DELETE /scheduled/:id - Delete scheduled report'
      ],
      permissions: {
        admin: 'Full report management access including system health and custom reports',
        team: 'Team-scoped report generation, analytics, and scheduled reports',
        agent: 'Basic report access for assigned conversations and personal performance'
      }
    },
    timestamp: nowISO()
  });
});

// ======================== 報告生成與管理 ========================

/**
 * 生成報告
 * POST /api/reports
 */
reportsHandler.post(
  '/',
  validateRequestSize,
  checkReportsAccess,
  validateRateLimit,
  validateReportGenerationParams,
  checkReportsGeneratePermission,
  checkSpecialReportTypePermission,
  logReportsOperation,
  async (c) => {
    try {
      const reportParams = c.get('reportParams');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const report = await reportsService.generateReport(reportParams as unknown as ReportGenerationParams, String(String(payload.userId)));

      return c.json({
        success: true,
        data: report,
        message: 'Report generation started successfully',
        estimatedTime: `${(reportParams as unknown as ReportGenerationParams).type ? REPORT_TYPE_CONFIG[(reportParams as unknown as ReportGenerationParams).type]?.estimatedGenerationTime || 60 : 60} seconds`,
        timestamp: nowISO()
      }, HTTP_STATUS.CREATED);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 獲取報告列表
 * GET /api/reports
 */
reportsHandler.get(
  '/',
  validateReportListQuery,
  checkReportsAccess,
  checkReportsViewPermission,
  async (c) => {
    try {
      const query = c.get('reportQuery');
      const reportsService = new ReportsService(c.env);

      const result = await reportsService.listReports(query);

      return c.json({
        success: true,
        data: result,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 獲取單個報告詳情
 * GET /api/reports/:id
 */
reportsHandler.get(
  '/:id',
  validateReportId,
  checkReportsAccess,
  checkReportsViewPermission,
  async (c) => {
    try {
      const reportId = c.get('reportId');
      const reportsService = new ReportsService(c.env);

      const report = await reportsService.getReportDetails(String(reportId));

      if (!report) {
        return c.json({
          success: false,
          error: 'Report not found',
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: report,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 下載報告
 * GET /api/reports/:id/download
 */
reportsHandler.get(
  '/:id/download',
  validateReportId,
  checkReportsAccess,
  validateRateLimit,
  checkReportsDownloadPermission,
  logReportsOperation,
  async (c) => {
    try {
      const reportId = c.get('reportId');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const downloadInfo = await reportsService.downloadReport(String(reportId), String(payload.userId));

      if (!downloadInfo) {
        return c.json({
          success: false,
          error: 'Report not found or not ready for download',
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      const headers = new Headers({
        'Content-Type': downloadInfo.contentType,
        'Content-Disposition': `attachment; filename="${downloadInfo.filename}"`,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff'
      });
      if (downloadInfo.fileSize !== undefined) {
        headers.set('Content-Length', downloadInfo.fileSize.toString());
      }

      return new Response(downloadInfo.body, {
        status: HTTP_STATUS.OK,
        headers
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 刪除報告
 * DELETE /api/reports/:id
 */
reportsHandler.delete(
  '/:id',
  validateReportId,
  checkReportsAccess,
  validateRateLimit,
  checkReportsDeletePermission,
  logReportsOperation,
  async (c) => {
    try {
      const reportId = c.get('reportId');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const success = await reportsService.deleteReport(String(reportId), String(payload.userId));

      if (!success) {
        return c.json({
          success: false,
          error: 'Report not found or could not be deleted',
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        message: 'Report deleted successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ======================== 統計分析 ========================

/**
 * 獲取報告統計
 * GET /api/reports/stats
 */
reportsHandler.get(
  '/stats',
  checkReportsAccess,
  checkReportsStatsPermission,
  async (c) => {
    try {
      const requestedTimeRange = c.req.query('timeRange');
      const timeRange: ReportTimeRange = isReportTimeRange(requestedTimeRange)
        ? requestedTimeRange
        : 'last_30_days';
      const reportsService = new ReportsService(c.env);

      const stats = await reportsService.getReportStatistics(timeRange);

      return c.json({
        success: true,
        data: stats,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ======================== 批量操作 ========================

/**
 * 執行批量報告操作
 * POST /api/reports/batch
 */
reportsHandler.post(
  '/batch',
  validateRequestSize,
  checkReportsAccess,
  validateRateLimit,
  validateBatchReportOperation,
  checkReportsBatchPermission,
  logReportsOperation,
  async (c) => {
    try {
      const batchOperation = c.get('batchOperation');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const result = await reportsService.batchOperation(batchOperation as unknown as BatchReportOperation, String(payload.userId));

      return c.json({
        success: true,
        data: result,
        message: `Batch operation ${batchOperation.action} completed`,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ======================== 報告模板和預覽 ========================

/**
 * 獲取報告模板
 * GET /api/reports/templates/:type
 */
reportsHandler.get(
  '/templates/:type',
  checkReportsAccess,
  checkReportsViewPermission,
  async (c) => {
    try {
      const reportType = c.req.param('type');
      const reportsService = new ReportsService(c.env);

      // Type-safe check for valid report type
      const isValidReportType = reportType && (reportType in REPORT_TYPE_CONFIG);
      if (!isValidReportType) {
        return c.json({
          success: false,
          error: 'Invalid report type',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const templates = await reportsService.getAvailableTemplates(reportType as ReportType);

      return c.json({
        success: true,
        data: templates,
        reportType,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 預覽報告
 * POST /api/reports/preview
 */
reportsHandler.post(
  '/preview',
  validateRequestSize,
  validateReportPreviewRequest,
  checkReportsAccess,
  checkReportsViewPermission,
  async (c) => {
    try {
      const previewParams = c.get('previewParams');
      const reportsService = new ReportsService(c.env);

      const previewData = await reportsService.previewReport(previewParams as unknown as ReportGenerationParams);

      return c.json({
        success: true,
        data: previewData,
        message: 'Report preview generated successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ======================== 排程報告管理 ========================

/**
 * 創建排程報告
 * POST /api/reports/scheduled
 */
reportsHandler.post(
  '/scheduled',
  validateRequestSize,
  checkReportsAccess,
  validateRateLimit,
  validateScheduledReportData,
  checkScheduledReportsPermission,
  logReportsOperation,
  async (c) => {
    try {
      const scheduledReportData = c.get('scheduledReportData');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const scheduledReport = await reportsService.createScheduledReport(
        scheduledReportData as Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>,
        String(String(payload.userId))
      );

      return c.json({
        success: true,
        data: scheduledReport,
        message: 'Scheduled report created successfully',
        timestamp: nowISO()
      }, HTTP_STATUS.CREATED);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 獲取排程報告列表
 * GET /api/reports/scheduled
 */
reportsHandler.get(
  '/scheduled',
  checkReportsAccess,
  checkScheduledReportsPermission,
  async (c) => {
    try {
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      // Admin 可以查看所有，其他角色只能查看自己的
      const userId = payload.role === 'admin' ? undefined : String(payload.userId);
      const scheduledReports = await reportsService.listScheduledReports(userId ? String(userId) : undefined);

      return c.json({
        success: true,
        data: scheduledReports,
        count: scheduledReports.length,
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 更新排程報告
 * PUT /api/reports/scheduled/:id
 */
reportsHandler.put(
  '/scheduled/:id',
  validateRequestSize,
  validateScheduledReportId,
  checkReportsAccess,
  validateRateLimit,
  validateScheduledReportData,
  checkScheduledReportsPermission,
  logReportsOperation,
  async (c) => {
    try {
      const scheduledReportId = c.get('scheduledReportId');
      const scheduledReportData = c.get('scheduledReportData');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const updatedReport = await reportsService.updateScheduledReport(
        String(scheduledReportId),
        scheduledReportData as Partial<ScheduledReport>,
        String(String(payload.userId))
      );

      return c.json({
        success: true,
        data: updatedReport,
        message: 'Scheduled report updated successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

/**
 * 刪除排程報告
 * DELETE /api/reports/scheduled/:id
 */
reportsHandler.delete(
  '/scheduled/:id',
  validateScheduledReportId,
  checkReportsAccess,
  validateRateLimit,
  checkScheduledReportsPermission,
  logReportsOperation,
  async (c) => {
    try {
      const scheduledReportId = c.get('scheduledReportId');
      const payload = c.get('jwtPayload');
      const reportsService = new ReportsService(c.env);

      const success = await reportsService.deleteScheduledReport(String(scheduledReportId), String(String(payload.userId)));

      if (!success) {
        return c.json({
          success: false,
          error: 'Scheduled report not found or could not be deleted',
          timestamp: nowISO()
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        message: 'Scheduled report deleted successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
);

// ======================== 錯誤處理 ========================

// 全域錯誤處理
reportsHandler.onError((err, c) => {
  log.error('Reports handler error', {}, err as Error);
  return c.json({
    success: false,
    error: 'Internal server error in reports module',
    timestamp: nowISO()
  }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
});

// 404 處理
reportsHandler.notFound((c) => {
  return c.json({
    success: false,
    error: 'Reports endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /info',
      'POST /',
      'GET /',
      'GET /:id',
      'GET /:id/download',
      'DELETE /:id',
      'GET /stats',
      'POST /batch',
      'GET /templates/:type',
      'POST /preview',
      'POST /scheduled',
      'GET /scheduled',
      'PUT /scheduled/:id',
      'DELETE /scheduled/:id'
    ],
    timestamp: nowISO()
  }, HTTP_STATUS.NOT_FOUND);
});

export default reportsHandler;
