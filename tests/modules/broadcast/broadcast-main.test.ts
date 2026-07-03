import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', {
      id: 'agent-1',
      role: 'agent',
      teamRoles: { 1: 'lead' },
    });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({})),
}));

vi.mock('@modules/broadcast/services/broadcast-service', () => ({
  BroadcastService: vi.fn(function () {
    return {
      preview: mocks.preview,
    };
  }),
}));

vi.mock('@modules/broadcast/services/broadcast-sender-service', () => ({
  BroadcastSenderService: vi.fn(),
}));

import broadcastRouter from '@/modules/broadcast/handlers/broadcast-main';

describe('broadcast preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preview.mockResolvedValue({
      total: 12,
      byPlatform: { line: 10, facebook: 2 },
      sendable: 10,
      skipped: [{ reason: 'platform_not_supported_phase1', count: 2 }],
    });
  });

  it('accepts tagIds without title or content', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      c.env = { DB: {} } as Bindings;
      await next();
    });
    app.route('/api/broadcasts', broadcastRouter);

    const response = await app.request('/api/broadcasts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: [123] }),
    });

    expect(response.status).toBe(200);
    expect(mocks.preview).toHaveBeenCalledWith(123);
  });

  it('rejects multiple tags during Phase 1', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      c.env = { DB: {} } as Bindings;
      await next();
    });
    app.route('/api/broadcasts', broadcastRouter);

    const response = await app.request('/api/broadcasts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: [123, 456] }),
    });

    expect(response.status).toBe(422);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});
