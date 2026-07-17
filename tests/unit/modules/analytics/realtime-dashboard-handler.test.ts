import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRealtimeDashboardHandler } from '@modules/analytics/handlers/realtime-dashboard-main';
import type { RealtimeDashboardService } from '@modules/analytics/services/realtime-dashboard-service';
import type { DashboardService } from '@modules/analytics/services/dashboard-service';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  getUserById: vi.fn(),
  checkPermission: vi.fn()
}));

vi.mock('@/utils/auth', () => ({
  verifyJWT: mocks.verifyJWT,
  getUserById: mocks.getUserById
}));

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: mocks.checkPermission
  }
}));

const realtimeService = {
  getConnectionStatus: () => ({
    totalConnections: 0,
    connectionsByDashboard: {},
    connectionsByUser: {}
  }),
  cleanupExpiredConnections: () => undefined
} as unknown as RealtimeDashboardService;

const dashboardService = {} as unknown as DashboardService;
const testEnv = {
  JWT_SECRET: 'test-secret',
  DB: {} as D1Database,
  // Revocation-list read; null = token not revoked
  CACHE: { get: async () => null } as unknown as KVNamespace
} as Bindings;

const requestDashboardApi = (
  path: string,
  init?: RequestInit
) => createRealtimeDashboardHandler(realtimeService, dashboardService).request(path, init, testEnv);

describe('Realtime dashboard subscription API', () => {
  beforeEach(() => {
    mocks.verifyJWT.mockReset();
    mocks.checkPermission.mockReset();
    mocks.verifyJWT.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Admin One',
      role: 'admin',
      primaryTeamId: 1,
      // validateAccessTokenPayload allowlists type === 'access' and requires
      // a jti for the revocation list — mock the payload /login mints.
      type: 'access',
      jti: 'test-jti-dashboard-1'
    });
    mocks.getUserById.mockReset();
    mocks.getUserById.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Admin One',
      role: 'admin',
      primaryTeamId: 1,
      isActive: true,
      allowedTeamIds: [1],
      teamRoles: { 1: 'member' }
    });
    mocks.checkPermission.mockResolvedValue(true);
  });

  const authHeaders = {
    Authorization: 'Bearer analytics-token'
  };

  test('rejects unauthenticated subscription requests', async () => {
    const response = await requestDashboardApi('/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboardId: 'dashboard-1' })
    });

    expect(response.status).toBe(401);
  });

  test('rejects unauthenticated cleanup requests', async () => {
    const response = await requestDashboardApi('/cleanup', { method: 'POST' });

    expect(response.status).toBe(401);
  });

  test('returns WebSocket channels for a dashboard subscription', async () => {
    const response = await requestDashboardApi('/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        dashboardId: 'dashboard-1',
        widgetIds: ['metric-total-conversations']
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json() as {
      success: boolean;
      data: {
        subscriptionId: string;
        transport: string;
        channels: string[];
        eventTypes: string[];
      };
    };

    expect(body).toEqual({
      success: true,
      data: {
        subscriptionId: 'analytics:dashboard:dashboard-1',
        transport: 'websocket',
        channels: [
          'analytics',
          'analytics:dashboard:dashboard-1',
          'analytics:widget:metric-total-conversations'
        ],
        eventTypes: [
          'analytics_widget_updated',
          'analytics_dashboard_updated'
        ]
      }
    });
  });

  test('acknowledges dashboard subscription release', async () => {
    const response = await requestDashboardApi('/subscription/analytics%3Adashboard%3Adashboard-1', {
      method: 'DELETE',
      headers: authHeaders
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        subscriptionId: 'analytics:dashboard:dashboard-1',
        released: true
      }
    });
  });
});
