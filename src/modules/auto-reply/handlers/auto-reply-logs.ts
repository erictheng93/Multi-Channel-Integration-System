// src/modules/auto-reply/handlers/auto-reply-logs.ts
// Read-only handler for auto-reply audit logs

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { sql } from 'drizzle-orm';
import {
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
    const teamId = parseInt(c.req.query('teamId') || '') || c.get('contextTeamId') || payload?.primaryTeamId;

    if (!teamId) {
      return badRequestResponse(c, 'teamId is required');
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;

    // Filter by ruleId if provided
    const ruleIdFilter = c.req.query('ruleId');
    const platformFilter = c.req.query('platform');
    const dateFrom = c.req.query('dateFrom');

    // Build WHERE conditions — include global rules (team_id IS NULL) alongside team rules
    const conditions: string[] = [`(r.team_id = ${teamId} OR r.team_id IS NULL)`];
    if (ruleIdFilter) conditions.push(`l.rule_id = ${parseInt(ruleIdFilter)}`);
    if (platformFilter) conditions.push(`l.platform = '${platformFilter}'`);
    if (dateFrom) conditions.push(`l.created_at >= '${dateFrom}'`);

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

    // Count total + today's total in parallel
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const teamCondition = `(r.team_id = ${teamId} OR r.team_id IS NULL)`;

    const [countResult, todayCountResult] = await Promise.all([
      drizzleDb.all(sql.raw(`
        SELECT COUNT(*) as total
        FROM auto_reply_logs l
        LEFT JOIN auto_reply_rules r ON l.rule_id = r.id
        WHERE ${whereClause}
      `)),
      drizzleDb.all(sql.raw(`
        SELECT COUNT(*) as total
        FROM auto_reply_logs l
        LEFT JOIN auto_reply_rules r ON l.rule_id = r.id
        WHERE ${teamCondition} AND l.created_at >= '${todayISO}'
      `)),
    ]);

    const total = (countResult[0] as { total: number } | undefined)?.total || 0;
    const todayTotal = (todayCountResult[0] as { total: number } | undefined)?.total || 0;

    // Use custom response to include todayTotal alongside standard pagination
    const totalPages = Math.ceil(total / pageSize);
    return c.json({
      success: true,
      data: {
        items: logs,
        page,
        pageSize,
        limit: pageSize,
        total,
        todayTotal,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      message: 'Logs retrieved successfully',
    });
  } catch (error) {
    return handleApiError(error, c);
  }
});

export default autoReplyLogsHandler;
