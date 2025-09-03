// 團隊管理 API 客戶端
import { apiClient } from './base'
import type { 
  TeamMember, 
  Invitation, 
  InvitationRequest,
  ApiResponse 
} from '@/types'

export const teamApi = {
  // 獲取團隊成員列表
  getMembers: async (): Promise<ApiResponse<TeamMember[]>> => {
    return apiClient.get('/team/members')
  },

  // 獲取待處理邀請列表
  getInvitations: async (): Promise<ApiResponse<Invitation[]>> => {
    return apiClient.get('/team/invitations')
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
    return apiClient.post('/team/members', request)
  },

  // 邀請新成員
  inviteMember: async (request: InvitationRequest): Promise<ApiResponse<{ qrCode?: string; inviteLink?: string }>> => {
    return apiClient.post('/team/invite', request)
  },

  // 重新發送邀請
  resendInvitation: async (invitationId: string): Promise<ApiResponse<void>> => {
    return apiClient.post(`/team/invitations/${invitationId}/resend`)
  },

  // 取消邀請
  cancelInvitation: async (invitationId: string): Promise<ApiResponse<void>> => {
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
    return apiClient.get('/team/stats')
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
    return apiClient.post('/team/invitations/accept', {
      token,
      ...userData
    })
  },

  // 拒絕邀請
  declineInvitation: async (token: string): Promise<ApiResponse<void>> => {
    return apiClient.post('/team/invitations/decline', { token })
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
    return apiClient.post('/team/qr-invite', request)
  },

  // 遷移明文密碼到加密存儲 (臨時管理功能)
  migratePasswords: async (): Promise<ApiResponse<{
    migrated: Array<{ username: string; status: string; error?: string }>;  // username 實際上是 displayName
    total: number;
  }>> => {
    return apiClient.post('/team/migrate-passwords')
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
  generateTeamQR: async (teamId: number): Promise<ApiResponse<{
    qrCode: string;
  }>> => {
    return apiClient.post(`/teams/${teamId}/qr-code`)
  }
}