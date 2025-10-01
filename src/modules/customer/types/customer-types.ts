// Customer 模組類型定義
// 統一管理客戶相關的所有TypeScript類型

// ======================== 基礎客戶類型 ========================
export interface Customer {
  id: number;
  platform: string;
  platformUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  sourceTeamId: number | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

// 客戶詳細信息 (包含關聯數據)
export interface CustomerWithDetails extends Customer {
  teamName?: string | null;
  tags: CustomerTag[];
  conversationStats: CustomerConversationStats;
  recentMessages?: CustomerRecentMessage[];
}

// 客戶列表項目 (用於列表顯示)
export interface CustomerListItem extends Customer {
  teamName?: string | null;
  tags: CustomerTag[];
  totalConversations: number;
  activeConversations: number;
  lastConversationAt: string | null;
}

// ======================== 客戶標籤類型 ========================
export interface CustomerTag {
  id?: number;
  name: string;
  color: string;
}

export interface CustomerTagAssignment {
  customerId: number;
  tagId: number;
  assignedBy: string | null;
  assignedAt?: string;
}

// ======================== 客戶統計類型 ========================
export interface CustomerStats {
  total: number;
  byPlatform: Record<string, number>;
  byTeam: Record<string, number>;
  withTags: number;
  withEmail: number;
  withPhone: number;
  recentActive: number; // 最近7天活躍
}

export interface CustomerConversationStats {
  total: number;
  active: number;
  closed: number;
  lastConversationAt: string | null;
  firstConversationAt: string | null;
}

// ======================== 客戶搜索與篩選類型 ========================
export interface CustomerFilters {
  platform?: string;
  teamId?: number;
  tagId?: number;
  search?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  dateFrom?: string;
  dateTo?: string;
  status?: 'active' | 'inactive';
}

export interface CustomerSearchQuery {
  q: string;
  limit?: number;
  platform?: string;
}

export interface CustomerSearchResult {
  id: number;
  platform: string;
  platformUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
}

// ======================== 客戶操作類型 ========================
export interface CreateCustomerData {
  platform: string;
  platformUserId: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  sourceTeamId?: number;
  metadata?: CustomerMetadata;
}

export interface UpdateCustomerData {
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceTeamId?: number | null;
  metadata?: CustomerMetadata | null;
}

export interface CustomerTagOperation {
  tagIds: number[];
}

// ======================== 客戶元數據類型 ========================
export interface CustomerMetadata {
  [key: string]: any;
  // LINE specific metadata
  line?: {
    statusMessage?: string;
    pictureUrl?: string;
    language?: string;
  };
  // Facebook specific metadata
  facebook?: {
    locale?: string;
    timezone?: number;
    firstName?: string;
    lastName?: string;
  };
  // Custom fields
  customFields?: {
    [fieldName: string]: string | number | boolean;
  };
}

// ======================== 客戶訊息類型 ========================
export interface CustomerRecentMessage {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'agent';
  content: string;
  messageType: 'text' | 'image' | 'file' | 'sticker';
  createdAt: string;
}

// ======================== API 響應類型 ========================
export interface CustomerListResponse {
  customers: CustomerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerResponse {
  customer: CustomerWithDetails;
}

export interface CustomerStatsResponse {
  stats: CustomerStats;
}

export interface CustomerSearchResponse {
  results: CustomerSearchResult[];
  query: string;
  total: number;
}

// ======================== 資料庫相關類型 ========================
export interface DbCustomer {
  id: number;
  platform: string;
  platform_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  source_team_id: number | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCustomerTag {
  customer_id: number;
  tag_id: number;
  assigned_by: string | null;
  assigned_at: string;
}

// ======================== 權限與驗證類型 ========================
export interface CustomerPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageTags: boolean;
  canViewStats: boolean;
  canExport: boolean;
}

export interface CustomerAccessScope {
  teamIds?: number[];
  platforms?: string[];
  isGlobalAccess: boolean;
}

// ======================== 驗證規則類型 ========================
export interface CustomerValidationRules {
  displayName?: {
    maxLength: number;
    required: boolean;
  };
  email?: {
    pattern: RegExp;
    required: boolean;
  };
  phone?: {
    pattern: RegExp;
    required: boolean;
  };
  metadata?: {
    maxSize: number; // in bytes
  };
}

// ======================== 導出默認驗證規則 ========================
export const DEFAULT_CUSTOMER_VALIDATION: CustomerValidationRules = {
  displayName: {
    maxLength: 100,
    required: false
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    required: false
  },
  phone: {
    pattern: /^[\+]?[\s\-\(\)]?[\d\s\-\(\)]{10,}$/,
    required: false
  },
  metadata: {
    maxSize: 10240 // 10KB
  }
};

// ======================== 錯誤類型 ========================
export interface CustomerError extends Error {
  code: 'CUSTOMER_NOT_FOUND' | 'CUSTOMER_ALREADY_EXISTS' | 'INVALID_CUSTOMER_DATA' | 'PERMISSION_DENIED';
  details?: any;
}

export class CustomerNotFoundError extends Error implements CustomerError {
  code = 'CUSTOMER_NOT_FOUND' as const;
  constructor(customerId: number) {
    super(`Customer with ID ${customerId} not found`);
  }
}

export class CustomerAlreadyExistsError extends Error implements CustomerError {
  code = 'CUSTOMER_ALREADY_EXISTS' as const;
  constructor(platform: string, platformUserId: string) {
    super(`Customer already exists for platform ${platform} with user ID ${platformUserId}`);
  }
}

export class InvalidCustomerDataError extends Error implements CustomerError {
  code = 'INVALID_CUSTOMER_DATA' as const;
  constructor(message: string, public details?: any) {
    super(message);
  }
}

export class CustomerPermissionDeniedError extends Error implements CustomerError {
  code = 'PERMISSION_DENIED' as const;
  constructor(action: string) {
    super(`Permission denied for action: ${action}`);
  }
}