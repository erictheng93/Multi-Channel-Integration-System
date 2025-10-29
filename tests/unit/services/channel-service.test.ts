// Channel Service Unit Tests
// Tests for business logic layer of channel integrations

import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { ChannelService } from '@modules/integrations/services/channel-service';
import type { Bindings } from '@/types';
import type {
  ChannelPlatform,
  ChannelConfigRequest,
  ChannelVerificationRequest,
  ChannelUpdateRequest
} from '@modules/integrations/types/channel-types';

// Mock Drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDb)
}));

// Mock database queries
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

// Mock fetch for LINE API verification
global.fetch = vi.fn();

describe('ChannelService', () => {
  let channelService: ChannelService;
  let mockBindings: Bindings;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock bindings
    mockBindings = {
      DB: {} as D1Database,
      SESSIONS: {} as KVNamespace,
      CACHE: {} as KVNamespace,
      R2_BUCKET: {} as R2Bucket,
      JWT_SECRET: 'test-secret-key',
      ENVIRONMENT: 'test'
    } as unknown as Bindings;

    channelService = new ChannelService(mockBindings);

    // Setup default mock chains
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([])
        })
      })
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createChannel', () => {
    it('should successfully create a LINE channel', async () => {
      const request: ChannelConfigRequest = {
        teamId: 1,
        platform: 'line',
        lineConfig: {
          channelId: '1234567890',
          channelAccessToken: 'test-access-token',
          channelSecret: 'test-secret'
        }
      };

      // Mock no existing channel
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      // Mock successful insert and select
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        lineChannelId: '1234567890',
        lineWebhookUrl: expect.stringContaining('/webhook/line'),
        lineWebhookToken: expect.any(String),
        isActive: true,
        isVerified: false
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChannel])
            })
          })
        })
      });

      const result = await channelService.createChannel(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.webhookUrl).toBeDefined();
      expect(result.webhookUrl).toContain('/webhooks/line');
    });

    it('should reject duplicate active channel for same platform', async () => {
      const request: ChannelConfigRequest = {
        teamId: 1,
        platform: 'line',
        lineConfig: {
          channelId: '1234567890',
          channelAccessToken: 'test-access-token',
          channelSecret: 'test-secret'
        }
      };

      // Mock existing active channel
      const existingChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        isActive: true
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingChannel])
          })
        })
      });

      const result = await channelService.createChannel(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already has an active');
    });

    it('should handle missing platform configuration', async () => {
      const request: ChannelConfigRequest = {
        teamId: 1,
        platform: 'line'
        // Missing lineConfig
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      // Mock the second select call for fetching created channel
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        webhookUrl: '/api/webhooks/line/1/test-token',
        isActive: true
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChannel])
            })
          })
        })
      });

      const result = await channelService.createChannel(request);

      // Should still create but without platform-specific config
      expect(result.success).toBe(true);
    });

    it('should generate unique webhook tokens', async () => {
      const request: ChannelConfigRequest = {
        teamId: 1,
        platform: 'line',
        lineConfig: {
          channelId: '1234567890',
          channelAccessToken: 'test-access-token',
          channelSecret: 'test-secret'
        }
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 1,
                lineWebhookToken: 'unique-token-123'
              }])
            })
          })
        })
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      const result = await channelService.createChannel(request);

      expect(result.webhookUrl).toMatch(/\/webhooks\/line\/.+/);
    });
  });

  describe('getChannelsByTeam', () => {
    it('should return all channels for a team', async () => {
      const mockChannels = [
        { id: 1, teamId: 1, platform: 'line', isActive: true },
        { id: 2, teamId: 1, platform: 'facebook', isActive: true }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockChannels)
          })
        })
      });

      const result = await channelService.getChannelsByTeam(1);

      expect(result).toHaveLength(2);
      expect(result[0].platform).toBe('line');
      expect(result[1].platform).toBe('facebook');
    });

    it('should filter channels by platform', async () => {
      const mockChannels = [
        { id: 1, teamId: 1, platform: 'line', isActive: true }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockChannels)
          })
        })
      });

      const result = await channelService.getChannelsByTeam(1, 'line');

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('line');
    });

    it('should return empty array for team with no channels', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await channelService.getChannelsByTeam(999);

      expect(result).toEqual([]);
    });
  });

  describe('getChannel', () => {
    it('should return a channel by ID', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        lineChannelId: '1234567890',
        isActive: true
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.getChannel(1);

      expect(result).toEqual(mockChannel);
      expect(result?.platform).toBe('line');
    });

    it('should return null for non-existent channel', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await channelService.getChannel(999);

      expect(result).toBeNull();
    });
  });

  describe('updateChannel', () => {
    it('should successfully update a channel', async () => {
      const updateRequest: ChannelUpdateRequest = {
        channelId: 1,
        lineConfig: {
          channelAccessToken: 'new-token',
          channelSecret: 'new-secret'
        }
      };

      const existingChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        lineChannelId: '1234567890',
        isActive: true
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingChannel])
          })
        })
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      const updatedChannel = { ...existingChannel, lineChannelAccessToken: 'new-token' };
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingChannel])
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([updatedChannel])
          })
        })
      });

      const result = await channelService.updateChannel(updateRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject update for non-existent channel', async () => {
      const updateRequest: ChannelUpdateRequest = {
        channelId: 999,
        lineConfig: {
          channelAccessToken: 'new-token'
        }
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await channelService.updateChannel(updateRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('deactivateChannel', () => {
    it('should successfully deactivate a channel', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      const result = await channelService.deactivateChannel(1);

      expect(result).toBe(true);
    });

    it('should handle deactivation errors', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      const result = await channelService.deactivateChannel(1);

      expect(result).toBe(false);
    });
  });

  describe('verifyChannel', () => {
    it('should successfully verify a LINE channel', async () => {
      const request: ChannelVerificationRequest = {
        channelId: 1
      };

      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        lineChannelAccessToken: 'test-token',
        isActive: true
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      // Mock LINE API response
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 'U1234567890' })
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      const result = await channelService.verifyChannel(request);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('should handle verification for non-existent channel', async () => {
      const request: ChannelVerificationRequest = {
        channelId: 999
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await channelService.verifyChannel(request);

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle LINE API verification failure', async () => {
      const request: ChannelVerificationRequest = {
        channelId: 1
      };

      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        lineChannelAccessToken: 'invalid-token',
        isActive: true
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      // Mock LINE API error response
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid channel access token' })
      });

      const result = await channelService.verifyChannel(request);

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
    });
  });

  describe('getChannelStatistics', () => {
    it('should return channel statistics', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        totalMessagesSent: 150,
        totalMessagesReceived: 200,
        lastMessageAt: '2025-10-27T12:00:00Z',
        isActive: true,
        isVerified: true,
        errorCount: 5,
        createdAt: '2025-01-01T00:00:00Z'
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.getChannelStatistics(1);

      expect(result.channelId).toBe(1);
      expect(result.platform).toBe('line');
      expect(result.totalMessagesSent).toBe(150);
      expect(result.totalMessagesReceived).toBe(200);
      expect(result.lastMessageAt).toBe('2025-10-27T12:00:00Z');
      expect(result.isActive).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.errorCount).toBe(5);
      expect(result.uptime).toBeDefined();
      expect(result.uptime.days).toBeGreaterThanOrEqual(0);
    });

    it('should handle channel with no messages', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        totalMessagesSent: 0,
        totalMessagesReceived: 0,
        lastMessageAt: null,
        isActive: true,
        isVerified: false,
        errorCount: 0,
        createdAt: new Date().toISOString()
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.getChannelStatistics(1);

      expect(result.totalMessagesSent).toBe(0);
      expect(result.totalMessagesReceived).toBe(0);
      expect(result.lastMessageAt).toBeNull();
    });
  });

  describe('incrementMessageCounter', () => {
    it('should increment sent message counter', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        totalMessagesSent: 10,
        totalMessagesReceived: 5
      };

      // Mock getChannel call
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      // Mock update call
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      });
      const mockUpdate = vi.fn().mockReturnValue({
        set: mockSet
      });
      mockDb.update = mockUpdate;

      await channelService.incrementMessageCounter(1, 'sent');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        totalMessagesSent: 11,
        lastMessageAt: expect.any(String),
        updatedAt: expect.any(String)
      }));
    });

    it('should increment received message counter', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        totalMessagesSent: 10,
        totalMessagesReceived: 5
      };

      // Mock getChannel call
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      // Mock update call
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      });
      const mockUpdate = vi.fn().mockReturnValue({
        set: mockSet
      });
      mockDb.update = mockUpdate;

      await channelService.incrementMessageCounter(1, 'received');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        totalMessagesReceived: 6,
        lastMessageAt: expect.any(String),
        updatedAt: expect.any(String)
      }));
    });
  });

  describe('generateWebhookUrl', () => {
    it('should generate webhook URL with correct format', async () => {
      const options = {
        platform: 'line' as ChannelPlatform,
        teamId: 1,
        regenerateToken: true
      };

      const url = await channelService.generateWebhookUrl(options);

      expect(url).toMatch(/https?:\/\/.+\/api\/webhooks\/line\/1\/.+/);
    });

    it('should generate unique URLs for different teams', async () => {
      const url1 = await channelService.generateWebhookUrl({
        platform: 'line',
        teamId: 1
      });

      const url2 = await channelService.generateWebhookUrl({
        platform: 'line',
        teamId: 2
      });

      expect(url1).not.toBe(url2);
    });
  });

  describe('getChannelByWebhookToken', () => {
    it('should find channel by webhook token', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        lineWebhookToken: 'test-token-123'
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.getChannelByWebhookToken(
        'line',
        1,
        'test-token-123'
      );

      expect(result).toEqual(mockChannel);
    });

    it('should return null for invalid webhook token', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await channelService.getChannelByWebhookToken(
        'line',
        1,
        'invalid-token'
      );

      expect(result).toBeNull();
    });
  });

  describe('checkChannelHealth', () => {
    it('should return healthy status for active channel', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        isActive: true,
        isVerified: true,
        errorCount: 0,
        lastError: null,
        lastMessageAt: new Date().toISOString()
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.checkChannelHealth(1);

      expect(result.status).toBe('healthy');
      expect(result.channelId).toBe(1);
      expect(result.platform).toBe('line');
      expect(result.consecutiveErrors).toBe(0);
      expect(result.lastError).toBeNull();
      expect(result.lastCheckAt).toBeDefined();
    });

    it('should return degraded status for channel with errors', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        isActive: true,
        isVerified: true,
        errorCount: 3,
        lastError: JSON.stringify({ message: 'Connection timeout', timestamp: '2025-10-27' })
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.checkChannelHealth(1);

      expect(result.status).toBe('degraded');
      expect(result.consecutiveErrors).toBe(3);
      expect(result.lastError).toBeDefined();
      expect(result.lastError.message).toBe('Connection timeout');
    });

    it('should return down status for channel with many errors', async () => {
      const mockChannel = {
        id: 1,
        teamId: 1,
        platform: 'line',
        isActive: true,
        isVerified: true,
        errorCount: 10,
        lastError: JSON.stringify({ message: 'Service unavailable' })
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChannel])
          })
        })
      });

      const result = await channelService.checkChannelHealth(1);

      expect(result.status).toBe('down');
      expect(result.consecutiveErrors).toBe(10);
    });
  });
});
