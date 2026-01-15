/**
 * ConfigGenerator Service - Integration Tests
 *
 * Tests wrangler.toml configuration generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigGenerator } from '@/services/ConfigGenerator';
import type { CloudflareResources, DeploymentConfig } from '@/types/deployment';

describe('ConfigGenerator Service - Integration Tests', () => {
  let generator: ConfigGenerator;
  let mockConfig: DeploymentConfig;

  beforeEach(() => {
    generator = new ConfigGenerator();
    mockConfig = {
      projectName: 'test-crm-system',
      adminEmail: 'admin@test.com',
      accountId: 'test-account-123',
      oauthToken: 'test-token-456'
    };
  });

  describe('Wrangler Config Generation', () => {
    it('should generate valid wrangler.toml config', () => {
      const projectName = 'test-crm-system';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-uuid-456',
        kvSessionNamespaceId: 'kv-session-789',
        kvCacheNamespaceId: 'kv-cache-012',
        r2BucketName: 'test-crm-uploads',
        queueName: 'delayed-messages',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      // Verify all required sections exist
      expect(config).toContain('name = "test-crm-system-worker"');
      expect(config).toContain('main = "src/index.ts"');
      expect(config).toContain('compatibility_date =');

      // Verify D1 binding
      expect(config).toContain('[[d1_databases]]');
      expect(config).toContain('binding = "DB"');
      expect(config).toContain('database_id = "db-uuid-456"');

      // Verify KV bindings
      expect(config).toContain('[[kv_namespaces]]');
      expect(config).toContain('binding = "SESSION_KV"');
      expect(config).toContain('id = "kv-session-789"');
      expect(config).toContain('binding = "CACHE_KV"');
      expect(config).toContain('id = "kv-cache-012"');

      // Verify R2 binding
      expect(config).toContain('[[r2_buckets]]');
      expect(config).toContain('binding = "FILE_STORAGE"');
      expect(config).toContain('bucket_name = "test-crm-uploads"');

      // Verify Queue binding
      expect(config).toContain('[[queues.producers]]');
      expect(config).toContain('binding = "MESSAGE_QUEUE"');
      expect(config).toContain('queue = "delayed-messages"');
    });

    it('should handle special characters in project name', () => {
      const projectName = 'my-crm-2024';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads-2024',
        queueName: 'queue-2024',
        workerId: 'worker-123',
        workerUrl: 'https://my-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://my-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      expect(config).toContain('name = "my-crm-2024-worker"');
      expect(config).toContain('bucket_name = "uploads-2024"');
    });

    it('should include all Durable Objects bindings', () => {
      const projectName = 'test-crm';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads',
        queueName: 'queue-345',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      // Verify all Durable Objects
      expect(config).toContain('[durable_objects]');
      expect(config).toContain('name = "CONVERSATION_ROOM"');
      expect(config).toContain('name = "USER_CONNECTION"');
      expect(config).toContain('name = "MESSAGE_BROADCASTER"');
      expect(config).toContain('name = "DELAYED_MESSAGE_PROCESSOR"');
      expect(config).toContain('name = "DELAYED_MESSAGE_BUFFER"');
    });

    it('should include environment variables section', () => {
      const projectName = 'test-crm';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads',
        queueName: 'queue-345',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      expect(config).toContain('[vars]');
      expect(config).toContain('ENVIRONMENT =');
      expect(config).toContain('JWT_SECRET =');
      expect(config).toContain('ENCRYPTION_KEY =');
    });

    it('should set correct compatibility date format', () => {
      const projectName = 'test-crm';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads',
        queueName: 'queue-345',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      // compatibility_date should be in YYYY-MM-DD format
      const dateMatch = config.match(/compatibility_date = "(\d{4}-\d{2}-\d{2})"/);
      expect(dateMatch).not.toBeNull();

      if (dateMatch) {
        const date = new Date(dateMatch[1]);
        expect(date.toString()).not.toBe('Invalid Date');
      }
    });
  });

  describe('Frontend Configuration', () => {
    it('should generate frontend .env configuration', () => {
      const resources: CloudflareResources = {
        workerUrl: 'https://test-crm.workers.dev',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const envConfig = generator.generateFrontendEnv(resources, mockConfig);

      expect(envConfig).toContain('VITE_BACKEND_URL=https://test-crm.workers.dev');
      expect(envConfig).toContain('VITE_WEBSOCKET_URL=wss://test-crm.workers.dev');
      expect(envConfig).toContain('VITE_FRONTEND_URL=https://test-crm.pages.dev');
      expect(envConfig).toContain('VITE_ENVIRONMENT=production');
    });

    it('should handle custom domains in frontend config', () => {
      const resources: CloudflareResources = {
        workerUrl: 'https://api.crm.example.com',
        pagesUrl: 'https://crm.example.com'
      };
      const customConfig: DeploymentConfig = {
        ...mockConfig,
        customDomain: 'crm.example.com',
        backendUrl: 'https://api.crm.example.com',
        frontendUrl: 'https://crm.example.com'
      };

      const envConfig = generator.generateFrontendEnv(resources, customConfig);

      expect(envConfig).toContain('VITE_BACKEND_URL=https://api.crm.example.com');
      expect(envConfig).toContain('VITE_WEBSOCKET_URL=wss://api.crm.example.com');
      expect(envConfig).toContain('VITE_FRONTEND_URL=https://crm.example.com');
    });

    it('should correctly convert HTTPS to WSS', () => {
      const resources: CloudflareResources = {
        workerUrl: 'https://test.workers.dev',
        pagesUrl: 'https://test.pages.dev'
      };

      const envConfig = generator.generateFrontendEnv(resources, mockConfig);

      expect(envConfig).toContain('wss://test.workers.dev');
      // WS URL should be in a different line than BACKEND URL
      const lines = envConfig.split('\n');
      const backendLine = lines.find(l => l.includes('VITE_BACKEND_URL'));
      const wsLine = lines.find(l => l.includes('VITE_WEBSOCKET_URL'));

      expect(backendLine).toContain('https://test.workers.dev');
      expect(wsLine).toContain('wss://test.workers.dev');
    });

    it('should include VITE_LIFF_ID when lineLiffId is provided', () => {
      const resources: CloudflareResources = {
        workerUrl: 'https://test-crm.workers.dev',
        pagesUrl: 'https://test-crm.pages.dev'
      };
      const configWithLiff: DeploymentConfig = {
        ...mockConfig,
        lineLiffId: '2008756115-vWtFyDMA'
      };

      const envConfig = generator.generateFrontendEnv(resources, configWithLiff);

      expect(envConfig).toContain('VITE_LIFF_ID=2008756115-vWtFyDMA');
      expect(envConfig).toContain('# ===== LINE LIFF Configuration =====');
    });

    it('should include empty VITE_LIFF_ID when lineLiffId is not provided', () => {
      const resources: CloudflareResources = {
        workerUrl: 'https://test-crm.workers.dev',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const envConfig = generator.generateFrontendEnv(resources, mockConfig);

      expect(envConfig).toContain('VITE_LIFF_ID=');
      // Should still have the section header
      expect(envConfig).toContain('# ===== LINE LIFF Configuration =====');
    });
  });

  describe('Deployment Summary', () => {
    it('should generate deployment summary', () => {
      const projectName = 'test-crm';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads',
        queueName: 'queue-345',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };
      const adminEmail = 'admin@example.com';

      const summary = generator.generateDeploymentSummary(projectName, resources, adminEmail);

      expect(summary).toContain('CRM System Deployment Summary');
      expect(summary).toContain('test-crm');
      expect(summary).toContain('admin@example.com');
      expect(summary).toContain('db-456');
      expect(summary).toContain('https://test-crm.pages.dev');
      expect(summary).toContain('https://test-crm.workers.dev');
    });

    it('should include next steps in summary', () => {
      const projectName = 'test-crm';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads',
        queueName: 'queue-345',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const summary = generator.generateDeploymentSummary(projectName, resources, 'admin@example.com');

      expect(summary).toContain('Next Steps');
      expect(summary).toContain('Login to your CRM');
      expect(summary).toContain('Change your password');
      expect(summary).toContain('Set up LINE OA integration');
    });
  });

  describe('TOML Formatting', () => {
    it('should produce valid TOML syntax', () => {
      const projectName = 'test-crm';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads',
        queueName: 'queue-345',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      // Basic TOML validation checks
      // 1. Should not have syntax errors (balanced quotes)
      const quoteCount = (config.match(/"/g) || []).length;
      expect(quoteCount % 2).toBe(0); // Even number of quotes

      // 2. Should not have empty sections
      expect(config).not.toContain('[[]]');
      expect(config).not.toContain('binding = ""');

      // 3. Should have proper table declarations
      expect(config).toContain('[[d1_databases]]');
      expect(config).toContain('[[kv_namespaces]]');
      expect(config).toContain('[[r2_buckets]]');
    });

    it('should escape special characters properly', () => {
      const projectName = 'test-crm-v2';
      const resources: CloudflareResources = {
        d1DatabaseId: 'db-456',
        kvSessionNamespaceId: 'kv-789',
        kvCacheNamespaceId: 'kv-012',
        r2BucketName: 'uploads-v2',
        queueName: 'queue-v2',
        workerId: 'worker-123',
        workerUrl: 'https://test-crm.workers.dev',
        pagesProjectId: 'pages-456',
        pagesUrl: 'https://test-crm.pages.dev'
      };

      const config = generator.generateWranglerConfig(projectName, resources, mockConfig);

      // Should handle hyphens in project name
      expect(config).toContain('test-crm-v2-worker');
    });
  });

  describe('Admin Password Generation', () => {
    it('should generate random admin password', () => {
      const password1 = generator.generateAdminPassword();
      const password2 = generator.generateAdminPassword();

      expect(password1).toBeTruthy();
      expect(password1.length).toBe(16);
      expect(password1).not.toBe(password2); // Should be random
    });

    it('should generate password with valid characters', () => {
      const password = generator.generateAdminPassword();

      // Should only contain alphanumeric and special chars
      expect(password).toMatch(/^[A-Za-z0-9!@#$%^&*]+$/);
    });
  });
});
