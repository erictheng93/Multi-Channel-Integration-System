// Agent Skills Service - 客服代理技能管理服務
// Agent Skills Management Service

import type {
  AgentSkill,
  AddSkillRequest,
  UpdateSkillRequest,
  SkillCategory,
  SkillLevel
} from '../types/agent-types';
import { generateId } from '@/utils/id-generator';

export class AgentSkillsService {
  constructor(private kv: KVNamespace) {}

  // 新增技能
  async addSkill(agentId: string, skill: AddSkillRequest): Promise<AgentSkill> {
    try {
      const skillId = generateId();
      const newSkill: AgentSkill = {
        id: skillId,
        name: skill.name,
        category: skill.category,
        level: skill.level,
        certified: skill.certified || false,
        certifiedAt: skill.certified ? new Date().toISOString() : null,
        description: skill.description || ''
      };

      // 獲取現有技能
      const existingSkills = await this.getAgentSkills(agentId);

      // 檢查是否已存在相同名稱的技能
      const duplicateSkill = existingSkills.find(s => s.name === skill.name);
      if (duplicateSkill) {
        throw new Error(`Skill "${skill.name}" already exists for agent ${agentId}`);
      }

      // 更新技能列表
      const updatedSkills = [...existingSkills, newSkill];
      await this.kv.put(`agent:${agentId}:skills`, JSON.stringify(updatedSkills));

      return newSkill;
    } catch (error) {
      throw new Error(`Failed to add skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 更新技能
  async updateSkill(agentId: string, skillId: string, updates: UpdateSkillRequest): Promise<AgentSkill> {
    try {
      const existingSkills = await this.getAgentSkills(agentId);
      const skillIndex = existingSkills.findIndex(s => s.id === skillId);

      if (skillIndex === -1) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const existingSkill = existingSkills[skillIndex];
      if (!existingSkill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const updatedSkill: AgentSkill = {
        ...existingSkill,
        ...updates,
        certifiedAt: updates.certified !== undefined
          ? (updates.certified ? new Date().toISOString() : null)
          : existingSkill.certifiedAt
      };

      existingSkills[skillIndex] = updatedSkill;
      await this.kv.put(`agent:${agentId}:skills`, JSON.stringify(existingSkills));

      return updatedSkill;
    } catch (error) {
      throw new Error(`Failed to update skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 移除技能
  async removeSkill(agentId: string, skillId: string): Promise<boolean> {
    try {
      const existingSkills = await this.getAgentSkills(agentId);
      const filteredSkills = existingSkills.filter(s => s.id !== skillId);

      if (filteredSkills.length === existingSkills.length) {
        return false; // 沒有找到要移除的技能
      }

      await this.kv.put(`agent:${agentId}:skills`, JSON.stringify(filteredSkills));
      return true;
    } catch (error) {
      throw new Error(`Failed to remove skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 獲取代理的所有技能
  async getAgentSkills(agentId: string): Promise<AgentSkill[]> {
    try {
      const skillsData = await this.kv.get(`agent:${agentId}:skills`);
      return skillsData ? JSON.parse(skillsData) : [];
    } catch (error) {
      throw new Error(`Failed to get agent skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 根據類別獲取技能
  async getSkillsByCategory(agentId: string, category: SkillCategory): Promise<AgentSkill[]> {
    try {
      const allSkills = await this.getAgentSkills(agentId);
      return allSkills.filter(skill => skill.category === category);
    } catch (error) {
      throw new Error(`Failed to get skills by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 根據等級獲取技能
  async getSkillsByLevel(agentId: string, level: SkillLevel): Promise<AgentSkill[]> {
    try {
      const allSkills = await this.getAgentSkills(agentId);
      return allSkills.filter(skill => skill.level === level);
    } catch (error) {
      throw new Error(`Failed to get skills by level: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 獲取已認證的技能
  async getCertifiedSkills(agentId: string): Promise<AgentSkill[]> {
    try {
      const allSkills = await this.getAgentSkills(agentId);
      return allSkills.filter(skill => skill.certified);
    } catch (error) {
      throw new Error(`Failed to get certified skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 批次更新技能
  async batchUpdateSkills(agentId: string, skillUpdates: Array<{ skillId: string; updates: UpdateSkillRequest }>): Promise<AgentSkill[]> {
    try {
      const existingSkills = await this.getAgentSkills(agentId);
      const updatedSkills = [...existingSkills];

      for (const { skillId, updates } of skillUpdates) {
        const skillIndex = updatedSkills.findIndex(s => s.id === skillId);
        if (skillIndex !== -1) {
          const existingSkill = updatedSkills[skillIndex];
          if (existingSkill) {
            updatedSkills[skillIndex] = {
              ...existingSkill,
              ...updates,
              certifiedAt: updates.certified !== undefined
                ? (updates.certified ? new Date().toISOString() : null)
                : existingSkill.certifiedAt
            };
          }
        }
      }

      await this.kv.put(`agent:${agentId}:skills`, JSON.stringify(updatedSkills));
      return updatedSkills;
    } catch (error) {
      throw new Error(`Failed to batch update skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 搜尋技能
  async searchSkills(agentId: string, searchTerm: string): Promise<AgentSkill[]> {
    try {
      const allSkills = await this.getAgentSkills(agentId);
      const lowerSearchTerm = searchTerm.toLowerCase();

      return allSkills.filter(skill =>
        skill.name.toLowerCase().includes(lowerSearchTerm) ||
        skill.description?.toLowerCase().includes(lowerSearchTerm) ||
        skill.category.toLowerCase().includes(lowerSearchTerm)
      );
    } catch (error) {
      throw new Error(`Failed to search skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 複製技能到另一個代理
  async copySkillsToAgent(fromAgentId: string, toAgentId: string, skillIds?: string[]): Promise<AgentSkill[]> {
    try {
      const sourceSkills = await this.getAgentSkills(fromAgentId);
      const skillsToCopy = skillIds
        ? sourceSkills.filter(skill => skillIds.includes(skill.id))
        : sourceSkills;

      const targetSkills = await this.getAgentSkills(toAgentId);
      const newSkills: AgentSkill[] = [];

      for (const skill of skillsToCopy) {
        // 檢查目標代理是否已有相同名稱的技能
        const duplicateSkill = targetSkills.find(s => s.name === skill.name);
        if (!duplicateSkill) {
          const newSkill: AgentSkill = {
            ...skill,
            id: generateId(), // 生成新的 ID
            certified: false, // 複製的技能預設為未認證
            certifiedAt: null
          };
          newSkills.push(newSkill);
        }
      }

      if (newSkills.length > 0) {
        const updatedTargetSkills = [...targetSkills, ...newSkills];
        await this.kv.put(`agent:${toAgentId}:skills`, JSON.stringify(updatedTargetSkills));
      }

      return newSkills;
    } catch (error) {
      throw new Error(`Failed to copy skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 獲取技能統計
  async getSkillStatistics(agentId: string): Promise<{
    totalSkills: number;
    skillsByCategory: Record<SkillCategory, number>;
    skillsByLevel: Record<SkillLevel, number>;
    certifiedCount: number;
    certificationRate: number;
  }> {
    try {
      const skills = await this.getAgentSkills(agentId);

      const skillsByCategory = skills.reduce((acc, skill) => {
        acc[skill.category] = (acc[skill.category] || 0) + 1;
        return acc;
      }, {} as Record<SkillCategory, number>);

      const skillsByLevel = skills.reduce((acc, skill) => {
        acc[skill.level] = (acc[skill.level] || 0) + 1;
        return acc;
      }, {} as Record<SkillLevel, number>);

      const certifiedCount = skills.filter(skill => skill.certified).length;
      const certificationRate = skills.length > 0 ? (certifiedCount / skills.length) * 100 : 0;

      return {
        totalSkills: skills.length,
        skillsByCategory,
        skillsByLevel,
        certifiedCount,
        certificationRate: Math.round(certificationRate * 100) / 100
      };
    } catch (error) {
      throw new Error(`Failed to get skill statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}