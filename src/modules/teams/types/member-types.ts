// Team Member Types
// 團隊成員相關類型定義

export interface TeamMember {
  id: string;
  loginId: string;
  email: string;
  name: string;
  displayName: string;
  role: 'admin' | 'agent'; // 2-tier role system
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
  role?: 'admin' | 'agent'; // 2-tier role system
  teamId?: number;
  isActive?: boolean;
}

export interface UpdateMemberStatusRequest {
  isActive: boolean;
  reason?: string;
}

export interface UpdateMemberRoleRequest {
  role: 'admin' | 'agent'; // 2-tier role system
  reason?: string;
}

export interface UpdateMemberRequest {
  email?: string;
  displayName?: string;
  role?: 'admin' | 'agent'; // 2-tier role system
  teamId?: number | null;
  isActive?: boolean;
}

export interface DeleteMemberRequest {
  reason?: string;
  transferConversationsTo?: string; // agentId to transfer conversations to
}

export interface MemberListQuery {
  teamId?: number;
  role?: 'admin' | 'agent'; // 2-tier role system
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

// ==================== Bulk Operations ====================

/**
 * 批量刪除成員請求
 */
export interface BulkDeleteMembersRequest {
  /** 要刪除的成員 ID 列表 (最多 50 個) */
  memberIds: string[];
  /** 刪除原因 (可選) */
  reason?: string;
}

/**
 * 批量刪除結果
 */
export interface BulkDeleteResult {
  /** 成功刪除的成員 ID */
  deleted: string[];
  /** 刪除失敗的成員 */
  failed: { memberId: string; error: string }[];
  /** 已刪除的成員信息 (用於恢復) */
  deletedMembers: TeamMember[];
}

/**
 * 批量刪除成員響應
 */
export interface BulkDeleteMembersResponse {
  /** 成功刪除的成員 ID */
  deleted: string[];
  /** 刪除失敗的成員 */
  failed: { memberId: string; error: string }[];
  /** Undo token (用於恢復) */
  undoToken: string;
  /** Undo 過期時間 */
  undoExpiresAt: string;
  /** 已刪除的成員數量 */
  deletedCount: number;
}

/**
 * 恢復成員請求
 */
export interface RestoreMembersRequest {
  /** 要恢復的成員 ID 列表 (直接指定) */
  memberIds?: string[];
  /** Undo token (從 KV 獲取成員 ID) */
  undoToken?: string;
}

/**
 * 恢復結果
 */
export interface RestoreResult {
  /** 成功恢復的成員 */
  restored: TeamMember[];
  /** 恢復失敗的成員 */
  failed: { memberId: string; error: string }[];
}

/**
 * 恢復成員響應
 */
export interface RestoreMembersResponse {
  /** 成功恢復的成員 */
  restored: TeamMember[];
  /** 恢復失敗的成員 */
  failed: { memberId: string; error: string }[];
  /** 恢復成功的數量 */
  restoredCount: number;
}

/**
 * Undo Token 數據 (存儲在 KV 中)
 */
export interface UndoTokenData {
  /** 被刪除的成員 ID 列表 */
  memberIds: string[];
  /** 執行刪除的用戶 ID */
  deletedBy: string;
  /** 刪除時間 */
  deletedAt: string;
  /** 刪除原因 */
  reason?: string;
}
