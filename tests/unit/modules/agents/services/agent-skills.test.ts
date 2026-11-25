// AgentSkillsService 測試
// Covers the methods agent-main.ts routes call (add/update/remove/list/statistics).
// The service's other helpers (by category/level, search, copy, batch update) have no caller.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSkillsService } from '@modules/agents/services/agent-skills';
import type { AgentSkill, AddSkillRequest, UpdateSkillRequest } from '@modules/agents/types/agent-types';

// ======================== Mock 設置 ========================

// Deterministic, unique IDs: Date.now()-based IDs collide within one millisecond, which
// would make updateSkill/removeSkill hit the wrong skill.
const idCounter = vi.hoisted(() => ({ n: 0 }));
vi.mock('@/utils/id-generator', () => ({
  generateId: vi.fn(() => `skill-${++idCounter.n}`)
}));

// Mock KV Namespace
const createMockKV = () => {
  const storage = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => {
      return storage.get(key) || null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    // 測試用: 直接訪問儲存
    _storage: storage
  };
};

// ======================== Skills Management 測試 ========================

describe('AgentSkillsService - Skills Management', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let skillsService: AgentSkillsService;

  const agentId = 'agent-123';

  beforeEach(() => {
    mockKV = createMockKV();
    skillsService = new AgentSkillsService(mockKV as any);
    vi.clearAllMocks();
  });

  describe('addSkill', () => {
    it('should add a new skill successfully', async () => {
      const skillData: AddSkillRequest = {
        name: 'JavaScript',
        category: 'technical',
        level: 'advanced',
        description: 'Expert in ES6+'
      };

      const result = await skillsService.addSkill(agentId, skillData);

      expect(result).toMatchObject({
        name: skillData.name,
        category: skillData.category,
        level: skillData.level,
        description: skillData.description,
        certified: false
      });
      expect(result.id).toBeDefined();
      expect(result.certifiedAt).toBeNull();
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should mark skill as certified if requested', async () => {
      const skillData: AddSkillRequest = {
        name: 'Customer Service',
        category: 'soft_skill',
        level: 'expert',
        certified: true
      };

      const result = await skillsService.addSkill(agentId, skillData);

      expect(result.certified).toBe(true);
      expect(result.certifiedAt).toBeDefined();
    });

    it('should throw error if skill name already exists', async () => {
      const skillData: AddSkillRequest = {
        name: 'Python',
        category: 'technical',
        level: 'beginner'
      };

      await skillsService.addSkill(agentId, skillData);

      await expect(
        skillsService.addSkill(agentId, skillData)
      ).rejects.toThrow('Skill "Python" already exists');
    });

    it('should use empty string for missing description', async () => {
      const skillData: AddSkillRequest = {
        name: 'React',
        category: 'technical',
        level: 'intermediate'
      };

      const result = await skillsService.addSkill(agentId, skillData);

      expect(result.description).toBe('');
    });
  });

  describe('getAgentSkills', () => {
    it('should return empty array for new agent', async () => {
      const result = await skillsService.getAgentSkills(agentId);

      expect(result).toEqual([]);
    });

    it('should return all skills for an agent', async () => {
      // 新增幾個技能
      await skillsService.addSkill(agentId, {
        name: 'TypeScript',
        category: 'technical',
        level: 'advanced'
      });

      await skillsService.addSkill(agentId, {
        name: 'Communication',
        category: 'soft_skill',
        level: 'expert'
      });

      const result = await skillsService.getAgentSkills(agentId);

      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('TypeScript');
      expect(result.map(s => s.name)).toContain('Communication');
    });
  });

  describe('updateSkill', () => {
    let existingSkillId: string;

    beforeEach(async () => {
      const skill = await skillsService.addSkill(agentId, {
        name: 'Vue.js',
        category: 'technical',
        level: 'beginner'
      });
      existingSkillId = skill.id;
    });

    it('should update skill level', async () => {
      const updates: UpdateSkillRequest = {
        level: 'advanced'
      };

      const result = await skillsService.updateSkill(agentId, existingSkillId, updates);

      expect(result.level).toBe('advanced');
      expect(result.name).toBe('Vue.js'); // 保持不變
    });

    it('should update skill description', async () => {
      const updates: UpdateSkillRequest = {
        description: 'Proficient in Vue 3 Composition API'
      };

      const result = await skillsService.updateSkill(agentId, existingSkillId, updates);

      expect(result.description).toBe('Proficient in Vue 3 Composition API');
    });

    it('should update certified status', async () => {
      const updates: UpdateSkillRequest = {
        certified: true
      };

      const result = await skillsService.updateSkill(agentId, existingSkillId, updates);

      expect(result.certified).toBe(true);
      expect(result.certifiedAt).toBeDefined();
    });

    it('should remove certified status when set to false', async () => {
      // 先設為 certified
      await skillsService.updateSkill(agentId, existingSkillId, {
        certified: true
      });

      // 再設回 false
      const result = await skillsService.updateSkill(agentId, existingSkillId, {
        certified: false
      });

      expect(result.certified).toBe(false);
      expect(result.certifiedAt).toBeNull();
    });

    it('should throw error if skill not found', async () => {
      await expect(
        skillsService.updateSkill(agentId, 'non-existent-skill', { level: 'expert' })
      ).rejects.toThrow('Skill not found');
    });
  });

  describe('removeSkill', () => {
    let skillId: string;

    beforeEach(async () => {
      const skill = await skillsService.addSkill(agentId, {
        name: 'Node.js',
        category: 'technical',
        level: 'advanced'
      });
      skillId = skill.id;
    });

    it('should remove skill successfully', async () => {
      const result = await skillsService.removeSkill(agentId, skillId);

      expect(result).toBe(true);

      const skills = await skillsService.getAgentSkills(agentId);
      expect(skills).toHaveLength(0);
    });

    it('should return false if skill not found', async () => {
      const result = await skillsService.removeSkill(agentId, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getSkillStatistics', () => {
    beforeEach(async () => {
      await skillsService.addSkill(agentId, {
        name: 'JavaScript',
        category: 'technical',
        level: 'expert',
        certified: true
      });

      await skillsService.addSkill(agentId, {
        name: 'Python',
        category: 'technical',
        level: 'advanced',
        certified: false
      });

      await skillsService.addSkill(agentId, {
        name: 'Communication',
        category: 'soft_skill',
        level: 'expert',
        certified: true
      });

      await skillsService.addSkill(agentId, {
        name: 'Product Knowledge',
        category: 'product',
        level: 'intermediate',
        certified: false
      });
    });

    it('should return correct statistics', async () => {
      const stats = await skillsService.getSkillStatistics(agentId);

      expect(stats.totalSkills).toBe(4);
      expect(stats.certifiedCount).toBe(2);
      expect(stats.certificationRate).toBe(50);
    });

    it('should categorize skills correctly', async () => {
      const stats = await skillsService.getSkillStatistics(agentId);

      expect(stats.skillsByCategory.technical).toBe(2);
      expect(stats.skillsByCategory.soft_skill).toBe(1);
      expect(stats.skillsByCategory.product).toBe(1);
    });

    it('should level skills correctly', async () => {
      const stats = await skillsService.getSkillStatistics(agentId);

      expect(stats.skillsByLevel.expert).toBe(2);
      expect(stats.skillsByLevel.advanced).toBe(1);
      expect(stats.skillsByLevel.intermediate).toBe(1);
    });

    it('should handle agent with no skills', async () => {
      const emptyStats = await skillsService.getSkillStatistics('empty-agent');

      expect(emptyStats.totalSkills).toBe(0);
      expect(emptyStats.certifiedCount).toBe(0);
      expect(emptyStats.certificationRate).toBe(0);
    });
  });
});

// ======================== 錯誤處理測試 ========================

describe('AgentSkillsService - Error Handling', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let skillsService: AgentSkillsService;

  beforeEach(() => {
    mockKV = createMockKV();
    skillsService = new AgentSkillsService(mockKV as any);
  });

  it('should handle KV errors gracefully on get', async () => {
    mockKV.get.mockRejectedValue(new Error('KV error'));

    await expect(
      skillsService.getAgentSkills('any-agent')
    ).rejects.toThrow('Failed to get agent skills');
  });

  it('should handle KV errors gracefully on put', async () => {
    mockKV.put.mockRejectedValue(new Error('KV error'));

    await expect(
      skillsService.addSkill('any-agent', {
        name: 'Test',
        category: 'technical',
        level: 'beginner'
      })
    ).rejects.toThrow('Failed to add skill');
  });

  it('should handle invalid JSON in KV', async () => {
    mockKV.get.mockResolvedValue('invalid json{]');

    await expect(
      skillsService.getAgentSkills('any-agent')
    ).rejects.toThrow();
  });
});
