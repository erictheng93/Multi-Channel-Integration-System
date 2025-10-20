// Invitation Types
// 邀請系統相關類型定義

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'team' | 'agent';
  teamId?: number;
  invitedBy: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface InviteMemberRequest {
  email: string;
  role?: 'admin' | 'team' | 'agent';
  teamId?: number;
  message?: string;
  expiryHours?: number; // Default: 72 hours
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  displayName: string;
}

export interface InvitationListQuery {
  status?: 'pending' | 'accepted' | 'expired' | 'revoked';
  page?: number;
  limit?: number;
}
