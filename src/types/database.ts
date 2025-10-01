// Database-specific type definitions
// Provides strict typing for database operations and results

// Database query result types
export interface DatabaseQueryResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface DatabaseSingleResult<T = Record<string, unknown>> {
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
  results: T[];
}

// D1 specific result types
export interface D1ResultInfo {
  changes: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1ResultInfo;
  changes?: number; // For INSERT/UPDATE/DELETE operations
}

// Customer database record types
export interface CustomerDbRecord {
  id: number;
  platform: string;
  platform_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  source_team_id: number | null;
  created_at: string;
  updated_at: string;
  metadata: string | null;
  // Joined fields from tags
  tag_names?: string | null;
  tag_ids?: string | null;
  tag_colors?: string | null;
  team_name?: string | null;
}

// Conversation database record types
export interface ConversationDbRecord {
  id: number;
  customer_id: number;
  assigned_team_id: number | null;
  assigned_user_id: number | null;
  status: 'active' | 'closed' | 'pending';
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  platform: string;
  platform_user_id: string;
  customer_name: string | null;
  customer_avatar: string | null;
  agent_name: string | null;
  unread_count?: number;
}

// Message database record types
export interface MessageDbRecord {
  id: string;
  conversation_id: string; // Fixed: Changed from number to string to match conversations.id (TEXT)
  sender_type: 'customer' | 'agent' | 'system';
  sender_id: number | null;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  platform_message_id: string | null;
  is_recalled: boolean;
  recall_deadline: string | null;
  recalled_at: string | null;
  is_sent: boolean;
  sent_at: string | null;
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed';
  reply_to_message_id: string | null;
  thread_id: string | null;
  session_id: string | null;
  session_sequence: number | null;
  metadata: string | null;
  created_at: string;
}

// User database record types
export interface UserDbRecord {
  id: number;
  email: string;
  displayName: string;
  role: 'admin' | 'agent';
  teamId: number | null;
  teamName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Notification database record types
export interface NotificationDbRecord {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data: string | null;
  is_read: boolean;
  read_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// Statistics result types
export interface CustomerStatsResult {
  total: number;
  count?: number;
}

export interface ConversationStatsResult {
  total: number;
  active: number;
  closed: number;
  last_conversation_at: string | null;
  first_conversation_at: string | null;
}

// Search and pagination types
export interface SearchParams {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Query parameter types
export type QueryParam = string | number | boolean | null | undefined;
export type QueryParams = QueryParam[];

// Metadata types
export interface CustomerMetadata {
  lineUserId?: string;
  facebookUserId?: string;
  lastActiveAt?: string;
  tags?: string[];
  notes?: string;
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
  };
}

export interface ConversationMetadata {
  transferHistory?: Array<{
    from: string;
    to: string;
    timestamp: string;
    reason?: string;
  }>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  customFields?: Record<string, string | number | boolean>;
}

export interface MessageMetadata {
  attachments?: Array<{
    type: string;
    url: string;
    size?: number;
    filename?: string;
  }>;
  quickReply?: {
    items: Array<{
      action: { type: string; label: string; text?: string; data?: string; };
    }>;
  };
  mentions?: string[];
  isForwarded?: boolean;
}

// Context types for various operations
export interface AuthContext {
  userId: number;
  displayName: string;
  role: string;
  teamId?: number;
  permissions?: string[];
}

export interface OperationContext {
  action: string;
  resource: string;
  userId?: number;
  teamId?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

// Audit and logging types
export interface AuditLogContext {
  userId: number;
  action: string;
  resource: string;
  resourceId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Type guards for database results
export function isD1Result<T = Record<string, unknown>>(result: unknown): result is D1Result<T> {
  return Boolean(result && typeof result === 'object' && 'results' in result && 'success' in result);
}

export function hasChanges(result: unknown): result is D1Result & { changes: number } {
  return isD1Result(result) && typeof result.changes === 'number';
}

// Type guard for query results
export function isQueryResult<T = Record<string, unknown>>(result: unknown): result is T {
  return result !== null && result !== undefined;
}

// Generic database row type
export type DatabaseRow = Record<string, any>;

// Safe type conversion helpers
export function asString(value: any): string {
  return String(value || '');
}

export function asNumber(value: any): number {
  return Number(value || 0);
}

export function asBoolean(value: any): boolean {
  return Boolean(value);
}