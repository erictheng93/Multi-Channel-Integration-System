import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DashboardService } from '@modules/analytics/services/dashboard-service';
import { RealtimeDashboardService } from '@modules/analytics/services/realtime-dashboard-service';
import type { DashboardWidget, WidgetData } from '@modules/analytics/types/dashboard-types';

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

function createMetricWidget(overrides: Partial<DashboardWidget> = {}): DashboardWidget {
  return {
    id: 'metric-total-conversations',
    type: 'metric',
    title: 'Total conversations',
    position: { x: 0, y: 0, width: 4, height: 2 },
    config: {},
    dataSource: {
      type: 'analytics',
      config: {},
      query: 'conversation'
    },
    metric: 'totalConversations',
    defaultTimeRange: '7d',
    realTime: true,
    ...overrides
  };
}

function createConversationAnalytics(totalConversations: number) {
  return {
    summary: {
      totalConversations,
      activeConversations: 0,
      closedConversations: 0,
      averageDuration: 0,
      averageMessagesPerConversation: 0,
      averageFirstResponseTime: 0,
      averageResolutionTime: 0,
      customerSatisfactionScore: 0,
      period: {
        start: '2026-06-03T00:00:00.000Z',
        end: '2026-06-10T00:00:00.000Z'
      }
    },
    trends: [],
    distributions: []
  };
}

describe('DashboardService realtime analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T00:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('queries the previous period when calculating metric widget trends', async () => {
    const service = new DashboardService({} as D1Database, mockKV as never, {
      cacheEnabled: false,
      enablePermissionCheck: false
    });
    const getConversationAnalytics = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: createConversationAnalytics(100)
      })
      .mockResolvedValueOnce({
        success: true,
        data: createConversationAnalytics(80)
      });

    (service as unknown as { analytics: unknown }).analytics = { getConversationAnalytics };

    const data = await service.getWidgetData(createMetricWidget(), '7d');

    expect(getConversationAnalytics).toHaveBeenCalledTimes(2);
    expect(getConversationAnalytics.mock.calls[0]?.[0]).toMatchObject({ timeRange: '7d' });
    expect(getConversationAnalytics.mock.calls[1]?.[0]).toMatchObject({
      timeRange: 'custom',
      startDate: '2026-05-27T00:00:00.000Z',
      endDate: '2026-06-02T23:59:59.000Z'
    });
    expect(data.previousValue).toBe(80);
    expect(data.trend).toEqual({
      direction: 'up',
      value: 20,
      percentage: 25,
      period: 'previous'
    });
  });

  test('does not start interval polling for realtime dashboard subscriptions', async () => {
    const service = new DashboardService({} as D1Database, mockKV as never, {
      cacheEnabled: false,
      enablePermissionCheck: false
    });
    const callback = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    vi.spyOn(service, 'getDashboardConfig').mockResolvedValue({
      id: 'dashboard-1',
      name: 'Realtime dashboard',
      layout: { type: 'grid' },
      widgets: [createMetricWidget()],
      permissions: {
        owner: 'user-1',
        viewers: [],
        editors: []
      },
      createdAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:00.000Z'
    });

    const unsubscribe = await service.subscribeToRealTimeUpdates(
      'user-1',
      'dashboard-1',
      callback
    );

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    expect(unsubscribe).toEqual(expect.any(Function));

    unsubscribe();
  });
});

describe('RealtimeDashboardService WebSocket broadcasting', () => {
  test('publishes widget updates through MessageBroadcaster Durable Object', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200
    }));
    const broadcasterStub = { fetch };
    const messageBroadcaster = {
      idFromName: vi.fn(() => 'global-id'),
      get: vi.fn(() => broadcasterStub)
    };
    const service = new RealtimeDashboardService({} as D1Database, mockKV as never, {
      env: {
        MESSAGE_BROADCASTER: messageBroadcaster
      }
    });
    const widgetData: WidgetData = {
      widgetId: 'metric-total-conversations',
      type: 'metric',
      data: {},
      loading: false,
      lastUpdate: '2026-06-10T00:00:00.000Z',
      metadata: {
        queryTime: 1,
        recordCount: 1,
        cacheHit: false,
        dataSource: 'analytics',
        refreshedAt: '2026-06-10T00:00:00.000Z'
      },
      value: 100
    };

    await service.broadcastWidgetUpdate('dashboard-1', 'metric-total-conversations', widgetData);

    expect(messageBroadcaster.idFromName).toHaveBeenCalledWith('global');
    expect(messageBroadcaster.get).toHaveBeenCalledWith('global-id');
    expect(fetch).toHaveBeenCalledTimes(1);

    const request = fetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/broadcast-global');

    const body = await request.json() as {
      event: {
        type: string;
        source: string;
        data: Record<string, unknown>;
      };
      target: {
        type: string;
        targets: string[];
        filters: { eventTypes: string[] };
      };
    };
    expect(body.event.type).toBe('analytics_widget_updated');
    expect(body.event.source).toBe('analytics');
    expect(body.event.data).toMatchObject({
      dashboardId: 'dashboard-1',
      widgetId: 'metric-total-conversations',
      widgetData
    });
    expect(body.target).toEqual({
      type: 'global',
      targets: ['analytics'],
      filters: {
        eventTypes: ['analytics_widget_updated']
      }
    });
  });
});
