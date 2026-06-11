import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createAgentRouter } from '@modules/agents/handlers/agent-main';
import type { Bindings } from '@/types';

describe('Agent router scope', () => {
  it('does not apply agent authentication middleware to unrelated /api routes', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/api', createAgentRouter());
    app.get('/api/notifications/recent', c => c.json({ success: true }));

    const response = await app.request('/api/notifications/recent');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
