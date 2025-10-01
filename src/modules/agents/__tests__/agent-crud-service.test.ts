// AgentService CRUD 測試
// 測試 Agent CRUD 操作的完整功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '@modules/agents/services/agent-crud';
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  InvalidAgentDataError,
  type Agent,
  type CreateAgentRequest,
  type UpdateAgentRequest
} from '../types/agent-types';

// ======================== Mock 設置 ========================

// Mock ID 生成器
vi.mock('../../../utils/id-generator', () => ({
  generateId: vi.fn(() => 'test-agent-id-' + Date.now())
}));

// Mock Auth Utils
vi.mock('../../../utils/auth', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed_${password}`)
}));

// Mock 資料
const mockAgent: Agent = {
  id: 'agent-1',
  email: 'agent@example.com',
  displayName: 'Test Agent',
  passwordHash: 'hashed_password',
  role: 'agent',
  teamId: 1,
  isActive: true,
  passwordPolicy: 'changeable',
  lastActive: null,
  lastLoginAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockTeam = {
  id: 1,
  name: 'Test Team',
  description: 'Test Description',
  leaderId: 'leader-1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

// ======================== Drizzle Mock 設置 ========================

const createMockDb = () => {
  const mockAgents = new Map<string, Agent>();
  const mockTeams = new Map<number, typeof mockTeam>();

  // 預設資料
  mockAgents.set('agent-1', { ...mockAgent });
  mockTeams.set(1, { ...mockTeam });

  const createSelectChain = (table: 'agents' | 'teams') => {
    let whereClause: any = null;
    let joinClause: any = null;
    let orderByClause: any = null;
    let limitValue: number | null = null;
    let offsetValue: number | null = null;
    let selectFields: any = null;

    // Helper function to extract email from where clause
    const extractEmailFromWhere = (whereClause: any): string | null => {
      if (!whereClause) return null;
      // 簡化: 假設 where 條件包含 email
      const whereStr = whereClause.toString();
      if (whereStr.includes('email')) {
        // 嘗試從 mock agents 中找到匹配的
        return null; // 返回 null 表示需要手動匹配
      }
      return null;
    };

    // Helper function to extract id from where clause
    const extractIdFromWhere = (whereClause: any): string | null => {
      if (!whereClause) return null;
      return null; // 返回 null 表示需要手動匹配
    };

    const chain = {
      from: (tableRef: any) => chain,
      select: (fields?: any) => {
        selectFields = fields;
        return chain;
      },
      leftJoin: (tableRef: any, condition: any) => {
        joinClause = { table: tableRef, condition };
        return chain;
      },
      where: (condition: any) => {
        whereClause = condition;
        return chain;
      },
      orderBy: (...args: any[]) => {
        orderByClause = args;
        return chain;
      },
      limit: (value: number) => {
        limitValue = value;
        return chain;
      },
      offset: (value: number) => {
        offsetValue = value;
        return chain;
      },
      get: async () => {
        if (table === 'agents') {
          let agents = Array.from(mockAgents.values());

          // 嘗試應用 where 條件 (簡化版本)
          // 這裡我們依賴測試呼叫的順序和 mock 資料狀態
          const agent = agents[0] || null;

          if (!agent) return null;

          if (joinClause) {
            // 包含 team 資料
            const team = mockTeams.get(agent.teamId || 0);
            return {
              ...agent,
              teamName: team?.name || null
            };
          }

          return agent;
        }

        if (table === 'teams') {
          let teams = Array.from(mockTeams.values());
          return teams[0] || null;
        }

        return null;
      },
      all: async () => {
        if (table === 'agents') {
          let results = Array.from(mockAgents.values());

          // 應用 offset 和 limit
          if (offsetValue !== null) {
            results = results.slice(offsetValue);
          }
          if (limitValue !== null) {
            results = results.slice(0, limitValue);
          }

          // 如果有 join, 加入 teamName
          if (joinClause) {
            return results.map(agent => {
              const team = mockTeams.get(agent.teamId || 0);
              return {
                ...agent,
                teamName: team?.name || null
              };
            });
          }

          return results;
        }

        return [];
      }
    };

    return chain;
  };

  return {
    select: (fields?: any) => createSelectChain('agents'),
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: () => ({
          get: async () => {
            const newAgent = { ...data };
            mockAgents.set(newAgent.id, newAgent);
            return newAgent;
          }
        })
      })
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => ({
          returning: () => ({
            get: async () => {
              const agent = Array.from(mockAgents.values())[0];
              if (!agent) return null;

              const updated = { ...agent, ...data };
              mockAgents.set(agent.id, updated);
              return updated;
            }
          })
        })
      })
    }),
    delete: (table: any) => ({
      where: (condition: any) => ({
        returning: () => ({
          get: async () => {
            const agent = Array.from(mockAgents.values())[0];
            if (agent) {
              mockAgents.delete(agent.id);
            }
            return agent || null;
          }
        })
      })
    }),
    // 內部狀態訪問 (僅測試使用)
    _mockData: {
      agents: mockAgents,
      teams: mockTeams
    }
  };
};

// ======================== CRUD 操作測試 ========================

describe('AgentService - CRUD Operations', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let agentService: AgentService;

  beforeEach(() => {
    mockDb = createMockDb();
    agentService = new AgentService(mockDb as any);
    vi.clearAllMocks();
    // 清空資料以確保每個測試獨立
    mockDb._mockData.agents.clear();
    mockDb._mockData.teams.clear();
    // 重新添加預設 team
    mockDb._mockData.teams.set(1, { ...mockTeam });
  });

  describe('createAgent', () => {
    it('should create a new agent successfully', async () => {
      // 清空 agents 以避免 email 衝突
      mockDb._mockData.agents.clear();

      const request: CreateAgentRequest = {
        email: 'new.agent@example.com',
        displayName: 'New Agent',
        role: 'agent',
        teamId: 1
      };

      const result = await agentService.createAgent(request);

      expect(result).toMatchObject({
        email: request.email,
        displayName: request.displayName,
        role: request.role,
        teamId: request.teamId,
        isActive: true,
        passwordPolicy: 'changeable'
      });
      expect(result.id).toBeDefined();
      expect(result.passwordHash).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create agent without teamId', async () => {
      mockDb._mockData.agents.clear();

      const request: CreateAgentRequest = {
        email: 'solo.agent@example.com',
        displayName: 'Solo Agent'
      };

      const result = await agentService.createAgent(request);

      expect(result.email).toBe(request.email);
      expect(result.teamId).toBeNull();
      expect(result.role).toBe('agent'); // 預設角色
    });

    it('should throw error if email already exists', async () => {
      mockDb._mockData.agents.clear();

      // 第一次建立
      const request: CreateAgentRequest = {
        email: 'duplicate@example.com',
        displayName: 'Duplicate Agent'
      };

      await agentService.createAgent(request);

      // 嘗試用相同 email 再次建立
      await expect(
        agentService.createAgent(request)
      ).rejects.toThrow(AgentAlreadyExistsError);
    });

    it('should throw error if teamId does not exist', async () => {
      mockDb._mockData.agents.clear();
      // 清空 teams
      mockDb._mockData.teams.clear();

      const request: CreateAgentRequest = {
        email: 'orphan@example.com',
        displayName: 'Orphan Agent',
        teamId: 999
      };

      await expect(
        agentService.createAgent(request)
      ).rejects.toThrow(InvalidAgentDataError);
    });

    it('should use provided passwordHash if given', async () => {
      mockDb._mockData.agents.clear();

      const request: CreateAgentRequest = {
        email: 'custom.pwd@example.com',
        displayName: 'Custom Password Agent',
        passwordHash: 'custom_hash_123'
      };

      const result = await agentService.createAgent(request);

      expect(result.passwordHash).toBe('custom_hash_123');
    });

    it('should default isActive to true if not specified', async () => {
      mockDb._mockData.agents.clear();

      const request: CreateAgentRequest = {
        email: 'active@example.com',
        displayName: 'Active Agent'
      };

      const result = await agentService.createAgent(request);

      expect(result.isActive).toBe(true);
    });

    it('should respect isActive when set to false', async () => {
      mockDb._mockData.agents.clear();

      const request: CreateAgentRequest = {
        email: 'inactive@example.com',
        displayName: 'Inactive Agent',
        isActive: false
      };

      const result = await agentService.createAgent(request);

      expect(result.isActive).toBe(false);
    });
  });

  describe('getAgent', () => {
    beforeEach(() => {
      // 確保有測試資料
      mockDb._mockData.agents.set('agent-1', { ...mockAgent });
      mockDb._mockData.teams.set(1, { ...mockTeam });
    });

    it('should get agent with details', async () => {
      const result = await agentService.getAgent('agent-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('agent-1');
      expect(result?.email).toBe('agent@example.com');
      expect(result?.teamName).toBe('Test Team');
    });

    it('should not return passwordHash', async () => {
      const result = await agentService.getAgent('agent-1');

      expect(result?.passwordHash).toBe('');
    });

    it('should return null for non-existent agent', async () => {
      mockDb._mockData.agents.clear();

      const result = await agentService.getAgent('non-existent');

      expect(result).toBeNull();
    });

    it('should handle agent without team', async () => {
      const agentWithoutTeam = {
        ...mockAgent,
        id: 'agent-no-team',
        teamId: null
      };
      mockDb._mockData.agents.clear();
      mockDb._mockData.agents.set('agent-no-team', agentWithoutTeam);

      const result = await agentService.getAgent('agent-no-team');

      expect(result?.teamName).toBeNull();
    });
  });

  describe('updateAgent', () => {
    beforeEach(() => {
      mockDb._mockData.agents.clear();
      mockDb._mockData.teams.clear();
      mockDb._mockData.agents.set('agent-1', { ...mockAgent });
      mockDb._mockData.teams.set(1, { ...mockTeam });
    });

    it('should update agent successfully', async () => {
      const updates: UpdateAgentRequest = {
        displayName: 'Updated Agent Name'
      };

      const result = await agentService.updateAgent('agent-1', updates);

      expect(result.displayName).toBe('Updated Agent Name');
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error if agent not found', async () => {
      mockDb._mockData.agents.clear();

      await expect(
        agentService.updateAgent('non-existent', { displayName: 'Test' })
      ).rejects.toThrow(AgentNotFoundError);
    });

    it('should allow updating role', async () => {
      const updates: UpdateAgentRequest = {
        role: 'team'
      };

      const result = await agentService.updateAgent('agent-1', updates);

      expect(result.role).toBe('team');
    });

    it('should allow updating teamId', async () => {
      // 新增另一個 team
      mockDb._mockData.teams.set(2, {
        ...mockTeam,
        id: 2,
        name: 'Team 2'
      });

      const updates: UpdateAgentRequest = {
        teamId: 2
      };

      const result = await agentService.updateAgent('agent-1', updates);

      expect(result.teamId).toBe(2);
    });

    it('should throw error if new teamId does not exist', async () => {
      const updates: UpdateAgentRequest = {
        teamId: 999
      };

      await expect(
        agentService.updateAgent('agent-1', updates)
      ).rejects.toThrow(InvalidAgentDataError);
    });

    it('should allow updating isActive status', async () => {
      const updates: UpdateAgentRequest = {
        isActive: false
      };

      const result = await agentService.updateAgent('agent-1', updates);

      expect(result.isActive).toBe(false);
    });

    it('should throw error if email conflicts with another agent', async () => {
      // 建立第二個 agent
      const agent2 = {
        ...mockAgent,
        id: 'agent-2',
        email: 'agent2@example.com'
      };
      mockDb._mockData.agents.set('agent-2', agent2);

      // 嘗試將 agent-1 的 email 改成 agent-2 的 email
      const updates: UpdateAgentRequest = {
        email: 'agent2@example.com'
      };

      await expect(
        agentService.updateAgent('agent-1', updates)
      ).rejects.toThrow(AgentAlreadyExistsError);
    });

    it('should allow updating email to same value', async () => {
      const updates: UpdateAgentRequest = {
        email: 'agent@example.com' // 相同的 email
      };

      const result = await agentService.updateAgent('agent-1', updates);

      expect(result.email).toBe('agent@example.com');
    });
  });

  describe('deleteAgent', () => {
    beforeEach(() => {
      mockDb._mockData.agents.set('agent-1', { ...mockAgent });
    });

    it('should delete agent successfully', async () => {
      const result = await agentService.deleteAgent('agent-1');

      expect(result).toBe(true);
      expect(mockDb._mockData.agents.has('agent-1')).toBe(false);
    });

    it('should return false for non-existent agent', async () => {
      mockDb._mockData.agents.clear();

      const result = await agentService.deleteAgent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listAgents', () => {
    beforeEach(() => {
      // 建立多個 agents
      mockDb._mockData.agents.clear();
      for (let i = 1; i <= 25; i++) {
        mockDb._mockData.agents.set(`agent-${i}`, {
          ...mockAgent,
          id: `agent-${i}`,
          email: `agent${i}@example.com`,
          displayName: `Agent ${i}`,
          isActive: i % 2 === 0, // 偶數為 active
          teamId: i % 3 === 0 ? 1 : null,
          createdAt: new Date(2024, 0, i).toISOString()
        });
      }
    });

    it('should list agents with pagination', async () => {
      const result = await agentService.listAgents({
        page: 1,
        limit: 10
      });

      expect(result.agents).toHaveLength(10);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 25
      });
    });

    it('should filter by isActive', async () => {
      const result = await agentService.listAgents({
        page: 1,
        limit: 50,
        includeInactive: false
      });

      expect(result.agents.every(a => a.isActive)).toBe(true);
    });

    it('should include inactive agents when requested', async () => {
      const result = await agentService.listAgents({
        page: 1,
        limit: 50,
        includeInactive: true
      });

      expect(result.agents.length).toBe(25);
    });

    it('should filter by teamId', async () => {
      const result = await agentService.listAgents({
        page: 1,
        limit: 50,
        teamId: 1
      });

      expect(result.agents.every(a => a.teamId === 1)).toBe(true);
    });

    it('should search by keyword', async () => {
      const result = await agentService.listAgents({
        page: 1,
        limit: 50,
        search: 'agent10'
      });

      expect(result.agents.length).toBeGreaterThan(0);
    });

    it('should default to page 1 and limit 20', async () => {
      const result = await agentService.listAgents({});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should not expose passwordHash in list', async () => {
      const result = await agentService.listAgents({ page: 1, limit: 5 });

      result.agents.forEach(agent => {
        expect(agent.passwordHash).toBe('');
      });
    });
  });

  describe('searchAgents', () => {
    beforeEach(() => {
      mockDb._mockData.agents.clear();
      mockDb._mockData.agents.set('agent-1', {
        ...mockAgent,
        id: 'agent-1',
        email: 'john@example.com',
        displayName: 'John Doe',
        role: 'agent',
        teamId: 1,
        isActive: true,
        lastActive: '2024-06-01T00:00:00.000Z'
      });
      mockDb._mockData.agents.set('agent-2', {
        ...mockAgent,
        id: 'agent-2',
        email: 'jane@example.com',
        displayName: 'Jane Smith',
        role: 'team',
        teamId: 1,
        isActive: false,
        lastActive: '2024-05-01T00:00:00.000Z'
      });
    });

    it('should search by keyword', async () => {
      const result = await agentService.searchAgents({
        keyword: 'john'
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by isActive', async () => {
      const result = await agentService.searchAgents({
        isActive: true
      });

      expect(result.every(a => a.isActive)).toBe(true);
    });

    it('should limit results', async () => {
      const result = await agentService.searchAgents({
        limit: 1
      });

      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('should support offset pagination', async () => {
      const result = await agentService.searchAgents({
        limit: 1,
        offset: 1
      });

      expect(result.length).toBeLessThanOrEqual(1);
    });
  });

  describe('batchUpdateAgents', () => {
    beforeEach(() => {
      mockDb._mockData.agents.clear();
      mockDb._mockData.agents.set('agent-1', { ...mockAgent, id: 'agent-1' });
      mockDb._mockData.agents.set('agent-2', { ...mockAgent, id: 'agent-2' });
      mockDb._mockData.agents.set('agent-3', { ...mockAgent, id: 'agent-3' });
    });

    it('should update multiple agents', async () => {
      const result = await agentService.batchUpdateAgents({
        agentIds: ['agent-1', 'agent-2'],
        updates: { isActive: false }
      });

      expect(result).toHaveLength(2);
      result.forEach(agent => {
        expect(agent.isActive).toBe(false);
      });
    });

    it('should continue on individual errors', async () => {
      const result = await agentService.batchUpdateAgents({
        agentIds: ['agent-1', 'non-existent', 'agent-2'],
        updates: { displayName: 'Updated' }
      });

      // 應該成功更新存在的 agents, 跳過不存在的
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('batchTransferAgents', () => {
    beforeEach(() => {
      mockDb._mockData.agents.clear();
      mockDb._mockData.agents.set('agent-1', { ...mockAgent, id: 'agent-1', teamId: 1 });
      mockDb._mockData.agents.set('agent-2', { ...mockAgent, id: 'agent-2', teamId: 1 });

      mockDb._mockData.teams.set(1, { ...mockTeam, id: 1 });
      mockDb._mockData.teams.set(2, { ...mockTeam, id: 2, name: 'Team 2' });
    });

    it('should transfer agents to new team', async () => {
      const result = await agentService.batchTransferAgents({
        agentIds: ['agent-1', 'agent-2'],
        toTeamId: 2,
        reason: 'Reorganization'
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should throw error if target team does not exist', async () => {
      await expect(
        agentService.batchTransferAgents({
          agentIds: ['agent-1'],
          toTeamId: 999
        })
      ).rejects.toThrow(InvalidAgentDataError);
    });

    it('should return errors for invalid agents', async () => {
      const result = await agentService.batchTransferAgents({
        agentIds: ['agent-1', 'non-existent'],
        toTeamId: 2
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ======================== 錯誤處理測試 ========================

describe('AgentService - Error Handling', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let agentService: AgentService;

  beforeEach(() => {
    mockDb = createMockDb();
    agentService = new AgentService(mockDb as any);
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
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

  it('should wrap non-Error objects', async () => {
    const errorDb = {
      insert: () => ({
        values: () => ({
          returning: () => ({
            get: async () => {
              throw 'String error'; // 非 Error 物件
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
        email: 'test@example.com',
        displayName: 'Test'
      })
    ).rejects.toThrow('Failed to create agent');
  });
});
