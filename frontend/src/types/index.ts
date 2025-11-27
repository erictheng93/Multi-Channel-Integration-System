// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/types/index.ts
// Created by: Frontend TypeScript Developer

// 重新匯出共享型別 - 避免重複匯出
export type {
  Agent,
  Platform,
  User,
  Customer,
  Conversation,
  Message,
  FileAttachmentData, // 檔案附件資料 (用於 Flex Message Card 顯示)
  ApiResponse
} from '@shared/types/index';

// 只匯出不重複的 API 型別
export type {
  LoginRequest,
  LoginResponse,
  SendMessageRequest
} from '@shared/api-types';

import type { Agent, Platform } from '@shared/types/index';

// 前端專用型別
export interface AppState {
  isAuthenticated: boolean;
  currentAgent: Agent | null;
  token: string | null;
}

export interface ConversationFilters {
  status?: 'open' | 'assigned' | 'closed' | '' | undefined;
  assignedTo?: string | undefined;
  platform?: Platform | '' | undefined;
}

// Extended interface for API calls that allows undefined
export interface ConversationApiFilters extends Omit<ConversationFilters, 'assignedTo'> {
  assignedTo?: string | undefined;
}

// QR碼相關型別
export interface QRCode {
  id: string;
  qrCode: string;
  lineUrl: string;
  token: string;
  campaignName: string;
  usageCount: number;
  maxUses?: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

// 分頁響應型別（保留向後兼容）
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore?: boolean;
}

// 團隊管理相關型別
export interface TeamMember {
  id: string;
  loginId: string;
  name?: string;
  email?: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier to 2-tier role system
  status: 'active' | 'inactive' | 'pending';
  group?: string;
  teamId?: number;
  avatar?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt?: Date | string;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier to 2-tier role system
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  message?: string;
  invitedBy: string;
  inviterName: string;
  createdAt: Date | string;
  expiresAt: Date | string;
}

export interface InvitationRequest {
  email: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier to 2-tier role system
  message?: string;
  useQR?: boolean;
}

// 邀請接受請求
export interface AcceptInvitationRequest {
  token: string;
  name: string;
  password: string;
}

// 邀請請求類型
export interface InviteRequest {
  email: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier to 2-tier role system
  message?: string;
  useQR?: boolean;
}

// 訊息過濾器
export interface MessageFilters {
  conversationId?: string;
  senderType?: 'agent' | 'customer';
  platform?: Platform;
  messageType?: 'text' | 'image' | 'file';
}

// 系統設定
export interface SystemSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-TW' | 'en' | 'zh-CN';
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    email: boolean;
  };
  autoRefresh: {
    enabled: boolean;
    interval: number;
  };
  display: {
    density: 'compact' | 'comfortable' | 'spacious';
    showAvatars: boolean;
    showTimestamps: boolean;
    messagePreview: boolean;
  };
}

// 測試相關型別 - 僅在測試環境中使用
export type {
  TestComponentInstance,
  MockApiResponse,
  MockMessageApi,
  MockFileApi,
  MockProps,
  TestEmits,
  CreateWrapperFunction,
  SetupTestFunction,
  CleanupTestFunction,
  TestGlobalConfig,
  FileItem,
  DelayedMessageRequest,
  DelayedMessageResponse,
  PendingMessage
} from './test-types'