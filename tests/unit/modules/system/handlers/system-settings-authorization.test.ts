import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
const valuesMock = vi.fn();
const onConflictDoUpdateMock = vi.fn();
const logActivityMock = vi.fn();

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    insert: insertMock
  }))
}));

vi.mock('@modules/activities', () => ({
  ACTIVITY_ACTIONS: {
    SETTINGS_UPDATE: 'settings_update'
  },
  RESOURCE_TYPES: {
    SYSTEM: 'system'
  },
  ActivityService: vi.fn(function () {
    return {
      logActivity: logActivityMock
    };
  })
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000)
}));

import { createDbClient } from '@/db/drizzle-factory';
import { updateSettings } from '@modules/system/handlers/system-settings';
import type { Bindings } from '@/types';

function createContext(role: 'admin' | 'agent') {
  return {
    env: { DB: {} } as Bindings,
    req: {
      json: vi.fn(async () => ({ advanced: { enableRateLimit: false } })),
      header: vi.fn(() => undefined)
    },
    get: vi.fn((key: string) => {
      if (key === 'jwtPayload') {
        return { userId: 'agent-1', username: 'Agent One', role };
      }
      return undefined;
    }),
    json: vi.fn((data: unknown, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  };
}

describe('system settings authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onConflictDoUpdateMock.mockResolvedValue(undefined);
    valuesMock.mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
    insertMock.mockReturnValue({ values: valuesMock });
  });

  it('rejects non-admin settings updates before touching storage', async () => {
    const response = await updateSettings(createContext('agent') as any);
    const body = (await response.json()) as any;

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Admin role required');
    expect(createDbClient).not.toHaveBeenCalled();
    expect(logActivityMock).not.toHaveBeenCalled();
  });

  it('allows admins to update settings and logs the activity', async () => {
    const response = await updateSettings(createContext('admin') as any);
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(createDbClient).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(logActivityMock).toHaveBeenCalledTimes(1);
  });
});
