// Period Comparison Service - 期間比較功能
// 提供當前期間與歷史期間的數據對比分析

import type { Database } from '@/db/drizzle-factory';
import { and, gte, lte, count, sql } from 'drizzle-orm';
import { conversations, messages, activities } from '@/db/schema';
import type { AnalyticsCacheService } from '@modules/analytics/services/analytics-cache-service';
import { nowISO } from '@/utils/timestamp'

/**
 * 期間定義
 */
export interface Period {
  start: string;  // ISO 8601 date string
  end: string;    // ISO 8601 date string
  label?: string; // 人類可讀的標籤，如 "本週" "上週"
}

/**
 * 比較數據結構
 */
export interface ComparisonData {
  current: number;           // 當前期間的值
  previous: number;          // 上一期間的值
  change: number;            // 絕對變化量
  changePercentage: number;  // 變化百分比
  trend: 'up' | 'down' | 'stable';  // 趨勢方向
  period: {
    current: Period;
    previous: Period;
  };
}

/**
 * 期間比較查詢參數
 */
export interface PeriodComparisonQuery {
  metric: string;              // 指標名稱，如 'total_conversations', 'total_messages'
  currentPeriod: Period;       // 當前期間
  previousPeriod?: Period;     // 上一期間（可選，如未提供則自動計算）
  filters?: {
    teamId?: number;
    userId?: number;
    conversationId?: string;
    platform?: string;
  };
}

/**
 * 多指標比較結果
 */
export interface MultiMetricComparison {
  metrics: {
    [metricName: string]: ComparisonData;
  };
  summary: {
    totalMetrics: number;
    improvedMetrics: number;     // 上升的指標數量
    declinedMetrics: number;     // 下降的指標數量
    stableMetrics: number;       // 穩定的指標數量
    overallTrend: 'positive' | 'negative' | 'neutral';
  };
}

/**
 * Period Comparison Service
 * 提供強大的期間比較分析功能：
 * - 自動計算上一期間
 * - 多種時間粒度支援（小時、天、週、月）
 * - 多指標批量比較
 * - 趨勢判定
 */
export class PeriodComparisonService {
  private cacheService?: AnalyticsCacheService;

  constructor(
    private db: Database,
    cacheService?: AnalyticsCacheService
  ) {
    this.cacheService = cacheService;
  }

  /**
   * 計算上一期間
   * 基於當前期間的長度，自動計算對應的上一期間
   */
  calculatePreviousPeriod(currentPeriod: Period): Period {
    const currentStart = new Date(currentPeriod.start);
    const currentEnd = new Date(currentPeriod.end);
    const durationMs = currentEnd.getTime() - currentStart.getTime();

    const previousEnd = new Date(currentStart.getTime() - 1000); // 當前開始的前一秒
    const previousStart = new Date(previousEnd.getTime() - durationMs);

    return {
      start: previousStart.toISOString(),
      end: previousEnd.toISOString(),
      label: this.generatePeriodLabel(previousStart, previousEnd, 'previous')
    };
  }

  /**
   * 生成期間標籤
   */
  private generatePeriodLabel(start: Date, end: Date, type: 'current' | 'previous'): string {
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours <= 1) {
      return type === 'current' ? '本小時' : '上小時';
    } else if (durationHours <= 24) {
      return type === 'current' ? '今天' : '昨天';
    } else if (durationHours <= 168) {
      return type === 'current' ? '本週' : '上週';
    } else if (durationHours <= 720) {
      return type === 'current' ? '本月' : '上月';
    } else {
      return type === 'current' ? '當前期間' : '上一期間';
    }
  }

  /**
   * 單一指標比較
   */
  async compareMetric(query: PeriodComparisonQuery): Promise<ComparisonData> {
    const { metric, currentPeriod, filters } = query;

    // 如果沒有提供上一期間，自動計算
    const previousPeriod = query.previousPeriod || this.calculatePreviousPeriod(currentPeriod);

    // 嘗試從快取獲取
    if (this.cacheService) {
      const cacheKey = this.cacheService.generateCacheKey(
        `comparison:${metric}`,
        { currentPeriod, previousPeriod, ...filters },
        {
          includeUserId: !!filters?.userId,
          includeTeamId: !!filters?.teamId
        }
      );

      const cached = await this.cacheService.get<ComparisonData>(cacheKey);
      if (cached) {
        console.log(`✅ Comparison cache HIT: ${metric}`);
        return cached.data;
      }
    }

    // 獲取當前期間的值
    const currentValue = await this.getMetricValue(metric, currentPeriod, filters);

    // 獲取上一期間的值
    const previousValue = await this.getMetricValue(metric, previousPeriod, filters);

    // 計算變化
    const comparison = this.buildComparisonData(currentValue, previousValue, currentPeriod, previousPeriod);

    // 儲存到快取 (TTL: 5-10 分鐘)
    if (this.cacheService) {
      const cacheKey = this.cacheService.generateCacheKey(
        `comparison:${metric}`,
        { currentPeriod, previousPeriod, ...filters },
        {
          includeUserId: !!filters?.userId,
          includeTeamId: !!filters?.teamId
        }
      );

      const ttl = this.getDurationBasedTTL(currentPeriod);
      await this.cacheService.set(
        cacheKey,
        { data: comparison, metadata: { processedAt: nowISO(), cacheHit: false } } as any,
        ttl
      );
      console.log(`💾 Cached comparison: ${metric} (TTL: ${ttl}s)`);
    }

    return comparison;
  }

  /**
   * 根據期間長度決定 TTL
   */
  private getDurationBasedTTL(period: Period): number {
    const durationMs = new Date(period.end).getTime() - new Date(period.start).getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours <= 1) {
      return 120; // 2 minutes for hourly data
    } else if (durationHours <= 24) {
      return 300; // 5 minutes for daily data
    } else if (durationHours <= 168) {
      return 600; // 10 minutes for weekly data
    } else {
      return 1800; // 30 minutes for monthly data
    }
  }

  /**
   * 多指標批量比較
   */
  async compareMultipleMetrics(
    metrics: string[],
    currentPeriod: Period,
    previousPeriod?: Period,
    filters?: PeriodComparisonQuery['filters']
  ): Promise<MultiMetricComparison> {
    const comparisonPromises = metrics.map(metric =>
      this.compareMetric({
        metric,
        currentPeriod,
        previousPeriod,
        filters
      })
    );

    const comparisons = await Promise.all(comparisonPromises);

    // 構建結果
    const metricsMap: { [key: string]: ComparisonData } = {};
    let improvedCount = 0;
    let declinedCount = 0;
    let stableCount = 0;

    metrics.forEach((metric, index) => {
      metricsMap[metric] = comparisons[index];

      switch (comparisons[index].trend) {
        case 'up':
          improvedCount++;
          break;
        case 'down':
          declinedCount++;
          break;
        case 'stable':
          stableCount++;
          break;
      }
    });

    // 判定整體趨勢
    let overallTrend: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (improvedCount > declinedCount && improvedCount >= metrics.length * 0.5) {
      overallTrend = 'positive';
    } else if (declinedCount > improvedCount && declinedCount >= metrics.length * 0.5) {
      overallTrend = 'negative';
    }

    return {
      metrics: metricsMap,
      summary: {
        totalMetrics: metrics.length,
        improvedMetrics: improvedCount,
        declinedMetrics: declinedCount,
        stableMetrics: stableCount,
        overallTrend
      }
    };
  }

  /**
   * 預設指標集比較（對話相關）
   */
  async compareConversationMetrics(
    currentPeriod: Period,
    previousPeriod?: Period,
    filters?: PeriodComparisonQuery['filters']
  ): Promise<MultiMetricComparison> {
    const metrics = [
      'total_conversations',
      'active_conversations',
      'closed_conversations',
      'average_resolution_time',
      'customer_satisfaction_score'
    ];

    return this.compareMultipleMetrics(metrics, currentPeriod, previousPeriod, filters);
  }

  /**
   * 預設指標集比較（消息相關）
   */
  async compareMessageMetrics(
    currentPeriod: Period,
    previousPeriod?: Period,
    filters?: PeriodComparisonQuery['filters']
  ): Promise<MultiMetricComparison> {
    const metrics = [
      'total_messages',
      'customer_messages',
      'agent_messages',
      'average_response_time',
      'messages_per_conversation'
    ];

    return this.compareMultipleMetrics(metrics, currentPeriod, previousPeriod, filters);
  }

  /**
   * 預設指標集比較（用戶活動相關）
   */
  async compareUserActivityMetrics(
    currentPeriod: Period,
    previousPeriod?: Period,
    filters?: PeriodComparisonQuery['filters']
  ): Promise<MultiMetricComparison> {
    const metrics = [
      'active_users',
      'total_activities',
      'average_session_duration',
      'user_engagement_rate'
    ];

    return this.compareMultipleMetrics(metrics, currentPeriod, previousPeriod, filters);
  }

  /**
   * 獲取指標值（核心查詢方法）
   */
  private async getMetricValue(
    metric: string,
    period: Period,
    filters?: PeriodComparisonQuery['filters']
  ): Promise<number> {
    try {
      switch (metric) {
        // ========== 對話相關指標 ==========
        case 'total_conversations':
          return await this.getTotalConversations(period, filters);

        case 'active_conversations':
          return await this.getActiveConversations(period, filters);

        case 'closed_conversations':
          return await this.getClosedConversations(period, filters);

        case 'average_resolution_time':
          return await this.getAverageResolutionTime(period, filters);

        case 'customer_satisfaction_score':
          return await this.getCustomerSatisfactionScore(period, filters);

        // ========== 消息相關指標 ==========
        case 'total_messages':
          return await this.getTotalMessages(period, filters);

        case 'customer_messages':
          return await this.getCustomerMessages(period, filters);

        case 'agent_messages':
          return await this.getAgentMessages(period, filters);

        case 'average_response_time':
          return await this.getAverageResponseTime(period, filters);

        case 'messages_per_conversation':
          return await this.getMessagesPerConversation(period, filters);

        // ========== 用戶活動相關指標 ==========
        case 'active_users':
          return await this.getActiveUsers(period, filters);

        case 'total_activities':
          return await this.getTotalActivities(period, filters);

        case 'average_session_duration':
          return await this.getAverageSessionDuration(period, filters);

        case 'user_engagement_rate':
          return await this.getUserEngagementRate(period, filters);

        default:
          console.warn(`Unknown metric: ${metric}`);
          return 0;
      }
    } catch (error) {
      console.error(`Error getting metric value for ${metric}:`, error);
      return 0;
    }
  }

  // ============ 對話指標實作 ============

  private async getTotalConversations(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = this.buildWhereConditions('conversations', period, filters);

    const result = await this.db
      .select({ count: count() })
      .from(conversations)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getActiveConversations(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = [
      ...this.buildWhereConditions('conversations', period, filters),
      sql`${conversations.status} = 'active'`
    ];

    const result = await this.db
      .select({ count: count() })
      .from(conversations)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getClosedConversations(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = [
      ...this.buildWhereConditions('conversations', period, filters),
      sql`${conversations.status} = 'closed'`
    ];

    const result = await this.db
      .select({ count: count() })
      .from(conversations)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getAverageResolutionTime(_period: Period, _filters?: PeriodComparisonQuery['filters']): Promise<number> {
    // TODO: 需要 resolution_time 欄位或計算邏輯
    return 0;
  }

  private async getCustomerSatisfactionScore(_period: Period, _filters?: PeriodComparisonQuery['filters']): Promise<number> {
    // TODO: 需要評分系統支援
    return 0;
  }

  // ============ 消息指標實作 ============

  private async getTotalMessages(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = this.buildWhereConditions('messages', period, filters);

    const result = await this.db
      .select({ count: count() })
      .from(messages)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getCustomerMessages(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = [
      ...this.buildWhereConditions('messages', period, filters),
      sql`${messages.senderType} = 'customer'`
    ];

    const result = await this.db
      .select({ count: count() })
      .from(messages)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getAgentMessages(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = [
      ...this.buildWhereConditions('messages', period, filters),
      sql`${messages.senderType} = 'agent'`
    ];

    const result = await this.db
      .select({ count: count() })
      .from(messages)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getAverageResponseTime(_period: Period, _filters?: PeriodComparisonQuery['filters']): Promise<number> {
    // TODO: 需要計算消息間的時間差
    return 0;
  }

  private async getMessagesPerConversation(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const totalMessages = await this.getTotalMessages(period, filters);
    const totalConversations = await this.getTotalConversations(period, filters);

    return totalConversations > 0 ? Math.round((totalMessages / totalConversations) * 100) / 100 : 0;
  }

  // ============ 用戶活動指標實作 ============

  private async getActiveUsers(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = this.buildWhereConditions('activities', period, filters);

    const result = await this.db
      .select({
        uniqueUsers: sql<number>`COUNT(DISTINCT ${activities.userId})`
      })
      .from(activities)
      .where(and(...conditions));

    return result[0]?.uniqueUsers || 0;
  }

  private async getTotalActivities(period: Period, filters?: PeriodComparisonQuery['filters']): Promise<number> {
    const conditions = this.buildWhereConditions('activities', period, filters);

    const result = await this.db
      .select({ count: count() })
      .from(activities)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  private async getAverageSessionDuration(_period: Period, _filters?: PeriodComparisonQuery['filters']): Promise<number> {
    // TODO: 需要 session 持續時間計算
    return 0;
  }

  private async getUserEngagementRate(_period: Period, _filters?: PeriodComparisonQuery['filters']): Promise<number> {
    // TODO: 需要定義 engagement 計算邏輯
    return 0;
  }

  // ============ 輔助方法 ============

  /**
   * 構建 WHERE 條件
   */
  private buildWhereConditions(
    table: 'conversations' | 'messages' | 'activities',
    period: Period,
    filters?: PeriodComparisonQuery['filters']
  ): any[] {
    const conditions = [];

    // 時間範圍條件
    const timeField = table === 'conversations' ? conversations.createdAt :
                      table === 'messages' ? messages.createdAt :
                      activities.createdAt;

    conditions.push(gte(timeField, period.start));
    conditions.push(lte(timeField, period.end));

    // 篩選條件
    if (filters?.teamId) {
      if (table === 'conversations') {
        conditions.push(sql`${conversations.assignedTeamId} = ${filters.teamId}`);
      }
    }

    if (filters?.userId) {
      if (table === 'activities') {
        conditions.push(sql`${activities.userId} = ${filters.userId}`);
      }
    }

    if (filters?.conversationId) {
      if (table === 'messages') {
        conditions.push(sql`${messages.conversationId} = ${filters.conversationId}`);
      }
    }

    return conditions;
  }

  /**
   * 構建比較數據
   */
  private buildComparisonData(
    current: number,
    previous: number,
    currentPeriod: Period,
    previousPeriod: Period
  ): ComparisonData {
    const change = current - previous;
    const changePercentage = previous === 0
      ? (current > 0 ? 100 : 0)
      : Math.round((change / previous) * 10000) / 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercentage) < 5) {
      trend = 'stable';
    } else if (changePercentage > 0) {
      trend = 'up';
    } else {
      trend = 'down';
    }

    return {
      current,
      previous,
      change,
      changePercentage,
      trend,
      period: {
        current: currentPeriod,
        previous: previousPeriod
      }
    };
  }

  /**
   * 格式化比較結果為人類可讀文本
   */
  formatComparisonText(comparison: ComparisonData): string {
    const direction = comparison.trend === 'up' ? '上升' :
                      comparison.trend === 'down' ? '下降' : '保持穩定';
    const changeText = Math.abs(comparison.changePercentage).toFixed(2);

    return `${comparison.current} (vs ${comparison.previous}), ${direction} ${changeText}%`;
  }
}