// Reports API Handler - 報表系統 API 處理器
// 提供統一報表生成、模板管理和分發的 REST API 端點

import { Hono } from 'hono';
import { ReportsService } from '@modules/analytics/services/reports-service';
import { analyticsAuthMiddleware } from '@modules/analytics/middleware/analytics-auth';
import type { Bindings } from '@/types';
import { HTTP_STATUS } from '@/constants/http-status';

// Analytics User interface based on middleware
interface AnalyticsUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  teamId?: string;
  teamName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
import type {
  ReportConfig,
  ReportTemplate,
  ReportQuery,
  ReportFormat,
  ReportExportOptions,
  ReportCategory
} from '../types/reports-types';
import { AnalyticsError } from '@modules/analytics/types/analytics-types';

/**
 * 創建報表應用
 */
const createReportsApp = (reportsService: ReportsService) => {
  const app = new Hono<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>();

  // ✅ CORS 處理已移至 src/index.ts 統一管理
  // 不再需要模組級別的 CORS middleware

  // 驗證中間件
  app.use('/*', analyticsAuthMiddleware);

  // ==================== ROUTE REGISTRATION (Proper Priority Order) ====================
  // Routes MUST be registered in this order to avoid conflicts:
  // 1. STATIC: /health
  // 2. SPECIFIC MULTI-SEGMENT: /reports/generation/:id/status, /reports/download/:id
  // 3. MULTI-SEGMENT PARAMETERIZED: /reports/:reportId/generate, /reports/:reportId/export, /batches/:batchId/generate
  // 4. SINGLE PARAMETERIZED: /reports/:reportId, /templates/:templateId
  // 5. WILDCARD: /reports, /templates, /batches

  // ==================== Priority 1: STATIC routes ====================

  /**
   * 健康檢查端點
   * GET /health
   */
  app.get('/health', async (c) => {
    try {
      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'reports-system',
        features: {
          reportGeneration: 'active',
          templateManagement: 'active',
          batchProcessing: 'active',
          exportFormats: ['pdf', 'excel', 'csv', 'json', 'html']
        }
      });
    } catch (error) {
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'reports-system',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  // ==================== Priority 2: SPECIFIC MULTI-SEGMENT ====================

  /**
   * 獲取生成狀態
   * GET /reports/generation/:generationId/status
   */
  app.get('/reports/generation/:generationId/status', async (c) => {
    try {
      const generationId = c.req.param('generationId');

      const generationResult = await reportsService.getGenerationStatus(generationId);

      if (!generationResult) {
        return c.json({
          success: false,
          error: 'Generation record not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: generationResult
      });

    } catch (error) {
      console.error('Failed to get generation status:', error);
      return c.json({
        success: false,
        error: 'Failed to get generation status'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 下載生成的報表
   * GET /reports/download/:generationId
   */
  app.get('/reports/download/:generationId', async (c) => {
    try {
      const generationId = c.req.param('generationId');

      const generationResult = await reportsService.getGenerationStatus(generationId);

      if (!generationResult || generationResult.status !== 'completed') {
        return c.json({
          success: false,
          error: 'Report generation not completed or not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      // TODO: 實現實際的文件下載邏輯
      // 這裡應該返回文件流或重定向到文件 URL
      return c.json({
        success: true,
        downloadUrl: generationResult.downloadUrl,
        filePath: generationResult.filePath,
        message: 'Use downloadUrl to access the generated report'
      });

    } catch (error) {
      console.error('Failed to download report:', error);
      return c.json({
        success: false,
        error: 'Failed to download report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  // ==================== Priority 3: MULTI-SEGMENT PARAMETERIZED ====================

  /**
   * 生成報表
   * POST /reports/:reportId/generate
   */
  app.post('/reports/:reportId/generate', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const reportId = c.req.param('reportId');
      const { format, options } = await c.req.json();

      const report = await reportsService.getReport(reportId);
      if (!report) {
        return c.json({
          success: false,
          error: 'Report not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查權限
      if (!hasReportAccess(user, report)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to generate this report'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const generationResult = await reportsService.generateReport(reportId, format as ReportFormat, options);

      return c.json({
        success: true,
        data: generationResult,
        message: 'Report generation started successfully'
      });

    } catch (error) {
      console.error('Failed to generate report:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to generate report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 匯出報表
   * POST /reports/:reportId/export
   */
  app.post('/reports/:reportId/export', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const reportId = c.req.param('reportId');
      const { format, options } = await c.req.json();

      const report = await reportsService.getReport(reportId);
      if (!report) {
        return c.json({
          success: false,
          error: 'Report not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查權限
      if (!hasReportAccess(user, report)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to export this report'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const exportPath = await reportsService.exportReport(
        reportId,
        format as ReportFormat,
        options as ReportExportOptions
      );

      return c.json({
        success: true,
        data: {
          exportPath,
          downloadUrl: `/api/reports/files/${encodeURIComponent(exportPath)}`
        },
        message: 'Report exported successfully'
      });

    } catch (error) {
      console.error('Failed to export report:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to export report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 批量生成報表
   * POST /batches/:batchId/generate
   */
  app.post('/batches/:batchId/generate', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const batchId = c.req.param('batchId');
      const { format } = await c.req.json();

      // 檢查權限
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to generate report batches'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const generationResults = await reportsService.generateBatch(batchId, format as ReportFormat);

      return c.json({
        success: true,
        data: generationResults,
        message: 'Batch report generation started successfully'
      });

    } catch (error) {
      console.error('Failed to generate batch:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to generate batch'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  // ==================== Priority 4: SINGLE PARAMETERIZED ====================

  /**
   * 獲取報表配置
   * GET /reports/:reportId
   */
  app.get('/reports/:reportId', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const reportId = c.req.param('reportId');

      const report = await reportsService.getReport(reportId);

      if (!report) {
        return c.json({
          success: false,
          error: 'Report not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查權限
      if (!hasReportAccess(user, report)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to access this report'
        }, HTTP_STATUS.FORBIDDEN);
      }

      return c.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Failed to get report:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to get report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 更新報表配置
   * PUT /reports/:reportId
   */
  app.put('/reports/:reportId', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const reportId = c.req.param('reportId');
      const updates = await c.req.json();

      const existingReport = await reportsService.getReport(reportId);
      if (!existingReport) {
        return c.json({
          success: false,
          error: 'Report not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查編輯權限
      if (!hasReportEditAccess(user, existingReport)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to edit this report'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const updatedReport = await reportsService.updateReport(reportId, updates);

      return c.json({
        success: true,
        data: updatedReport,
        message: 'Report configuration updated successfully'
      });

    } catch (error) {
      console.error('Failed to update report:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to update report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 刪除報表配置
   * DELETE /reports/:reportId
   */
  app.delete('/reports/:reportId', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const reportId = c.req.param('reportId');

      const existingReport = await reportsService.getReport(reportId);
      if (!existingReport) {
        return c.json({
          success: false,
          error: 'Report not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      // 檢查刪除權限
      if (!hasReportDeleteAccess(user, existingReport)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to delete this report'
        }, HTTP_STATUS.FORBIDDEN);
      }

      await reportsService.deleteReport(reportId);

      return c.json({
        success: true,
        message: 'Report configuration deleted successfully'
      });

    } catch (error) {
      console.error('Failed to delete report:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to delete report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 獲取報表模板
   * GET /templates/:templateId
   */
  app.get('/templates/:templateId', async (c) => {
    try {
      const templateId = c.req.param('templateId');

      const template = await reportsService.getTemplate(templateId);

      if (!template) {
        return c.json({
          success: false,
          error: 'Template not found'
        }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: template
      });

    } catch (error) {
      console.error('Failed to get template:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to get template'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  // ==================== Priority 5: WILDCARD (LAST!) ====================

  /**
   * 查詢報表列表
   * GET /reports
   */
  app.get('/reports', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const searchParams = c.req.query();

      const query: ReportQuery = {
        templateId: searchParams.templateId,
        category: searchParams.category as ReportCategory,
        status: searchParams.status as any,
        search: searchParams.search,
        limit: searchParams.limit ? parseInt(searchParams.limit) : undefined,
        offset: searchParams.offset ? parseInt(searchParams.offset) : undefined,
        sortBy: searchParams.sortBy,
        sortOrder: searchParams.sortOrder as 'asc' | 'desc'
      };

      // 如果不是 admin，只能查看自己的報表
      if (user.role !== 'admin') {
        query.createdBy = user.id.toString();
      }

      const result = await reportsService.queryReports(query);

      return c.json({
        success: true,
        data: result.reports,
        pagination: {
          total: result.total,
          hasMore: result.hasMore,
          limit: query.limit || 50,
          offset: query.offset || 0
        }
      });

    } catch (error) {
      console.error('Failed to query reports:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to query reports'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 創建報表配置
   * POST /reports
   */
  app.post('/reports', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const requestData = await c.req.json();

      // 檢查權限
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to create reports'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const reportConfig = {
        ...requestData,
        createdBy: user.id.toString()
      };

      const createdReport = await reportsService.createReport(reportConfig);

      return c.json({
        success: true,
        data: createdReport,
        message: 'Report configuration created successfully'
      });

    } catch (error) {
      console.error('Failed to create report:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to create report'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 獲取模板列表
   * GET /templates
   */
  app.get('/templates', async (c) => {
    try {
      const category = c.req.query('category');
      const isPublic = c.req.query('public') === 'true';

      const templates = await reportsService.getTemplates(category, isPublic);

      return c.json({
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('Failed to get templates:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to get templates'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 創建報表模板
   * POST /templates
   */
  app.post('/templates', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const templateData = await c.req.json();

      // 檢查權限
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to create templates'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const template = {
        ...templateData,
        createdBy: user.id.toString()
      };

      const createdTemplate = await reportsService.createTemplate(template);

      return c.json({
        success: true,
        data: createdTemplate,
        message: 'Report template created successfully'
      });

    } catch (error) {
      console.error('Failed to create template:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to create template'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  /**
   * 創建報表批次
   * POST /batches
   */
  app.post('/batches', async (c) => {
    try {
      const user = c.get('user') as AnalyticsUser;
      const batchData = await c.req.json();

      // 檢查權限
      if (!user || (user.role !== 'admin' && user.role !== 'team')) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to create report batches'
        }, HTTP_STATUS.FORBIDDEN);
      }

      const batch = {
        ...batchData,
        createdBy: user.id.toString()
      };

      const createdBatch = await reportsService.createBatch(batch);

      return c.json({
        success: true,
        data: createdBatch,
        message: 'Report batch created successfully'
      });

    } catch (error) {
      console.error('Failed to create batch:', error);
      return c.json({
        success: false,
        error: error instanceof AnalyticsError ? error.message : 'Failed to create batch'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  });

  // 權限檢查輔助方法
  function hasReportAccess(user: any, report: ReportConfig): boolean {
    if (!user) return false;

    // Admin 可以訪問所有報表
    if (user.role === 'admin') return true;

    // 擁有者可以訪問
    if (report.createdBy === user.id.toString()) return true;

    // 檢查權限列表
    const permissions = report.permissions;
    return permissions.viewers.includes(user.id.toString()) ||
           permissions.editors.includes(user.id.toString());
  }

  function hasReportEditAccess(user: any, report: ReportConfig): boolean {
    if (!user) return false;

    // Admin 可以編輯所有報表
    if (user.role === 'admin') return true;

    // 擁有者可以編輯
    if (report.createdBy === user.id.toString()) return true;

    // 檢查編輯權限
    return report.permissions.editors.includes(user.id.toString());
  }

  function hasReportDeleteAccess(user: any, report: ReportConfig): boolean {
    if (!user) return false;

    // 只有 Admin 和擁有者可以刪除
    return user.role === 'admin' || report.createdBy === user.id.toString();
  }

  return app;
};

// 導出工廠函數
export const createReportsHandler = (reportsService: ReportsService) => {
  return createReportsApp(reportsService);
};

// 為了向後兼容，也導出一個默認的處理器創建函數
export const reportsHandler = new Hono<{ Bindings: Bindings; Variables: { user: AnalyticsUser } }>()
  .use('*', async (c, next) => {
    const reportsService = new ReportsService(c.env.DB, c.env.KV as any);
    const handler = createReportsHandler(reportsService);

    return handler.fetch(c.req.raw, c.env, c.executionCtx);
  });

export default reportsHandler;
