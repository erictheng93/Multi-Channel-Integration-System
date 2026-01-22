import type { TeamMember, Conversation } from '@/types'

// 權限枚舉
/* eslint-disable no-unused-vars */
export enum Permission {
  // 對話管理權限
  VIEW_ALL_CONVERSATIONS = 'view_all_conversations',
  VIEW_TEAM_CONVERSATIONS = 'view_team_conversations',
  VIEW_ASSIGNED_CONVERSATIONS = 'view_assigned_conversations',
  ASSIGN_CONVERSATIONS = 'assign_conversations',
  ASSIGN_TEAM_CONVERSATIONS = 'assign_team_conversations',
  ASSIGN_TO_SELF = 'assign_to_self',
  UNASSIGN_CONVERSATIONS = 'unassign_conversations',
  CLOSE_CONVERSATIONS = 'close_conversations',
  REOPEN_CONVERSATIONS = 'reopen_conversations',
  
  // 團隊管理權限
  MANAGE_TEAM_MEMBERS = 'manage_team_members',
  VIEW_TEAM_MEMBERS = 'view_team_members',
  INVITE_TEAM_MEMBERS = 'invite_team_members',
  REMOVE_TEAM_MEMBERS = 'remove_team_members',
  CHANGE_MEMBER_ROLES = 'change_member_roles',
  
  // 系統管理權限
  MANAGE_SYSTEM_SETTINGS = 'manage_system_settings',
  VIEW_SYSTEM_STATS = 'view_system_stats',
  MANAGE_ALL_TEAMS = 'manage_all_teams',
  
  // 報告和分析權限
  VIEW_TEAM_REPORTS = 'view_team_reports',
  VIEW_SYSTEM_REPORTS = 'view_system_reports',
  EXPORT_DATA = 'export_data'
}
/* eslint-enable no-unused-vars */

// 角色權限矩陣
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    // 管理員擁有所有權限
    Permission.VIEW_ALL_CONVERSATIONS,
    Permission.VIEW_TEAM_CONVERSATIONS,
    Permission.VIEW_ASSIGNED_CONVERSATIONS,
    Permission.ASSIGN_CONVERSATIONS,
    Permission.ASSIGN_TEAM_CONVERSATIONS,
    Permission.ASSIGN_TO_SELF,
    Permission.UNASSIGN_CONVERSATIONS,
    Permission.CLOSE_CONVERSATIONS,
    Permission.REOPEN_CONVERSATIONS,
    Permission.MANAGE_TEAM_MEMBERS,
    Permission.VIEW_TEAM_MEMBERS,
    Permission.INVITE_TEAM_MEMBERS,
    Permission.REMOVE_TEAM_MEMBERS,
    Permission.CHANGE_MEMBER_ROLES,
    Permission.MANAGE_SYSTEM_SETTINGS,
    Permission.VIEW_SYSTEM_STATS,
    Permission.MANAGE_ALL_TEAMS,
    Permission.VIEW_TEAM_REPORTS,
    Permission.VIEW_SYSTEM_REPORTS,
    Permission.EXPORT_DATA
  ],
  
  team: [
    // 團隊主管權限
    Permission.VIEW_TEAM_CONVERSATIONS,
    Permission.VIEW_ASSIGNED_CONVERSATIONS,
    Permission.ASSIGN_TEAM_CONVERSATIONS,
    Permission.ASSIGN_TO_SELF,
    Permission.UNASSIGN_CONVERSATIONS,
    Permission.CLOSE_CONVERSATIONS,
    Permission.REOPEN_CONVERSATIONS,
    Permission.MANAGE_TEAM_MEMBERS,
    Permission.VIEW_TEAM_MEMBERS,
    Permission.INVITE_TEAM_MEMBERS,
    Permission.REMOVE_TEAM_MEMBERS,
    Permission.VIEW_TEAM_REPORTS,
    Permission.EXPORT_DATA
  ],
  
  agent: [
    // 客服專員權限
    Permission.VIEW_ASSIGNED_CONVERSATIONS,
    Permission.ASSIGN_TO_SELF,
    Permission.CLOSE_CONVERSATIONS,
    Permission.VIEW_TEAM_MEMBERS
  ]
}

// 權限服務類
export class PermissionService {
  /**
   * 檢查用戶是否有特定權限
   */
  static hasPermission(user: TeamMember | null, permission: Permission): boolean {
    if (!user || !user.role) {
      return false
    }

    const rolePermissions = ROLE_PERMISSIONS[user.role] || []
    return rolePermissions.includes(permission)
  }

  /**
   * 檢查用戶是否有多個權限中的任意一個
   */
  static hasAnyPermission(user: TeamMember | null, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission))
  }

  /**
   * 檢查用戶是否有所有指定的權限
   */
  static hasAllPermissions(user: TeamMember | null, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission))
  }

  /**
   * 獲取用戶的所有權限
   */
  static getUserPermissions(user: TeamMember | null): Permission[] {
    if (!user || !user.role) {
      return []
    }

    return ROLE_PERMISSIONS[user.role] || []
  }

  /**
   * 檢查用戶是否可以查看對話
   */
  static canViewConversation(user: TeamMember | null, conversation: Conversation): boolean {
    if (!user) {return false}

    // Admin 可以查看所有對話
    if (this.hasPermission(user, Permission.VIEW_ALL_CONVERSATIONS)) {
      return true
    }

    // Team 可以查看團隊對話
    if (this.hasPermission(user, Permission.VIEW_TEAM_CONVERSATIONS)) {
      // Team conversation validation will be implemented when required
      return true
    }

    // Note: Individual assignment (assignedAgentId) removed - use team-based access control
    // Agent 只能查看指派給自己團隊的對話
    if (this.hasPermission(user, Permission.VIEW_ASSIGNED_CONVERSATIONS)) {
      return conversation.assignedTeamId === user.teamId
    }

    return false
  }

  /**
   * 檢查用戶是否可以指派對話
   */
  static canAssignConversation(user: TeamMember | null, conversation: Conversation, targetUserId?: string): boolean {
    if (!user) {return false}

    // 不能指派已關閉的對話
    if (conversation.status === 'closed') {
      return false
    }

    // 指派給自己
    if (targetUserId === user.id) {
      return this.hasPermission(user, Permission.ASSIGN_TO_SELF)
    }

    // Admin 可以指派任何對話
    if (this.hasPermission(user, Permission.ASSIGN_CONVERSATIONS)) {
      return true
    }

    // Team 可以指派團隊內的對話
    if (this.hasPermission(user, Permission.ASSIGN_TEAM_CONVERSATIONS)) {
      // Team user validation will be implemented when required
      return true
    }

    return false
  }

  /**
   * 檢查用戶是否可以取消指派對話
   */
  static canUnassignConversation(user: TeamMember | null, conversation: Conversation): boolean {
    if (!user) {
      return false
    }

    // 檢查對話是否已指派 (only team-based assignment is supported now)
    const isAssigned = !!conversation.assignedTeamId
    if (!isAssigned) {
      return false
    }

    // 不能取消指派已關閉的對話
    if (conversation.status === 'closed') {
      return false
    }

    // Admin 可以取消任何指派
    if (this.hasPermission(user, Permission.UNASSIGN_CONVERSATIONS) && user.role === 'admin') {
      return true
    }

    // Note: Individual assignment (assignedAgentId) removed - use team-based access control
    // Agent 可以取消自己團隊的指派
    if (user.teamId && conversation.assignedTeamId === user.teamId) {
      return true
    }

    return false
  }

  /**
   * 檢查用戶是否可以關閉對話
   */
  static canCloseConversation(user: TeamMember | null, conversation: Conversation): boolean {
    if (!user || conversation.status === 'closed') {
      return false
    }

    // 如果有關閉對話權限
    if (this.hasPermission(user, Permission.CLOSE_CONVERSATIONS)) {
      // Admin 可以關閉任何對話
      if (user.role === 'admin') {
        return true
      }

      // Note: Individual assignment (assignedAgentId) removed - use team-based access control
      // Agent 只能關閉指派給自己團隊的對話
      if (user.role === 'agent') {
        return user.teamId ? conversation.assignedTeamId === user.teamId : false
      }
    }

    return false
  }

  /**
   * 檢查用戶是否可以查看團隊成員
   */
  static canViewTeamMembers(user: TeamMember | null): boolean {
    return this.hasPermission(user, Permission.VIEW_TEAM_MEMBERS)
  }

  /**
   * 檢查用戶是否可以管理團隊成員
   */
  static canManageTeamMembers(user: TeamMember | null): boolean {
    return this.hasPermission(user, Permission.MANAGE_TEAM_MEMBERS)
  }

  /**
   * 檢查用戶是否可以邀請團隊成員
   */
  static canInviteTeamMembers(user: TeamMember | null): boolean {
    return this.hasPermission(user, Permission.INVITE_TEAM_MEMBERS)
  }

  /**
   * 檢查用戶是否可以移除團隊成員
   */
  static canRemoveTeamMember(user: TeamMember | null, targetMember: TeamMember): boolean {
    if (!user || !this.hasPermission(user, Permission.REMOVE_TEAM_MEMBERS)) {
      return false
    }

    // 不能移除自己
    if (user.id === targetMember.id) {
      return false
    }

    // Admin 可以移除任何人（除了自己）
    if (user.role === 'admin') {
      return true
    }

    // Note: 'team' role removed - simplified to 2-tier (admin/agent)
    // Only admins can remove members

    return false
  }

  /**
   * 檢查用戶是否可以更改成員角色
   */
  static canChangeMemberRole(user: TeamMember | null, targetMember: TeamMember, _newRole: string): boolean {
    if (!user || !this.hasPermission(user, Permission.CHANGE_MEMBER_ROLES)) {
      return false
    }

    // 不能更改自己的角色
    if (user.id === targetMember.id) {
      return false
    }

    // Admin 可以更改任何人的角色（除了自己）
    if (user.role === 'admin') {
      return true
    }

    // Note: 'team' role removed - simplified to 2-tier (admin/agent)
    // Only admins can change roles

    return false
  }

  /**
   * 檢查用戶是否可以查看系統統計
   */
  static canViewSystemStats(user: TeamMember | null): boolean {
    return this.hasPermission(user, Permission.VIEW_SYSTEM_STATS)
  }

  /**
   * 檢查用戶是否可以查看報告
   */
  static canViewReports(user: TeamMember | null, reportType: 'team' | 'system' = 'team'): boolean {
    if (reportType === 'system') {
      return this.hasPermission(user, Permission.VIEW_SYSTEM_REPORTS)
    }
    return this.hasPermission(user, Permission.VIEW_TEAM_REPORTS)
  }

  /**
   * 檢查用戶是否可以導出數據
   */
  static canExportData(user: TeamMember | null): boolean {
    return this.hasPermission(user, Permission.EXPORT_DATA)
  }
}

// 權限檢查的 Vue 組合式函數
export function usePermissions() {
  return {
    Permission,
    PermissionService,
    hasPermission: (user: TeamMember | null, permission: Permission) => 
      PermissionService.hasPermission(user, permission),
    hasAnyPermission: (user: TeamMember | null, permissions: Permission[]) =>
      PermissionService.hasAnyPermission(user, permissions),
    hasAllPermissions: (user: TeamMember | null, permissions: Permission[]) =>
      PermissionService.hasAllPermissions(user, permissions),
    canViewConversation: (user: TeamMember | null, conversation: Conversation) =>
      PermissionService.canViewConversation(user, conversation),
    canAssignConversation: (user: TeamMember | null, conversation: Conversation, targetUserId?: string) =>
      PermissionService.canAssignConversation(user, conversation, targetUserId),
    canUnassignConversation: (user: TeamMember | null, conversation: Conversation) =>
      PermissionService.canUnassignConversation(user, conversation),
    canCloseConversation: (user: TeamMember | null, conversation: Conversation) =>
      PermissionService.canCloseConversation(user, conversation),
    canViewTeamMembers: (user: TeamMember | null) =>
      PermissionService.canViewTeamMembers(user),
    canManageTeamMembers: (user: TeamMember | null) =>
      PermissionService.canManageTeamMembers(user),
    canInviteTeamMembers: (user: TeamMember | null) =>
      PermissionService.canInviteTeamMembers(user)
  }
}

export default PermissionService