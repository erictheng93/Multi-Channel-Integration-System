// Reports Service - 統一報表生成服務
// 提供報表模板管理、數據查詢、生成和分發功能

import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '../../../types';
import { drizzle } from 'drizzle-orm/d1';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import type {
  ReportConfig,
  ReportTemplate,
  ReportGenerationResult,
  ReportBatch,
  ReportLibrary,
  ReportQuery,
  ReportExportOptions
} from '../types/reports-types';
import { ReportStatus, GenerationStatus, ReportFormat, DataSourceType } from '@modules/analytics/types/reports-types';
import { AnalyticsError, DataProcessingError } from '@modules/analytics/types/analytics-types';

/**
 * 報表服務配置選項
 */
interface ReportsServiceOptions {
  enableCache?: boolean;
  cacheTimeout?: number; // 緩存超時時間(秒)
  maxConcurrentGeneration?: number; // 最大同時生成數量
  exportDirectory?: string; // 匯出目錄
  enableDistribution?: boolean; // 啟用分發功能
  enableScheduling?: boolean; // 啟用排程功能
  maxReportSize?: number; // 最大報表大小(MB)
  retentionDays?: number; // 報表保留天數
}

const DEFAULT_OPTIONS: ReportsServiceOptions = {
  enableCache: true,
  cacheTimeout: 300, // 5分鐘
  maxConcurrentGeneration: 5,
  exportDirectory: '/tmp/reports',
  enableDistribution: true,
  enableScheduling: true,
  maxReportSize: 100, // 100MB
  retentionDays: 30
};

/**
 * 統一報表服務類
 */
export class ReportsService {
  private analyticsCore: AnalyticsService;
  private dashboardService: DashboardService;
  private options: ReportsServiceOptions;
  private generationQueue = new Map<string, ReportGenerationResult>();
  private cache = new Map<string, { data: any; timestamp: number }>();

  constructor(
    private db: D1Database,
    private kv: Bindings['KV'],
    options: ReportsServiceOptions = {}
  ) {
    this.analyticsCore = new AnalyticsService({
      database: drizzle(db),
      kv,
      env: {} as any,
      cache: {
        enabled: options.enableCache || false,
        ttl: options.cacheTimeout || 3600,
        prefix: 'analytics:'
      }
    });
    this.dashboardService = new DashboardService(db, kv);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 創建報表配置
   */
  async createReport(config: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ReportConfig> {
    try {
      const reportId = this.generateReportId();
      const now = new Date().toISOString();

      const reportConfig: ReportConfig = {
        ...config,
        id: reportId,
        status: ReportStatus.Draft,
        createdAt: now,
        updatedAt: now
      };

      // 驗證報表配置
      await this.validateReportConfig(reportConfig);

      // 保存到 KV 存儲
      const configKey = `report:${reportId}`;
      await this.kv.put(configKey, JSON.stringify(reportConfig), {
        metadata: {
          type: 'report_config',
          createdBy: config.createdBy,
          templateId: config.templateId,
          status: reportConfig.status
        }
      });

      return reportConfig;

    } catch (error) {
      throw new AnalyticsError('Failed to create report configuration', 'REPORT_CREATE_ERROR', 500, error);
    }
  }

  /**
   * 獲取報表配置
   */
  async getReport(reportId: string): Promise<ReportConfig | null> {
    try {
      const configKey = `report:${reportId}`;
      const configData = await this.kv.get(configKey, { type: 'json' });

      return configData as ReportConfig || null;

    } catch (error) {
      throw new AnalyticsError('Failed to get report configuration', 'REPORT_GET_ERROR', 500, error);
    }
  }

  /**
   * 更新報表配置
   */
  async updateReport(reportId: string, updates: Partial<ReportConfig>): Promise<ReportConfig> {
    try {
      const existingConfig = await this.getReport(reportId);
      if (!existingConfig) {
        throw new AnalyticsError(`Report not found: ${reportId}`, 'REPORT_NOT_FOUND', 404);
      }

      const updatedConfig: ReportConfig = {
        ...existingConfig,
        ...updates,
        id: reportId, // 確保 ID 不被更改
        updatedAt: new Date().toISOString()
      };

      await this.validateReportConfig(updatedConfig);

      const configKey = `report:${reportId}`;
      await this.kv.put(configKey, JSON.stringify(updatedConfig), {
        metadata: {
          type: 'report_config',
          createdBy: updatedConfig.createdBy,
          templateId: updatedConfig.templateId,
          status: updatedConfig.status
        }
      });

      return updatedConfig;

    } catch (error) {
      throw new AnalyticsError('Failed to update report configuration', 'REPORT_UPDATE_ERROR', 500, error);
    }
  }

  /**
   * 刪除報表配置
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      const configKey = `report:${reportId}`;
      await this.kv.delete(configKey);

      // 清理相關的生成結果
      await this.cleanupReportGenerations(reportId);

    } catch (error) {
      throw new AnalyticsError('Failed to delete report configuration', 'REPORT_DELETE_ERROR', 500, error);
    }
  }

  /**
   * 查詢報表列表
   */
  async queryReports(query: ReportQuery): Promise<{
    reports: ReportConfig[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const { prefix, limit = 50, offset = 0 } = this.buildQueryOptions(query);

      const listResult = await this.kv.list({
        prefix,
        limit: limit + 1 // 多取一個來判斷是否還有更多
      });

      const reports: ReportConfig[] = [];

      for (const key of listResult.keys.slice(offset, offset + limit)) {
        const reportData = await this.kv.get(key.name, { type: 'json' }) as ReportConfig;
        if (reportData && this.matchesQuery(reportData, query)) {
          reports.push(reportData);
        }
      }

      return {
        reports,
        total: listResult.keys.length,
        hasMore: listResult.keys.length > offset + limit
      };

    } catch (error) {
      throw new AnalyticsError('Failed to query reports', 'REPORT_QUERY_ERROR', 500, error);
    }
  }

  /**
   * 生成報表
   */
  async generateReport(
    reportId: string,
    format: ReportFormat,
    options?: ReportExportOptions
  ): Promise<ReportGenerationResult> {
    try {
      // 檢查並發限制
      if (this.generationQueue.size >= this.options.maxConcurrentGeneration!) {
        throw new AnalyticsError('Maximum concurrent report generation limit reached', 'MAX_CONCURRENT_LIMIT', 429);
      }

      const generationId = this.generateGenerationId();
      const config = await this.getReport(reportId);

      if (!config) {
        throw new AnalyticsError(`Report configuration not found: ${reportId}`, 'REPORT_CONFIG_NOT_FOUND', 404);
      }

      // 創建生成結果記錄
      const generationResult: ReportGenerationResult = {
        id: generationId,
        reportId,
        format,
        status: GenerationStatus.Pending,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system', // TODO: 從上下文獲取用戶信息
        metadata: {
          duration: 0,
          recordCount: 0,
          dataSourcesUsed: [],
          parameters: config.parameters
        }
      };

      // 添加到生成隊列
      this.generationQueue.set(generationId, generationResult);

      // 異步開始生成過程
      this.executeReportGeneration(generationId, config, format, options)
        .catch(error => {
          console.error(`Report generation failed for ${generationId}:`, error);
          const failedResult = this.generationQueue.get(generationId);
          if (failedResult) {
            failedResult.status = GenerationStatus.Failed;
            failedResult.error = error instanceof Error ? error.message : 'Unknown error';
            this.generationQueue.set(generationId, failedResult);
          }
        });

      return generationResult;

    } catch (error) {
      throw new AnalyticsError('Failed to start report generation', 'REPORT_GENERATION_ERROR', 500, error);
    }
  }

  /**
   * 獲取生成狀態
   */
  async getGenerationStatus(generationId: string): Promise<ReportGenerationResult | null> {
    const result = this.generationQueue.get(generationId);
    if (result) {
      return result;
    }

    // 嘗試從 KV 獲取歷史記錄
    try {
      const resultKey = `generation:${generationId}`;
      const resultData = await this.kv.get(resultKey, { type: 'json' });
      return resultData as ReportGenerationResult || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 創建報表模板
   */
  async createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> {
    try {
      const templateId = this.generateTemplateId();
      const now = new Date().toISOString();

      const reportTemplate: ReportTemplate = {
        ...template,
        id: templateId,
        createdAt: now,
        updatedAt: now
      };

      // 驗證模板配置
      await this.validateTemplateConfig(reportTemplate);

      // 保存到 KV 存儲
      const templateKey = `template:${templateId}`;
      await this.kv.put(templateKey, JSON.stringify(reportTemplate), {
        metadata: {
          type: 'report_template',
          category: template.category,
          createdBy: template.createdBy,
          isPublic: template.isPublic
        }
      });

      return reportTemplate;

    } catch (error) {
      throw new AnalyticsError('Failed to create report template', 'TEMPLATE_CREATE_ERROR', 500, error);
    }
  }

  /**
   * 獲取報表模板
   */
  async getTemplate(templateId: string): Promise<ReportTemplate | null> {
    try {
      const templateKey = `template:${templateId}`;
      const templateData = await this.kv.get(templateKey, { type: 'json' });

      return templateData as ReportTemplate || null;

    } catch (error) {
      throw new AnalyticsError('Failed to get report template', 'TEMPLATE_GET_ERROR', 500, error);
    }
  }

  /**
   * 獲取模板列表
   */
  async getTemplates(category?: string, isPublic?: boolean): Promise<ReportTemplate[]> {
    try {
      const listResult = await this.kv.list({ prefix: 'template:' });
      const templates: ReportTemplate[] = [];

      for (const key of listResult.keys) {
        const template = await this.kv.get(key.name, { type: 'json' }) as ReportTemplate;

        if (template &&
            (!category || template.category === category) &&
            (isPublic === undefined || template.isPublic === isPublic)) {
          templates.push(template);
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
      throw new AnalyticsError('Failed to get report templates', 'TEMPLATE_LIST_ERROR', 500, error);
    }
  }

  /**
   * 創建報表批次
   */
  async createBatch(batch: Omit<ReportBatch, 'id' | 'createdAt' | 'status'>): Promise<ReportBatch> {
    try {
      const batchId = this.generateBatchId();
      const now = new Date().toISOString();

      const reportBatch: ReportBatch = {
        ...batch,
        id: batchId,
        status: 'active' as any, // TODO: 修復類型定義
        createdAt: now
      };

      const batchKey = `batch:${batchId}`;
      await this.kv.put(batchKey, JSON.stringify(reportBatch), {
        metadata: {
          type: 'report_batch',
          createdBy: batch.createdBy,
          reportCount: batch.reports.length
        }
      });

      return reportBatch;

    } catch (error) {
      throw new AnalyticsError('Failed to create report batch', 'BATCH_CREATE_ERROR', 500, error);
    }
  }

  /**
   * 批量生成報表
   */
  async generateBatch(batchId: string, format: ReportFormat): Promise<ReportGenerationResult[]> {
    try {
      const batchKey = `batch:${batchId}`;
      const batch = await this.kv.get(batchKey, { type: 'json' }) as ReportBatch;

      if (!batch) {
        throw new AnalyticsError(`Report batch not found: ${batchId}`, 'BATCH_NOT_FOUND', 404);
      }

      const generationPromises = batch.reports.map(reportId =>
        this.generateReport(reportId, format)
      );

      const results = await Promise.all(generationPromises);

      // 更新批次狀態
      batch.status = 'running' as any;
      batch.lastRun = new Date().toISOString();
      await this.kv.put(batchKey, JSON.stringify(batch));

      return results;

    } catch (error) {
      throw new AnalyticsError('Failed to generate report batch', 'BATCH_GENERATION_ERROR', 500, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 匯出報表到指定格式
   */
  async exportReport(
    reportId: string,
    format: ReportFormat,
    options?: ReportExportOptions
  ): Promise<string> {
    try {
      const config = await this.getReport(reportId);
      if (!config) {
        throw new AnalyticsError(`Report configuration not found: ${reportId}`, 'REPORT_CONFIG_NOT_FOUND', 404);
      }

      // 根據格式處理匯出
      switch (format) {
        case ReportFormat.PDF:
          return await this.exportToPDF(config, options);
        case ReportFormat.Excel:
          return await this.exportToExcel(config, options);
        case ReportFormat.CSV:
          return await this.exportToCSV(config, options);
        case ReportFormat.JSON:
          return await this.exportToJSON(config, options);
        case ReportFormat.HTML:
          return await this.exportToHTML(config, options);
        default:
          throw new AnalyticsError(`Unsupported export format: ${format}`, 'UNSUPPORTED_FORMAT');
      }

    } catch (error) {
      throw new AnalyticsError('Failed to export report', 'REPORT_EXPORT_ERROR', 500, error instanceof Error ? error.message : String(error));
    }
  }

  // 私有方法

  /**
   * 執行報表生成
   */
  private async executeReportGeneration(
    generationId: string,
    config: ReportConfig,
    format: ReportFormat,
    options?: ReportExportOptions
  ): Promise<void> {
    const startTime = Date.now();
    const result = this.generationQueue.get(generationId)!;

    try {
      // 更新狀態為進行中
      result.status = GenerationStatus.InProgress;
      this.generationQueue.set(generationId, result);

      // 獲取數據
      const data = await this.fetchReportData(config);

      // 生成報表
      const filePath = await this.generateReportFile(config, data, format, options);

      // 更新完成狀態
      result.status = GenerationStatus.Completed;
      result.filePath = filePath;
      result.downloadUrl = `/api/reports/download/${generationId}`;
      result.metadata.duration = Date.now() - startTime;
      result.metadata.recordCount = Array.isArray(data) ? data.length : 1;

      this.generationQueue.set(generationId, result);

      // 保存到 KV 存儲供後續查詢
      const resultKey = `generation:${generationId}`;
      await this.kv.put(resultKey, JSON.stringify(result), {
        metadata: {
          type: 'generation_result',
          reportId: config.id,
          format,
          status: result.status
        },
        expirationTtl: this.options.retentionDays! * 24 * 60 * 60 // 轉換為秒
      });

    } catch (error) {
      result.status = GenerationStatus.Failed;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.generationQueue.set(generationId, result);
      throw error;
    }
  }

  /**
   * 獲取報表數據
   */
  private async fetchReportData(config: ReportConfig): Promise<any> {
    switch (config.dataSource.type) {
      case DataSourceType.Analytics:
        return await this.fetchAnalyticsData(config);
      case DataSourceType.Dashboard:
        return await this.fetchDashboardData(config);
      case DataSourceType.Database:
        return await this.fetchDatabaseData(config);
      default:
        throw new AnalyticsError(`Unsupported data source type: ${config.dataSource.type}`, 'UNSUPPORTED_DATA_SOURCE');
    }
  }

  /**
   * 從分析服務獲取數據
   */
  private async fetchAnalyticsData(config: ReportConfig): Promise<any> {
    const query = {
      type: config.dataSource.query as any,
      timeRange: config.dataSource.timeRange,
      filters: config.dataSource.filters,
      parameters: config.parameters
    };

    return await this.analyticsCore.query(query);
  }

  /**
   * 從儀表板服務獲取數據
   */
  private async fetchDashboardData(config: ReportConfig): Promise<any> {
    const dashboardId = config.dataSource.query;
    const userId = config.createdBy; // 簡化的用戶 ID 處理

    return await this.dashboardService.getDashboardData(userId, dashboardId, config.dataSource.timeRange);
  }

  /**
   * 從數據庫直接獲取數據
   */
  private async fetchDatabaseData(config: ReportConfig): Promise<any> {
    // 簡化的數據庫查詢實現
    // 實際實現中需要安全的 SQL 查詢處理
    const stmt = this.db.prepare(config.dataSource.query);
    const result = await stmt.all();
    return result.results;
  }

  /**
   * 生成報表文件
   */
  private async generateReportFile(
    config: ReportConfig,
    data: any,
    format: ReportFormat,
    options?: ReportExportOptions
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${config.name}_${timestamp}.${format}`;
    const filePath = `${this.options.exportDirectory}/${fileName}`;

    try {
      switch (format) {
        case 'pdf':
          return await this.exportToPDF(config, data, options);
        case 'excel':
          return await this.exportToExcel(config, data, options);
        case 'csv':
          return await this.exportToCSV(config, data, options);
        case 'json':
          return await this.exportToJSON(config, data, options);
        case 'html':
          return await this.exportToHTML(config, data, options);
        default:
          throw new AnalyticsError(`Unsupported export format: ${format}`, 'UNSUPPORTED_FORMAT');
      }
    } catch (error) {
      console.error(`Failed to generate ${format} report:`, error);
      throw new AnalyticsError(`Failed to generate ${format} report: ${error instanceof Error ? error.message : 'Unknown error'}`, 'REPORT_FILE_GENERATION_ERROR');
    }
  }

  /**
   * 匯出到 PDF
   */
  private async exportToPDF(config: ReportConfig, data: any, options?: ReportExportOptions): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${config.name}_${timestamp}.pdf`;

      // 獲取報表模板
      const template = await this.getTemplate(config.templateId);
      if (!template) {
        throw new AnalyticsError(`Report template not found: ${config.templateId}`, 'TEMPLATE_NOT_FOUND', 404);
      }

      // 生成 HTML 內容
      const htmlContent = await this.generateHTMLFromTemplate(template, data, config);

      // 使用 Cloudflare 的 PDF 生成服務或外部 API
      const pdfBuffer = await this.convertHTMLToPDF(htmlContent, options);

      // 將 PDF 存儲到 Cloudflare R2 或返回 base64
      const fileUrl = await this.storePDFFile(fileName, pdfBuffer);

      console.log(`✅ PDF report generated: ${fileName}`, 'report:pdf:generated');
      return fileUrl;

    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new AnalyticsError(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PDF_GENERATION_ERROR');
    }
  }

  /**
   * 將 HTML 轉換為 PDF
   */
  private async convertHTMLToPDF(htmlContent: string, options?: ReportExportOptions): Promise<ArrayBuffer> {
    try {
      // 方案 1: 使用外部 PDF 生成 API (推薦用於 Cloudflare Workers)
      const pdfApiUrl = 'https://api.htmltopdf.online/v1/generate'; // 示例 API

      const response = await fetch(pdfApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY' // 需要配置 API Key
        },
        body: JSON.stringify({
          html: htmlContent,
          options: {
            format: 'A4',
            orientation: (options as any)?.orientation || 'portrait',
            margin: {
              top: '20mm',
              bottom: '20mm',
              left: '15mm',
              right: '15mm'
            },
            quality: options?.quality || 'high',
            printBackground: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`PDF API responded with status: ${response.status}`);
      }

      return await response.arrayBuffer();

    } catch (error) {
      // 回退方案: 簡單的 PDF 模擬
      console.warn('PDF API failed, using fallback:', error);
      return this.generateFallbackPDF(htmlContent);
    }
  }

  /**
   * 回退的 PDF 生成方案
   */
  private async generateFallbackPDF(htmlContent: string): Promise<ArrayBuffer> {
    // 簡化的 PDF 內容生成
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

5 0 obj
<<
/Length 87
>>
stream
BT
/F1 12 Tf
72 720 Td
(Analytics Report Generated: ${new Date().toLocaleString()}) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000245 00000 n
0000000323 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
460
%%EOF`;

    const encoder = new TextEncoder();
    return encoder.encode(pdfContent).buffer;
  }

  /**
   * 存儲 PDF 文件
   */
  private async storePDFFile(fileName: string, pdfBuffer: ArrayBuffer): Promise<string> {
    try {
      // 如果有 R2 存儲，可以存儲到 R2
      // const r2Key = `reports/pdf/${fileName}`;
      // await this.r2.put(r2Key, pdfBuffer);
      // return `https://your-domain.com/files/${r2Key}`;

      // 暫時返回本地路徑或 base64 URL
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
      return `data:application/pdf;base64,${base64}`;

    } catch (error) {
      console.error('Failed to store PDF file:', error);
      throw new AnalyticsError(`Failed to store PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PDF_STORAGE_ERROR');
    }
  }

  /**
   * 從模板生成 HTML 內容
   */
  private async generateHTMLFromTemplate(template: ReportTemplate, data: any, config: ReportConfig): Promise<string> {
    try {
      // 基本的 HTML 報表模板
      const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <style>
        body {
            font-family: 'Microsoft JhengHei', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 28px;
        }
        .header .subtitle {
            color: #666;
            margin-top: 5px;
            font-size: 14px;
        }
        .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .meta-info div {
            font-size: 14px;
        }
        .meta-info strong {
            color: #007bff;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #007bff;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .data-table th,
        .data-table td {
            border: 1px solid #dee2e6;
            padding: 12px;
            text-align: left;
        }
        .data-table th {
            background-color: #007bff;
            color: white;
            font-weight: bold;
        }
        .data-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 15px;
            text-align: center;
        }
        .metric-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .metric-card .label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        @media print {
            body { margin: 0; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${config.name}</h1>
        <div class="subtitle">${config.description || 'Analytics Report'}</div>
    </div>

    <div class="meta-info">
        <div><strong>生成時間:</strong> ${new Date().toLocaleString('zh-TW')}</div>
        <div><strong>模板:</strong> ${template.name}</div>
        <div><strong>數據範圍:</strong> ${this.formatDateRange(config.parameters)}</div>
        <div><strong>記錄數:</strong> ${Array.isArray(data) ? data.length : 'N/A'}</div>
    </div>

    ${this.generateDataSections(data, template, config)}

    <div class="footer">
        <p>由 Analytics 模組自動生成 | ${new Date().toLocaleString('zh-TW')}</p>
    </div>
</body>
</html>`;

      return htmlTemplate;

    } catch (error) {
      console.error('Failed to generate HTML from template:', error);
      throw new AnalyticsError(`Failed to generate HTML: ${error instanceof Error ? error.message : 'Unknown error'}`, 'HTML_GENERATION_ERROR');
    }
  }

  /**
   * 生成數據區段
   */
  private generateDataSections(data: any, template: ReportTemplate, config: ReportConfig): string {
    if (!data) {
      return '<div class="section"><h2>數據</h2><p>無可用數據</p></div>';
    }

    let sections = '';

    // 如果數據是數組，生成表格
    if (Array.isArray(data) && data.length > 0) {
      sections += this.generateTableSection('數據明細', data);
    }

    // 如果數據是對象，生成指標卡片
    if (typeof data === 'object' && !Array.isArray(data)) {
      sections += this.generateMetricsSection('關鍵指標', data);
    }

    return sections || '<div class="section"><h2>數據</h2><p>無可用數據</p></div>';
  }

  /**
   * 生成表格區段
   */
  private generateTableSection(title: string, data: any[]): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const headerRow = headers.map(header => `<th>${header}</th>`).join('');
    const dataRows = data.map(row =>
      `<tr>${headers.map(header => `<td>${row[header] || '-'}</td>`).join('')}</tr>`
    ).join('');

    return `
    <div class="section">
        <h2>${title}</h2>
        <table class="data-table">
            <thead>
                <tr>${headerRow}</tr>
            </thead>
            <tbody>
                ${dataRows}
            </tbody>
        </table>
    </div>`;
  }

  /**
   * 生成指標區段
   */
  private generateMetricsSection(title: string, data: Record<string, any>): string {
    const metricCards = Object.entries(data).map(([key, value]) => `
        <div class="metric-card">
            <div class="value">${this.formatMetricValue(value)}</div>
            <div class="label">${this.formatMetricLabel(key)}</div>
        </div>
    `).join('');

    return `
    <div class="section">
        <h2>${title}</h2>
        <div class="metric-grid">
            ${metricCards}
        </div>
    </div>`;
  }

  /**
   * 格式化指標值
   */
  private formatMetricValue(value: any): string {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  }

  /**
   * 格式化指標標籤
   */
  private formatMetricLabel(key: string): string {
    // 將 camelCase 轉換為可讀格式
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  /**
   * 格式化日期範圍
   */
  private formatDateRange(parameters: any): string {
    if (parameters?.startDate && parameters?.endDate) {
      return `${parameters.startDate} - ${parameters.endDate}`;
    }
    if (parameters?.timeRange) {
      return parameters.timeRange;
    }
    return '全部';
  }

  /**
   * 匯出到 Excel
   */
  private async exportToExcel(config: ReportConfig, data: any, options?: ReportExportOptions): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${config.name}_${timestamp}.xlsx`;

      // 獲取報表模板
      const template = await this.getTemplate(config.templateId);
      if (!template) {
        throw new AnalyticsError(`Report template not found: ${config.templateId}`, 'TEMPLATE_NOT_FOUND', 404);
      }

      // 生成 Excel 內容
      const excelBuffer = await this.generateExcelContent(template, data, config);

      // 存儲 Excel 文件
      const fileUrl = await this.storeExcelFile(fileName, excelBuffer);

      console.log(`✅ Excel report generated: ${fileName}`, 'report:excel:generated');
      return fileUrl;

    } catch (error) {
      console.error('Excel generation failed:', error);
      throw new AnalyticsError(`Excel generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'EXCEL_GENERATION_ERROR');
    }
  }

  /**
   * 生成 Excel 內容
   */
  private async generateExcelContent(template: ReportTemplate, data: any, config: ReportConfig): Promise<ArrayBuffer> {
    try {
      // 方案 1: 使用外部 Excel 生成 API
      const excelApiUrl = 'https://api.excelgen.com/v1/generate'; // 示例 API

      const excelData = {
        workbook: {
          worksheets: [
            {
              name: '報表數據',
              data: this.prepareExcelData(data, config)
            }
          ]
        },
        formatting: {
          headerStyle: {
            font: { bold: true, color: '#FFFFFF' },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007BFF' } }
          },
          dataStyle: {
            font: { name: 'Microsoft JhengHei' },
            alignment: { horizontal: 'left' }
          }
        }
      };

      const response = await fetch(excelApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_EXCEL_API_KEY' // 需要配置 API Key
        },
        body: JSON.stringify(excelData)
      });

      if (!response.ok) {
        throw new Error(`Excel API responded with status: ${response.status}`);
      }

      return await response.arrayBuffer();

    } catch (error) {
      // 回退方案: 生成 CSV 格式作為 Excel
      console.warn('Excel API failed, generating CSV as fallback:', error);
      return this.generateCSVAsExcel(data, config);
    }
  }

  /**
   * 準備 Excel 數據
   */
  private prepareExcelData(data: any, config: ReportConfig): any[] {
    const excelData = [];

    // 添加報表信息
    excelData.push(['報表名稱', config.name]);
    excelData.push(['生成時間', new Date().toLocaleString('zh-TW')]);
    excelData.push(['描述', config.description || '']);
    excelData.push([]); // 空行

    // 添加數據
    if (Array.isArray(data) && data.length > 0) {
      // 添加表頭
      const headers = Object.keys(data[0]);
      excelData.push(headers);

      // 添加數據行
      data.forEach(row => {
        excelData.push(headers.map(header => row[header] || ''));
      });
    } else if (typeof data === 'object' && data !== null) {
      // 對象數據：轉換為鍵值對
      excelData.push(['項目', '值']);
      Object.entries(data).forEach(([key, value]) => {
        excelData.push([this.formatMetricLabel(key), this.formatMetricValue(value)]);
      });
    } else {
      excelData.push(['數據', '無可用數據']);
    }

    return excelData;
  }

  /**
   * 生成 CSV 作為 Excel 回退方案
   */
  private async generateCSVAsExcel(data: any, config: ReportConfig): Promise<ArrayBuffer> {
    const csvContent = this.generateCSVContent(data, config);

    // 簡單的 Excel 文件結構 (實際上是 CSV 用 Excel MIME type)
    const encoder = new TextEncoder();
    return encoder.encode(csvContent).buffer;
  }

  /**
   * 生成 CSV 內容
   */
  private generateCSVContent(data: any, config: ReportConfig): string {
    let csvContent = '';

    // 添加 BOM 以支持中文
    csvContent += '\uFEFF';

    // 添加報表信息
    csvContent += `報表名稱,${config.name}\n`;
    csvContent += `生成時間,${new Date().toLocaleString('zh-TW')}\n`;
    csvContent += `描述,${config.description || ''}\n`;
    csvContent += '\n'; // 空行

    // 添加數據
    if (Array.isArray(data) && data.length > 0) {
      // 添加表頭
      const headers = Object.keys(data[0]);
      csvContent += headers.join(',') + '\n';

      // 添加數據行
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header] || '';
          // 如果值包含逗號或引號，需要用引號包圍
          if (String(value).includes(',') || String(value).includes('"')) {
            return `"${String(value).replace(/"/g, '""')}"`;
          }
          return String(value);
        });
        csvContent += values.join(',') + '\n';
      });
    } else if (typeof data === 'object' && data !== null) {
      // 對象數據
      csvContent += '項目,值\n';
      Object.entries(data).forEach(([key, value]) => {
        csvContent += `${this.formatMetricLabel(key)},${this.formatMetricValue(value)}\n`;
      });
    } else {
      csvContent += '數據,無可用數據\n';
    }

    return csvContent;
  }

  /**
   * 存儲 Excel 文件
   */
  private async storeExcelFile(fileName: string, excelBuffer: ArrayBuffer): Promise<string> {
    try {
      // 如果有 R2 存儲，可以存儲到 R2
      // const r2Key = `reports/excel/${fileName}`;
      // await this.r2.put(r2Key, excelBuffer, {
      //   httpMetadata: {
      //     contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      //   }
      // });
      // return `https://your-domain.com/files/${r2Key}`;

      // 暫時返回 base64 URL
      const base64 = btoa(String.fromCharCode(...new Uint8Array(excelBuffer)));
      return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

    } catch (error) {
      console.error('Failed to store Excel file:', error);
      throw new AnalyticsError(`Failed to store Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'EXCEL_STORAGE_ERROR');
    }
  }

  /**
   * 匯出到 CSV
   */
  private async exportToCSV(config: ReportConfig, data: any, options?: ReportExportOptions): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${config.name}_${timestamp}.csv`;

      const csvContent = this.generateCSVContent(data, config);

      // 存儲 CSV 文件
      const fileUrl = await this.storeCSVFile(fileName, csvContent);

      console.log(`✅ CSV report generated: ${fileName}`, 'report:csv:generated');
      return fileUrl;

    } catch (error) {
      console.error('CSV generation failed:', error);
      throw new AnalyticsError(`CSV generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CSV_GENERATION_ERROR');
    }
  }

  /**
   * 存儲 CSV 文件
   */
  private async storeCSVFile(fileName: string, csvContent: string): Promise<string> {
    try {
      // 暫時返回 base64 URL
      const encoder = new TextEncoder();
      const csvBuffer = encoder.encode(csvContent);
      const base64 = btoa(String.fromCharCode(...csvBuffer));
      return `data:text/csv;base64,${base64}`;

    } catch (error) {
      console.error('Failed to store CSV file:', error);
      throw new AnalyticsError(`Failed to store CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CSV_STORAGE_ERROR');
    }
  }

  /**
   * 匯出到 JSON
   */
  private async exportToJSON(config: ReportConfig, data: any, options?: ReportExportOptions): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${config.name}_${timestamp}.json`;

      const template = await this.getTemplate(config.templateId);

      const jsonData = {
        reportInfo: {
          name: config.name,
          description: config.description,
          templateName: template?.name || 'Unknown',
          generatedAt: new Date().toISOString(),
          parameters: config.parameters
        },
        data: data,
        metadata: {
          recordCount: Array.isArray(data) ? data.length : 1,
          dataType: Array.isArray(data) ? 'array' : typeof data,
          format: 'json'
        }
      };

      const jsonContent = JSON.stringify(jsonData, null, 2);

      // 存儲 JSON 文件
      const fileUrl = await this.storeJSONFile(fileName, jsonContent);

      console.log(`✅ JSON report generated: ${fileName}`, 'report:json:generated');
      return fileUrl;

    } catch (error) {
      console.error('JSON generation failed:', error);
      throw new AnalyticsError(`JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'JSON_GENERATION_ERROR');
    }
  }

  /**
   * 存儲 JSON 文件
   */
  private async storeJSONFile(fileName: string, jsonContent: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const jsonBuffer = encoder.encode(jsonContent);
      const base64 = btoa(String.fromCharCode(...jsonBuffer));
      return `data:application/json;base64,${base64}`;

    } catch (error) {
      console.error('Failed to store JSON file:', error);
      throw new AnalyticsError(`Failed to store JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'JSON_STORAGE_ERROR');
    }
  }

  /**
   * 匯出到 HTML
   */
  private async exportToHTML(config: ReportConfig, data: any, options?: ReportExportOptions): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${config.name}_${timestamp}.html`;

      const template = await this.getTemplate(config.templateId);
      if (!template) {
        throw new AnalyticsError(`Report template not found: ${config.templateId}`, 'TEMPLATE_NOT_FOUND', 404);
      }

      const htmlContent = await this.generateHTMLFromTemplate(template, data, config);

      // 存儲 HTML 文件
      const fileUrl = await this.storeHTMLFile(fileName, htmlContent);

      console.log(`✅ HTML report generated: ${fileName}`, 'report:html:generated');
      return fileUrl;

    } catch (error) {
      console.error('HTML generation failed:', error);
      throw new AnalyticsError(`HTML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'HTML_GENERATION_ERROR');
    }
  }

  /**
   * 存儲 HTML 文件
   */
  private async storeHTMLFile(fileName: string, htmlContent: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const htmlBuffer = encoder.encode(htmlContent);
      const base64 = btoa(String.fromCharCode(...htmlBuffer));
      return `data:text/html;base64,${base64}`;

    } catch (error) {
      console.error('Failed to store HTML file:', error);
      throw new AnalyticsError(`Failed to store HTML file: ${error instanceof Error ? error.message : 'Unknown error'}`, 'HTML_STORAGE_ERROR');
    }
  }

  /**
   * 驗證報表配置
   */
  private async validateReportConfig(config: ReportConfig): Promise<void> {
    if (!config.name || config.name.trim().length === 0) {
      throw new DataProcessingError('Report name is required');
    }

    if (!config.templateId) {
      throw new DataProcessingError('Template ID is required');
    }

    // 驗證模板是否存在
    const template = await this.getTemplate(config.templateId);
    if (!template) {
      throw new DataProcessingError(`Report template not found: ${config.templateId}`);
    }

    if (!config.dataSource || !config.dataSource.type) {
      throw new DataProcessingError('Data source configuration is required');
    }
  }

  /**
   * 驗證模板配置
   */
  private async validateTemplateConfig(template: ReportTemplate): Promise<void> {
    if (!template.name || template.name.trim().length === 0) {
      throw new DataProcessingError('Template name is required');
    }

    if (!template.sections || template.sections.length === 0) {
      throw new DataProcessingError('Template must have at least one section');
    }
  }

  /**
   * 構建查詢選項
   */
  private buildQueryOptions(query: ReportQuery): { prefix: string; limit: number; offset: number } {
    return {
      prefix: 'report:',
      limit: query.limit || 50,
      offset: query.offset || 0
    };
  }

  /**
   * 檢查報表是否匹配查詢條件
   */
  private matchesQuery(report: ReportConfig, query: ReportQuery): boolean {
    if (query.templateId && report.templateId !== query.templateId) return false;
    if (query.status && report.status !== query.status) return false;
    if (query.createdBy && report.createdBy !== query.createdBy) return false;
    if (query.search && !report.name.toLowerCase().includes(query.search.toLowerCase())) return false;

    return true;
  }

  /**
   * 清理報表生成記錄
   */
  private async cleanupReportGenerations(reportId: string): Promise<void> {
    try {
      const listResult = await this.kv.list({ prefix: 'generation:' });

      for (const key of listResult.keys) {
        const generation = await this.kv.get(key.name, { type: 'json' }) as ReportGenerationResult;
        if (generation && generation.reportId === reportId) {
          await this.kv.delete(key.name);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup report generations:', error);
    }
  }

  /**
   * 生成報表 ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成生成任務 ID
   */
  private generateGenerationId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成模板 ID
   */
  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成批次 ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ReportsService;