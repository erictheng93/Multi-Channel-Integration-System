/**
 * Shared utility functions for ReportViewer components
 * Extracted from ReportViewer.vue to avoid duplication across child components
 */

import ReportsAPI from '@/api/reports';
import type { ReportType, ReportFormat, ReportStatus } from '@/types/reports';

export const getReportTypeIcon = (type: ReportType): string => {
  const iconMap: Record<ReportType, string> = {
    'conversation_summary': '\uD83D\uDCAC',
    'agent_performance': '\uD83D\uDC64',
    'team_analytics': '\uD83D\uDC65',
    'customer_satisfaction': '\uD83D\uDE0A',
    'platform_usage': '\uD83D\uDCF1',
    'message_statistics': '\uD83D\uDCCA',
    'response_time_analysis': '\u23F1\uFE0F',
    'workload_distribution': '\u2696\uFE0F',
    'system_health': '\uD83C\uDFE5',
    'custom': '\uD83D\uDD27',
    'cost_analysis': '\uD83D\uDCB0',
    'sla_compliance': '\u2696\uFE0F',
    'anomaly_detection': '\uD83D\uDEA8',
    'audit_trail': '\uD83D\uDCCB',
    'resource_utilization': '\u26A1',
    'trend_forecast': '\uD83D\uDCC8',
    'customer_insights': '\uD83D\uDCA1',
    'channel_integration': '\uD83C\uDF10',
    'goal_achievement': '\uD83C\uDFAF',
    'automation_effectiveness': '\uD83E\uDD16',
    'security_risk': '\uD83D\uDD12',
    'knowledge_base': '\uD83D\uDCDA',
    'call_quality': '\uD83D\uDCDE',
    'executive_summary': '\uD83D\uDCBC'
  };
  return iconMap[type] || '\uD83D\uDCCA';
};

export const getReportTypeLabel = (type: ReportType): string => {
  return ReportsAPI.formatReportType(type);
};

export const getTypeBadgeClass = (type: ReportType): string => {
  if (['cost_analysis', 'sla_compliance', 'anomaly_detection', 'audit_trail', 'resource_utilization'].includes(type)) {
    return 'enterprise';
  }
  if (['trend_forecast', 'customer_insights', 'channel_integration', 'goal_achievement', 'automation_effectiveness'].includes(type)) {
    return 'business-intelligence';
  }
  if (['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(type)) {
    return 'advanced';
  }
  return 'basic';
};

export const getStatusIcon = (status: ReportStatus): string => {
  const statusMap: Record<ReportStatus, string> = {
    'pending': '\u23F3',
    'generating': '\u2699\uFE0F',
    'completed': '\u2705',
    'failed': '\u274C',
    'expired': '\u23F0'
  };
  return statusMap[status] || '\u2753';
};

export const getStatusLabel = (status: ReportStatus): string => {
  const statusMap: Record<ReportStatus, string> = {
    'pending': '\u5F85\u8655\u7406',
    'generating': '\u751F\u6210\u4E2D',
    'completed': '\u5DF2\u5B8C\u6210',
    'failed': '\u5931\u6557',
    'expired': '\u5DF2\u904E\u671F'
  };
  return statusMap[status] || status;
};

export const getStatusClass = (status: ReportStatus): string => {
  const classMap: Record<ReportStatus, string> = {
    'pending': 'pending',
    'generating': 'generating',
    'completed': 'completed',
    'failed': 'failed',
    'expired': 'expired'
  };
  return classMap[status] || '';
};

export const getFormatIcon = (format: ReportFormat): string => {
  const formatMap: Record<ReportFormat, string> = {
    'json': '\uD83D\uDCC4',
    'csv': '\uD83D\uDCCA',
    'excel': '\uD83D\uDCD7',
    'pdf': '\uD83D\uDCD5',
    'html': '\uD83C\uDF10'
  };
  return formatMap[format] || '\uD83D\uDCC4';
};

export const getFormatLabel = (format: ReportFormat): string => {
  const formatMap: Record<ReportFormat, string> = {
    'json': 'JSON \u8CC7\u6599',
    'csv': 'CSV \u8A66\u7B97\u8868',
    'excel': 'Excel \u6A94\u6848',
    'pdf': 'PDF \u6587\u4EF6',
    'html': 'HTML \u7DB2\u9801'
  };
  return formatMap[format] || format.toUpperCase();
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('zh-TW');
};

export const formatFileSize = (bytes: number): string => {
  return ReportsAPI.formatFileSize(bytes);
};

export const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)} \u79D2`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} \u5206\u9418`;
  } else {
    return `${Math.round(seconds / 3600)} \u5C0F\u6642`;
  }
};
