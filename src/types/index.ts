// Import Cloudflare Workers types
/// <reference types="@cloudflare/workers-types" />

// 匯出所有型別定義
export * from './shared';
export * from './converters';
export * from './database';
export * from './external-apis';
export * from './handlers';
export * from './api-standard';
export * from './events';

// Export WebSocket and Durable Objects types
export * from './websocket-types';

// Re-export Bindings to maintain consistency
export type { Bindings } from './bindings';

// Legacy interface kept for backward compatibility (deprecated)
export interface LegacyBindings {
  // Required integrations
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  LINE_BOT_BASIC_ID: string;
  FB_APP_SECRET: string;
  FB_PAGE_ACCESS_TOKEN: string;
  FB_VERIFY_TOKEN: string;
  JWT_SECRET: string;

  // Core Cloudflare services
  DB: D1Database;
  SESSIONS: KVNamespace;
  KV: KVNamespace;

  // Optional services
  ENCRYPTION_KEY?: string;
  ADMIN_PASSWORD?: string;
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  CACHE?: KVNamespace;
  FILES?: R2Bucket;
  AVATARS?: R2Bucket;
  NOTIFICATION_QUEUE?: Queue;
  DELAYED_QUEUE?: Queue;

  // R2 storage (optional)
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_URL?: string;
  R2_CUSTOM_DOMAIN?: string;
  R2_BUCKET_NAME?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;

  // Durable Objects
  CONVERSATION_ROOM?: DurableObjectNamespace;
  USER_CONNECTION?: DurableObjectNamespace;
  MESSAGE_BROADCASTER?: DurableObjectNamespace;
  DELAYED_MESSAGE_SCHEDULER?: DurableObjectNamespace;
  DISTRIBUTED_LOCK?: DurableObjectNamespace;
  LATEST_MESSAGE_COORDINATOR?: DurableObjectNamespace; // Phase 1.4b: Batch cache updates via alarm
}

// LINE Webhook 相關類型定義
export interface LineSource {
  type: 'user' | 'group' | 'room';
  userId: string;
  groupId?: string;
  roomId?: string;
}

export interface LineMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  text?: string;
  duration?: number;  // For audio messages
  fileName?: string;  // For file messages
  fileSize?: number;  // For file messages
  title?: string;     // For location messages
  address?: string;   // For location messages
  latitude?: number;  // For location messages
  longitude?: number; // For location messages
  packageId?: string; // For sticker messages
  stickerId?: string; // For sticker messages
  contentProvider?: {
    type: string;
  };
}

export interface LinePostbackParams {
  date?: string;
  time?: string;
  datetime?: string;
  [key: string]: string | undefined;
}

export interface LineEvent {
  type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'memberJoined' | 'memberLeft' | 'postback' | 'beacon';
  timestamp: number;
  source: LineSource;
  replyToken?: string;
  message?: LineMessage;
  postback?: {
    data: string;
    params?: LinePostbackParams;
  };
  // 🆕 Follow event with QR code referral tracking
  follow?: {
    isUnblocked?: boolean;  // true if user unblocked the account
  };
  // 🆕 Link token for account linking (used for QR code tracking via liff.getContext())
  link?: {
    result: 'ok' | 'failed';
    nonce?: string;
  };
}

export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// Database entity types
export interface Customer {
  id: number;
  platform: string;
  platformUserId: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  sourceTeamId?: number;
  metadata?: string;  // JSON string
  createdAt: string;
  updatedAt: string;
}

export interface DbConversation {
  id: string; // Fixed: TEXT type from migration 0005
  customerId: number;
  assignedTeamId?: number;
  // Note: assignedUserId removed - only team assignment is supported now
  status: 'active' | 'pending' | 'in-progress' | 'assigned' | 'waiting';
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbMessage {
  id: string;
  conversationId: string; // Fixed: TEXT type from migration 0005
  senderType: 'customer' | 'agent' | 'system';
  customerSenderId?: number; // For customer messages (INTEGER)
  agentSenderId?: string; // For agent messages (TEXT)
  content: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  platformMessageId?: string;
  isRecalled: boolean;
  recallDeadline?: string;
  recalledAt?: string;
  isSent: boolean;
  sentAt?: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed';
  replyToMessageId?: string;
  threadId?: string;
  sessionId?: string;
  sessionSequence?: number;
  metadata?: string;
  createdAt: string;
}

// Conversation session type
export interface ConversationSession {
  id: string;
  conversation_id: string; // Fixed: Changed from number to string to match conversations.id (TEXT)
  session_type: 'continuous' | 'topic_based' | 'time_based';
  topic?: string;
  start_time: string;
  end_time?: string;
  last_activity: string;
  message_count: number;
  is_active: boolean;
  created_at: string;
}

// Media data types for LINE and Facebook
export interface LineMediaData {
  originalContentUrl?: string;
  previewImageUrl?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  packageId?: string;
  stickerId?: string;
}

export interface FacebookMediaData {
  url?: string;
  type: string;
  title?: string;
  coordinates?: {
    lat: number;
    long: number;
  };
}

export type PlatformMediaData = LineMediaData | FacebookMediaData;

// Team role within a specific team (for multi-team RBAC)
export type TeamRoleInTeam = 'member' | 'lead' | 'supervisor';

// Database user type
export interface DbUser {
  id: number | string;
  email: string;
  displayName: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier (admin/team/agent) to 2-tier (admin/agent)
  primaryTeamId?: number | null | undefined;  // From agent_teams WHERE isPrimary=true
  teamName?: string | null | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Multi-team support (Phase 1 optimization)
  allowedTeamIds?: number[];                    // All accessible team IDs (cached from agent_teams)
  teamRoles?: Record<number, TeamRoleInTeam>;   // teamId -> roleInTeam mapping
}

// Team type
export interface Team {
  id: number;
  name: string;
  description?: string | null | undefined;
  qrCode?: string | null | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Customer tag type
export interface CustomerTag {
  id: number;
  name: string;
  color: string;
  description?: string | null | undefined;
  teamId?: number | null | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Customer tag relation type
export interface CustomerTagRelation {
  customerId: number;
  tagId: number;
  assignedBy: number;
  assignedAt: string;
}

export interface JWTPayload {
  userId: number | string;
  username?: string;
  displayName: string;
  email?: string;
  role: 'admin' | 'agent'; // Simplified from 3-tier (admin/team/agent) to 2-tier (admin/agent)
  primaryTeamId?: number | undefined;  // From agent_teams WHERE isPrimary=true
  teamName?: string | undefined;
  iat: number;
  exp: number;
  iss?: string;
  type?: 'access' | 'refresh' | 'temp_password_change';
  isSystemToken?: boolean;
  // Multi-team support (Phase 1 optimization)
  allowedTeamIds?: number[];                    // All accessible team IDs
  teamRoles?: Record<number, TeamRoleInTeam>;   // teamId -> roleInTeam mapping
}

// Facebook Webhook types
export interface FacebookSender {
  id: string;
}

export interface FacebookRecipient {
  id: string;
}

export type FacebookAttachmentType = 'image' | 'video' | 'audio' | 'file' | 'location' | 'template';

export interface FacebookAttachmentPayload {
  url?: string;
  title?: string;
  coordinates?: {
    lat: number;
    long: number;
  };
  [key: string]: unknown;
}

export interface FacebookMessageAttachment {
  type: FacebookAttachmentType;
  payload: FacebookAttachmentPayload;
}

export interface FacebookMessage {
  mid?: string;
  text?: string;
  attachments?: FacebookMessageAttachment[];
  quick_reply?: {
    payload: string;
  };
}

export interface FacebookMessaging {
  sender: FacebookSender;
  recipient: FacebookRecipient;
  timestamp: number;
  message?: FacebookMessage;
  postback?: {
    payload: string;
    title?: string;
  };
  delivery?: {
    mids: string[];
    watermark: number;
  };
  read?: {
    watermark: number;
  };
}

export interface FacebookWebhookEntry {
  id: string;
  time: number;
  messaging?: FacebookMessaging[];
}

export interface FacebookWebhookBody {
  object: string;
  entry: FacebookWebhookEntry[];
}

// Extended API response type
export interface ExtendedApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// LINE API 回應類型定義
// LINE Flex Message and Template types
export interface LineFlexBubble {
  type: 'bubble';
  header?: LineFlexComponent;
  hero?: LineFlexComponent;
  body?: LineFlexComponent;
  footer?: LineFlexComponent;
  styles?: {
    header?: LineFlexComponentStyle;
    hero?: LineFlexComponentStyle;
    body?: LineFlexComponentStyle;
    footer?: LineFlexComponentStyle;
  };
}

export interface LineFlexComponent {
  type: 'box' | 'button' | 'text' | 'spacer' | 'image' | 'icon' | 'separator';
  layout?: 'vertical' | 'horizontal' | 'baseline';
  contents?: LineFlexComponent[];
  text?: string;
  size?: string;
  color?: string;
  weight?: string;
  align?: string;
  gravity?: string;
  margin?: string;
  padding?: string;
  spacing?: string;
  flex?: number;
  action?: LineAction;
  // Box-specific properties
  paddingAll?: string;
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end';
  // Text-specific properties
  wrap?: boolean;
  // Button-specific properties
  style?: 'primary' | 'secondary' | 'link';
  height?: 'sm' | 'md';
  // Image-specific properties
  url?: string;
  aspectRatio?: string;
  aspectMode?: 'cover' | 'contain' | 'fit';
}

export interface LineFlexComponentStyle {
  backgroundColor?: string;
  separator?: boolean;
  separatorColor?: string;
}

export type LineActionType = 'postback' | 'message' | 'uri' | 'datetimepicker';
export type DatetimeMode = 'date' | 'time' | 'datetime';

export interface LineAction {
  type: LineActionType;
  label?: string;
  data?: string;
  text?: string;
  uri?: string;
  mode?: DatetimeMode;
  initial?: string;
  max?: string;
  min?: string;
}

export interface LineTemplateColumn {
  thumbnailImageUrl?: string;
  imageBackgroundColor?: string;
  title?: string;
  text?: string;
  defaultAction?: LineAction;
  actions?: LineAction[];
}

export interface LineTemplate {
  type: 'buttons' | 'confirm' | 'carousel' | 'image_carousel';
  thumbnailImageUrl?: string;
  imageAspectRatio?: '1.51:1' | '1:1';
  imageSize?: 'cover' | 'contain';
  imageBackgroundColor?: string;
  title?: string;
  text?: string;
  defaultAction?: LineAction;
  actions?: LineAction[];
  columns?: LineTemplateColumn[];
}

export interface LineReplyMessage {
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker' | 'template' | 'flex';
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
  duration?: number;
  packageId?: string;
  stickerId?: string;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  template?: LineTemplate;
  altText?: string;
  contents?: LineFlexBubble;
  fileName?: string;
}

export interface LineReplyRequest {
  replyToken: string;
  messages: LineReplyMessage[];
  notificationDisabled?: boolean;
}