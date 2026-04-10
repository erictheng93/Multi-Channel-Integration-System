// Team Member Types
// 團隊成員相關類型定義

export interface TeamMember {
  id: string;
  loginId: string;
  email: string;
  name: string;
  displayName: string;
  role: 'admin' | 'agent'; // 2-tier role system
  primaryTeamId: number | null;  // From agent_teams WHERE isPrimary=true
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
  /** 已刪除的成員數量 */
  deletedCount: number;
}

// ==================== Bulk Update Operations ====================

/**
 * 批量更新成員請求
 */
export interface BulkUpdateMembersRequest {
  /** 要更新的成員 ID 列表 (最多 50 個) */
  memberIds: string[];
  /** 要更新的欄位 */
  updates: {
    /** 新角色 (可選) */
    role?: 'admin' | 'agent';
    /** 新狀態 (可選) */
    isActive?: boolean;
  };
  /** 更新原因 (可選) */
  reason?: string;
}

/**
 * 批量更新結果
 */
export interface BulkUpdateResult {
  /** 成功更新的成員 ID */
  updated: string[];
  /** 更新失敗的成員 */
  failed: { memberId: string; error: string }[];
  /** 被跳過的成員 (如自己) */
  skipped: { memberId: string; reason: string }[];
  /** 已更新的成員信息 */
  updatedMembers: TeamMember[];
}

/**
 * 批量更新成員響應
 */
export interface BulkUpdateMembersResponse {
  /** 成功更新的成員 ID */
  updated: string[];
  /** 更新失敗的成員 */
  failed: { memberId: string; error: string }[];
  /** 被跳過的成員 */
  skipped: { memberId: string; reason: string }[];
  /** 已更新的成員數量 */
  updatedCount: number;
}

// ==================== Batch Edit Operations (Per-member changes) ====================

/**
 * 單個成員的編輯資料
 */
export interface MemberEditData {
  /** 成員 ID */
  memberId: string;
  /** Profile 更新 (可選) */
  profile?: {
    displayName?: string;
    email?: string;
    role?: 'admin' | 'agent';
  };
  /** 團隊變更 (可選) */
  teamChanges?: {
    /** 要加入的團隊 ID */
    add?: number[];
    /** 要離開的團隊 ID */
    remove?: number[];
  };
}

/**
 * 批量編輯成員請求 (每個成員可有不同變更)
 */
export interface BatchEditMembersRequest {
  /** 成員編輯資料列表 (最多 50 個) */
  members: MemberEditData[];
  /** 操作原因 (可選) */
  reason?: string;
}

/**
 * 單個成員的編輯結果
 */
export interface MemberEditResult {
  /** 成員 ID */
  memberId: string;
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 (如果失敗) */
  error?: string;
  /** Profile 更新結果 */
  profileUpdated: boolean;
  /** 團隊新增結果 */
  teamsAdded: number[];
  /** 團隊移除結果 */
  teamsRemoved: number[];
}

/**
 * 批量編輯成員響應
 */
export interface BatchEditMembersResponse {
  /** 各成員的編輯結果 */
  results: MemberEditResult[];
  /** 成功更新的成員數量 */
  successCount: number;
  /** 失敗的成員數量 */
  failedCount: number;
  /** 被跳過的成員 (如自己) */
  skipped: { memberId: string; reason: string }[];
  /** 原始資料 (用於撤銷) */
  originalData?: MemberEditData[];
  /** Undo token (用於恢復) */
  undoToken?: string;
  /** Undo 過期時間 */
  undoExpiresAt?: string;
}

/**
 * 批量編輯 Undo Token 數據
 */
export interface BatchEditUndoTokenData {
  /** 原始成員資料 */
  originalMembers: MemberEditData[];
  /** 執行編輯的用戶 ID */
  editedBy: string;
  /** 編輯時間 */
  editedAt: string;
  /** 操作原因 */
  reason?: string;
}

export interface CheckEmailMemberInfo {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'agent';
  teamName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface CheckEmailResponse {
  exists: boolean;
  status?: 'active' | 'deleted';
  member?: CheckEmailMemberInfo;
}
