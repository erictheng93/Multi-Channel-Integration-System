// Teams Middleware - 團隊中介層統一匯出
// Team Middleware Export

export {
  teamAuthMiddleware,
  requireAdminRole,
  requireTeamLeaderOrAdmin,
  checkTeamAccess,
  checkTeamManagementAccess,
  checkTeamMembership,
  createTeamPermissionMiddleware,
  teamErrorHandler
} from './team-auth';

export {
  teamValidationMiddleware,
  validateCreateTeamData,
  validateUpdateTeamData,
  validateTeamId,
  validateMemberId,
  validateAddMemberData,
  validateUpdateMemberData,
  validatePaginationParams,
  validateSearchParams,
  validateBatchOperationData,
  validateStatisticsParams
} from './team-validation';

// 重新匯出常用類型
export type {
  TeamPermissionError,
  InvalidTeamDataError
} from '../types/team-types';