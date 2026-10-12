// Unit tests for src/modules/websocket/services/migration-config-guard.ts (issue #74)

import { describe, it, expect } from 'vitest';
import { checkMigrationConfigUpdate } from '@modules/websocket/services/migration-config-guard';

describe('checkMigrationConfigUpdate', () => {
  const enabled = { enableWebSocket: true };
  const disabled = { enableWebSocket: false };

  it('rejects turning WebSocket off without confirmation', () => {
    const error = checkMigrationConfigUpdate(enabled, { enableWebSocket: false }, false);
    expect(error).toContain('confirmDisable');
  });

  it('allows turning WebSocket off when explicitly confirmed', () => {
    expect(checkMigrationConfigUpdate(enabled, { enableWebSocket: false }, true)).toBeNull();
  });

  it('does not ask again when it is already off', () => {
    expect(checkMigrationConfigUpdate(disabled, { enableWebSocket: false }, false)).toBeNull();
  });

  it('allows turning it back on and ordinary edits that do not touch the switch', () => {
    expect(checkMigrationConfigUpdate(disabled, { enableWebSocket: true }, false)).toBeNull();
    expect(checkMigrationConfigUpdate(enabled, { rolloutPercentage: 50 }, false)).toBeNull();
    expect(checkMigrationConfigUpdate(enabled, {}, false)).toBeNull();
  });
});
