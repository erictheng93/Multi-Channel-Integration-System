/**
 * Durable Objects Testing Helper
 * 統一的 DO 測試輔助工具，解決所有 DO 測試的共同問題
 */

import { vi } from 'vitest';
import type { DurableObjectState } from '@cloudflare/workers-types';

/**
 * Module-level variable for Drizzle mock
 * 這個變量會被 vi.mock hoisted code 使用
 */
let mockDrizzleInstance: any = null;

/**
 * Hoist Drizzle mock to module level
 * 必須在 module 頂部定義，避免 "mockDB is not defined" 錯誤
 */
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDrizzleInstance)
}));

/**
 * 全局 WebSocketPair Mock
 * 必須在測試開始前調用
 */
export function setupGlobalWebSocketPair() {
  if (typeof globalThis.WebSocketPair === 'undefined') {
    (globalThis as any).WebSocketPair = class WebSocketPair {
      0: any;
      1: any;
      constructor() {
        const createMockWebSocket = () => ({
          send: vi.fn(),
          close: vi.fn(),
          accept: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          readyState: 1, // OPEN
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3,
          url: '',
          protocol: '',
          extensions: '',
          bufferedAmount: 0,
          binaryType: 'blob' as BinaryType,
          onopen: null,
          onerror: null,
          onclose: null,
          onmessage: null
        });
        this[0] = createMockWebSocket();
        this[1] = createMockWebSocket();
      }
    };
  }
}

/**
 * Mock Durable Object State
 * 統一的 DO State 實現，避免重複定義
 */
export class MockDurableObjectState implements Partial<DurableObjectState> {
  private data = new Map<string, any>();
  private alarmTime: number | null = null;

  id = {
    toString: () => 'test-do-id',
    equals: () => false,
    name: 'test-do-name'
  } as any;

  async blockConcurrencyWhile(callback: () => Promise<void>): Promise<void> {
    await callback();
  }

  storage = {
    get: async (key: string) => this.data.get(key),
    put: async (key: string, value: any) => {
      this.data.set(key, value);
    },
    delete: async (key: string) => {
      this.data.delete(key);
    },
    list: async (options?: { prefix?: string }) => {
      const entries = new Map();
      for (const [key, value] of this.data.entries()) {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          entries.set(key, value);
        }
      }
      return entries;
    },
    deleteAll: async () => {
      this.data.clear();
    },
    setAlarm: async (time: number) => {
      this.alarmTime = time;
    },
    getAlarm: async () => this.alarmTime,
    deleteAlarm: async () => {
      this.alarmTime = null;
    }
  } as any;

  /**
   * 手動設置 alarm 時間（用於測試）
   */
  setTestAlarm(time: number) {
    this.alarmTime = time;
  }

  /**
   * 獲取當前 alarm 時間（用於測試驗證）
   */
  getTestAlarm() {
    return this.alarmTime;
  }

  /**
   * 清空所有存儲數據（用於測試重置）
   */
  clearTestStorage() {
    this.data.clear();
    this.alarmTime = null;
  }
}

/**
 * 創建完整的 Drizzle DB Mock
 * 包含所有常用的查詢方法
 */
export function createDrizzleMock() {
  const mockDB = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    batch: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ success: true })
  };

  return mockDB;
}

/**
 * 創建 Drizzle Mock 並更新 module-level instance
 * ⚠️ 重要：vi.mock 已在 module 頂部設置，這裡只更新 instance
 */
export function setupDrizzleMock() {
  mockDrizzleInstance = createDrizzleMock();
  return mockDrizzleInstance;
}

/**
 * Mock Bindings for DO tests
 */
export interface MockBindings {
  DB: any;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  FB_PAGE_ACCESS_TOKEN?: string;
  FILE_STORAGE?: any;
  JWT_SECRET?: string;
  SESSIONS?: any;
  CACHE?: any;
}

/**
 * 創建標準的測試 Bindings
 */
export function createMockBindings(overrides: Partial<MockBindings> = {}): MockBindings {
  return {
    DB: createDrizzleMock(),
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    FB_PAGE_ACCESS_TOKEN: 'test-fb-token',
    FILE_STORAGE: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ objects: [] })
    },
    JWT_SECRET: 'test-secret',
    SESSIONS: {},
    CACHE: {},
    ...overrides
  };
}

/**
 * 設置全局 fetch mock
 */
export function setupGlobalFetch(defaultResponse?: Response) {
  global.fetch = vi.fn().mockResolvedValue(
    defaultResponse || new Response(null, { status: 200 })
  );
  return global.fetch;
}

/**
 * 創建模擬的 Request 對象
 */
export function createMockRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

/**
 * 等待指定毫秒數
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 完整的測試環境設置
 * 一次性設置所有常用的 mocks
 */
export function setupDOTestEnvironment() {
  setupGlobalWebSocketPair();
  const mockDB = setupDrizzleMock();
  const fetch = setupGlobalFetch();

  return {
    mockDB,
    fetch,
    createState: () => new MockDurableObjectState(),
    createBindings: createMockBindings,
    createRequest: createMockRequest,
    wait
  };
}

/**
 * 清理測試環境
 */
export function cleanupDOTestEnvironment() {
  vi.clearAllMocks();
  vi.resetModules();
}

/**
 * 創建一個帶有自定義 ID 的 Mock State
 */
export function createMockStateWithId(id: string): MockDurableObjectState {
  const state = new MockDurableObjectState();
  state.id = {
    toString: () => id,
    equals: () => false,
    name: id
  } as any;
  return state;
}
