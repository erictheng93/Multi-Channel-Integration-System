// Agent Handler - 客服代理基礎處理器
// Agent Basic Handler

import type { Context } from 'hono';
import type { Bindings } from '@/types';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { createDb } from '@/db';
import { AgentService } from '@modules/agents/services/agent-crud';
import { AgentSkillsService } from '@modules/agents/services/agent-skills';
import { AgentStatusService } from '@modules/agents/services/agent-status';
import type {
  AgentWithDetails,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentListRequest
} from '../types/agent-types';

// Agent 處理器類別
export class AgentHandler {
  private db: ReturnType<typeof createDb>;
  private agentService: AgentService;
  private skillsService: AgentSkillsService;
  private statusService: AgentStatusService;

  constructor(env: Bindings) {
    this.db = createDb(env.DB);
    this.agentService = new AgentService(this.db);
    this.skillsService = new AgentSkillsService(env.KV);
    this.statusService = new AgentStatusService(env.KV);
  }

  // 建立代理
  async createAgent(c: Context<{ Bindings: Bindings }>) {
    try {
      const data: CreateAgentRequest = await c.req.json();
      const agent = await this.agentService.createAgent(data);

      return c.json({
        success: true,
        data: agent,
        message: 'Agent created successfully'
      }, HTTP_STATUS.CREATED);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 取得代理列表
  async getAgents(c: Context<{ Bindings: Bindings }>) {
    try {
      const params: AgentListRequest = {
        page: parseInt(c.req.query('page') || '1'),
        limit: parseInt(c.req.query('limit') || '20'),
        includeInactive: c.req.query('includeInactive') === 'true',
        search: c.req.query('search'),
        teamId: c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined,
        role: c.req.query('role'),
        status: c.req.query('status') as any
      };

      const result = await this.agentService.listAgents(params);

      return c.json({
        success: true,
        data: result.agents,
        pagination: result.pagination,
        message: 'Agents retrieved successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 取得單一代理
  async getAgent(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        return c.json({ error: 'Agent not found' }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        data: agent,
        message: 'Agent retrieved successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 取得代理詳細資料（包含技能和狀態）
  async getAgentDetails(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      // 並行取得基本資料、技能和狀態
      const [agent, skills, status] = await Promise.all([
        this.agentService.getAgent(agentId),
        this.skillsService.getAgentSkills(agentId),
        this.statusService.getAgentStatus(agentId)
      ]);

      if (!agent) {
        return c.json({ error: 'Agent not found' }, HTTP_STATUS.NOT_FOUND);
      }

      const agentWithDetails: AgentWithDetails = {
        ...agent,
        skills,
        currentStatus: status || undefined
      };

      return c.json({
        success: true,
        data: agentWithDetails,
        message: 'Agent details retrieved successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 更新代理
  async updateAgent(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const data: UpdateAgentRequest = await c.req.json();
      const updatedAgent = await this.agentService.updateAgent(agentId, data);

      return c.json({
        success: true,
        data: updatedAgent,
        message: 'Agent updated successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 刪除代理
  async deleteAgent(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const deleted = await this.agentService.deleteAgent(agentId);
      if (!deleted) {
        return c.json({ error: 'Agent not found' }, HTTP_STATUS.NOT_FOUND);
      }

      return c.json({
        success: true,
        message: 'Agent deleted successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 搜尋代理
  async searchAgents(c: Context<{ Bindings: Bindings }>) {
    try {
      const query = await c.req.json();
      const agents = await this.agentService.searchAgents(query);

      return c.json({
        success: true,
        data: agents,
        message: 'Search results retrieved successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 取得代理技能
  async getAgentSkills(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const skills = await this.skillsService.getAgentSkills(agentId);

      return c.json({
        success: true,
        data: skills,
        message: 'Skills retrieved successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 新增代理技能
  async addAgentSkill(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const skillData = await c.req.json();
      const skill = await this.skillsService.addSkill(agentId, skillData);

      return c.json({
        success: true,
        data: skill,
        message: 'Skill added successfully'
      }, HTTP_STATUS.CREATED);
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 取得代理狀態
  async getAgentStatus(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const status = await this.statusService.getAgentStatus(agentId);

      return c.json({
        success: true,
        data: status,
        message: 'Status retrieved successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }

  // 更新代理狀態
  async updateAgentStatus(c: Context<{ Bindings: Bindings }>) {
    try {
      const agentId = c.req.param('agentId');
      if (!agentId) {
        return c.json({ error: 'Agent ID is required' }, HTTP_STATUS.BAD_REQUEST);
      }

      const statusData = await c.req.json();
      const status = await this.statusService.updateStatus(agentId, statusData);

      return c.json({
        success: true,
        data: status,
        message: 'Status updated successfully'
      });
    } catch (error) {
      return globalErrorHandler.handleError(c, error);
    }
  }
}

// 建立 handler 實例的工廠函數
export function createAgentHandler(env: Bindings): AgentHandler {
  return new AgentHandler(env);
}

// 導出便利的 handler 函數
export const agentHandler = {
  create: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).createAgent(c),

  list: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).getAgents(c),

  get: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).getAgent(c),

  getDetails: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).getAgentDetails(c),

  update: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).updateAgent(c),

  delete: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).deleteAgent(c),

  search: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).searchAgents(c),

  getSkills: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).getAgentSkills(c),

  addSkill: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).addAgentSkill(c),

  getStatus: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).getAgentStatus(c),

  updateStatus: (env: Bindings) => (c: Context<{ Bindings: Bindings }>) =>
    createAgentHandler(env).updateAgentStatus(c)
};