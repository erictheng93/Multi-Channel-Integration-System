// tests/unit/modules/notifications/services/notification-channel-service.test.ts
// Unit tests for NotificationChannelService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationChannelService } from '@modules/notifications/services/notification-channel-service';
import type { NotificationBase, ChannelType, DeliveryResult, NotificationSettings } from '@modules/notifications/types';

// ---------------------------------------------------------------------------
// Mock all three channel adapters
// ---------------------------------------------------------------------------

const mockWsSend = vi.fn();
const mockEmailSend = vi.fn();
const mockPushSend = vi.fn();
const mockWsSendBulk = vi.fn();
const mockEmailSendBulk = vi.fn();

const mockWsAdapter = {
  type: 'websocket' as ChannelType,
  isEnabled: vi.fn(() => true),
  validateConfig: vi.fn(() => true),
  send: mockWsSend,
  sendBulk: mockWsSendBulk,
};

const mockEmailAdapter = {
  type: 'email' as ChannelType,
  isEnabled: vi.fn(() => true),
  validateConfig: vi.fn(() => true),
  send: mockEmailSend,
  sendBulk: mockEmailSendBulk,
};

const mockPushAdapter = {
  type: 'push' as ChannelType,
  isEnabled: vi.fn(() => true),
  validateConfig: vi.fn(() => true),
  send: mockPushSend,
};

vi.mock('@modules/notifications/adapters/websocket-adapter', () => ({
  WebSocketAdapter: vi.fn(function () {
    return mockWsAdapter;
  }),
}));

vi.mock('@modules/notifications/adapters/email-adapter', () => ({
  EmailAdapter: vi.fn(function () {
    return mockEmailAdapter;
  }),
}));

vi.mock('@modules/notifications/adapters/push-adapter', () => ({
  PushAdapter: vi.fn(function () {
    return mockPushAdapter;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides?: Partial<NotificationBase>): NotificationBase {
  return {
    id: 'notif-1',
    userId: 42,
    type: 'new_message',
    title: 'Test Notification',
    content: 'Hello',
    priority: 'normal',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const successResult: DeliveryResult = { success: true, messageId: 'msg-1' };
const failureResult: DeliveryResult = { success: false, errorMessage: 'Delivery failed' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationChannelService', () => {
  let service: NotificationChannelService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all adapters enabled and send succeeds
    mockWsAdapter.isEnabled.mockReturnValue(true);
    mockEmailAdapter.isEnabled.mockReturnValue(true);
    mockPushAdapter.isEnabled.mockReturnValue(true);
    mockWsSend.mockResolvedValue(successResult);
    mockEmailSend.mockResolvedValue(successResult);
    mockPushSend.mockResolvedValue(successResult);
    mockWsSendBulk.mockImplementation((messages: any[]) =>
      Promise.resolve(messages.map(() => successResult))
    );
    mockEmailSendBulk.mockImplementation((messages: any[]) =>
      Promise.resolve(messages.map(() => successResult))
    );

    service = new NotificationChannelService();
  });

  // -------------------------------------------------------------------------
  // send() — channel routing
  // -------------------------------------------------------------------------

  describe('send()', () => {
    it('routes to explicitly specified channels', async () => {
      const notification = makeNotification();

      const response = await service.send(notification, ['websocket']);

      expect(mockWsSend).toHaveBeenCalledOnce();
      expect(mockEmailSend).not.toHaveBeenCalled();
      expect(response.summary.totalChannels).toBe(1);
      expect(response.summary.successfulChannels).toBe(1);
    });

    it('routes to multiple channels when specified', async () => {
      const notification = makeNotification();

      const response = await service.send(notification, ['websocket', 'email']);

      expect(mockWsSend).toHaveBeenCalledOnce();
      expect(mockEmailSend).toHaveBeenCalledOnce();
      expect(response.summary.successfulChannels).toBe(2);
      expect(response.summary.failedChannels).toBe(0);
    });

    it('records failure when adapter is disabled', async () => {
      mockWsAdapter.isEnabled.mockReturnValue(false);
      const notification = makeNotification();

      const response = await service.send(notification, ['websocket']);

      expect(mockWsSend).not.toHaveBeenCalled();
      expect(response.results['websocket'].success).toBe(false);
      expect(response.summary.failedChannels).toBe(1);
    });

    it('catches adapter send() errors without crashing', async () => {
      mockEmailSend.mockRejectedValue(new Error('SMTP timeout'));
      const notification = makeNotification();

      const response = await service.send(notification, ['email']);

      expect(response.results['email'].success).toBe(false);
      expect(response.results['email'].errorMessage).toBe('SMTP timeout');
      expect(response.summary.failedChannels).toBe(1);
    });

    it('activates fallback (websocket) when all primary channels fail', async () => {
      mockEmailSend.mockResolvedValue(failureResult);
      mockPushSend.mockResolvedValue(failureResult);
      // websocket (fallback) will succeed
      mockWsSend.mockResolvedValue(successResult);

      const notification = makeNotification();
      const response = await service.send(notification, ['email', 'push']);

      // Fallback should kick in because all primary channels failed
      expect(mockWsSend).toHaveBeenCalledOnce();
      expect(response.results['websocket']).toBeDefined();
      expect(response.results['websocket'].success).toBe(true);
    });

    it('does NOT activate fallback when at least one channel succeeds', async () => {
      mockEmailSend.mockResolvedValue(successResult);
      mockPushSend.mockResolvedValue(failureResult);

      const notification = makeNotification();
      await service.send(notification, ['email', 'push']);

      // websocket is the fallback; should not be called
      expect(mockWsSend).not.toHaveBeenCalled();
    });

    it('uses default channels when no channels are specified', async () => {
      // Default channel is websocket
      const notification = makeNotification();
      await service.send(notification);

      expect(mockWsSend).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // sendBulk()
  // -------------------------------------------------------------------------

  describe('sendBulk()', () => {
    it('groups notifications by channel and sends in bulk', async () => {
      const notifications = [
        makeNotification({ id: 'n1', userId: 1 }),
        makeNotification({ id: 'n2', userId: 2 }),
      ];

      const result = await service.sendBulk(notifications);

      expect(result.summary.totalNotifications).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('returns summary with successful and failed notification counts', async () => {
      const notifications = [
        makeNotification({ id: 'n1', userId: 1 }),
        makeNotification({ id: 'n2', userId: 2 }),
      ];
      mockWsSendBulk.mockResolvedValue([successResult, failureResult]);

      const result = await service.sendBulk(notifications);

      expect(result.summary.totalNotifications).toBe(2);
      // Channel attempts tracked
      expect(result.summary.totalChannelAttempts).toBeGreaterThanOrEqual(2);
    });

    it('falls back to individual send() when sendBulk is not available on adapter', async () => {
      // Remove sendBulk from ws adapter
      const adapterWithoutBulk = { ...mockWsAdapter, sendBulk: undefined };
      // Re-mock so the service gets adapter without sendBulk
      const { WebSocketAdapter } = await import('@modules/notifications/adapters/websocket-adapter');
      (WebSocketAdapter as any).mockImplementation(function () {
        return adapterWithoutBulk;
      });

      const serviceNoBulk = new NotificationChannelService();
      const notifications = [
        makeNotification({ id: 'n1', userId: 1 }),
        makeNotification({ id: 'n2', userId: 2 }),
      ];

      const result = await serviceNoBulk.sendBulk(notifications);

      expect(result.summary.totalNotifications).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // determineChannels (tested indirectly via send without explicit channels)
  // -------------------------------------------------------------------------

  describe('determineChannels() via routing rules', () => {
    it('uses routing rule channels when notification matches rule conditions', async () => {
      service.addRoutingRule({
        id: 'rule-1',
        name: 'Urgent rule',
        enabled: true,
        conditions: [{ field: 'priority', operator: 'equals', value: 'urgent' }],
        channels: ['email'],
        priority: 1,
      });

      const notification = makeNotification({ priority: 'urgent' });
      await service.send(notification); // no channels override

      expect(mockEmailSend).toHaveBeenCalledOnce();
      // websocket (default) should NOT be called since rule matched
      expect(mockWsSend).not.toHaveBeenCalled();
    });

    it('falls back to default channels when no rules match', async () => {
      service.addRoutingRule({
        id: 'rule-2',
        name: 'System rule',
        enabled: true,
        conditions: [{ field: 'type', operator: 'equals', value: 'system' }],
        channels: ['email'],
        priority: 1,
      });

      const notification = makeNotification({ type: 'new_message' });
      await service.send(notification);

      // Rule didn't match (type=new_message, rule expects system)
      expect(mockWsSend).toHaveBeenCalledOnce();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getUserChannelSettings / setUserSettings
  // -------------------------------------------------------------------------

  describe('getUserChannelSettings()', () => {
    it('returns undefined when no settings are stored for a user', () => {
      const settings = service.getUserSettings(999);
      expect(settings).toBeUndefined();
    });

    it('returns stored settings for a user', () => {
      const settings: NotificationSettings = {
        userId: 42,
        emailEnabled: true,
        pushEnabled: false,
        sseEnabled: false,
        websocketEnabled: true,
        soundEnabled: true,
        mentionEnabled: true,
        assignmentEnabled: true,
        messageEnabled: true,
        systemEnabled: true,
        channelPreferences: {} as any,
      };

      service.setUserSettings(42, settings);
      expect(service.getUserSettings(42)).toEqual(settings);
    });

    it('uses user channel preferences to route notifications', async () => {
      const settings: NotificationSettings = {
        userId: 42,
        emailEnabled: false,
        pushEnabled: false,
        sseEnabled: false,
        websocketEnabled: false,
        soundEnabled: false,
        mentionEnabled: true,
        assignmentEnabled: true,
        messageEnabled: true,
        systemEnabled: true,
        channelPreferences: {
          new_message: ['push'],
        } as any,
      };

      service.setUserSettings(42, settings);
      const notification = makeNotification({ userId: 42, type: 'new_message' });
      await service.send(notification);

      expect(mockPushSend).toHaveBeenCalledOnce();
      expect(mockWsSend).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Channel enable/disable
  // -------------------------------------------------------------------------

  describe('channel management', () => {
    it('getAdapter() returns the adapter for the given channel', () => {
      const adapter = service.getAdapter('websocket');
      expect(adapter).toBeDefined();
      expect(adapter?.type).toBe('websocket');
    });

    it('getChannelStats() returns stats for all channels', () => {
      const stats = service.getChannelStats();
      expect(stats).toHaveProperty('websocket');
      expect(stats).toHaveProperty('email');
      expect(stats).toHaveProperty('push');
      expect(stats['websocket'].enabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Routing rule management
  // -------------------------------------------------------------------------

  describe('routing rule management', () => {
    it('addRoutingRule() adds and sorts rules by priority', () => {
      service.addRoutingRule({
        id: 'r2', name: 'Low priority rule', enabled: true,
        conditions: [], channels: ['email'], priority: 10,
      });
      service.addRoutingRule({
        id: 'r1', name: 'High priority rule', enabled: true,
        conditions: [], channels: ['push'], priority: 1,
      });

      const config = service.getRouterConfig();
      expect(config.rules[0].id).toBe('r1');
      expect(config.rules[1].id).toBe('r2');
    });

    it('removeRoutingRule() removes the rule by id', () => {
      service.addRoutingRule({
        id: 'r-remove', name: 'Test', enabled: true,
        conditions: [], channels: ['push'], priority: 5,
      });
      service.removeRoutingRule('r-remove');

      const config = service.getRouterConfig();
      expect(config.rules.find(r => r.id === 'r-remove')).toBeUndefined();
    });
  });
});
