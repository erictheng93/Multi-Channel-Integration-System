/**
 * KV Optimization Monitoring Handler
 *
 * Provides real-time monitoring and analytics for KV optimization efforts:
 * - Activity cache statistics
 * - Request frequency tracking
 * - KV usage metrics
 * - Performance comparison (before/after optimization)
 *
 * Created: 2025-01-08 (P0 Optimization)
 */

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth, requireAdmin } from '@/middleware/auth';
import { getActivityCacheStats } from '@/utils/auth';
import { createContextLogger } from '@/utils/logger';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { nowISO, nowMs } from '@/utils/timestamp'

const kvMonitoringHandler = new Hono<{ Bindings: Bindings }>();
const logger = createContextLogger('KVOptimizationMonitoring');

/**
 * Global request counters for frequency tracking
 * Map<userId, { count: number; lastReset: number; hourlyStats: number[] }>
 */
const requestCounters = new Map<string, {
  count: number;
  lastReset: number;
  hourlyStats: number[];
  peakRequestsPerHour: number;
}>();

/**
 * KV operation counters (for comparison with old implementation)
 * This is for monitoring purposes only - actual implementation uses zero KV ops
 */
const kvOperationStats = {
  // Theoretical savings (based on old implementation)
  savedReads: 0,
  savedWrites: 0,
  startTime: nowMs(),
  // Actual operations (should be minimal after optimization)
  actualReads: 0,
  actualWrites: 0,
};

/**
 * Increment request counter for a user
 * Called from auth middleware
 */
function incrementRequestCounter(userId: string): void {
  const now = nowMs();
  const counter = requestCounters.get(userId) || {
    count: 0,
    lastReset: now,
    hourlyStats: [],
    peakRequestsPerHour: 0
  };

  // Reset counter every hour
  if (now - counter.lastReset > 60 * 60 * 1000) {
    // Store hourly stat before reset
    counter.hourlyStats.push(counter.count);
    if (counter.count > counter.peakRequestsPerHour) {
      counter.peakRequestsPerHour = counter.count;
    }

    // Keep only last 24 hours of stats
    if (counter.hourlyStats.length > 24) {
      counter.hourlyStats.shift();
    }

    // Detect abnormally high frequency
    if (counter.count > 100) {
      logger.warn('High request frequency detected', {
        userId,
        requestsLastHour: counter.count,
        averagePerDay: counter.hourlyStats.reduce((a, b) => a + b, 0) / counter.hourlyStats.length
      });
    }

    // Reset
    requestCounters.set(userId, {
      count: 1,
      lastReset: now,
      hourlyStats: counter.hourlyStats,
      peakRequestsPerHour: counter.peakRequestsPerHour
    });
  } else {
    counter.count++;
    requestCounters.set(userId, counter);
  }
}

/**
 * Track theoretical KV savings
 * In old implementation, each auth request would do 1 KV read
 * Every 15 minutes, it would also do 1 KV write
 */
function trackTheoreticalKVSavings(wasDebounced: boolean): void {
  kvOperationStats.savedReads++;
  if (!wasDebounced) {
    kvOperationStats.savedWrites++;
  }
}

/**
 * GET /api/monitoring/kv/activity-cache
 * Get activity cache statistics
 */
kvMonitoringHandler.get('/activity-cache', jwtAuth, requireAdmin(), async (c) => {
  try {
    const stats = getActivityCacheStats();

    return c.json({
      success: true,
      data: {
        cache: stats,
        optimization: {
          version: 'v3.0',
          implementation: 'Pure in-memory debouncing',
          kvOperations: 'Zero KV reads/writes',
          memoryFootprint: `${stats.estimatedMemoryKB.toFixed(2)} KB`
        },
        healthCheck: {
          status: stats.size > 0 ? 'active' : 'idle',
          isOptimal: stats.estimatedMemoryKB < 500, // Alert if > 500 KB
          recommendation: stats.size > 10000 ? 'Consider cache cleanup if Worker memory is constrained' : 'Operating normally'
        }
      },
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/monitoring/kv/request-frequency
 * Get request frequency statistics
 */
kvMonitoringHandler.get('/request-frequency', jwtAuth, requireAdmin(), async (c) => {
  try {
    const now = nowMs();
    const stats = Array.from(requestCounters.entries()).map(([userId, data]) => ({
      userId,
      currentHourRequests: data.count,
      hoursSinceReset: ((now - data.lastReset) / (60 * 60 * 1000)).toFixed(2),
      last24HoursStats: data.hourlyStats,
      averageRequestsPerHour: data.hourlyStats.length > 0
        ? (data.hourlyStats.reduce((a, b) => a + b, 0) / data.hourlyStats.length).toFixed(1)
        : 'N/A',
      peakRequestsPerHour: data.peakRequestsPerHour,
      isHighFrequency: data.count > 50 || data.peakRequestsPerHour > 100
    }));

    // Sort by current hour requests (descending)
    stats.sort((a, b) => b.currentHourRequests - a.currentHourRequests);

    return c.json({
      success: true,
      data: {
        totalUsers: stats.length,
        topUsers: stats.slice(0, 10), // Top 10 most active users
        highFrequencyUsers: stats.filter(s => s.isHighFrequency),
        summary: {
          totalRequestsThisHour: stats.reduce((sum, s) => sum + s.currentHourRequests, 0),
          averageRequestsPerUser: stats.length > 0
            ? (stats.reduce((sum, s) => sum + s.currentHourRequests, 0) / stats.length).toFixed(1)
            : 0,
          peakUser: stats[0] ? {
            userId: stats[0].userId,
            requests: stats[0].currentHourRequests
          } : null
        }
      },
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/monitoring/kv/savings
 * Get KV optimization savings statistics
 */
kvMonitoringHandler.get('/savings', jwtAuth, requireAdmin(), async (c) => {
  try {
    const now = nowMs();
    const uptimeHours = (now - kvOperationStats.startTime) / (60 * 60 * 1000);

    // Calculate theoretical daily savings
    const dailySavedReads = kvOperationStats.savedReads * (24 / uptimeHours);
    const dailySavedWrites = kvOperationStats.savedWrites * (24 / uptimeHours);

    // Cloudflare KV Free tier limits
    const FREE_TIER_DAILY_WRITES = 1000;
    const FREE_TIER_DAILY_READS = 100000;

    return c.json({
      success: true,
      data: {
        optimization: {
          version: 'v3.0',
          implementation: 'Pure in-memory debouncing',
          status: 'Active since ' + new Date(kvOperationStats.startTime).toISOString()
        },
        savings: {
          sinceOptimization: {
            uptimeHours: uptimeHours.toFixed(2),
            savedReads: kvOperationStats.savedReads,
            savedWrites: kvOperationStats.savedWrites,
            actualReads: kvOperationStats.actualReads,
            actualWrites: kvOperationStats.actualWrites
          },
          projectedDaily: {
            savedReads: Math.round(dailySavedReads),
            savedWrites: Math.round(dailySavedWrites),
            savedReadsPercentage: ((dailySavedReads / FREE_TIER_DAILY_READS) * 100).toFixed(2) + '%',
            savedWritesPercentage: ((dailySavedWrites / FREE_TIER_DAILY_WRITES) * 100).toFixed(2) + '%'
          },
          freeTierImpact: {
            dailyWriteLimit: FREE_TIER_DAILY_WRITES,
            projectedWritesWithoutOptimization: Math.round(dailySavedWrites),
            writesFreedUp: Math.round(dailySavedWrites),
            quotaUtilizationBefore: ((dailySavedWrites / FREE_TIER_DAILY_WRITES) * 100).toFixed(1) + '%',
            quotaUtilizationAfter: '0%',
            quotaSavings: Math.round(dailySavedWrites) + ' writes/day freed up'
          }
        },
        comparison: {
          before: {
            approach: 'KV-based debouncing',
            kvReadsPerAuth: 1,
            kvWritesPerUpdate: 1,
            estimatedDailyReads: Math.round(dailySavedReads),
            estimatedDailyWrites: Math.round(dailySavedWrites)
          },
          after: {
            approach: 'Pure in-memory debouncing',
            kvReadsPerAuth: 0,
            kvWritesPerUpdate: 0,
            estimatedDailyReads: 0,
            estimatedDailyWrites: 0
          },
          improvement: {
            readReduction: '100%',
            writeReduction: '100%',
            performanceGain: 'Faster (no network calls)',
            costSavings: 'Maximum (zero KV operations)'
          }
        }
      },
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * GET /api/monitoring/kv/health
 * Get overall KV optimization health status
 */
kvMonitoringHandler.get('/health', jwtAuth, requireAdmin(), async (c) => {
  try {
    const cacheStats = getActivityCacheStats();
    const now = nowMs();
    const uptimeHours = (now - kvOperationStats.startTime) / (60 * 60 * 1000);

    // Calculate health metrics
    const issues = [];
    const warnings = [];

    // Check memory usage
    if (cacheStats.estimatedMemoryKB > 500) {
      warnings.push('Memory usage above 500 KB - consider cache cleanup');
    }

    // Check for high-frequency users
    const highFreqUsers = Array.from(requestCounters.values()).filter(c => c.count > 100);
    if (highFreqUsers.length > 0) {
      warnings.push(`${highFreqUsers.length} user(s) with >100 requests/hour detected`);
    }

    // Check if optimization is working
    if (uptimeHours > 1 && kvOperationStats.savedReads === 0) {
      issues.push('No KV read savings detected - optimization may not be active');
    }

    const healthStatus = issues.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'healthy';

    return c.json({
      success: true,
      data: {
        status: healthStatus,
        summary: {
          optimizationActive: uptimeHours > 0,
          cacheSizeOK: cacheStats.estimatedMemoryKB < 500,
          noHighFrequencyAnomalies: highFreqUsers.length === 0,
          kvSavingsDetected: kvOperationStats.savedReads > 0
        },
        metrics: {
          cacheSize: cacheStats.size,
          memoryUsageKB: cacheStats.estimatedMemoryKB,
          requestCountersActive: requestCounters.size,
          uptimeHours: uptimeHours.toFixed(2),
          kvReadsSaved: kvOperationStats.savedReads,
          kvWritesSaved: kvOperationStats.savedWrites
        },
        issues: issues.length > 0 ? issues : null,
        warnings: warnings.length > 0 ? warnings : null,
        recommendations: [
          healthStatus === 'healthy' ? 'System operating optimally' : null,
          warnings.length > 0 ? 'Review warnings and take action if needed' : null,
          issues.length > 0 ? 'Critical issues detected - immediate attention required' : null
        ].filter(Boolean)
      },
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * POST /api/monitoring/kv/reset
 * Reset all monitoring counters (for testing)
 */
kvMonitoringHandler.post('/reset', jwtAuth, requireAdmin(), async (c) => {
  try {
    requestCounters.clear();
    kvOperationStats.savedReads = 0;
    kvOperationStats.savedWrites = 0;
    kvOperationStats.actualReads = 0;
    kvOperationStats.actualWrites = 0;
    kvOperationStats.startTime = nowMs();

    logger.info('KV optimization monitoring counters reset');

    return c.json({
      success: true,
      message: 'All monitoring counters reset',
      timestamp: nowISO()
    });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default kvMonitoringHandler;
export { incrementRequestCounter, trackTheoreticalKVSavings };
