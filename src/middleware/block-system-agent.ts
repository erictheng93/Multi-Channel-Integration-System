// Refuses any mutation that targets the built-in 'system' actor (see constants/system-agent.ts).
// Member management endpoints take the target as a path param (memberId / agentId / userId) or inside the
// JSON body (memberId, agentIds, ids, ...). Reads are covered by excluding the row from every staff list.

import type { MiddlewareHandler } from 'hono';
import { isSystemAgentId } from '@/constants/system-agent';
import { forbiddenResponse } from '@/utils/api-response';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ID_KEY = /id/i;

function mentionsSystemAgent(value: unknown, keyIsId: boolean, depth = 0): boolean {
  if (depth > 6) { return false; }
  if (typeof value === 'string') { return keyIsId && isSystemAgentId(value); }
  if (Array.isArray(value)) { return value.some(item => mentionsSystemAgent(item, keyIsId, depth + 1)); }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .some(([key, item]) => mentionsSystemAgent(item, ID_KEY.test(key), depth + 1));
  }
  return false;
}

function safeDecode(segment: string): string {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

export function blockSystemAgentTarget(): MiddlewareHandler {
  return async (c, next) => {
    if (!MUTATING.has(c.req.method)) { return next(); }

    // Middleware runs before route matching, so path params are not available yet: read the path segments
    const segments = new URL(c.req.url).pathname.split('/').map(safeDecode);
    if (segments.some(isSystemAgentId)) {
      return forbiddenResponse(c, 'The system account cannot be modified');
    }

    const type = c.req.header('content-type') ?? '';
    if (type.includes('application/json')) {
      try {
        const body: unknown = await c.req.raw.clone().json();
        if (mentionsSystemAgent(body, false)) {
          return forbiddenResponse(c, 'The system account cannot be modified');
        }
      } catch {
        // Not JSON: nothing to inspect, the handler validates its own input
      }
    }
    return next();
  };
}
