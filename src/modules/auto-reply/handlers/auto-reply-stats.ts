// src/modules/auto-reply/handlers/auto-reply-stats.ts
// Read-only auto-reply dashboard numbers: Asia/Taipei "today" counts, yesterday-same-time
// comparison, success rate and the business-hours state of the team.
//
// Scoping is identical to auto-reply-logs.ts: rules owned by the team plus global rules, and the
// caller must be able to see the conversation. Successes come from auto_reply_logs, failures from
// the auto_reply_deliveries ledger (status = 'failed').

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { and, or, eq, gte, isNull, isNotNull, sql } from 'drizzle-orm';
import { autoReplyDeliveries, autoReplyLogs, autoReplyRules, conversations } from '@/db/schema';
import { badRequestResponse, handleApiError, successResponse } from '@/utils/api-response';
import { getConversationVisibilityCondition } from '@/services/conversation-visibility';
import { taipeiDayStartISO } from '@/utils/taipei-time';
import { getBusinessHoursStatus } from '../services/schedule-service';
import type { AutoReplyStats } from '@shared/api-contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

const autoReplyStatsHandler = new Hono<{ Bindings: Bindings }>();

autoReplyStatsHandler.use('/*', jwtAuth);

autoReplyStatsHandler.get('/', async (c) => {
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

    const user = c.get('user');
    if (user.role !== 'admin' && !user.allowedTeamIds?.includes(teamId)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const nowMs = Date.now();
    const todayStart = taipeiDayStartISO(nowMs);
    const yesterdayStart = taipeiDayStartISO(nowMs, -1);
    const yesterdaySameTime = new Date(nowMs - DAY_MS).toISOString();

    const scope = and(
      or(eq(autoReplyRules.teamId, teamId), isNull(autoReplyRules.teamId)),
      getConversationVisibilityCondition(user),
      user.role === 'admin' ? undefined : isNotNull(conversations.id)
    );

    const [logRows, failedRows, businessHours] = await Promise.all([
      // One pass over [yesterday 00:00, now]: rows from today's start are "today", rows before the
      // same instant 24 h ago are "yesterday up to the same time of day".
      drizzleDb
        .select({
          today: sql<number>`coalesce(sum(case when ${autoReplyLogs.createdAt} >= ${todayStart} then 1 else 0 end), 0)`,
          yesterdaySameTime: sql<number>`coalesce(sum(case when ${autoReplyLogs.createdAt} < ${yesterdaySameTime} then 1 else 0 end), 0)`,
        })
        .from(autoReplyLogs)
        .leftJoin(autoReplyRules, eq(autoReplyLogs.ruleId, autoReplyRules.id))
        .leftJoin(conversations, eq(autoReplyLogs.conversationId, conversations.id))
        .where(and(scope, gte(autoReplyLogs.createdAt, yesterdayStart))),
      drizzleDb
        .select({ failed: sql<number>`count(*)` })
        .from(autoReplyDeliveries)
        .leftJoin(autoReplyRules, eq(autoReplyDeliveries.ruleId, autoReplyRules.id))
        .leftJoin(conversations, eq(autoReplyDeliveries.conversationId, conversations.id))
        .where(
          and(
            scope,
            eq(autoReplyDeliveries.status, 'failed'),
            gte(autoReplyDeliveries.createdAt, todayStart)
          )
        ),
      getBusinessHoursStatus(teamId, c.env),
    ]);

    const todaySuccess = Number(logRows[0]?.today ?? 0);
    const yesterdaySuccess = Number(logRows[0]?.yesterdaySameTime ?? 0);
    const todayFailed = Number(failedRows[0]?.failed ?? 0);
    const attempts = todaySuccess + todayFailed;

    const stats: AutoReplyStats = {
      todaySuccess,
      todayFailed,
      yesterdaySameTimeSuccess: yesterdaySuccess,
      successRate: attempts === 0 ? null : todaySuccess / attempts,
      businessHours,
    };
    return successResponse(c, stats, 'Auto-reply stats retrieved successfully');
  } catch (error) {
    return handleApiError(error, c);
  }
});

export default autoReplyStatsHandler;
