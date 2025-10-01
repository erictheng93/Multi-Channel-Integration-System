// Agent Validation Middleware 測試
// 測試所有驗證邏輯的正確性

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { agentValidationMiddleware } from '@modules/agents/middleware/agent-validation';
import type { Bindings } from '@/types';

// ======================== 測試輔助函數 ========================

const createTestContext = (method: string, path: string, body?: any, params?: Record<string, string>, query?: Record<string, string>) => {
  const app = new Hono<{ Bindings: Bindings }>();

  return {
    req: {
      method,
      url: `http://localhost${path}`,
      json: vi.fn(async () => body || {}),
      param: vi.fn((key: string) => params?.[key]),
      query: vi.fn((key?: string) => {
        if (key) return query?.[key];
        return query || {};
      })
    },
    json: vi.fn((data: any, status?: number) => {
      const response = new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    }),
    env: {} as any,
    executionCtx: {} as any,
    finalized: false,
    get: vi.fn(),
    set: vi.fn(),
    var: {}
  };
};

// ======================== createAgent 驗證測試 ========================

describe('AgentValidation - createAgent', () => {
  it('should pass validation with all required fields', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'valid@example.com',
      displayName: 'Valid Agent'
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.createAgent(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if email is missing', async () => {
    const ctx = createTestContext('POST', '/agents', {
      displayName: 'No Email Agent'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    expect(next).not.toHaveBeenCalled();

    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Missing required fields');
    expect(json.error).toContain('email');
  });

  it('should fail if displayName is missing', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('displayName');
  });

  it('should fail with invalid email format', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'invalid-email',
      displayName: 'Test Agent'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('Invalid email format');
  });

  it('should fail if displayName is too short', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com',
      displayName: 'A' // Only 1 character
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('between 2 and 50 characters');
  });

  it('should fail if displayName is too long', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com',
      displayName: 'A'.repeat(51) // 51 characters
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('between 2 and 50 characters');
  });

  it('should accept valid role values', async () => {
    for (const role of ['admin', 'team', 'agent']) {
      const ctx = createTestContext('POST', '/agents', {
        email: 'test@example.com',
        displayName: 'Test Agent',
        role
      }) as any;

      const next = vi.fn();

      await agentValidationMiddleware.createAgent(ctx, next);

      expect(next).toHaveBeenCalled();
    }
  });

  it('should fail with invalid role', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com',
      displayName: 'Test Agent',
      role: 'superuser' // Invalid role
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid role');
  });

  it('should fail with invalid teamId format', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com',
      displayName: 'Test Agent',
      teamId: 'not-a-number'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid team ID format');
  });

  it('should fail with teamId less than 1', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com',
      displayName: 'Test Agent',
      teamId: 0
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.createAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid team ID format');
  });

  it('should accept null teamId', async () => {
    const ctx = createTestContext('POST', '/agents', {
      email: 'test@example.com',
      displayName: 'Test Agent',
      teamId: null
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.createAgent(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});

// ======================== updateAgent 驗證測試 ========================

describe('AgentValidation - updateAgent', () => {
  it('should pass validation with valid updates', async () => {
    const ctx = createTestContext('PUT', '/agents/123', {
      displayName: 'Updated Name'
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.updateAgent(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if no update data provided', async () => {
    const ctx = createTestContext('PUT', '/agents/123', {}) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.updateAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('No update data provided');
  });

  it('should validate email format when provided', async () => {
    const ctx = createTestContext('PUT', '/agents/123', {
      email: 'invalid-format'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.updateAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('Invalid email format');
  });

  it('should validate displayName length when provided', async () => {
    const ctx = createTestContext('PUT', '/agents/123', {
      displayName: 'A'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.updateAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('between 2 and 50 characters');
  });

  it('should validate role when provided', async () => {
    const ctx = createTestContext('PUT', '/agents/123', {
      role: 'invalid'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.updateAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid role');
  });

  it('should validate isActive is boolean', async () => {
    const ctx = createTestContext('PUT', '/agents/123', {
      isActive: 'yes' // Should be boolean
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.updateAgent(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('isActive must be a boolean');
  });
});

// ======================== agentId 驗證測試 ========================

describe('AgentValidation - agentId', () => {
  it('should pass validation with valid agent ID', async () => {
    const ctx = createTestContext('GET', '/agents/valid-agent-id-123', undefined, {
      agentId: 'valid-agent-id-123'
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.agentId(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if agentId is missing', async () => {
    const ctx = createTestContext('GET', '/agents/', undefined, {}) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.agentId(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('Agent ID is required');
  });

  it('should fail if agentId is too short', async () => {
    const ctx = createTestContext('GET', '/agents/abc', undefined, {
      agentId: 'abc' // Less than 10 characters
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.agentId(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('Invalid agent ID format');
  });

  it('should fail if agentId is too long', async () => {
    const ctx = createTestContext('GET', '/agents/toolong', undefined, {
      agentId: 'A'.repeat(51) // More than 50 characters
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.agentId(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('Invalid agent ID format');
  });
});

// ======================== skill 驗證測試 ========================

describe('AgentValidation - skill', () => {
  it('should pass validation with all required skill fields', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      name: 'JavaScript',
      category: 'technical',
      level: 'advanced'
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.skill(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if skill name is missing', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      category: 'technical',
      level: 'beginner'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.skill(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Missing required fields');
    expect(json.error).toContain('name');
  });

  it('should validate skill name length', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      name: 'A',
      category: 'technical',
      level: 'beginner'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.skill(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('between 2 and 100 characters');
  });

  it('should validate skill category', async () => {
    const validCategories = ['communication', 'technical', 'product', 'language', 'platform', 'soft_skill'];

    for (const category of validCategories) {
      const ctx = createTestContext('POST', '/agents/123/skills', {
        name: 'Test Skill',
        category,
        level: 'beginner'
      }) as any;

      const next = vi.fn();

      await agentValidationMiddleware.skill(ctx, next);

      expect(next).toHaveBeenCalled();
    }
  });

  it('should fail with invalid category', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      name: 'Test Skill',
      category: 'invalid_category',
      level: 'beginner'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.skill(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid category');
  });

  it('should validate skill level', async () => {
    const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

    for (const level of validLevels) {
      const ctx = createTestContext('POST', '/agents/123/skills', {
        name: 'Test Skill',
        category: 'technical',
        level
      }) as any;

      const next = vi.fn();

      await agentValidationMiddleware.skill(ctx, next);

      expect(next).toHaveBeenCalled();
    }
  });

  it('should fail with invalid level', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      name: 'Test Skill',
      category: 'technical',
      level: 'master'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.skill(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid level');
  });

  it('should validate description length', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      name: 'Test Skill',
      category: 'technical',
      level: 'beginner',
      description: 'A'.repeat(501) // More than 500 characters
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.skill(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('less than 500 characters');
  });

  it('should validate certified is boolean', async () => {
    const ctx = createTestContext('POST', '/agents/123/skills', {
      name: 'Test Skill',
      category: 'technical',
      level: 'beginner',
      certified: 'yes'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.skill(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('certified must be a boolean');
  });
});

// ======================== status 驗證測試 ========================

describe('AgentValidation - status', () => {
  it('should pass validation with required status field', async () => {
    const ctx = createTestContext('PUT', '/agents/123/status', {
      status: 'online'
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.status(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if status is missing', async () => {
    const ctx = createTestContext('PUT', '/agents/123/status', {}) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.status(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('Status is required');
  });

  it('should validate status values', async () => {
    const validStatuses = ['online', 'busy', 'away', 'offline', 'break', 'meeting'];

    for (const status of validStatuses) {
      const ctx = createTestContext('PUT', '/agents/123/status', {
        status
      }) as any;

      const next = vi.fn();

      await agentValidationMiddleware.status(ctx, next);

      expect(next).toHaveBeenCalled();
    }
  });

  it('should fail with invalid status', async () => {
    const ctx = createTestContext('PUT', '/agents/123/status', {
      status: 'invisible'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.status(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid status');
  });

  it('should validate availableUntil is future date', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

    const ctx = createTestContext('PUT', '/agents/123/status', {
      status: 'away',
      availableUntil: pastDate
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.status(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('must be a future date');
  });

  it('should accept valid future availableUntil', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    const ctx = createTestContext('PUT', '/agents/123/status', {
      status: 'away',
      availableUntil: futureDate
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.status(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail with invalid date format', async () => {
    const ctx = createTestContext('PUT', '/agents/123/status', {
      status: 'away',
      availableUntil: 'not-a-date'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.status(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid availableUntil date format');
  });

  it('should validate note length', async () => {
    const ctx = createTestContext('PUT', '/agents/123/status', {
      status: 'break',
      note: 'A'.repeat(201) // More than 200 characters
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.status(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('less than 200 characters');
  });
});

// ======================== pagination 驗證測試 ========================

describe('AgentValidation - pagination', () => {
  it('should pass validation with valid page and limit', async () => {
    const ctx = createTestContext('GET', '/agents?page=1&limit=20', undefined, undefined, {
      page: '1',
      limit: '20'
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.pagination(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if page is less than 1', async () => {
    const ctx = createTestContext('GET', '/agents?page=0', undefined, undefined, {
      page: '0'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.pagination(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Page must be a positive integer');
  });

  it('should fail if page is too large', async () => {
    const ctx = createTestContext('GET', '/agents?page=1001', undefined, undefined, {
      page: '1001'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.pagination(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Page number too large');
  });

  it('should fail if limit is less than 1', async () => {
    const ctx = createTestContext('GET', '/agents?limit=0', undefined, undefined, {
      limit: '0'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.pagination(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Limit must be a positive integer');
  });

  it('should fail if limit is too large', async () => {
    const ctx = createTestContext('GET', '/agents?limit=101', undefined, undefined, {
      limit: '101'
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.pagination(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Limit too large');
  });

  it('should pass without query parameters', async () => {
    const ctx = createTestContext('GET', '/agents', undefined, undefined, {}) as any;

    const next = vi.fn();

    await agentValidationMiddleware.pagination(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});

// ======================== batchOperation 驗證測試 ========================

describe('AgentValidation - batchOperation', () => {
  it('should pass validation with valid agentIds array', async () => {
    const ctx = createTestContext('PUT', '/agents/batch', {
      agentIds: ['agent-1234567890', 'agent-0987654321', 'agent-1111111111'], // IDs >= 10 chars
      updates: { isActive: false }
    }) as any;

    const next = vi.fn();

    await agentValidationMiddleware.batchOperation(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it('should fail if agentIds is not an array', async () => {
    const ctx = createTestContext('PUT', '/agents/batch', {
      agentIds: 'not-an-array',
      updates: {}
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.batchOperation(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('agentIds must be an array');
  });

  it('should fail if agentIds is empty', async () => {
    const ctx = createTestContext('PUT', '/agents/batch', {
      agentIds: [],
      updates: {}
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.batchOperation(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toBe('agentIds cannot be empty');
  });

  it('should fail if agentIds exceeds limit', async () => {
    const ctx = createTestContext('PUT', '/agents/batch', {
      agentIds: Array.from({ length: 51 }, (_, i) => `agent-${i}`),
      updates: {}
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.batchOperation(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Cannot process more than 50 agents');
  });

  it('should validate individual agent ID format', async () => {
    const ctx = createTestContext('PUT', '/agents/batch', {
      agentIds: ['valid-agent-id', 'abc'], // 'abc' is too short
      updates: {}
    }) as any;

    const next = vi.fn();

    const result = await agentValidationMiddleware.batchOperation(ctx, next);

    expect(result).toBeInstanceOf(Response);
    const json = await (result as Response).json() as { error: string };
    expect(json.error).toContain('Invalid agent ID format');
  });
});
