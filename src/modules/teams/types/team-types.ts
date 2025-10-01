// Teams Module Types
// 團隊模組類型定義

// Database schema types
import type { teams, agents } from '@/db/schema';

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Agent = typeof agents.$inferSelect;

// API Request/Response types
export interface TeamListRequest {
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  search?: string;
}

export interface TeamListResponse {
  teams: TeamWithStats[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TeamWithStats extends Team {
  memberCount?: number;
  activeMembers?: number;
  conversationCount?: number;
  qrCodeScans?: number;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean | null;
  lastActive: string | null;
  joinedAt: string | null;
}

export interface TeamCreateRequest {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface TeamUpdateRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface TeamMemberAddRequest {
  agentId: string;
  role?: string;
}

export interface TeamMemberUpdateRequest {
  role?: string;
  isActive?: boolean;
}

export interface TeamQRCodeRequest {
  regenerate?: boolean;
}

export interface TeamQRCodeResponse {
  teamId: number;
  qrCode: string;
  generatedAt: string;
  scanCount: number;
}

export interface TeamStatsRequest {
  dateFrom?: string;
  dateTo?: string;
  includeMembers?: boolean;
}

export interface TeamStats {
  teamId: number;
  teamName: string;
  totalMembers: number;
  activeMembers: number;
  conversationsHandled: number;
  messagesCount: number;
  avgResponseTime: number;
  memberStats?: TeamMemberStats[];
  qrCodeScans: number;
  period: {
    from: string;
    to: string;
  };
}

export interface TeamMemberStats {
  agentId: string;
  displayName: string;
  conversationsHandled: number;
  messagesCount: number;
  avgResponseTime: number;
  lastActive: string | null;
}

export interface TeamTransferRequest {
  fromTeamId: number;
  toTeamId: number;
  agentIds: string[];
  reason?: string;
}

export interface TeamTransferResponse {
  success: boolean;
  transferredAgents: string[];
  failedTransfers: Array<{
    agentId: string;
    reason: string;
  }>;
}

// Service interfaces
export interface TeamServiceInterface {
  // Team CRUD operations
  createTeam(data: TeamCreateRequest): Promise<Team>;
  getTeam(id: number): Promise<TeamWithStats | null>;
  updateTeam(id: number, data: TeamUpdateRequest): Promise<Team>;
  deleteTeam(id: number): Promise<boolean>;

  // Team listing and search
  listTeams(params: TeamListRequest): Promise<TeamListResponse>;
  searchTeams(query: string): Promise<Team[]>;

  // Member management
  addMember(teamId: number, request: TeamMemberAddRequest): Promise<TeamMember>;
  removeMember(teamId: number, agentId: string): Promise<boolean>;
  updateMember(teamId: number, agentId: string, request: TeamMemberUpdateRequest): Promise<TeamMember>;
  getMembers(teamId: number): Promise<TeamMember[]>;

  // QR Code management
  generateQRCode(teamId: number): Promise<TeamQRCodeResponse>;
  getQRCode(teamId: number): Promise<TeamQRCodeResponse | null>;

  // Statistics and analytics
  getTeamStats(teamId: number, params?: TeamStatsRequest): Promise<TeamStats>;
  getAllTeamsStats(params?: TeamStatsRequest): Promise<TeamStats[]>;

  // Team transfers
  transferMembers(request: TeamTransferRequest): Promise<TeamTransferResponse>;
}

// Event types for real-time updates
export interface TeamEvent {
  type: 'team.created' | 'team.updated' | 'team.deleted' |
        'member.added' | 'member.removed' | 'member.updated' |
        'qr.generated' | 'stats.updated';
  teamId: number;
  data: any;
  timestamp: string;
  userId?: string;
}

// Permission types
export interface TeamPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canViewStats: boolean;
  canGenerateQR: boolean;
}

// QR Code scan tracking
export interface QRCodeScan {
  id?: string;
  teamId: number;
  scannedAt: string;
  scannerInfo?: {
    userAgent?: string;
    ip?: string;
    location?: string;
  };
  metadata?: Record<string, any>;
}

// Error classes
export class TeamPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamPermissionError';
  }
}

export class InvalidTeamDataError extends Error {
  public details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'InvalidTeamDataError';
    this.details = details;
  }
}

// Re-export shared types
export type { Bindings } from '@/types';
// Note: ApiResponse, PaginatedResponse may need to be defined or imported from correct location