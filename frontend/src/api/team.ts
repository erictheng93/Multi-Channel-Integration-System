// 團隊管理 API 客戶端
import { callApiContract } from './contract-client'
import type {
  AddTeamMemberRequest,
  BatchAddMembersToTeamResponse,
  BatchEditMemberRequest,
  BatchEditMembersResponse,
  BulkDeleteMembersResponse,
  BulkRemoveMembersFromTeamResponse,
  BulkUpdateMembersResponse,
  CheckMemberEmailResponse,
  CreateTeamRequest,
  LiffQRResponse,
  LiffQRResponseBase,
  LiffQRStatsResponse,
  MigratePasswordsResponse,
  RemoveMemberResponse,
  TeamResponse,
  TeamScopedStatsResponse,
  TeamStatsResponse,
  TeamMemberWithTeamsResponse,
  UndoBatchEditResponse,
  UpdateTeamRequest
} from './team-types'
import { nowISO } from '@/utils/timestamp'
import type {
  TeamMember,
  ApiResponse,
  AgentTeamMembership
} from '@/types'
import { teamContracts, teamMembershipContracts } from '@shared/api-contracts'
import type { CreateTeamMemberRequest, TeamRoleInTeam } from '@shared/api-contracts'

export const teamApi = {
  // 獲取團隊成員列表
  getMembers: async (): Promise<ApiResponse<TeamMember[]>> => {
    return callApiContract(teamContracts.getMembers, undefined) as Promise<ApiResponse<TeamMember[]>>
  },

  // Check if email already exists (for duplicate detection)
  checkEmail: async (email: string): Promise<ApiResponse<CheckMemberEmailResponse>> => {
    return callApiContract(teamContracts.checkEmail, { email })
  },

  // 直接新增成員
  addMember: async (request: AddTeamMemberRequest): Promise<ApiResponse<TeamMember>> => {
    // 轉換前端數據格式為後端期望的格式
    const backendRequest: CreateTeamMemberRequest = {
      email: request.email || request.loginId, // email 是必填，如果沒有則使用 loginId
      password: request.password,
      displayName: request.name || request.loginId, // displayName 是必填，如果沒有則使用 loginId
      role: request.role,
      isActive: request.isActive
    };

    // 如果有指派團隊，將 group (team ID) 轉換為 teamId (number)
    if (request.group) {
      backendRequest.teamId = Number(request.group);
    }

    return callApiContract(
      teamContracts.addMember,
      undefined,
      backendRequest
    ) as Promise<ApiResponse<TeamMember>>
  },

  // 永久刪除團隊成員 (Hard Delete，不可撤銷)
  removeMember: async (memberId: string): Promise<ApiResponse<RemoveMemberResponse>> => {
    return callApiContract(teamContracts.removeMember, { memberId })
  },

  // ==================== Bulk Operations ====================

  /**
   * 批量永久刪除成員 (Hard Delete，不可撤銷)
   * @param memberIds 要刪除的成員 ID 列表 (最多 50 個)
   * @param reason 刪除原因 (可選)
   */
  bulkDeleteMembers: async (
    memberIds: string[],
    reason?: string
  ): Promise<ApiResponse<BulkDeleteMembersResponse>> => {
    return callApiContract(teamContracts.bulkDeleteMembers, undefined, {
      memberIds,
      reason
    })
  },

  /**
   * 批量更新成員 (角色和狀態)
   * @param memberIds 要更新的成員 ID 列表 (最多 50 個)
   * @param updates 要更新的欄位
   * @param reason 更新原因 (可選)
   * @returns 批量更新結果
   */
  bulkUpdateMembers: async (
    memberIds: string[],
    updates: { role?: 'admin' | 'agent'; isActive?: boolean },
    reason?: string
  ): Promise<ApiResponse<BulkUpdateMembersResponse>> => {
    return callApiContract(teamContracts.bulkUpdateMembers, undefined, {
      memberIds,
      updates,
      reason
    })
  },

  /**
   * 批量編輯成員 (個別變更)
   * 每個成員可有不同的 profile 和團隊變更
   */
  batchEditMembers: async (
    members: BatchEditMemberRequest[],
    reason?: string
  ): Promise<ApiResponse<BatchEditMembersResponse>> => {
    return callApiContract(teamContracts.batchEditMembers, undefined, {
      members,
      reason
    })
  },

  /**
   * 撤銷批量編輯
   */
  undoBatchEdit: async (undoToken: string): Promise<ApiResponse<UndoBatchEditResponse>> => {
    return callApiContract(teamContracts.undoBatchEdit, undefined, { undoToken })
  },

  // NOTE: restoreMembers removed — hard delete is permanent

  // 更新成員角色
  updateMemberRole: async (memberId: string, role: 'admin' | 'agent'): Promise<ApiResponse<void>> => { // Simplified from 3-tier to 2-tier
    return callApiContract(teamContracts.updateMemberRole, { memberId }, { role })
  },

  // 更新成員狀態
  updateMemberStatus: async (memberId: string, status: 'active' | 'inactive'): Promise<ApiResponse<void>> => {
    return callApiContract(teamContracts.updateMemberStatus, { memberId }, {
      isActive: status === 'active'
    })
  },

  // 重設成員密碼
  resetPassword: async (memberId: string): Promise<ApiResponse<void>> => {
    return callApiContract(teamContracts.resetPassword, { memberId })
  },

  // 重設成員密碼帶政策
  resetPasswordWithPolicy: async (memberId: string, data: {
    newPassword: string;
    policy: 'changeable' | 'unchangeable' | 'must_change';
  }): Promise<ApiResponse<void>> => {
    // Fixed: Updated path from /team to /teams and endpoint from reset-password-policy to reset
    return callApiContract(teamContracts.resetPasswordWithPolicy, { memberId }, data)
  },

  // 獲取成員密碼
  getMemberPassword: async (memberId: string): Promise<ApiResponse<{
    password: string;
    username: string;  // 保留作為向後兼容，但實際上會使用 displayName 的值
    displayName: string;
  }>> => {
    return callApiContract(teamContracts.getMemberPassword, { memberId })
  },

  // 更新成員資訊
  updateMember: async (memberId: string, data: Partial<TeamMember>): Promise<ApiResponse<TeamMember>> => {
    return callApiContract(
      teamContracts.updateMember,
      { memberId },
      data
    ) as Promise<ApiResponse<TeamMember>>
  },

  // 獲取團隊統計資訊
  getTeamStats: async (): Promise<ApiResponse<TeamStatsResponse>> => {
    return callApiContract(teamContracts.getTeamStats, undefined)
  },

  // 遷移明文密碼到加密存儲 (臨時管理功能)
  migratePasswords: async (): Promise<ApiResponse<MigratePasswordsResponse>> => {
    return callApiContract(teamContracts.migratePasswords, undefined)
  },

  // 團隊管理 API
  // 獲取所有團隊
  getTeams: async (includeInactive?: boolean): Promise<ApiResponse<TeamResponse[]>> => {
    return callApiContract(teamContracts.getTeams, { includeInactive })
  },

  // 創建團隊
  // Phase 3: 團隊創建時會並行生成 QR 碼，回應中包含 qrCode 和 lineUrl
  createTeam: async (data: CreateTeamRequest): Promise<ApiResponse<TeamResponse>> => {
    return callApiContract(teamContracts.createTeam, undefined, data)
  },

  // 更新團隊
  updateTeam: async (
    teamId: number,
    data: UpdateTeamRequest
  ): Promise<ApiResponse<TeamResponse>> => {
    return callApiContract(teamContracts.updateTeam, { teamId }, data)
  },

  // 刪除團隊
  deleteTeam: async (teamId: number): Promise<ApiResponse<void>> => {
    return callApiContract(teamContracts.deleteTeam, { teamId })
  },

  // 獲取團隊詳情
  getTeamDetail: async (teamId: number): Promise<ApiResponse<TeamResponse>> => {
    return callApiContract(teamContracts.getTeamDetail, { teamId })
  },

  // 獲取團隊成員（特定團隊）
  getTeamMembersByTeam: async (teamId: number): Promise<ApiResponse<TeamMember[]>> => {
    return callApiContract(
      teamContracts.getTeamMembersByTeam,
      { teamId }
    ) as Promise<ApiResponse<TeamMember[]>>
  },

  // 獲取團隊統計（特定團隊）
  getTeamStatsByTeam: async (teamId: number): Promise<ApiResponse<TeamScopedStatsResponse>> => {
    return callApiContract(teamContracts.getTeamStatsByTeam, { teamId })
  },

  // ==================== LIFF QR Code API ====================
  // 生成或重新生成團隊 LIFF QR 碼 (永久有效，每團隊一個)
  generateLiffQR: async (teamId: number): Promise<ApiResponse<LiffQRResponseBase>> => {
    return callApiContract(teamContracts.generateLiffQR, { teamId })
  },

  // 獲取團隊 LIFF QR 碼
  getLiffQRCode: async (teamId: number): Promise<ApiResponse<LiffQRResponse>> => {
    return callApiContract(teamContracts.getLiffQRCode, { teamId })
  },

  // 獲取 LIFF QR 碼統計
  getLiffQRStats: async (teamId: number): Promise<ApiResponse<LiffQRStatsResponse>> => {
    return callApiContract(teamContracts.getLiffQRStats, { teamId })
  },

  // 獲取團隊成員（用於指派功能）
  getTeamMembers: async (teamId?: number): Promise<ApiResponse<TeamMember[]>> => {
    try {
      const response = await callApiContract(
        teamContracts.getTeamMembers,
        { teamId }
      ) as ApiResponse<TeamMember[]>
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        }
      }
      
      return { success: false, error: response.error || '獲取團隊成員失敗' }
    } catch (error) {
      console.error('Get team members failed:', error)
      return { success: false, error: '網路錯誤，無法載入團隊成員' }
    }
  },

  // 獲取所有可用的指派對象（跨團隊，需要admin權限）
  getAvailableAssignees: async (): Promise<ApiResponse<TeamMember[]>> => {
    try {
      const response = await callApiContract(
        teamContracts.getAvailableAssignees,
        undefined
      ) as ApiResponse<TeamMember[]>
      
      if (response.success && response.data) {
        // 過濾出活躍的agent和team角色成員
        const availableMembers = response.data.filter(member => 
          member.status === 'active' && ['agent', 'team'].includes(member.role)
        )
        
        return {
          success: true,
          data: availableMembers
        }
      }
      
      return { success: false, error: response.error || '獲取可指派成員失敗' }
    } catch (error) {
      console.error('Get available assignees failed:', error)
      return { success: false, error: '網路錯誤，無法載入可指派成員' }
    }
  },

  // 獲取特定成員詳情
  getMember: async (memberId: string): Promise<ApiResponse<TeamMember>> => {
    try {
      if (!memberId?.trim()) {
        return { success: false, error: '成員 ID 不能為空' }
      }

      const response = await callApiContract(
        teamContracts.getMember,
        { memberId }
      ) as ApiResponse<TeamMember>

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        }
      }

      return { success: false, error: response.error || '獲取成員詳情失敗' }
    } catch (error) {
      console.error('Get member failed:', error)
      return { success: false, error: '網路錯誤，無法載入成員詳情' }
    }
  },

  // 添加成員到團隊 (使用新的多團隊 API)
  addMemberToTeam: async (teamId: number, agentId: string): Promise<ApiResponse<TeamMember>> => {
    try {
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      if (!agentId?.trim()) {
        return { success: false, error: '成員 ID 不能為空' }
      }

      const response = await callApiContract(teamMembershipContracts.joinTeam, { agentId }, {
        teamId,
        roleInTeam: 'member',
        isPrimary: false
      }) as ApiResponse<AgentTeamMembership>

      if (response.success && response.data) {
        // 返回 TeamMember 格式以保持向後兼容
        return {
          success: true,
          data: {
            id: agentId,
            loginId: agentId,
            role: 'agent',
            status: 'active',
            teamId,
            createdAt: nowISO(),
            updatedAt: nowISO()
          } as TeamMember
        }
      }

      return { success: false, error: response.error || '添加成員到團隊失敗' }
    } catch (error) {
      console.error('Add member to team failed:', error)
      return { success: false, error: '網路錯誤，無法添加成員到團隊' }
    }
  },

  // 從團隊移除成員 (使用新的多團隊 API)
  removeMemberFromTeam: async (teamId: number, agentId: string): Promise<ApiResponse<void>> => {
    try {
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      if (!agentId?.trim()) {
        return { success: false, error: '成員 ID 不能為空' }
      }

      const response = await callApiContract(teamMembershipContracts.leaveTeam, { agentId, teamId })

      if (response.success) {
        return {
          success: true
        }
      }

      return { success: false, error: response.error || '從團隊移除成員失敗' }
    } catch (error) {
      console.error('Remove member from team failed:', error)
      return { success: false, error: '網路錯誤，無法從團隊移除成員' }
    }
  },

  // 批量從團隊移除成員
  bulkRemoveMembersFromTeam: async (
    teamId: number,
    agentIds: string[]
  ): Promise<ApiResponse<BulkRemoveMembersFromTeamResponse>> => {
    try {
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      if (!agentIds || agentIds.length === 0) {
        return { success: false, error: '成員 ID 列表不能為空' }
      }
      if (agentIds.length > 50) {
        return { success: false, error: '每次最多移除 50 位成員' }
      }

      const response = await callApiContract(
        teamContracts.bulkRemoveMembersFromTeam,
        { teamId },
        { agentIds }
      )

      if (response.success) {
        return response
      }

      return { success: false, error: response.error || '批量移除成員失敗' }
    } catch (error) {
      console.error('Bulk remove members from team failed:', error)
      return { success: false, error: '網路錯誤，無法批量移除成員' }
    }
  },

  /**
   * Phase 2 優化：批量將多位成員加入單一團隊
   * - 1 API 請求 (vs 原本 N 請求)
   * - 2-3 DB 查詢 (vs 原本 6*N 查詢)
   * - 用戶等待時間: ~200ms (vs 原本 ~1000ms for 5 members)
   *
   * @param teamId 目標團隊 ID
   * @param agentIds 要加入的成員 ID 列表 (最多 50 個)
   * @param roleInTeam 團隊內角色 (預設: member)
   */
  batchAddMembersToTeam: async (
    teamId: number,
    agentIds: string[],
    roleInTeam?: 'member' | 'lead' | 'supervisor'
  ): Promise<ApiResponse<BatchAddMembersToTeamResponse>> => {
    try {
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      if (!agentIds || agentIds.length === 0) {
        return { success: false, error: '成員 ID 列表不能為空' }
      }
      if (agentIds.length > 50) {
        return { success: false, error: '每次最多新增 50 位成員' }
      }

      return callApiContract(teamContracts.batchAddMembersToTeam, { teamId }, {
        agentIds,
        roleInTeam: roleInTeam || 'member'
      })
    } catch (error) {
      console.error('Batch add members failed:', error)
      return { success: false, error: '網路錯誤，無法批量新增成員' }
    }
  },

  // ============================================================
  // Multi-Team Membership APIs (Migration 0028)
  // 多團隊成員關係 API - 支援客服加入無限團隊
  // ============================================================

  /**
   * 獲取客服所屬的所有團隊
   * @param agentId 客服 ID
   */
  getAgentTeams: async (agentId: string): Promise<ApiResponse<AgentTeamMembership[]>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      return callApiContract(teamMembershipContracts.getAgentTeams, { agentId })
    } catch (error) {
      console.error('Get agent teams failed:', error)
      return { success: false, error: '網路錯誤，無法獲取客服團隊' }
    }
  },

  /**
   * 將客服加入團隊
   * @param agentId 客服 ID
   * @param teamId 團隊 ID
   * @param options 可選參數 (角色、是否為主要團隊)
   */
  joinTeam: async (agentId: string, teamId: number, options?: {
    roleInTeam?: TeamRoleInTeam;
    isPrimary?: boolean;
  }): Promise<ApiResponse<AgentTeamMembership>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return callApiContract(teamMembershipContracts.joinTeam, { agentId }, {
        teamId,
        ...options
      })
    } catch (error) {
      console.error('Join team failed:', error)
      return { success: false, error: '網路錯誤，無法加入團隊' }
    }
  },

  /**
   * 批量將客服加入多個團隊
   * @param agentId 客服 ID
   * @param teamIds 團隊 ID 陣列
   * @param roleInTeam 團隊內角色
   */
  joinMultipleTeams: async (agentId: string, teamIds: number[], roleInTeam?: TeamRoleInTeam): Promise<ApiResponse<{
    added: number[];
    skipped: number[];
    errors: { teamId: number; error: string }[];
  }>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamIds?.length) {
        return { success: false, error: '團隊 ID 列表不能為空' }
      }
      return callApiContract(teamMembershipContracts.joinMultipleTeams, { agentId }, {
        teamIds,
        roleInTeam
      })
    } catch (error) {
      console.error('Join multiple teams failed:', error)
      return { success: false, error: '網路錯誤，無法批量加入團隊' }
    }
  },

  /**
   * 從團隊離開
   * @param agentId 客服 ID
   * @param teamId 團隊 ID
   */
  leaveTeam: async (agentId: string, teamId: number): Promise<ApiResponse<void>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return callApiContract(teamMembershipContracts.leaveTeam, { agentId, teamId })
    } catch (error) {
      console.error('Leave team failed:', error)
      return { success: false, error: '網路錯誤，無法離開團隊' }
    }
  },

  /**
   * 更新客服在團隊中的角色
   * @param agentId 客服 ID
   * @param teamId 團隊 ID
   * @param options 更新選項
   */
  updateAgentTeamRole: async (agentId: string, teamId: number, options: {
    roleInTeam?: TeamRoleInTeam;
    isPrimary?: boolean;
  }): Promise<ApiResponse<AgentTeamMembership>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return callApiContract(
        teamMembershipContracts.updateAgentTeamRole,
        { agentId, teamId },
        options
      )
    } catch (error) {
      console.error('Update agent team role failed:', error)
      return { success: false, error: '網路錯誤，無法更新角色' }
    }
  },

  /**
   * 設定主要團隊
   * @param agentId 客服 ID
   * @param teamId 團隊 ID
   */
  setPrimaryTeam: async (agentId: string, teamId: number): Promise<ApiResponse<void>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return callApiContract(teamMembershipContracts.setPrimaryTeam, { agentId, teamId })
    } catch (error) {
      console.error('Set primary team failed:', error)
      return { success: false, error: '網路錯誤，無法設定主要團隊' }
    }
  },

  /**
   * 獲取團隊成員（包含多團隊資訊）
   * @param teamId 團隊 ID
   * @returns 後端返回格式：{ id, email, displayName, role, isActive, teams, primaryTeamId }
   */
  getTeamMembersWithTeams: async (
    teamId: number
  ): Promise<ApiResponse<TeamMemberWithTeamsResponse[]>> => {
    try {
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return callApiContract(teamMembershipContracts.getTeamMembersWithTeams, { teamId })
    } catch (error) {
      console.error('Get team members with teams failed:', error)
      return { success: false, error: '網路錯誤，無法獲取團隊成員' }
    }
  }
}
