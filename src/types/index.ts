// 匯出所有型別定義
export * from './shared';
export * from './converters';
export * from './database';
export * from './external-apis';
export * from './handlers';
export * from './api-standard';

// Cloudflare Workers 環境變數類型定義
export interface Bindings {
  // LINE 相關
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  LINE_BOT_BASIC_ID: string;
  
  // Facebook 相關
  FB_APP_SECRET: string;
  FB_PAGE_ACCESS_TOKEN: string;
  FB_VERIFY_TOKEN: string;
  
  // 認證相關
  JWT_SECRET: string;
  ENCRYPTION_KEY?: string;
  ADMIN_PASSWORD?: string;
  
  // 環境設定
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  
  // R2 存儲相關
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_URL?: string;
  R2_CUSTOM_DOMAIN?: string;
  R2_BUCKET_NAME?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  
  // Cloudflare 服務
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE?: KVNamespace;
  FILES?: R2Bucket;
  AVATARS?: R2Bucket;
  MESSAGE_QUEUE: Queue;
  NOTIFICATION_QUEUE?: Queue;
  DELAYED_QUEUE?: Queue;
  KV: KVNamespace;
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
}

export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// 資料庫相關類型定義（向後相容）
export interface Customer {
  id: number;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  email?: string;
  source_team_id?: number;
  metadata?: string;  // JSON string
  created_at: string;
  updated_at: string;
}

export interface DbConversation {
  id: number;
  customer_id: number;
  assigned_team_id?: number;
  assigned_user_id?: number;
  status: 'active' | 'closed' | 'pending';
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: number;
  sender_type: 'customer' | 'agent' | 'system';
  sender_id?: number;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  platform_message_id?: string;
  is_recalled: boolean;
  recall_deadline?: string;
  recalled_at?: string;
  is_sent: boolean;
  sent_at?: string;
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed';
  reply_to_message_id?: string; // 回覆的目標訊息ID
  thread_id?: string; // 訊息線程ID，用於關聯一組相關訊息
  session_id?: string; // 對話會話ID，用於識別同一個對話session
  session_sequence?: number; // 在會話中的順序號
  metadata?: string; // JSON格式的額外資訊
  created_at: string;
}

// 對話會話類型定義
export interface ConversationSession {
  id: string;
  conversation_id: number;
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

// 資料庫用戶相關類型定義（向後相容）
export interface DbUser {
  id: number | string; // 支持字符串 ID (agents)
  email: string;
  displayName: string;
  role: 'admin' | 'team' | 'agent';
  teamId?: number | null;
  teamName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 團隊相關類型定義
export interface Team {
  id: number;
  name: string;
  description?: string | null;
  qrCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 客戶標籤類型定義
export interface CustomerTag {
  id: number;
  name: string;
  color: string;
  description?: string | null;
  teamId?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 客戶標籤關聯類型定義
export interface CustomerTagRelation {
  customerId: number;
  tagId: number;
  assignedBy: number;
  assignedAt: string;
}

export interface JWTPayload {
  userId: number | string;  // Support both number (users table) and string (agents table)
  displayName: string;  // Using displayName instead of username
  email?: string;  // Optional email field
  role: string;
  teamId?: number | undefined;  // Allow undefined explicitly
  iat: number;
  exp: number;
  iss?: string;
  type?: 'access' | 'refresh' | 'temp_password_change';  // Token type for better validation
}

// Facebook Webhook types
export interface FacebookSender {
  id: string;
}

export interface FacebookRecipient {
  id: string;
}

export interface FacebookMessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'location' | 'template';
  payload: {
    url?: string;
    title?: string;
    coordinates?: {
      lat: number;
      long: number;
    };
    [key: string]: unknown;
  };
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

// 擴展的 API 回應類型定義
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
}

export interface LineFlexComponentStyle {
  backgroundColor?: string;
  separator?: boolean;
  separatorColor?: string;
}

export interface LineAction {
  type: 'postback' | 'message' | 'uri' | 'datetimepicker';
  label?: string;
  data?: string;
  text?: string;
  uri?: string;
  mode?: 'date' | 'time' | 'datetime';
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