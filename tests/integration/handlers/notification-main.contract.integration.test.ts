import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockCreateBulk: vi.fn(),
  mockGetById: vi.fn(),
  mockGetByQuery: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
  mockDelete: vi.fn(),
  mockGetStats: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockGetRecentNotifications: vi.fn(),
  mockCleanupExpired: vi.fn(),
  mockNotifyNewMessage: vi.fn(),
  mockNotifyConversationAssigned: vi.fn(),
  mockGetChannelStats: vi.fn(),
  mockTestChannel: vi.fn(),
  mockTriggerSystemNotification: vi.fn(),
  mockKvGet: vi.fn(),
  mockKvPut: vi.fn()
}));

const {
  mockCreate,
  mockCreateBulk,
  mockGetById,
  mockGetByQuery,
  mockMarkAsRead,
  mockMarkAllAsRead,
  mockDelete,
  mockGetStats,
  mockGetUnreadCount,
  mockGetRecentNotifications,
  mockCleanupExpired,
  mockNotifyNewMessage,
  mockNotifyConversationAssigned,
  mockGetChannelStats,
  mockTestChannel,
  mockTriggerSystemNotification,
  mockKvGet,
  mockKvPut
} = mocks;

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('jwtPayload', { userId: '42', role: 'admin' });
    c.set('user', { id: '42', role: 'admin' });
    await next();
  })
}));

vi.mock('@modules/notifications/services/notification-service', () => ({
  NotificationService: vi.fn().mockImplementation(function () {
    return {
    create: mocks.mockCreate,
    createBulk: mocks.mockCreateBulk,
    getById: mocks.mockGetById,
    getByQuery: mocks.mockGetByQuery,
    markAsRead: mocks.mockMarkAsRead,
    markAllAsRead: mocks.mockMarkAllAsRead,
    delete: mocks.mockDelete,
    getStats: mocks.mockGetStats,
    getUnreadCount: mocks.mockGetUnreadCount,
    getRecentNotifications: mocks.mockGetRecentNotifications,
    cleanupExpired: mocks.mockCleanupExpired,
    notifyNewMessage: mocks.mockNotifyNewMessage,
    notifyConversationAssigned: mocks.mockNotifyConversationAssigned
    };
  })
}));

vi.mock('@modules/notifications/services/notification-channel-service', () => ({
  NotificationChannelService: vi.fn().mockImplementation(function () {
    return {
    getChannelStats: mocks.mockGetChannelStats,
    testChannel: mocks.mockTestChannel
    };
  })
}));

vi.mock('@modules/notifications/utils/notification-validator', () => ({
  NotificationValidationError: class NotificationValidationError extends Error {
    errors: Array<{ field: string; message: string }>;

    constructor(errors: Array<{ field: string; message: string }>) {
      super('Validation failed');
      this.errors = errors;
    }
  },
  NotificationValidator: vi.fn().mockImplementation(function () {
    return {
      validateQuery: vi.fn(),
      sanitizeQuery: vi.fn(query => query),
      validateCreateRequest: vi.fn(),
      sanitizeCreateRequest: vi.fn(request => request),
      validateBulkCreateRequest: vi.fn()
    };
  })
}));

vi.mock('@/utils/notification-trigger', () => ({
  triggerSystemNotification: mocks.mockTriggerSystemNotification
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: '42' }, { id: '99' }])
      }))
    }))
  }))
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000)
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

import notificationRouter from '@/modules/notifications/handlers/notification-router';
import type { Bindings } from '@/types';

function createTestApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = {
      DB: {},
      CACHE: {
        get: mockKvGet,
        put: mockKvPut
      }
    } as unknown as Bindings;
    await next();
  });
  app.route('/api/notifications', notificationRouter);
  return app;
}

const notification = {
  id: 'notification-1',
  userId: 42,
  type: 'system',
  title: 'System notice',
  content: 'Maintenance window',
  priority: 'normal',
  isRead: false,
  createdAt: '2026-01-15T12:00:00Z'
};

const stats = {
  total: 1,
  unread: 1,
  byType: {
    new_message: { total: 0, unread: 0 },
    conversation_assigned: { total: 0, unread: 0 },
    conversation_transferred: { total: 0, unread: 0 },
    mention: { total: 0, unread: 0 },
    system: { total: 1, unread: 1 },
    customer_responded: { total: 0, unread: 0 },
    task_reminder: { total: 0, unread: 0 },
    agent_removed_from_team: { total: 0, unread: 0 },
    customer_followed: { total: 0, unread: 0 },
    new_conversation: { total: 0, unread: 0 }
  },
  byPriority: {
    low: { total: 0, unread: 0 },
    normal: { total: 1, unread: 1 },
    high: { total: 0, unread: 0 },
    urgent: { total: 0, unread: 0 }
  },
  timeRange: {
    today: 1,
    thisWeek: 1,
    thisMonth: 1
  }
};

describe('notification-main shared contract routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKvGet.mockResolvedValue(null);
  });

  test('lists notifications at the notificationContracts.list path', async () => {
    mockGetByQuery.mockResolvedValueOnce({
      notifications: [notification],
      pagination: {
        page: 2,
        pageSize: 5,
        total: 1,
        totalPages: 1
      }
    });

    const res = await createTestApp().request(
      '/api/notifications?page=2&pageSize=5&type=system&isRead=false'
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe('notification-1');
    expect(mockGetByQuery).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42',
      page: 2,
      pageSize: 5,
      type: 'system',
      isRead: false
    }));
  });

  test('creates and reads notifications through contract routes', async () => {
    mockCreate.mockResolvedValueOnce('notification-2');
    mockGetById.mockResolvedValueOnce(notification);

    const createRes = await createTestApp().request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({
        type: 'system',
        title: 'Created',
        content: 'Created notification'
      }),
      headers: { 'content-type': 'application/json' }
    });
    const createBody = (await createRes.json()) as any;

    expect(createRes.status).toBe(201);
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBe('notification-2');

    const getRes = await createTestApp().request('/api/notifications/notification-1');
    const getBody = (await getRes.json()) as any;

    expect(getRes.status).toBe(200);
    expect(getBody.success).toBe(true);
    expect(getBody.data.id).toBe('notification-1');
    expect(mockGetById).toHaveBeenCalledWith('notification-1', '42');
  });

  test('returns notification stats and unread counts through contract routes', async () => {
    mockGetStats.mockResolvedValueOnce(stats);
    mockGetUnreadCount.mockResolvedValueOnce(3);

    const statsRes = await createTestApp().request('/api/notifications/stats');
    const statsBody = (await statsRes.json()) as any;
    expect(statsRes.status).toBe(200);
    expect(statsBody.data.total).toBe(1);

    const unreadRes = await createTestApp().request('/api/notifications/unread-count?type=system');
    const unreadBody = (await unreadRes.json()) as any;
    expect(unreadRes.status).toBe(200);
    expect(unreadBody.data).toEqual({ count: 3, type: 'system' });
  });

  test('marks, bulk marks, deletes, and cleans up notifications through contract routes', async () => {
    mockMarkAsRead.mockResolvedValueOnce(true);
    mockMarkAllAsRead.mockResolvedValueOnce(4);
    mockDelete.mockResolvedValueOnce(true);
    mockCleanupExpired.mockResolvedValueOnce(2);

    const readRes = await createTestApp().request('/api/notifications/notification-1/read', {
      method: 'PUT'
    });
    expect(readRes.status).toBe(200);

    const markAllRes = await createTestApp().request('/api/notifications/mark-all-read', {
      method: 'PUT',
      body: JSON.stringify({ type: 'system' }),
      headers: { 'content-type': 'application/json' }
    });
    const markAllBody = (await markAllRes.json()) as any;
    expect(markAllBody.data.updated).toBe(4);

    const deleteRes = await createTestApp().request('/api/notifications/notification-1', {
      method: 'DELETE'
    });
    expect(deleteRes.status).toBe(200);

    const cleanupRes = await createTestApp().request('/api/notifications/cleanup', {
      method: 'DELETE'
    });
    const cleanupBody = (await cleanupRes.json()) as any;
    expect(cleanupBody.data.deleted).toBe(2);
  });

  test('supports bulk, recent, channel, and convenience notification contract routes', async () => {
    mockCreateBulk.mockResolvedValueOnce({ successful: ['n1'], failed: [] });
    mockGetRecentNotifications.mockResolvedValueOnce([notification]);
    mockGetChannelStats.mockReturnValueOnce({ websocket: { enabled: true, type: 'websocket' } });
    mockTestChannel.mockResolvedValueOnce({ success: true, messageId: 'message-1' });
    mockNotifyNewMessage.mockResolvedValueOnce('new-message-1');
    mockNotifyConversationAssigned.mockResolvedValueOnce('assigned-1');
    mockTriggerSystemNotification.mockResolvedValueOnce(['sys-1', 'sys-2']);

    const bulkRes = await createTestApp().request('/api/notifications/bulk', {
      method: 'POST',
      body: JSON.stringify({
        notifications: [{
          userId: 42,
          type: 'system',
          title: 'Bulk',
          content: 'Bulk notification'
        }]
      }),
      headers: { 'content-type': 'application/json' }
    });
    expect((await bulkRes.json() as any).data.successful).toBe(1);

    const recentRes = await createTestApp().request('/api/notifications/recent?limit=3');
    expect((await recentRes.json() as any).data.count).toBe(1);

    const channelStatsRes = await createTestApp().request('/api/notifications/channels/stats');
    expect((await channelStatsRes.json() as any).data.websocket.enabled).toBe(true);

    const testChannelRes = await createTestApp().request('/api/notifications/channels/websocket/test', {
      method: 'POST',
      body: JSON.stringify({ message: 'Ping' }),
      headers: { 'content-type': 'application/json' }
    });
    expect((await testChannelRes.json() as any).data.messageId).toBe('message-1');

    const newMessageRes = await createTestApp().request('/api/notifications/new-message', {
      method: 'POST',
      body: JSON.stringify({
        userId: 42,
        conversationId: 7,
        senderName: 'Agent',
        content: 'Hello'
      }),
      headers: { 'content-type': 'application/json' }
    });
    expect((await newMessageRes.json() as any).data.id).toBe('new-message-1');

    const assignedRes = await createTestApp().request('/api/notifications/conversation-assigned', {
      method: 'POST',
      body: JSON.stringify({
        userId: 42,
        conversationId: 7,
        customerName: 'Customer',
        assignedBy: 'Admin'
      }),
      headers: { 'content-type': 'application/json' }
    });
    expect((await assignedRes.json() as any).data.id).toBe('assigned-1');

    const systemRes = await createTestApp().request('/api/notifications/system', {
      method: 'POST',
      body: JSON.stringify({
        userIds: [42, 99],
        title: 'System',
        content: 'Broadcast'
      }),
      headers: { 'content-type': 'application/json' }
    });
    const systemBody = (await systemRes.json()) as any;
    expect(systemBody.data).toEqual(expect.objectContaining({
      ids: ['sys-1', 'sys-2'],
      count: 2,
      broadcastedToAll: false
    }));
  });

  test('gets and updates notification settings at contract paths', async () => {
    mockKvGet.mockResolvedValueOnce(JSON.stringify({
      userId: 42,
      emailEnabled: true,
      pushEnabled: true,
      soundEnabled: false,
      mentionEnabled: true,
      assignmentEnabled: true,
      messageEnabled: true,
      systemEnabled: true
    }));

    const getRes = await createTestApp().request('/api/notifications/settings');
    const getBody = (await getRes.json()) as any;

    expect(getRes.status).toBe(200);
    expect(getBody.success).toBe(true);
    expect(getBody.data.userId).toBe(42);
    expect(getBody.data.soundEnabled).toBe(false);

    const updateRes = await createTestApp().request('/api/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify({ soundEnabled: true, emailEnabled: false }),
      headers: { 'content-type': 'application/json' }
    });
    const updateBody = (await updateRes.json()) as any;

    expect(updateRes.status).toBe(200);
    expect(updateBody.success).toBe(true);
    expect(mockKvPut).toHaveBeenCalledWith(
      'notification_settings:42',
      expect.stringContaining('"soundEnabled":true')
    );
  });
});
