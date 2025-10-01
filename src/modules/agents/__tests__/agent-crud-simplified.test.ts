// AgentService CRUD 簡化測試
// 專注於核心業務邏輯測試，使用簡化的 mock 策略

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '@modules/agents/services/agent-crud';
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  InvalidAgentDataError
} from '../types/agent-types';

// ======================== Mock 設置 ========================

// Mock ID 生成器
vi.mock('../../../utils/id-generator', () => ({
  generateId: vi.fn(() => 'test-agent-' + Math.random().toString(36).substring(7))
}));

// Mock Auth Utils
vi.mock('../../../utils/auth', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed_${password}`)
}));

// ======================== 簡化的 Mock DB ========================

const createSimplifiedMockDb = () => {
  const mockAgents = new Map();
  const mockTeams = new Map();

  // 添加默認 team
  mockTeams.set(1, { id: 1, name: 'Test Team' });

  // 跟蹤調用以便測試驗證
  const calls = {
    insert: [] as any[],
    select: [] as any[],
    update: [] as any[],
    delete: [] as any[]
  };

  return {
    select: vi.fn((fields?: any) => ({
      from: vi.fn((tableRef: any) => {
        // 檢測是否查詢 teams 表
        const isTeamsTable = tableRef?.name === 'teams' || tableRef?._ === 'teams';

        return {
          where: vi.fn((condition: any) => ({
            get: vi.fn(async () => {
              calls.select.push({ type: 'where.get', condition });

              // 如果是查詢 teams, 返回 team
              if (isTeamsTable) {
                return Array.from(mockTeams.values())[0] || null;
              }

              // 否則返回 agent
              return Array.from(mockAgents.values())[0] || null;
            }),
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                get: vi.fn(async () => {
                  const agent = Array.from(mockAgents.values())[0];
                  if (!agent) return null;
                  const team = mockTeams.get(agent.teamId);
                  return { ...agent, teamName: team?.name || null };
                })
              }))
            })),
            all: vi.fn(async () => {
              return Array.from(mockAgents.values());
            })
          })),
          leftJoin: vi.fn((teamRef: any, condition: any) => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(() => ({
                    all: vi.fn(async () => {
                      return Array.from(mockAgents.values()).map(agent => {
                        const team = mockTeams.get(agent.teamId);
                        return { ...agent, teamName: team?.name || null };
                      });
                    })
                  }))
                }))
              })),
              get: vi.fn(async () => {
                return { count: mockAgents.size };
              })
            }))
          }))
        };
      })
    })),

    insert: vi.fn((table: any) => ({
      values: vi.fn((data: any) => ({
        returning: vi.fn(() => ({
          get: vi.fn(async () => {
            calls.insert.push(data);
            mockAgents.set(data.id, data);
            return data;
          })
        }))
      }))
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((data: any) => ({
        where: vi.fn((condition: any) => ({
          returning: vi.fn(() => ({
            get: vi.fn(async () => {
              calls.update.push(data);
              const agent = Array.from(mockAgents.values())[0];
              if (!agent) return null;
              const updated = { ...agent, ...data };
              mockAgents.set(agent.id, updated);
              return updated;
            })
          }))
        }))
      }))
    })),

    delete: vi.fn((table: any) => ({
      where: vi.fn((condition: any) => ({
        returning: vi.fn(() => ({
          get: vi.fn(async () => {
            calls.delete.push({ condition });
            const agent = Array.from(mockAgents.values())[0];
            if (agent) {
              mockAgents.delete(agent.id);
            }
            return agent || null;
          })
        }))
      }))
    })),

    // 測試輔助方法
    _test: {
      agents: mockAgents,
      teams: mockTeams,
      calls,
      reset: () => {
        mockAgents.clear();
        mockTeams.clear();
        mockTeams.set(1, { id: 1, name: 'Test Team' });
        calls.insert.length = 0;
        calls.select.length = 0;
        calls.update.length = 0;
        calls.delete.length = 0;
      }
    }
  };
};

// ======================== 核心業務邏輯測試 ========================

describe('AgentService - Core Business Logic (Simplified)', () => {
  let mockDb: ReturnType<typeof createSimplifiedMockDb>;
  let agentService: AgentService;

  beforeEach(() => {
    mockDb = createSimplifiedMockDb();
    agentService = new AgentService(mockDb as any);
    vi.clearAllMocks();
  });

  describe('createAgent - Business Logic', () => {
    it('should generate ID and hash password for new agent', async () => {
      const result = await agentService.createAgent({
        email: 'newagent@test.com',
        displayName: 'New Agent',
        teamId: 1
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^test-agent-/);
      expect(result.passwordHash).toMatch(/^hashed_/);
      expect(mockDb._test.calls.insert.length).toBe(1);
    });

    it('should set default values correctly', async () => {
      const result = await agentService.createAgent({
        email: 'agent@test.com',
        displayName: 'Test Agent'
      });

      expect(result.role).toBe('agent');
      expect(result.isActive).toBe(true);
      expect(result.passwordPolicy).toBe('changeable');
      expect(result.teamId).toBeNull();
    });

    it('should respect provided values', async () => {
      const result = await agentService.createAgent({
        email: 'admin@test.com',
        displayName: 'Admin User',
        role: 'admin',
        isActive: false,
        teamId: 1
      });

      expect(result.role).toBe('admin');
      expect(result.isActive).toBe(false);
      expect(result.teamId).toBe(1);
    });

    it('should set timestamps', async () => {
      const result = await agentService.createAgent({
        email: 'test@test.com',
        displayName: 'Test'
      });

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(new Date(result.createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should use custom passwordHash if provided', async () => {
      const customHash = 'custom_secure_hash_123';

      const result = await agentService.createAgent({
        email: 'custom@test.com',
        displayName: 'Custom',
        passwordHash: customHash
      });

      expect(result.passwordHash).toBe(customHash);
    });
  });

  describe('getAgent - Business Logic', () => {
    beforeEach(() => {
      mockDb._test.agents.set('agent-1', {
        id: 'agent-1',
        email: 'test@example.com',
        displayName: 'Test Agent',
        passwordHash: 'hashed_password',
        role: 'agent',
        teamId: 1,
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActive: null,
        lastLoginAt: null
      });
    });

    it('should not expose passwordHash in result', async () => {
      const result = await agentService.getAgent('agent-1');

      expect(result?.passwordHash).toBe('');
    });

    it('should include team information when available', async () => {
      const result = await agentService.getAgent('agent-1');

      expect(result?.teamName).toBe('Test Team');
    });

    it('should return null for non-existent agent', async () => {
      mockDb._test.agents.clear();

      const result = await agentService.getAgent('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateAgent - Business Logic', () => {
    beforeEach(() => {
      mockDb._test.agents.set('agent-1', {
        id: 'agent-1',
        email: 'original@test.com',
        displayName: 'Original Name',
        passwordHash: 'hashed',
        role: 'agent',
        teamId: 1,
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        lastActive: null,
        lastLoginAt: null
      });
    });

    it('should update agent and set new updatedAt timestamp', async () => {
      const beforeUpdate = Date.now();

      const result = await agentService.updateAgent('agent-1', {
        displayName: 'Updated Name'
      });

      expect(result.displayName).toBe('Updated Name');
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(mockDb._test.calls.update.length).toBe(1);
    });

    it('should merge updates with existing data', async () => {
      const result = await agentService.updateAgent('agent-1', {
        isActive: false
      });

      expect(result.isActive).toBe(false);
      expect(result.email).toBe('original@test.com'); // 保持不變
      expect(result.displayName).toBe('Original Name'); // 保持不變
    });

    it('should allow updating multiple fields', async () => {
      const result = await agentService.updateAgent('agent-1', {
        displayName: 'New Name',
        role: 'team',
        isActive: false
      });

      expect(result.displayName).toBe('New Name');
      expect(result.role).toBe('team');
      expect(result.isActive).toBe(false);
    });
  });

  describe('deleteAgent - Business Logic', () => {
    beforeEach(() => {
      mockDb._test.agents.set('agent-1', {
        id: 'agent-1',
        email: 'delete@test.com',
        displayName: 'To Delete',
        passwordHash: 'hashed',
        role: 'agent',
        teamId: null,
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActive: null,
        lastLoginAt: null
      });
    });

    it('should delete agent and return true', async () => {
      const result = await agentService.deleteAgent('agent-1');

      expect(result).toBe(true);
      expect(mockDb._test.agents.has('agent-1')).toBe(false);
      expect(mockDb._test.calls.delete.length).toBe(1);
    });

    it('should return false for non-existent agent', async () => {
      mockDb._test.agents.clear();

      const result = await agentService.deleteAgent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listAgents - Business Logic', () => {
    beforeEach(() => {
      // 添加多個測試 agents
      for (let i = 1; i <= 5; i++) {
        mockDb._test.agents.set(`agent-${i}`, {
          id: `agent-${i}`,
          email: `agent${i}@test.com`,
          displayName: `Agent ${i}`,
          passwordHash: 'hashed',
          role: 'agent',
          teamId: i % 2 === 0 ? 1 : null,
          isActive: i % 3 !== 0,
          passwordPolicy: 'changeable',
          createdAt: new Date(2024, 0, i).toISOString(),
          updatedAt: new Date(2024, 0, i).toISOString(),
          lastActive: null,
          lastLoginAt: null
        });
      }
    });

    it('should return paginated results', async () => {
      const result = await agentService.listAgents({
        page: 1,
        limit: 10
      });

      expect(result.agents).toBeDefined();
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10
      });
    });

    it('should not expose passwordHash in list', async () => {
      const result = await agentService.listAgents({ page: 1, limit: 10 });

      result.agents.forEach(agent => {
        expect(agent.passwordHash).toBe('');
      });
    });

    it('should use default pagination values', async () => {
      const result = await agentService.listAgents({});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe('batchUpdateAgents - Business Logic', () => {
    beforeEach(() => {
      mockDb._test.agents.set('agent-1', {
        id: 'agent-1',
        email: 'agent1@test.com',
        displayName: 'Agent 1',
        passwordHash: 'hashed',
        role: 'agent',
        teamId: 1,
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActive: null,
        lastLoginAt: null
      });
    });

    it('should update multiple agents with same changes', async () => {
      const result = await agentService.batchUpdateAgents({
        agentIds: ['agent-1'],
        updates: { isActive: false }
      });

      expect(result.length).toBeGreaterThan(0);
      expect(mockDb._test.calls.update.length).toBeGreaterThan(0);
    });

    it('should continue on errors for non-existent agents', async () => {
      const result = await agentService.batchUpdateAgents({
        agentIds: ['agent-1', 'non-existent', 'also-non-existent'],
        updates: { displayName: 'Batch Updated' }
      });

      // 應該至少更新了存在的 agent
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const errorDb = {
        select: () => {
          throw new Error('Database connection failed');
        }
      };

      const errorService = new AgentService(errorDb as any);

      await expect(
        errorService.getAgent('any-id')
      ).rejects.toThrow('Failed to get agent');
    });

    it('should wrap error messages appropriately', async () => {
      const errorDb = {
        insert: () => ({
          values: () => ({
            returning: () => ({
              get: async () => {
                throw new Error('Constraint violation');
              }
            })
          })
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              get: async () => null
            })
          })
        })
      };

      const errorService = new AgentService(errorDb as any);

      await expect(
        errorService.createAgent({
          email: 'test@test.com',
          displayName: 'Test'
        })
      ).rejects.toThrow('Failed to create agent');
    });
  });
});

// ======================== 自定義錯誤測試 ========================

describe('AgentService - Custom Errors', () => {
  it('should throw AgentNotFoundError with correct message', () => {
    const error = new AgentNotFoundError('agent-123');

    expect(error.message).toBe('Agent not found: agent-123');
    expect(error.name).toBe('AgentNotFoundError');
  });

  it('should throw AgentAlreadyExistsError with correct message', () => {
    const error = new AgentAlreadyExistsError('duplicate@test.com');

    expect(error.message).toBe('Agent with email already exists: duplicate@test.com');
    expect(error.name).toBe('AgentAlreadyExistsError');
  });

  it('should throw InvalidAgentDataError with correct message', () => {
    const error = new InvalidAgentDataError('Invalid team ID');

    expect(error.message).toBe('Invalid team ID');
    expect(error.name).toBe('InvalidAgentDataError');
  });

  it('should allow InvalidAgentDataError to carry details', () => {
    const details = { field: 'teamId', value: 999 };
    const error = new InvalidAgentDataError('Invalid data', details);

    expect(error.details).toEqual(details);
  });
});
