/**
 * E2E Tests for WebSocket Monitoring System
 *
 * Tests the complete monitoring flow including:
 * - Health checks via API
 * - Circuit breaker state management
 * - Alert system integration
 * - Real-time metric updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-domain.example.com';
const TEST_TIMEOUT = 30000;

// Helper to get auth token
async function getAuthToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'testpassword'
    })
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

describe('WebSocket Monitoring E2E', () => {
  let authToken: string;

  beforeAll(async () => {
    try {
      authToken = await getAuthToken();
    } catch (error) {
      console.warn('Auth failed, some tests may be skipped:', error);
    }
  }, TEST_TIMEOUT);

  describe('Public Health Endpoints', () => {
    it('should return health status without auth', async () => {
      const response = await fetch(`${API_BASE_URL}/api/monitoring/health`);

      expect(response.ok).toBe(true);

      const health = await response.json();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('components');
      expect(['healthy', 'degraded', 'error']).toContain(health.status);
    });

    it('should include component health details', async () => {
      const response = await fetch(`${API_BASE_URL}/api/monitoring/health`);
      const health = await response.json();

      expect(health.components).toHaveProperty('durableObjects');
      expect(health.components).toHaveProperty('circuitBreaker');
      expect(health.components).toHaveProperty('alerts');
    });

    it('should include summary statistics', async () => {
      const response = await fetch(`${API_BASE_URL}/api/monitoring/health`);
      const health = await response.json();

      expect(health.summary).toHaveProperty('totalInstances');
      expect(health.summary).toHaveProperty('instancesByType');
    });
  });

  describe('WebSocket Health Endpoints', () => {
    it('should return WebSocket-specific health', async () => {
      const response = await fetch(`${API_BASE_URL}/api/websocket/health`);

      expect(response.ok).toBe(true);

      const health = await response.json();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('components');
    });

    it('should return readiness probe status', async () => {
      const response = await fetch(`${API_BASE_URL}/api/websocket/readiness`);

      expect(response.ok).toBe(true);

      const readiness = await response.json();
      expect(readiness).toHaveProperty('ready');
    });

    it('should return liveness probe status', async () => {
      const response = await fetch(`${API_BASE_URL}/api/websocket/liveness`);

      expect(response.ok).toBe(true);

      const liveness = await response.json();
      expect(liveness).toHaveProperty('alive');
    });
  });

  describe('Authenticated Monitoring Endpoints', () => {
    it('should return detailed metrics for admin', async () => {
      if (!authToken) {
        console.warn('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/monitoring/metrics`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.status === 403) {
        console.warn('Skipping test - insufficient permissions');
        return;
      }

      expect(response.ok).toBe(true);

      const metrics = await response.json();
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('durableObjects');
      expect(metrics).toHaveProperty('circuitBreaker');
    });

    it('should return active alerts', async () => {
      if (!authToken) {
        console.warn('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/monitoring/alerts`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.ok).toBe(true);

      const alerts = await response.json();
      expect(alerts).toHaveProperty('count');
      expect(alerts).toHaveProperty('alerts');
      expect(Array.isArray(alerts.alerts)).toBe(true);
    });

    it('should return circuit breaker status', async () => {
      if (!authToken) {
        console.warn('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/monitoring/circuit-breaker/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.ok).toBe(true);

      const status = await response.json();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('stats');
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(status.state);
    });
  });

  describe('Circuit Breaker Controls', () => {
    it('should allow manual reset (admin only)', async () => {
      if (!authToken) {
        console.warn('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/monitoring/circuit-breaker/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.status === 403) {
        console.warn('Skipping test - insufficient permissions');
        return;
      }

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('newState');
      expect(result.newState).toBe('CLOSED');
    });

    it('should reject circuit breaker reset for non-admin', async () => {
      // Test without auth - should be rejected
      const response = await fetch(`${API_BASE_URL}/api/monitoring/circuit-breaker/reset`, {
        method: 'POST'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Instance Monitoring', () => {
    it('should return DO instance metrics by type', async () => {
      if (!authToken) {
        console.warn('Skipping test - no auth token');
        return;
      }

      const types = ['ConversationRoom', 'UserConnection', 'MessageBroadcaster'];

      for (const type of types) {
        const response = await fetch(`${API_BASE_URL}/api/monitoring/instances/${type}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 403) {
          console.warn(`Skipping test for ${type} - insufficient permissions`);
          continue;
        }

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('count');
        expect(data).toHaveProperty('instances');
        expect(data.type).toBe(type);
      }
    });
  });

  describe('Alert History', () => {
    it('should return alert history with limit', async () => {
      if (!authToken) {
        console.warn('Skipping test - no auth token');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/monitoring/alerts/history?limit=10`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.status === 403) {
        console.warn('Skipping test - insufficient permissions');
        return;
      }

      expect(response.ok).toBe(true);

      const history = await response.json();
      expect(history).toHaveProperty('count');
      expect(history).toHaveProperty('limit');
      expect(history).toHaveProperty('alerts');
      expect(history.limit).toBe(10);
      expect(history.alerts.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Health Check Performance', () => {
    it('should respond within acceptable latency', async () => {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE_URL}/api/monitoring/health`);
      const endTime = Date.now();

      const latency = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(latency).toBeLessThan(5000); // Should respond within 5 seconds

      console.log(`Health check latency: ${latency}ms`);
    });

    it('should handle concurrent health checks', async () => {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests)
        .fill(null)
        .map(() => fetch(`${API_BASE_URL}/api/monitoring/health`));

      const responses = await Promise.all(requests);

      const successCount = responses.filter(r => r.ok).length;
      expect(successCount).toBe(concurrentRequests);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for invalid endpoint', async () => {
      const response = await fetch(`${API_BASE_URL}/api/monitoring/invalid-endpoint`);

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should require auth for protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/monitoring/metrics',
        '/api/monitoring/alerts/history',
        '/api/monitoring/instances/ConversationRoom'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });
});
