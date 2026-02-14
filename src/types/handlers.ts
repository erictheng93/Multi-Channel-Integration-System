// Handler-specific type definitions
// Provides strict typing for request/response payloads and handler contexts

import type { Context } from 'hono';
import type { Bindings } from './index';

// Base handler context type
export type HandlerContext = Context<{ Bindings: Bindings }>;

// Authentication payload types
export interface AuthPayload {
  userId: number;
  displayName: string;
  email?: string;
  role: 'admin' | 'agent';
  primaryTeamId?: number;  // From agent_teams WHERE isPrimary=true
  iat: number;
  exp: number;
}

// Customer handler types
export interface CustomerStats {
  total: number;
  active: number;
  withTags: number;
  withEmail: number;
  withPhone: number;
  recentActive: number;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
}

export interface CustomerData {
  id: number;
  platform: string;
  platformUserId: string;
  displayName: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  sourceTeamId?: number;
  teamName?: string;
  tags: CustomerTag[];
  conversationStats: {
    total: number;
    active: number;
    closed: number;
    lastConversationAt?: string;
    firstConversationAt?: string;
  };
  recentMessages: Array<{
    id: string;
    conversationId: number;
    senderType: string;
    content: string;
    messageType: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

// Message handler types
export interface SendMessageRequest {
  conversationId: number;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
  mediaUrl?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    mimeType: string;
  }>;
}

export interface MessageSearchParams {
  q?: string;
  conversationId?: number;
  senderType?: 'customer' | 'agent' | 'system';
  messageType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface MessageSearchResult {
  id: string;
  conversationId: number;
  senderType: string;
  senderId?: number;
  content: string;
  messageType: string;
  createdAt: string;
  relevanceScore?: number;
  customerName?: string;
  agentName?: string;
}

export interface ExtendedPaginationMeta {
  page: number;
  limit: number;
  total: number;
  searchQuery?: string;
  searchCriteria?: {
    conversationId?: number;
    senderType?: string;
    messageType?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

// Notification handler types
export interface NotificationSettings {
  userId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  types: {
    newMessage: boolean;
    assignedConversation: boolean;
    systemAlert: boolean;
    weeklyReport: boolean;
  };
}

export interface NotificationData {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// System handler types
export interface SystemStatus {
  database: boolean;
  cache: boolean;
  lineIntegration: boolean;
  facebookIntegration: boolean;
}

export interface IntegrationStatus {
  line: {
    connected: boolean;
    botName?: string;
    botId?: string;
    webhookStatus?: string;
    tokenExpires?: string;
    lastError?: string;
  };
  facebook: {
    connected: boolean;
    pageId?: string;
    pageName?: string;
    webhookStatus?: string;
    lastError?: string;
  };
}

// File upload types
export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  filename?: string;
  url?: string;
  size?: number;
  mimeType?: string;
  error?: string;
}

// Webhook types
export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  platform?: 'line' | 'facebook';
}

// Error types
export interface HandlerError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}

// Type guards for handler payloads
export function isAuthPayload(obj: any): obj is AuthPayload {
  return obj && 
    typeof obj.userId === 'number' && 
    typeof obj.displayName === 'string' && 
    typeof obj.role === 'string';
}

export function isSendMessageRequest(obj: any): obj is SendMessageRequest {
  return obj && 
    typeof obj.conversationId === 'number' && 
    typeof obj.content === 'string';
}

export function isMessageSearchParams(obj: any): obj is MessageSearchParams {
  return obj && typeof obj === 'object';
}