/**
 * Team Management Composables
 *
 * 统一导出所有团队管理相关的 Composables
 *
 * @module composables/team-management
 */

// ==================== Main Controller ====================
export {
  useTeamManagementController,
  type UseTeamManagementControllerReturn
} from './useTeamManagementController'

// ==================== Sub-Controllers ====================
export {
  useMemberOperations,
  type UseMemberOperationsReturn,
  type AddMemberFormData,
  type PasswordResetFormData
} from './useMemberOperations'

export {
  useTeamOperations,
  type UseTeamOperationsReturn,
  type AddTeamFormData,
  type EditTeamFormData
} from './useTeamOperations'

export {
  useQRCodeOperations,
  type UseQRCodeOperationsReturn
} from './useQRCodeOperations'

export {
  useTeamStats,
  type UseTeamStatsReturn,
  type TeamStatsData
} from './useTeamStats'

export {
  useMemberEditForm,
  type MemberEditFormData,
  type MemberEditPasswordFormData,
  type MemberEditFormErrors,
  type MemberEditPasswordErrors,
  type UseMemberEditFormReturn
} from './useMemberEditForm'

// ==================== Common Types ====================
export type { Team } from './useTeamManagementController'
