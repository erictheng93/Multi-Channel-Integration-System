// Analytics Queries - Database query functions for analytics data retrieval

import { type Database } from '@/db/drizzle-factory';
import { and, asc, sql, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
  ConversationAnalytics,
  MessageAnalytics,
  UserAnalytics,
  PerformanceAnalytics,
  TimeSeriesData,
  DistributionData,
  ComparisonData,
  CustomAnalyticsQuery,
  ExportQuery,
  DistributionRow,
  TeamDistributionRow,
  ConversationTrendRow,
  MessageVolumeTrendRow
} from '../types/analytics-types';

import {
  messages,
  activities,
  conversations
} from '@/db/schema';

import { PeriodComparisonService } from '@modules/analytics/services/period-comparison-service';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('AnalyticsQueries');

import {
  buildTimeRange,
  getAggregationInterval,
  calculatePreviousPeriod,
  convertPeriodComparisonToComparisonData
} from './analytics-aggregation';
import type { SQLConditions } from './analytics-aggregation';

import {
  formatTimeLabel,
  getStatusLabel,
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  getTeamColor
} from './analytics-formatters';

/**
 * Type for SQL time group expressions
 */
type SQLTimeGroup = SQL<string>;

// ============================================================================
// Conversation Queries
// ============================================================================

/**
 * Query conversation summary statistics
 */
export async function getConversationSummary(
  db: Database,
  whereConditions: SQLConditions,
  _metrics: string[]
): Promise<ConversationAnalytics['summary']> {
  const results = await db
    .select({
      totalConversations: count(),
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
      start: nowISO(),
      end: nowISO()
    }
  };
}

/**
 * Query conversation trends over time
 */
export async function getConversationTrends(
  db: Database,
  whereConditions: SQLConditions,
  timeRange: string
): Promise<TimeSeriesData[]> {
  try {
    const aggregation = getAggregationInterval(timeRange);
    // Build time range (values used for context only, actual filtering via whereConditions)
    buildTimeRange(timeRange);

    let timeGroupSQL: SQLTimeGroup;
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

    const trendData = await db
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

    return trendData.map((row: ConversationTrendRow) => ({
      timestamp: row.timePeriod || '',
      value: row.count || 0,
      label: formatTimeLabel(row.timePeriod || '', aggregation),
      metadata: {
        activeConversations: row.activeCount || 0,
        closedConversations: row.closedCount || 0,
        aggregation
      }
    }));
  } catch (error) {
    log.error('Error getting conversation trends', {}, error as Error);
    return [];
  }
}

/**
 * Query conversation distributions (status, priority, team)
 */
export async function getConversationDistributions(
  db: Database,
  whereConditions: SQLConditions
): Promise<DistributionData[]> {
  try {
    const distributions: DistributionData[] = [];

    // Get total for percentage calculations
    const totalResult = await db
      .select({ total: count() })
      .from(conversations)
      .where(and(...whereConditions));

    const total = totalResult[0]?.total || 0;
    if (total === 0) return [];

    // 1. Status distribution
    const statusDist = await db
      .select({
        category: conversations.status,
        count: count()
      })
      .from(conversations)
      .where(and(...whereConditions))
      .groupBy(conversations.status);

    statusDist.forEach((row: DistributionRow) => {
      const countValue = row.count || 0;
      distributions.push({
        category: 'status',
        value: countValue,
        percentage: Math.round((countValue / total) * 10000) / 100,
        label: getStatusLabel(row.category || ''),
        color: getStatusColor(row.category || '')
      });
    });

    // 2. Priority distribution
    const priorityDist = await db
      .select({
        category: conversations.priority,
        count: count()
      })
      .from(conversations)
      .where(and(...whereConditions))
      .groupBy(conversations.priority);

    priorityDist.forEach((row: DistributionRow) => {
      const countValue = row.count || 0;
      distributions.push({
        category: 'priority',
        value: countValue,
        percentage: Math.round((countValue / total) * 10000) / 100,
        label: getPriorityLabel(row.category || ''),
        color: getPriorityColor(row.category || '')
      });
    });

    // 3. Team distribution
    const teamDist = await db
      .select({
        category: conversations.assignedTeamId,
        count: count()
      })
      .from(conversations)
      .where(and(...whereConditions))
      .groupBy(conversations.assignedTeamId);

    teamDist.forEach((row: TeamDistributionRow) => {
      const teamId = row.category;
      distributions.push({
        category: 'team',
        value: row.count || 0,
        percentage: Math.round((row.count / total) * 10000) / 100,
        label: teamId ? `Team ${teamId}` : 'Unassigned',
        color: getTeamColor(teamId ?? 0)
      });
    });

    return distributions;
  } catch (error) {
    log.error('Error getting conversation distributions', {}, error as Error);
    return [];
  }
}

/**
 * Query conversation period-over-period comparisons
 */
export async function getConversationComparisons(
  comparisonService: PeriodComparisonService,
  _whereConditions: SQLConditions,
  timeRange: string
): Promise<ComparisonData[]> {
  try {
    const { currentPeriod, previousPeriod } = calculatePreviousPeriod(timeRange);

    const comparison = await comparisonService.compareConversationMetrics(
      currentPeriod,
      previousPeriod
    );

    const comparisons: ComparisonData[] = [];

    if (comparison.metrics.total_conversations) {
      comparisons.push(convertPeriodComparisonToComparisonData(
        comparison.metrics.total_conversations
      ));
    }

    if (comparison.metrics.active_conversations) {
      comparisons.push(convertPeriodComparisonToComparisonData(
        comparison.metrics.active_conversations
      ));
    }

    if (comparison.metrics.closed_conversations) {
      comparisons.push(convertPeriodComparisonToComparisonData(
        comparison.metrics.closed_conversations
      ));
    }

    return comparisons;
  } catch (error) {
    log.error('Error getting conversation comparisons', {}, error as Error);
    return [];
  }
}

// ============================================================================
// Message Queries
// ============================================================================

/**
 * Query message summary statistics (stub implementation)
 */
export async function getMessageSummary(
  _db: Database,
  _whereConditions: SQLConditions,
  _metrics: string[]
): Promise<MessageAnalytics['summary']> {
  return {
    totalMessages: 0,
    messagesPerHour: 0,
    averageResponseTime: 0,
    messageTypes: {},
    channelDistribution: {},
    sentimentDistribution: {}
  };
}

/**
 * Query message volume trends over time
 */
export async function getMessageVolumeTrends(
  db: Database,
  whereConditions: SQLConditions,
  timeRange: string
): Promise<TimeSeriesData[]> {
  try {
    const aggregation = getAggregationInterval(timeRange);

    let timeGroupSQL: SQLTimeGroup;
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

    const volumeData = await db
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

    return volumeData.map((row: MessageVolumeTrendRow) => ({
      timestamp: row.timePeriod || '',
      value: row.totalMessages || 0,
      label: formatTimeLabel(row.timePeriod || '', aggregation),
      metadata: {
        customerMessages: row.customerMessages || 0,
        agentMessages: row.agentMessages || 0,
        aggregation
      }
    }));
  } catch (error) {
    log.error('Error getting message volume trends', {}, error as Error);
    return [];
  }
}

/**
 * Query message type distribution (stub implementation)
 */
export async function getMessageTypeDistribution(
  _db: Database,
  _whereConditions: SQLConditions
): Promise<DistributionData[]> {
  return [];
}

/**
 * Query message channel distribution (stub implementation)
 */
export async function getMessageChannelDistribution(
  _db: Database,
  _whereConditions: SQLConditions
): Promise<DistributionData[]> {
  return [];
}

/**
 * Query message sentiment distribution (stub implementation)
 */
export async function getMessageSentimentDistribution(
  _db: Database,
  _whereConditions: SQLConditions
): Promise<DistributionData[]> {
  return [];
}

// ============================================================================
// User Queries
// ============================================================================

/**
 * Query user summary statistics (stub implementation)
 */
export async function getUserSummary(
  _db: Database,
  _whereConditions: SQLConditions,
  _metrics: string[],
  _userType?: string
): Promise<UserAnalytics['summary']> {
  return {
    totalUsers: 0,
    activeUsers: 0,
    averageSessionDuration: 0,
    averageActivityPerDay: 0,
    topPerformers: []
  };
}

/**
 * Query user activity trends over time
 */
export async function getUserActivityTrends(
  db: Database,
  whereConditions: SQLConditions,
  timeRange: string
): Promise<TimeSeriesData[]> {
  try {
    const aggregation = getAggregationInterval(timeRange);

    let timeGroupSQL: SQLTimeGroup;
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

    const activityData = await db
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

    return activityData.map((row) => ({
      timestamp: (row.timePeriod as string) || '',
      value: row.totalActivities || 0,
      label: formatTimeLabel((row.timePeriod as string) || '', aggregation),
      metadata: {
        uniqueUsers: Number(row.uniqueUsers) || 0,
        messageActions: row.messageActions || 0,
        conversationActions: row.conversationActions || 0,
        aggregation
      }
    }));
  } catch (error) {
    log.error('Error getting user activity trends', {}, error as Error);
    return [];
  }
}

/**
 * Query user performance data (stub implementation)
 */
export async function getUserPerformanceData(
  _db: Database,
  _whereConditions: SQLConditions,
  _userType?: string
): Promise<UserAnalytics['performance']> {
  return [];
}

/**
 * Query user workload data (stub implementation)
 */
export async function getUserWorkloadData(
  _db: Database,
  _whereConditions: SQLConditions,
  _userType?: string
): Promise<UserAnalytics['workload']> {
  return [];
}

// ============================================================================
// Performance Queries
// ============================================================================

/**
 * Query performance summary statistics (stub implementation)
 */
export async function getPerformanceSummary(
  _db: Database,
  _startDate: string,
  _endDate: string,
  _metrics: string[]
): Promise<PerformanceAnalytics['summary']> {
  return {
    averageResponseTime: 0,
    throughput: 0,
    errorRate: 0,
    uptime: 0,
    systemLoad: 0
  };
}

/**
 * Query performance trends over time (stub implementation)
 */
export async function getPerformanceTrends(
  _db: Database,
  _startDate: string,
  _endDate: string,
  _timeRange: string
): Promise<TimeSeriesData[]> {
  return [];
}

/**
 * Identify performance bottlenecks (stub implementation)
 */
export async function identifyBottlenecks(
  _db: Database,
  _startDate: string,
  _endDate: string
): Promise<PerformanceAnalytics['bottlenecks']> {
  return [];
}

/**
 * Generate performance recommendations (stub implementation)
 */
export async function generateRecommendations(
  _summary: PerformanceAnalytics['summary'],
  _bottlenecks: PerformanceAnalytics['bottlenecks']
): Promise<PerformanceAnalytics['recommendations']> {
  return [];
}

// ============================================================================
// Custom & Export Queries
// ============================================================================

/**
 * Execute a custom analytics query (stub implementation)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeCustomQuery(_db: Database, _query: CustomAnalyticsQuery) {
  return {};
}

/**
 * Generate an export file from analytics data (stub implementation)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateExportFile(_data: unknown, _query: ExportQuery): Promise<string> {
  return 'https://example.com/export/file.csv';
}
