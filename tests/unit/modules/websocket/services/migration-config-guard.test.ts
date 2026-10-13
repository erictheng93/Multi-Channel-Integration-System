// Unit tests for src/modules/websocket/services/migration-config-guard.ts (issue #74)

import { describe, it, expect } from 'vitest';
import { checkMigrationConfigUpdate } from '@modules/websocket/services/migration-config-guard';

describe('checkMigrationConfigUpdate', () => {
  it('rejects turning WebSocket off without confirmation', () => {
    const error = checkMigrationConfigUpdate({ enableWebSocket: false }, false);
    expect(error).toContain('confirmDisable');
  });

  it('allows turning WebSocket off when explicitly confirmed', () => {
    expect(checkMigrationConfigUpdate({ enableWebSocket: false }, true)).toBeNull();
  });

  it('requires confirmation for every explicit false patch, without reading current state', () => {
    expect(checkMigrationConfigUpdate({ enableWebSocket: false }, false)).toContain('confirmDisable');
  });

  it('allows turning it back on and ordinary edits that do not touch the switch', () => {
    expect(checkMigrationConfigUpdate({ enableWebSocket: true }, false)).toBeNull();
    expect(checkMigrationConfigUpdate({ rolloutPercentage: 50 }, false)).toBeNull();
    expect(checkMigrationConfigUpdate({}, false)).toBeNull();
  });

  it.each([null, 0, 1, '', 'false', 'true', [], {}, undefined])(
    'rejects non-boolean enableWebSocket %j even when confirmed', (value) => {
      for (const confirm of [false, true]) {
        expect(
          checkMigrationConfigUpdate({ enableWebSocket: value } as never, confirm)
        ).toBe('enableWebSocket must be a boolean.');
      }
    }
  );

  it.each([null, 'abc', '50', NaN, Infinity, -1, 101, true, {}, []])(
    'rejects invalid rolloutPercentage %j', (value) => {
      expect(
        checkMigrationConfigUpdate({ rolloutPercentage: value } as never, false)
      ).toContain('rolloutPercentage');
    }
  );

  it.each([null, 'canary ', 1, 'Immediate'])('rejects invalid migrationStrategy %j', (value) => {
    expect(
      checkMigrationConfigUpdate({ migrationStrategy: value } as never, false)
    ).toContain('migrationStrategy');
  });

  it.each([null, 'x', [], 1])('rejects non-object featureFlags %j', (value) => {
    expect(checkMigrationConfigUpdate({ featureFlags: value } as never, false)).toContain('featureFlags');
  });

  it('rejects unknown or non-boolean feature flags', () => {
    expect(
      checkMigrationConfigUpdate({ featureFlags: { nope: true } } as never, false)
    ).toContain('Unknown feature flag');
    expect(
      checkMigrationConfigUpdate({ featureFlags: { websocketConnections: 'true' } } as never, false)
    ).toContain('featureFlags.websocketConnections');
  });

  it('rejects unknown top-level keys', () => {
    expect(checkMigrationConfigUpdate({ extra: 1 } as never, false)).toContain('Unknown migration config field(s): extra');
    expect(checkMigrationConfigUpdate({ __proto__x: 1, rolloutPercentage: 5 } as never, false)).toContain('__proto__x');
  });

  it('accepts a valid full patch and boundary percentages', () => {
    expect(
      checkMigrationConfigUpdate(
        {
          enableWebSocket: true,
          migrationStrategy: 'canary',
          rolloutPercentage: 0,
          featureFlags: {
            websocketConnections: true,
            durableObjectMessaging: false,
            distributedLocking: true,
            batchMessageProcessing: false,
            realTimeTypingIndicators: true
          }
        },
        false
      )
    ).toBeNull();
    expect(checkMigrationConfigUpdate({ rolloutPercentage: 100 }, false)).toBeNull();
    expect(checkMigrationConfigUpdate({ featureFlags: {} }, false)).toBeNull();
  });
});
