// Dashboard endpoints
//   GET /api/dashboard/summary         today vs yesterday-same-time, waiting, first response
//   GET /api/dashboard/message-volume  customer messages per Taipei day x platform (+ prior period)
//
// Both are scoped by the caller's conversation visibility and cached in KV
// (summary 60 s, volume 300 s) per visibility scope, so N agents on the same
// teams share one computation.

import { Hono } from 'hono';
import { globalErrorHandler } from '@/core/error-handler';
import { jwtAuth } from '@/middleware/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { dashboardContracts } from '@shared/api-contracts/dashboard';
import { contractJson } from '@/utils/api-contract-response';
import { nowISO, nowMs } from '@/utils/timestamp';
import { readThrough, DASHBOARD_SUMMARY_TTL_SECONDS, DASHBOARD_VOLUME_TTL_SECONDS } from '../services/kv-cache';
import { buildDashboardSummary, buildMessageVolume, visibilityScopeKey } from '../services/dashboard-service';


const dashboardHandler = new Hono<{ Bindings: Bindings }>();

dashboardHandler.get('/summary', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const data = await readThrough(
      c.env.CACHE,
      `dashboard:v2:summary:${visibilityScopeKey(user)}`,
      DASHBOARD_SUMMARY_TTL_SECONDS,
      () => buildDashboardSummary(c.env.DB, user, nowMs())
    );
    return contractJson(c, dashboardContracts.summary, { success: true, data, timestamp: nowISO() });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

dashboardHandler.get('/message-volume', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const daysParam = c.req.query('days');
    const days = daysParam === undefined ? 7 : Number.parseInt(daysParam, 10);
    if (days !== 7 && days !== 30 && days !== 90) {
      return c.json(
        { success: false, error: 'days must be 7, 30 or 90', timestamp: nowISO() },
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const data = await readThrough(
      c.env.CACHE,
      `dashboard:v1:volume:${visibilityScopeKey(user)}:${days}`,
      DASHBOARD_VOLUME_TTL_SECONDS,
      () => buildMessageVolume(c.env.DB, user, days, nowMs())
    );
    return contractJson(c, dashboardContracts.messageVolume, { success: true, data, timestamp: nowISO() });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export { dashboardHandler };
export default dashboardHandler;
