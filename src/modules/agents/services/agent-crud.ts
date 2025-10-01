// Agent CRUD Service - 客服代理 CRUD 操作服務
// Agent CRUD Operations Service

import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { agents, teams } from '../../../db/schema';
import type {
  Agent,
  NewAgent,
  AgentWithDetails,
  AgentServiceInterface,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentListRequest,
  AgentListResponse,
  AgentSearchQuery,
  BatchUpdateAgentsRequest,
  BatchTransferAgentsRequest,
  AgentPermissionError
} from '../types/agent-types';
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  InvalidAgentDataError
} from '../types/agent-types';
import { generateId } from '../../../utils/id-generator';
import { hashPassword } from '../../../utils/auth';

export class AgentService implements AgentServiceInterface {
  constructor(private db: DrizzleD1Database<any>) {}

  // CRUD 操作
  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    try {
      // 檢查 email 是否已存在
      const existingAgent = await this.db
        .select()
        .from(agents)
        .where(eq(agents.email, data.email))
        .get();

      if (existingAgent) {
        throw new AgentAlreadyExistsError(data.email);
      }

      // 驗證 teamId 是否存在（如果提供）
      if (data.teamId) {
        const team = await this.db
          .select()
          .from(teams)
          .where(eq(teams.id, data.teamId))
          .get();

        if (!team) {
          throw new InvalidAgentDataError(`Team not found: ${data.teamId}`);
        }
      }

      const agentId = generateId();
      const passwordHash = data.passwordHash || await hashPassword(generateId()); // 臨時密碼

      const newAgent: NewAgent = {
        id: agentId,
        email: data.email,
        displayName: data.displayName,
        passwordHash,
        role: data.role || 'agent',
        teamId: data.teamId || null,
        isActive: data.isActive !== false,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await this.db
        .insert(agents)
        .values(newAgent)
        .returning()
        .get();

      return result;
    } catch (error) {
      if (error instanceof AgentAlreadyExistsError || error instanceof InvalidAgentDataError) {
        throw error;
      }
      throw new Error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAgent(id: string): Promise<AgentWithDetails | null> {
    try {
      const result = await this.db
        .select({
          id: agents.id,
          email: agents.email,
          displayName: agents.displayName,
          role: agents.role,
          teamId: agents.teamId,
          isActive: agents.isActive,
          passwordPolicy: agents.passwordPolicy,
          lastActive: agents.lastActive,
          lastLoginAt: agents.lastLoginAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          teamName: teams.name,
        })
        .from(agents)
        .leftJoin(teams, eq(agents.teamId, teams.id))
        .where(eq(agents.id, id))
        .get();

      if (!result) {
        return null;
      }

      return {
        ...result,
        passwordHash: '', // 不返回密碼雜湊
        teamName: result.teamName || null,
      };
    } catch (error) {
      throw new Error(`Failed to get agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateAgent(id: string, data: UpdateAgentRequest): Promise<Agent> {
    try {
      // 檢查 agent 是否存在
      const existingAgent = await this.db
        .select()
        .from(agents)
        .where(eq(agents.id, id))
        .get();

      if (!existingAgent) {
        throw new AgentNotFoundError(id);
      }

      // 檢查 email 是否與其他 agent 重複
      if (data.email && data.email !== existingAgent.email) {
        const duplicateAgent = await this.db
          .select()
          .from(agents)
          .where(and(
            eq(agents.email, data.email),
            sql`${agents.id} != ${id}`
          ))
          .get();

        if (duplicateAgent) {
          throw new AgentAlreadyExistsError(data.email);
        }
      }

      // 驗證 teamId 是否存在（如果提供）
      if (data.teamId) {
        const team = await this.db
          .select()
          .from(teams)
          .where(eq(teams.id, data.teamId))
          .get();

        if (!team) {
          throw new InvalidAgentDataError(`Team not found: ${data.teamId}`);
        }
      }

      const updatedData = {
        ...data,
        updatedAt: new Date().toISOString()
      };

      const result = await this.db
        .update(agents)
        .set(updatedData)
        .where(eq(agents.id, id))
        .returning()
        .get();

      return result;
    } catch (error) {
      if (error instanceof AgentNotFoundError || error instanceof AgentAlreadyExistsError || error instanceof InvalidAgentDataError) {
        throw error;
      }
      throw new Error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAgent(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(agents)
        .where(eq(agents.id, id))
        .returning()
        .get();

      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 列表和搜尋
  async listAgents(params: AgentListRequest): Promise<AgentListResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        includeInactive = false,
        search,
        teamId,
        role,
        status
      } = params;

      const offset = (page - 1) * limit;

      // 建立基本查詢條件
      const conditions = [];

      if (!includeInactive) {
        conditions.push(eq(agents.isActive, true));
      }

      if (search) {
        conditions.push(
          sql`(${agents.displayName} LIKE ${`%${search}%`} OR ${agents.email} LIKE ${`%${search}%`})`
        );
      }

      if (teamId) {
        conditions.push(eq(agents.teamId, teamId));
      }

      if (role) {
        conditions.push(eq(agents.role, role));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 查詢資料
      const agentsData = await this.db
        .select({
          id: agents.id,
          email: agents.email,
          displayName: agents.displayName,
          role: agents.role,
          teamId: agents.teamId,
          isActive: agents.isActive,
          passwordPolicy: agents.passwordPolicy,
          lastActive: agents.lastActive,
          lastLoginAt: agents.lastLoginAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          teamName: teams.name,
        })
        .from(agents)
        .leftJoin(teams, eq(agents.teamId, teams.id))
        .where(whereClause)
        .orderBy(desc(agents.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // 查詢總數
      const totalResult = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(agents)
        .where(whereClause)
        .get();

      const total = Number(totalResult?.count) || 0;
      const totalPages = Math.ceil(total / limit);

      const agentsWithDetails: AgentWithDetails[] = agentsData.map(agent => ({
        ...agent,
        passwordHash: '', // 不返回密碼雜湊
        teamName: agent.teamName || null,
      }));

      return {
        agents: agentsWithDetails,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      throw new Error(`Failed to list agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchAgents(query: AgentSearchQuery): Promise<AgentWithDetails[]> {
    try {
      const conditions = [];

      if (query.keyword) {
        conditions.push(
          sql`(${agents.displayName} LIKE ${`%${query.keyword}%`} OR ${agents.email} LIKE ${`%${query.keyword}%`})`
        );
      }

      if (query.teamIds && query.teamIds.length > 0) {
        conditions.push(sql`${agents.teamId} IN (${query.teamIds.join(',')})`);
      }

      if (query.roles && query.roles.length > 0) {
        conditions.push(sql`${agents.role} IN (${query.roles.map(r => `'${r}'`).join(',')})`);
      }

      if (query.isActive !== undefined) {
        conditions.push(eq(agents.isActive, query.isActive));
      }

      if (query.lastActiveAfter) {
        conditions.push(sql`${agents.lastActive} >= ${query.lastActiveAfter}`);
      }

      if (query.lastActiveBefore) {
        conditions.push(sql`${agents.lastActive} <= ${query.lastActiveBefore}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await this.db
        .select({
          id: agents.id,
          email: agents.email,
          displayName: agents.displayName,
          role: agents.role,
          teamId: agents.teamId,
          isActive: agents.isActive,
          passwordPolicy: agents.passwordPolicy,
          lastActive: agents.lastActive,
          lastLoginAt: agents.lastLoginAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          teamName: teams.name,
        })
        .from(agents)
        .leftJoin(teams, eq(agents.teamId, teams.id))
        .where(whereClause)
        .orderBy(desc(agents.lastActive))
        .limit(query.limit || 50)
        .offset(query.offset || 0)
        .all();

      return results.map(agent => ({
        ...agent,
        passwordHash: '', // 不返回密碼雜湊
        teamName: agent.teamName || null,
      }));
    } catch (error) {
      throw new Error(`Failed to search agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 批次操作
  async batchUpdateAgents(request: BatchUpdateAgentsRequest): Promise<Agent[]> {
    try {
      const { agentIds, updates } = request;
      const updatedAgents: Agent[] = [];

      for (const agentId of agentIds) {
        try {
          const updatedAgent = await this.updateAgent(agentId, updates);
          updatedAgents.push(updatedAgent);
        } catch (error) {
          // 記錄錯誤但繼續處理其他 agents
          console.error(`Failed to update agent ${agentId}:`, error);
        }
      }

      return updatedAgents;
    } catch (error) {
      throw new Error(`Failed to batch update agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async batchTransferAgents(request: BatchTransferAgentsRequest): Promise<{ success: boolean; errors: any[] }> {
    try {
      const { agentIds, toTeamId, reason } = request;
      const errors: any[] = [];

      // 驗證目標團隊是否存在
      const targetTeam = await this.db
        .select()
        .from(teams)
        .where(eq(teams.id, toTeamId))
        .get();

      if (!targetTeam) {
        throw new InvalidAgentDataError(`Target team not found: ${toTeamId}`);
      }

      // 批次轉移
      for (const agentId of agentIds) {
        try {
          await this.updateAgent(agentId, { teamId: toTeamId });
        } catch (error) {
          errors.push({
            agentId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        success: errors.length === 0,
        errors
      };
    } catch (error) {
      throw error;
    }
  }

  // 佔位符方法 - 這些需要額外的服務來實現
  async addSkill(): Promise<any> {
    throw new Error('Method not implemented - use AgentSkillsService');
  }

  async updateSkill(): Promise<any> {
    throw new Error('Method not implemented - use AgentSkillsService');
  }

  async removeSkill(): Promise<any> {
    throw new Error('Method not implemented - use AgentSkillsService');
  }

  async getAgentSkills(): Promise<any> {
    throw new Error('Method not implemented - use AgentSkillsService');
  }

  async updateStatus(): Promise<any> {
    throw new Error('Method not implemented - use AgentStatusService');
  }

  async getAgentStatus(): Promise<any> {
    throw new Error('Method not implemented - use AgentStatusService');
  }

  async getWorkloadStats(): Promise<any> {
    throw new Error('Method not implemented - requires analytics service');
  }

  async getPerformanceStats(): Promise<any> {
    throw new Error('Method not implemented - requires analytics service');
  }
}