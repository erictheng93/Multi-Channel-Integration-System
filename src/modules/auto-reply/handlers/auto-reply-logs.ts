// src/modules/auto-reply/handlers/auto-reply-logs.ts
// Read-only handler for auto-reply audit logs
//
// SECURITY NOTE: this handler previously built SQL via template-literal
// concatenation and `sql.raw()`, which meant `platform` and `dateFrom` query
// parameters were interpolated directly into the SELECT. That was an active
// authenticated SQL injection (see git log for commit fixing it). The current
// implementation uses Drizzle's typed query builder exclusively — every value
// is bound as a parameter, so injection is impossible by construction. The
// explicit allowlist / format checks below are defence-in-depth: they reject
// obviously bad input with a 400 instead of letting junk flow into the DB.

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { and, or, eq, gte, isNull, desc, count } from 'drizzle-orm';
import { autoReplyLogs, autoReplyRules } from '@/db/schema';
import {
  badRequestResponse,
  handleApiError,
} from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp';
import {
  autoReplyContracts,
  type AutoReplyLog,
} from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';

const autoReplyLogsHandler = new Hono<{ Bindings: Bindings }>();

autoReplyLogsHandler.use('/*', jwtAuth);

// Keep this aligned with `autoReplyLogs.platform` in src/db/schema.ts.
// Drizzle binds values as parameters, so an unknown platform cannot inject
// SQL even without this check — but returning 400 on typos beats silently
// returning an empty page.
const ALLOWED_PLATFORMS = new Set(['line', 'facebook', 'whatsapp']);

type AutoReplyLogPlatform = AutoReplyLog['platform'];
type AutoReplyReplyMethod = AutoReplyLog['reply_method'];

/**
 * Parse an ISO 8601 date string. Returns null if the input is unparseable.
 * Used to reject obviously malformed `dateFrom` query params up front.
 */
function parseIsoDate(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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
    const teamId =
      parseInt(c.req.query('teamId') || '') ||
      c.get('contextTeamId') ||
      payload?.primaryTeamId;

    if (!teamId) {
      return badRequestResponse(c, 'teamId is required');
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;

    // ──────────────────────────────────────────────────────────────────
    // Parse and validate optional filters. All values eventually reach the
    // DB as bound parameters via Drizzle, so SQL injection is impossible
    // regardless of what we do here. The checks below just reject obviously
    // bad input with a 400 instead of a confusing downstream error.
    // ──────────────────────────────────────────────────────────────────
    const rawRuleId = c.req.query('ruleId');
    let ruleIdFilter: number | null = null;
    if (rawRuleId !== undefined && rawRuleId !== '') {
      const parsed = parseInt(rawRuleId, 10);
      if (Number.isNaN(parsed)) {
        return badRequestResponse(c, 'ruleId must be an integer');
      }
      ruleIdFilter = parsed;
    }

    const rawPlatform = c.req.query('platform');
    let platformFilter: string | null = null;
    if (rawPlatform !== undefined && rawPlatform !== '') {
      if (!ALLOWED_PLATFORMS.has(rawPlatform)) {
        return badRequestResponse(
          c,
          `platform must be one of: ${[...ALLOWED_PLATFORMS].join(', ')}`
        );
      }
      platformFilter = rawPlatform;
    }

    const rawDateFrom = c.req.query('dateFrom');
    let dateFromFilter: string | null = null;
    if (rawDateFrom !== undefined && rawDateFrom !== '') {
      const parsed = parseIsoDate(rawDateFrom);
      if (parsed === null) {
        return badRequestResponse(c, 'dateFrom must be a valid ISO 8601 date');
      }
      dateFromFilter = parsed;
    }

    // ──────────────────────────────────────────────────────────────────
    // Team scoping: include rules owned by the caller's team AND global
    // rules (team_id IS NULL). This matches the previous behaviour.
    // ──────────────────────────────────────────────────────────────────
    const teamCondition = or(
      eq(autoReplyRules.teamId, teamId),
      isNull(autoReplyRules.teamId)
    );

    // Build the full filter set for the listing and total-count queries
    const listConditions = [teamCondition];
    if (ruleIdFilter !== null) {
      listConditions.push(eq(autoReplyLogs.ruleId, ruleIdFilter));
    }
    if (platformFilter !== null) {
      listConditions.push(eq(autoReplyLogs.platform, platformFilter));
    }
    if (dateFromFilter !== null) {
      listConditions.push(gte(autoReplyLogs.createdAt, dateFromFilter));
    }
    const listWhere = and(...listConditions);

    // "Today" cut-off for the auxiliary count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const todayWhere = and(teamCondition, gte(autoReplyLogs.createdAt, todayISO));

    // ──────────────────────────────────────────────────────────────────
    // Run the three queries in parallel. The projection preserves the
    // snake_case keys the frontend already expects (rule_id, rule_name,
    // conversation_id, ...) — do NOT rename without coordinating a
    // frontend change.
    // ──────────────────────────────────────────────────────────────────
    const logsProjection = {
      id: autoReplyLogs.id,
      rule_id: autoReplyLogs.ruleId,
      rule_name: autoReplyRules.name,
      conversation_id: autoReplyLogs.conversationId,
      customer_id: autoReplyLogs.customerId,
      trigger_content: autoReplyLogs.triggerContent,
      response_content: autoReplyLogs.responseContent,
      matched_condition: autoReplyLogs.matchedCondition,
      platform: autoReplyLogs.platform,
      reply_method: autoReplyLogs.replyMethod,
      created_at: autoReplyLogs.createdAt,
    };

    const [logs, countRows, todayCountRows] = await Promise.all([
      drizzleDb
        .select(logsProjection)
        .from(autoReplyLogs)
        .leftJoin(autoReplyRules, eq(autoReplyLogs.ruleId, autoReplyRules.id))
        .where(listWhere)
        .orderBy(desc(autoReplyLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      drizzleDb
        .select({ total: count() })
        .from(autoReplyLogs)
        .leftJoin(autoReplyRules, eq(autoReplyLogs.ruleId, autoReplyRules.id))
        .where(listWhere),
      drizzleDb
        .select({ total: count() })
        .from(autoReplyLogs)
        .leftJoin(autoReplyRules, eq(autoReplyLogs.ruleId, autoReplyRules.id))
        .where(todayWhere),
    ]);

    const total = countRows[0]?.total ?? 0;
    const todayTotal = todayCountRows[0]?.total ?? 0;
    const contractLogs: AutoReplyLog[] = logs.map((log) => ({
      id: log.id,
      rule_id: log.rule_id,
      rule_name: log.rule_name ?? '',
      conversation_id: log.conversation_id ?? '',
      customer_id: log.customer_id ?? 0,
      trigger_content: log.trigger_content ?? '',
      response_content: log.response_content ?? '',
      matched_condition: log.matched_condition ?? '',
      platform: log.platform as AutoReplyLogPlatform,
      reply_method: log.reply_method as AutoReplyReplyMethod,
      created_at: log.created_at ?? nowISO(),
    }));

    return contractJson(c, autoReplyContracts.getLogs, {
      success: true,
      data: {
        items: contractLogs,
        page,
        limit: pageSize,
        total,
        todayTotal,
      },
      message: 'Logs retrieved successfully',
    });
  } catch (error) {
    return handleApiError(error, c);
  }
});

export default autoReplyLogsHandler;
