// 團隊管理 API 客戶端
import { apiClient } from './base'
import type {
  TeamMember,
  ApiResponse,
  AgentTeamMembership
} from '@/types'

export const teamApi = {
  // 獲取團隊成員列表
  getMembers: async (): Promise<ApiResponse<TeamMember[]>> => {
    return apiClient.get('/teams/members')
  },

  // 直接新增成員
  addMember: async (request: {
    loginId: string;
    name?: string;
    email?: string;
    password: string;
    role: 'admin' | 'agent'; // Simplified from 3-tier to 2-tier role system
    group?: string;
    isActive: boolean;
  }): Promise<ApiResponse<TeamMember>> => {
    // 轉換前端數據格式為後端期望的格式
    const backendRequest = {
      email: request.email || request.loginId, // email 是必填，如果沒有則使用 loginId
      password: request.password,
      displayName: request.name || request.loginId, // displayName 是必填，如果沒有則使用 loginId
      role: request.role,
      isActive: request.isActive
    };

    return apiClient.post('/teams/members', backendRequest)
  },

  // 移除團隊成員 (軟刪除)
  removeMember: async (memberId: string): Promise<ApiResponse<void>> => {
    return apiClient.delete(`/teams/members/${memberId}`)
  },

  // ==================== Bulk Operations ====================

  /**
   * 批量刪除成員 (軟刪除)
   * @param memberIds 要刪除的成員 ID 列表 (最多 50 個)
   * @param reason 刪除原因 (可選)
   * @returns 包含 undoToken 的響應，可用於 10 秒內恢復
   */
  bulkDeleteMembers: async (memberIds: string[], reason?: string): Promise<ApiResponse<{
    deleted: string[];
    failed: { memberId: string; error: string }[];
    undoToken: string;
    undoExpiresAt: string;
    deletedCount: number;
  }>> => {
    return apiClient.post('/teams/members/bulk-delete', {
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
  ): Promise<ApiResponse<{
    updated: string[];
    failed: { memberId: string; error: string }[];
    skipped: { memberId: string; reason: string }[];
    updatedCount: number;
  }>> => {
    return apiClient.post('/teams/members/bulk-update', {
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
    members: Array<{
      memberId: string;
      profile?: {
        displayName?: string;
        email?: string;
        role?: 'admin' | 'agent';
      };
      teamChanges?: {
        add?: number[];
        remove?: number[];
      };
    }>,
    reason?: string
  ): Promise<ApiResponse<{
    results: Array<{
      memberId: string;
      success: boolean;
      error?: string;
      profileUpdated: boolean;
      teamsAdded: number[];
      teamsRemoved: number[];
    }>;
    successCount: number;
    failedCount: number;
    skipped: { memberId: string; reason: string }[];
    undoToken?: string;
    undoExpiresAt?: string;
  }>> => {
    return apiClient.post('/teams/members/batch-edit', {
      members,
      reason
    })
  },

  /**
   * 撤銷批量編輯
   */
  undoBatchEdit: async (undoToken: string): Promise<ApiResponse<{
    restoredCount: number;
    results: Array<{
      memberId: string;
      success: boolean;
      error?: string;
    }>;
  }>> => {
    return apiClient.post('/teams/members/batch-edit/undo', { undoToken })
  },

  /**
   * 恢復已刪除的成員
   * 支持兩種模式：
   * 1. undoToken: 使用 KV 中存儲的 token 獲取成員 ID
   * 2. memberIds: 直接指定要恢復的成員 ID
   */
  restoreMembers: async (options: {
    undoToken?: string;
    memberIds?: string[];
  }): Promise<ApiResponse<{
    restored: Array<{
      id: string;
      email: string;
      name: string;
      displayName: string;
      role: string;
    }>;
    failed: { memberId: string; error: string }[];
    restoredCount: number;
  }>> => {
    return apiClient.post('/teams/members/restore', options)
  },

  // 更新成員角色
  updateMemberRole: async (memberId: string, role: 'admin' | 'agent'): Promise<ApiResponse<void>> => { // Simplified from 3-tier to 2-tier
    return apiClient.put(`/teams/members/${memberId}/role`, { role })
  },

  // 更新成員狀態
  updateMemberStatus: async (memberId: string, status: 'active' | 'inactive'): Promise<ApiResponse<void>> => {
    return apiClient.put(`/teams/members/${memberId}/status`, { isActive: status === 'active' })
  },

  // 重設成員密碼
  resetPassword: async (memberId: string): Promise<ApiResponse<void>> => {
    return apiClient.post(`/teams/members/${memberId}/reset-password`)
  },

  // 重設成員密碼帶政策
  resetPasswordWithPolicy: async (memberId: string, data: {
    newPassword: string;
    policy: 'changeable' | 'unchangeable' | 'must_change';
  }): Promise<ApiResponse<void>> => {
    // Fixed: Updated path from /team to /teams and endpoint from reset-password-policy to reset
    return apiClient.post(`/teams/members/${memberId}/reset`, data)
  },

  // 獲取成員密碼
  getMemberPassword: async (memberId: string): Promise<ApiResponse<{
    password: string;
    username: string;  // 保留作為向後兼容，但實際上會使用 displayName 的值
    displayName: string;
  }>> => {
    return apiClient.get(`/teams/members/${memberId}/password`)
  },

  // 更新成員資訊
  updateMember: async (memberId: string, data: Partial<TeamMember>): Promise<ApiResponse<TeamMember>> => {
    return apiClient.put(`/teams/members/${memberId}`, data)
  },

  // 獲取團隊統計資訊
  getTeamStats: async (): Promise<ApiResponse<{
    totalMembers: number;
    activeMembers: number;
    adminCount: number;
  }>> => {
    return apiClient.get('/teams/stats')
  },

  // 遷移明文密碼到加密存儲 (臨時管理功能)
  migratePasswords: async (): Promise<ApiResponse<{
    migrated: Array<{ username: string; status: string; error?: string }>;  // username 實際上是 displayName
    total: number;
  }>> => {
    return apiClient.post('/teams/migrate-passwords')
  },

  // 團隊管理 API
  // 獲取所有團隊
  getTeams: async (includeInactive?: boolean): Promise<ApiResponse<Array<{
    id: number;
    name: string;
    description?: string;
    qrCode?: string;
    lineUrl?: string;  // 🆕 Phase 3: LINE 連結 URL
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    memberCount?: number;
  }>>> => {
    const params = includeInactive ? '?includeInactive=true' : '';
    return apiClient.get(`/teams${params}`)
  },

  // 創建團隊
  // 🆕 Phase 3: 團隊創建時會並行生成 QR 碼，回應中包含 qrCode 和 lineUrl
  createTeam: async (data: {
    name: string;
    description?: string;
  }): Promise<ApiResponse<{
    id: number;
    name: string;
    description?: string;
    qrCode?: string;
    lineUrl?: string;  // 🆕 Phase 3: LINE 連結 URL
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>> => {
    return apiClient.post('/teams', data)
  },

  // 更新團隊
  updateTeam: async (teamId: number, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<{
    id: number;
    name: string;
    description?: string;
    qrCode?: string;
    lineUrl?: string;  // 🆕 Phase 3: LINE 連結 URL
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>> => {
    return apiClient.put(`/teams/${teamId}`, data)
  },

  // 刪除團隊
  deleteTeam: async (teamId: number): Promise<ApiResponse<void>> => {
    return apiClient.delete(`/teams/${teamId}`)
  },

  // 獲取團隊詳情
  getTeamDetail: async (teamId: number): Promise<ApiResponse<{
    id: number;
    name: string;
    description?: string;
    qrCode?: string;
    lineUrl?: string;  // 🆕 Phase 3: LINE 連結 URL
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    memberCount?: number;
  }>> => {
    return apiClient.get(`/teams/${teamId}`)
  },

  // 獲取團隊成員（特定團隊）
  getTeamMembersByTeam: async (teamId: number): Promise<ApiResponse<TeamMember[]>> => {
    return apiClient.get(`/teams/${teamId}/members`)
  },

  // 獲取團隊統計（特定團隊）
  getTeamStatsByTeam: async (teamId: number): Promise<ApiResponse<{
    totalMembers: number;
    activeMembers: number;
    pendingInvitations: number;
    adminCount: number;
  }>> => {
    return apiClient.get(`/teams/${teamId}/stats`)
  },

  // ==================== LIFF QR Code API ====================
  // 生成或重新生成團隊 LIFF QR 碼 (永久有效，每團隊一個)
  generateLiffQR: async (teamId: number): Promise<ApiResponse<{
    id: string;
    liffUrl: string;
    qrCodeUrl: string;
    scanCount: number;
    isActive: boolean;
  }>> => {
    return apiClient.post(`/teams/${teamId}/qr-code/liff`)
  },

  // 獲取團隊 LIFF QR 碼
  getLiffQRCode: async (teamId: number): Promise<ApiResponse<{
    id: string;
    liffUrl: string;
    qrCodeUrl: string;
    scanCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>> => {
    return apiClient.get(`/teams/${teamId}/qr-code/liff`)
  },

  // 獲取 LIFF QR 碼統計
  getLiffQRStats: async (teamId: number): Promise<ApiResponse<{
    scanCount: number;
    assignmentCount: number;
    createdAt: string;
    lastScannedAt: string;
    isActive: boolean;
  }>> => {
    return apiClient.get(`/teams/${teamId}/qr-code/liff/stats`)
  },

  // 獲取團隊成員（用於指派功能）
  getTeamMembers: async (teamId?: number): Promise<ApiResponse<TeamMember[]>> => {
    try {
      const url = teamId ? `/teams/${teamId}/members` : '/teams/members'
      const response = await apiClient.get<TeamMember[]>(url)
      
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
      const response = await apiClient.get<TeamMember[]>('/teams/assignees')
      
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

      const response = await apiClient.get<TeamMember>(`/teams/members/${memberId}`)

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

      // 使用新的多團隊 API: POST /api/teams/agent-teams/:agentId/join
      const response = await apiClient.post<AgentTeamMembership>(`/teams/agent-teams/${agentId}/join`, {
        teamId,
        roleInTeam: 'member',
        isPrimary: false
      })

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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
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

      // 使用新的多團隊 API: DELETE /api/teams/agent-teams/:agentId/leave/:teamId
      const response = await apiClient.delete<void>(`/teams/agent-teams/${agentId}/leave/${teamId}`)

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

  // 🆕 批量從團隊移除成員
  bulkRemoveMembersFromTeam: async (teamId: number, agentIds: string[]): Promise<ApiResponse<{
    removed: string[];
    failed: { agentId: string; error: string }[];
    removedCount: number;
  }>> => {
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

      const response = await apiClient.post<{
        removed: string[];
        failed: { agentId: string; error: string }[];
        removedCount: number;
      }>(`/teams/${teamId}/members/bulk-remove`, { agentIds })

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
   * 🚀 Phase 2 優化：批量將多位成員加入單一團隊
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
  ): Promise<ApiResponse<{
    added: string[];
    skipped: string[];
    errors: { agentId: string; error: string }[];
    addedCount: number;
  }>> => {
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

      return apiClient.post(`/teams/${teamId}/members/batch`, {
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
      return apiClient.get(`/teams/agent-teams/${agentId}`)
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
    roleInTeam?: 'member' | 'lead' | 'supervisor';
    isPrimary?: boolean;
  }): Promise<ApiResponse<AgentTeamMembership>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return apiClient.post(`/teams/agent-teams/${agentId}/join`, {
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
  joinMultipleTeams: async (agentId: string, teamIds: number[], roleInTeam?: string): Promise<ApiResponse<{
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
      return apiClient.post(`/teams/agent-teams/${agentId}/join-multiple`, {
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
      return apiClient.delete(`/teams/agent-teams/${agentId}/leave/${teamId}`)
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
    roleInTeam?: 'member' | 'lead' | 'supervisor';
    isPrimary?: boolean;
  }): Promise<ApiResponse<AgentTeamMembership>> => {
    try {
      if (!agentId?.trim()) {
        return { success: false, error: '客服 ID 不能為空' }
      }
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return apiClient.put(`/teams/agent-teams/${agentId}/role/${teamId}`, options)
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
      return apiClient.put(`/teams/agent-teams/${agentId}/primary/${teamId}`)
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
  getTeamMembersWithTeams: async (teamId: number): Promise<ApiResponse<Array<{
    id: string;
    email: string;
    displayName: string;
    role: string;
    isActive: boolean;
    teams: AgentTeamMembership[];
    primaryTeamId?: number;
  }>>> => {
    try {
      if (!teamId) {
        return { success: false, error: '團隊 ID 不能為空' }
      }
      return apiClient.get(`/teams/agent-teams/team/${teamId}/members`)
    } catch (error) {
      console.error('Get team members with teams failed:', error)
      return { success: false, error: '網路錯誤，無法獲取團隊成員' }
    }
  }
}