// Analytics sub-module: custom report generation
import type { AnalyticsFilter } from '../types/enterprise';
import { createDbClient } from '../db/drizzle-factory';
import { sql, and, gte, lte, desc, count, avg, sum } from 'drizzle-orm';
import { metrics, conversations } from '../db/schema';

// Build Drizzle select fields dynamically from metric names and group-by fields
export function buildDrizzleSelectFields(metricNames: string[], groupBy: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectFields: Record<string, any> = {};

  // Add metric fields
  for (const metricName of metricNames) {
    switch (metricName) {
      case 'count':
        selectFields.count = count().as('count');
        break;
      case 'avg_value':
        selectFields.avgValue = avg(metrics.metricValue).as('avg_value');
        break;
      case 'sum_value':
        selectFields.sumValue = sum(metrics.metricValue).as('sum_value');
        break;
      case 'metric_name':
        selectFields.metricName = metrics.metricName;
        break;
      case 'metric_value':
        selectFields.metricValue = metrics.metricValue;
        break;
      case 'timestamp':
        selectFields.timestamp = metrics.timestamp;
        break;
      default:
        // Handle dynamic fields from tags
        if (metricName.startsWith('tag_')) {
          const tagName = metricName.substring(4);
          selectFields[metricName] = sql`JSON_EXTRACT(${metrics.tags}, '$.${tagName}')`.as(metricName);
        }
        break;
    }
  }

  // Add group by fields
  for (const groupField of groupBy) {
    switch (groupField) {
      case 'team_id':
        selectFields.teamId = sql`JSON_EXTRACT(${metrics.tags}, '$.team_id')`.as('team_id');
        break;
      case 'platform':
        selectFields.platform = sql`JSON_EXTRACT(${metrics.tags}, '$.platform')`.as('platform');
        break;
      case 'metric_name':
        selectFields.metricName = metrics.metricName;
        break;
      default:
        // Handle other group by fields
        selectFields[groupField] = sql.raw(groupField).as(groupField);
        break;
    }
  }

  // If no specific fields selected, return all basic fields
  if (Object.keys(selectFields).length === 0) {
    return {
      metricName: metrics.metricName,
      metricValue: metrics.metricValue,
      timestamp: metrics.timestamp,
      tags: metrics.tags
    };
  }

  return selectFields;
}

// Generate a custom report based on configuration
export async function generateCustomReport(
  db: D1Database,
  reportConfig: {
    metrics: string[];
    filters: AnalyticsFilter;
    groupBy: string[];
    period: { start: number; end: number };
    format: 'json' | 'csv';
  }
): Promise<Record<string, unknown>[] | string> {
  const { metrics: metricNames, filters, groupBy, period, format } = reportConfig;

  const drizzle = createDbClient(db);

  // Build dynamic select clause using Drizzle ORM
  const selectFields = buildDrizzleSelectFields(metricNames, groupBy);

  // Build all filter conditions
  const whereConditions = [
    gte(metrics.timestamp, period.start),
    lte(metrics.timestamp, period.end)
  ];

  // Add additional filters dynamically
  if (filters.teamId !== undefined) {
    whereConditions.push(sql`JSON_EXTRACT(${metrics.tags}, '$.team_id') = ${filters.teamId}`);
  }

  if (filters.platform !== undefined) {
    whereConditions.push(sql`JSON_EXTRACT(${metrics.tags}, '$.platform') = ${filters.platform}`);
  }

  // Build the complete query conditionally to avoid TypeScript issues
  let result;

  if (groupBy.length > 0) {
    const groupByFields = groupBy.map(field => {
      switch (field) {
        case 'team_id':
          return sql`JSON_EXTRACT(${metrics.tags}, '$.team_id')`;
        case 'platform':
          return sql`JSON_EXTRACT(${metrics.tags}, '$.platform')`;
        case 'metric_name':
          return metrics.metricName;
        default:
          return sql.raw(field);
      }
    });

    result = await drizzle
      .select(selectFields)
      .from(metrics)
      .leftJoin(conversations, sql`JSON_EXTRACT(${metrics.tags}, '$.conversation_id') = ${conversations.id}`)
      .where(and(...whereConditions))
      .groupBy(...groupByFields)
      .orderBy(desc(metrics.timestamp));
  } else {
    result = await drizzle
      .select(selectFields)
      .from(metrics)
      .leftJoin(conversations, sql`JSON_EXTRACT(${metrics.tags}, '$.conversation_id') = ${conversations.id}`)
      .where(and(...whereConditions))
      .orderBy(desc(metrics.timestamp));
  }

  if (format === 'csv') {
    return convertToCSV(result);
  }

  return result;
}

// Convert an array of records to CSV format
export function convertToCSV(data: Record<string, unknown>[]): string {
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
