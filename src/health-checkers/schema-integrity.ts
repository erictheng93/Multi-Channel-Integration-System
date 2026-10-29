// Migration-only database objects that the code relies on but that src/db/schema.ts cannot express.
// The 2026-06-17 production rebuild was done from schema.ts and silently dropped every object like
// these. Missing triggers do not fail any query: the dashboard just shows stale 待回覆 / unread data,
// so we check for them explicitly (nightly cron + the admin health page).
import { HealthLevel, type HealthChecker, type HealthCheckResult, type HealthCheckConfig } from '../types/health-check';
import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '../types/bindings';
import { nowISO, nowMs } from '@/utils/timestamp';

/** Triggers created by migrations 0070 (awaiting_since) and 0071 (message markers). Keep in sync. */
export const REQUIRED_TRIGGERS = [
  'trg_messages_awaiting_customer',
  'trg_messages_awaiting_reply_insert',
  'trg_messages_awaiting_reply_sent',
  'trg_messages_awaiting_recalled',
  'trg_messages_awaiting_deleted',
  'trg_messages_marker_customer_insert',
  'trg_messages_marker_agent_insert',
  'trg_messages_marker_customer_deleted',
  'trg_messages_marker_agent_deleted',
] as const;

/** KV key raised by the nightly check; the admin health page reads the live state instead. */
export const SCHEMA_TRIGGER_ALERT_KEY = 'alert:schema_trigger_missing';
const ALERT_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Names of required triggers that do not exist in the database (one small sqlite_master read). */
export async function findMissingTriggers(db: D1Database): Promise<string[]> {
  const placeholders = REQUIRED_TRIGGERS.map(() => '?').join(', ');
  const { results } = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN (${placeholders})`)
    .bind(...REQUIRED_TRIGGERS)
    .all<{ name: string }>();
  const present = new Set((results ?? []).map(row => row.name));
  return REQUIRED_TRIGGERS.filter(name => !present.has(name));
}

/**
 * Nightly check. Raises (or refreshes) the KV alert while triggers are missing and clears it once they are
 * back. Returns the missing names so the caller can log them. Never throws.
 */
export async function checkSchemaTriggers(db: D1Database, cache: Bindings['CACHE'] | undefined): Promise<string[]> {
  const missing = await findMissingTriggers(db);
  if (!cache) return missing;
  try {
    if (missing.length > 0) {
      await cache.put(SCHEMA_TRIGGER_ALERT_KEY, JSON.stringify({ missing, checkedAt: nowISO() }), {
        expirationTtl: ALERT_TTL_SECONDS,
      });
    } else if (await cache.get(SCHEMA_TRIGGER_ALERT_KEY)) {
      await cache.delete(SCHEMA_TRIGGER_ALERT_KEY);
    }
  } catch {
    // The log line written by the caller is the alert of record; KV is a convenience for the health page.
  }
  return missing;
}

export class SchemaIntegrityHealthChecker implements HealthChecker {
  name = 'schema_integrity';
  level = HealthLevel.INFRASTRUCTURE;
  description = 'Migration-only database triggers (awaiting_since, unread markers) exist';

  constructor(private db: D1Database) {}

  async check(): Promise<HealthCheckResult> {
    const startTime = nowMs();
    try {
      const missing = await findMissingTriggers(this.db);
      const responseTime = nowMs() - startTime;
      if (missing.length > 0) {
        return {
          status: 'critical',
          message: `Missing ${missing.length} database trigger(s); re-run the CREATE TRIGGER statements from migrations 0070/0071`,
          timestamp: nowISO(),
          responseTime,
          details: { missing, required: REQUIRED_TRIGGERS.length },
        };
      }
      return {
        status: 'healthy',
        message: `All ${REQUIRED_TRIGGERS.length} required database triggers present`,
        timestamp: nowISO(),
        responseTime,
        details: { required: REQUIRED_TRIGGERS.length },
      };
    } catch {
      return {
        status: 'critical',
        message: 'Could not read the database schema',
        timestamp: nowISO(),
        responseTime: nowMs() - startTime,
      };
    }
  }

  getConfig(): HealthCheckConfig {
    return {
      enabled: true,
      interval: 300,
      timeout: 5000,
      retries: 1,
      alertThresholds: { warning: 1000, critical: 3000 },
      notifications: {},
    };
  }
}
