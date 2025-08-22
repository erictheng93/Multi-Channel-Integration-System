// 企業級統計分析系統實現
import type {
  AnalyticsFilter,
  TimeSeriesData
} from '../types/enterprise';
import type { DatabaseRow } from '../types';

// Legacy 分析指標接口 (保持向後相容)
export interface AnalyticsMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  unit?: string;
}

// 客服效能指標
export interface AgentPerformanceMetrics {
  agentId: number;
  agentName: string;
  period: { start: number; end: number };
  
  conversationMetrics: {
    totalConversations: number;
    activeConversations: number;
    closedConversations: number;
    averageResponseTime: number; // 秒
    averageResolutionTime: number; // 秒
    firstResponseTime: number; // 秒
  };
  
  messageMetrics: {
    totalMessages: number;
    messagesPerConversation: number;
    messagesSent: number;
    messagesReceived: number;
  };
  
  workTimeMetrics: {
    totalWorkTime: number; // 秒
    activeTime: number; // 秒
    idleTime: number; // 秒
    utilizationRate: number; // 百分比
  };
  
  satisfactionMetrics: {
    averageRating: number;
    totalRatings: number;
    positiveRatings: number;
    negativeRatings: number;
    satisfactionRate: number; // 百分比
  };
}

// 系統效能指標
export interface SystemPerformanceMetrics {
  period: { start: number; end: number };
  
  apiMetrics: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number; // 每秒請求數
    endpointPerformance: Array<{
      endpoint: string;
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    }>;
  };
  
  databaseMetrics: {
    queryCount: number;
    averageQueryTime: number;
    slowQueries: Array<{
      query: string;
      executionTime: number;
      frequency: number;
    }>;
  };
  
  integrationMetrics: {
    line: {
      webhookLatency: number;
      apiCallSuccess: number;
      apiCallFailure: number;
    };
    facebook: {
      webhookLatency: number;
      apiCallSuccess: number;
      apiCallFailure: number;
    };
  };
}

// 企業級分析引擎
export class EnterpriseAnalyticsEngine {
  private db: D1Database;
  private kv: KVNamespace;
  
  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }
  
  // 記錄指標
  async recordMetric(metric: AnalyticsMetric): Promise<void> {
    // 寫入資料庫
    await this.db.prepare(`
      INSERT INTO metrics (metric_name, metric_value, timestamp, tags)
      VALUES (?, ?, ?, ?)
    `).bind(
      metric.name,
      metric.value,
      metric.timestamp,
      JSON.stringify(metric.tags)
    ).run();
    
    // 更新實時指標到 KV
    const key = `metric:${metric.name}:${this.generateTagKey(metric.tags)}`;
    await this.kv.put(key, JSON.stringify({
      value: metric.value,
      timestamp: metric.timestamp,
      unit: metric.unit
    }), { expirationTtl: 24 * 60 * 60 }); // 24 小時
    
    // 更新時間序列數據
    await this.updateTimeSeriesData(metric);
  }
  
  // 獲取客服效能指標
  async getAgentPerformanceMetrics(
    agentId: number,
    period: { start: number; end: number }
  ): Promise<AgentPerformanceMetrics> {
    const [conversationData, messageData, workTimeData, satisfactionData] = await Promise.all([
      this.getConversationMetrics(agentId, period),
      this.getMessageMetrics(agentId, period),
      this.getWorkTimeMetrics(agentId, period),
      this.getSatisfactionMetrics(agentId, period)
    ]);
    
    const agentName = await this.getAgentName(agentId);
    
    return {
      agentId,
      agentName,
      period,
      conversationMetrics: conversationData,
      messageMetrics: messageData,
      workTimeMetrics: workTimeData,
      satisfactionMetrics: satisfactionData
    };
  }
  
  // 獲取系統效能指標
  async getSystemPerformanceMetrics(
    period: { start: number; end: number }
  ): Promise<SystemPerformanceMetrics> {
    const [apiData, dbData, integrationData] = await Promise.all([
      this.getApiMetrics(period),
      this.getDatabaseMetrics(period),
      this.getIntegrationMetrics(period)
    ]);
    
    return {
      period,
      apiMetrics: apiData,
      databaseMetrics: dbData,
      integrationMetrics: integrationData
    };
  }
  
  // 生成實時儀表板數據
  async generateDashboardData(): Promise<{
    realTimeMetrics: Record<string, unknown>;
    alerts: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      timestamp: number;
    }>;
    trends: Record<string, Array<{ timestamp: number; value: number }>>;
  }> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // 獲取實時指標
    const realTimeMetrics = await this.getRealTimeMetrics();
    
    // 檢查警報
    const alerts = await this.checkAlerts();
    
    // 獲取趨勢數據
    const trends = await this.getTrendData(oneHourAgo, now);
    
    return {
      realTimeMetrics,
      alerts,
      trends
    };
  }
  
  // 生成預測分析
  async generatePredictiveAnalytics(
    period: { start: number; end: number }
  ): Promise<{
    volumePrediction: {
      nextWeek: number;
      nextMonth: number;
      confidence: number;
    };
    resourcePrediction: {
      requiredAgents: number;
      peakHours: Array<{ hour: number; load: number }>;
    };
    satisfactionPrediction: {
      trend: 'improving' | 'declining' | 'stable';
      expectedRating: number;
    };
  }> {
    const historicalData = await this.getHistoricalData(period);
    
    return {
      volumePrediction: this.predictMessageVolume(historicalData),
      resourcePrediction: this.predictResourceNeeds(historicalData),
      satisfactionPrediction: this.predictSatisfactionTrend(historicalData)
    };
  }
  
  // 生成自定義報告
  async generateCustomReport(
    reportConfig: {
      metrics: string[];
      filters: AnalyticsFilter;
      groupBy: string[];
      period: { start: number; end: number };
      format: 'json' | 'csv';
    }
  ): Promise<Record<string, unknown>[] | string> {
    const { metrics, filters, groupBy, period, format } = reportConfig;
    
    // 構建查詢
    let query = `
      SELECT ${this.buildSelectClause(metrics, groupBy)}
      FROM metrics m
      LEFT JOIN conversations c ON m.tags LIKE '%conversation_id%'
      LEFT JOIN users u ON m.tags LIKE '%user_id%'
      WHERE m.timestamp >= ? AND m.timestamp <= ?
    `;
    
    const params = [period.start, period.end];
    
    // 添加過濾條件
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        query += ` AND ${key} = ?`;
        if (typeof value === 'number') {
          params.push(value);
        } else {
          // params.push(String(value));
        }
      }
    }
    
    // 添加分組
    if (groupBy.length > 0) {
      query += ` GROUP BY ${groupBy.join(', ')}`;
    }
    
    query += ` ORDER BY m.timestamp DESC`;
    
    const result = await this.db.prepare(query).bind(...params).all();
    
    if (format === 'csv') {
      return this.convertToCSV(result.results);
    }
    
    return result.results;
  }
  
  // 私有方法：獲取對話指標
  private async getConversationMetrics(
    agentId: number,
    period: { start: number; end: number }
  ) {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_conversations,
        AVG(
          CASE 
            WHEN first_response_at IS NOT NULL 
            THEN (first_response_at - created_at) / 1000 
          END
        ) as avg_first_response_time,
        AVG(
          CASE 
            WHEN closed_at IS NOT NULL 
            THEN (closed_at - created_at) / 1000 
          END
        ) as avg_resolution_time
      FROM conversations 
      WHERE assigned_user_id = ? 
        AND created_at >= ? 
        AND created_at <= ?
    `).bind(agentId, period.start, period.end).first();
    
    return {
      totalConversations: Number(result?.total_conversations) || 0,
      activeConversations: Number(result?.active_conversations) || 0,
      closedConversations: Number(result?.closed_conversations) || 0,
      averageResponseTime: Number(result?.avg_response_time) || 0,
      averageResolutionTime: Number(result?.avg_resolution_time) || 0,
      firstResponseTime: Number(result?.avg_first_response_time) || 0
    };
  }
  
  // 私有方法：獲取訊息指標
  private async getMessageMetrics(
    agentId: number,
    period: { start: number; end: number }
  ) {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN sender_type = 'agent' THEN 1 END) as messages_sent,
        COUNT(CASE WHEN sender_type = 'customer' THEN 1 END) as messages_received,
        COUNT(DISTINCT conversation_id) as unique_conversations
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.assigned_user_id = ?
        AND m.created_at >= ?
        AND m.created_at <= ?
    `).bind(agentId, period.start, period.end).first();
    
    const totalMessages = Number(result?.total_messages) || 0;
    const uniqueConversations = Number(result?.unique_conversations) || 1;
    
    return {
      totalMessages,
      messagesPerConversation: totalMessages / uniqueConversations,
      messagesSent: Number(result?.messages_sent) || 0,
      messagesReceived: Number(result?.messages_received) || 0
    };
  }
  
  // 私有方法：獲取工作時間指標
  private async getWorkTimeMetrics(
    agentId: number,
    period: { start: number; end: number }
  ) {
    // 這裡需要實現工作時間追蹤邏輯
    // 可以基於登入/登出記錄、活動狀態等
    const result = await this.db.prepare(`
      SELECT 
        SUM(metric_value) as total_work_time
      FROM metrics 
      WHERE metric_name = 'agent_work_time'
        AND JSON_EXTRACT(tags, '$.agent_id') = ?
        AND timestamp >= ? 
        AND timestamp <= ?
    `).bind(agentId.toString(), period.start, period.end).first();

    const totalWorkTime = Number(result?.total_work_time) || 0;
    
    return {
      totalWorkTime,
      activeTime: totalWorkTime * 0.8, // 假設 80% 為活躍時間
      idleTime: totalWorkTime * 0.2,
      utilizationRate: 80
    };
  }
  
  // 私有方法：獲取滿意度指標
  private async getSatisfactionMetrics(
    agentId: number,
    period: { start: number; end: number }
  ) {
    // 這裡需要實現客戶滿意度評分系統
    const result = await this.db.prepare(`
      SELECT 
        AVG(metric_value) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN metric_value >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN metric_value < 3 THEN 1 END) as negative_ratings
      FROM metrics 
      WHERE metric_name = 'customer_satisfaction'
        AND JSON_EXTRACT(tags, '$.agent_id') = ?
        AND timestamp >= ? 
        AND timestamp <= ?
    `).bind(agentId.toString(), period.start, period.end).first();

    const totalRatings = Number(result?.total_ratings) || 0;
    const positiveRatings = Number(result?.positive_ratings) || 0;
    
    return {
      averageRating: Number(result?.avg_rating) || 0,
      totalRatings,
      positiveRatings,
      negativeRatings: Number(result?.negative_ratings) || 0,
      satisfactionRate: totalRatings > 0 ? (positiveRatings / totalRatings) * 100 : 0
    };
  }

  // 私有方法：獲取 API 指標
  private async getApiMetrics(period: { start: number; end: number }) {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        AVG(metric_value) as avg_response_time,
        COUNT(CASE WHEN JSON_EXTRACT(tags, '$.status') >= '400' THEN 1 END) * 100.0 / COUNT(*) as error_rate
      FROM metrics 
      WHERE metric_name = 'api_request_duration'
        AND timestamp >= ? 
        AND timestamp <= ?
    `).bind(period.start, period.end).first();

    const endpointResult = await this.db.prepare(`
      SELECT 
        JSON_EXTRACT(tags, '$.path') as endpoint,
        COUNT(*) as request_count,
        AVG(metric_value) as avg_response_time,
        COUNT(CASE WHEN JSON_EXTRACT(tags, '$.status') >= '400' THEN 1 END) * 100.0 / COUNT(*) as error_rate
      FROM metrics 
      WHERE metric_name = 'api_request_duration'
        AND timestamp >= ? 
        AND timestamp <= ?
      GROUP BY JSON_EXTRACT(tags, '$.path')
    `).bind(period.start, period.end).all();

    return {
      totalRequests: Number(result?.total_requests) || 0,
      averageResponseTime: Number(result?.avg_response_time) || 0,
      errorRate: Number(result?.error_rate) || 0,
      throughput: (Number(result?.total_requests) || 0) / ((period.end - period.start) / 1000),
      endpointPerformance: endpointResult.results?.map((row: DatabaseRow) => ({
        endpoint: row.endpoint,
        requestCount: Number(row.request_count),
        averageResponseTime: Number(row.avg_response_time),
        errorRate: Number(row.error_rate)
      })) || []
    };
  }

  // 私有方法：獲取資料庫指標
  private async getDatabaseMetrics(period: { start: number; end: number }) {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as query_count,
        AVG(metric_value) as avg_query_time
      FROM metrics 
      WHERE metric_name = 'database_query_duration'
        AND timestamp >= ? 
        AND timestamp <= ?
    `).bind(period.start, period.end).first();

    return {
      queryCount: Number(result?.query_count) || 0,
      averageQueryTime: Number(result?.avg_query_time) || 0,
      slowQueries: [] // 需要實現慢查詢追蹤
    };
  }

  // 私有方法：獲取整合指標
  private async getIntegrationMetrics(_period: { start: number; end: number }) {
    return {
      line: {
        webhookLatency: 0,
        apiCallSuccess: 0,
        apiCallFailure: 0
      },
      facebook: {
        webhookLatency: 0,
        apiCallSuccess: 0,
        apiCallFailure: 0
      }
    };
  }

  // 私有方法：獲取實時指標
  private async getRealTimeMetrics() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const activeAgents = await this.db.prepare(`
      SELECT COUNT(DISTINCT JSON_EXTRACT(tags, '$.agent_id')) as count
      FROM metrics 
      WHERE metric_name = 'agent_activity'
        AND timestamp >= ?
    `).bind(oneHourAgo).first();

    return {
      activeAgents: Number(activeAgents?.count) || 0,
      timestamp: now
    };
  }

  // 私有方法：檢查警報
  private async checkAlerts() {
    const alerts = [];
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // 檢查 API 錯誤率
    const errorRate = await this.db.prepare(`
      SELECT 
        COUNT(CASE WHEN JSON_EXTRACT(tags, '$.status') >= '400' THEN 1 END) * 100.0 / COUNT(*) as error_rate
      FROM metrics 
      WHERE metric_name = 'api_request_duration'
        AND timestamp >= ?
    `).bind(oneHourAgo).first();

    if (Number(errorRate?.error_rate) > 5) {
      alerts.push({
        type: 'high_error_rate',
        message: `API 錯誤率過高: ${Number(errorRate?.error_rate).toFixed(2)}%`,
        severity: 'high' as const,
        timestamp: now
      });
    }

    return alerts;
  }

  // 私有方法：獲取趨勢數據
  private async getTrendData(startTime: number, endTime: number) {
    const result = await this.db.prepare(`
      SELECT 
        metric_name,
        timestamp,
        metric_value
      FROM metrics 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp
    `).bind(startTime, endTime).all();

    const trends: Record<string, Array<{ timestamp: number; value: number }>> = {};
    
    result.results?.forEach((row: DatabaseRow) => {
      const metricName = row.metric_name as string;
      if (!trends[metricName]) {
        trends[metricName] = [];
      }
      trends[metricName].push({
        timestamp: row.timestamp as number,
        value: row.metric_value as number
      });
    });

    return trends;
  }

  // 私有方法：獲取歷史數據
  private async getHistoricalData(period: { start: number; end: number }): Promise<TimeSeriesData[]> {
    const result = await this.db.prepare(`
      SELECT 
        DATE(timestamp / 1000, 'unixepoch') as date,
        COUNT(*) as message_count,
        AVG(metric_value) as avg_value
      FROM metrics 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY DATE(timestamp / 1000, 'unixepoch')
      ORDER BY date
    `).bind(period.start, period.end).all();

    return result.results?.map((row: DatabaseRow) => ({
      timestamp: new Date(row.date as string).toISOString(),
      value: Number(row.avg_value) || 0,
      metadata: {
        messageCount: Number(row.message_count) || 0,
        date: row.date as string
      }
    })) || [];
  }

  // 私有方法：預測資源需求
  private predictResourceNeeds(historicalData: TimeSeriesData[]): {
    requiredAgents: number;
    peakHours: Array<{ hour: number; load: number }>;
  } {
    if (historicalData.length === 0) {
      return {
        requiredAgents: 1,
        peakHours: []
      };
    }

    const avgLoad = historicalData.reduce((sum, d) => {
      const messageCount = d.metadata?.messageCount as number || 0;
      return sum + messageCount;
    }, 0) / historicalData.length;
    const requiredAgents = Math.max(1, Math.ceil(avgLoad / 100)); // 假設每個客服可處理 100 條訊息

    return {
      requiredAgents,
      peakHours: [
        { hour: 9, load: avgLoad * 1.2 },
        { hour: 14, load: avgLoad * 1.1 },
        { hour: 20, load: avgLoad * 0.8 }
      ]
    };
  }

  // 私有方法：預測滿意度趨勢
  private predictSatisfactionTrend(historicalData: TimeSeriesData[]): {
    trend: 'improving' | 'declining' | 'stable';
    expectedRating: number;
  } {
    if (historicalData.length < 2) {
      return {
        trend: 'stable' as const,
        expectedRating: 4.0
      };
    }

    const recent = historicalData.slice(-7);
    const older = historicalData.slice(-14, -7);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, d) => sum + d.value, 0) / older.length 
      : recentAvg;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentAvg > olderAvg + 0.1) trend = 'improving';
    else if (recentAvg < olderAvg - 0.1) trend = 'declining';

    return {
      trend,
      expectedRating: recentAvg
    };
  }

  // 私有方法：構建選擇子句
  private buildSelectClause(metrics: string[], groupBy: string[]): string {
    const selectParts = [];
    
    for (const metric of metrics) {
      switch (metric) {
        case 'count':
          selectParts.push('COUNT(*) as count');
          break;
        case 'avg_value':
          selectParts.push('AVG(metric_value) as avg_value');
          break;
        case 'sum_value':
          selectParts.push('SUM(metric_value) as sum_value');
          break;
        default:
          selectParts.push(`${metric}`);
      }
    }

    if (groupBy.length > 0) {
      selectParts.push(...groupBy);
    }

    return selectParts.join(', ');
  }
  
  // 私有方法：更新時間序列數據
  private async updateTimeSeriesData(metric: AnalyticsMetric): Promise<void> {
    const hour = Math.floor(metric.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const key = `timeseries:${metric.name}:${hour}`;
    
    const existing = await this.kv.get(key);
    const data = existing ? JSON.parse(existing) : { 
      values: [], 
      count: 0, 
      sum: 0, 
      min: metric.value, 
      max: metric.value 
    };
    
    data.values.push({ 
      timestamp: metric.timestamp, 
      value: metric.value, 
      tags: metric.tags 
    });
    data.count += 1;
    data.sum += metric.value;
    data.min = Math.min(data.min, metric.value);
    data.max = Math.max(data.max, metric.value);
    
    await this.kv.put(key, JSON.stringify(data), { 
      expirationTtl: 7 * 24 * 60 * 60 // 7 天
    });
  }
  
  // 私有方法：生成標籤鍵
  private generateTagKey(tags: Record<string, string>): string {
    return Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }
  
  // 私有方法：獲取客服名稱
  private async getAgentName(agentId: number): Promise<string> {
    const agent = await this.db.prepare(`
      SELECT display_name FROM users WHERE id = ?
    `).bind(agentId).first();
    
    return agent?.display_name as string || `Agent ${agentId}`;
  }
  
  // 私有方法：預測訊息量
  private predictMessageVolume(historicalData: TimeSeriesData[]): {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  } {
    if (historicalData.length < 7) {
      return { nextWeek: 0, nextMonth: 0, confidence: 0 };
    }
    
    const values = historicalData.map(d => {
      const messageCount = d.metadata?.messageCount as number || 0;
      return messageCount;
    });
    const trend = this.calculateLinearTrend(values);
    
    const lastValue = values[values.length - 1] || 0;
    return {
      nextWeek: Math.max(0, lastValue + trend * 7),
      nextMonth: Math.max(0, lastValue + trend * 30),
      confidence: this.calculatePredictionConfidence(values)
    };
  }
  
  // 私有方法：計算線性趨勢
  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
  
  // 私有方法：計算季節性 (暫時未使用)
  /*
  private _calculateSeasonality(data: TimeSeriesData[]): Record<string, number> {
    const hourlyPattern: Record<number, number[]> = {};
    
    data.forEach(item => {
      const hour = new Date(item.timestamp).getHours();
      if (!hourlyPattern[hour]) hourlyPattern[hour] = [];
      const messageCount = item.metadata?.messageCount as number || 0;
      hourlyPattern[hour].push(messageCount);
    });
    
    const seasonality: Record<string, number> = {};
    Object.entries(hourlyPattern).forEach(([hour, values]) => {
      seasonality[`hour_${hour}`] = values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    return seasonality;
  }
  */
  
  // 私有方法：計算預測信心度
  private calculatePredictionConfidence(values: number[]): number {
    if (values.length < 3) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // 變異係數越小，信心度越高
    const coefficientOfVariation = stdDev / mean;
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }
  
  // 私有方法：轉換為 CSV
  private convertToCSV(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value}"` : String(value || '');
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }
}

// 指標收集中間件
export function metricsMiddleware() {
  return async (c: { req: any; res: any; env: any }, next: () => Promise<void>) => {
    const startTime = Date.now();
    const path = c.req.path;
    const method = c.req.method;
    
    try {
      await next();
      
      const duration = Date.now() - startTime;
      const analytics = new EnterpriseAnalyticsEngine(c.env.DB, c.env.KV);
      
      // 記錄 API 調用指標
      await analytics.recordMetric({
        name: 'api_request_duration',
        value: duration,
        timestamp: Date.now(),
        tags: {
          method,
          path,
          status: c.res.status.toString()
        },
        unit: 'ms'
      });
      
      await analytics.recordMetric({
        name: 'api_request_count',
        value: 1,
        timestamp: Date.now(),
        tags: {
          method,
          path,
          status: c.res.status.toString()
        }
      });
      
    } catch (error: unknown) {
      const analytics = new EnterpriseAnalyticsEngine(c.env.DB, c.env.KV);
      
      // 記錄錯誤指標
      await analytics.recordMetric({
        name: 'api_request_error',
        value: 1,
        timestamp: Date.now(),
        tags: {
          method,
          path,
          error: error instanceof Error ? error.message : 'unknown'
        }
      });
      
      throw error;
    }
  };
}