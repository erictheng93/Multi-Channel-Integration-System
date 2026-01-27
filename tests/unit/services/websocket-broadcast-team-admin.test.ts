/**
 * Unit Tests for Team Broadcasting with Admin Inclusion
 *
 * Tests the `includeAdmins` parameter for team broadcasts and
 * the `broadcastConversationTransferred()` method that uses it.
 *
 * Related fix: Admin users should receive conversation_transferred events in real-time
 * via WebSocket push, not polling fallback.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebSocketBroadcastService } from '@backend/services/websocket-broadcast-service';
import type { Bindings } from '@backend/types';

// Helper to create valid transfer event parameters
function createTransferEventParams(overrides: Partial<{
  conversationId: string;
  fromTeamId: number | null;
  toTeamId: number;
  fromTeamName?: string;
  toTeamName?: string;
  customerId?: string;
  customerName?: string;
}> = {}) {
  return {
    conversationId: overrides.conversationId ?? 'conv-001',
    fromTeamId: overrides.fromTeamId ?? null,
    toTeamId: overrides.toTeamId ?? 1,
    fromTeamName: overrides.fromTeamName,
    toTeamName: overrides.toTeamName ?? 'Test Team',
    conversation: {
      id: overrides.conversationId ?? 'conv-001',
      customerId: 123,
      customerName: overrides.customerName ?? 'Test Customer',
      platform: 'line',
      status: 'active',
      lastMessage: {
        content: 'Hello',
        timestamp: Date.now()
      },
      unreadCount: 0,
      assignedTeamId: overrides.toTeamId ?? 1,
      assignedTeam: {
        id: overrides.toTeamId ?? 1,
        name: overrides.toTeamName ?? 'Test Team'
      }
    },
    transferredBy: {
      id: 'system',
      name: 'System Auto-Assignment'
    },
    reason: 'Auto-assigned via QR code'
  };
}

describe('WebSocket Broadcast Service - Team Broadcasting with Admin Inclusion', () => {
  let service: WebSocketBroadcastService;
  let mockEnv: Partial<Bindings>;
  let mockBroadcasterFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a mock fetch function to track calls
    mockBroadcasterFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ successful: 5, failed: 0 })
    });

    // Mock environment bindings
    mockEnv = {
      CONVERSATION_ROOM: {
        idFromName: vi.fn().mockReturnValue('mock-room-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({ ok: true })
        })
      } as any,
      USER_CONNECTION: {
        idFromName: vi.fn().mockReturnValue('mock-user-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({ ok: true })
        })
      } as any,
      MESSAGE_BROADCASTER: {
        idFromName: vi.fn().mockReturnValue('mock-broadcaster-id'),
        get: vi.fn().mockReturnValue({
          fetch: mockBroadcasterFetch
        })
      } as any,
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      } as any
    };

    // Create service instance with batching disabled for predictable testing
    service = new WebSocketBroadcastService(mockEnv as Bindings, {
      enabled: false // Disable batching to test immediate broadcasts
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('broadcastConversationTransferred()', () => {
    it('should broadcast conversation_transferred event to new team with includeAdmins=true', async () => {
      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-001',
          fromTeamId: null,
          toTeamId: 18,
          toTeamName: '米奇'
        })
      );

      expect(result.newTeamNotified).toBe(true);

      // Verify the broadcaster was called
      expect(mockBroadcasterFetch).toHaveBeenCalled();

      // Get the request that was made - find the team broadcast call
      const teamBroadcastCall = mockBroadcasterFetch.mock.calls.find(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      expect(teamBroadcastCall).toBeDefined();

      const fetchCall = teamBroadcastCall![0] as Request;
      const requestBody = JSON.parse(await fetchCall.text());

      // Verify the correct endpoint was used (with admins)
      expect(fetchCall.url).toBe('https://message-broadcaster/broadcast-to-teams-and-admins');

      // Verify includeAdmins flag is passed
      expect(requestBody.includeAdmins).toBe(true);

      // Verify team ID is correct
      expect(requestBody.teamIds).toContain(18);

      // Verify event type
      expect(requestBody.event.type).toBe('conversation_transferred');
      expect(requestBody.event.data.action).toBe('assigned');
    });

    it('should broadcast to both old and new teams when transferring between teams', async () => {
      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-002',
          fromTeamId: 10,
          fromTeamName: 'Old Team',
          toTeamId: 20,
          toTeamName: 'New Team'
        })
      );

      expect(result.oldTeamNotified).toBe(true);
      expect(result.newTeamNotified).toBe(true);

      // Filter team broadcast calls (excluding conversation room broadcasts)
      const teamBroadcastCalls = mockBroadcasterFetch.mock.calls.filter(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      // Should have two team broadcasts: one to old team (remove) and one to new team (assign)
      expect(teamBroadcastCalls.length).toBe(2);

      // Check both calls use the admin-inclusive endpoint
      for (const call of teamBroadcastCalls) {
        const request = call[0] as Request;
        expect(request.url).toBe('https://message-broadcaster/broadcast-to-teams-and-admins');

        const body = JSON.parse(await request.clone().text());
        expect(body.includeAdmins).toBe(true);
      }
    });

    it('should include correct event data for assigned action', async () => {
      await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-003',
          fromTeamId: null,
          toTeamId: 15,
          toTeamName: 'Support Team',
          customerName: '陳威霖Calvin'
        })
      );

      const teamBroadcastCall = mockBroadcasterFetch.mock.calls.find(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      const fetchCall = teamBroadcastCall![0] as Request;
      const requestBody = JSON.parse(await fetchCall.text());

      // Verify event structure
      expect(requestBody.event).toMatchObject({
        type: 'conversation_transferred',
        conversationId: 'conv-003',
        data: expect.objectContaining({
          action: 'assigned',
          toTeamId: 15,
          toTeamName: 'Support Team'
        })
      });
    });

    it('should include correct event data for removed action', async () => {
      await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-004',
          fromTeamId: 5,
          fromTeamName: 'Previous Team',
          toTeamId: 10,
          toTeamName: 'New Team'
        })
      );

      // Find the "removed" event (to old team)
      const teamBroadcastCalls = mockBroadcasterFetch.mock.calls.filter(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      // Look for the removed action
      let foundRemoveEvent = false;
      for (const call of teamBroadcastCalls) {
        const request = call[0] as Request;
        const body = JSON.parse(await request.clone().text());
        if (body.event.data.action === 'removed') {
          foundRemoveEvent = true;
          expect(body.event.data.fromTeamId).toBe(5);
          expect(body.teamIds).toContain(5);
        }
      }
      expect(foundRemoveEvent).toBe(true);
    });
  });

  describe('broadcastToTeamMembers() endpoint selection', () => {
    it('should use /broadcast-to-teams-and-admins endpoint when includeAdmins is true', async () => {
      // broadcastConversationTransferred internally uses includeAdmins: true
      await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-test',
          fromTeamId: null,
          toTeamId: 1,
          toTeamName: 'Test Team'
        })
      );

      const teamBroadcastCall = mockBroadcasterFetch.mock.calls.find(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      expect(teamBroadcastCall).toBeDefined();
      const fetchCall = teamBroadcastCall![0] as Request;

      // Should use admin-inclusive endpoint
      expect(fetchCall.url).toBe('https://message-broadcaster/broadcast-to-teams-and-admins');
    });
  });

  describe('Error handling', () => {
    it('should handle broadcaster fetch failure gracefully', async () => {
      mockBroadcasterFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-error',
          fromTeamId: null,
          toTeamId: 1,
          toTeamName: 'Test'
        })
      );

      // Should not throw, but return failure status
      expect(result.newTeamNotified).toBe(false);
    });

    it('should handle missing MESSAGE_BROADCASTER binding', async () => {
      const serviceWithoutBroadcaster = new WebSocketBroadcastService({
        ...mockEnv,
        MESSAGE_BROADCASTER: undefined
      } as Bindings, { enabled: false });

      const result = await serviceWithoutBroadcaster.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-no-broadcaster',
          fromTeamId: null,
          toTeamId: 1,
          toTeamName: 'Test'
        })
      );

      expect(result.newTeamNotified).toBe(false);
    });

    it('should handle partial failure when broadcasting to multiple teams', async () => {
      // First call succeeds (conversation room), then old team fails, new team succeeds
      mockBroadcasterFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ successful: 1, failed: 0 })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ successful: 3, failed: 0 })
        });

      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-partial',
          fromTeamId: 1,
          fromTeamName: 'Old',
          toTeamId: 2,
          toTeamName: 'New'
        })
      );

      // Should report partial results
      expect(result).toBeDefined();
      expect(typeof result.oldTeamNotified).toBe('boolean');
      expect(typeof result.newTeamNotified).toBe('boolean');
    });
  });

  describe('Edge cases', () => {
    it('should handle conversation transfer with same team (no-op for fromTeam)', async () => {
      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-same-team',
          fromTeamId: 5,
          fromTeamName: 'Same Team',
          toTeamId: 5,
          toTeamName: 'Same Team'
        })
      );

      // Should still broadcast (implementation may dedupe or handle)
      expect(result).toBeDefined();
    });

    it('should handle empty team name gracefully', async () => {
      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'conv-empty-name',
          fromTeamId: null,
          toTeamId: 1,
          toTeamName: undefined
        })
      );

      expect(result.newTeamNotified).toBe(true);

      const teamBroadcastCall = mockBroadcasterFetch.mock.calls.find(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      expect(teamBroadcastCall).toBeDefined();
      const fetchCall = teamBroadcastCall![0] as Request;
      const requestBody = JSON.parse(await fetchCall.text());

      // Should still broadcast with team ID
      expect(requestBody.event.data.toTeamId).toBe(1);
    });

    it('should generate unique event IDs for each broadcast', async () => {
      // Mock crypto.randomUUID to return unique values
      let uuidCounter = 0;
      const originalRandomUUID = crypto.randomUUID;
      vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `unique-id-${++uuidCounter}`);

      try {
        await service.broadcastConversationTransferred(
          createTransferEventParams({
            conversationId: 'conv-unique-1',
            fromTeamId: null,
            toTeamId: 1,
            toTeamName: 'Team 1'
          })
        );

        // Reset mock to distinguish between calls
        const firstCalls = [...mockBroadcasterFetch.mock.calls];

        await service.broadcastConversationTransferred(
          createTransferEventParams({
            conversationId: 'conv-unique-2',
            fromTeamId: null,
            toTeamId: 2,
            toTeamName: 'Team 2'
          })
        );

        const secondCalls = mockBroadcasterFetch.mock.calls.slice(firstCalls.length);

        // Get team broadcast calls from each batch
        const firstTeamCall = firstCalls.find(call => {
          const request = call[0] as Request;
          return request.url.includes('broadcast-to-teams');
        });

        const secondTeamCall = secondCalls.find(call => {
          const request = call[0] as Request;
          return request.url.includes('broadcast-to-teams');
        });

        if (firstTeamCall && secondTeamCall) {
          const body1 = JSON.parse(await (firstTeamCall[0] as Request).clone().text());
          const body2 = JSON.parse(await (secondTeamCall[0] as Request).clone().text());

          // Event IDs should be unique
          expect(body1.event.id).not.toBe(body2.event.id);
        }
      } finally {
        vi.mocked(crypto.randomUUID).mockRestore();
      }
    });
  });

  describe('Integration with Admin real-time updates', () => {
    it('should ensure Admin users receive new LINE user assignment events', async () => {
      // This test validates the fix for the issue where Admin users
      // were not receiving real-time WebSocket push for new LINE users

      const result = await service.broadcastConversationTransferred(
        createTransferEventParams({
          conversationId: 'line-new-user-conv',
          fromTeamId: null,
          toTeamId: 18,
          toTeamName: '米奇',
          customerName: '陳威霖Calvin'
        })
      );

      expect(result.newTeamNotified).toBe(true);

      // Find the team broadcast call
      const teamBroadcastCall = mockBroadcasterFetch.mock.calls.find(call => {
        const request = call[0] as Request;
        return request.url.includes('broadcast-to-teams');
      });

      expect(teamBroadcastCall).toBeDefined();
      const fetchCall = teamBroadcastCall![0] as Request;

      // Critical assertion: Must use admin-inclusive endpoint
      expect(fetchCall.url).toBe('https://message-broadcaster/broadcast-to-teams-and-admins');

      // Verify the event payload matches what frontend expects
      const requestBody = JSON.parse(await fetchCall.text());
      expect(requestBody.event).toMatchObject({
        type: 'conversation_transferred',
        conversationId: 'line-new-user-conv',
        data: expect.objectContaining({
          action: 'assigned',
          toTeamId: 18,
          toTeamName: '米奇'
        })
      });

      // Verify includeAdmins flag is present
      expect(requestBody.includeAdmins).toBe(true);
    });
  });
});
