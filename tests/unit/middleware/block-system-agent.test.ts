import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { blockSystemAgentTarget } from '@/middleware/block-system-agent';

function app() {
  const a = new Hono();
  a.use('*', blockSystemAgentTarget());
  a.put('/:memberId/status', c => c.json({ ok: true }));
  a.post('/:agentId/join', c => c.json({ ok: true }));
  a.post('/:memberId/reset', c => c.json({ ok: true }));
  a.delete('/:memberId', c => c.json({ ok: true }));
  a.post('/bulk-delete', c => c.json({ ok: true }));
  a.post('/bulk-update', c => c.json({ ok: true }));
  a.post('/batch-edit', c => c.json({ ok: true }));
  a.get('/:memberId', c => c.json({ ok: true }));
  return a;
}
const json = (method: string, path: string, body?: unknown) =>
  app().request(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

describe('blockSystemAgentTarget', () => {
  it.each([
    ['PUT', '/system/status', { isActive: true }],
    ['POST', '/system/join', {}],
    ['POST', '/system/reset', {}],
    ['DELETE', '/system', undefined]
  ])('refuses %s %s with 403 (path target)', async (method, path, body) => {
    expect((await json(method, path, body)).status).toBe(403);
  });

  it.each([
    ['/bulk-delete', { memberIds: ['m1', 'system'] }],
    ['/bulk-update', { memberIds: ['system'], updates: { role: 'admin' } }],
    ['/batch-edit', { edits: [{ memberId: 'system', role: 'admin' }] }],
    ['/bulk-delete', { ids: ['system'] }]
  ])('refuses %s when the body names the system actor', async (path, body) => {
    expect((await json('POST', path, body)).status).toBe(403);
  });

  it('lets other members through, and does not misread a non-id field', async () => {
    expect((await json('PUT', '/m1/status', { isActive: false })).status).toBe(200);
    expect((await json('POST', '/bulk-delete', { memberIds: ['m1', 'm2'] })).status).toBe(200);
    expect((await json('POST', '/bulk-update', { updates: { displayName: 'system' } })).status).toBe(200);
  });

  it('does not interfere with reads', async () => {
    expect((await app().request('/system')).status).toBe(200);
  });
});
