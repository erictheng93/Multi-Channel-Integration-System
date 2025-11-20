/**
 * Mock Factory - Standardized Mock Creation
 *
 * Provides factory functions for creating consistent, type-safe mocks
 * across all tests in the project.
 *
 * @module tests/helpers/mockFactory
 */

import { vi } from 'vitest';
import type { Bindings } from '@/types';
import type { JWTPayload } from '@/types/auth';

// ======================== Database Mocks ========================

/**
 * Create a standard Drizzle ORM mock database
 *
 * @param returnData - Default data to return from queries
 * @returns Mock database instance compatible with Drizzle ORM
 *
 * @example
 * ```typescript
 * const mockDb = MockFactory.createDatabase([
 *   { id: 1, name: 'Test User', role: 'admin' }
 * ]);
 * ```
 */
export function createMockDatabase(returnData: any[] = []) {
  const mockSelect = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue(returnData),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    fullJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(returnData),
    get: vi.fn().mockResolvedValue(returnData[0] || null),
  };

  return {
    // SELECT operations
    select: vi.fn().mockReturnValue(mockSelect),

    // INSERT operations
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1, ...returnData[0] }]),
        execute: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
      })
    }),

    // UPDATE operations
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(returnData),
          execute: vi.fn().mockResolvedValue(undefined)
        })
      })
    }),

    // DELETE operations
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnData),
        execute: vi.fn().mockResolvedValue(undefined)
      })
    }),

    // Transaction support
    transaction: vi.fn().mockImplementation(async (callback) => {
      return await callback(mockSelect);
    }),

    // Raw SQL support
    run: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 }),
    all: vi.fn().mockResolvedValue(returnData),
    get: vi.fn().mockResolvedValue(returnData[0] || null),
  };
}

/**
 * Create a D1 Database mock (Cloudflare's SQLite)
 *
 * @param mockResults - Data to return from queries
 * @returns Mock D1 database instance
 */
export function createMockD1(mockResults: any[] = []) {
  return {
    prepare: vi.fn((query: string) => ({
      bind: vi.fn((...args: any[]) => ({
        all: vi.fn().mockResolvedValue({
          results: mockResults,
          success: true,
          meta: {}
        }),
        first: vi.fn().mockResolvedValue(mockResults[0] || null),
        run: vi.fn().mockResolvedValue({
          success: true,
          meta: { changes: 1, last_row_id: 1 }
        }),
        raw: vi.fn().mockResolvedValue(mockResults.map(Object.values))
      })),
      all: vi.fn().mockResolvedValue({ results: mockResults, success: true }),
      first: vi.fn().mockResolvedValue(mockResults[0] || null),
      run: vi.fn().mockResolvedValue({ success: true }),
      raw: vi.fn().mockResolvedValue(mockResults.map(Object.values))
    })),
    batch: vi.fn().mockResolvedValue([{ success: true }]),
    exec: vi.fn().mockResolvedValue({ success: true }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  };
}

// ======================== Cloudflare Bindings Mocks ========================

/**
 * Create a KV Namespace mock
 *
 * @param initialData - Initial key-value pairs
 * @returns Mock KV namespace instance
 */
export function createMockKV(initialData: Record<string, string> = {}) {
  const storage = new Map<string, string>(Object.entries(initialData));

  return {
    get: vi.fn(async (key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }) => {
      const value = storage.get(key);
      if (!value) return null;

      if (options?.type === 'json') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    }),

    put: vi.fn(async (key: string, value: string, options?: any) => {
      storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }),

    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),

    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys = Array.from(storage.keys());
      const filteredKeys = options?.prefix
        ? keys.filter(k => k.startsWith(options.prefix!))
        : keys;

      return {
        keys: filteredKeys.map(name => ({ name })),
        list_complete: true,
        cursor: ''
      };
    }),

    getWithMetadata: vi.fn(async (key: string) => {
      const value = storage.get(key);
      return {
        value: value || null,
        metadata: null
      };
    }),
  };
}

/**
 * Create an R2 Bucket mock
 *
 * @param initialFiles - Initial files as key-value pairs
 * @returns Mock R2 bucket instance
 */
export function createMockR2(initialFiles: Record<string, Buffer | string> = {}) {
  const storage = new Map<string, Buffer>();

  // Initialize with provided files
  for (const [key, value] of Object.entries(initialFiles)) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    storage.set(key, buffer);
  }

  return {
    get: vi.fn(async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;

      return {
        body: data,
        bodyUsed: false,
        arrayBuffer: async () => data.buffer,
        text: async () => data.toString(),
        json: async () => JSON.parse(data.toString()),
        blob: async () => new Blob([data]),
      };
    }),

    put: vi.fn(async (key: string, value: Buffer | string | ReadableStream, options?: any) => {
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value as string);
      storage.set(key, buffer);

      return {
        key,
        version: 'test-version',
        size: buffer.length,
        etag: 'test-etag',
        httpEtag: 'test-http-etag',
        uploaded: new Date(),
        httpMetadata: options?.httpMetadata || {},
        customMetadata: options?.customMetadata || {}
      };
    }),

    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),

    list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
      const keys = Array.from(storage.keys());
      const filteredKeys = options?.prefix
        ? keys.filter(k => k.startsWith(options.prefix!))
        : keys;

      const limitedKeys = options?.limit
        ? filteredKeys.slice(0, options.limit)
        : filteredKeys;

      return {
        objects: limitedKeys.map(key => ({
          key,
          version: 'test-version',
          size: storage.get(key)?.length || 0,
          etag: 'test-etag',
          httpEtag: 'test-http-etag',
          uploaded: new Date(),
        })),
        truncated: limitedKeys.length < filteredKeys.length,
        cursor: limitedKeys.length < filteredKeys.length ? 'next-page' : undefined
      };
    }),

    head: vi.fn(async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;

      return {
        key,
        version: 'test-version',
        size: data.length,
        etag: 'test-etag',
        httpEtag: 'test-http-etag',
        uploaded: new Date(),
      };
    }),
  };
}

/**
 * Mock Durable Object ID
 */
export class MockDurableObjectId {
  constructor(public name: string) {}

  toString(): string {
    return this.name;
  }

  equals(other: MockDurableObjectId): boolean {
    return this.name === other.name;
  }
}

/**
 * Mock Durable Object State
 */
export class MockDurableObjectState {
  private _storage: Map<string, any> = new Map();

  constructor(public id: MockDurableObjectId) {}

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      console.error('blockConcurrencyWhile error:', error);
      throw error;
    }
  }

  get storage() {
    return {
      get: async <T = any>(key: string): Promise<T | undefined> => {
        return this._storage.get(key) as T | undefined;
      },

      put: async <T = any>(key: string, value: T): Promise<void> => {
        this._storage.set(key, value);
      },

      delete: async (key: string): Promise<boolean> => {
        return this._storage.delete(key);
      },

      list: async <T = any>(options?: { prefix?: string }): Promise<Map<string, T>> => {
        if (!options?.prefix) {
          return new Map(this._storage);
        }

        const filtered = new Map<string, T>();
        for (const [key, value] of this._storage.entries()) {
          if (key.startsWith(options.prefix)) {
            filtered.set(key, value);
          }
        }
        return filtered;
      },

      deleteAll: async (): Promise<void> => {
        this._storage.clear();
      },

      getAlarm: async (): Promise<number | null> => {
        return this._storage.get('__alarm__') || null;
      },

      setAlarm: async (scheduledTime: number): Promise<void> => {
        this._storage.set('__alarm__', scheduledTime);
      },

      deleteAlarm: async (): Promise<void> => {
        this._storage.delete('__alarm__');
      },
    };
  }
}

/**
 * Create a Durable Object Namespace mock
 *
 * @param objectClass - The Durable Object class (optional)
 * @returns Mock Durable Object namespace
 */
export function createMockDurableObjectNamespace(objectClass?: any) {
  const instances = new Map<string, any>();

  return {
    newUniqueId: vi.fn((options?: { jurisdiction?: string }) => {
      return new MockDurableObjectId(`test-id-${Date.now()}`);
    }),

    idFromName: vi.fn((name: string) => {
      return new MockDurableObjectId(name);
    }),

    idFromString: vi.fn((id: string) => {
      return new MockDurableObjectId(id);
    }),

    get: vi.fn((id: MockDurableObjectId) => {
      if (!instances.has(id.name) && objectClass) {
        const state = new MockDurableObjectState(id);
        instances.set(id.name, new objectClass(state, {}));
      }

      return instances.get(id.name) || {
        fetch: vi.fn().mockResolvedValue(new Response('OK'))
      };
    }),
  };
}

/**
 * Create a Queue mock
 *
 * @returns Mock Queue instance
 */
export function createMockQueue() {
  const messages: any[] = [];

  return {
    send: vi.fn(async (message: any) => {
      messages.push(message);
    }),

    sendBatch: vi.fn(async (batch: any[]) => {
      messages.push(...batch);
    }),

    // For testing: get queued messages
    _getMessages: () => [...messages],
    _clear: () => messages.length = 0,
  };
}

// ======================== Environment Mock ========================

/**
 * Create a complete Bindings environment mock
 *
 * @param overrides - Override specific bindings
 * @returns Complete mock environment
 *
 * @example
 * ```typescript
 * const env = MockFactory.createEnv({
 *   JWT_SECRET: 'custom-secret'
 * });
 * ```
 */
export function createMockEnv(overrides?: Partial<Bindings>): Bindings {
  const defaultEnv: Bindings = {
    // Database
    DB: createMockD1(),

    // KV Namespaces
    SESSION_CACHE: createMockKV(),
    RATE_LIMITER: createMockKV(),

    // R2 Buckets
    FILE_STORAGE: createMockR2(),

    // Durable Objects
    CONVERSATION_ROOM: createMockDurableObjectNamespace(),
    USER_CONNECTION: createMockDurableObjectNamespace(),
    MESSAGE_BROADCASTER: createMockDurableObjectNamespace(),
    DELAYED_MESSAGE_PROCESSOR: createMockDurableObjectNamespace(),
    DELAYED_MESSAGE_BUFFER: createMockDurableObjectNamespace(),
    LATEST_MESSAGE_CACHE_COORDINATOR: createMockDurableObjectNamespace(),

    // Queues
    DELAYED_MESSAGE_QUEUE: createMockQueue(),
    REALTIME_QUEUE: createMockQueue(),

    // Secrets
    JWT_SECRET: 'test-secret-key-for-testing-only-do-not-use-in-production',
    LINE_CHANNEL_SECRET: 'test-line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    FB_PAGE_ACCESS_TOKEN: 'test-fb-token',
    FB_APP_SECRET: 'test-fb-secret',
    FB_VERIFY_TOKEN: 'test-fb-verify',

    // Environment variables
    ENVIRONMENT: 'test',
    API_BASE_URL: 'http://localhost:8787',
    FRONTEND_URL: 'http://localhost:3000',
  };

  return {
    ...defaultEnv,
    ...overrides
  } as Bindings;
}

// ======================== Authentication Mocks ========================

/**
 * Create a mock JWT payload
 *
 * @param overrides - Override specific fields
 * @returns Mock JWT payload
 */
export function createMockJWTPayload(overrides?: Partial<JWTPayload>): JWTPayload {
  return {
    userId: 1,
    username: 'test-user',
    role: 'admin',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    ...overrides
  };
}

/**
 * Create a mock Request object
 *
 * @param url - Request URL
 * @param options - Request options
 * @returns Mock Request instance
 */
export function createMockRequest(
  url: string,
  options?: RequestInit
): Request {
  return new Request(url, {
    method: 'GET',
    ...options
  });
}

// ======================== Export as Factory Class ========================

/**
 * MockFactory - Centralized mock creation
 *
 * @example
 * ```typescript
 * import { MockFactory } from '@tests/helpers/mockFactory';
 *
 * const db = MockFactory.createDatabase([{ id: 1, name: 'Test' }]);
 * const env = MockFactory.createEnv();
 * const jwt = MockFactory.createJWTPayload({ role: 'agent' });
 * ```
 */
export const MockFactory = {
  // Database
  createDatabase: createMockDatabase,
  createD1: createMockD1,

  // Cloudflare Bindings
  createKV: createMockKV,
  createR2: createMockR2,
  createDurableObjectNamespace: createMockDurableObjectNamespace,
  createQueue: createMockQueue,

  // Environment
  createEnv: createMockEnv,

  // Authentication
  createJWTPayload: createMockJWTPayload,
  createRequest: createMockRequest,

  // Durable Objects
  MockDurableObjectId,
  MockDurableObjectState,

  // Specialized Mocks (added 2025-01-18)
  createMockTeamService: createMockTeamService,
  createMockAuthMiddleware: createMockAuthMiddleware,
  createMockWebSocket: createMockWebSocket,
  createTestUser: createTestUser,
  createMockFormData: createMockFormData,
};

export default MockFactory;

// ======================== Specialized Mocks ========================

/**
 * Create a mock TeamService with all common methods
 *
 * @param customMethods - Override specific methods
 * @returns Mock TeamService instance
 */
export function createMockTeamService(customMethods: Partial<any> = {}) {
  return {
    listTeams: vi.fn().mockResolvedValue({
      teams: [],
      total: 0,
      page: 1,
      limit: 20
    }),
    getTeam: vi.fn().mockResolvedValue(null),
    getTeamById: vi.fn().mockResolvedValue(null),
    createTeam: vi.fn().mockResolvedValue({ id: 1, name: 'Test Team' }),
    updateTeam: vi.fn().mockResolvedValue({ id: 1, name: 'Updated Team' }),
    deleteTeam: vi.fn().mockResolvedValue({ success: true }),
    getAllTeamsStats: vi.fn().mockResolvedValue({
      totalTeams: 0,
      activeTeams: 0,
      totalMembers: 0,
      stats: []
    }),
    getMembers: vi.fn().mockResolvedValue([]),
    searchTeams: vi.fn().mockResolvedValue([]),
    getTeamActivity: vi.fn().mockResolvedValue([]),
    addTeamMember: vi.fn().mockResolvedValue({ success: true }),
    updateMember: vi.fn().mockResolvedValue({ success: true }),
    removeMember: vi.fn().mockResolvedValue({ success: true }),
    resetPassword: vi.fn().mockResolvedValue({ success: true }),
    ...customMethods
  };
}

/**
 * Create mock authentication middleware
 *
 * @param defaultUser - Default user to set in context
 * @returns Mock authentication middleware functions
 */
export function createMockAuthMiddleware(defaultUser?: any) {
  const user = defaultUser || createTestUser();

  return {
    jwtAuth: vi.fn((c: any, next: any) => {
      c.set('user', user);
      c.set('jwtPayload', {
        userId: user.id,
        username: user.username || user.email,
        role: user.role,
        teamId: user.teamId
      });
      return next();
    }),
    requireAdmin: vi.fn(() => (c: any, next: any) => {
      const u = c.get('user');
      if (u.role !== 'admin') {
        return c.json({ error: 'Admin required' }, 403);
      }
      return next();
    }),
    requireManagerOrAdmin: vi.fn(() => (c: any, next: any) => {
      const u = c.get('user');
      if (u.role !== 'admin' && u.role !== 'team') {
        return c.json({ error: 'Manager or Admin required' }, 403);
      }
      return next();
    }),
    requireTeamAccess: vi.fn(() => (c: any, next: any) => next()),
    sessionAuth: vi.fn((c: any, next: any) => next()),
    rateLimit: vi.fn(() => (c: any, next: any) => next())
  };
}

/**
 * Create a mock WebSocket for testing real-time features
 *
 * @returns Mock WebSocket instance
 */
export function createMockWebSocket() {
  const messageListeners: Array<(event: any) => void> = [];
  const closeListeners: Array<(event: any) => void> = [];
  const errorListeners: Array<(event: any) => void> = [];
  const openListeners: Array<(event: any) => void> = [];

  const ws: any = {
    // WebSocket state
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,

    // Methods
    send: vi.fn((data: string) => {
      // Simulate message sent
      console.log('[MockWebSocket] Sent:', data);
    }),

    close: vi.fn((code?: number, reason?: string) => {
      ws.readyState = 3; // CLOSED
      closeListeners.forEach(listener => {
        listener({ code: code || 1000, reason: reason || '' });
      });
    }),

    addEventListener: vi.fn((event: string, callback: (e: any) => void) => {
      switch (event) {
        case 'message':
          messageListeners.push(callback);
          break;
        case 'close':
          closeListeners.push(callback);
          break;
        case 'error':
          errorListeners.push(callback);
          break;
        case 'open':
          openListeners.push(callback);
          break;
      }
    }),

    removeEventListener: vi.fn((event: string, callback: (e: any) => void) => {
      const listeners = {
        message: messageListeners,
        close: closeListeners,
        error: errorListeners,
        open: openListeners
      }[event];

      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }),

    // Test helpers
    simulateMessage: (data: any) => {
      messageListeners.forEach(listener => {
        listener({ data: typeof data === 'string' ? data : JSON.stringify(data) });
      });
    },

    simulateOpen: () => {
      ws.readyState = 1; // OPEN
      openListeners.forEach(listener => listener({}));
    },

    simulateError: (error: any) => {
      errorListeners.forEach(listener => listener({ error }));
    },

    simulateClose: (code = 1000, reason = '') => {
      ws.readyState = 3; // CLOSED
      closeListeners.forEach(listener => listener({ code, reason }));
    }
  };

  return ws;
}

/**
 * Create a test user object
 *
 * @param overrides - Custom properties
 * @returns Test user object
 */
export function createTestUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-test-123',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    role: 'agent',
    teamId: 1,
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides
  };
}

/**
 * Create mock FormData for file upload testing
 *
 * @returns Mock FormData instance
 */
export function createMockFormData() {
  const data = new Map<string, any>();

  return {
    append: vi.fn((name: string, value: any, filename?: string) => {
      data.set(name, { value, filename });
    }),

    get: vi.fn((name: string) => {
      const entry = data.get(name);
      return entry ? entry.value : null;
    }),

    getAll: vi.fn((name: string) => {
      const entry = data.get(name);
      return entry ? [entry.value] : [];
    }),

    has: vi.fn((name: string) => data.has(name)),

    delete: vi.fn((name: string) => data.delete(name)),

    set: vi.fn((name: string, value: any, filename?: string) => {
      data.set(name, { value, filename });
    }),

    forEach: vi.fn((callback: (value: any, key: string) => void) => {
      data.forEach((entry, key) => callback(entry.value, key));
    }),

    entries: vi.fn(() => {
      return Array.from(data.entries()).map(([key, entry]) => [key, entry.value]);
    }),

    keys: vi.fn(() => Array.from(data.keys())),

    values: vi.fn(() => Array.from(data.values()).map(entry => entry.value))
  };
}
