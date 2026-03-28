// Enterprise analytics engine - orchestrator
// Delegates to focused sub-modules while preserving the original public API.
import type {
  AnalyticsFilter,
  TimeSeriesData
} from '../types/enterprise';
import { nowMs } from '@/utils/timestamp';

// Import the local AnalyticsMetric type for use in method signatures
import type { AnalyticsMetric } from './analytics-types';

// Re-export types from sub-module so existing consumers keep working
export type { AnalyticsMetric, AgentPerformanceMetrics, SystemPerformanceMetrics } from './analytics-types';

// Re-export metricsMiddleware from sub-module
export { metricsMiddleware } from './analytics-metrics';

// Import sub-module functions
import { recordMetric } from './analytics-metrics';
import {
  getConversationMetrics,
  getMessageMetrics,
  getWorkTimeMetrics,
  getSatisfactionMetrics,
  getAgentName
} from './analytics-agent';
import {
  getApiMetrics,
  getDatabaseMetrics,
  getIntegrationMetrics
} from './analytics-system';
import {
  getRealTimeMetrics,
  checkAlerts,
  getTrendData,
  getHistoricalData,
  predictMessageVolume,
  predictResourceNeeds,
  predictSatisfactionTrend
} from './analytics-dashboard';
import { generateCustomReport } from './analytics-reports';

// Enterprise analytics engine
export class EnterpriseAnalyticsEngine {
  private db: D1Database;
  private kv: KVNamespace;

  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }

  // Record a metric
  async recordMetric(metric: AnalyticsMetric): Promise<void> {
    await recordMetric(this.db, this.kv, metric);
  }

  // Get agent performance metrics
  async getAgentPerformanceMetrics(
    agentId: number,
    period: { start: number; end: number }
  ) {
    const [conversationData, messageData, workTimeData, satisfactionData] = await Promise.all([
      getConversationMetrics(this.db, agentId, period),
      getMessageMetrics(this.db, agentId, period),
      getWorkTimeMetrics(this.db, agentId, period),
      getSatisfactionMetrics(this.db, agentId, period)
    ]);

    const agentName = await getAgentName(this.db, agentId);

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

  // Get system performance metrics
  async getSystemPerformanceMetrics(
    period: { start: number; end: number }
  ) {
    const [apiData, dbData, integrationData] = await Promise.all([
      getApiMetrics(this.db, period),
      getDatabaseMetrics(this.db, period),
      getIntegrationMetrics(this.db, period)
    ]);

    return {
      period,
      apiMetrics: apiData,
      databaseMetrics: dbData,
      integrationMetrics: integrationData
    };
  }

  // Generate real-time dashboard data
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
    const now = nowMs();
    const oneHourAgo = now - 60 * 60 * 1000;

    const realTimeMetrics = await getRealTimeMetrics(this.db);
    const alerts = await checkAlerts(this.db);
    const trends = await getTrendData(this.db, oneHourAgo, now);

    return {
      realTimeMetrics,
      alerts,
      trends
    };
  }

  // Generate predictive analytics
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
    const historicalData: TimeSeriesData[] = await getHistoricalData(this.db, period);

    return {
      volumePrediction: predictMessageVolume(historicalData),
      resourcePrediction: predictResourceNeeds(historicalData),
      satisfactionPrediction: predictSatisfactionTrend(historicalData)
    };
  }

  // Generate custom report
  async generateCustomReport(
    reportConfig: {
      metrics: string[];
      filters: AnalyticsFilter;
      groupBy: string[];
      period: { start: number; end: number };
      format: 'json' | 'csv';
    }
  ): Promise<Record<string, unknown>[] | string> {
    return generateCustomReport(this.db, reportConfig);
  }
}
