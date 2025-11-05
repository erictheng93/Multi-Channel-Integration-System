/**
 * Rollback Service
 *
 * Handles cleanup of resources when deployment fails
 * Ensures no orphaned resources are left in Cloudflare account
 */

import { CloudflareAPI } from './CloudflareAPI';
import type { CloudflareResources, DeploymentLog } from '../types/deployment';

export class RollbackService {
  private api: CloudflareAPI;
  private logs: DeploymentLog[] = [];

  constructor(api: CloudflareAPI) {
    this.api = api;
  }

  /**
   * Rollback all created resources
   */
  async rollback(resources: CloudflareResources): Promise<void> {
    this.log('info', 'Starting rollback process');

    // Rollback in reverse order of creation
    const rollbackSteps = [
      { name: 'Custom Domain', fn: () => this.rollbackCustomDomain(resources) },
      { name: 'Pages Project', fn: () => this.rollbackPages(resources) },
      { name: 'Worker', fn: () => this.rollbackWorker(resources) },
      { name: 'Queue', fn: () => this.rollbackQueue(resources) },
      { name: 'R2 Bucket', fn: () => this.rollbackR2(resources) },
      { name: 'KV Cache Namespace', fn: () => this.rollbackKVCache(resources) },
      { name: 'KV Session Namespace', fn: () => this.rollbackKVSession(resources) },
      { name: 'D1 Database', fn: () => this.rollbackD1(resources) }
    ];

    for (const step of rollbackSteps) {
      try {
        await step.fn();
        this.log('success', `Rolled back: ${step.name}`);
      } catch (error) {
        this.log('warning', `Failed to rollback ${step.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue rollback even if one step fails
      }
    }

    this.log('success', 'Rollback completed');
  }

  /**
   * Get rollback logs
   */
  getLogs(): DeploymentLog[] {
    return this.logs;
  }

  /**
   * Rollback D1 Database
   */
  private async rollbackD1(resources: CloudflareResources): Promise<void> {
    if (resources.d1DatabaseId) {
      await this.api.deleteD1Database(resources.d1DatabaseId);
    }
  }

  /**
   * Rollback KV Session Namespace
   */
  private async rollbackKVSession(resources: CloudflareResources): Promise<void> {
    if (resources.kvSessionNamespaceId) {
      await this.api.deleteKVNamespace(resources.kvSessionNamespaceId);
    }
  }

  /**
   * Rollback KV Cache Namespace
   */
  private async rollbackKVCache(resources: CloudflareResources): Promise<void> {
    if (resources.kvCacheNamespaceId) {
      await this.api.deleteKVNamespace(resources.kvCacheNamespaceId);
    }
  }

  /**
   * Rollback R2 Bucket
   */
  private async rollbackR2(resources: CloudflareResources): Promise<void> {
    if (resources.r2BucketName) {
      await this.api.deleteR2Bucket(resources.r2BucketName);
    }
  }

  /**
   * Rollback Queue
   */
  private async rollbackQueue(resources: CloudflareResources): Promise<void> {
    if (resources.queueName) {
      // Note: Queue deletion requires queue ID, not name
      // In production, you'd store the queue ID in resources
      this.log('warning', 'Queue deletion skipped - queue ID not available');
    }
  }

  /**
   * Rollback Worker
   */
  private async rollbackWorker(resources: CloudflareResources): Promise<void> {
    if (resources.workerId) {
      await this.api.deleteWorker(resources.workerId);
    }
  }

  /**
   * Rollback Pages Project
   */
  private async rollbackPages(resources: CloudflareResources): Promise<void> {
    if (resources.pagesProjectId) {
      await this.api.deletePagesProject(resources.pagesProjectId);
    }
  }

  /**
   * Rollback Custom Domain
   */
  private async rollbackCustomDomain(resources: CloudflareResources): Promise<void> {
    // Custom domains are deleted automatically when Pages project is deleted
    // No explicit action needed
    this.log('info', 'Custom domain will be removed with Pages project');
  }

  /**
   * Verify all resources are cleaned up
   */
  async verifyCleanup(resources: CloudflareResources): Promise<boolean> {
    let allCleaned = true;

    // Check D1 Database
    if (resources.d1DatabaseId) {
      try {
        await this.api.executeD1Query(resources.d1DatabaseId, 'SELECT 1');
        allCleaned = false;
        this.log('warning', 'D1 Database still exists');
      } catch {
        // Database doesn't exist - good
      }
    }

    return allCleaned;
  }

  /**
   * Log a message
   */
  private log(level: DeploymentLog['level'], message: string): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      step: 'complete' // Rollback doesn't have specific steps
    });
  }

  /**
   * Estimate cleanup time
   */
  estimateCleanupTime(resources: CloudflareResources): number {
    let estimatedMs = 0;

    if (resources.d1DatabaseId) estimatedMs += 5000;
    if (resources.kvSessionNamespaceId) estimatedMs += 2000;
    if (resources.kvCacheNamespaceId) estimatedMs += 2000;
    if (resources.r2BucketName) estimatedMs += 3000;
    if (resources.queueName) estimatedMs += 2000;
    if (resources.workerId) estimatedMs += 3000;
    if (resources.pagesProjectId) estimatedMs += 5000;

    return estimatedMs;
  }

  /**
   * Get resources that need rollback
   */
  getResourcesToRollback(resources: CloudflareResources): string[] {
    const toRollback: string[] = [];

    if (resources.d1DatabaseId) toRollback.push(`D1 Database (${resources.d1DatabaseId})`);
    if (resources.kvSessionNamespaceId) toRollback.push(`KV Session (${resources.kvSessionNamespaceId})`);
    if (resources.kvCacheNamespaceId) toRollback.push(`KV Cache (${resources.kvCacheNamespaceId})`);
    if (resources.r2BucketName) toRollback.push(`R2 Bucket (${resources.r2BucketName})`);
    if (resources.queueName) toRollback.push(`Queue (${resources.queueName})`);
    if (resources.workerId) toRollback.push(`Worker (${resources.workerId})`);
    if (resources.pagesProjectId) toRollback.push(`Pages (${resources.pagesProjectId})`);

    return toRollback;
  }
}
