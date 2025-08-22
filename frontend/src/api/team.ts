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
    role: 'admin' | 'agent';
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
  updateMemberRole: async (memberId: string, role: 'admin' | 'agent'): Promise<ApiResponse<void>> => {
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
  }
}