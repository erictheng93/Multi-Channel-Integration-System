import type { MigrationConfig } from '@/types/websocket-types';

/**
 * Guard for POST /api/websocket/migration-config.
 *
 * Setting `enableWebSocket` to false is a production kill switch: new WebSocket
 * connections are refused with 503 (GET /api/websocket/connect) and event
 * broadcasting is switched off for everyone. A previous admin screen could send
 * that value by accident (see #74), so turning it off must be an explicit act.
 *
 * Returns an error message when the update must be rejected, otherwise null.
 */
export function checkMigrationConfigUpdate(
  current: Pick<MigrationConfig, 'enableWebSocket'>,
  patch: Partial<MigrationConfig>,
  confirmDisable: boolean
): string | null {
  const turnsOff = patch.enableWebSocket === false && current.enableWebSocket !== false;

  if (turnsOff && !confirmDisable) {
    return (
      'Disabling WebSocket stops real-time delivery for every user. ' +
      'Resend the request with "confirmDisable": true to proceed.'
    );
  }

  return null;
}
