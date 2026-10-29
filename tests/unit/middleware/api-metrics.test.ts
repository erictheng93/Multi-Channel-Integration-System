import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { apiMetricsMiddleware } from '@/middleware/api-metrics';

function makeApp(dataset?: { writeDataPoint: ReturnType<typeof vi.fn> }) {
  const app = new Hono<{ Bindings: { API_METRICS?: unknown } }>();
  app.use('*', apiMetricsMiddleware as never);
  app.get('/api/conversations/:id', (c) => c.json({ ok: true }));
  app.get('/api/boom', () => {
    throw new Error('x');
  });
  app.get('/health', (c) => c.text('ok'));
  app.get('/ws', (c) => c.text('ok'));
  app.options('/api/conversations/:id', (c) => c.text('ok'));
  return { app, env: { API_METRICS: dataset } };
}

describe('apiMetricsMiddleware', () => {
  it('writes the matched route pattern, not the raw path', async () => {
    const ds = { writeDataPoint: vi.fn() };
    const { app, env } = makeApp(ds);
    const res = await app.request('/api/conversations/123', {}, env);
    expect(res.status).toBe(200);
    expect(ds.writeDataPoint).toHaveBeenCalledTimes(1);
    const dp = ds.writeDataPoint.mock.calls[0][0];
    expect(dp.blobs).toEqual(['GET', '/api/conversations/:id', '2xx', '200']);
    expect(dp.indexes).toEqual(['/api/conversations/:id']);
    expect(dp.doubles).toHaveLength(1);
    expect(dp.doubles[0]).toBeGreaterThanOrEqual(0);
  });

  it('records 5xx for failing handlers', async () => {
    const ds = { writeDataPoint: vi.fn() };
    const { app, env } = makeApp(ds);
    const res = await app.request('/api/boom', {}, env);
    expect(res.status).toBe(500);
    expect(ds.writeDataPoint.mock.calls[0][0].blobs.slice(2)).toEqual(['5xx', '500']);
  });

  it('collapses unmatched paths to one bucket', async () => {
    const ds = { writeDataPoint: vi.fn() };
    const { app, env } = makeApp(ds);
    await app.request('/random/attack/1', {}, env);
    expect(ds.writeDataPoint.mock.calls[0][0].blobs[1]).toBe('unmatched');
  });

  it('skips health, websocket upgrades and OPTIONS', async () => {
    const ds = { writeDataPoint: vi.fn() };
    const { app, env } = makeApp(ds);
    await app.request('/health', {}, env);
    await app.request('/ws', { headers: { Upgrade: 'websocket' } }, env);
    await app.request('/api/conversations/1', { method: 'OPTIONS' }, env);
    expect(ds.writeDataPoint).not.toHaveBeenCalled();
  });

  it('is a no-op without the binding', async () => {
    const { app, env } = makeApp(undefined);
    const res = await app.request('/api/conversations/1', {}, env);
    expect(res.status).toBe(200);
  });

  it('never throws into the request when writeDataPoint fails', async () => {
    const ds = {
      writeDataPoint: vi.fn(() => {
        throw new Error('quota');
      }),
    };
    const { app, env } = makeApp(ds);
    const res = await app.request('/api/conversations/1', {}, env);
    expect(res.status).toBe(200);
  });
});
