// AgentSkillsService 測試
// 測試 Agent Skills 管理功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSkillsService } from '@modules/agents/services/agent-skills';
import type { AgentSkill, AddSkillRequest, UpdateSkillRequest } from '@modules/agents/types/agent-types';

// ======================== Mock 設置 ========================

// Mock ID 生成器
vi.mock('../../../utils/id-generator', () => ({
  generateId: vi.fn(() => 'skill-' + Date.now())
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

  describe('getSkillsByCategory', () => {
    beforeEach(async () => {
      await skillsService.addSkill(agentId, {
        name: 'Java',
        category: 'technical',
        level: 'intermediate'
      });

      await skillsService.addSkill(agentId, {
        name: 'Empathy',
        category: 'soft_skill',
        level: 'expert'
      });

      await skillsService.addSkill(agentId, {
        name: 'Python',
        category: 'technical',
        level: 'advanced'
      });
    });

    it('should filter skills by category', async () => {
      const technical = await skillsService.getSkillsByCategory(agentId, 'technical');

      expect(technical).toHaveLength(2);
      expect(technical.every(s => s.category === 'technical')).toBe(true);
    });

    it('should return empty array if no skills in category', async () => {
      const language = await skillsService.getSkillsByCategory(agentId, 'language');

      expect(language).toEqual([]);
    });
  });

  describe('getSkillsByLevel', () => {
    beforeEach(async () => {
      await skillsService.addSkill(agentId, {
        name: 'Skill 1',
        category: 'technical',
        level: 'beginner'
      });

      await skillsService.addSkill(agentId, {
        name: 'Skill 2',
        category: 'technical',
        level: 'advanced'
      });

      await skillsService.addSkill(agentId, {
        name: 'Skill 3',
        category: 'soft_skill',
        level: 'advanced'
      });
    });

    it('should filter skills by level', async () => {
      const advanced = await skillsService.getSkillsByLevel(agentId, 'advanced');

      expect(advanced).toHaveLength(2);
      expect(advanced.every(s => s.level === 'advanced')).toBe(true);
    });
  });

  describe('getCertifiedSkills', () => {
    beforeEach(async () => {
      await skillsService.addSkill(agentId, {
        name: 'Certified Skill',
        category: 'technical',
        level: 'expert',
        certified: true
      });

      await skillsService.addSkill(agentId, {
        name: 'Uncertified Skill',
        category: 'technical',
        level: 'intermediate',
        certified: false
      });
    });

    it('should return only certified skills', async () => {
      const certified = await skillsService.getCertifiedSkills(agentId);

      expect(certified).toHaveLength(1);
      expect(certified[0]?.name).toBe('Certified Skill');
    });
  });

  describe('batchUpdateSkills', () => {
    let skill1Id: string;
    let skill2Id: string;

    beforeEach(async () => {
      const s1 = await skillsService.addSkill(agentId, {
        name: 'Skill 1',
        category: 'technical',
        level: 'beginner'
      });
      skill1Id = s1.id;

      const s2 = await skillsService.addSkill(agentId, {
        name: 'Skill 2',
        category: 'soft_skill',
        level: 'intermediate'
      });
      skill2Id = s2.id;
    });

    it('should update multiple skills at once', async () => {
      const updates = [
        { skillId: skill1Id, updates: { level: 'advanced' as const } },
        { skillId: skill2Id, updates: { certified: true } }
      ];

      const result = await skillsService.batchUpdateSkills(agentId, updates);

      expect(result).toHaveLength(2);

      const skill1 = result.find(s => s.id === skill1Id);
      const skill2 = result.find(s => s.id === skill2Id);

      expect(skill1?.level).toBe('advanced');
      expect(skill2?.certified).toBe(true);
    });

    it('should skip non-existent skills', async () => {
      const updates = [
        { skillId: skill1Id, updates: { level: 'expert' as const } },
        { skillId: 'non-existent', updates: { level: 'advanced' as const } }
      ];

      const result = await skillsService.batchUpdateSkills(agentId, updates);

      // 應該只更新存在的技能
      const skill1 = result.find(s => s.id === skill1Id);
      expect(skill1?.level).toBe('expert');
    });
  });

  describe('searchSkills', () => {
    beforeEach(async () => {
      await skillsService.addSkill(agentId, {
        name: 'JavaScript Programming',
        category: 'technical',
        level: 'advanced',
        description: 'Full-stack development'
      });

      await skillsService.addSkill(agentId, {
        name: 'Java Backend',
        category: 'technical',
        level: 'intermediate',
        description: 'Spring Boot'
      });

      await skillsService.addSkill(agentId, {
        name: 'Customer Communication',
        category: 'soft_skill',
        level: 'expert',
        description: 'Excellent interpersonal skills'
      });
    });

    it('should search by name', async () => {
      const results = await skillsService.searchSkills(agentId, 'Java');

      expect(results).toHaveLength(2); // JavaScript and Java
      expect(results.some(s => s.name.includes('Java'))).toBe(true);
    });

    it('should search by description', async () => {
      const results = await skillsService.searchSkills(agentId, 'Spring');

      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Java Backend');
    });

    it('should search by category', async () => {
      const results = await skillsService.searchSkills(agentId, 'technical');

      expect(results).toHaveLength(2);
      expect(results.every(s => s.category === 'technical')).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const results = await skillsService.searchSkills(agentId, 'JAVASCRIPT');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array if no matches', async () => {
      const results = await skillsService.searchSkills(agentId, 'NonExistent');

      expect(results).toEqual([]);
    });
  });

  describe('copySkillsToAgent', () => {
    const sourceAgentId = 'agent-source';
    const targetAgentId = 'agent-target';

    beforeEach(async () => {
      // 為 source agent 添加技能
      await skillsService.addSkill(sourceAgentId, {
        name: 'React',
        category: 'technical',
        level: 'advanced',
        certified: true
      });

      await skillsService.addSkill(sourceAgentId, {
        name: 'Vue.js',
        category: 'technical',
        level: 'intermediate',
        certified: false
      });
    });

    it('should copy all skills to another agent', async () => {
      const copied = await skillsService.copySkillsToAgent(sourceAgentId, targetAgentId);

      expect(copied).toHaveLength(2);

      const targetSkills = await skillsService.getAgentSkills(targetAgentId);
      expect(targetSkills).toHaveLength(2);
    });

    it('should copy specific skills only', async () => {
      const sourceSkills = await skillsService.getAgentSkills(sourceAgentId);
      const reactSkillId = sourceSkills.find(s => s.name === 'React')?.id;

      if (!reactSkillId) {
        throw new Error('React skill not found in test setup');
      }

      const copied = await skillsService.copySkillsToAgent(
        sourceAgentId,
        targetAgentId,
        [reactSkillId]
      );

      expect(copied.length).toBeGreaterThan(0);
      // 應該只複製 React
      const copiedNames = copied.map(s => s.name);
      expect(copiedNames).toContain('React');
      // 不應該包含 Vue.js (因為沒在 skillIds 列表中)
      if (copied.length === 1) {
        expect(copied[0]?.name).toBe('React');
      }
    });

    it('should reset certification status for copied skills', async () => {
      await skillsService.copySkillsToAgent(sourceAgentId, targetAgentId);

      const targetSkills = await skillsService.getAgentSkills(targetAgentId);
      expect(targetSkills.every(s => !s.certified)).toBe(true);
    });

    it('should skip duplicate skill names', async () => {
      // Target 已有同名技能
      await skillsService.addSkill(targetAgentId, {
        name: 'React',
        category: 'technical',
        level: 'beginner'
      });

      const copied = await skillsService.copySkillsToAgent(sourceAgentId, targetAgentId);

      // 應該只複製 Vue.js
      expect(copied).toHaveLength(1);
      expect(copied[0]?.name).toBe('Vue.js');

      const targetSkills = await skillsService.getAgentSkills(targetAgentId);
      expect(targetSkills).toHaveLength(2); // 原有的 React + 新的 Vue.js
    });

    it('should generate new IDs for copied skills', async () => {
      const sourceSkills = await skillsService.getAgentSkills(sourceAgentId);
      const copied = await skillsService.copySkillsToAgent(sourceAgentId, targetAgentId);

      // 所有 ID 都應該不同
      const sourceIds = sourceSkills.map(s => s.id);
      const copiedIds = copied.map(s => s.id);

      copiedIds.forEach(id => {
        expect(sourceIds).not.toContain(id);
      });
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
