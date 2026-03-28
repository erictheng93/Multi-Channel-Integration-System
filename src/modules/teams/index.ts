// ============================================================================
// TEAMS Module - 團隊管理模組
// 處理團隊建立、成員管理、權限分配和團隊協作功能
// ============================================================================

// ======================== 類型導出 ========================
export type * from './types/team-types';

// ======================== 服務導出 ========================
export { TeamService } from './services/team-service';

// ======================== 處理器導出 ========================
export { default as teamsHandler } from './handlers';

// ======================== 中間件導出 ========================
export * from './middleware';

// ======================== 工具函數導出 ========================
// 未來可擴展團隊相關工具函數

// ======================== 常數導出 ========================
export const TEAM_CONSTANTS = {
  MAX_TEAM_SIZE: 50,
  MAX_TEAM_NAME_LENGTH: 100,
  MIN_TEAM_NAME_LENGTH: 2,
  DEFAULT_TEAM_ROLES: ['leader', 'member'],
  TEAM_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended'
  }
} as const;

// ======================== 模組配置 ========================
export interface TeamsModuleConfig {
  maxTeamSize: number;
  maxTeamsPerUser: number;
  allowSelfJoin: boolean;
  requireApproval: boolean;
  defaultRole: string;
  autoAssignNewUsers: boolean;
}

export const DEFAULT_TEAMS_MODULE_CONFIG: TeamsModuleConfig = {
  maxTeamSize: 50,
  maxTeamsPerUser: 10,
  allowSelfJoin: false,
  requireApproval: true,
  defaultRole: 'member',
  autoAssignNewUsers: false
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'teams',
  version: '1.0.0',
  description: '團隊管理與協作模組',

  features: [
    '團隊建立與管理',
    '成員邀請與管理',
    '角色權限分配',
    '團隊統計資料',
    '團隊設定管理',
    '成員活動追蹤'
  ],

  endpoints: {
    total: 12,
    implemented: 12,
    pending: 0,
    categories: {
      teams: 6, // create, update, delete, list, get, stats
      members: 4, // add, remove, update, list
      roles: 2 // assign, revoke
    }
  },

  permissions: {
    admin: {
      description: '完整團隊系統管理權限',
      actions: ['manage_all_teams', 'view_all_stats', 'system_settings']
    },
    team: {
      description: '團隊領導者權限',
      actions: ['manage_team', 'invite_members', 'assign_roles', 'view_team_stats']
    },
    agent: {
      description: '團隊成員基本權限',
      actions: ['view_team', 'update_profile', 'leave_team']
    }
  },

  technical: {
    database: ['teams', 'team_members', 'team_invitations', 'team_settings'],
    cache: ['team_cache', 'member_cache'],
    dependencies: ['shared/database', 'shared/utils', 'auth'],
    middleware: ['team-auth', 'role-validation', 'team-access']
  },

  status: {
    development: 'completed' as const,
    testing: 'completed' as const,
    deployment: 'completed' as const,
    integration: 'completed' as const
  }
} as const;

// ======================== 初始化函數 ========================
import { createContextLogger } from '@/utils/logger';
const log = createContextLogger('TeamsModule');

export function initializeTeamsModule(config: Partial<TeamsModuleConfig> = {}) {
  const finalConfig = { ...DEFAULT_TEAMS_MODULE_CONFIG, ...config };

  // 驗證配置
  if (finalConfig.maxTeamSize < 1) {
    log.warn('maxTeamSize must be at least 1');
    finalConfig.maxTeamSize = 1;
  }

  if (finalConfig.maxTeamsPerUser < 1) {
    log.warn('maxTeamsPerUser must be at least 1');
    finalConfig.maxTeamsPerUser = 1;
  }

  return {
    config: finalConfig,
    moduleInfo: MODULE_INFO,
    constants: TEAM_CONSTANTS
  };
}

// ======================== 向後兼容 ========================
export { default as teamMainHandler } from './handlers';

// Legacy re-exports for backward compatibility
export type {
  Team,
  TeamWithStats,
  TeamMember,
  TeamStats,
  TeamCreateRequest,
  TeamUpdateRequest,
  TeamListRequest,
  TeamListResponse,
  TeamServiceInterface
} from './types/team-types';

export {
  teamAuthMiddleware,
  requireAdminRole as teamRequireAdminRole,
  requireTeamLeaderOrAdmin,
  checkTeamAccess,
  teamValidationMiddleware
} from './middleware';