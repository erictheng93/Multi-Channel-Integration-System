// Analytics Aggregation - Time range building, WHERE conditions, aggregation intervals, and period comparison helpers

import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { AnalyticsFilters, WhereConditionContext } from '../types/analytics-types';
import { QueryValidationError } from '../types/analytics-types';
import type { AnalyticsQuery } from '../types/analytics-types';
import {
  messages,
  activities,
  customers,
  conversations
} from '@/db/schema';
import type { ComparisonData as PeriodComparisonData } from '@modules/analytics/services/period-comparison-service';
import type { ComparisonData } from '../types/analytics-types';

/**
 * Type alias for SQL WHERE conditions
 * Represents an array of conditions that can be passed to drizzle's and() function
 */
export type SQLConditions = ReturnType<typeof and>[];

/**
 * Validate an analytics query's required fields
 */
export function validateQuery(query: AnalyticsQuery): void {
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

/**
 * Build a concrete start/end date range from either explicit dates or a named time range
 */
export function buildTimeRange(
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

/**
 * Build drizzle WHERE condition arrays from filters and context
 */
export function buildWhereConditions(filters: AnalyticsFilters | undefined, context: WhereConditionContext): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];

  // Time range conditions
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

  // Filter conditions
  if (filters?.teamId) {
    if (context.table === 'conversations') {
      conditions.push(eq(conversations.assignedTeamId, filters.teamId));
    }
  }

  if (filters?.userId) {
    conditions.push(eq(activities.userId, filters.userId));
  }

  if (filters?.conversationId) {
    if (context.table === 'messages') {
      conditions.push(eq(messages.conversationId, filters.conversationId));
    }
  }

  // Platform filtering - requires EXISTS subquery with customers table
  if (filters?.platform && context.table === 'conversations') {
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

/**
 * Determine the aggregation interval granularity based on the time range
 */
export function getAggregationInterval(timeRange: string): 'hourly' | 'daily' | 'weekly' | 'monthly' {
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

/**
 * Map a time range string to a metadata aggregation level
 */
export function getAggregationLevel(timeRange: string): 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly' {
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
 * Calculate the current and previous time periods for period-over-period comparison
 */
export function calculatePreviousPeriod(timeRange: string): {
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
  const previousEnd = new Date(currentStart.getTime() - 1000); // 1 second before

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

/**
 * Convert a PeriodComparisonData object to the analytics ComparisonData format
 */
export function convertPeriodComparisonToComparisonData(
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
