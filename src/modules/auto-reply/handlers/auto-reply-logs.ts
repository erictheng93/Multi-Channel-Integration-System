// src/modules/auto-reply/handlers/auto-reply-logs.ts
// Read-only handler for auto-reply audit logs

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { sql } from 'drizzle-orm';
import {
  paginatedResponse,
  badRequestResponse,
  handleApiError,
} from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp';

const autoReplyLogsHandler = new Hono<{ Bindings: Bindings }>();

autoReplyLogsHandler.use('/*', jwtAuth);

// ==================== Health check ====================
autoReplyLogsHandler.get('/health', (c) => {
  return c.json({
    success: true,
    data: { status: 'healthy', handler: 'auto-reply-logs', timestamp: nowISO() },
    message: 'Auto-reply logs handler is operational',
  });
});

// ==================== List logs (paginated) ====================
autoReplyLogsHandler.get('/', async (c) => {
  try {
    const drizzleDb = createDbClient(c.env.DB);
    const payload = c.get('jwtPayload');
    const teamId = parseInt(c.req.query('teamId') || '') || payload?.primaryTeamId;

    if (!teamId) {
      return badRequestResponse(c, 'teamId is required');
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;

    // Filter by ruleId if provided
    const ruleIdFilter = c.req.query('ruleId');
    const platformFilter = c.req.query('platform');

    // Build WHERE conditions
    const conditions: string[] = [`r.team_id = ${teamId}`];
    if (ruleIdFilter) conditions.push(`l.rule_id = ${parseInt(ruleIdFilter)}`);
    if (platformFilter) conditions.push(`l.platform = '${platformFilter}'`);

    const whereClause = conditions.join(' AND ');

    // Query logs with rule name via JOIN
    const logs = await drizzleDb.all(sql.raw(`
      SELECT
        l.id,
        l.rule_id,
        r.name as rule_name,
        l.conversation_id,
        l.customer_id,
        l.trigger_content,
        l.response_content,
        l.matched_condition,
        l.platform,
        l.reply_method,
        l.created_at
      FROM auto_reply_logs l
      LEFT JOIN auto_reply_rules r ON l.rule_id = r.id
      WHERE ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `));

    // Count total
    const countResult = await drizzleDb.all(sql.raw(`
      SELECT COUNT(*) as total
      FROM auto_reply_logs l
      LEFT JOIN auto_reply_rules r ON l.rule_id = r.id
      WHERE ${whereClause}
    `));

    const total = (countResult[0] as { total: number } | undefined)?.total || 0;

    return paginatedResponse(c, logs as Record<string, unknown>[], { page, limit: pageSize, total }, 'Logs retrieved successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

export default autoReplyLogsHandler;
