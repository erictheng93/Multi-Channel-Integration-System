// The built-in 'system' agent row exists only because activities.user_id is NOT NULL and references
// agents.id: it is the actor of system-initiated activity (e.g. the nightly auto-close, shown as 系統).
// It is not a person. It must never authenticate, be edited or managed as a member, or appear in any
// staff list, count or picker. Use these helpers instead of repeating the literal.

import { ne, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const SYSTEM_AGENT_ID = 'system';

export function isSystemAgentId(id: unknown): boolean {
  return id === SYSTEM_AGENT_ID;
}

/** Raw-SQL predicate that excludes the system actor, for a column reference such as `a.id` or `agents.id`. */
export function notSystemAgentSql(column: string): string {
  return `${column} <> '${SYSTEM_AGENT_ID}'`;
}

/** Drizzle predicate that excludes the system actor. */
export function notSystemAgent(column: AnySQLiteColumn): SQL {
  return ne(column, SYSTEM_AGENT_ID);
}

