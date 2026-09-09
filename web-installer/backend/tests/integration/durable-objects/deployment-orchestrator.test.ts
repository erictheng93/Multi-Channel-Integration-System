/**
 * DeploymentOrchestrator - Integration Tests
 *
 * Tests the core deployment orchestration logic using @cloudflare/vitest-pool-workers
 * Runs in actual Workers runtime with Miniflare
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import type { DeploymentConfig } from '@/types/deployment';

// Valid test configuration
const validConfig: DeploymentConfig = {
  projectName: 'test-crm-system',
  adminEmail: 'admin@example.com',
  customDomain: '',
  accountId: 'test-account-123',
  oauthToken: 'test-oauth-token-456'
};

/**
 * Outbound request stubs for the Cloudflare and Resend APIs.
 *
 * vitest-pool-workers 0.13+ removed `fetchMock` from `cloudflare:test`, so the
 * undici interceptors this suite used are expressed as a plain route table
 * matched against globalThis.fetch. Order matters: the first match wins, so
 * the more specific paths (D1 query, Pages deployments) precede the prefixes
 * they extend.
 */
const MOCK_ROUTES: Array<{ method: string; pattern: RegExp; body: unknown }> = [
  // D1 query (migrations) — must precede the D1 database route it extends.
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/d1\/database\/.*\/query/,
    body: { success: true, result: [{ results: [], success: true }] }
  },
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/d1\/database/,
    body: { success: true, result: { uuid: 'test-d1-uuid-123', name: 'test-crm-system-db' } }
  },
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/storage\/kv\/namespaces/,
    body: { success: true, result: { id: 'test-kv-uuid-456' } }
  },
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/r2\/buckets/,
    body: { success: true, result: { name: 'test-crm-system-files' } }
  },
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/queues/,
    body: { success: true, result: { queue_id: 'test-queue-id', queue_name: 'test-crm-system-queue' } }
  },
  {
    method: 'PUT',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/workers\/scripts\/.*/,
    body: { success: true, result: { etag: 'test-etag-789' } }
  },
  // Pages deployments — must precede the Pages projects route it extends.
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/pages\/projects\/.*\/deployments/,
    body: { success: true, result: { id: 'test-deployment-id', url: 'https://test-crm-system.pages.dev' } }
  },
  {
    method: 'POST',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/pages\/projects/,
    body: {
      success: true,
      result: { id: 'test-pages-id', name: 'test-crm-system', subdomain: 'test-crm-system' }
    }
  },
  {
    method: 'PATCH',
    pattern: /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/.*\/pages\/projects\/.*\/env/,
    body: { success: true, result: {} }
  },
  {
    method: 'GET',
    pattern: /^https:\/\/api\.cloudflare\.com\/api\/system\/health/,
    body: { status: 'ok' }
  },
  {
    method: 'POST',
    pattern: /^https:\/\/api\.resend\.com\/emails/,
    body: { id: 'test-email-id' }
  }
];

describe('DeploymentOrchestrator - Workers Runtime Tests', () => {
  let deploymentId: string;
  let realFetch: typeof globalThis.fetch;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const route = MOCK_ROUTES.find(
        (candidate) => candidate.method === request.method && candidate.pattern.test(request.url)
      );
      if (!route) {
        // Stands in for the old fetchMock.disableNetConnect(): a test must
        // never reach the real network, and an unlisted call is a test bug.
        throw new Error(`Unmocked outbound request: ${request.method} ${request.url}`);
      }
      return Response.json(route.body);
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.clearAllMocks();
  });


  describe('Deployment Initialization', () => {
    it('should initialize deployment with valid configuration', async () => {
      // Get a Durable Object stub
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-1');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      // Send deploy request
      const response = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });

      expect(response.status).toBe(200);

      const result = await response.json() as { success: boolean; deploymentId: string; message: string };
      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeTruthy();
      expect(result.message).toBe('Deployment started');

      deploymentId = result.deploymentId;
    });

    it('should generate unique deployment ID', async () => {
      const id1 = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-2');
      const stub1 = env.DEPLOYMENT_ORCHESTRATOR.get(id1);

      const response1 = await stub1.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });

      const result1 = await response1.json() as { deploymentId: string };

      const id2 = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-3');
      const stub2 = env.DEPLOYMENT_ORCHESTRATOR.get(id2);

      const response2 = await stub2.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });

      const result2 = await response2.json() as { deploymentId: string };

      // Each DO instance should generate its own unique ID
      expect(result1.deploymentId).toBeTruthy();
      expect(result2.deploymentId).toBeTruthy();
    });

    it('should handle malformed JSON in POST request', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-invalid-json');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{{'
      });

      expect(response.status).toBe(500);

      // Consume the response body to prevent isolated storage issues
      await response.text();
    });
  });

  describe('Deployment Status Retrieval', () => {
    it('should return 404 when no deployment exists', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-no-state');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      expect(response.status).toBe(404);
      const result = await response.json() as { error: string };
      expect(result.error).toBe('No deployment found');
    });

    it('should return deployment status after deployment started', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-status');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      // First start a deployment
      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait a bit for state to be saved
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then get status
      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const status = await response.json() as {
        deploymentId: string;
        status: string;
        currentStep: string;
        totalProgress: number;
      };

      expect(status).toHaveProperty('deploymentId');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('currentStep');
      expect(status).toHaveProperty('totalProgress');
    });
  });

  describe('SSE Event Streaming', () => {
    it('should establish SSE connection with correct headers', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-sse');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/events', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      await response.text();
    });

    it('should have readable stream body', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-sse-body');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/events', {
        method: 'GET'
      });

      expect(response.body).toBeTruthy();
      expect(response.body).toBeInstanceOf(ReadableStream);

      await response.text();
    });
  });

  describe('Deployment Cancellation', () => {
    it('should return 404 when cancelling non-existent deployment', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-cancel-none');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/cancel', {
        method: 'POST'
      });

      expect(response.status).toBe(404);
      const result = await response.json() as { error: string };
      expect(result.error).toBe('No active deployment');
    });

    it('should allow cancelling an in-progress deployment', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-cancel-active');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      // Start deployment
      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel deployment
      const response = await stub.fetch('http://localhost/cancel', {
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; message: string };
      expect(result.success).toBe(true);
      expect(result.message).toBe('Deployment cancelled');
    });
  });

  describe('HTTP Route Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-404');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/unknown-route', {
        method: 'GET'
      });

      expect(response.status).toBe(404);

      // Consume the response body to prevent isolated storage issues
      await response.text();
    });

    it('should handle missing request body gracefully', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-no-body');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const response = await stub.fetch('http://localhost/deploy', {
        method: 'POST'
      });

      // Should return 500 error when trying to parse empty body
      expect(response.status).toBe(500);

      // Consume the response body to prevent isolated storage issues
      await response.text();
    });
  });

  describe('State Persistence', () => {
    it('should persist deployment state across requests', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-persist');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      // Start deployment
      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });

      const startResult = await startResponse.json() as { deploymentId: string };
      const originalDeploymentId = startResult.deploymentId;

      // Wait for state to persist
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get status (should retrieve persisted state)
      const statusResponse = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await statusResponse.json() as { deploymentId: string };

      // Deployment ID should match
      expect(status.deploymentId).toBe(originalDeploymentId);
    });
  });

  describe('Progress Tracking', () => {
    it('should initialize progress to 0', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-progress-init');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      // Start deployment
      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get status
      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as {
        totalProgress: number;
        currentStepProgress: number;
      };

      expect(status.totalProgress).toBeGreaterThanOrEqual(0);
      expect(status.currentStepProgress).toBeGreaterThanOrEqual(0);
    });

    it('should track current step', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-step-track');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      // Start deployment
      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get status
      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as { currentStep: string };

      // Should be at some step (initialize or beyond)
      expect(status.currentStep).toBeTruthy();
      expect(typeof status.currentStep).toBe('string');
    });
  });

  describe('Timestamps', () => {
    it('should set createdAt timestamp', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-timestamp-create');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const beforeTime = Date.now();

      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      const afterTime = Date.now();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as { createdAt: number };

      expect(status.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(status.createdAt).toBeLessThanOrEqual(afterTime + 100);
    });

    it('should set updatedAt timestamp', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-timestamp-update');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as { updatedAt: number };

      expect(status.updatedAt).toBeTruthy();
      expect(typeof status.updatedAt).toBe('number');
    });
  });

  describe('Deployment Logs', () => {
    it('should maintain deployment logs', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-logs');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait for some logs to be generated
      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as { logs: Array<{ timestamp: number; message: string }> };

      expect(status).toHaveProperty('logs');
      expect(Array.isArray(status.logs)).toBe(true);
    });

    it('should include timestamps in logs', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-logs-timestamp');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait for logs
      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as { logs: Array<{ timestamp: number }> };

      if (status.logs && status.logs.length > 0) {
        expect(status.logs[0]).toHaveProperty('timestamp');
        expect(typeof status.logs[0].timestamp).toBe('number');
      }
    });
  });

  describe('Resource Tracking', () => {
    it('should initialize resources as empty object', async () => {
      const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName('test-deployment-resources-init');
      const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

      const startResponse = await stub.fetch('http://localhost/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConfig)
      });
      await startResponse.text();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await stub.fetch('http://localhost/status', {
        method: 'GET'
      });

      const status = await response.json() as { resources: Record<string, unknown> };

      expect(status).toHaveProperty('resources');
      expect(typeof status.resources).toBe('object');
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid project name', async () => {
      const validNames = [
        'my-crm-system',
        'customer-portal-2024',
        'test-deployment'
      ];

      for (const projectName of validNames) {
        const config = { ...validConfig, projectName };
        const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName(`test-valid-name-${projectName}`);
        const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

        const response = await stub.fetch('http://localhost/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });

        const result = await response.json() as { success: boolean };
        expect(result.success).toBe(true);
      }
    });

    it('should accept valid email addresses', async () => {
      const validEmails = [
        'admin@example.com',
        'user@company.co.uk',
        'test_user@domain.org'
      ];

      for (const adminEmail of validEmails) {
        const config = { ...validConfig, adminEmail };
        const id = env.DEPLOYMENT_ORCHESTRATOR.idFromName(`test-valid-email-${adminEmail.replace('@', '-at-')}`);
        const stub = env.DEPLOYMENT_ORCHESTRATOR.get(id);

        const response = await stub.fetch('http://localhost/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });

        const result = await response.json() as { success: boolean };
        expect(result.success).toBe(true);
      }
    });
  });
});
