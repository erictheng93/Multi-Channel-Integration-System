// Agent CRUD Service - 客服代理 CRUD 操作服務
// Agent CRUD Operations Service

import { eq, and, desc, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  agents,
  teams,
  agentTeams,
  messages,
  delayedMessages,
  notifications,
  tags,
  customerTags,
  conversationTags,
  messageRecallLogs,
  conversationTransfers,
  fileAttachments,
  activities,
  reports,
  scheduledReports,
  reportDownloadHistory,
  reportTemplates,
  channelIntegrations,
  customerFeedback
} from '@/db/schema';
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
  BatchTransferAgentsRequest
} from '../types/agent-types';
import {
  AgentNotFoundError,
  AgentAlreadyExistsError,
  InvalidAgentDataError
} from '../types/agent-types';
import { generateId } from '@/utils/id-generator';
import { hashPassword } from '@/utils/auth';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('AgentCrudService');

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

      const now = nowISO();
      const newAgent: NewAgent = {
        id: agentId,
        email: data.email,
        displayName: data.displayName,
        passwordHash,
        role: data.role || 'agent',
        isActive: data.isActive !== false,
        passwordPolicy: 'changeable',
        createdAt: now,
        updatedAt: now
      };

      const result = await this.db
        .insert(agents)
        .values(newAgent)
        .returning()
        .get();

      // If teamId provided, create agent_teams membership (isPrimary=true for first team)
      if (data.teamId) {
        await this.db.insert(agentTeams).values({
          agentId,
          teamId: data.teamId,
          roleInTeam: 'member',
          isPrimary: true,
          joinedAt: now
        });
      }

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
          primaryTeamId: agentTeams.teamId,
          isActive: agents.isActive,
          passwordPolicy: agents.passwordPolicy,
          lastActive: agents.lastActive,
          lastLoginAt: agents.lastLoginAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          deletedAt: agents.deletedAt,
          teamName: teams.name,
        })
        .from(agents)
        .leftJoin(agentTeams, and(eq(agentTeams.agentId, agents.id), eq(agentTeams.isPrimary, true)))
        .leftJoin(teams, eq(agentTeams.teamId, teams.id))
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

      // Extract teamId — it targets agent_teams, not the agents table
      const { teamId, ...agentFields } = data;

      // 驗證 teamId 是否存在（如果提供）
      if (teamId) {
        const team = await this.db
          .select()
          .from(teams)
          .where(eq(teams.id, teamId))
          .get();

        if (!team) {
          throw new InvalidAgentDataError(`Team not found: ${teamId}`);
        }

        // Update agent_teams: set new primary team
        const now = nowISO();
        await this.db.delete(agentTeams).where(eq(agentTeams.agentId, id));
        await this.db.insert(agentTeams).values({
          agentId: id,
          teamId,
          roleInTeam: 'member',
          isPrimary: true,
          joinedAt: now
        });
      }

      const updatedData = {
        ...agentFields,
        updatedAt: nowISO()
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
      // Clean up all FK references before deleting (RESTRICT constraints)
      // Step 1: Delete notifications
      await this.db.delete(notifications).where(eq(notifications.userId, id));
      // Step 2: Nullify message sender
      await this.db.update(messages).set({ agentSenderId: null }).where(eq(messages.agentSenderId, id));
      // Step 3: Delete delayed messages
      await this.db.delete(delayedMessages).where(eq(delayedMessages.agentId, id));
      // Step 4: Update message recall logs
      await this.db.update(messageRecallLogs).set({ userId: 'deleted-user' }).where(eq(messageRecallLogs.userId, id));
      // Step 5: Nullify file attachment uploader
      await this.db.update(fileAttachments).set({ uploadedBy: null }).where(eq(fileAttachments.uploadedBy, id));
      // Step 6: Update tag creator
      await this.db.update(tags).set({ createdBy: 'deleted-user' }).where(eq(tags.createdBy, id));
      // Step 7: Update customer tag assigner
      await this.db.update(customerTags).set({ assignedBy: 'deleted-user' }).where(eq(customerTags.assignedBy, id));
      // Step 8: Update conversation tag assigner
      await this.db.update(conversationTags).set({ assignedBy: 'deleted-user' }).where(eq(conversationTags.assignedBy, id));
      // Step 9: Update conversation transfer
      await this.db.update(conversationTransfers).set({ transferredBy: 'deleted-user' }).where(eq(conversationTransfers.transferredBy, id));
      // Step 10: Update activity logs
      await this.db.update(activities).set({ userId: 'deleted-user' }).where(eq(activities.userId, id));
      // Step 11: Update reports creator
      await this.db.update(reports).set({ createdBy: 'deleted-user' }).where(eq(reports.createdBy, id));
      // Step 12: Update scheduled reports creator
      await this.db.update(scheduledReports).set({ createdBy: 'deleted-user' }).where(eq(scheduledReports.createdBy, id));
      // Step 13: Update report download history
      await this.db.update(reportDownloadHistory).set({ downloadedBy: 'deleted-user' }).where(eq(reportDownloadHistory.downloadedBy, id));
      // Step 14: Update report templates creator
      await this.db.update(reportTemplates).set({ createdBy: 'deleted-user' }).where(eq(reportTemplates.createdBy, id));
      // Step 15: Nullify channel integration configured_by
      await this.db.update(channelIntegrations).set({ configuredBy: null }).where(eq(channelIntegrations.configuredBy, id));
      // Step 16: Nullify customer feedback agent
      await this.db.update(customerFeedback).set({ agentId: null }).where(eq(customerFeedback.agentId, id));

      // Step 17: Delete agent (agent_teams, task_reminders cascade automatically)
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
        status: _status
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
        conditions.push(eq(agentTeams.teamId, teamId));
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
          primaryTeamId: agentTeams.teamId,
          isActive: agents.isActive,
          passwordPolicy: agents.passwordPolicy,
          lastActive: agents.lastActive,
          lastLoginAt: agents.lastLoginAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          deletedAt: agents.deletedAt,
          teamName: teams.name,
        })
        .from(agents)
        .leftJoin(agentTeams, and(eq(agentTeams.agentId, agents.id), eq(agentTeams.isPrimary, true)))
        .leftJoin(teams, eq(agentTeams.teamId, teams.id))
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
        conditions.push(sql`${agentTeams.teamId} IN (${query.teamIds.join(',')})`);
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
          primaryTeamId: agentTeams.teamId,
          isActive: agents.isActive,
          passwordPolicy: agents.passwordPolicy,
          lastActive: agents.lastActive,
          lastLoginAt: agents.lastLoginAt,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt,
          deletedAt: agents.deletedAt,
          teamName: teams.name,
        })
        .from(agents)
        .leftJoin(agentTeams, and(eq(agentTeams.agentId, agents.id), eq(agentTeams.isPrimary, true)))
        .leftJoin(teams, eq(agentTeams.teamId, teams.id))
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
          log.error(`Failed to update agent ${agentId}`, { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      return updatedAgents;
    } catch (error) {
      throw new Error(`Failed to batch update agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async batchTransferAgents(request: BatchTransferAgentsRequest): Promise<{ success: boolean; errors: any[] }> {
    try {
      const { agentIds, toTeamId, reason: _reason } = request;
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

      // 批次轉移 (via agent_teams)
      const now = nowISO();
      for (const agentId of agentIds) {
        try {
          // Remove all existing team memberships, then add new one as primary
          await this.db.delete(agentTeams).where(eq(agentTeams.agentId, agentId));
          await this.db.insert(agentTeams).values({
            agentId,
            teamId: toTeamId,
            roleInTeam: 'member',
            isPrimary: true,
            joinedAt: now
          });
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