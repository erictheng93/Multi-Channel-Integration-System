// Security Monitoring API Handler
// P2-4: Security Monitoring Table Creation
// Provides endpoints for viewing security events and statistics

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('SecurityMonitoring')

import { jwtAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { WebhookSecurityService } from '@modules/integrations/services/webhook-security-service';
import type { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Get security event statistics
 * GET /api/security/events/stats
 *
 * Query parameters:
 * - hours: number (default: 24) - Time window for statistics
 * - integrationId: number (optional) - Filter by integration ID
 *
 * Response:
 * {
 * success: true,
 * data: {
 * totalEvents: number,
 * byType: { [type: string]: number },
 * bySeverity: { [severity: string]: number },
 * recentEvents: Array<SecurityEvent>
 * }
 * }
 */
app.get('/events/stats', jwtAuth, async (c) => {
  try {
    const agent = c.get('agent');

    // Only admins can view security events
    if (agent.role !== 'admin') {
      return errorResponse(c, 'Unauthorized: Admin access required', 403);
    }

    const hours = parseInt(c.req.query('hours') || '24');
    const integrationIdParam = c.req.query('integrationId');
    const integrationId = integrationIdParam ? parseInt(integrationIdParam) : undefined;

    // Validate hours parameter
    if (isNaN(hours) || hours < 1 || hours > 720) { // Max 30 days
      return errorResponse(c, 'Invalid hours parameter. Must be between 1 and 720', 400);
    }

    // Validate integrationId if provided
    if (integrationIdParam && isNaN(integrationId as number)) {
      return errorResponse(c, 'Invalid integrationId parameter', 400);
    }

    const webhookSecurity = new WebhookSecurityService(
      c.env,
      c.env.DB,
      c.env.CACHE
    );

    const stats = await webhookSecurity.getSecurityStats(integrationId, hours);

    return successResponse(c, stats);
  } catch (error) {
    log.error('Failed to get stats', {}, error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(
      c,
      `Failed to retrieve security statistics: ${errorMessage}`,
      500
    );
  }
});

/**
 * Get recent security events with pagination
 * GET /api/security/events
 *
 * Query parameters:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 * - platform: string (optional) - Filter by platform (line, facebook, whatsapp)
 * - severity: string (optional) - Filter by severity (low, medium, high, critical)
 * - hours: number (default: 24) - Time window for events
 *
 * Response:
 * {
 * success: true,
 * data: {
 * events: Array<SecurityEvent>,
 * total: number,
 * limit: number,
 * offset: number
 * }
 * }
 */
app.get('/events', jwtAuth, async (c) => {
  try {
    const agent = c.get('agent');

    // Only admins can view security events
    if (agent.role !== 'admin') {
      return errorResponse(c, 'Unauthorized: Admin access required', 403);
    }

    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    const hours = parseInt(c.req.query('hours') || '24');
    const platform = c.req.query('platform');
    const severity = c.req.query('severity');

    // Validate parameters
    if (isNaN(limit) || limit < 1) {
      return errorResponse(c, 'Invalid limit parameter', 400);
    }

    if (isNaN(offset) || offset < 0) {
      return errorResponse(c, 'Invalid offset parameter', 400);
    }

    if (isNaN(hours) || hours < 1 || hours > 720) {
      return errorResponse(c, 'Invalid hours parameter. Must be between 1 and 720', 400);
    }

    // Validate severity if provided
    if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) {
      return errorResponse(c, 'Invalid severity parameter', 400);
    }

    // Validate platform if provided
    if (platform && !['line', 'facebook', 'whatsapp', 'instagram'].includes(platform)) {
      return errorResponse(c, 'Invalid platform parameter', 400);
    }

    const webhookSecurity = new WebhookSecurityService(
      c.env,
      c.env.DB,
      c.env.CACHE
    );

    // Get stats to extract filtered events
    // Note: In a production system, you might want a separate method for paginated queries
    const stats = await webhookSecurity.getSecurityStats(undefined, hours);

    // Apply filters
    let filteredEvents = stats.recentEvents;

    if (platform) {
      filteredEvents = filteredEvents.filter(e => e.platform === platform);
    }

    if (severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === severity);
    }

    const total = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    return successResponse(c, {
      events: paginatedEvents,
      total,
      limit,
      offset
    });
  } catch (error) {
    log.error('Failed to get events', {}, error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(
      c,
      `Failed to retrieve security events: ${errorMessage}`,
      500
    );
  }
});

/**
 * Health check endpoint for security monitoring
 * GET /api/security/health
 *
 * Response:
 * {
 * success: true,
 * data: {
 * status: 'healthy',
 * message: 'Security monitoring is operational'
 * }
 * }
 */
app.get('/health', async (c) => {
  return successResponse(c, {
    status: 'healthy',
    message: 'Security monitoring is operational',
    features: [
      'Event logging to D1',
      'Statistics querying',
      'Real-time alerts',
      'Integration filtering'
    ]
  });
});

export default app;
