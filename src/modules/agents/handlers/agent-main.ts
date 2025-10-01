// Agent Main Handler - 客服代理主要路由處理器
// Agent Main Router Handler

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { createDb } from '@/db';
import { AgentService } from '@modules/agents/services/agent-crud';
import { AgentSkillsService } from '@modules/agents/services/agent-skills';
import { AgentStatusService } from '@modules/agents/services/agent-status';
import {
  agentAuthMiddleware,
  requireAdminRole,
  requireTeamLeaderOrAdmin,
  checkAgentAccess,
  createAgentPermissionMiddleware,
  agentErrorHandler
} from '../middleware/agent-auth';
import { agentValidationMiddleware } from '@modules/agents/middleware/agent-validation';

// 建立 Agent 路由
export function createAgentRouter() {
  const router = new Hono<{ Bindings: Bindings }>();

  // 套用全域中介層
  router.use('*', agentErrorHandler());
  router.use('*', agentAuthMiddleware());

  // ===== CRUD 操作 =====

  // 建立新代理
  router.post('/agents',
    requireAdminRole(),
    agentValidationMiddleware.createAgent,
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const data = await c.req.json();
      const agent = await agentService.createAgent(data);

      return c.json({
        success: true,
        data: agent,
        message: 'Agent created successfully'
      }, 201);
    }
  );

  // 取得所有代理（分頁）
  router.get('/agents',
    requireTeamLeaderOrAdmin(),
    agentValidationMiddleware.pagination,
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const params = {
        page: parseInt(c.req.query('page') || '1'),
        limit: parseInt(c.req.query('limit') || '20'),
        includeInactive: c.req.query('includeInactive') === 'true',
        search: c.req.query('search'),
        teamId: c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : undefined,
        role: c.req.query('role'),
        status: c.req.query('status') as any
      };

      const result = await agentService.listAgents(params);

      return c.json({
        success: true,
        data: result.agents,
        pagination: result.pagination,
        message: 'Agents retrieved successfully'
      });
    }
  );

  // 取得單一代理詳情
  router.get('/agents/:agentId',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);
      const skillsService = new AgentSkillsService(c.env.KV);
      const statusService = new AgentStatusService(c.env.KV);

      const agentId = c.req.param('agentId')!;

      // 取得基本資料
      const agent = await agentService.getAgent(agentId);
      if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      // 取得技能和狀態（並行處理）
      const [skills, status] = await Promise.all([
        skillsService.getAgentSkills(agentId),
        statusService.getAgentStatus(agentId)
      ]);

      const agentWithDetails = {
        ...agent,
        skills,
        currentStatus: status
      };

      return c.json({
        success: true,
        data: agentWithDetails,
        message: 'Agent details retrieved successfully'
      });
    }
  );

  // 更新代理資料
  router.put('/agents/:agentId',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    agentValidationMiddleware.updateAgent,
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const agentId = c.req.param('agentId')!;
      const data = await c.req.json();

      const updatedAgent = await agentService.updateAgent(agentId, data);

      return c.json({
        success: true,
        data: updatedAgent,
        message: 'Agent updated successfully'
      });
    }
  );

  // 刪除代理
  router.delete('/agents/:agentId',
    agentValidationMiddleware.agentId,
    requireAdminRole(),
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const agentId = c.req.param('agentId')!;
      const deleted = await agentService.deleteAgent(agentId);

      if (!deleted) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      return c.json({
        success: true,
        message: 'Agent deleted successfully'
      });
    }
  );

  // ===== 技能管理 =====

  // 新增技能
  router.post('/agents/:agentId/skills',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    agentValidationMiddleware.skill,
    async (c) => {
      const skillsService = new AgentSkillsService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const skillData = await c.req.json();

      const skill = await skillsService.addSkill(agentId, skillData);

      return c.json({
        success: true,
        data: skill,
        message: 'Skill added successfully'
      }, 201);
    }
  );

  // 取得代理所有技能
  router.get('/agents/:agentId/skills',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const skillsService = new AgentSkillsService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const skills = await skillsService.getAgentSkills(agentId);

      return c.json({
        success: true,
        data: skills,
        message: 'Skills retrieved successfully'
      });
    }
  );

  // 更新技能
  router.put('/agents/:agentId/skills/:skillId',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const skillsService = new AgentSkillsService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const skillId = c.req.param('skillId')!;
      const updates = await c.req.json();

      const skill = await skillsService.updateSkill(agentId, skillId, updates);

      return c.json({
        success: true,
        data: skill,
        message: 'Skill updated successfully'
      });
    }
  );

  // 刪除技能
  router.delete('/agents/:agentId/skills/:skillId',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const skillsService = new AgentSkillsService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const skillId = c.req.param('skillId')!;

      const deleted = await skillsService.removeSkill(agentId, skillId);

      if (!deleted) {
        return c.json({ error: 'Skill not found' }, 404);
      }

      return c.json({
        success: true,
        message: 'Skill deleted successfully'
      });
    }
  );

  // ===== 狀態管理 =====

  // 取得代理狀態
  router.get('/agents/:agentId/status',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const statusService = new AgentStatusService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const status = await statusService.getAgentStatus(agentId);

      return c.json({
        success: true,
        data: status,
        message: 'Status retrieved successfully'
      });
    }
  );

  // 更新代理狀態
  router.put('/agents/:agentId/status',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    agentValidationMiddleware.status,
    async (c) => {
      const statusService = new AgentStatusService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const statusData = await c.req.json();

      const status = await statusService.updateStatus(agentId, statusData);

      return c.json({
        success: true,
        data: status,
        message: 'Status updated successfully'
      });
    }
  );

  // 取得狀態歷史
  router.get('/agents/:agentId/status/history',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const statusService = new AgentStatusService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const limit = parseInt(c.req.query('limit') || '20');

      const history = await statusService.getStatusHistory(agentId, limit);

      return c.json({
        success: true,
        data: history,
        message: 'Status history retrieved successfully'
      });
    }
  );

  // ===== 搜尋和篩選 =====

  // 搜尋代理
  router.post('/agents/search',
    requireTeamLeaderOrAdmin(),
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const query = await c.req.json();
      const agents = await agentService.searchAgents(query);

      return c.json({
        success: true,
        data: agents,
        message: 'Search results retrieved successfully'
      });
    }
  );

  // ===== 批次操作 =====

  // 批次更新代理
  router.put('/agents/batch',
    requireAdminRole(),
    agentValidationMiddleware.batchOperation,
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const request = await c.req.json();
      const updatedAgents = await agentService.batchUpdateAgents(request);

      return c.json({
        success: true,
        data: updatedAgents,
        message: `${updatedAgents.length} agents updated successfully`
      });
    }
  );

  // 批次轉移代理到其他團隊
  router.put('/agents/batch/transfer',
    requireAdminRole(),
    agentValidationMiddleware.batchOperation,
    async (c) => {
      const db = createDb(c.env.DB);
      const agentService = new AgentService(db);

      const request = await c.req.json();
      const result = await agentService.batchTransferAgents(request);

      return c.json({
        success: result.success,
        data: result,
        message: result.success
          ? 'All agents transferred successfully'
          : `Transfer completed with ${result.errors.length} errors`
      });
    }
  );

  // ===== 統計和分析 =====

  // 取得技能統計
  router.get('/agents/:agentId/skills/statistics',
    agentValidationMiddleware.agentId,
    checkAgentAccess(),
    async (c) => {
      const skillsService = new AgentSkillsService(c.env.KV);

      const agentId = c.req.param('agentId')!;
      const statistics = await skillsService.getSkillStatistics(agentId);

      return c.json({
        success: true,
        data: statistics,
        message: 'Skill statistics retrieved successfully'
      });
    }
  );

  // 取得狀態統計
  router.get('/agents/status/statistics',
    requireTeamLeaderOrAdmin(),
    async (c) => {
      const db = createDb(c.env.DB);
      const statusService = new AgentStatusService(c.env.KV);
      const agentService = new AgentService(db);

      // 取得所有代理 ID
      const allAgentsResult = await agentService.listAgents({ page: 1, limit: 1000 });
      const agentIds = allAgentsResult.agents.map(agent => agent.id);

      const statistics = await statusService.getStatusStatistics(agentIds);

      return c.json({
        success: true,
        data: statistics,
        message: 'Status statistics retrieved successfully'
      });
    }
  );

  return router;
}