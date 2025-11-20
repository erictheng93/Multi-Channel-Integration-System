// Analytics Core Service - 統一分析服務核心實現
// 整合來自 session、activities、enterprise 模組的分析功能

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, asc, sql, count, avg, sum, min, max, gte, lte } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Bindings } from '@/types';
import type { ServiceResponse } from '@/types/services';

import type {
  AnalyticsServiceInterface,
  AnalyticsResult,
  ConversationAnalyticsQuery,
  ConversationAnalytics,
  MessageAnalyticsQuery,
  MessageAnalytics,
  UserAnalyticsQuery,
  UserAnalytics,
  PerformanceAnalyticsQuery,
  PerformanceAnalytics,
  CustomAnalyticsQuery,
  ExportQuery,
  ExportResult,
  AnalyticsServiceConfig,
  TimeSeriesData,
  DistributionData,
  ComparisonData
} from '../types/analytics-types';

import {
  AnalyticsError,
  QueryValidationError,
  DataProcessingError
} from '../types/analytics-types';

import {
  conversationSessions,
  messages,
  activities,
  agents,
  customers,
  conversations
} from '@/db/schema';

import { AnalyticsCacheService } from '@modules/analytics/services/analytics-cache-service';
import { PeriodComparisonService } from '@modules/analytics/services/period-comparison-service';
import type { Period, ComparisonData as PeriodComparisonData } from '@modules/analytics/services/period-comparison-service';

/**
 * 統一分析服務核心實現
 * 整合原有的 SessionAnalyticsService, ActivityStatsService, EnterpriseAnalyticsEngine
 */
export class AnalyticsService implements AnalyticsServiceInterface {
  private db: DrizzleD1Database;
  private kv?: Bindings['KV'];
  private env: any;
  private config: AnalyticsServiceConfig;
  private cacheService?: AnalyticsCacheService;
  private comparisonService: PeriodComparisonService;

  constructor(config: AnalyticsServiceConfig) {
    this.db = config.database;
    this.kv = config.kv;
    this.env = config.env;
    this.config = config;

    // 初始化快取服務（如果有 KV）
    if (this.kv) {
      this.cacheService = new AnalyticsCacheService(this.kv as any, {
        defaultTTL: 300,    // 5 minutes
        shortTTL: 60,       // 1 minute
        longTTL: 1800,      // 30 minutes
        enabled: true
      });
    }

    // 初始化期間比較服務 (傳遞快取服務)
    this.comparisonService = new PeriodComparisonService(this.db, this.cacheService);
  }

  /**
   * 獲取對話分析數據
   * 整合原有的 SessionAnalyticsService.getSessionStats 功能
   */
  async getConversationAnalytics(query: ConversationAnalyticsQuery): Promise<ServiceResponse<ConversationAnalytics>> {
    const startTime = Date.now();

    try {
      // 驗證查詢參數
      this.validateQuery(query);

      // 嘗試從快取獲取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('conversation', query, {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });

        const cachedResult = await this.cacheService.get<ConversationAnalytics>(cacheKey);
        if (cachedResult && cachedResult.success) {
          console.log(`✅ Cache HIT for conversation analytics: ${cacheKey}`);
          // 將 AnalyticsResult 轉換為 ServiceResponse
          return {
            success: cachedResult.success,
            data: cachedResult.data,
            metadata: cachedResult.metadata
          };
        }

        console.log(`❌ Cache MISS for conversation analytics: ${cacheKey}`);
      }

      // 構建時間範圍
      const { startDate, endDate } = this.buildTimeRange(query.timeRange, query.startDate, query.endDate);

      // 構建篩選條件
      const whereConditions = this.buildWhereConditions(query.filters, {
        startDate,
        endDate,
        table: 'conversations'
      });

      // 獲取摘要統計
      const summary = await this.getConversationSummary(whereConditions, query.metrics || []);

      // 獲取趨勢數據
      const trends = await this.getConversationTrends(whereConditions, query.timeRange);

      // 獲取分佈數據
      const distributions = await this.getConversationDistributions(whereConditions);

      // 獲取比較數據（根據查詢參數決定）
      let comparisons: ComparisonData[] | undefined;
      if (query.filters?.includePrevious || query.timeRange) {
        comparisons = await this.getConversationComparisons(whereConditions, query.timeRange);
      }

      const result: ConversationAnalytics = {
        summary,
        trends,
        distributions,
        comparisons
      };

      const serviceResponse: ServiceResponse<ConversationAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: summary.totalConversations,
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: this.getAggregationLevel(query.timeRange)
        }
      };

      // 儲存到快取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('conversation', query, {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });

        // 將 ServiceResponse 轉換為 AnalyticsResult 進行緩存
        const analyticsResult: AnalyticsResult<ConversationAnalytics> = {
          success: serviceResponse.success,
          data: serviceResponse.data!,
          metadata: serviceResponse.metadata as any
        };

        const ttl = this.cacheService.getTTLForQueryType('conversation', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        console.log(`💾 Cached conversation analytics with TTL ${ttl}s: ${cacheKey}`);
      }

      return serviceResponse;

    } catch (error) {
      console.error('Failed to get conversation analytics:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          errorCode: error instanceof QueryValidationError ? 'VALIDATION_ERROR' :
                     error instanceof DataProcessingError ? 'PROCESSING_ERROR' :
                     'ANALYTICS_ERROR',
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 獲取消息分析數據
   * 整合原有的消息統計功能
   */
  async getMessageAnalytics(query: MessageAnalyticsQuery): Promise<ServiceResponse<MessageAnalytics>> {
    const startTime = Date.now();

    try {
      this.validateQuery(query);

      // 嘗試從快取獲取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('message', query, {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });

        const cachedResult = await this.cacheService.get<MessageAnalytics>(cacheKey);
        if (cachedResult && cachedResult.success) {
          console.log(`✅ Cache HIT for message analytics: ${cacheKey}`);
          // 將 AnalyticsResult 轉換為 ServiceResponse
          return {
            success: cachedResult.success,
            data: cachedResult.data,
            metadata: cachedResult.metadata
          };
        }

        console.log(`❌ Cache MISS for message analytics: ${cacheKey}`);
      }

      const { startDate, endDate } = this.buildTimeRange(query.timeRange, query.startDate, query.endDate);
      const whereConditions = this.buildWhereConditions(query.filters, {
        startDate,
        endDate,
        table: 'messages'
      });

      // 獲取消息摘要統計
      const summary = await this.getMessageSummary(whereConditions, query.metrics || []);

      // 獲取消息量趨勢
      const volume = await this.getMessageVolumeTrends(whereConditions, query.timeRange);

      // 獲取消息類型分佈
      const types = await this.getMessageTypeDistribution(whereConditions);

      // 獲取渠道分佈
      const channels = await this.getMessageChannelDistribution(whereConditions);

      // 獲取情感分佈（如果有情感分析）
      const sentiments = await this.getMessageSentimentDistribution(whereConditions);

      const result: MessageAnalytics = {
        summary,
        volume,
        types,
        channels,
        sentiments
      };

      const serviceResponse: ServiceResponse<MessageAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: summary.totalMessages,
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: this.getAggregationLevel(query.timeRange)
        }
      };

      // 儲存到快取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('message', query, {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });

        // 將 ServiceResponse 轉換為 AnalyticsResult 進行緩存
        const analyticsResult: AnalyticsResult<MessageAnalytics> = {
          success: serviceResponse.success,
          data: serviceResponse.data!,
          metadata: serviceResponse.metadata as any
        };

        const ttl = this.cacheService.getTTLForQueryType('message', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        console.log(`💾 Cached message analytics with TTL ${ttl}s: ${cacheKey}`);
      }

      return serviceResponse;

    } catch (error) {
      console.error('Failed to get message analytics:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          errorCode: error instanceof QueryValidationError ? 'VALIDATION_ERROR' :
                     error instanceof DataProcessingError ? 'PROCESSING_ERROR' :
                     'ANALYTICS_ERROR',
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 獲取用戶分析數據
   * 整合原有的 ActivityStatsService 功能
   */
  async getUserAnalytics(query: UserAnalyticsQuery): Promise<AnalyticsResult<UserAnalytics>> {
    const startTime = Date.now();

    try {
      this.validateQuery(query);

      // 嘗試從快取獲取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('user', query, {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });

        const cachedResult = await this.cacheService.get<UserAnalytics>(cacheKey);
        if (cachedResult) {
          console.log(`✅ Cache HIT for user analytics: ${cacheKey}`);
          return cachedResult;
        }

        console.log(`❌ Cache MISS for user analytics: ${cacheKey}`);
      }

      const { startDate, endDate } = this.buildTimeRange(query.timeRange, query.startDate, query.endDate);
      const whereConditions = this.buildWhereConditions(query.filters, {
        startDate,
        endDate,
        table: 'users'
      });

      // 獲取用戶摘要統計
      const summary = await this.getUserSummary(whereConditions, query.metrics || [], query.userType);

      // 獲取用戶活動趨勢
      const activity = await this.getUserActivityTrends(whereConditions, query.timeRange);

      // 獲取用戶性能數據
      const performance = await this.getUserPerformanceData(whereConditions, query.userType);

      // 獲取工作負載數據
      const workload = await this.getUserWorkloadData(whereConditions, query.userType);

      const result: UserAnalytics = {
        summary,
        activity,
        performance,
        workload
      };

      const analyticsResult: AnalyticsResult<UserAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: summary.totalUsers,
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: this.getAggregationLevel(query.timeRange)
        }
      };

      // 儲存到快取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('user', query, {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });

        const ttl = this.cacheService.getTTLForQueryType('user', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        console.log(`💾 Cached user analytics with TTL ${ttl}s: ${cacheKey}`);
      }

      return analyticsResult;

    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      throw new DataProcessingError(
        `Failed to get user analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, query }
      );
    }
  }

  /**
   * 獲取性能分析數據
   * 整合原有的 EnterpriseAnalyticsEngine 功能
   */
  async getPerformanceAnalytics(query: PerformanceAnalyticsQuery): Promise<AnalyticsResult<PerformanceAnalytics>> {
    const startTime = Date.now();

    try {
      this.validateQuery(query);

      // 嘗試從快取獲取
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('performance', query);

        const cachedResult = await this.cacheService.get<PerformanceAnalytics>(cacheKey);
        if (cachedResult) {
          console.log(`✅ Cache HIT for performance analytics: ${cacheKey}`);
          return cachedResult;
        }

        console.log(`❌ Cache MISS for performance analytics: ${cacheKey}`);
      }

      const { startDate, endDate } = this.buildTimeRange(query.timeRange, query.startDate, query.endDate);

      // 獲取性能摘要統計
      const summary = await this.getPerformanceSummary(startDate, endDate, query.metrics || []);

      // 獲取性能趨勢數據
      const trends = await this.getPerformanceTrends(startDate, endDate, query.timeRange);

      // 識別瓶頸
      const bottlenecks = await this.identifyBottlenecks(startDate, endDate);

      // 生成建議
      const recommendations = await this.generateRecommendations(summary, bottlenecks);

      const result: PerformanceAnalytics = {
        summary,
        trends,
        bottlenecks,
        recommendations
      };

      const analyticsResult: AnalyticsResult<PerformanceAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: trends.length,
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: this.getAggregationLevel(query.timeRange)
        }
      };

      // 儲存到快取（性能數據使用較短的 TTL）
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('performance', query);
        const ttl = this.cacheService.getTTLForQueryType('performance', query.timeRange);

        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        console.log(`💾 Cached performance analytics with TTL ${ttl}s: ${cacheKey}`);
      }

      return analyticsResult;

    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      throw new DataProcessingError(
        `Failed to get performance analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, query }
      );
    }
  }

  /**
   * 執行自定義分析查詢
   */
  async getCustomAnalytics(query: CustomAnalyticsQuery): Promise<AnalyticsResult<any>> {
    const startTime = Date.now();

    try {
      this.validateQuery(query);

      // 執行自定義查詢
      const result = await this.executeCustomQuery(query);

      return {
        success: true,
        data: result,
        metadata: {
          totalRecords: Array.isArray(result) ? result.length : 1,
          processedAt: new Date().toISOString(),
          queryTime: Date.now() - startTime,
          cacheHit: false
        }
      };

    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      throw new DataProcessingError(
        `Failed to execute custom analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, query }
      );
    }
  }

  /**
   * 導出分析數據
   */
  async exportAnalytics(query: ExportQuery): Promise<ServiceResponse<ExportResult>> {
    try {
      // 根據查詢類型獲取數據
      let data: any;
      const metrics = query.metrics || [];

      // 檢查是否包含對話相關指標
      const hasConversationMetrics = metrics.some(m =>
        m.includes('conversation') || m === 'total_conversations' || m === 'active_conversations'
      );

      // 檢查是否包含消息相關指標
      const hasMessageMetrics = metrics.some(m =>
        m.includes('message') || m === 'total_messages' || m === 'messages_per_hour'
      );

      if (hasConversationMetrics) {
        data = await this.getConversationAnalytics(query as ConversationAnalyticsQuery);
      } else if (hasMessageMetrics) {
        data = await this.getMessageAnalytics(query as MessageAnalyticsQuery);
      } else if (metrics.length === 0) {
        // 如果沒有指定指標，默認使用對話分析
        data = await this.getConversationAnalytics({
          ...query,
          metrics: ['total_conversations']
        } as ConversationAnalyticsQuery);
      } else {
        throw new QueryValidationError('Invalid export query: missing or invalid metrics');
      }

      // 生成文件
      const fileUrl = await this.generateExportFile(data, query);

      const exportResult: ExportResult = {
        fileUrl,
        fileName: query.fileName || `analytics_export_${Date.now()}.${query.format}`,
        fileSize: 0, // TODO: 計算實際文件大小
        format: query.format,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小時後過期
        downloadCount: 0
      };

      return {
        success: true,
        data: exportResult
      };

    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      throw new DataProcessingError(
        `Failed to export analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, query }
      );
    }
  }

  // 私有方法實現 ...

  private validateQuery(query: any): void {
    if (!query.timeRange && !query.startDate) {
      throw new QueryValidationError('Either timeRange or startDate must be provided');
    }

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      if (start > end) {
        throw new QueryValidationError('startDate must be before or equal to endDate');
      }
    }
  }

  private buildTimeRange(
    timeRange?: string,
    startDate?: string,
    endDate?: string
  ): { startDate: string; endDate: string } {
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    const now = new Date();
    let start: Date;

    switch (timeRange) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: start.toISOString(),
      endDate: now.toISOString()
    };
  }

  private buildWhereConditions(filters: any, context: any): any[] {
    const conditions = [];

    // 時間範圍條件
    if (context.startDate) {
      conditions.push(gte(
        context.table === 'conversations' ? conversations.createdAt :
        context.table === 'messages' ? messages.createdAt :
        activities.createdAt,
        context.startDate
      ));
    }

    if (context.endDate) {
      conditions.push(lte(
        context.table === 'conversations' ? conversations.createdAt :
        context.table === 'messages' ? messages.createdAt :
        activities.createdAt,
        context.endDate
      ));
    }

    // 篩選條件
    if (filters?.teamId) {
      // 根據表添加適當的團隊篩選
      if (context.table === 'conversations') {
        conditions.push(eq(conversations.assignedTeamId, filters.teamId));
      }
    }

    if (filters?.userId) {
      // 根據表添加適當的用戶篩選
      conditions.push(eq(activities.userId, filters.userId));
    }

    if (filters?.conversationId) {
      if (context.table === 'messages') {
        conditions.push(eq(messages.conversationId, filters.conversationId));
      }
    }

    // Platform filtering - requires JOIN with customers table
    if (filters?.platform && context.table === 'conversations') {
      // Use EXISTS subquery to filter conversations by customer platform
      // This is more efficient than JOIN for filtering purposes
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${customers}
          WHERE ${customers.id} = ${conversations.customerId}
          AND ${customers.platform} = ${filters.platform}
        )`
      );
    }

    return conditions;
  }

  private async getConversationSummary(whereConditions: any[], metrics: string[]): Promise<any> {
    // 實現對話摘要統計
    const results = await this.db
      .select({
        totalConversations: count(),
        // TODO: 添加更多統計指標
      })
      .from(conversations)
      .where(and(...whereConditions));

    return {
      totalConversations: results[0]?.totalConversations || 0,
      activeConversations: 0,
      closedConversations: 0,
      averageDuration: 0,
      averageMessagesPerConversation: 0,
      averageFirstResponseTime: 0,
      averageResolutionTime: 0,
      customerSatisfactionScore: 0,
      period: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
      }
    };
  }

  private async getConversationTrends(whereConditions: any[], timeRange: string): Promise<TimeSeriesData[]> {
    try {
      // 根據時間範圍決定聚合級別
      const aggregation = this.getAggregationInterval(timeRange);
      const { startDate, endDate } = this.buildTimeRange(timeRange);

      // 使用 SQL 進行時間聚合
      let timeGroupSQL: any;
      switch (aggregation) {
        case 'hourly':
          timeGroupSQL = sql`strftime('%Y-%m-%d %H:00:00', ${conversations.createdAt})`;
          break;
        case 'daily':
          timeGroupSQL = sql`strftime('%Y-%m-%d', ${conversations.createdAt})`;
          break;
        case 'weekly':
          timeGroupSQL = sql`strftime('%Y-W%W', ${conversations.createdAt})`;
          break;
        case 'monthly':
          timeGroupSQL = sql`strftime('%Y-%m', ${conversations.createdAt})`;
          break;
        default:
          timeGroupSQL = sql`strftime('%Y-%m-%d %H:00:00', ${conversations.createdAt})`;
      }

      // 查詢時間序列數據
      const trendData = await this.db
        .select({
          timePeriod: timeGroupSQL.as('time_period'),
          count: count(),
          activeCount: count(sql`CASE WHEN ${conversations.status} = 'active' THEN 1 END`),
          closedCount: count(sql`CASE WHEN ${conversations.status} = 'closed' THEN 1 END`),
        })
        .from(conversations)
        .where(and(...whereConditions))
        .groupBy(timeGroupSQL)
        .orderBy(asc(timeGroupSQL));

      // 轉換為 TimeSeriesData 格式
      return trendData.map((row: any) => ({
        timestamp: row.timePeriod,
        value: row.count || 0,
        label: this.formatTimeLabel(row.timePeriod, aggregation),
        metadata: {
          activeConversations: row.activeCount || 0,
          closedConversations: row.closedCount || 0,
          aggregation
        }
      }));
    } catch (error) {
      console.error('Error getting conversation trends:', error);
      return [];
    }
  }

  private getAggregationInterval(timeRange: string): 'hourly' | 'daily' | 'weekly' | 'monthly' {
    switch (timeRange) {
      case '1h':
      case '6h':
      case '24h':
        return 'hourly';
      case '7d':
        return 'daily';
      case '30d':
        return 'weekly';
      case '90d':
      case '1y':
        return 'monthly';
      default:
        return 'daily';
    }
  }

  private formatTimeLabel(timestamp: string, aggregation: string): string {
    const date = new Date(timestamp);
    switch (aggregation) {
      case 'hourly':
        return date.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit' });
      case 'daily':
        return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
      case 'weekly':
        return `Week ${timestamp.split('W')[1]}`;
      case 'monthly':
        return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
      default:
        return timestamp;
    }
  }

  private async getConversationDistributions(whereConditions: any[]): Promise<DistributionData[]> {
    try {
      const distributions: DistributionData[] = [];

      // 獲取總數用於計算百分比
      const totalResult = await this.db
        .select({ total: count() })
        .from(conversations)
        .where(and(...whereConditions));

      const total = totalResult[0]?.total || 0;
      if (total === 0) return [];

      // 1. 狀態分佈
      const statusDist = await this.db
        .select({
          category: conversations.status,
          count: count()
        })
        .from(conversations)
        .where(and(...whereConditions))
        .groupBy(conversations.status);

      statusDist.forEach((row: any) => {
        distributions.push({
          category: 'status',
          value: row.count || 0,
          percentage: Math.round((row.count / total) * 10000) / 100,
          label: this.getStatusLabel(row.category),
          color: this.getStatusColor(row.category)
        });
      });

      // 2. 優先級分佈
      const priorityDist = await this.db
        .select({
          category: conversations.priority,
          count: count()
        })
        .from(conversations)
        .where(and(...whereConditions))
        .groupBy(conversations.priority);

      priorityDist.forEach((row: any) => {
        distributions.push({
          category: 'priority',
          value: row.count || 0,
          percentage: Math.round((row.count / total) * 10000) / 100,
          label: this.getPriorityLabel(row.category),
          color: this.getPriorityColor(row.category)
        });
      });

      // 3. 團隊分佈（如果有分配）
      const teamDist = await this.db
        .select({
          category: conversations.assignedTeamId,
          count: count()
        })
        .from(conversations)
        .where(and(...whereConditions))
        .groupBy(conversations.assignedTeamId);

      teamDist.forEach((row: any) => {
        const teamId = row.category;
        distributions.push({
          category: 'team',
          value: row.count || 0,
          percentage: Math.round((row.count / total) * 10000) / 100,
          label: teamId ? `Team ${teamId}` : 'Unassigned',
          color: this.getTeamColor(teamId)
        });
      });

      return distributions;
    } catch (error) {
      console.error('Error getting conversation distributions:', error);
      return [];
    }
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'active': '進行中',
      'pending': '待處理',
      'closed': '已關閉'
    };
    return labels[status] || status;
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'active': '#10b981',
      'pending': '#f59e0b',
      'closed': '#6b7280'
    };
    return colors[status] || '#9ca3af';
  }

  private getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      'low': '低優先級',
      'normal': '一般',
      'high': '高優先級',
      'urgent': '緊急'
    };
    return labels[priority] || priority;
  }

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'low': '#3b82f6',
      'normal': '#10b981',
      'high': '#f59e0b',
      'urgent': '#ef4444'
    };
    return colors[priority] || '#9ca3af';
  }

  private getTeamColor(teamId: number | null): string {
    if (!teamId) return '#9ca3af';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[teamId % colors.length];
  }

  private async getConversationComparisons(whereConditions: any[], timeRange: string): Promise<ComparisonData[]> {
    try {
      // 使用 Period Comparison Service 進行比較
      const { currentPeriod, previousPeriod } = this.calculatePreviousPeriod(timeRange);

      // 使用新的比較服務獲取多指標比較
      const comparison = await this.comparisonService.compareConversationMetrics(
        currentPeriod,
        previousPeriod
      );

      // 轉換為 ComparisonData 格式
      const comparisons: ComparisonData[] = [];

      // 總對話數比較
      if (comparison.metrics.total_conversations) {
        comparisons.push(this.convertPeriodComparisonToComparisonData(
          comparison.metrics.total_conversations
        ));
      }

      // 活躍對話比較
      if (comparison.metrics.active_conversations) {
        comparisons.push(this.convertPeriodComparisonToComparisonData(
          comparison.metrics.active_conversations
        ));
      }

      // 已關閉對話比較
      if (comparison.metrics.closed_conversations) {
        comparisons.push(this.convertPeriodComparisonToComparisonData(
          comparison.metrics.closed_conversations
        ));
      }

      return comparisons;
    } catch (error) {
      console.error('Error getting conversation comparisons:', error);
      return [];
    }
  }

  /**
   * 轉換 PeriodComparisonData 為 ComparisonData 格式
   */
  private convertPeriodComparisonToComparisonData(
    periodComparison: PeriodComparisonData
  ): ComparisonData {
    return {
      current: periodComparison.current,
      previous: periodComparison.previous,
      change: periodComparison.change,
      changePercentage: periodComparison.changePercentage,
      trend: periodComparison.trend,
      period: periodComparison.period
    };
  }

  private buildComparisonData(
    metric: string,
    current: number,
    previous: number,
    currentPeriod: { start: string; end: string },
    previousPeriod: { start: string; end: string }
  ): ComparisonData {
    const change = current - previous;
    const changePercentage = previous === 0 ? (current > 0 ? 100 : 0) : (change / previous) * 100;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercentage > 5) trend = 'up';
    else if (changePercentage < -5) trend = 'down';

    return {
      current,
      previous,
      change,
      changePercentage: Math.round(changePercentage * 100) / 100,
      trend,
      period: {
        current: currentPeriod,
        previous: previousPeriod
      }
    };
  }

  private calculatePreviousPeriod(timeRange: string): {
    currentPeriod: { start: string; end: string };
    previousPeriod: { start: string; end: string };
  } {
    const now = new Date();
    let currentStart: Date;
    let durationMs: number;

    switch (timeRange) {
      case '1h':
        durationMs = 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
        break;
      case '6h':
        durationMs = 6 * 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
        break;
      case '24h':
        durationMs = 24 * 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
        break;
      case '7d':
        durationMs = 7 * 24 * 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
        break;
      case '30d':
        durationMs = 30 * 24 * 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
        break;
      case '90d':
        durationMs = 90 * 24 * 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
        break;
      default:
        durationMs = 7 * 24 * 60 * 60 * 1000;
        currentStart = new Date(now.getTime() - durationMs);
    }

    const previousStart = new Date(currentStart.getTime() - durationMs);
    const previousEnd = new Date(currentStart.getTime() - 1000); // 1秒前

    return {
      currentPeriod: {
        start: currentStart.toISOString(),
        end: now.toISOString()
      },
      previousPeriod: {
        start: previousStart.toISOString(),
        end: previousEnd.toISOString()
      }
    };
  }

  private async getMessageSummary(whereConditions: any[], metrics: string[]): Promise<any> {
    // 實現消息摘要統計
    return {
      totalMessages: 0,
      messagesPerHour: 0,
      averageResponseTime: 0,
      messageTypes: {},
      channelDistribution: {},
      sentimentDistribution: {}
    };
  }

  private async getMessageVolumeTrends(whereConditions: any[], timeRange: string): Promise<TimeSeriesData[]> {
    try {
      // 根據時間範圍決定聚合級別
      const aggregation = this.getAggregationInterval(timeRange);

      // 使用 SQL 進行時間聚合
      let timeGroupSQL: any;
      switch (aggregation) {
        case 'hourly':
          timeGroupSQL = sql`strftime('%Y-%m-%d %H:00:00', ${messages.createdAt})`;
          break;
        case 'daily':
          timeGroupSQL = sql`strftime('%Y-%m-%d', ${messages.createdAt})`;
          break;
        case 'weekly':
          timeGroupSQL = sql`strftime('%Y-W%W', ${messages.createdAt})`;
          break;
        case 'monthly':
          timeGroupSQL = sql`strftime('%Y-%m', ${messages.createdAt})`;
          break;
        default:
          timeGroupSQL = sql`strftime('%Y-%m-%d %H:00:00', ${messages.createdAt})`;
      }

      // 查詢消息量趨勢
      const volumeData = await this.db
        .select({
          timePeriod: timeGroupSQL.as('time_period'),
          totalMessages: count(),
          customerMessages: count(sql`CASE WHEN ${messages.senderType} = 'customer' THEN 1 END`),
          agentMessages: count(sql`CASE WHEN ${messages.senderType} = 'agent' THEN 1 END`),
        })
        .from(messages)
        .where(and(...whereConditions))
        .groupBy(timeGroupSQL)
        .orderBy(asc(timeGroupSQL));

      // 轉換為 TimeSeriesData 格式
      return volumeData.map((row: any) => ({
        timestamp: row.timePeriod,
        value: row.totalMessages || 0,
        label: this.formatTimeLabel(row.timePeriod, aggregation),
        metadata: {
          customerMessages: row.customerMessages || 0,
          agentMessages: row.agentMessages || 0,
          aggregation
        }
      }));
    } catch (error) {
      console.error('Error getting message volume trends:', error);
      return [];
    }
  }

  private async getMessageTypeDistribution(whereConditions: any[]): Promise<DistributionData[]> {
    return [];
  }

  private async getMessageChannelDistribution(whereConditions: any[]): Promise<DistributionData[]> {
    return [];
  }

  private async getMessageSentimentDistribution(whereConditions: any[]): Promise<DistributionData[]> {
    return [];
  }

  private async getUserSummary(whereConditions: any[], metrics: string[], userType?: string): Promise<any> {
    return {
      totalUsers: 0,
      activeUsers: 0,
      averageSessionDuration: 0,
      averageActivityPerDay: 0,
      topPerformers: []
    };
  }

  private async getUserActivityTrends(whereConditions: any[], timeRange: string): Promise<TimeSeriesData[]> {
    try {
      // 根據時間範圍決定聚合級別
      const aggregation = this.getAggregationInterval(timeRange);

      // 使用 SQL 進行時間聚合
      let timeGroupSQL: any;
      switch (aggregation) {
        case 'hourly':
          timeGroupSQL = sql`strftime('%Y-%m-%d %H:00:00', ${activities.createdAt})`;
          break;
        case 'daily':
          timeGroupSQL = sql`strftime('%Y-%m-%d', ${activities.createdAt})`;
          break;
        case 'weekly':
          timeGroupSQL = sql`strftime('%Y-W%W', ${activities.createdAt})`;
          break;
        case 'monthly':
          timeGroupSQL = sql`strftime('%Y-%m', ${activities.createdAt})`;
          break;
        default:
          timeGroupSQL = sql`strftime('%Y-%m-%d %H:00:00', ${activities.createdAt})`;
      }

      // 查詢用戶活動趨勢
      const activityData = await this.db
        .select({
          timePeriod: timeGroupSQL.as('time_period'),
          totalActivities: count(),
          uniqueUsers: sql`COUNT(DISTINCT ${activities.userId})`.as('unique_users'),
          messageActions: count(sql`CASE WHEN ${activities.action} LIKE '%message%' THEN 1 END`),
          conversationActions: count(sql`CASE WHEN ${activities.action} LIKE '%conversation%' THEN 1 END`),
        })
        .from(activities)
        .where(and(...whereConditions))
        .groupBy(timeGroupSQL)
        .orderBy(asc(timeGroupSQL));

      // 轉換為 TimeSeriesData 格式
      return activityData.map((row: any) => ({
        timestamp: row.timePeriod,
        value: row.totalActivities || 0,
        label: this.formatTimeLabel(row.timePeriod, aggregation),
        metadata: {
          uniqueUsers: row.uniqueUsers || 0,
          messageActions: row.messageActions || 0,
          conversationActions: row.conversationActions || 0,
          aggregation
        }
      }));
    } catch (error) {
      console.error('Error getting user activity trends:', error);
      return [];
    }
  }

  private async getUserPerformanceData(whereConditions: any[], userType?: string): Promise<any[]> {
    return [];
  }

  private async getUserWorkloadData(whereConditions: any[], userType?: string): Promise<any[]> {
    return [];
  }

  private async getPerformanceSummary(startDate: string, endDate: string, metrics: string[]): Promise<any> {
    return {
      averageResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      uptime: 0,
      systemLoad: 0
    };
  }

  private async getPerformanceTrends(startDate: string, endDate: string, timeRange: string): Promise<TimeSeriesData[]> {
    return [];
  }

  private async identifyBottlenecks(startDate: string, endDate: string): Promise<any[]> {
    return [];
  }

  private async generateRecommendations(summary: any, bottlenecks: any[]): Promise<any[]> {
    return [];
  }

  private async executeCustomQuery(query: CustomAnalyticsQuery): Promise<any> {
    // 實現自定義查詢執行
    return {};
  }

  private async generateExportFile(data: any, query: ExportQuery): Promise<string> {
    // 實現文件生成和上傳
    return 'https://example.com/export/file.csv';
  }

  private getAggregationLevel(timeRange: string): 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly' {
    switch (timeRange) {
      case '1h':
      case '6h':
        return 'raw';
      case '24h':
        return 'hourly';
      case '7d':
        return 'daily';
      case '30d':
        return 'weekly';
      case '90d':
      case '1y':
        return 'monthly';
      default:
        return 'daily';
    }
  }

  /**
   * 獲取快取服務實例（用於手動快取管理）
   */
  getCacheService(): AnalyticsCacheService | undefined {
    return this.cacheService;
  }

  /**
   * 清除分析快取
   */
  async clearCache(queryType?: string): Promise<number> {
    if (!this.cacheService) {
      return 0;
    }

    if (queryType) {
      return await this.cacheService.invalidateQueryType(queryType);
    }

    return await this.cacheService.clearAll();
  }

  /**
   * 獲取快取統計
   */
  async getCacheStats(): Promise<any> {
    if (!this.cacheService) {
      return {
        enabled: false,
        stats: null
      };
    }

    return {
      enabled: true,
      stats: await this.cacheService.getStats()
    };
  }

  /**
   * 獲取期間比較服務實例
   */
  getComparisonService(): PeriodComparisonService {
    return this.comparisonService;
  }

  /**
   * 期間比較 - 便利方法
   */
  async comparePeriods(
    metrics: string[],
    currentPeriod: Period,
    previousPeriod?: Period,
    filters?: any
  ) {
    return await this.comparisonService.compareMultipleMetrics(
      metrics,
      currentPeriod,
      previousPeriod,
      filters
    );
  }

  /**
   * 通用查詢方法 - 用於 dashboard widget 查詢
   */
  async query(query: any): Promise<any> {
    const startTime = Date.now();

    try {
      // 根據查詢類型分發到對應的方法
      switch (query.type) {
        case 'conversation':
          return await this.getConversationAnalytics(query);
        case 'message':
          return await this.getMessageAnalytics(query);
        case 'user':
          return await this.getUserAnalytics(query);
        case 'performance':
          return await this.getPerformanceAnalytics(query);
        default:
          // 簡單查詢處理
          return {
            data: {},
            metadata: {
              queryTime: Date.now() - startTime,
              recordCount: 0,
              cacheHit: false
            }
          };
      }
    } catch (error) {
      throw new DataProcessingError(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// 导出别名以兼容现有导入
export { AnalyticsService as AnalyticsCore };