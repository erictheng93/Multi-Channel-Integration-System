// Security Analytics Service
// Real-time security metrics and dashboard data service

import type { Bindings } from '@/types';
import { createDbClient } from '../db/drizzle-factory';
import { webhookSecurityEvents, corsEvents } from '@/db/schema';
import { gte, desc } from 'drizzle-orm';

/**
 * Real-time security dashboard metrics
 */
export interface SecurityDashboardMetrics {
  summary: {
    totalEvents: number;
    criticalEvents: number;
    highEvents: number;
    mediumEvents: number;
    lowEvents: number;
    eventsPerHour: number;
    topThreats: Array<{
      type: string;
      count: number;
      severity: string;
    }>;
  };
  webhookSecurity: {
    totalEvents: number;
    byPlatform: Record<string, number>;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentEvents: Array<{
      id: string;
      type: string;
      severity: string;
      platform: string;
      sourceIp: string | null;
      timestamp: string;
    }>;
  };
  corsMonitoring: {
    totalEvents: number;
    allowedRequests: number;
    rejectedRequests: number;
    topRejectedOrigins: Array<{
      origin: string;
      count: number;
    }>;
    recentRejections: Array<{
      origin: string;
      path: string;
      timestamp: string;
    }>;
  };
  trends: {
    hourlyDistribution: Array<{
      hour: string;
      count: number;
      criticalCount: number;
    }>;
    platformDistribution: Array<{
      platform: string;
      count: number;
      percentage: number;
    }>;
  };
  alerts: {
    totalAlertsSent: number;
    alertsByChannel: Record<string, number>;
    recentAlerts: Array<{
      severity: string;
      message: string;
      timestamp: string;
    }>;
  };
}

/**
 * Time range for analytics queries
 */
export type TimeRange = '1h' | '24h' | '7d' | '30d';

/**
 * Security Analytics Service
 * Provides real-time security metrics and dashboard data
 */
export class SecurityAnalyticsService {
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Get comprehensive security dashboard metrics
   *
   * @param timeRange - Time range for metrics (default: 24h)
   * @returns Complete dashboard metrics
   */
  async getDashboardMetrics(timeRange: TimeRange = '24h'): Promise<SecurityDashboardMetrics> {
    const hours = this.getHoursFromTimeRange(timeRange);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const db = createDbClient(this.env.DB);

    // Fetch webhook security events
    const webhookEvents = await db
      .select()
      .from(webhookSecurityEvents)
      .where(gte(webhookSecurityEvents.createdAt, since))
      .orderBy(desc(webhookSecurityEvents.createdAt))
      .limit(1000);

    // Fetch CORS events
    const corsEventsData = await db
      .select()
      .from(corsEvents)
      .where(gte(corsEvents.timestamp, since))
      .orderBy(desc(corsEvents.timestamp))
      .limit(1000);

    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(webhookEvents, hours);

    // Calculate webhook security metrics
    const webhookSecurity = this.calculateWebhookMetrics(webhookEvents);

    // Calculate CORS metrics
    const corsMonitoring = this.calculateCorsMetrics(corsEventsData);

    // Calculate trends
    const trends = this.calculateTrends(webhookEvents);

    // Placeholder for alerts (would be populated from alert logs)
    const alerts = {
      totalAlertsSent: webhookEvents.filter(e =>
        e.severity === 'critical' || e.severity === 'high'
      ).length,
      alertsByChannel: {
        email: 0,
        slack: 0,
        webhook: 0
      },
      recentAlerts: [] as Array<{ id: string; message: string; timestamp: string; severity: string }>
    };

    return {
      summary,
      webhookSecurity,
      corsMonitoring,
      trends,
      alerts
    };
  }

  /**
   * Get real-time event stream data (latest events)
   *
   * @param limit - Maximum number of events to return
   * @returns Recent security events across all types
   */
  async getRealtimeEvents(limit: number = 50): Promise<Array<{
    id: string;
    type: string;
    category: 'webhook' | 'cors';
    severity?: string;
    platform?: string;
    origin?: string;
    timestamp: string;
    metadata: any;
  }>> {
    const db = createDbClient(this.env.DB);

    // Get recent webhook events
    const webhookEvents = await db
      .select()
      .from(webhookSecurityEvents)
      .orderBy(desc(webhookSecurityEvents.createdAt))
      .limit(Math.floor(limit / 2));

    // Get recent CORS events
    const corsEventsData = await db
      .select()
      .from(corsEvents)
      .orderBy(desc(corsEvents.timestamp))
      .limit(Math.floor(limit / 2));

    // Combine and sort by timestamp
    const combined = [
      ...webhookEvents.map(e => ({
        id: e.id,
        type: e.type,
        category: 'webhook' as const,
        severity: e.severity,
        platform: e.platform,
        timestamp: e.createdAt,
        metadata: {
          sourceIp: e.sourceIp,
          integrationId: e.integrationId,
          details: e.details ? JSON.parse(e.details) : {}
        }
      })),
      ...corsEventsData.map(e => ({
        id: e.id,
        type: e.type,
        category: 'cors' as const,
        origin: e.origin,
        timestamp: e.timestamp,
        metadata: {
          method: e.method,
          path: e.path,
          userAgent: e.userAgent,
          metadata: e.metadata ? JSON.parse(e.metadata) : {}
        }
      }))
    ];

    // Sort by timestamp descending
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return combined.slice(0, limit);
  }

  /**
   * Calculate summary metrics from webhook events
   */
  private calculateSummaryMetrics(
    events: any[],
    hours: number
  ): SecurityDashboardMetrics['summary'] {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const typeCounts: Record<string, { count: number; severity: string }> = {};

    events.forEach(event => {
      // Count by severity
      const severity = event.severity as keyof typeof severityCounts;
      if (severity in severityCounts) {
        severityCounts[severity]++;
      }

      // Count by type
      if (!typeCounts[event.type]) {
        typeCounts[event.type] = { count: 0, severity: event.severity };
      }
      typeCounts[event.type].count++;
    });

    // Get top threats
    const topThreats = Object.entries(typeCounts)
      .map(([type, data]) => ({
        type,
        count: data.count,
        severity: data.severity
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: events.length,
      criticalEvents: severityCounts.critical,
      highEvents: severityCounts.high,
      mediumEvents: severityCounts.medium,
      lowEvents: severityCounts.low,
      eventsPerHour: hours > 0 ? Math.round(events.length / hours) : events.length,
      topThreats
    };
  }

  /**
   * Calculate webhook security metrics
   */
  private calculateWebhookMetrics(
    events: any[]
  ): SecurityDashboardMetrics['webhookSecurity'] {
    const byPlatform: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    events.forEach(event => {
      byPlatform[event.platform] = (byPlatform[event.platform] || 0) + 1;
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    });

    const recentEvents = events.slice(0, 10).map(e => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      platform: e.platform,
      sourceIp: e.sourceIp,
      timestamp: e.createdAt
    }));

    return {
      totalEvents: events.length,
      byPlatform,
      byType,
      bySeverity,
      recentEvents
    };
  }

  /**
   * Calculate CORS monitoring metrics
   */
  private calculateCorsMetrics(
    events: any[]
  ): SecurityDashboardMetrics['corsMonitoring'] {
    const allowedRequests = events.filter(e => e.type === 'allowed').length;
    const rejectedRequests = events.filter(e => e.type === 'rejected').length;

    // Count rejected origins
    const rejectedOriginCounts: Record<string, number> = {};
    events
      .filter(e => e.type === 'rejected')
      .forEach(e => {
        rejectedOriginCounts[e.origin] = (rejectedOriginCounts[e.origin] || 0) + 1;
      });

    const topRejectedOrigins = Object.entries(rejectedOriginCounts)
      .map(([origin, count]) => ({ origin, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentRejections = events
      .filter(e => e.type === 'rejected')
      .slice(0, 10)
      .map(e => ({
        origin: e.origin,
        path: e.path || '',
        timestamp: e.timestamp
      }));

    return {
      totalEvents: events.length,
      allowedRequests,
      rejectedRequests,
      topRejectedOrigins,
      recentRejections
    };
  }

  /**
   * Calculate trend metrics
   */
  private calculateTrends(
    events: any[]
  ): SecurityDashboardMetrics['trends'] {
    // Hourly distribution (last 24 hours)
    const hourlyMap: Record<string, { count: number; criticalCount: number }> = {};

    events.forEach(event => {
      const hour = new Date(event.createdAt).toISOString().slice(0, 13) + ':00:00';
      if (!hourlyMap[hour]) {
        hourlyMap[hour] = { count: 0, criticalCount: 0 };
      }
      hourlyMap[hour].count++;
      if (event.severity === 'critical') {
        hourlyMap[hour].criticalCount++;
      }
    });

    const hourlyDistribution = Object.entries(hourlyMap)
      .map(([hour, data]) => ({
        hour,
        count: data.count,
        criticalCount: data.criticalCount
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-24); // Last 24 hours

    // Platform distribution
    const platformCounts: Record<string, number> = {};
    events.forEach(event => {
      platformCounts[event.platform] = (platformCounts[event.platform] || 0) + 1;
    });

    const total = events.length;
    const platformDistribution = Object.entries(platformCounts)
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      hourlyDistribution,
      platformDistribution
    };
  }

  /**
   * Convert time range string to hours
   */
  private getHoursFromTimeRange(timeRange: TimeRange): number {
    const map: Record<TimeRange, number> = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    };
    return map[timeRange] || 24;
  }
}
