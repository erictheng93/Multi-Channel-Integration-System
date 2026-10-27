// jwtAuth must authorize from the freshly loaded user row, not from the signed
// role/team claims (security audit run-2, finding #8).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockVerifyJWT, mockGetUserById } = vi.hoisted(() => ({
  mockVerifyJWT: vi.fn(),
  mockGetUserById: vi.fn()
}));

vi.mock('@/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/auth')>();
  return {
    ...actual,
    verifyJWT: mockVerifyJWT,
    getUserById: mockGetUserById,
    updateUserActivityDebounced: vi.fn().mockResolvedValue(false)
  };
});
vi.mock('@/utils/auth-jwt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/auth-jwt')>();
  return { ...actual, isIssuedBeforeTokenEpoch: vi.fn().mockResolvedValue(false) };
});
vi.mock('@modules/system/handlers/kv-optimization-monitoring', () => ({
  incrementRequestCounter: vi.fn(),
  trackTheoreticalKVSavings: vi.fn()
}));

import { jwtAuth, requireAdmin } from '@/middleware/auth';
import { ActivityHandler } from '@modules/activities/handlers/ActivityHandler';
import { ActivityService } from '@modules/activities/services/ActivityService';

const env = {
  JWT_SECRET: 'test-secret',
  CACHE: { get: vi.fn().mockResolvedValue(null) },
  SESSIONS: {},
  DB: {}
};

const signed = {
  userId: 'u1',
  displayName: 'Signed Name',
  role: 'admin',
  primaryTeamId: 1,
  allowedTeamIds: [1, 2],
  teamRoles: { 1: 'lead', 2: 'lead' },
  iat: 1, exp: 9999999999, type: 'access', jti: 'jti-1'
};

const dbUser = (over: Record<string, unknown>) => ({
  id: 'u1', email: 'u1@x.test', displayName: 'Fresh', role: 'agent',
  primaryTeamId: 3, allowedTeamIds: [3], teamRoles: { 3: 'member' },
  isActive: true, createdAt: '', updatedAt: '', ...over
});

function makeApp() {
  const cleanupSpy = vi.spyOn(ActivityService.prototype, 'cleanupOldActivities').mockResolvedValue(5);
  const handler = new ActivityHandler({} as D1Database);
  const app = new Hono<{ Bindings: typeof env }>();
  app.post('/cleanup', jwtAuth as never, (c) => handler.cleanup(c as never) as never);
  app.get('/admin-only', jwtAuth as never, requireAdmin() as never, (c) => c.json({
    payload: c.get('jwtPayload')
  }));
  return { app, cleanupSpy };
}

const call = (app: Hono<{ Bindings: typeof env }>, path: string, method = 'GET') =>
  app.request(path, {
    method,
    headers: { Cookie: 'mcis_access=tok; mcis_csrf=c', 'X-CSRF-Token': 'c' }
  }, env);

describe('jwtAuth refreshes authorization claims from the database', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockVerifyJWT.mockReset().mockResolvedValue({ ...signed });
    mockGetUserById.mockReset();
  });

  it('refuses admin-only handlers when a signed admin has been demoted to agent', async () => {
    mockGetUserById.mockResolvedValue(dbUser({ role: 'agent' }));
    const { app, cleanupSpy } = makeApp();

    expect((await call(app, '/cleanup', 'POST')).status).toBe(403);
    expect(cleanupSpy).not.toHaveBeenCalled();
    expect((await call(app, '/admin-only')).status).toBe(403);
  });

  it('still allows a user who is genuinely an admin', async () => {
    mockGetUserById.mockResolvedValue(dbUser({ role: 'admin' }));
    const { app, cleanupSpy } = makeApp();
    expect((await call(app, '/cleanup', 'POST')).status).toBe(200);
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('overwrites role and team claims but keeps signed identity fields', async () => {
    mockGetUserById.mockResolvedValue(dbUser({ role: 'admin' }));
    const { app } = makeApp();
    const res = await call(app, '/admin-only');
    expect(res.status).toBe(200);
    const body = await res.json() as { payload: Record<string, unknown> };
    expect(body.payload).toMatchObject({
      userId: 'u1', jti: 'jti-1', type: 'access', exp: 9999999999,
      role: 'admin', primaryTeamId: 3, allowedTeamIds: [3], teamRoles: { 3: 'member' }
    });
  });

  it('a normal agent authenticates (not 401) and is refused only on admin routes', async () => {
    mockVerifyJWT.mockResolvedValue({ ...signed, role: 'agent', allowedTeamIds: [1, 2] });
    mockGetUserById.mockResolvedValue(dbUser({ role: 'agent', allowedTeamIds: [3] }));
    const { app } = makeApp();
    expect((await call(app, '/admin-only')).status).toBe(403);
    expect((await call(app, '/cleanup', 'POST')).status).toBe(403);
  });
});
