// Conversations Module Types
// 對話模組類型定義

// Database schema types
import type { conversations, messages, customers, conversationTransfers } from '@/db/schema';

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type ConversationTransfer = typeof conversationTransfers.$inferSelect;
export type NewConversationTransfer = typeof conversationTransfers.$inferInsert;

// Lightweight message summary for optimized queries (N+1 fix)
// Used when fetching conversation lists/details without full message data
export interface LatestMessageSummary {
  id: string;
  conversationId: string;
  content: string;
  senderType: string;
  messageType: string;
  createdAt: string | null;
}

// API Request/Response types
export interface ConversationListRequest {
  page?: number;
  limit?: number;
  status?: 'active' | 'assigned' | 'pending' | 'in-progress' | 'waiting';
  teamId?: number;
  agentId?: string;
  customerId?: string;
}

export interface ConversationListResponse {
  conversations: ConversationWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ConversationWithDetails extends Conversation {
  customer?: Customer | undefined;
  // latestMessage can be full Message or lightweight summary (N+1 optimization)
  latestMessage?: Message | LatestMessageSummary | undefined;
  messageCount?: number | undefined;
  assignedAgent?: {
    id: string;
    displayName: string;
    email: string;
  } | undefined;
}

export interface ConversationAssignRequest {
  teamId?: number;
  // Note: userId removed - only team assignment is supported now
  reason?: string;
}

export interface ConversationAssignResponse {
  success: boolean;
  conversationId: string;
  assignedTo: {
    type: 'team' | 'user';
    id: string | number;
    name: string;
  };
  transfer?: ConversationTransfer;
}

export interface MessageSendRequest {
  conversationId: string;
  content: string;
  senderId: string;
  senderName?: string; // 發送者名稱快照（持久化保存）
  messageType?: 'text' | 'image' | 'file' | 'quick_reply';
  metadata?: Record<string, any>;
  replyToId?: string;
  attachmentIds?: string[];  // 🔧 FIX: Add attachmentIds for file attachments
}

export interface MessageSendResponse {
  success: boolean;
  messageId?: string;
  message?: Message;  // ✅ Complete message object from database
  conversationId?: string;
  content?: string;
  timestamp?: string;
  error?: string;
}

export interface ConversationStatusUpdateRequest {
  status: 'active' | 'assigned' | 'pending' | 'in-progress' | 'waiting';
  reason?: string;
  notes?: string;
}

export interface ConversationSearchRequest {
  query: string;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string[];
    platforms?: string[];
    teamIds?: number[];
    agentIds?: string[];
  };
  sort?: {
    field: 'created_at' | 'updated_at' | 'message_count';
    order: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
}

export interface ConversationMetrics {
  totalConversations: number;
  openConversations: number;
  closedConversations: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  teamDistribution: Array<{
    teamId: number;
    teamName: string;
    count: number;
  }>;
}

// Service interfaces
export interface ConversationServiceInterface {
  // CRUD operations
  createConversation(data: NewConversation): Promise<Conversation>;
  getConversation(id: string): Promise<ConversationWithDetails | null>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;

  // List and search
  listConversations(params: ConversationListRequest): Promise<ConversationListResponse>;
  searchConversations(params: ConversationSearchRequest): Promise<ConversationListResponse>;

  // Assignment operations
  assignConversation(id: string, params: ConversationAssignRequest): Promise<ConversationAssignResponse>;
  // Note: Individual transfer (fromAgentId, toAgentId) removed - only team-based transfer is supported now
  transferConversation(id: string, fromTeamId: number | null, toTeamId: number, reason?: string): Promise<ConversationTransfer>;

  // Message operations
  addMessage(conversationId: string, message: NewMessage): Promise<Message>;
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<Message[]>;

  // Status operations
  updateStatus(id: string, status: string, reason?: string): Promise<Conversation>;

  // Analytics
  getConversationMetrics(filters?: any): Promise<ConversationMetrics>;
}

// Event types for real-time updates
export interface ConversationEvent {
  type: 'conversation.created' | 'conversation.updated' | 'conversation.assigned' |
        'message.sent' | 'message.received';
  conversationId: string;
  data: any;
  timestamp: string;
  userId?: string;
}

// Re-export shared types
export type { Bindings } from '@/types';
export type { ApiResponse, PaginatedResponse } from '@/types';