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

// Activity Stream 型別
export type {
  Activity,
  ActivityType,
  ActivityPriority,
  ActivityStreamEvent
} from './activity';

// WebSocket Event 型別
export type {
  WebSocketEvent,
  NewMessageEvent,
  MessageReadEvent,
  MessageRecalledEvent,
  UserConnectedEvent,
  UserDisconnectedEvent,
  TypingStartEvent,
  TypingStopEvent,
  ConnectionStateEvent,
  HeartbeatEvent,
  ErrorEvent,
  MessageRelatedEvent,
  PresenceRelatedEvent,
  ConnectionRelatedEvent,
  EventPayload
} from './websocket-events';

export {
  isNewMessageEvent,
  isMessageReadEvent,
  isMessageRecalledEvent,
  isUserConnectedEvent,
  isUserDisconnectedEvent,
  isTypingStartEvent,
  isTypingStopEvent,
  isConnectionStateEvent,
  isHeartbeatEvent,
  isErrorEvent,
  isMessageRelatedEvent,
  isPresenceRelatedEvent,
  isConnectionRelatedEvent
} from './websocket-events';

import type { Agent, Platform } from '@shared/types/index';

// 前端專用型別
export interface AppState {
  isAuthenticated: boolean;
  currentAgent: Agent | null;
  token: string | null;
}

export interface ConversationFilters {
  status?: 'active' | 'assigned' | 'pending' | '' | undefined;
  // Note: assignedTo removed - only team-based filtering is supported now
  teamId?: number | undefined; // 團隊篩選
  platform?: Platform | '' | undefined;
  tagIds?: number[];  // 標籤篩選
  search?: string; // 搜尋關鍵字 (客戶名稱、訊息內容)
  customerName?: string; // 客戶名稱搜尋 (backend)
  lastMessageSearch?: string;  // 最後訊息內容篩選 (frontend)
  updatedAfter?: string; // 更新時間起始 ISO string (backend)
  updatedBefore?: string; // 更新時間結束 ISO string (backend)
}

// Extended interface for API calls that allows undefined
export interface ConversationApiFilters extends Omit<ConversationFilters, 'assignedTo'> {
  assignedTo?: string | undefined;
}

// QR碼相關型別

// QR Code 類型枚舉
export type QRCodeType = 'legacy' | 'liff';

// 傳統 QR Code (直接添加好友)
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
  type?: QRCodeType; // 類型標記（用於區分）
}

// LIFF QR Code (LIFF 頁面引導)
export interface LiffQRCode {
  id: string;
  liffUrl: string;
  qrCodeUrl: string;
  scanCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  type: 'liff'; // 固定為 liff
}

// LIFF QR Code 統計
export interface LiffQRCodeStats {
  scanCount: number;
  assignmentCount: number;
  createdAt: string;
  lastScannedAt: string;
  isActive: boolean;
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

// 團隊類型定義
export interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

// 客服所屬團隊資訊 (多團隊支援)
export interface AgentTeamMembership {
  teamId: number;
  teamName?: string;
  roleInTeam: 'member' | 'lead' | 'supervisor';
  isPrimary: boolean;
  joinedAt?: string;
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
  avatar?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt?: Date | string;
  // Multi-team support (added in migration 0028)
  teams?: AgentTeamMembership[];
  teamCount?: number;
  primaryTeamId?: number;
  primaryTeamName?: string;
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