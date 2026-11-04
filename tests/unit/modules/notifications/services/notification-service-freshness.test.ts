import { describe, expect, it, vi } from 'vitest';

// Stateful fake repository: one user with 3 unread notifications.
const state = vi.hoisted(() => ({ unread: 3 }));

vi.mock('@modules/notifications/repositories/notification-repository', () => ({
  NotificationRepository: vi.fn().mockImplementation(function () {
    return {
      getUnreadCount: async () => state.unread,
      markAllAsRead: async () => { const n = state.unread; state.unread = 0; return n; },
      findByQuery: async () => ({
        notifications: Array.from({ length: state.unread }, (_, i) => ({ id: String(i), isRead: false })),
        total: state.unread
      })
    };
  })
}));

import { NotificationService } from '@modules/notifications/services/notification-service';
import type { NotificationChannelService } from '@modules/notifications/services/notification-channel-service';

describe('NotificationService read freshness', () => {
  it('reflects mark-all-read on the very next read (no stale cache)', async () => {
    const service = new NotificationService({} as D1Database, {} as NotificationChannelService);

    expect(await service.getUnreadCount('42')).toBe(3);
    expect((await service.getByQuery({ userId: '42', isRead: false })).notifications).toHaveLength(3);

    expect(await service.markAllAsRead('42')).toBe(3);

    expect(await service.getUnreadCount('42')).toBe(0);
    expect((await service.getByQuery({ userId: '42', isRead: false })).notifications).toHaveLength(0);
  });
});
