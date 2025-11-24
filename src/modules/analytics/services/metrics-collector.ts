// Metrics Collector Service - 統一指標收集服務
// 整合原有的 EnterpriseAnalyticsEngine 指標收集功能

import type {
  Metric,
  MetricQuery,
  MetricQueryResult,
  AggregatedMetric,
  MetricsCollectorInterface,
  AggregationType,
  AggregationPeriod,
  MetricStorageConfig,
  RetentionPolicy
} from '../types/metrics-types';

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { createDbClient } from '../../../db/drizzle-factory';
import { eq, and, desc, asc, sql, count, avg, sum, min, max, gte, lte } from 'drizzle-orm';
import { metrics } from '@/db/schema';
import type { Bindings } from '@/types';

/**
 * 統一指標收集服務
 * 整合原有的指標收集、存儲、聚合功能
 */
export class MetricsCollector implements MetricsCollectorInterface {
  private db: DrizzleD1Database;
  private kv?: Bindings['KV'];
  private config: MetricStorageConfig;
  private batchBuffer: Metric[] = [];
  private flushTimer?: any;

  constructor(
    database: D1Database,
    kv?: Bindings['KV'],
    config: Partial<MetricStorageConfig> = {}
  ) {
    this.db = drizzle(database);
    this.kv = kv;
    this.config = {
      backend: 'hybrid',
      batchSize: 100,
      flushInterval: 5000, // 5 seconds
      compression: true,
      compressionLevel: 6,
      indexFields: ['metricName', 'timestamp'],
      partitioning: {
        enabled: true,
        field: 'timestamp',
        strategy: 'time'
      },
      ...config
    };

    // 啟動定期刷新
    this.startFlushTimer();
  }

  /**
   * 收集單個指標
   */
  async collect(metric: Metric): Promise<void> {
    try {
      // 驗證指標格式
      this.validateMetric(metric);

      // 添加到批次緩衝區
      this.batchBuffer.push(metric);

      // 如果達到批次大小，立即刷新
      if (this.batchBuffer.length >= this.config.batchSize) {
        await this.flush();
      }

      // 實時指標存儲到 KV（如果啟用）
      if (this.kv && this.config.backend !== 'database') {
        await this.storeRealTimeMetric(metric);
      }

    } catch (error) {
      console.error('Failed to collect metric:', error);
      throw error;
    }
  }

  /**
   * 批量收集指標
   */
  async collectBatch(metrics: Metric[]): Promise<void> {
    try {
      // 驗證所有指標
      metrics.forEach(metric => this.validateMetric(metric));

      // 添加到批次緩衝區
      this.batchBuffer.push(...metrics);

      // 如果超過批次大小，分批刷新
      while (this.batchBuffer.length >= this.config.batchSize) {
        await this.flush();
      }

      // 實時指標存儲到 KV
      if (this.kv && this.config.backend !== 'database') {
        await Promise.all(
          metrics.map(metric => this.storeRealTimeMetric(metric))
        );
      }

    } catch (error) {
      console.error('Failed to collect batch metrics:', error);
      throw error;
    }
  }

  /**
   * 查詢指標
   */
  async query(query: MetricQuery): Promise<MetricQueryResult> {
    const startTime = Date.now();

    try {
      this.validateQuery(query);

      // 構建查詢條件
      const whereConditions = [
        eq(metrics.metricName, query.name),
        gte(metrics.timestamp, query.startTime),
        lte(metrics.timestamp, query.endTime)
      ];

      // 添加標籤篩選
      if (query.tags) {
        for (const [key, value] of Object.entries(query.tags)) {
          whereConditions.push(
            sql`JSON_EXTRACT(${metrics.tags}, '$.${key}') = ${value}`
          );
        }
      }

      // 根據聚合需求選擇查詢方式
      const result = query.aggregation
        ? await this.queryAggregated(query, whereConditions)
        : await this.queryRaw(query, whereConditions);

      return {
        metrics: result,
        metadata: {
          totalRecords: result.length,
          queryTime: Date.now() - startTime,
          cacheHit: false, // TODO: 實現緩存檢測
          aggregationLevel: query.period || '1m'
        }
      };

    } catch (error) {
      console.error('Failed to query metrics:', error);
      throw error;
    }
  }

  /**
   * 聚合指標
   */
  async aggregate(
    metrics: Metric[],
    aggregation: AggregationType,
    period: AggregationPeriod
  ): Promise<AggregatedMetric[]> {
    try {
      // 按時間段和標籤分組
      const groups = this.groupMetrics(metrics, period);

      // 對每個組進行聚合計算
      const aggregated: AggregatedMetric[] = [];

      for (const [groupKey, groupMetrics] of groups.entries()) {
        const [timestamp, tags] = this.parseGroupKey(groupKey);
        const aggregatedValue = this.calculateAggregation(groupMetrics, aggregation);

        if (groupMetrics.length === 0) continue;

        const firstMetric = groupMetrics[0];
        if (!firstMetric) continue;

        aggregated.push({
          name: firstMetric.name,
          aggregation,
          value: aggregatedValue,
          timestamp,
          period,
          tags,
          sampleCount: groupMetrics.length,
          metadata: {
            groupKey,
            originalMetrics: groupMetrics.length
          }
        });
      }

      return aggregated.sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
      console.error('Failed to aggregate metrics:', error);
      throw error;
    }
  }

  /**
   * 清理過期數據
   */
  async cleanup(retentionPolicy: RetentionPolicy): Promise<void> {
    try {
      const now = Date.now();

      // 刪除超過保留期限的原始數據
      const rawCutoff = now - (retentionPolicy.raw * 24 * 60 * 60 * 1000);
      await this.db
        .delete(metrics)
        .where(
          and(
            lte(metrics.timestamp, rawCutoff),
            sql`JSON_EXTRACT(${metrics.tags}, '$.aggregation') IS NULL`
          )
        );

      // 刪除超過保留期限的聚合數據
      const aggregationCutoffs = {
        hourly: now - (retentionPolicy.hourly * 24 * 60 * 60 * 1000),
        daily: now - (retentionPolicy.daily * 24 * 60 * 60 * 1000),
        weekly: now - (retentionPolicy.weekly * 24 * 60 * 60 * 1000),
        monthly: now - (retentionPolicy.monthly * 24 * 60 * 60 * 1000)
      };

      for (const [period, cutoff] of Object.entries(aggregationCutoffs)) {
        await this.db
          .delete(metrics)
          .where(
            and(
              lte(metrics.timestamp, cutoff),
              sql`JSON_EXTRACT(${metrics.tags}, '$.aggregation') = ${period}`
            )
          );
      }

      console.log('Metrics cleanup completed');

    } catch (error) {
      console.error('Failed to cleanup metrics:', error);
      throw error;
    }
  }

  /**
   * 刷新緩衝區
   */
  async flush(): Promise<void> {
    if (this.batchBuffer.length === 0) {
      return;
    }

    const batch = this.batchBuffer.splice(0, this.config.batchSize);

    try {
      // 存儲到數據庫
      await this.storeBatchToDatabase(batch);

      console.log(`Flushed ${batch.length} metrics to storage`);

    } catch (error) {
      // 如果存儲失敗，重新添加到緩衝區
      this.batchBuffer.unshift(...batch);
      console.error('Failed to flush metrics batch:', error);
      throw error;
    }
  }

  /**
   * 銷毀收集器
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // 最後一次刷新
    this.flush().catch(console.error);
  }

  // 私有方法

  private validateMetric(metric: Metric): void {
    if (!metric.id || typeof metric.id !== 'string') {
      throw new Error('Metric ID is required and must be a string');
    }

    if (!metric.name || typeof metric.name !== 'string') {
      throw new Error('Metric name is required and must be a string');
    }

    if (typeof metric.value !== 'number' || isNaN(metric.value)) {
      throw new Error('Metric value must be a valid number');
    }

    if (!metric.timestamp || typeof metric.timestamp !== 'number') {
      throw new Error('Metric timestamp is required and must be a number');
    }

    if (!metric.tags || typeof metric.tags !== 'object') {
      throw new Error('Metric tags must be an object');
    }
  }

  private validateQuery(query: MetricQuery): void {
    if (!query.name) {
      throw new Error('Query name is required');
    }

    if (!query.startTime || !query.endTime) {
      throw new Error('Query start and end times are required');
    }

    if (query.startTime >= query.endTime) {
      throw new Error('Query start time must be before end time');
    }
  }

  private async storeRealTimeMetric(metric: Metric): Promise<void> {
    if (!this.kv) return;

    const key = `metric:${metric.name}:${this.generateTagKey(metric.tags)}`;
    const value = {
      value: metric.value,
      timestamp: metric.timestamp,
      unit: metric.unit,
      metadata: metric.metadata
    };

    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: 24 * 60 * 60 // 24 hours
    });
  }

  private async storeBatchToDatabase(batch: Metric[]): Promise<void> {
    const records = batch.map(metric => ({
      // id is auto-increment, don't provide it
      metricName: metric.name,
      metricValue: metric.value,
      timestamp: metric.timestamp,
      tags: JSON.stringify(metric.tags),
      unit: metric.unit || null,
      // metadata field doesn't exist in schema, remove it
    }));

    // 使用批量插入
    await this.db.insert(metrics).values(records);
  }

  private async queryRaw(query: MetricQuery, whereConditions: any[]): Promise<AggregatedMetric[]> {
    const queryBuilder = this.db
      .select({
        id: metrics.id,
        metricName: metrics.metricName,
        metricValue: metrics.metricValue,
        timestamp: metrics.timestamp,
        tags: metrics.tags,
        unit: metrics.unit
      })
      .from(metrics)
      .where(and(...whereConditions));

    // 添加排序
    if (query.orderBy === 'timestamp') {
      queryBuilder.orderBy(asc(metrics.timestamp));
    } else if (query.orderBy === 'value') {
      queryBuilder.orderBy(desc(metrics.metricValue));
    }

    // 添加限制
    if (query.limit) {
      queryBuilder.limit(query.limit);
    }

    const results = await queryBuilder;

    return results.map(row => ({
      name: row.metricName,
      aggregation: 'sum', // Default aggregation for raw data
      value: row.metricValue,
      timestamp: row.timestamp,
      period: '1m' as const,
      tags: JSON.parse(row.tags || '{}'),
      metadata: { originalId: row.id }
    }));
  }

  private async queryAggregated(query: MetricQuery, whereConditions: any[]): Promise<AggregatedMetric[]> {
    const aggregationSQL = this.buildAggregationSQL(query.aggregation!);
    const periodSQL = this.buildPeriodSQL(query.period!);

    const results = await this.db.run(sql`
      SELECT
        ${periodSQL} as period_timestamp,
        ${aggregationSQL} as aggregated_value,
        COUNT(*) as sample_count,
        ${metrics.tags}
      FROM ${metrics}
      WHERE ${and(...whereConditions)}
      GROUP BY period_timestamp, ${metrics.tags}
      ORDER BY period_timestamp ASC
      ${query.limit ? sql`LIMIT ${query.limit}` : sql``}
    `);

    return (results.results || []).map((row: any) => ({
      name: query.name,
      aggregation: query.aggregation!,
      value: row.aggregated_value,
      timestamp: row.period_timestamp,
      period: query.period!,
      tags: JSON.parse(row.tags || '{}'),
      sampleCount: row.sample_count
    }));
  }

  private buildAggregationSQL(aggregation: AggregationType): any {
    switch (aggregation) {
      case 'sum':
        return sql`SUM(${metrics.metricValue})`;
      case 'avg':
        return sql`AVG(${metrics.metricValue})`;
      case 'min':
        return sql`MIN(${metrics.metricValue})`;
      case 'max':
        return sql`MAX(${metrics.metricValue})`;
      case 'count':
        return sql`COUNT(*)`;
      case 'percentile_50':
        return sql`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${metrics.metricValue})`;
      case 'percentile_95':
        return sql`percentile_cont(0.95) WITHIN GROUP (ORDER BY ${metrics.metricValue})`;
      case 'percentile_99':
        return sql`percentile_cont(0.99) WITHIN GROUP (ORDER BY ${metrics.metricValue})`;
      default:
        return sql`AVG(${metrics.metricValue})`;
    }
  }

  private buildPeriodSQL(period: AggregationPeriod): any {
    switch (period) {
      case '1m':
        return sql`(${metrics.timestamp} / 60000) * 60000`;
      case '5m':
        return sql`(${metrics.timestamp} / 300000) * 300000`;
      case '15m':
        return sql`(${metrics.timestamp} / 900000) * 900000`;
      case '1h':
        return sql`(${metrics.timestamp} / 3600000) * 3600000`;
      case '6h':
        return sql`(${metrics.timestamp} / 21600000) * 21600000`;
      case '1d':
        return sql`(${metrics.timestamp} / 86400000) * 86400000`;
      case '1w':
        return sql`(${metrics.timestamp} / 604800000) * 604800000`;
      case '1M':
        return sql`strftime('%Y-%m-01', datetime(${metrics.timestamp} / 1000, 'unixepoch'))`;
      default:
        return sql`${metrics.timestamp}`;
    }
  }

  private groupMetrics(metrics: Metric[], period: AggregationPeriod): Map<string, Metric[]> {
    const groups = new Map<string, Metric[]>();

    for (const metric of metrics) {
      const groupTimestamp = this.roundTimestamp(metric.timestamp, period);
      const groupKey = `${groupTimestamp}:${this.generateTagKey(metric.tags)}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(metric);
    }

    return groups;
  }

  private roundTimestamp(timestamp: number, period: AggregationPeriod): number {
    const periodMs = this.getPeriodMs(period);
    return Math.floor(timestamp / periodMs) * periodMs;
  }

  private getPeriodMs(period: AggregationPeriod): number {
    switch (period) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      case '1w': return 7 * 24 * 60 * 60 * 1000;
      case '1M': return 30 * 24 * 60 * 60 * 1000; // Approximation
      default: return 60 * 1000;
    }
  }

  private calculateAggregation(metrics: Metric[], aggregation: AggregationType): number {
    const values = metrics.map(m => m.value);

    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'percentile_50':
        return this.calculatePercentile(values, 0.5);
      case 'percentile_95':
        return this.calculatePercentile(values, 0.95);
      case 'percentile_99':
        return this.calculatePercentile(values, 0.99);
      default:
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = percentile * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    return lower === upper
      ? sorted[lower]
      : sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private parseGroupKey(groupKey: string): [number, Record<string, string>] {
    const [timestampStr, tagsStr] = groupKey.split(':', 2);
    const timestamp = parseInt(timestampStr);
    const tags = tagsStr ? JSON.parse(tagsStr) : {};
    return [timestamp, tags];
  }

  private generateTagKey(tags: Record<string, string>): string {
    return Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        console.error('Scheduled flush failed:', error);
      }
    }, this.config.flushInterval);
  }
}