import type { MigrationConfig } from '@/types/websocket-types';

/**
 * Guard for POST /api/websocket/migration-config.
 *
 * Setting `enableWebSocket` to false is a production kill switch: new WebSocket
 * connections are refused with 503 (GET /api/websocket/connect) and event
 * broadcasting is switched off for everyone. A previous admin screen could send
 * that value by accident (see #74), so turning it off must be an explicit act.
 *
 * This is also the single place that validates the runtime type of every
 * MigrationConfig field, because the request body is untrusted JSON.
 *
 * Returns an error message when the update must be rejected, otherwise null.
 */
export const MIGRATION_STRATEGIES = ['gradual', 'immediate', 'canary'] as const;

export const FEATURE_FLAG_KEYS = [
  'websocketConnections',
  'durableObjectMessaging',
  'distributedLocking',
  'batchMessageProcessing',
  'realTimeTypingIndicators'
] as const;

const CONFIG_KEYS = ['enableWebSocket', 'migrationStrategy', 'rolloutPercentage', 'featureFlags'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates the shape and runtime types of a (partial) config patch. */
function validateShape(patch: Record<string, unknown>): string | null {
  const unknownKeys = Object.keys(patch).filter(
    (key) => !(CONFIG_KEYS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    return `Unknown migration config field(s): ${unknownKeys.join(', ')}.`;
  }

  if ('enableWebSocket' in patch && typeof patch.enableWebSocket !== 'boolean') {
    return 'enableWebSocket must be a boolean.';
  }

  if (
    'migrationStrategy' in patch &&
    !(MIGRATION_STRATEGIES as readonly unknown[]).includes(patch.migrationStrategy)
  ) {
    return `migrationStrategy must be one of: ${MIGRATION_STRATEGIES.join(', ')}.`;
  }

  if ('rolloutPercentage' in patch) {
    const pct = patch.rolloutPercentage;
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      return 'rolloutPercentage must be a finite number between 0 and 100.';
    }
  }

  if ('featureFlags' in patch) {
    const flags = patch.featureFlags;
    if (!isPlainObject(flags)) {
      return 'featureFlags must be an object of booleans.';
    }
    const unknownFlags = Object.keys(flags).filter(
      (key) => !(FEATURE_FLAG_KEYS as readonly string[]).includes(key)
    );
    if (unknownFlags.length > 0) {
      return `Unknown feature flag(s): ${unknownFlags.join(', ')}.`;
    }
    const badFlag = Object.keys(flags).find((key) => typeof flags[key] !== 'boolean');
    if (badFlag) {
      return `featureFlags.${badFlag} must be a boolean.`;
    }
  }

  return null;
}

export function checkMigrationConfigUpdate(
  patch: Partial<MigrationConfig>,
  confirmDisable: boolean
): string | null {
  const shapeError = validateShape(patch as Record<string, unknown>);
  if (shapeError) {
    return shapeError;
  }

  // Every explicit disable needs confirmation, regardless of concurrent config updates.
  if (patch.enableWebSocket === false && !confirmDisable) {
    return (
      'Disabling WebSocket stops real-time delivery for every user. ' +
      'Resend the request with "confirmDisable": true to proceed.'
    );
  }

  return null;
}
