// 團隊管理 API 客戶端
import { apiClient } from './base'
import type { 
  TeamMember, 
  Invitation, 
  InvitationRequest,
  ApiResponse,
  QRCode
} from '@/types'

export const teamApi = {
  // 檢查邀請功能是否啟用
  // 注意：邀請功能已暫時禁用，等待郵件服務集成
  isInvitationEnabled: (): boolean => {
    // 從環境變數檢查是否啟用邀請功能
    // 預設為 false，因為後端已禁用此功能
    return import.meta.env.VITE_ENABLE_INVITATION === 'true' || false
  },

  // 獲取團隊成員列表
  getMembers: async (): Promise<ApiResponse<TeamMember[]>> => {
    return apiClient.get('/teams/members')
  },

  // 獲取待處理邀請列表
  getInvitations: async (): Promise<ApiResponse<Invitation[]>> => {
    return apiClient.get('/teams/invitations')
  },

  // 直接新增成員
  addMember: async (request: {
    loginId: string;
    name?: string;
    email?: string;
    password: string;
    role: 'admin' | 'team' | 'agent';
    group?: string;
    isActive: boolean;
  }): Promise<ApiResponse<TeamMember>> => {
    return apiClient.post('/teams/members', request)
  },

  // 邀請新成員
  inviteMember: async (request: InvitationRequest): Promise<ApiResponse<{ qrCode?: string; inviteLink?: string }>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用，請使用直接添加成員功能 (Direct Member Add)'
      }
    }
    return apiClient.post('/teams/invite', request)
  },

  // 重新發送邀請
  resendInvitation: async (invitationId: string): Promise<ApiResponse<void>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用'
      }
    }
    return apiClient.post(`/team/invitations/${invitationId}/resend`)
  },

  // 取消邀請
  cancelInvitation: async (invitationId: string): Promise<ApiResponse<void>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用'
      }
    }
    return apiClient.delete(`/team/invitations/${invitationId}`)
  },

  // 移除團隊成員
  removeMember: async (memberId: string): Promise<ApiResponse<void>> => {
    return apiClient.delete(`/team/members/${memberId}`)
  },

  // 更新成員角色
  updateMemberRole: async (memberId: string, role: 'admin' | 'team' | 'agent'): Promise<ApiResponse<void>> => {
    return apiClient.put(`/team/members/${memberId}/role`, { role })
  },

  // 更新成員狀態
  updateMemberStatus: async (memberId: string, status: 'active' | 'inactive'): Promise<ApiResponse<void>> => {
    return apiClient.put(`/team/members/${memberId}/status`, { status })
  },

  // 重設成員密碼
  resetPassword: async (memberId: string): Promise<ApiResponse<void>> => {
    return apiClient.post(`/team/members/${memberId}/reset-password`)
  },

  // 重設成員密碼帶政策
  resetPasswordWithPolicy: async (memberId: string, data: {
    newPassword: string;
    policy: 'changeable' | 'unchangeable' | 'must_change';
  }): Promise<ApiResponse<void>> => {
    return apiClient.post(`/team/members/${memberId}/reset-password-policy`, data)
  },

  // 獲取成員密碼
  getMemberPassword: async (memberId: string): Promise<ApiResponse<{
    password: string;
    username: string;  // 保留作為向後兼容，但實際上會使用 displayName 的值
    displayName: string;
  }>> => {
    return apiClient.get(`/team/members/${memberId}/password`)
  },

  // 更新成員資訊
  updateMember: async (memberId: string, data: Partial<TeamMember>): Promise<ApiResponse<TeamMember>> => {
    return apiClient.put(`/team/members/${memberId}`, data)
  },

  // 獲取團隊統計資訊
  getTeamStats: async (): Promise<ApiResponse<{
    totalMembers: number;
    activeMembers: number;
    pendingInvitations: number;
    adminCount: number;
  }>> => {
    return apiClient.get('/teams/stats')
  },

  // 接受邀請 (用於邀請頁面)
  acceptInvitation: async (token: string, userData: {
    name: string;
    password: string;
  }): Promise<ApiResponse<{
    token: string;
    refreshToken?: string;
    agent: TeamMember;
  }>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用'
      }
    }
    return apiClient.post('/teams/invitations/accept', {
      token,
      ...userData
    })
  },

  // 拒絕邀請
  declineInvitation: async (token: string): Promise<ApiResponse<void>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用'
      }
    }
    return apiClient.post('/teams/invitations/decline', { token })
  },

  // 驗證邀請令牌
  validateInvitation: async (token: string): Promise<ApiResponse<{
    valid: boolean;
    invitation: {
      email: string;
      role: string;
      teamName?: string;
      inviterName?: string;
      expiresAt: string;
    };
  }>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用'
      }
    }
    return apiClient.get(`/team/invitations/validate/${token}`)
  },

  // 產生 QR 碼邀請連結
  generateQRInvite: async (request: {
    email: string;
    role: 'admin' | 'agent';
    message?: string;
  }): Promise<ApiResponse<{
    qrCode: string;
    inviteLink: string;
    token: string;
  }>> => {
    if (!teamApi.isInvitationEnabled()) {
      return {
        success: false,
        error: '邀請功能暫時不可用，請使用團隊 QR 碼功能'
      }
    }
    return apiClient.post('/teams/qr-invite', request)
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
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    memberCount?: number;
  }>>> => {
    const params = includeInactive ? '?includeInactive=true' : '';
    return apiClient.get(`/teams${params}`)
  },

  // 創建團隊
  createTeam: async (data: {
    name: string;
    description?: string;
  }): Promise<ApiResponse<{
    id: number;
    name: string;
    description?: string;
    qrCode?: string;
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

  // 生成團隊 QR 碼
  generateTeamQR: async (teamId: number, data?: {
    campaignName?: string;
    description?: string;
    expiresAt?: string;
    maxUses?: number;
  }): Promise<ApiResponse<{
    id: string;
    qrCode: string;
    lineUrl: string;
    token: string;
    campaignName?: string;
    usageCount: number;
    maxUses?: number;
    expiresAt?: Date;
  }>> => {
    return apiClient.post(`/teams/${teamId}/qr-code`, data || {})
  },
  
  // 獲取團隊 QR 碼列表
  getTeamQRCodes: async (teamId: number): Promise<ApiResponse<QRCode[]>> => {
    return apiClient.get(`/teams/${teamId}/qr-codes`)
  },
  
  // 停用 QR 碼
  deactivateQRCode: async (teamId: number, qrCodeId: string): Promise<ApiResponse<void>> => {
    return apiClient.put(`/teams/${teamId}/qr-codes/${qrCodeId}/deactivate`)
  },
  
  // 獲取 QR 碼統計
  getTeamQRStats: async (teamId: number, dateRange?: { start: Date; end: Date }): Promise<ApiResponse<{
    totalScans: number;
    newCustomers: number;
    conversionRate: number;
    activeQRCodes: number;
  }>> => {
    let url = `/teams/${teamId}/qr-stats`
    if (dateRange) {
      const searchParams = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      })
      url += `?${searchParams.toString()}`
    }
    return apiClient.get(url)
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

      const response = await apiClient.get<TeamMember>(`/team/members/${memberId}`)
      
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
  }
}