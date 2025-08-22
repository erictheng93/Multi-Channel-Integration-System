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
export interface Conversation {
  id: string;
  userId: string;
  user?: User; // 關聯的使用者資料
  assignedTo?: string;
  assignedAgent?: Agent; // 關聯的客服資料
  status: 'open' | 'assigned' | 'closed';
  lastMessageAt: number;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
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
}

// 客服人員
export interface Agent {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'team' | 'agent';
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