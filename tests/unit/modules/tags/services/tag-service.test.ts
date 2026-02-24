/**
 * TagService Unit Tests
 *
 * Tests for src/modules/tags/services/tag-service.ts (all 9 handler methods).
 *
 * Mock strategy:
 * - vi.mock("@/middleware/auth") bypasses JWT
 * - vi.mock("@/db/drizzle-factory") operation-aware chainable Drizzle mock
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";

// Configurable JWT payload
let currentPayload = {
  userId: "admin-001",
  username: "testadmin",
  role: "admin" as string,
  teamId: 1,
};

vi.mock("@/middleware/auth", () => ({
  jwtAuth: vi.fn((_c: any, next: any) => {
    _c.set("jwtPayload", { ...currentPayload });
    return next();
  }),
  requireRole: vi.fn(() => (_c: any, next: any) => next()),
}));

// Mock state
interface MockState {
  allResults: Array<any[] | Error>;
  getResults: Array<any | null | Error>;
  runError: Error | null;
  selectResults: Array<any[] | Error>;
  insertResults: Array<any[] | Error>;
  updateError: Error | null;
}

let mockState: MockState;

function resetMockState(overrides: Partial<MockState> = {}) {
  mockState = {
    allResults: [], getResults: [], runError: null,
    selectResults: [], insertResults: [], updateError: null,
    ...overrides,
  };
}

function createDrizzleMock() {
  const mock: any = {
    all: vi.fn(() => {
      const r = mockState.allResults.shift();
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve(r ?? []);
    }),
    get: vi.fn(() => {
      const r = mockState.getResults.shift();
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve(r ?? null);
    }),
    run: vi.fn(() => {
      if (mockState.runError) return Promise.reject(mockState.runError);
      return Promise.resolve(undefined);
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const r = mockState.selectResults.shift();
          if (r instanceof Error) return Promise.reject(r);
          const data = r ?? [];
          const p = Promise.resolve(data);
          (p as any).limit = vi.fn(() => Promise.resolve(data));
          return p;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => {
          const r = mockState.insertResults.shift();
          if (r instanceof Error) return Promise.reject(r);
          return Promise.resolve(r ?? []);
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          if (mockState.updateError) return Promise.reject(mockState.updateError);
          return Promise.resolve(undefined);
        }),
      })),
    })),
  };
  return mock;
}

let drizzleMock: ReturnType<typeof createDrizzleMock>;

vi.mock("@/db/drizzle-factory", () => ({
  createDbClient: vi.fn(() => drizzleMock),
}));

import tagMainHandler from "@/modules/tags/handlers/tag-main";
import type { Bindings } from "@/types";

function createMockEnv() {
  return {
    DB: { prepare: vi.fn() },
    SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    JWT_SECRET: "test-secret",
  };
}

function createTestApp(env: ReturnType<typeof createMockEnv>) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use("*", async (c, next) => { c.env = env as any; await next(); });
  app.route("/api/tags", tagMainHandler);
  return app;
}
function makeTagListRow(o: Partial<Record<string, unknown>> = {}) {
  return { id: 1, name: "VIP", color: "#FF0000", description: "Important customers",
    team_id: null, is_active: 1, created_by: "admin-001",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-15T00:00:00Z",
    customer_count: 5, conversation_count: 3, ...o };
}

function makeTagDetailRow(o: Partial<Record<string, unknown>> = {}) {
  return { id: 1, name: "VIP", color: "#FF0000", description: "Important customers",
    team_id: null, team_name: null, is_active: 1,
    created_by: "admin-001", created_by_name: "Admin User",
    customer_count: 5, conversation_count: 3,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-15T00:00:00Z", ...o };
}

function makeInsertedTag(o: Partial<Record<string, unknown>> = {}) {
  return { id: 10, name: "New Tag", color: "#3B82F6", description: null,
    teamId: null, isActive: true, createdBy: "admin-001",
    createdAt: "2026-01-20T00:00:00Z", updatedAt: "2026-01-20T00:00:00Z", ...o };
}

function makeCustomerRow(o: Partial<Record<string, unknown>> = {}) {
  return { id: "cust-001", platform: "line", platform_user_id: "U12345",
    display_name: "Alice", avatar_url: null, email: "alice@example.com",
    phone: null, created_at: "2026-01-01T00:00:00Z",
    assigned_at: "2026-01-10T00:00:00Z", assigned_by: "agent-001", ...o };
}

function makeConversationRow(o: Partial<Record<string, unknown>> = {}) {
  return { id: "conv-001", status: "active", channel: "line",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-15T12:00:00Z",
    customer_name: "Alice", customer_avatar: null, customer_platform: "line",
    assigned_at: "2026-01-10T09:00:00Z", assigned_by: "agent-001", ...o };
}

function makeExistingRow(o: Partial<Record<string, unknown>> = {}) {
  return { id: 1, name: "VIP", color: "#FF0000", description: null,
    team_id: null, is_active: 1, created_by: "admin-001",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...o };
}