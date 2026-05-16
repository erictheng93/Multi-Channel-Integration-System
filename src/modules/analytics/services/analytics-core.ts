// Analytics Core Service - Facade that delegates to focused sub-modules
// Sub-modules:
// analytics-queries.ts - Database query functions
// analytics-aggregation.ts  - Time range building, WHERE conditions, aggregation helpers
// analytics-formatters.ts - Output label/color formatting utilities

import { type Database } from '@/db/drizzle-factory';
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
  ComparisonData
} from '../types/analytics-types';

import {
  AnalyticsError,
  QueryValidationError,
  DataProcessingError
} from '../types/analytics-types';

import { AnalyticsCacheService } from '@modules/analytics/services/analytics-cache-service';
import { PeriodComparisonService } from '@modules/analytics/services/period-comparison-service';
import type { Period, PeriodComparisonQuery } from '@modules/analytics/services/period-comparison-service';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('AnalyticsCore');

type DispatchQuery =
  | (ConversationAnalyticsQuery & { type: 'conversation' })
  | (MessageAnalyticsQuery & { type: 'message' })
  | (UserAnalyticsQuery & { type: 'user' })
  | (PerformanceAnalyticsQuery & { type: 'performance' });

function queryToRecord(query: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(query));
}

function isDispatchQuery(value: unknown): value is DispatchQuery {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const type = (value as Record<string, unknown>).type;
  return type === 'conversation' || type === 'message' || type === 'user' || type === 'performance';
}

// Sub-module imports
import {
  validateQuery,
  buildTimeRange,
  buildWhereConditions,
  getAggregationLevel
} from './analytics-aggregation';

import {
  getConversationSummary,
  getConversationTrends,
  getConversationDistributions,
  getConversationComparisons,
  getMessageSummary,
  getMessageVolumeTrends,
  getMessageTypeDistribution,
  getMessageChannelDistribution,
  getMessageSentimentDistribution,
  getUserSummary,
  getUserActivityTrends,
  getUserPerformanceData,
  getUserWorkloadData,
  getPerformanceSummary,
  getPerformanceTrends,
  identifyBottlenecks,
  generateRecommendations,
  executeCustomQuery,
  generateExportFile
} from './analytics-queries';

/**
 * Unified analytics service facade
 * Delegates to analytics-queries, analytics-aggregation, and analytics-formatters
 */
export class AnalyticsService implements AnalyticsServiceInterface {
  private db: Database;
  private kv?: Bindings['KV'];
  private cacheService?: AnalyticsCacheService;
  private comparisonService: PeriodComparisonService;

  constructor(config: AnalyticsServiceConfig) {
    this.db = config.database;
    this.kv = config.kv;

    if (this.kv) {
      this.cacheService = new AnalyticsCacheService(this.kv, {
        defaultTTL: 300, // 5 minutes
        shortTTL: 60, // 1 minute
        longTTL: 1800, // 30 minutes
        enabled: true
      });
    }

    this.comparisonService = new PeriodComparisonService(this.db, this.cacheService);
  }

  // ---------------------------------------------------------------------------
  // Conversation Analytics
  // ---------------------------------------------------------------------------

  async getConversationAnalytics(query: ConversationAnalyticsQuery): Promise<ServiceResponse<ConversationAnalytics>> {
    const startTime = nowMs();

    try {
      validateQuery(query);

      // Try cache
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('conversation', queryToRecord(query), {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });
        const cachedResult = await this.cacheService.get<ConversationAnalytics>(cacheKey);
        if (cachedResult && cachedResult.success) {
          log.debug('Cache HIT for conversation analytics', { cacheKey });
          return { success: cachedResult.success, data: cachedResult.data, metadata: cachedResult.metadata };
        }
        log.debug('Cache MISS for conversation analytics', { cacheKey });
      }

      const { startDate, endDate } = buildTimeRange(query.timeRange, query.startDate, query.endDate);
      const whereConditions = buildWhereConditions(query.filters, { startDate, endDate, table: 'conversations' });

      const summary = await getConversationSummary(this.db, whereConditions, query.metrics || []);
      const trends = await getConversationTrends(this.db, whereConditions, query.timeRange);
      const distributions = await getConversationDistributions(this.db, whereConditions);

      let comparisons: ComparisonData[] | undefined;
      if (query.filters?.includePrevious || query.timeRange) {
        comparisons = await getConversationComparisons(this.comparisonService, whereConditions, query.timeRange);
      }

      const result: ConversationAnalytics = { summary, trends, distributions, comparisons };

      const serviceResponse: ServiceResponse<ConversationAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: summary.totalConversations,
          processedAt: nowISO(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: getAggregationLevel(query.timeRange)
        }
      };

      // Store in cache
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('conversation', queryToRecord(query), {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });
        const meta = serviceResponse.metadata;
        const analyticsResult: AnalyticsResult<ConversationAnalytics> = {
          success: serviceResponse.success,
          data: serviceResponse.data!,
          metadata: {
            totalRecords: typeof meta?.totalRecords === 'number' ? meta.totalRecords : 0,
            processedAt: typeof meta?.processedAt === 'string' ? meta.processedAt : nowISO(),
            queryTime: typeof meta?.queryTime === 'number' ? meta.queryTime : 0,
            cacheHit: typeof meta?.cacheHit === 'boolean' ? meta.cacheHit : undefined,
            aggregationLevel: meta?.aggregationLevel as AnalyticsResult<ConversationAnalytics>['metadata']['aggregationLevel']
          }
        };
        const ttl = this.cacheService.getTTLForQueryType('conversation', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        log.debug('Cached conversation analytics', { ttl, cacheKey });
      }

      return serviceResponse;

    } catch (error) {
      log.error('Failed to get conversation analytics', {}, error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          errorCode: error instanceof QueryValidationError ? 'VALIDATION_ERROR' :
                     error instanceof DataProcessingError ? 'PROCESSING_ERROR' :
                     'ANALYTICS_ERROR',
          processedAt: nowISO(),
          queryTime: Date.now() - startTime
        }
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Message Analytics
  // ---------------------------------------------------------------------------

  async getMessageAnalytics(query: MessageAnalyticsQuery): Promise<ServiceResponse<MessageAnalytics>> {
    const startTime = nowMs();

    try {
      validateQuery(query);

      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('message', queryToRecord(query), {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });
        const cachedResult = await this.cacheService.get<MessageAnalytics>(cacheKey);
        if (cachedResult && cachedResult.success) {
          log.debug('Cache HIT for message analytics', { cacheKey });
          return { success: cachedResult.success, data: cachedResult.data, metadata: cachedResult.metadata };
        }
        log.debug('Cache MISS for message analytics', { cacheKey });
      }

      const { startDate, endDate } = buildTimeRange(query.timeRange, query.startDate, query.endDate);
      const whereConditions = buildWhereConditions(query.filters, { startDate, endDate, table: 'messages' });

      const summary = await getMessageSummary(this.db, whereConditions, query.metrics || []);
      const volume = await getMessageVolumeTrends(this.db, whereConditions, query.timeRange);
      const types = await getMessageTypeDistribution(this.db, whereConditions);
      const channels = await getMessageChannelDistribution(this.db, whereConditions);
      const sentiments = await getMessageSentimentDistribution(this.db, whereConditions);

      const result: MessageAnalytics = { summary, volume, types, channels, sentiments };

      const serviceResponse: ServiceResponse<MessageAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: summary.totalMessages,
          processedAt: nowISO(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: getAggregationLevel(query.timeRange)
        }
      };

      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('message', queryToRecord(query), {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });
        const meta = serviceResponse.metadata;
        const analyticsResult: AnalyticsResult<MessageAnalytics> = {
          success: serviceResponse.success,
          data: serviceResponse.data!,
          metadata: {
            totalRecords: typeof meta?.totalRecords === 'number' ? meta.totalRecords : 0,
            processedAt: typeof meta?.processedAt === 'string' ? meta.processedAt : nowISO(),
            queryTime: typeof meta?.queryTime === 'number' ? meta.queryTime : 0,
            cacheHit: typeof meta?.cacheHit === 'boolean' ? meta.cacheHit : undefined,
            aggregationLevel: meta?.aggregationLevel as AnalyticsResult<MessageAnalytics>['metadata']['aggregationLevel']
          }
        };
        const ttl = this.cacheService.getTTLForQueryType('message', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        log.debug('Cached message analytics', { ttl, cacheKey });
      }

      return serviceResponse;

    } catch (error) {
      log.error('Failed to get message analytics', {}, error instanceof Error ? error : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          errorCode: error instanceof QueryValidationError ? 'VALIDATION_ERROR' :
                     error instanceof DataProcessingError ? 'PROCESSING_ERROR' :
                     'ANALYTICS_ERROR',
          processedAt: nowISO(),
          queryTime: Date.now() - startTime
        }
      };
    }
  }

  // ---------------------------------------------------------------------------
  // User Analytics
  // ---------------------------------------------------------------------------

  async getUserAnalytics(query: UserAnalyticsQuery): Promise<AnalyticsResult<UserAnalytics>> {
    const startTime = nowMs();

    try {
      validateQuery(query);

      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('user', queryToRecord(query), {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });
        const cachedResult = await this.cacheService.get<UserAnalytics>(cacheKey);
        if (cachedResult) {
          log.debug('Cache HIT for user analytics', { cacheKey });
          return cachedResult;
        }
        log.debug('Cache MISS for user analytics', { cacheKey });
      }

      const { startDate, endDate } = buildTimeRange(query.timeRange, query.startDate, query.endDate);
      const whereConditions = buildWhereConditions(query.filters, { startDate, endDate, table: 'users' });

      const summary = await getUserSummary(this.db, whereConditions, query.metrics || [], query.userType);
      const activity = await getUserActivityTrends(this.db, whereConditions, query.timeRange);
      const performance = await getUserPerformanceData(this.db, whereConditions, query.userType);
      const workload = await getUserWorkloadData(this.db, whereConditions, query.userType);

      const result: UserAnalytics = { summary, activity, performance, workload };

      const analyticsResult: AnalyticsResult<UserAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: summary.totalUsers,
          processedAt: nowISO(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: getAggregationLevel(query.timeRange)
        }
      };

      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('user', queryToRecord(query), {
          includeUserId: !!query.filters?.userId,
          includeTeamId: !!query.filters?.teamId
        });
        const ttl = this.cacheService.getTTLForQueryType('user', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        log.debug('Cached user analytics', { ttl, cacheKey });
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

  // ---------------------------------------------------------------------------
  // Performance Analytics
  // ---------------------------------------------------------------------------

  async getPerformanceAnalytics(query: PerformanceAnalyticsQuery): Promise<AnalyticsResult<PerformanceAnalytics>> {
    const startTime = nowMs();

    try {
      validateQuery(query);

      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('performance', queryToRecord(query));
        const cachedResult = await this.cacheService.get<PerformanceAnalytics>(cacheKey);
        if (cachedResult) {
          log.debug('Cache HIT for performance analytics', { cacheKey });
          return cachedResult;
        }
        log.debug('Cache MISS for performance analytics', { cacheKey });
      }

      const { startDate, endDate } = buildTimeRange(query.timeRange, query.startDate, query.endDate);

      const summary = await getPerformanceSummary(this.db, startDate, endDate, query.metrics || []);
      const trends = await getPerformanceTrends(this.db, startDate, endDate, query.timeRange);
      const bottlenecks = await identifyBottlenecks(this.db, startDate, endDate);
      const recommendations = await generateRecommendations(summary, bottlenecks);

      const result: PerformanceAnalytics = { summary, trends, bottlenecks, recommendations };

      const analyticsResult: AnalyticsResult<PerformanceAnalytics> = {
        success: true,
        data: result,
        metadata: {
          totalRecords: trends.length,
          processedAt: nowISO(),
          queryTime: Date.now() - startTime,
          cacheHit: false,
          aggregationLevel: getAggregationLevel(query.timeRange)
        }
      };

      if (this.cacheService) {
        const cacheKey = this.cacheService.generateCacheKey('performance', queryToRecord(query));
        const ttl = this.cacheService.getTTLForQueryType('performance', query.timeRange);
        await this.cacheService.set(cacheKey, analyticsResult, ttl);
        log.debug('Cached performance analytics', { ttl, cacheKey });
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

  // ---------------------------------------------------------------------------
  // Custom Analytics
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getCustomAnalytics(query: CustomAnalyticsQuery): Promise<AnalyticsResult<unknown>> {
    const startTime = nowMs();

    try {
      validateQuery(query);

      const result = await executeCustomQuery(this.db, query);

      return {
        success: true,
        data: result,
        metadata: {
          totalRecords: Array.isArray(result) ? result.length : 1,
          processedAt: nowISO(),
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

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async exportAnalytics(query: ExportQuery): Promise<ServiceResponse<ExportResult>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: unknown;
      const metrics = query.metrics || [];

      const hasConversationMetrics = metrics.some(m =>
        m.includes('conversation') || m === 'total_conversations' || m === 'active_conversations'
      );
      const hasMessageMetrics = metrics.some(m =>
        m.includes('message') || m === 'total_messages' || m === 'messages_per_hour'
      );

      if (hasConversationMetrics) {
        data = await this.getConversationAnalytics(query as ConversationAnalyticsQuery);
      } else if (hasMessageMetrics) {
        data = await this.getMessageAnalytics(query as MessageAnalyticsQuery);
      } else if (metrics.length === 0) {
        data = await this.getConversationAnalytics({
          ...query,
          metrics: ['total_conversations']
        } as ConversationAnalyticsQuery);
      } else {
        throw new QueryValidationError('Invalid export query: missing or invalid metrics');
      }

      const fileUrl = await generateExportFile(data, query);

      const exportResult: ExportResult = {
        fileUrl,
        fileName: query.fileName || `analytics_export_${nowMs()}.${query.format}`,
        fileSize: 0,
        format: query.format,
        generatedAt: nowISO(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        downloadCount: 0
      };

      return { success: true, data: exportResult };

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

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

  getCacheService(): AnalyticsCacheService | undefined {
    return this.cacheService;
  }

  async clearCache(queryType?: string): Promise<number> {
    if (!this.cacheService) {
      return 0;
    }
    if (queryType) {
      return await this.cacheService.invalidateQueryType(queryType);
    }
    return await this.cacheService.clearAll();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getCacheStats() {
    if (!this.cacheService) {
      return { enabled: false, stats: null };
    }
    return { enabled: true, stats: await this.cacheService.getStats() };
  }

  // ---------------------------------------------------------------------------
  // Comparison Service
  // ---------------------------------------------------------------------------

  getComparisonService(): PeriodComparisonService {
    return this.comparisonService;
  }

  async comparePeriods(
    metrics: string[],
    currentPeriod: Period,
    previousPeriod?: Period,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters?: PeriodComparisonQuery['filters']
  ) {
    return await this.comparisonService.compareMultipleMetrics(
      metrics,
      currentPeriod,
      previousPeriod,
      filters
    );
  }

  // ---------------------------------------------------------------------------
  // Generic Query Dispatcher
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(query: unknown) {
    const startTime = nowMs();

    try {
      if (!isDispatchQuery(query)) {
        return {
          data: {},
          metadata: {
            queryTime: Date.now() - startTime,
            recordCount: 0,
            cacheHit: false
          }
        };
      }

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

// Backward-compatible alias
export { AnalyticsService as AnalyticsCore };

// Re-export sub-modules for direct access
export {
  validateQuery,
  buildTimeRange,
  buildWhereConditions,
  getAggregationLevel,
  getAggregationInterval,
  calculatePreviousPeriod,
  convertPeriodComparisonToComparisonData
} from './analytics-aggregation';
export type { SQLConditions } from './analytics-aggregation';

export {
  formatTimeLabel,
  getStatusLabel,
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  getTeamColor
} from './analytics-formatters';

export {
  getConversationSummary,
  getConversationTrends,
  getConversationDistributions,
  getConversationComparisons,
  getMessageSummary,
  getMessageVolumeTrends,
  getMessageTypeDistribution,
  getMessageChannelDistribution,
  getMessageSentimentDistribution,
  getUserSummary,
  getUserActivityTrends,
  getUserPerformanceData,
  getUserWorkloadData,
  getPerformanceSummary,
  getPerformanceTrends,
  identifyBottlenecks,
  generateRecommendations,
  executeCustomQuery,
  generateExportFile
} from './analytics-queries';
