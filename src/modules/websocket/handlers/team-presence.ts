// GET /api/team/presence
// Who is online right now, from the MessageBroadcaster global user registry.
// Admin sees every online agent; an agent sees online members of their own teams only.

import { Hono } from 'hono';
import { inArray } from 'drizzle-orm';
import type { Bindings, DbUser } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { agentTeams } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import { globalErrorHandler } from '@/core/error-handler';
import { createContextLogger } from '@/utils/logger';
import { nowMs } from '@/utils/timestamp';
import { fetchOnlineUserIds } from '../services/realtime-metrics-service';

const log = createContextLogger('TeamPresence');

export const PRESENCE_CACHE_TTL_SECONDS = 15;

export interface TeamPresenceResponse {
  /** Agent ids with a registered realtime connection, already scoped to the caller. */
  onlineAgentIds: string[];
  /** The caller's own registry state. The UI should bind its own pill to the websocket store instead; see docs. */
  self: { id: string; registered: boolean };
  /** Epoch ms the list was computed (may be up to 15 s old because of the KV cache). */
  generatedAt: number;
  /** false when the broadcaster could not be reached: the list is empty because it is unknown, not because nobody is online. */
  available: boolean;
}

const teamPresenceApp = new Hono<{ Bindings: Bindings }>();

teamPresenceApp.use('*', jwtAuth);

teamPresenceApp.get('/presence', async (c) => {
  try {
    const user = c.get('user') as DbUser;
    const userId = String(user.id);
    const isAdmin = user.role === 'admin';
    const cacheKey = isAdmin ? 'presence:v1:admin' : `presence:v1:agent:${userId}`;

    try {
      const cached = await c.env.CACHE.get(cacheKey, 'json') as TeamPresenceResponse | null;
      // KV's minimum expirationTtl is 60 s, so the 15 s freshness is enforced on read via generatedAt.
      if (cached && nowMs() - cached.generatedAt < PRESENCE_CACHE_TTL_SECONDS * 1000) {
        const registered = isAdmin ? cached.onlineAgentIds.includes(userId) : cached.self.registered;
        return c.json({ success: true, data: { ...cached, self: { id: userId, registered } } });
      }
    } catch (error) {
      log.warn('presence cache read failed', { error: error instanceof Error ? error.message : String(error) });
    }

    const online = await fetchOnlineUserIds(c.env);
    if (online === null) {
      // Never cache an outage: the next request should try again.
      return c.json({
        success: true,
        data: { onlineAgentIds: [], self: { id: userId, registered: false }, generatedAt: nowMs(), available: false } satisfies TeamPresenceResponse
      });
    }

    const selfRegistered = online.includes(userId);
    let visible = online;
    if (!isAdmin) {
      const teamIds = [...new Set((user.allowedTeamIds ?? []).filter(Number.isFinite))];
      if (teamIds.length === 0 || online.length === 0) {
        visible = [];
      } else {
        const db = createDbClient(c.env.DB);
        const rows = await db
          .select({ agentId: agentTeams.agentId })
          .from(agentTeams)
          .where(inArray(agentTeams.teamId, teamIds));
        const teammates = new Set(rows.map(row => row.agentId));
        visible = online.filter(id => teammates.has(id));
      }
    }

    const data: TeamPresenceResponse = {
      onlineAgentIds: visible,
      self: { id: userId, registered: selfRegistered },
      generatedAt: nowMs(),
      available: true
    };
    try {
      await c.env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 60 });
    } catch (error) {
      log.warn('presence cache write failed', { error: error instanceof Error ? error.message : String(error) });
    }
    return c.json({ success: true, data });
  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default teamPresenceApp;
