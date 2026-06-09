// 報表系統 API 客戶端
// Reports API client with comprehensive types and error handling

import type {
  ReportType,
  ReportFormat,
  ReportTimeRange,
  ReportGenerationParams,
  ReportBase,
  ReportDetails,
  ReportListQuery,
  ReportListResponse,
  ReportStatistics,
  BatchReportOperation,
  BatchOperationResult,
  ScheduledReport,
  // ScheduledReportExecution
} from '@/types/reports';

import { reportContracts } from '@shared/api-contracts'
import { callApiContract } from './contract-client'

/**
 * 報表 API 客戶端類
 */
export class ReportsAPI {
  /**
   * 健康檢查
   */
  static async healthCheck(): Promise<{ status: string; module: string; timestamp: string }> {
    const response = await callApiContract(reportContracts.health, {});
    return response.data as { status: string; module: string; timestamp: string };
  }

  /**
   * 獲取模組資訊
   */
  static async getModuleInfo(): Promise<{
    module: string;
    version: string;
    description: string;
    features: string[];
    reportTypes: string[];
    endpoints: string[];
    permissions: Record<string, string>;
  }> {
    const response = await callApiContract(reportContracts.info, {});
    return (response.data as { data: {
      module: string;
      version: string;
      description: string;
      features: string[];
      reportTypes: string[];
      endpoints: string[];
      permissions: Record<string, string>;
    } }).data;
  }

  /**
   * 生成報表
   */
  static async generateReport(params: ReportGenerationParams): Promise<ReportBase> {
    const response = await callApiContract(reportContracts.generate, {}, params);
    return (response.data as { data: ReportBase }).data;
  }

  /**
   * 獲取報表列表
   */
  static async listReports(query: ReportListQuery = {}): Promise<ReportListResponse> {
    const response = await callApiContract(reportContracts.list, query);
    return (response.data as { data: ReportListResponse }).data;
  }

  /**
   * 獲取單個報表詳情
   */
  static async getReportDetails(reportId: string): Promise<ReportDetails> {
    const response = await callApiContract(reportContracts.details, { reportId });
    return (response.data as { data: ReportDetails }).data;
  }

  /**
   * 獲取報表狀態
   */
  static async getReportStatus(reportId: string): Promise<ReportBase> {
    return this.getReportDetails(reportId);
  }

  /**
   * 下載報表
   */
  static async downloadReport(reportId: string): Promise<{ blob: Blob; filename: string; contentType: string }> {
    return callApiContract(reportContracts.download, { reportId });
  }

  /**
   * 讀取 JSON 報表內容供預覽使用
   */
  static async getReportJsonContent(reportId: string): Promise<Record<string, unknown>> {
    const download = await this.downloadReport(reportId);
    if (!download.contentType.includes('application/json')) {
      throw new Error('Report content is not JSON');
    }

    return JSON.parse(await download.blob.text()) as Record<string, unknown>;
  }

  /**
   * 刪除報表
   */
  static async deleteReport(reportId: string): Promise<{ success: boolean; message: string }> {
    const response = await callApiContract(reportContracts.delete, { reportId });
    return response.data as { success: boolean; message: string };
  }

  /**
   * 獲取報表統計
   */
  static async getReportStatistics(timeRange: ReportTimeRange = 'last_30_days'): Promise<ReportStatistics> {
    const response = await callApiContract(reportContracts.stats, { timeRange });
    return (response.data as { data: ReportStatistics }).data;
  }

  /**
   * 批量操作
   */
  static async batchOperation(operation: BatchReportOperation): Promise<BatchOperationResult> {
    const response = await callApiContract(reportContracts.batch, {}, operation);
    return (response.data as { data: BatchOperationResult }).data;
  }

  /**
   * 獲取報表模板
   */
  static async getReportTemplates(reportType: ReportType): Promise<Array<{
    name: string;
    description: string;
    options: Record<string, unknown>;
  }>> {
    const response = await callApiContract(reportContracts.templates, { reportType });
    return (response.data as { data: Array<{ name: string; description: string; options: Record<string, unknown> }> }).data;
  }

  /**
   * 預覽報表
   */
  static async previewReport(params: ReportGenerationParams): Promise<Record<string, unknown>> {
    const response = await callApiContract(reportContracts.preview, {}, params);
    return (response.data as { data: Record<string, unknown> }).data;
  }

  // ====================== 排程報表管理 ======================

  /**
   * 創建排程報表
   */
  static async createScheduledReport(config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>): Promise<ScheduledReport> {
    const response = await callApiContract(reportContracts.createScheduled, {}, config);
    return (response.data as { data: ScheduledReport }).data;
  }

  /**
   * 獲取排程報表列表
   */
  static async listScheduledReports(): Promise<ScheduledReport[]> {
    const response = await callApiContract(reportContracts.listScheduled, {});
    return (response.data as { data: ScheduledReport[] }).data;
  }

  /**
   * 更新排程報表
   */
  static async updateScheduledReport(id: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    const response = await callApiContract(reportContracts.updateScheduled, { id }, updates);
    return (response.data as { data: ScheduledReport }).data;
  }

  /**
   * 刪除排程報表
   */
  static async deleteScheduledReport(id: string): Promise<{ success: boolean; message: string }> {
    const response = await callApiContract(reportContracts.deleteScheduled, { id });
    return response.data as { success: boolean; message: string };
  }

  // ====================== 輔助方法 ======================

  /**
   * 獲取可用的報表類型
   */
  static getAvailableReportTypes(): Array<{ value: ReportType; label: string; description: string }> {
    return [
      // Phase 1: 基礎報表
      { value: 'conversation_summary', label: '對話摘要報告', description: '對話統計和摘要分析' },
      { value: 'agent_performance', label: '客服績效報告', description: '客服人員績效評估' },
      { value: 'message_statistics', label: '訊息統計報告', description: '訊息數量和類型統計' }
    ];
  }

  /**
   * 獲取可用的報表格式
   */
  static getAvailableFormats(): Array<{ value: ReportFormat; label: string; icon: string }> {
    return [
      { value: 'json', label: 'JSON 資料', icon: '' },
      { value: 'csv', label: 'CSV 試算表', icon: '' }
    ];
  }

  /**
   * 獲取時間範圍選項
   */
  static getTimeRangeOptions(): Array<{ value: ReportTimeRange; label: string }> {
    return [
      { value: 'last_24_hours', label: '過去24小時' },
      { value: 'last_7_days', label: '過去7天' },
      { value: 'last_30_days', label: '過去30天' },
      { value: 'last_90_days', label: '過去90天' },
      { value: 'current_month', label: '本月' },
      { value: 'last_month', label: '上月' },
      { value: 'current_quarter', label: '本季' },
      { value: 'last_quarter', label: '上季' },
      { value: 'current_year', label: '今年' },
      { value: 'last_year', label: '去年' },
      { value: 'custom', label: '自定義範圍' }
    ];
  }

  /**
   * 格式化報表狀態
   */
  static formatReportStatus(status: string): { label: string; color: string; icon: string } {
    const statusMap = {
      'pending': { label: '待處理', color: 'orange', icon: '' },
      'generating': { label: '生成中', color: 'blue', icon: '' },
      'completed': { label: '已完成', color: 'green', icon: '' },
      'failed': { label: '失敗', color: 'red', icon: '' },
      'expired': { label: '已過期', color: 'gray', icon: '' }
    };
    return statusMap[status as keyof typeof statusMap] || { label: status, color: 'gray', icon: '' };
  }

  /**
   * 計算檔案大小顯示
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) {return '0 B';}
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * 格式化報表類型顯示
   */
  static formatReportType(type: ReportType): string {
    const typeInfo = this.getAvailableReportTypes().find(t => t.value === type);
    return typeInfo?.label || type;
  }
}

// 匯出預設實例
export default ReportsAPI;
