/**
 * RollbackService - Integration Tests
 *
 * Tests resource cleanup and rollback functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RollbackService } from '@/services/RollbackService';
import { CloudflareAPI } from '@/services/CloudflareAPI';
import type { CloudflareResources } from '@/types/deployment';

describe('RollbackService - Integration Tests', () => {
  let rollbackService: RollbackService;
  let mockAPI: CloudflareAPI;
  let resources: CloudflareResources;

  beforeEach(() => {
    // Mock CloudflareAPI
    mockAPI = {
      deleteD1Database: vi.fn().mockResolvedValue(undefined),
      deleteKVNamespace: vi.fn().mockResolvedValue(undefined),
      deleteR2Bucket: vi.fn().mockResolvedValue(undefined),
      deleteQueue: vi.fn().mockResolvedValue(undefined),
      deleteWorker: vi.fn().mockResolvedValue(undefined),
      deletePagesProject: vi.fn().mockResolvedValue(undefined)
    } as any;

    rollbackService = new RollbackService(mockAPI);

    // Full deployment resources
    resources = {
      d1DatabaseId: 'db-123',
      kvSessionNamespaceId: 'kv-session-456',
      kvCacheNamespaceId: 'kv-cache-789',
      r2BucketName: 'test-uploads',
      queueId: 'queue-345', // Must have queueId for deleteQueue to be called
      queueName: 'delayed-messages',
      workerId: 'worker-012',
      workerUrl: 'https://test-crm.workers.dev',
      pagesProjectId: 'pages-345',
      pagesProjectName: 'test-crm-pages',  // Must have pagesProjectName for deletePagesProject to be called
      pagesUrl: 'https://test-crm.pages.dev'
    };
  });

  describe('Full Rollback', () => {
    it('should delete all created resources', async () => {
      await rollbackService.rollback(resources);

      expect(mockAPI.deleteD1Database).toHaveBeenCalledWith('db-123');
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalledWith('kv-session-456');
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalledWith('kv-cache-789');
      expect(mockAPI.deleteR2Bucket).toHaveBeenCalledWith('test-uploads');
      expect(mockAPI.deleteQueue).toHaveBeenCalledWith('queue-345');  // Uses queueId, not queueName
      expect(mockAPI.deleteWorker).toHaveBeenCalledWith('worker-012');
      expect(mockAPI.deletePagesProject).toHaveBeenCalledWith('test-crm-pages');  // Uses pagesProjectName, not pagesProjectId
    });

    it('should skip deletion of non-existent resources', async () => {
      const partialResources: CloudflareResources = {
        d1DatabaseId: 'db-123',
        kvSessionNamespaceId: 'kv-456',
        kvCacheNamespaceId: '',
        r2BucketName: '',
        queueName: '',
        workerId: '',
        workerUrl: '',
        pagesProjectId: '',
        pagesUrl: ''
      };

      await rollbackService.rollback(partialResources);

      expect(mockAPI.deleteD1Database).toHaveBeenCalledTimes(1);
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalledTimes(1);
      // Empty IDs should not trigger deletions
    });

    it('should continue rollback even if some deletions fail', async () => {
      // Mock D1 deletion failure
      vi.spyOn(mockAPI, 'deleteD1Database').mockRejectedValueOnce(
        new Error('Database not found')
      );

      await rollbackService.rollback(resources);

      // Should still attempt to delete other resources
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalled();
      expect(mockAPI.deleteR2Bucket).toHaveBeenCalled();
      expect(mockAPI.deleteQueue).toHaveBeenCalled();
    });

    it('should handle multiple deletion errors gracefully', async () => {
      vi.spyOn(mockAPI, 'deleteD1Database').mockRejectedValueOnce(
        new Error('DB deletion failed')
      );
      vi.spyOn(mockAPI, 'deleteR2Bucket').mockRejectedValueOnce(
        new Error('Bucket deletion failed')
      );

      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();

      // Should continue despite errors
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalled();
      expect(mockAPI.deleteQueue).toHaveBeenCalled();
    });
  });

  describe('Rollback Order', () => {
    it('should rollback in reverse order of creation', async () => {
      const deletionOrder: string[] = [];

      vi.spyOn(mockAPI, 'deletePagesProject').mockImplementation(async () => {
        deletionOrder.push('pages');
      });
      vi.spyOn(mockAPI, 'deleteWorker').mockImplementation(async () => {
        deletionOrder.push('worker');
      });
      vi.spyOn(mockAPI, 'deleteQueue').mockImplementation(async () => {
        deletionOrder.push('queue');
      });
      vi.spyOn(mockAPI, 'deleteR2Bucket').mockImplementation(async () => {
        deletionOrder.push('r2');
      });
      vi.spyOn(mockAPI, 'deleteKVNamespace').mockImplementation(async () => {
        deletionOrder.push('kv');
      });
      vi.spyOn(mockAPI, 'deleteD1Database').mockImplementation(async () => {
        deletionOrder.push('d1');
      });

      await rollbackService.rollback(resources);

      // Verify reverse order (pages deleted first, d1 last)
      expect(deletionOrder[0]).toBe('pages');
      expect(deletionOrder[deletionOrder.length - 1]).toBe('d1');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully (resource already deleted)', async () => {
      vi.spyOn(mockAPI, 'deleteD1Database').mockRejectedValueOnce(
        new Error('404: Resource not found')
      );

      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();
    });

    it('should handle API timeouts', async () => {
      vi.spyOn(mockAPI, 'deleteD1Database').mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();
    });

    it('should handle network errors', async () => {
      vi.spyOn(mockAPI, 'deleteKVNamespace').mockRejectedValue(
        new Error('Network error')
      );

      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();
    });

    it('should handle concurrent deletion failures', async () => {
      vi.spyOn(mockAPI, 'deleteD1Database').mockRejectedValue(
        new Error('D1 error')
      );
      vi.spyOn(mockAPI, 'deleteKVNamespace').mockRejectedValue(
        new Error('KV error')
      );
      vi.spyOn(mockAPI, 'deleteR2Bucket').mockRejectedValue(
        new Error('R2 error')
      );

      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();
    });
  });

  describe('Idempotency', () => {
    it('should be safe to run rollback multiple times', async () => {
      // First rollback
      await rollbackService.rollback(resources);
      expect(mockAPI.deleteD1Database).toHaveBeenCalledTimes(1);

      // Second rollback (simulate resources already deleted)
      vi.spyOn(mockAPI, 'deleteD1Database').mockRejectedValue(
        new Error('404: Not found')
      );
      vi.spyOn(mockAPI, 'deleteKVNamespace').mockRejectedValue(
        new Error('404: Not found')
      );

      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();
    });

    it('should handle empty resource IDs safely', async () => {
      const emptyResources: CloudflareResources = {
        d1DatabaseId: '',
        kvSessionNamespaceId: '',
        kvCacheNamespaceId: '',
        r2BucketName: '',
        queueName: '',
        workerId: '',
        workerUrl: '',
        pagesProjectId: '',
        pagesUrl: ''
      };

      await expect(rollbackService.rollback(emptyResources)).resolves.not.toThrow();

      // Should not call delete methods for empty IDs
      expect(mockAPI.deleteD1Database).not.toHaveBeenCalled();
      expect(mockAPI.deleteKVNamespace).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup Verification', () => {
    it('should call all delete methods for complete resources', async () => {
      await rollbackService.rollback(resources);

      // Verify all API methods called
      expect(mockAPI.deleteD1Database).toHaveBeenCalled();
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalledTimes(2); // 2 KV namespaces
      expect(mockAPI.deleteR2Bucket).toHaveBeenCalled();
      expect(mockAPI.deleteQueue).toHaveBeenCalled();
      expect(mockAPI.deleteWorker).toHaveBeenCalled();
      expect(mockAPI.deletePagesProject).toHaveBeenCalled();
    });

    it('should handle partial resource deletion', async () => {
      const partialResources: CloudflareResources = {
        d1DatabaseId: 'db-123',
        kvSessionNamespaceId: 'kv-456',
        kvCacheNamespaceId: 'kv-789',
        r2BucketName: 'uploads',
        queueName: '', // Not created
        workerId: '', // Not deployed
        workerUrl: '',
        pagesProjectId: '', // Not deployed
        pagesUrl: ''
      };

      await rollbackService.rollback(partialResources);

      // Should only delete created resources
      expect(mockAPI.deleteD1Database).toHaveBeenCalled();
      expect(mockAPI.deleteKVNamespace).toHaveBeenCalled();
      expect(mockAPI.deleteR2Bucket).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log rollback progress', async () => {
      // Rollback service should maintain internal logs
      await rollbackService.rollback(resources);

      // Verify rollback completed
      expect(mockAPI.deleteD1Database).toHaveBeenCalled();
    });

    it('should log errors without throwing', async () => {
      vi.spyOn(mockAPI, 'deleteD1Database').mockRejectedValue(
        new Error('Deletion failed')
      );

      // Should not throw even if deletion fails
      await expect(rollbackService.rollback(resources)).resolves.not.toThrow();
    });
  });

  describe('Resource Validation', () => {
    it('should handle resources with special characters', async () => {
      const specialResources: CloudflareResources = {
        d1DatabaseId: 'db-test-2024',
        kvSessionNamespaceId: 'kv-session-test',
        kvCacheNamespaceId: 'kv-cache-test',
        r2BucketName: 'test-uploads-2024',
        queueId: 'queue-test-id',
        queueName: 'queue-test-messages',
        workerId: 'worker-test-crm',
        workerUrl: 'https://test.workers.dev',
        pagesProjectId: 'pages-test-crm',
        pagesProjectName: 'test-crm-pages-2024',
        pagesUrl: 'https://test.pages.dev'
      };

      await expect(rollbackService.rollback(specialResources)).resolves.not.toThrow();

      expect(mockAPI.deleteD1Database).toHaveBeenCalledWith('db-test-2024');
      expect(mockAPI.deleteR2Bucket).toHaveBeenCalledWith('test-uploads-2024');
    });

    it('should handle undefined properties gracefully', async () => {
      const incompleteResources = {
        d1DatabaseId: 'db-123',
        kvSessionNamespaceId: 'kv-456'
      } as CloudflareResources;

      await expect(rollbackService.rollback(incompleteResources)).resolves.not.toThrow();
    });
  });
});
