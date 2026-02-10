// shared/types.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/types/shared.ts
// Created by: Vue TypeScript Developer

// 平台類型
export type Platform = 'line' | 'facebook';

// 使用者
export interface User {
  id: string;
  platform: Platform;
  platformUserId: string;
  name: string;
  avatarUrl?: string;
  createdAt: number;
}

// 對話
// Note: Individual assignment fields (assignedTo, assignedAgent) removed
// Only team-based assignment is now supported
export interface Conversation {
  id: string;
  userId: string;
  user?: User; // 關聯的使用者資料
  assignedTeamId?: number; // 團隊指派
  status: 'active' | 'pending' | 'in-progress' | 'assigned' | 'waiting';
  lastMessageAt: number;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

// 檔案附件類型
export interface FileAttachment {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string | null;
  r2Key?: string;
}

// 訊息
export interface Message {
  id: string;
  conversationId: string;
  senderType: 'user' | 'agent';
  senderId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'text' | 'image' | 'video' | 'file';
  platform: Platform;
  createdAt: number;
  // 🆕 檔案附件（用於 Flex Card 顯示）
  file_attachments?: FileAttachment[];
}

// 客服人員
export interface Agent {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  isActive: boolean;
  createdAt: number;
}

// API 回應格式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 分頁資料
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 登入相關
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  agent: Agent;
}

// Webhook 資料
export interface WebhookData {
  platform: Platform;
  userId: string;
  userName: string;
  message: string;
  mediaUrl?: string;
  timestamp: number;
}