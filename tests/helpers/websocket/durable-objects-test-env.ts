// Durable Objects Test Environment Setup
// Provides mock environment for testing Durable Objects locally
// Simulates Cloudflare Workers runtime environment

import type { DurableObjectState, DurableObjectNamespace } from '@cloudflare/workers-types';
import type {
  WebSocketConnection,
  WebSocketMessage,
  DurableObjectEvent,
  DistributedLock,
  MigrationConfig
} from '../../../src/types/websocket-types';

/**
 * Mock DurableObjectState for testing
 */
export class MockDurableObjectState implements DurableObjectState {
  private storage: Map<string, any> = new Map();
  private transactionDepth = 0;
  private transactionChanges: Map<string, any> = new Map();

  constructor(public id: DurableObjectId) {}

  // Storage operations
  get storage(): DurableObjectStorage {
    return {
      get: async (key: string) => {
        if (this.transactionDepth > 0) {
          if (this.transactionChanges.has(key)) {
            return this.transactionChanges.get(key);
          }
        }
        return this.storage.get(key);
      },

      get: async (keys: string[]) => {
        const result = new Map<string, any>();
        for (const key of keys) {
          const value = this.transactionDepth > 0 && this.transactionChanges.has(key)
            ? this.transactionChanges.get(key)
            : this.storage.get(key);
          if (value !== undefined) {
            result.set(key, value);
          }
        }
        return result;
      },

      list: async (options?: { start?: string; end?: string; prefix?: string; reverse?: boolean; limit?: number }) => {
        let entries = Array.from(this.storage.entries());

        // Apply transaction changes
        if (this.transactionDepth > 0) {
          for (const [key, value] of this.transactionChanges) {
            const index = entries.findIndex(([k]) => k === key);
            if (index >= 0) {
              if (value === undefined) {
                entries.splice(index, 1);
              } else {
                entries[index] = [key, value];
              }
            } else if (value !== undefined) {
              entries.push([key, value]);
            }
          }
        }

        // Apply filters
        if (options?.prefix) {
          entries = entries.filter(([key]) => key.startsWith(options.prefix!));
        }
        if (options?.start) {
          entries = entries.filter(([key]) => key >= options.start!);
        }
        if (options?.end) {
          entries = entries.filter(([key]) => key <= options.end!);
        }

        // Sort
        entries.sort(([a], [b]) => a.localeCompare(b));
        if (options?.reverse) {
          entries.reverse();
        }

        // Limit
        if (options?.limit) {
          entries = entries.slice(0, options.limit);
        }

        return new Map(entries);
      },

      put: async (key: string, value: any) => {
        if (this.transactionDepth > 0) {
          this.transactionChanges.set(key, value);
        } else {
          this.storage.set(key, value);
        }
      },

      put: async (entries: Record<string, any>) => {
        for (const [key, value] of Object.entries(entries)) {
          if (this.transactionDepth > 0) {
            this.transactionChanges.set(key, value);
          } else {
            this.storage.set(key, value);
          }
        }
      },

      delete: async (key: string) => {
        if (this.transactionDepth > 0) {
          this.transactionChanges.set(key, undefined);
        } else {
          this.storage.delete(key);
          return true;
        }
        return true;
      },

      delete: async (keys: string[]) => {
        let deletedCount = 0;
        for (const key of keys) {
          if (this.transactionDepth > 0) {
            this.transactionChanges.set(key, undefined);
            deletedCount++;
          } else {
            if (this.storage.delete(key)) {
              deletedCount++;
            }
          }
        }
        return deletedCount;
      },

      deleteAll: async () => {
        if (this.transactionDepth > 0) {
          for (const key of this.storage.keys()) {
            this.transactionChanges.set(key, undefined);
          }
        } else {
          this.storage.clear();
        }
      },

      transaction: async <T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T> => {
        this.transactionDepth++;
        this.transactionChanges.clear();

        try {
          const result = await closure({
            get: this.storage.get.bind(this),
            list: this.storage.list.bind(this),
            put: this.storage.put.bind(this),
            delete: this.storage.delete.bind(this),
            deleteAll: this.storage.deleteAll.bind(this),
            rollback: () => {
              throw new Error('Transaction rolled back');
            }
          } as any);

          // Commit transaction changes
          for (const [key, value] of this.transactionChanges) {
            if (value === undefined) {
              this.storage.delete(key);
            } else {
              this.storage.set(key, value);
            }
          }

          return result;
        } catch (error) {
          // Rollback - discard transaction changes
          this.transactionChanges.clear();
          throw error;
        } finally {
          this.transactionDepth--;
          if (this.transactionDepth === 0) {
            this.transactionChanges.clear();
          }
        }
      }
    } as any;
  }

  // Hibernation API (simplified for testing)
  waitUntil(promise: Promise<any>): void {
    // In tests, we can just await the promise synchronously
    promise.catch(console.error);
  }

  // Input/Output gating (simplified for testing)
  acceptWebSocket(webSocket: WebSocket): void {
    // Mock implementation
  }

  getWebSockets(tag?: string): WebSocket[] {
    // Mock implementation
    return [];
  }

  setWebSocketAutoResponse(maybeReqResp?: WebSocketRequestResponsePair): void {
    // Mock implementation
  }

  getHibernatableWebSockets(tag?: string): HibernatableWebSocket[] {
    // Mock implementation
    return [];
  }

  setHibernatableWebSocketEventTimeout(timeoutMs?: number): void {
    // Mock implementation
  }

  getTags(ws: WebSocket): string[] {
    // Mock implementation
    return [];
  }

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  // ID generation
  newUniqueId(): DurableObjectId {
    return new MockDurableObjectId();
  }
}

/**
 * Mock DurableObjectId
 */
export class MockDurableObjectId implements DurableObjectId {
  public name?: string;

  constructor(name?: string) {
    this.name = name;
  }

  toString(): string {
    return this.name || `mock_id_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  equals(other: DurableObjectId): boolean {
    return this.toString() === other.toString();
  }
}

/**
 * Mock DurableObject Namespace
 */
export class MockDurableObjectNamespace implements DurableObjectNamespace {
  private objects: Map<string, any> = new Map();
  private ObjectClass: any;

  constructor(ObjectClass: any) {
    this.ObjectClass = ObjectClass;
  }

  idFromName(name: string): DurableObjectId {
    return new MockDurableObjectId(name);
  }

  idFromString(id: string): DurableObjectId {
    return new MockDurableObjectId(id);
  }

  newUniqueId(): DurableObjectId {
    return new MockDurableObjectId();
  }

  get(id: DurableObjectId): DurableObjectStub {
    const idString = id.toString();

    if (!this.objects.has(idString)) {
      const state = new MockDurableObjectState(id);
      const obj = new this.ObjectClass(state, this.createMockEnv());
      this.objects.set(idString, obj);
    }

    const obj = this.objects.get(idString);

    return {
      fetch: (request: Request | string, init?: RequestInit) => {
        if (typeof request === 'string') {
          request = new Request(request, init);
        }
        return obj.fetch(request);
      },
      id
    };
  }

  private createMockEnv(): any {
    return {
      conversationId: 'test_conversation',
      // Add other environment variables as needed
    };
  }
}

/**
 * Mock WebSocket for testing
 */
export class MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public readyState: number = MockWebSocket.CONNECTING;
  public url: string = '';
  public protocol: string = '';
  public extensions: string = '';
  public binaryType: 'blob' | 'arraybuffer' = 'blob';

  private eventListeners: Map<string, Function[]> = new Map();
  private messageQueue: string[] = [];

  constructor(url?: string) {
    this.url = url || '';
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open', new Event('open'));
    }, 0);
  }

  // Event handling
  addEventListener(type: string, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(type: string, event: Event): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  // Message handling
  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.messageQueue.push(typeof data === 'string' ? data : data.toString());
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED || this.readyState === MockWebSocket.CLOSING) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }, 0);
  }

  // Simulate receiving a message
  simulateMessage(data: string): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.emit('message', new MessageEvent('message', { data }));
    }
  }

  // Simulate error
  simulateError(error: any): void {
    this.emit('error', new ErrorEvent('error', { error }));
  }

  // Get sent messages for testing
  getSentMessages(): string[] {
    return [...this.messageQueue];
  }

  // Clear message queue
  clearMessages(): void {
    this.messageQueue = [];
  }

  // WebSocket properties
  get bufferedAmount(): number {
    return this.messageQueue.reduce((total, msg) => total + msg.length, 0);
  }

  // Event handlers (can be set directly)
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
}

/**
 * Mock WebSocketPair for testing
 */
export class MockWebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;

  constructor() {
    this.0 = new MockWebSocket('ws://test-client');
    this.1 = new MockWebSocket('ws://test-server');

    // Connect the pair
    this.0.send = (data: string | ArrayBuffer | Blob) => {
      const message = typeof data === 'string' ? data : data.toString();
      setTimeout(() => this.1.simulateMessage(message), 0);
    };

    this.1.send = (data: string | ArrayBuffer | Blob) => {
      const message = typeof data === 'string' ? data : data.toString();
      setTimeout(() => this.0.simulateMessage(message), 0);
    };
  }
}

/**
 * Test Environment Factory
 */
export class DurableObjectsTestEnvironment {
  private namespaces: Map<string, MockDurableObjectNamespace> = new Map();
  private globalBindings: Map<string, any> = new Map();

  /**
   * Register Durable Object class
   */
  registerDurableObject(name: string, ObjectClass: any): void {
    this.namespaces.set(name, new MockDurableObjectNamespace(ObjectClass));
  }

  /**
   * Get Durable Object namespace
   */
  getNamespace(name: string): MockDurableObjectNamespace {
    const namespace = this.namespaces.get(name);
    if (!namespace) {
      throw new Error(`Durable Object namespace '${name}' not registered`);
    }
    return namespace;
  }

  /**
   * Set global binding
   */
  setBinding(name: string, value: any): void {
    this.globalBindings.set(name, value);
  }

  /**
   * Get mock environment bindings
   */
  getBindings(): any {
    const bindings: any = {};

    // Add Durable Object namespaces
    for (const [name, namespace] of this.namespaces) {
      bindings[name] = namespace;
    }

    // Add global bindings
    for (const [name, value] of this.globalBindings) {
      bindings[name] = value;
    }

    return bindings;
  }

  /**
   * Create WebSocketPair for testing
   */
  createWebSocketPair(): { 0: MockWebSocket; 1: MockWebSocket } {
    return new MockWebSocketPair();
  }

  /**
   * Reset all test data
   */
  reset(): void {
    this.namespaces.clear();
    this.globalBindings.clear();
  }

  /**
   * Create test configuration
   */
  createTestConfig(): {
    env: any;
    WebSocketPair: typeof MockWebSocketPair;
  } {
    return {
      env: this.getBindings(),
      WebSocketPair: MockWebSocketPair
    };
  }
}

/**
 * Test utilities for performance monitoring
 */
export class TestPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  /**
   * End timing an operation
   */
  endTimer(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      throw new Error(`Timer not started for operation: ${operation}`);
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);

    return duration;
  }

  /**
   * Get performance metrics
   */
  getMetrics(operation: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    total: number;
    p95: number;
    p99: number;
  } {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        total: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const total = times.reduce((sum, time) => sum + time, 0);

    return {
      count: times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: total / times.length,
      total,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const operation of this.metrics.keys()) {
      result[operation] = this.getMetrics(operation);
    }
    return result;
  }
}

// Global test environment instance
export const testEnv = new DurableObjectsTestEnvironment();