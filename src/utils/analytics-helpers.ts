// Analytics Helper Functions
// Phase 2: 長期優化 - 分析服務輔助工具
// 專案：Multi-Channel Support MVP - WebSocket 監控系統

import type { Bindings } from '../types';
import type { WebSocketErrorStats } from '../monitoring/websocket-analytics-service';
import { nowMs } from '@/utils/timestamp'

/**
 * 記錄 WebSocket 錯誤的輔助函數
 * 用於在各個錯誤回應點記錄統計數據
 */
export async function recordWebSocketError(
  env: Bindings,
  errorCode: number,
  errorType: string,
  message: string,
  additionalData: {
    userId?: string;
    conversationId?: string;
    clientIP?: string;
    userAgent?: string;
    duration?: number;
    retryAttempt?: number;
  } = {}
): Promise<void> {
  try {
    // 動態導入分析服務以避免循環依賴
    const { createAnalyticsService } = await import('../monitoring/websocket-analytics-service');
    const analyticsService = createAnalyticsService(env);

    const errorStats: WebSocketErrorStats = {
      timestamp: nowMs(),
      errorCode,
      errorType,
      message,
      ...additionalData
    };

    await analyticsService.recordError(errorStats);
    console.log(`[Analytics Helper] Error recorded: ${errorCode} - ${errorType}`);
  } catch (error) {
    // 分析記錄失敗不應影響主要功能
    console.warn('[Analytics Helper] Failed to record error:', error);
  }
}

/**
 * 批量記錄認證錯誤的輔助函數
 * 為所有認證錯誤類型提供統一的記錄接口
 */
export async function recordAuthError(
  env: Bindings,
  errorCode: number,
  clientIP?: string,
  userAgent?: string,
  duration?: number
): Promise<void> {
  const errorTypeMap: Record<number, string> = {
    4401: 'NO_TOKEN',
    4402: 'INVALID_TOKEN_FORMAT',
    4403: 'INVALID_TOKEN',
    4404: 'TOKEN_EXPIRED',
    4405: 'TOKEN_EXPIRING_SOON',
    4406: 'INVALID_USER_DATA',
    4407: 'INVALID_ROLE',
    4500: 'AUTH_SYSTEM_ERROR'
  };

  const messageMap: Record<number, string> = {
    4401: 'No authentication token provided',
    4402: 'Invalid JWT token format',
    4403: 'Invalid or expired token',
    4404: 'JWT token has expired',
    4405: 'Token expiring soon',
    4406: 'Token contains invalid user data',
    4407: 'Token contains invalid role',
    4500: 'Authentication system error'
  };

  const additionalData: Record<string, string | number> = {
    ...(clientIP !== undefined && { clientIP }),
    ...(userAgent !== undefined && { userAgent }),
    ...(duration !== undefined && { duration })
  };

  await recordWebSocketError(
    env,
    errorCode,
    errorTypeMap[errorCode] || 'UNKNOWN_AUTH_ERROR',
    messageMap[errorCode] || 'Unknown authentication error',
    additionalData
  );
}

/**
 * 生成錯誤回應的輔助函數
 * 統一錯誤回應格式並自動記錄分析數據
 */
export async function createAuthErrorResponse(
  env: Bindings,
  errorCode: number,
  message: string,
  suggestedAction: string,
  clientIP?: string,
  userAgent?: string,
  duration?: number,
  additionalData: Record<string, any> = {}
): Promise<Response> {
  // 記錄錯誤統計
  await recordAuthError(env, errorCode, clientIP, userAgent, duration);

  // 生成標準化錯誤回應
  const responseBody = {
    error: getErrorTitle(errorCode),
    code: errorCode,
    message,
    timestamp: nowMs(),
    suggestedAction,
    ...additionalData
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Error-Code': getErrorTypeCode(errorCode),
    'X-WebSocket-Close-Code': errorCode.toString()
  };

  const statusCode = errorCode === 4500 ? 500 : 401;

  return new Response(JSON.stringify(responseBody), {
    status: statusCode,
    headers
  });
}

/**
 * 獲取錯誤標題
 */
function getErrorTitle(errorCode: number): string {
  const titleMap: Record<number, string> = {
    4401: 'Authentication token required',
    4402: 'Invalid token format',
    4403: 'Invalid token',
    4404: 'Token expired',
    4405: 'Token expiring soon',
    4406: 'Invalid user data',
    4407: 'Invalid role',
    4500: 'Authentication failed'
  };

  return titleMap[errorCode] || 'Authentication error';
}

/**
 * 獲取錯誤類型代碼
 */
function getErrorTypeCode(errorCode: number): string {
  const typeMap: Record<number, string> = {
    4401: 'NO_TOKEN',
    4402: 'INVALID_TOKEN_FORMAT',
    4403: 'INVALID_TOKEN',
    4404: 'TOKEN_EXPIRED',
    4405: 'TOKEN_EXPIRING_SOON',
    4406: 'INVALID_USER_DATA',
    4407: 'INVALID_ROLE',
    4500: 'AUTH_SYSTEM_ERROR'
  };

  return typeMap[errorCode] || 'UNKNOWN_ERROR';
}

/**
 * 計算用戶體驗評分
 */
export function calculateUserExperienceScore(
  errorRate: number,
  averageLatency: number,
  connectionSuccessRate: number
): number {
  // 錯誤率影響 (40% 權重)
  const errorScore = Math.max(0, 1 - errorRate);

  // 延遲影響 (35% 權重)
  // 理想延遲 < 500ms, 可接受延遲 < 2000ms
  const latencyScore = averageLatency < 500 ? 1 :
    averageLatency < 2000 ? (2000 - averageLatency) / 1500 :
    0;

  // 連接成功率影響 (25% 權重)
  const connectionScore = connectionSuccessRate;

  // 加權平均
  const totalScore = (errorScore * 0.4) + (latencyScore * 0.35) + (connectionScore * 0.25);

  return Math.round(totalScore * 100) / 100; // 保留兩位小數
}

/**
 * 格式化時間範圍
 */
export function formatTimeRange(hours: number): string {
  if (hours < 24) {
    return `${hours}h`;
  } else if (hours < 168) {
    return `${Math.round(hours / 24)}d`;
  } else {
    return `${Math.round(hours / 168)}w`;
  }
}

/**
 * 生成分析報告摘要
 */
export function generateAnalyticsSummary(data: {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  errorRate: number;
  averageLatency: number;
  userSatisfactionScore: number;
}): string {
  const { totalConnections, successfulConnections, failedConnections: _failedConnections, errorRate, averageLatency, userSatisfactionScore } = data;

  let summary = ` WebSocket Analytics Summary:\n`;
  summary += `• Total Connections: ${totalConnections}\n`;
  summary += `• Success Rate: ${totalConnections > 0 ? ((successfulConnections / totalConnections) * 100).toFixed(1) : 0}%\n`;
  summary += `• Error Rate: ${(errorRate * 100).toFixed(1)}%\n`;
  summary += `• Average Latency: ${averageLatency.toFixed(0)}ms\n`;
  summary += `• User Satisfaction: ${(userSatisfactionScore * 100).toFixed(0)}%\n`;

  // 添加狀態指示
  if (userSatisfactionScore >= 0.9) {
    summary += ` System Status: Excellent`;
  } else if (userSatisfactionScore >= 0.8) {
    summary += ` System Status: Good`;
  } else if (userSatisfactionScore >= 0.6) {
    summary += ` System Status: Needs Attention`;
  } else {
    summary += ` System Status: Critical`;
  }

  return summary;
}

/**
 * 檢測異常模式
 */
export function detectAnomalies(
  currentMetrics: { errorRate: number; averageLatency: number },
  historicalAverage: { errorRate: number; averageLatency: number },
  threshold: number = 2.0 // 2倍標準差
): Array<{ type: string; severity: 'warning' | 'critical'; description: string }> {
  const anomalies: Array<{ type: string; severity: 'warning' | 'critical'; description: string }> = [];

  // 錯誤率異常檢測
  const errorRateIncrease = currentMetrics.errorRate / Math.max(0.001, historicalAverage.errorRate);
  if (errorRateIncrease > threshold) {
    anomalies.push({
      type: 'error_rate_spike',
      severity: errorRateIncrease > threshold * 1.5 ? 'critical' : 'warning',
      description: `Error rate increased by ${(errorRateIncrease * 100).toFixed(0)}% from historical average`
    });
  }

  // 延遲異常檢測
  const latencyIncrease = currentMetrics.averageLatency / Math.max(1, historicalAverage.averageLatency);
  if (latencyIncrease > threshold) {
    anomalies.push({
      type: 'latency_spike',
      severity: latencyIncrease > threshold * 1.5 ? 'critical' : 'warning',
      description: `Average latency increased by ${(latencyIncrease * 100).toFixed(0)}% from historical average`
    });
  }

  return anomalies;
}