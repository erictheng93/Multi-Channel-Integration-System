import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';

const { log } = vi.hoisted(() => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('@/utils/logger', () => ({ createContextLogger: () => log }));
vi.mock('@/middleware/websocket-auth', () => ({
  websocketAuth: async (c: Context, next: Next) => {
    c.set('user', { id: 'admin-1', role: 'admin' });
    await next();
  }
}));
vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: (c: Context) => c.json({ success: false }, 500)
  }
}));

import websocketHandler from '@modules/websocket/handlers/websocket-main';

describe('POST /migration-config', () => {
  let stored: Record<string, unknown>;
  const sessions = { get: vi.fn(), put: vi.fn() };
  const env = { SESSIONS: sessions } as unknown as Bindings;
  const disableMessage = 'WebSocket disabled via migration config';

  beforeEach(() => {
    stored = { enableWebSocket: true, rolloutPercentage: 100 };
    sessions.get.mockReset().mockImplementation(async () => JSON.stringify(stored));
    sessions.put.mockReset().mockImplementation(async (_key: string, value: string) => {
      stored = JSON.parse(value);
    });
  });

  function update(body: unknown) {
    return websocketHandler.request('/migration-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, env);
  }

  function expectNoDisableLog() {
    expect(log.warn.mock.calls.some(([message]) => message === disableMessage)).toBe(false);
  }

  it.each([null, 0, 1, '', 'false', 'true', [], {}])(
    'rejects a non-boolean enableWebSocket value: %j', async (value) => {
      // Confirmation cannot make an invalid switch value acceptable.
      for (const confirmDisable of [false, true]) {
        const response = await update({ enableWebSocket: value, confirmDisable });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'enableWebSocket must be a boolean.' });
      }
      expect(sessions.get).not.toHaveBeenCalled();
      expect(sessions.put).not.toHaveBeenCalled();
      expect(stored.enableWebSocket).toBe(true);
      expectNoDisableLog();
    }
  );

  it.each([null, [], false, 0])('rejects a non-object request body: %j', async (body) => {
    expect((await update(body)).status).toBe(400);
    expect(sessions.put).not.toHaveBeenCalled();
    expectNoDisableLog();
  });

  it('rejects an unconfirmed disable while stored config is already disabled', async () => {
    stored.enableWebSocket = false;
    // A concurrent enable between reads must not let an unconfirmed false patch overwrite it.
    sessions.get.mockResolvedValueOnce(JSON.stringify(stored))
      .mockResolvedValue(JSON.stringify({ ...stored, enableWebSocket: true }));
    expect((await update({ enableWebSocket: false })).status).toBe(400);
    expect(sessions.get).not.toHaveBeenCalled();
    expect(sessions.put).not.toHaveBeenCalled();
    expectNoDisableLog();
  });

  it.each([1, 'true'])('requires literal boolean confirmation: %j', async (confirmation) => {
    expect((await update({ enableWebSocket: false, confirmDisable: confirmation })).status).toBe(400);
    expect(sessions.put).not.toHaveBeenCalled();
    expectNoDisableLog();
  });

  it('logs a confirmed disable only after persistence and never persists confirmation', async () => {
    sessions.put.mockImplementationOnce(async (_key: string, value: string) => {
      await Promise.resolve();
      expectNoDisableLog();
      stored = JSON.parse(value);
    });
    expect((await update({ enableWebSocket: false, confirmDisable: true })).status).toBe(200);
    expect(stored.enableWebSocket).toBe(false);
    expect(stored).not.toHaveProperty('confirmDisable');
    expect(log.warn).toHaveBeenCalledExactlyOnceWith(disableMessage, { updatedBy: 'admin-1' });
  });

  it('does not log a disable when rollout validation fails', async () => {
    const response = await update({ enableWebSocket: false, confirmDisable: true, rolloutPercentage: 101 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('rolloutPercentage') });
    expect(sessions.put).not.toHaveBeenCalled();
    expect(stored.enableWebSocket).toBe(true);
    expectNoDisableLog();
  });

  it('does not log a disable when the KV write fails', async () => {
    sessions.put.mockRejectedValueOnce(new Error('KV unavailable'));
    expect((await update({ enableWebSocket: false, confirmDisable: true })).status).toBe(500);
    expect(stored.enableWebSocket).toBe(true);
    expectNoDisableLog();
  });

  it.each([
    [{ rolloutPercentage: null }],
    [{ rolloutPercentage: 'abc' }],
    [{ rolloutPercentage: '50' }],
    [{ migrationStrategy: 'sideways' }],
    [{ featureFlags: { websocketConnections: 'yes' } }],
    [{ featureFlags: { surprise: true } }],
    [{ unexpectedKey: 1 }]
  ])('rejects an invalid patch without persisting: %j', async (patch) => {
    expect((await update(patch)).status).toBe(400);
    expect(sessions.put).not.toHaveBeenCalled();
    expectNoDisableLog();
  });

  it('persists only known keys and merges a partial featureFlags patch', async () => {
    stored.featureFlags = { websocketConnections: true, distributedLocking: true };
    const response = await update({ featureFlags: { distributedLocking: false }, confirmDisable: true });
    expect(response.status).toBe(200);
    expect(stored.featureFlags).toEqual({ websocketConnections: true, distributedLocking: false });
    expect(stored).not.toHaveProperty('confirmDisable');
  });

  it('logs "Migration config updated" exactly once per successful update', async () => {
    log.info.mockClear();
    expect((await update({ rolloutPercentage: 10 })).status).toBe(200);
    expect(log.info.mock.calls.filter(([m]) => m === 'Migration config updated')).toHaveLength(1);
  });

  it('allows enabling and updates that omit the switch without confirmation', async () => {
    stored.enableWebSocket = false;
    expect((await update({ enableWebSocket: true })).status).toBe(200);
    expect(stored.enableWebSocket).toBe(true);
    expect((await update({ rolloutPercentage: 50 })).status).toBe(200);
    expect(stored).toMatchObject({ enableWebSocket: true, rolloutPercentage: 50 });
    expectNoDisableLog();
  });
});
