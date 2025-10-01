// Team Validation Middleware - 團隊資料驗證中介層
// Team Data Validation Middleware

import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '@/types';
import { InvalidTeamDataError } from '@modules/teams/types/team-types';

// 建立團隊資料驗證
export const validateCreateTeamData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 必要欄位檢查
      const requiredFields = ['name', 'description'];
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        throw new InvalidTeamDataError(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // 團隊名稱長度檢查
      if (body.name.length < 2 || body.name.length > 100) {
        throw new InvalidTeamDataError('Team name must be between 2 and 100 characters');
      }

      // 描述長度檢查
      if (body.description.length < 5 || body.description.length > 500) {
        throw new InvalidTeamDataError('Description must be between 5 and 500 characters');
      }

      // 團隊負責人 ID 格式檢查（如果提供）
      if (body.leaderId !== undefined && body.leaderId !== null) {
        const leaderId = parseInt(body.leaderId);
        if (isNaN(leaderId) || leaderId < 1) {
          throw new InvalidTeamDataError('Invalid leader ID format');
        }
      }

      // 成員上限檢查（如果提供）
      if (body.maxMembers !== undefined && body.maxMembers !== null) {
        const maxMembers = parseInt(body.maxMembers);
        if (isNaN(maxMembers) || maxMembers < 1 || maxMembers > 200) {
          throw new InvalidTeamDataError('Max members must be between 1 and 200');
        }
      }

      // 狀態驗證（如果提供）
      if (body.status && !['active', 'inactive', 'archived'].includes(body.status)) {
        throw new InvalidTeamDataError('Invalid status. Must be active, inactive, or archived');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message, details: error.details }, 400);
      }
      throw error;
    }
  };
};

// 更新團隊資料驗證
export const validateUpdateTeamData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 如果沒有更新資料，直接通過
      if (!body || Object.keys(body).length === 0) {
        throw new InvalidTeamDataError('No update data provided');
      }

      // 團隊名稱長度檢查（如果提供）
      if (body.name) {
        if (body.name.length < 2 || body.name.length > 100) {
          throw new InvalidTeamDataError('Team name must be between 2 and 100 characters');
        }
      }

      // 描述長度檢查（如果提供）
      if (body.description) {
        if (body.description.length < 5 || body.description.length > 500) {
          throw new InvalidTeamDataError('Description must be between 5 and 500 characters');
        }
      }

      // 團隊負責人 ID 格式檢查（如果提供）
      if (body.leaderId !== undefined && body.leaderId !== null) {
        const leaderId = parseInt(body.leaderId);
        if (isNaN(leaderId) || leaderId < 1) {
          throw new InvalidTeamDataError('Invalid leader ID format');
        }
      }

      // 成員上限檢查（如果提供）
      if (body.maxMembers !== undefined && body.maxMembers !== null) {
        const maxMembers = parseInt(body.maxMembers);
        if (isNaN(maxMembers) || maxMembers < 1 || maxMembers > 200) {
          throw new InvalidTeamDataError('Max members must be between 1 and 200');
        }
      }

      // 狀態驗證（如果提供）
      if (body.status && !['active', 'inactive', 'archived'].includes(body.status)) {
        throw new InvalidTeamDataError('Invalid status. Must be active, inactive, or archived');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message, details: error.details }, 400);
      }
      throw error;
    }
  };
};

// 團隊 ID 格式驗證
export const validateTeamId = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const teamId = c.req.param('teamId');

      if (!teamId) {
        throw new InvalidTeamDataError('Team ID is required');
      }

      // 檢查 ID 格式（數字格式）
      const teamIdNum = parseInt(teamId);
      if (isNaN(teamIdNum) || teamIdNum < 1) {
        throw new InvalidTeamDataError('Invalid team ID format');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};

// 成員 ID 格式驗證
export const validateMemberId = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const memberId = c.req.param('memberId');

      if (!memberId) {
        throw new InvalidTeamDataError('Member ID is required');
      }

      // 檢查 ID 格式（數字格式）
      const memberIdNum = parseInt(memberId);
      if (isNaN(memberIdNum) || memberIdNum < 1) {
        throw new InvalidTeamDataError('Invalid member ID format');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};

// 新增成員資料驗證
export const validateAddMemberData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 必要欄位檢查
      const requiredFields = ['userId', 'role'];
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        throw new InvalidTeamDataError(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // 使用者 ID 格式檢查
      const userId = parseInt(body.userId);
      if (isNaN(userId) || userId < 1) {
        throw new InvalidTeamDataError('Invalid user ID format');
      }

      // 角色驗證
      if (!['team', 'agent'].includes(body.role)) {
        throw new InvalidTeamDataError('Invalid role. Must be team or agent');
      }

      // 權限檢查（如果提供）
      if (body.permissions && !Array.isArray(body.permissions)) {
        throw new InvalidTeamDataError('Permissions must be an array');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};

// 更新成員資料驗證
export const validateUpdateMemberData = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const body = await c.req.json();

      // 如果沒有更新資料，直接通過
      if (!body || Object.keys(body).length === 0) {
        throw new InvalidTeamDataError('No update data provided');
      }

      // 角色驗證（如果提供）
      if (body.role && !['team', 'agent'].includes(body.role)) {
        throw new InvalidTeamDataError('Invalid role. Must be team or agent');
      }

      // 權限檢查（如果提供）
      if (body.permissions && !Array.isArray(body.permissions)) {
        throw new InvalidTeamDataError('Permissions must be an array');
      }

      // 狀態檢查（如果提供）
      if (body.status && !['active', 'inactive', 'suspended'].includes(body.status)) {
        throw new InvalidTeamDataError('Invalid status. Must be active, inactive, or suspended');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
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
          throw new InvalidTeamDataError('Page must be a positive integer');
        }
        if (pageNum > 1000) {
          throw new InvalidTeamDataError('Page number too large (max: 1000)');
        }
      }

      if (limit) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1) {
          throw new InvalidTeamDataError('Limit must be a positive integer');
        }
        if (limitNum > 100) {
          throw new InvalidTeamDataError('Limit too large (max: 100)');
        }
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};

// 搜尋參數驗證
export const validateSearchParams = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const searchTerm = c.req.query('search');
      const status = c.req.query('status');
      const leaderId = c.req.query('leaderId');

      // 搜尋詞長度檢查
      if (searchTerm && (searchTerm.length < 2 || searchTerm.length > 100)) {
        throw new InvalidTeamDataError('Search term must be between 2 and 100 characters');
      }

      // 狀態驗證
      if (status && !['active', 'inactive', 'archived'].includes(status)) {
        throw new InvalidTeamDataError('Invalid status filter. Must be active, inactive, or archived');
      }

      // 負責人 ID 驗證
      if (leaderId) {
        const leaderIdNum = parseInt(leaderId);
        if (isNaN(leaderIdNum) || leaderIdNum < 1) {
          throw new InvalidTeamDataError('Invalid leader ID format');
        }
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
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

      // teamIds 檢查
      if (!body.teamIds || !Array.isArray(body.teamIds)) {
        throw new InvalidTeamDataError('teamIds must be an array');
      }

      if (body.teamIds.length === 0) {
        throw new InvalidTeamDataError('teamIds cannot be empty');
      }

      if (body.teamIds.length > 20) {
        throw new InvalidTeamDataError('Cannot process more than 20 teams at once');
      }

      // 檢查每個 teamId 格式
      for (const teamId of body.teamIds) {
        const teamIdNum = parseInt(teamId);
        if (isNaN(teamIdNum) || teamIdNum < 1) {
          throw new InvalidTeamDataError(`Invalid team ID format: ${teamId}`);
        }
      }

      // 檢查操作類型（如果提供）
      if (body.operation && !['archive', 'activate', 'deactivate'].includes(body.operation)) {
        throw new InvalidTeamDataError('Invalid operation. Must be archive, activate, or deactivate');
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};

// 統計參數驗證
export const validateStatisticsParams = (): MiddlewareHandler<{ Bindings: Bindings }> => {
  return async (c, next): Promise<Response | void> => {
    try {
      const period = c.req.query('period');
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');

      // 時間週期驗證
      if (period && !['day', 'week', 'month', 'quarter', 'year'].includes(period)) {
        throw new InvalidTeamDataError('Invalid period. Must be day, week, month, quarter, or year');
      }

      // 日期格式驗證
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          throw new InvalidTeamDataError('Invalid startDate format');
        }
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          throw new InvalidTeamDataError('Invalid endDate format');
        }
      }

      // 日期範圍檢查
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
          throw new InvalidTeamDataError('startDate must be before endDate');
        }

        // 限制查詢範圍不超過1年
        const maxRange = 365 * 24 * 60 * 60 * 1000; // 1年的毫秒數
        if ((end.getTime() - start.getTime()) > maxRange) {
          throw new InvalidTeamDataError('Date range cannot exceed 1 year');
        }
      }

      await next();
    } catch (error) {
      if (error instanceof InvalidTeamDataError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};

// 綜合驗證中介層
export const teamValidationMiddleware = {
  createTeam: validateCreateTeamData(),
  updateTeam: validateUpdateTeamData(),
  teamId: validateTeamId(),
  memberId: validateMemberId(),
  addMember: validateAddMemberData(),
  updateMember: validateUpdateMemberData(),
  pagination: validatePaginationParams(),
  search: validateSearchParams(),
  batchOperation: validateBatchOperationData(),
  statistics: validateStatisticsParams()
};