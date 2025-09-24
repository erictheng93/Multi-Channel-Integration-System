// Distributed Lock Service
// 專案名稱：Multi-Channel Support MVP - WebSocket Real-time System
// 提供跨 Durable Objects 的分散式鎖定機制

import type {
  DistributedLock,
  LockAcquisitionOptions
} from '../types/websocket-types';

/**
 * Architecture Overview:
 *
 * DistributedLockService provides:
 * 1. Cross-Durable Object locking mechanism
 * 2. Deadlock prevention and detection
 * 3. Lock timeout and cleanup
 * 4. Lock ownership tracking
 * 5. Performance monitoring for lock operations
 *
 * This service ensures data consistency across all Durable Objects
 * and prevents race conditions in critical sections
 */

export class DistributedLockService {
  private lockStub: DurableObjectStub;

  // Lock configuration
  private readonly DEFAULT_TTL = 30000; // 30 seconds
  private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds
  private readonly DEFAULT_RETRY_INTERVAL = 100; // 100ms
  private readonly MAX_RETRIES = 50;

  constructor(env: any) {
    // Use a global lock coordinator Durable Object
    const lockId = env.DISTRIBUTED_LOCK?.idFromName('global-lock-coordinator');
    this.lockStub = env.DISTRIBUTED_LOCK?.get(lockId);
  }

  // =================== Public Lock API ===================

  /**
   * Acquire a distributed lock
   * @param resource Resource identifier to lock
   * @param options Lock acquisition options
   * @returns Lock ID if successful
   */
  async acquireLock(resource: string, options: LockAcquisitionOptions = {}): Promise<string> {
    const {
      ttl = this.DEFAULT_TTL,
      timeout = this.DEFAULT_TIMEOUT,
      retryInterval = this.DEFAULT_RETRY_INTERVAL,
      maxRetries = this.MAX_RETRIES
    } = options;

    const lockId = this.generateLockId();
    const startTime = Date.now();

    // Validate inputs
    this.validateLockRequest(resource, ttl, timeout);

    console.log(`🔒 [DistributedLockService] Attempting to acquire lock for resource: ${resource}`);

    try {
      // Try to acquire lock through coordinator
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/acquire', {
        method: 'POST',
        body: JSON.stringify({
          lockId,
          resource,
          ttl,
          timeout,
          retryInterval,
          maxRetries,
          requesterId: this.getRequesterId(),
          timestamp: Date.now()
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(`Lock acquisition failed: ${error.message || 'Unknown error'}`);
      }

      const result = await response.json() as any;
      const acquisitionTime = Date.now() - startTime;

      console.log(`✅ [DistributedLockService] Lock acquired: ${lockId} for ${resource} (${acquisitionTime}ms)`);

      return result.lockId;

    } catch (error) {
      const acquisitionTime = Date.now() - startTime;
      console.error(`❌ [DistributedLockService] Lock acquisition failed for ${resource} after ${acquisitionTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Release a distributed lock
   * @param lockId Lock ID to release
   */
  async releaseLock(lockId: string): Promise<void> {
    if (!lockId) {
      console.warn('⚠️ [DistributedLockService] Attempted to release undefined lock ID');
      return;
    }

    console.log(`🔓 [DistributedLockService] Releasing lock: ${lockId}`);

    try {
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/release', {
        method: 'POST',
        body: JSON.stringify({
          lockId,
          requesterId: this.getRequesterId(),
          timestamp: Date.now()
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (!response.ok) {
        const error = await response.json() as any;
        console.warn(`⚠️ [DistributedLockService] Lock release warning: ${error.message}`);
      } else {
        console.log(`✅ [DistributedLockService] Lock released: ${lockId}`);
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Lock release error for ${lockId}:`, error);
      // Don't throw - release failures should not crash the application
    }
  }

  /**
   * Try to acquire lock without waiting/retrying
   * @param resource Resource identifier
   * @param ttl Lock time-to-live in milliseconds
   * @returns Lock ID if successful, null if lock not available
   */
  async tryLock(resource: string, ttl: number = this.DEFAULT_TTL): Promise<string | null> {
    const lockId = this.generateLockId();

    console.log(`🔒 [DistributedLockService] Trying to acquire lock for resource: ${resource}`);

    try {
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/try-acquire', {
        method: 'POST',
        body: JSON.stringify({
          lockId,
          resource,
          ttl,
          requesterId: this.getRequesterId(),
          timestamp: Date.now()
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as any;
        console.log(`✅ [DistributedLockService] Lock acquired immediately: ${result.lockId}`);
        return result.lockId;
      } else if (response.status === 423) { // Locked
        console.log(`🔒 [DistributedLockService] Resource ${resource} is already locked`);
        return null;
      } else {
        const error = await response.json() as any;
        throw new Error(`Try lock failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Try lock error for ${resource}:`, error);
      throw error;
    }
  }

  /**
   * Check if a resource is currently locked
   * @param resource Resource identifier
   * @returns True if locked, false otherwise
   */
  async isLocked(resource: string): Promise<boolean> {
    try {
      const response = await this.lockStub.fetch(new Request(`https://lock-coordinator/status/${encodeURIComponent(resource)}`, {
        method: 'GET'
      }));

      if (response.ok) {
        const result = await response.json() as any;
        return result.isLocked;
      } else {
        console.warn(`⚠️ [DistributedLockService] Error checking lock status for ${resource}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Error checking if ${resource} is locked:`, error);
      return false;
    }
  }

  /**
   * Get information about a specific lock
   * @param lockId Lock ID
   * @returns Lock information or null if not found
   */
  async getLockInfo(lockId: string): Promise<DistributedLock | null> {
    try {
      const response = await this.lockStub.fetch(new Request(`https://lock-coordinator/info/${encodeURIComponent(lockId)}`, {
        method: 'GET'
      }));

      if (response.ok) {
        const result = await response.json() as any;
        return result.lock;
      } else if (response.status === 404) {
        return null;
      } else {
        const error = await response.json() as any;
        throw new Error(`Get lock info failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Error getting lock info for ${lockId}:`, error);
      return null;
    }
  }

  /**
   * Extend the TTL of an existing lock
   * @param lockId Lock ID
   * @param additionalTtl Additional time in milliseconds
   * @returns New expiration time
   */
  async extendLock(lockId: string, additionalTtl: number): Promise<number> {
    console.log(`⏰ [DistributedLockService] Extending lock ${lockId} by ${additionalTtl}ms`);

    try {
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/extend', {
        method: 'POST',
        body: JSON.stringify({
          lockId,
          additionalTtl,
          requesterId: this.getRequesterId(),
          timestamp: Date.now()
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as any;
        console.log(`✅ [DistributedLockService] Lock extended: ${lockId}, new expiry: ${result.expiresAt}`);
        return result.expiresAt;
      } else {
        const error = await response.json() as any;
        throw new Error(`Lock extension failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Error extending lock ${lockId}:`, error);
      throw error;
    }
  }

  // =================== Lock Utilities ===================

  /**
   * Execute a function with a distributed lock
   * @param resource Resource to lock
   * @param fn Function to execute while holding the lock
   * @param options Lock options
   * @returns Result of the function execution
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    options: LockAcquisitionOptions = {}
  ): Promise<T> {
    const lockId = await this.acquireLock(resource, options);

    try {
      console.log(`🔄 [DistributedLockService] Executing function with lock: ${lockId}`);
      const result = await fn();
      console.log(`✅ [DistributedLockService] Function completed with lock: ${lockId}`);
      return result;
    } finally {
      await this.releaseLock(lockId);
    }
  }

  /**
   * Execute a function with a distributed lock, with timeout
   * @param resource Resource to lock
   * @param fn Function to execute while holding the lock
   * @param executionTimeout Maximum execution time for the function
   * @param options Lock options
   * @returns Result of the function execution
   */
  async withLockTimeout<T>(
    resource: string,
    fn: () => Promise<T>,
    executionTimeout: number,
    options: LockAcquisitionOptions = {}
  ): Promise<T> {
    const lockId = await this.acquireLock(resource, options);

    try {
      console.log(`🔄 [DistributedLockService] Executing function with lock and timeout: ${lockId}`);

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Function execution timeout (${executionTimeout}ms) exceeded`));
        }, executionTimeout);
      });

      // Race between function execution and timeout
      const result = await Promise.race([fn(), timeoutPromise]);

      console.log(`✅ [DistributedLockService] Function completed with lock: ${lockId}`);
      return result;
    } finally {
      await this.releaseLock(lockId);
    }
  }

  // =================== Lock Management ===================

  /**
   * Get all active locks (for monitoring/debugging)
   * @returns Array of active locks
   */
  async getActiveLocks(): Promise<DistributedLock[]> {
    try {
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/active-locks', {
        method: 'GET'
      }));

      if (response.ok) {
        const result = await response.json() as any;
        return result.locks;
      } else {
        const error = await response.json() as any;
        throw new Error(`Get active locks failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Error getting active locks:`, error);
      return [];
    }
  }

  /**
   * Force release all expired locks (cleanup operation)
   * @returns Number of locks cleaned up
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/cleanup', {
        method: 'POST',
        body: JSON.stringify({
          requesterId: this.getRequesterId(),
          timestamp: Date.now()
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      if (response.ok) {
        const result = await response.json() as any;
        console.log(`🧹 [DistributedLockService] Cleaned up ${result.cleanedCount} expired locks`);
        return result.cleanedCount;
      } else {
        const error = await response.json() as any;
        throw new Error(`Cleanup failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Error during cleanup:`, error);
      return 0;
    }
  }

  /**
   * Get lock statistics and metrics
   * @returns Lock system metrics
   */
  async getLockMetrics(): Promise<{
    totalLocks: number;
    activeLocks: number;
    expiredLocks: number;
    averageLockDuration: number;
    lockAcquisitionRate: number;
    lockContentionRate: number;
  }> {
    try {
      const response = await this.lockStub.fetch(new Request('https://lock-coordinator/metrics', {
        method: 'GET'
      }));

      if (response.ok) {
        const metrics = await response.json();
        return metrics as { totalLocks: number; activeLocks: number; expiredLocks: number; averageLockDuration: number; lockAcquisitionRate: number; lockContentionRate: number; };
      } else {
        throw new Error('Failed to get lock metrics');
      }

    } catch (error) {
      console.error(`❌ [DistributedLockService] Error getting lock metrics:`, error);
      return {
        totalLocks: 0,
        activeLocks: 0,
        expiredLocks: 0,
        averageLockDuration: 0,
        lockAcquisitionRate: 0,
        lockContentionRate: 0
      };
    }
  }

  // =================== Helper Methods ===================

  private validateLockRequest(resource: string, ttl: number, timeout: number): void {
    if (!resource || resource.trim() === '') {
      throw new Error('Resource identifier cannot be empty');
    }

    if (ttl <= 0 || ttl > 600000) { // Max 10 minutes
      throw new Error('TTL must be between 1ms and 600000ms (10 minutes)');
    }

    if (timeout <= 0 || timeout > 300000) { // Max 5 minutes
      throw new Error('Timeout must be between 1ms and 300000ms (5 minutes)');
    }

    if (ttl < timeout) {
      console.warn(`⚠️ [DistributedLockService] TTL (${ttl}ms) is less than timeout (${timeout}ms)`);
    }
  }

  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getRequesterId(): string {
    // In a real implementation, this would identify the requesting Durable Object or Worker
    // For now, use a combination of timestamp and random string
    return `requester_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }
}

// =================== Lock Coordinator Durable Object ===================

/**
 * LockCoordinator Durable Object
 * This is the central coordinator for all distributed locks
 * It maintains the global lock state and handles all lock operations
 */
export class LockCoordinator implements DurableObject {
  private state: DurableObjectState;

  // Lock storage
  private activeLocks = new Map<string, DistributedLock>(); // lockId -> lock
  private resourceLocks = new Map<string, string>(); // resource -> lockId

  // Metrics
  private metrics = {
    totalLocks: 0,
    totalAcquisitions: 0,
    totalReleases: 0,
    totalTimeouts: 0,
    totalContention: 0,
    averageLockDuration: 0,
    lockAcquisitionRate: 0,
    lastCleanup: Date.now()
  };

  constructor(state: DurableObjectState, _env: any) {
    this.state = state;

    // Initialize from storage
    this.initializeFromStorage();

    // Set up cleanup tasks
    this.setupCleanupTasks();
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      switch (pathname) {
        case '/acquire':
          return this.handleAcquireLock(request);
        case '/try-acquire':
          return this.handleTryAcquireLock(request);
        case '/release':
          return this.handleReleaseLock(request);
        case '/extend':
          return this.handleExtendLock(request);
        case '/cleanup':
          return this.handleCleanup(request);
        case '/active-locks':
          return this.handleGetActiveLocks(request);
        case '/metrics':
          return this.handleGetMetrics(request);
        default:
          if (pathname.startsWith('/status/')) {
            return this.handleGetLockStatus(request);
          } else if (pathname.startsWith('/info/')) {
            return this.handleGetLockInfo(request);
          }
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('❌ [LockCoordinator] Request handling error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  private async handleAcquireLock(request: Request): Promise<Response> {
    const requestData = await request.json() as {
      lockId: string;
      resource: string;
      ttl?: number;
      timeout?: number;
      retryInterval?: number;
      maxRetries?: number;
      requesterId: string;
    };
    const { lockId, resource, ttl, timeout, retryInterval, maxRetries, requesterId } = requestData;

    try {
      const lock = await this.acquireLockInternal(
        lockId,
        resource,
        ttl || 30000,
        requesterId,
        timeout || 5000,
        retryInterval || 100,
        maxRetries || 50
      );
      return new Response(JSON.stringify({ success: true, lockId: lock.lockId }));
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), { status: 423 });
    }
  }

  private async handleTryAcquireLock(request: Request): Promise<Response> {
    const requestData = await request.json() as {
      lockId: string;
      resource: string;
      ttl?: number;
      requesterId: string;
    };
    const { lockId, resource, ttl, requesterId } = requestData;

    try {
      const lock = await this.tryAcquireLockInternal(lockId, resource, ttl || 30000, requesterId);
      if (lock) {
        return new Response(JSON.stringify({ success: true, lockId: lock.lockId }));
      } else {
        return new Response(JSON.stringify({ error: 'Resource is locked' }), { status: 423 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
    }
  }

  private async handleReleaseLock(request: Request): Promise<Response> {
    const requestData = await request.json() as {
      lockId: string;
      requesterId: string;
    };
    const { lockId, requesterId } = requestData;

    try {
      const success = await this.releaseLockInternal(lockId, requesterId);
      if (success) {
        return new Response(JSON.stringify({ success: true }));
      } else {
        return new Response(JSON.stringify({ error: 'Lock not found or not owned by requester' }), { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
    }
  }

  private async acquireLockInternal(
    lockId: string,
    resource: string,
    ttl: number,
    requesterId: string,
    timeout: number,
    retryInterval: number,
    maxRetries: number
  ): Promise<DistributedLock> {
    const startTime = Date.now();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check if we can acquire the lock
      const existingLockId = this.resourceLocks.get(resource);
      const existingLock = existingLockId ? this.activeLocks.get(existingLockId) : null;

      if (!existingLock || existingLock.expiresAt < Date.now()) {
        // Lock is available or expired
        if (existingLock) {
          await this.releaseLockInternal(existingLock.lockId, existingLock.ownerId);
        }

        const lock: DistributedLock = {
          lockId,
          resource,
          ownerId: requesterId,
          acquiredAt: Date.now(),
          expiresAt: Date.now() + ttl,
          isActive: true,
          metadata: { attempts: attempt + 1, acquisitionTime: Date.now() - startTime }
        };

        this.activeLocks.set(lockId, lock);
        this.resourceLocks.set(resource, lockId);

        // Update metrics
        this.metrics.totalLocks++;
        this.metrics.totalAcquisitions++;

        // Persist state
        await this.persistLockState();

        return lock;
      }

      // Lock is held, check timeout
      if (Date.now() - startTime > timeout) {
        this.metrics.totalTimeouts++;
        throw new Error(`Lock acquisition timeout after ${timeout}ms`);
      }

      // Wait before retry
      await this.sleep(retryInterval);
      this.metrics.totalContention++;
    }

    throw new Error(`Failed to acquire lock after ${maxRetries} attempts`);
  }

  private async tryAcquireLockInternal(
    lockId: string,
    resource: string,
    ttl: number,
    requesterId: string
  ): Promise<DistributedLock | null> {
    const existingLockId = this.resourceLocks.get(resource);
    const existingLock = existingLockId ? this.activeLocks.get(existingLockId) : null;

    if (existingLock && existingLock.expiresAt > Date.now()) {
      return null; // Lock is held
    }

    // Clean up expired lock if any
    if (existingLock) {
      await this.releaseLockInternal(existingLock.lockId, existingLock.ownerId);
    }

    const lock: DistributedLock = {
      lockId,
      resource,
      ownerId: requesterId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + ttl,
      isActive: true
    };

    this.activeLocks.set(lockId, lock);
    this.resourceLocks.set(resource, lockId);

    // Update metrics
    this.metrics.totalLocks++;
    this.metrics.totalAcquisitions++;

    // Persist state
    await this.persistLockState();

    return lock;
  }

  private async releaseLockInternal(lockId: string, requesterId: string): Promise<boolean> {
    const lock = this.activeLocks.get(lockId);

    if (!lock) {
      return false;
    }

    if (lock.ownerId !== requesterId) {
      console.warn(`⚠️ [LockCoordinator] Lock release attempted by non-owner: ${requesterId} vs ${lock.ownerId}`);
      return false;
    }

    // Remove lock
    this.activeLocks.delete(lockId);
    this.resourceLocks.delete(lock.resource);

    // Update metrics
    this.metrics.totalReleases++;
    const lockDuration = Date.now() - lock.acquiredAt;
    this.metrics.averageLockDuration = (this.metrics.averageLockDuration + lockDuration) / 2;

    // Persist state
    await this.persistLockState();

    return true;
  }

  private async handleExtendLock(request: Request): Promise<Response> {
    const requestData = await request.json() as {
      lockId: string;
      additionalTtl: number;
      requesterId: string;
    };
    const { lockId, additionalTtl, requesterId } = requestData;

    const lock = this.activeLocks.get(lockId);
    if (!lock || lock.ownerId !== requesterId) {
      return new Response(JSON.stringify({ error: 'Lock not found or not owned' }), { status: 404 });
    }

    lock.expiresAt += additionalTtl;
    await this.persistLockState();

    return new Response(JSON.stringify({ success: true, expiresAt: lock.expiresAt }));
  }

  private async handleGetLockStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const resource = decodeURIComponent(url.pathname.split('/').pop() || '');

    const lockId = this.resourceLocks.get(resource);
    const lock = lockId ? this.activeLocks.get(lockId) : null;
    const isLocked = !!(lock && lock.expiresAt > Date.now());

    return new Response(JSON.stringify({ isLocked, resource }));
  }

  private async handleGetLockInfo(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const lockId = decodeURIComponent(url.pathname.split('/').pop() || '');

    const lock = this.activeLocks.get(lockId);
    if (lock) {
      return new Response(JSON.stringify({ lock }));
    } else {
      return new Response(JSON.stringify({ error: 'Lock not found' }), { status: 404 });
    }
  }

  private async handleGetActiveLocks(_request: Request): Promise<Response> {
    const locks = Array.from(this.activeLocks.values());
    return new Response(JSON.stringify({ locks }));
  }

  private async handleGetMetrics(_request: Request): Promise<Response> {
    const currentTime = Date.now();

    this.metrics.lockAcquisitionRate = this.metrics.totalAcquisitions / ((currentTime - this.metrics.lastCleanup) / 1000);

    return new Response(JSON.stringify({
      ...this.metrics,
      activeLocks: this.activeLocks.size,
      expiredLocks: Array.from(this.activeLocks.values()).filter(lock => lock.expiresAt < currentTime).length
    }));
  }

  private async handleCleanup(_request: Request): Promise<Response> {
    const cleanedCount = await this.cleanupExpiredLocks();
    return new Response(JSON.stringify({ cleanedCount }));
  }

  private async cleanupExpiredLocks(): Promise<number> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [lockId, lock] of this.activeLocks) {
      if (lock.expiresAt < now) {
        this.activeLocks.delete(lockId);
        this.resourceLocks.delete(lock.resource);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await this.persistLockState();
      console.log(`🧹 [LockCoordinator] Cleaned up ${cleanedCount} expired locks`);
    }

    this.metrics.lastCleanup = now;
    return cleanedCount;
  }

  private setupCleanupTasks(): void {
    // Clean up expired locks every minute
    setInterval(async () => {
      await this.cleanupExpiredLocks();
    }, 60000);
  }

  private async persistLockState(): Promise<void> {
    try {
      await Promise.all([
        this.state.storage.put('activeLocks', Array.from(this.activeLocks.entries())),
        this.state.storage.put('resourceLocks', Array.from(this.resourceLocks.entries())),
        this.state.storage.put('metrics', this.metrics)
      ]);
    } catch (error) {
      console.error('❌ [LockCoordinator] Error persisting lock state:', error);
    }
  }

  private async initializeFromStorage(): Promise<void> {
    try {
      const activeLocks = await this.state.storage.get('activeLocks') as [string, DistributedLock][];
      if (activeLocks) {
        this.activeLocks = new Map(activeLocks);
      }

      const resourceLocks = await this.state.storage.get('resourceLocks') as [string, string][];
      if (resourceLocks) {
        this.resourceLocks = new Map(resourceLocks);
      }

      const metrics = await this.state.storage.get('metrics') as any;
      if (metrics) {
        this.metrics = { ...this.metrics, ...metrics };
      }

      console.log(`📂 [LockCoordinator] State restored: ${this.activeLocks.size} active locks`);
    } catch (error) {
      console.error('❌ [LockCoordinator] State restoration error:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}