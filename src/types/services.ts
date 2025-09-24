// Service layer type definitions
// Provides typing for service classes and their methods

// User sync service types
export interface UserSyncData {
  id: number;
  platform: string;
  platform_user_id: string;
  display_name: string;
  avatar_url?: string;
  profile_data?: string;  // JSON string of profile data
  profile_updated_at: string;
}

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface FacebookUserProfile {
  id: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
}

// Permission service types
export interface PermissionRule {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
}

export interface PermissionContext {
  userId: number;
  role: string;
  teamId?: number;
  resourceId?: string | number;
  metadata?: Record<string, unknown>;
}

export interface UserPermissionData {
  id: number;
  role: string;
  teamId?: number;
  permissions?: string[];
  isActive: boolean;
}

// QR Code service types
export interface QRCodeMetadata {
  teamId: number;
  createdBy: number;
  expiresAt?: string;
  usageLimit?: number;
  currentUsage?: number;
  description?: string;
}

export interface QRFollowEvent {
  type: 'follow';
  source: {
    userId: string;
    type: 'user';
  };
  replyToken?: string;
  timestamp: number;
}

export interface CustomerCreationData {
  platform: string;
  platformUserId: string;
  displayName?: string;
  avatarUrl?: string;
  sourceTeamId?: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationCreationData {
  customerId: number;
  assignedTeamId?: number;
  assignedUserId?: number;
  status: 'active' | 'pending';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, unknown>;
}

// Message recall service types
export interface PendingMessage {
  id: string;
  conversation_id: number;
  content: string;
  message_type: string;
  platform: string;
  recipient_id: string;
  recipient_platform_id: string;  // Platform-specific recipient ID
  sender_id?: number;
  metadata?: Record<string, unknown>;
  scheduled_at?: string;
  retry_count: number;
  max_retries: number;
}

export interface MessageDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryAfter?: number;
}

// Conversation service types
export interface AgentStatus {
  id: number;
  name: string;
  isOnline: boolean;
  activeConversations: number;
  maxConversations: number;
  teamId?: number;
  lastActivity?: string;
}

export interface ConversationAssignmentResult {
  assignedAgentId?: number;
  assignedTeamId?: number;
  reason: string;
  success: boolean;
}

export interface ConversationMetrics {
  totalActive: number;
  averageResponseTime: number;
  totalAgents: number;
  availableAgents: number;
  teamLoad: Record<string, number>;
}

// Common service interfaces
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedServiceResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Service base class interface
export interface BaseService {
  readonly name: string;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

// Export utility types for service configuration
export type ServiceConfig = Record<string, unknown>;
export type ServiceDependencies = Record<string, BaseService>;