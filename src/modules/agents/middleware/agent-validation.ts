// Agent Validation Middleware - 客服代理資料驗證中介層
// Agent Data Validation Middleware

import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '@/types';
import { HTTP_STATUS } from '@/constants/http-status';
import { InvalidAgentDataError } from '@modules/agents/types/agent-types';

// 建立代理資料驗證
export const validateCreateAgentData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 必要欄位檢查
      const requiredFields = ['email', 'displayName'];
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        throw new InvalidAgentDataError(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Email 格式驗證
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        throw new InvalidAgentDataError('Invalid email format');
      }

      // 顯示名稱長度檢查
      if (body.displayName.length < 2 || body.displayName.length > 50) {
        throw new InvalidAgentDataError('Display name must be between 2 and 50 characters');
      }

      // SECURITY: Role validation - 2-tier system only (admin/agent)
      if (body.role && !['admin', 'agent'].includes(body.role)) {
        throw new InvalidAgentDataError('Invalid role. Must be admin or agent');
      }

      // TeamId 格式檢查
      if (body.teamId !== undefined && body.teamId !== null) {
        const teamId = parseInt(body.teamId);
        if (isNaN(teamId) || teamId < 1) {
          throw new InvalidAgentDataError('Invalid team ID format');
        }
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message, details: error.details }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 更新代理資料驗證
export const validateUpdateAgentData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 如果沒有更新資料，直接通過
      if (!body || Object.keys(body).length === 0) {
        throw new InvalidAgentDataError('No update data provided');
      }

      // Email 格式驗證（如果提供）
      if (body.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          throw new InvalidAgentDataError('Invalid email format');
        }
      }

      // 顯示名稱長度檢查（如果提供）
      if (body.displayName) {
        if (body.displayName.length < 2 || body.displayName.length > 50) {
          throw new InvalidAgentDataError('Display name must be between 2 and 50 characters');
        }
      }

      // SECURITY: Role validation (if provided) - 2-tier system only (admin/agent)
      if (body.role && !['admin', 'agent'].includes(body.role)) {
        throw new InvalidAgentDataError('Invalid role. Must be admin or agent');
      }

      // TeamId 格式檢查（如果提供）
      if (body.teamId !== undefined && body.teamId !== null) {
        const teamId = parseInt(body.teamId);
        if (isNaN(teamId) || teamId < 1) {
          throw new InvalidAgentDataError('Invalid team ID format');
        }
      }

      // isActive 格式檢查（如果提供）
      if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
        throw new InvalidAgentDataError('isActive must be a boolean value');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message, details: error.details }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 代理 ID 格式驗證
export const validateAgentId = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const agentId = c.req.param('agentId');

      if (!agentId) {
        throw new InvalidAgentDataError('Agent ID is required');
      }

      // 檢查 ID 格式（假設使用 UUID 或類似格式）
      if (agentId.length < 10 || agentId.length > 50) {
        throw new InvalidAgentDataError('Invalid agent ID format');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 技能資料驗證
export const validateSkillData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 必要欄位檢查
      const requiredFields = ['name', 'category', 'level'];
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        throw new InvalidAgentDataError(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // 技能名稱檢查
      if (body.name.length < 2 || body.name.length > 100) {
        throw new InvalidAgentDataError('Skill name must be between 2 and 100 characters');
      }

      // 類別驗證
      const validCategories = ['communication', 'technical', 'product', 'language', 'platform', 'soft_skill'];
      if (!validCategories.includes(body.category)) {
        throw new InvalidAgentDataError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }

      // 等級驗證
      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
      if (!validLevels.includes(body.level)) {
        throw new InvalidAgentDataError(`Invalid level. Must be one of: ${validLevels.join(', ')}`);
      }

      // 描述長度檢查（如果提供）
      if (body.description && body.description.length > 500) {
        throw new InvalidAgentDataError('Description must be less than 500 characters');
      }

      // 認證狀態檢查（如果提供）
      if (body.certified !== undefined && typeof body.certified !== 'boolean') {
        throw new InvalidAgentDataError('certified must be a boolean value');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 狀態資料驗證
export const validateStatusData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 必要欄位檢查
      if (!body.status) {
        throw new InvalidAgentDataError('Status is required');
      }

      // 狀態值驗證
      const validStatuses = ['online', 'busy', 'away', 'offline', 'break', 'meeting'];
      if (!validStatuses.includes(body.status)) {
        throw new InvalidAgentDataError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // 可用時間格式檢查（如果提供）
      if (body.availableUntil) {
        const availableUntil = new Date(body.availableUntil);
        if (isNaN(availableUntil.getTime())) {
          throw new InvalidAgentDataError('Invalid availableUntil date format');
        }

        // 檢查時間是否在未來
        if (availableUntil <= new Date()) {
          throw new InvalidAgentDataError('availableUntil must be a future date');
        }
      }

      // 備註長度檢查（如果提供）
      if (body.note && body.note.length > 200) {
        throw new InvalidAgentDataError('Note must be less than 200 characters');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 分頁參數驗證
export const validatePaginationParams = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const page = c.req.query('page');
      const limit = c.req.query('limit');

      if (page) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
          throw new InvalidAgentDataError('Page must be a positive integer');
        }
        if (pageNum > 1000) {
          throw new InvalidAgentDataError('Page number too large (max: 1000)');
        }
      }

      if (limit) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1) {
          throw new InvalidAgentDataError('Limit must be a positive integer');
        }
        if (limitNum > 100) {
          throw new InvalidAgentDataError('Limit too large (max: 100)');
        }
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 批次操作資料驗證
export const validateBatchOperationData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // agentIds 檢查
      if (!body.agentIds || !Array.isArray(body.agentIds)) {
        throw new InvalidAgentDataError('agentIds must be an array');
      }

      if (body.agentIds.length === 0) {
        throw new InvalidAgentDataError('agentIds cannot be empty');
      }

      if (body.agentIds.length > 50) {
        throw new InvalidAgentDataError('Cannot process more than 50 agents at once');
      }

      // 檢查每個 agentId 格式
      for (const agentId of body.agentIds) {
        if (typeof agentId !== 'string' || agentId.length < 10 || agentId.length > 50) {
          throw new InvalidAgentDataError(`Invalid agent ID format: ${agentId}`);
        }
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidAgentDataError) {
        return c.json({ error: error.message }, HTTP_STATUS.BAD_REQUEST);
      }
      throw error;
    }
  };
};

// 綜合驗證中介層
export const agentValidationMiddleware = {
  createAgent: validateCreateAgentData(),
  updateAgent: validateUpdateAgentData(),
  agentId: validateAgentId(),
  skill: validateSkillData(),
  status: validateStatusData(),
  pagination: validatePaginationParams(),
  batchOperation: validateBatchOperationData()
};