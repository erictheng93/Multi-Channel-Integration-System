// Security Dashboard API Handler
// Security analytics endpoints

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { SecurityAnalyticsService, type TimeRange } from '@/services/security-analytics-service';

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Health check endpoint
 * GET /api/security/dashboard/health
 */
app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      module: 'security-dashboard',
      version: '1.0.0'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Get comprehensive security dashboard metrics
 * GET /api/security/dashboard/metrics
 * Query params: timeRange (1h, 24h, 7d, 30d)
 */
app.get('/metrics', jwtAuth, async (c) => {
  try {
    const agent = c.get('agent');

    // Only admins can view security dashboard
    if (agent.role !== 'admin') {
      return errorResponse(c, 'Unauthorized: Admin access required', 403);
    }

    const timeRange = (c.req.query('timeRange') || '24h') as TimeRange;

    // Validate time range
    if (!['1h', '24h', '7d', '30d'].includes(timeRange)) {
      return errorResponse(c, 'Invalid timeRange. Must be: 1h, 24h, 7d, or 30d', 400);
    }

    const analyticsService = new SecurityAnalyticsService(c.env);
    const metrics = await analyticsService.getDashboardMetrics(timeRange);

    return successResponse(c, metrics);
  } catch (error) {
    console.error('[SecurityDashboard] Failed to get metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(c, `Failed to retrieve dashboard metrics: ${errorMessage}`, 500);
  }
});

/**
 * Get recent security events
 * GET /api/security/dashboard/events/recent
 * Query params: limit (default: 50, max: 200)
 */
app.get('/events/recent', jwtAuth, async (c) => {
  try {
    const agent = c.get('agent');

    // Only admins can view security events
    if (agent.role !== 'admin') {
      return errorResponse(c, 'Unauthorized: Admin access required', 403);
    }

    const limitParam = c.req.query('limit') || '50';
    const limit = Math.min(parseInt(limitParam, 10), 200);

    if (isNaN(limit) || limit < 1) {
      return errorResponse(c, 'Invalid limit. Must be between 1 and 200', 400);
    }

    const analyticsService = new SecurityAnalyticsService(c.env);
    const events = await analyticsService.getRealtimeEvents(limit);

    return successResponse(c, {
      events,
      count: events.length,
      limit
    });
  } catch (error) {
    console.error('[SecurityDashboard] Failed to get recent events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(c, `Failed to retrieve recent events: ${errorMessage}`, 500);
  }
});

/**
 * Get security summary statistics
 * GET /api/security/dashboard/summary
 * Lightweight endpoint for quick overview
 */
app.get('/summary', jwtAuth, async (c) => {
  try {
    const agent = c.get('agent');

    // Only admins can view security summary
    if (agent.role !== 'admin') {
      return errorResponse(c, 'Unauthorized: Admin access required', 403);
    }

    const analyticsService = new SecurityAnalyticsService(c.env);
    const metrics = await analyticsService.getDashboardMetrics('24h');

    // Return only summary data for quick overview
    return successResponse(c, {
      summary: metrics.summary,
      webhookSummary: {
        total: metrics.webhookSecurity.totalEvents,
        byPlatform: metrics.webhookSecurity.byPlatform,
        topType: Object.entries(metrics.webhookSecurity.byType)
          .sort(([, a], [, b]) => b - a)[0]
      },
      corsSummary: {
        total: metrics.corsMonitoring.totalEvents,
        allowed: metrics.corsMonitoring.allowedRequests,
        rejected: metrics.corsMonitoring.rejectedRequests
      }
    });
  } catch (error) {
    console.error('[SecurityDashboard] Failed to get summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(c, `Failed to retrieve security summary: ${errorMessage}`, 500);
  }
});

export default app;
