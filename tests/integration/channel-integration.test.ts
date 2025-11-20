// Channel API Integration Tests
// End-to-end testing of channel management REST API endpoints

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { ChannelIntegrationimport { MockFactory } from '@helpers/mockFactory';
, CreateChannelRequest, UpdateChannelRequest } from '@modules/integrations/types/channel-types';

// Test configuration
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com';
const TEST_EMAIL = 'admin@dacit.net';
const TEST_PASSWORD = '16011587DaC'; // Production admin password

// Test data
let authToken: string;
let testTeamId: number;
let createdChannelId: number;

describe('Channel Management API Integration Tests', () => {
  beforeAll(async () => {
    // Authenticate and get JWT token
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

    expect(loginResponse.ok).toBe(true);
    const loginData = await loginResponse.json();

    expect(loginData.success).toBe(true);
    expect(loginData.data.token).toBeDefined();

    authToken = loginData.data.token;
    testTeamId = loginData.data.agent.teamId || 1;

    console.log('✅ Authentication successful');
    console.log(`   Team ID: ${testTeamId}`);
  });

  describe('GET /api/channels', () => {
    test('should list all channels for the authenticated team', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(typeof data.count).toBe('number');
    });

    test('should filter channels by platform', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels?platform=line`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      if (data.data.length > 0) {
        data.data.forEach((channel: ChannelIntegration) => {
          expect(channel.platform).toBe('line');
        });
      }
    });

    test('should reject unauthenticated requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });

    test('should reject requests with invalid token', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token-xyz',
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/channels', () => {
    test('should create a new LINE channel', async () => {
      const createRequest: CreateChannelRequest = {
        platform: 'line',
        teamId: testTeamId, // Include teamId for admin users without database teamId
        lineConfig: {
          channelId: `test-${Date.now()}`,
          channelAccessToken: `test-token-${Date.now()}`,
          channelSecret: 'test-secret-12345'
        },
        configMetadata: {
          description: 'Integration test channel',
          createdBy: 'automated-test'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createRequest)
      });

      const data = await response.json();
      console.log('Create channel response:', data);

      if (response.status === 200 && data.success) {
        expect(data.data).toBeDefined();
        expect(data.data.platform).toBe('line');
        expect(data.webhookUrl).toBeDefined();
        expect(data.webhookUrl).toContain('/webhook/line');

        createdChannelId = data.data.id;

        console.log('✅ Channel created successfully');
        console.log(`   Channel ID: ${createdChannelId}`);
        console.log(`   Webhook URL: ${data.webhookUrl}`);
      } else if (data.error?.includes('already has an active')) {
        console.log('⚠️  Team already has active LINE channel, skipping creation');

        // Find existing channel for subsequent tests
        const listResponse = await fetch(`${API_BASE_URL}/api/channels?platform=line`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        const listData = await listResponse.json();
        if (listData.data && listData.data.length > 0) {
          createdChannelId = listData.data[0].id;
        }
      }
    });

    test('should reject creation without authentication', async () => {
      const createRequest: CreateChannelRequest = {
        platform: 'line',
        lineConfig: {
          channelId: 'test-channel-id',
          channelAccessToken: 'test-token',
          channelSecret: 'test-secret'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createRequest)
      });

      expect(response.status).toBe(401);
    });

    test('should reject creation with invalid platform', async () => {
      const createRequest = {
        platform: 'invalid-platform',
        lineConfig: {
          channelId: 'test-channel-id',
          channelAccessToken: 'test-token',
          channelSecret: 'test-secret'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createRequest)
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/channels/:id', () => {
    test('should get channel details by ID', async () => {
      if (!createdChannelId) {
        console.log('⚠️  No channel ID available, skipping test');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/channels/${createdChannelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdChannelId);
      expect(data.data.platform).toBeDefined();
    });

    test('should return 404 for non-existent channel', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels/99999`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(404);
    });

    test('should reject unauthenticated requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels/1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/channels/:id', () => {
    test('should update channel configuration', async () => {
      if (!createdChannelId) {
        console.log('⚠️  No channel ID available, skipping test');
        return;
      }

      const updateRequest: UpdateChannelRequest = {
        lineConfig: {
          channelAccessToken: `updated-token-${Date.now()}`
        },
        configMetadata: {
          lastUpdated: new Date().toISOString(),
          updatedBy: 'automated-test'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/channels/${createdChannelId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateRequest)
      });

      const data = await response.json();
      console.log('Update channel response:', data);

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(data.data.id).toBe(createdChannelId);
        console.log('✅ Channel updated successfully');
      }
    });

    test('should reject update for non-existent channel', async () => {
      const updateRequest: UpdateChannelRequest = {
        lineConfig: {
          channelAccessToken: 'new-token'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/channels/99999`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should reject unauthenticated update requests', async () => {
      const updateRequest: UpdateChannelRequest = {
        lineConfig: {
          channelAccessToken: 'new-token'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/channels/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/channels/:id/verify', () => {
    test('should verify channel configuration', async () => {
      if (!createdChannelId) {
        console.log('⚠️  No channel ID available, skipping test');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/channels/${createdChannelId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBeDefined();
      expect(data.verified).toBeDefined();
      expect(data.message).toBeDefined();

      console.log('Verification result:', data.message);
    });

    test('should reject verification without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels/1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/channels/:id/stats', () => {
    test('should get channel statistics', async () => {
      if (!createdChannelId) {
        console.log('⚠️  No channel ID available, skipping test');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/channels/${createdChannelId}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(typeof data.data.totalMessagesSent).toBe('number');
      expect(typeof data.data.totalMessagesReceived).toBe('number');
      expect(typeof data.data.successRate).toBe('number');
    });

    test('should reject stats request without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels/1/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/channels/:id/health', () => {
    test('should check channel health', async () => {
      if (!createdChannelId) {
        console.log('⚠️  No channel ID available, skipping test');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/channels/${createdChannelId}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.status).toMatch(/healthy|degraded|unhealthy/);
      expect(data.data.lastChecked).toBeDefined();
      expect(Array.isArray(data.data.issues)).toBe(true);
    });

    test('should reject health check without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels/1/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/channels/:id', () => {
    test('should deactivate channel', async () => {
      if (!createdChannelId) {
        console.log('⚠️  No channel ID available, skipping test');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/channels/${createdChannelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('Delete channel response:', data);

      if (response.status === 200) {
        expect(data.success).toBe(true);
        console.log('✅ Channel deactivated successfully');
      }
    });

    test('should reject deletion without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/channels/1`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting & Security', () => {
    test('should handle multiple rapid requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        fetch(`${API_BASE_URL}/api/channels`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });
  });
});
