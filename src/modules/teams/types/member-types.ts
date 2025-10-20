// Team Member Types
// 團隊成員相關類型定義

export interface TeamMember {
  id: string;
  loginId: string;
  email: string;
  name: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  teamId: number | null;
  group: string;
  isActive: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  lastActive: string | null;
  lastLoginAt: string | null;
}

export interface AddTeamMemberRequest {
  email: string;
  password: string;
  displayName: string;
  role?: 'admin' | 'team' | 'agent';
  teamId?: number;
  isActive?: boolean;
}

export interface UpdateMemberStatusRequest {
  isActive: boolean;
  reason?: string;
}

export interface UpdateMemberRoleRequest {
  role: 'admin' | 'team' | 'agent';
  reason?: string;
}

export interface UpdateMemberRequest {
  email?: string;
  displayName?: string;
  role?: 'admin' | 'team' | 'agent';
  teamId?: number | null;
  isActive?: boolean;
}

export interface DeleteMemberRequest {
  reason?: string;
  transferConversationsTo?: string; // agentId to transfer conversations to
}

export interface MemberListQuery {
  teamId?: number;
  role?: 'admin' | 'team' | 'agent';
  status?: 'active' | 'inactive';
  search?: string;
  page?: number;
  limit?: number;
}

export interface MemberListResponse {
  members: TeamMember[];
  total: number;
  page: number;
  limit: number;
}
