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

import { apiClient } from './base';

/**
 * 報表 API 客戶端類
 */
export class ReportsAPI {
  private static readonly BASE_PATH = '/api/reports';

  /**
   * 健康檢查
   */
  static async healthCheck(): Promise<{ status: string; module: string; timestamp: string }> {
    const response = await apiClient.get(`${this.BASE_PATH}/health`);
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
    const response = await apiClient.get(`${this.BASE_PATH}/info`);
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
    const response = await apiClient.post(`${this.BASE_PATH}`, params);
    return (response.data as { data: ReportBase }).data;
  }

  /**
   * 獲取報表列表
   */
  static async listReports(query: ReportListQuery = {}): Promise<ReportListResponse> {
    const response = await apiClient.get(`${this.BASE_PATH}?${new URLSearchParams(query as Record<string, string>).toString()}`);
    return (response.data as { data: ReportListResponse }).data;
  }

  /**
   * 獲取單個報表詳情
   */
  static async getReportDetails(reportId: string): Promise<ReportDetails> {
    const response = await apiClient.get(`${this.BASE_PATH}/${reportId}`);
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
  static async downloadReport(reportId: string): Promise<{ url: string; filename: string }> {
    const response = await apiClient.get(`${this.BASE_PATH}/${reportId}/download`);
    return (response.data as { data: { url: string; filename: string } }).data;
  }

  /**
   * 刪除報表
   */
  static async deleteReport(reportId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`${this.BASE_PATH}/${reportId}`);
    return response.data as { success: boolean; message: string };
  }

  /**
   * 獲取報表統計
   */
  static async getReportStatistics(timeRange: ReportTimeRange = 'last_30_days'): Promise<ReportStatistics> {
    const response = await apiClient.get(`${this.BASE_PATH}/stats?timeRange=${timeRange}`);
    return (response.data as { data: ReportStatistics }).data;
  }

  /**
   * 批量操作
   */
  static async batchOperation(operation: BatchReportOperation): Promise<BatchOperationResult> {
    const response = await apiClient.post(`${this.BASE_PATH}/batch`, operation);
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
    const response = await apiClient.get(`${this.BASE_PATH}/templates/${reportType}`);
    return (response.data as { data: Array<{ name: string; description: string; options: Record<string, unknown> }> }).data;
  }

  /**
   * 預覽報表
   */
  static async previewReport(params: ReportGenerationParams): Promise<Record<string, unknown>> {
    const response = await apiClient.post(`${this.BASE_PATH}/preview`, params);
    return (response.data as { data: Record<string, unknown> }).data;
  }

  // ====================== 排程報表管理 ======================

  /**
   * 創建排程報表
   */
  static async createScheduledReport(config: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>): Promise<ScheduledReport> {
    const response = await apiClient.post(`${this.BASE_PATH}/scheduled`, config);
    return (response.data as { data: ScheduledReport }).data;
  }

  /**
   * 獲取排程報表列表
   */
  static async listScheduledReports(): Promise<ScheduledReport[]> {
    const response = await apiClient.get(`${this.BASE_PATH}/scheduled`);
    return (response.data as { data: ScheduledReport[] }).data;
  }

  /**
   * 更新排程報表
   */
  static async updateScheduledReport(id: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    const response = await apiClient.put(`${this.BASE_PATH}/scheduled/${id}`, updates);
    return (response.data as { data: ScheduledReport }).data;
  }

  /**
   * 刪除排程報表
   */
  static async deleteScheduledReport(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`${this.BASE_PATH}/scheduled/${id}`);
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
      { value: 'team_analytics', label: '團隊分析報告', description: '團隊整體表現分析' },
      { value: 'customer_satisfaction', label: '客戶滿意度報告', description: '滿意度調查結果' },
      { value: 'platform_usage', label: '平台使用報告', description: '平台功能使用統計' },
      { value: 'message_statistics', label: '訊息統計報告', description: '訊息數量和類型統計' },
      { value: 'response_time_analysis', label: '回應時間分析', description: '回應時間分析' },
      { value: 'workload_distribution', label: '工作負載報告', description: '工作負載分配分析' },
      { value: 'system_health', label: '系統健康報告', description: '系統狀態監控' },
      { value: 'custom', label: '自定義報告', description: '用戶自定義報表' },

      // Phase 1 Enterprise: 企業級報表
      { value: 'cost_analysis', label: '💰 成本分析報告', description: '營運成本分析' },
      { value: 'sla_compliance', label: '⚖️ SLA合規報告', description: '服務等級協議合規性' },
      { value: 'anomaly_detection', label: '🚨 異常檢測報告', description: '系統異常檢測' },
      { value: 'audit_trail', label: '📋 審計追蹤報告', description: '操作審計記錄' },
      { value: 'resource_utilization', label: '⚡ 資源使用報告', description: '資源使用效率' },

      // Phase 2: 商業智能增強
      { value: 'trend_forecast', label: '📈 趨勢預測報告', description: '30天趨勢和需求預測' },
      { value: 'customer_insights', label: '💡 客戶洞察報告', description: '客戶區段和行為分析' },
      { value: 'channel_integration', label: '🌐 通道整合報告', description: '多通道整合效果分析' },
      { value: 'goal_achievement', label: '🎯 目標達成報告', description: 'KPI目標追蹤分析' },
      { value: 'automation_effectiveness', label: '🤖 自動化成效報告', description: '自動化ROI分析' },

      // Phase 3: 高級分析功能
      { value: 'security_risk', label: '🔒 資安風險報告', description: '安全風險評估' },
      { value: 'knowledge_base', label: '📚 知識庫效能報告', description: '知識庫使用分析' },
      { value: 'call_quality', label: '📞 通話品質報告', description: '語音品質分析' },
      { value: 'executive_summary', label: '💼 高管摘要報告', description: '戰略決策支援' }
    ];
  }

  /**
   * 獲取可用的報表格式
   */
  static getAvailableFormats(): Array<{ value: ReportFormat; label: string; icon: string }> {
    return [
      { value: 'json', label: 'JSON 資料', icon: '📄' },
      { value: 'csv', label: 'CSV 試算表', icon: '📊' },
      { value: 'excel', label: 'Excel 檔案', icon: '📗' },
      { value: 'pdf', label: 'PDF 文件', icon: '📕' },
      { value: 'html', label: 'HTML 網頁', icon: '🌐' }
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
      'pending': { label: '待處理', color: 'orange', icon: '⏳' },
      'generating': { label: '生成中', color: 'blue', icon: '⚙️' },
      'completed': { label: '已完成', color: 'green', icon: '✅' },
      'failed': { label: '失敗', color: 'red', icon: '❌' },
      'expired': { label: '已過期', color: 'gray', icon: '⏰' }
    };
    return statusMap[status as keyof typeof statusMap] || { label: status, color: 'gray', icon: '❓' };
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