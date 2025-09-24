// Simplified Core Types - Unified naming with single source of truth
export type Platform = 'line' | 'facebook';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
export type ConversationStatus = 'active' | 'closed' | 'pending';
export type UserRole = 'admin' | 'team' | 'agent';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

// =================== Core Entities ===================

export interface Customer {
  readonly id: number;
  readonly platform: Platform;
  readonly platformUserId: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly metadata?: CustomerMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerMetadata {
  readonly sourceTeamId?: number;
  readonly tags?: string[];
  readonly notes?: string;
  readonly customFields?: Record<string, unknown>;
}

export interface Conversation {
  readonly id: string;
  readonly customerId: number;
  readonly assignedTeamId?: number;
  readonly assignedUserId?: string;
  readonly status: ConversationStatus;
  readonly lastMessageAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  // Computed fields (from joins)
  readonly customer?: Customer;
  readonly lastMessage?: Message;
  readonly unreadCount?: number;
}

export interface Message {
  readonly id: string;
  readonly conversationId: string;
  readonly senderType: 'customer' | 'agent' | 'system';
  readonly senderId: string;
  readonly content: string;
  readonly messageType: MessageType;
  readonly platformMessageId?: string;
  readonly isRecalled: boolean;
  readonly deliveryStatus: DeliveryStatus;
  readonly metadata?: MessageMetadata;
  readonly createdAt: string;
  readonly sentAt?: string;
  readonly recalledAt?: string;
}

export interface MessageMetadata {
  readonly attachmentIds?: string[];
  readonly replyToMessageId?: string;
  readonly threadId?: string;
  readonly mediaData?: PlatformMediaData;
}

export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly teamId?: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// =================== Database Layer Types ===================

// Use mapped types for database layer to ensure consistency
export type DatabaseEntity<T> = {
  [K in keyof T]: T[K] extends string | undefined
    ? string | null
    : T[K] extends number | undefined
    ? number | null
    : T[K];
};

export type CustomerDb = DatabaseEntity<Customer>;
export type ConversationDb = DatabaseEntity<Conversation>;
export type MessageDb = DatabaseEntity<Message>;
export type UserDb = DatabaseEntity<User>;

// =================== API Layer Types ===================

export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
  readonly timestamp: string;
}

export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

// =================== Media Types ===================

export interface LineMediaData {
  readonly originalContentUrl?: string;
  readonly previewImageUrl?: string;
  readonly duration?: number;
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly coordinates?: { lat: number; long: number };
  readonly packageId?: string;
  readonly stickerId?: string;
}

export interface FacebookMediaData {
  readonly url?: string;
  readonly type: string;
  readonly title?: string;
  readonly coordinates?: { lat: number; long: number };
}

export type PlatformMediaData = LineMediaData | FacebookMediaData;

// =================== Type Guards ===================

export const isLineMedia = (media: PlatformMediaData): media is LineMediaData => {
  return 'originalContentUrl' in media || 'packageId' in media;
};

export const isFacebookMedia = (media: PlatformMediaData): media is FacebookMediaData => {
  return 'type' in media && !('originalContentUrl' in media);
};

// =================== Transform Utilities ===================

export class EntityTransformers {
  static customerFromDb(db: CustomerDb): Customer {
    return {
      id: db.id!,
      platform: db.platform as Platform,
      platformUserId: db.platformUserId!,
      displayName: db.displayName || '',
      ...(db.avatarUrl && { avatarUrl: db.avatarUrl }),
      ...(db.phone && { phone: db.phone }),
      ...(db.email && { email: db.email }),
      metadata: db.metadata ? JSON.parse(db.metadata as string) : {},
      createdAt: db.createdAt!,
      updatedAt: db.updatedAt!
    };
  }

  static conversationFromDb(db: ConversationDb): Conversation {
    return {
      id: db.id!,
      customerId: db.customerId!,
      assignedTeamId: db.assignedTeamId || 0,
      ...(db.assignedUserId && { assignedUserId: db.assignedUserId }),
      status: db.status as ConversationStatus,
      ...(db.lastMessageAt && { lastMessageAt: db.lastMessageAt }),
      createdAt: db.createdAt!,
      updatedAt: db.updatedAt!
    };
  }

  static messageFromDb(db: MessageDb): Message {
    return {
      id: db.id!,
      conversationId: db.conversationId!,
      senderType: db.senderType as 'customer' | 'agent' | 'system',
      senderId: db.senderId || '',
      content: db.content!,
      messageType: db.messageType as MessageType,
      platformMessageId: db.platformMessageId || '',
      isRecalled: Boolean(db.isRecalled),
      deliveryStatus: db.deliveryStatus as DeliveryStatus,
      metadata: db.metadata ? JSON.parse(db.metadata as string) : {},
      createdAt: db.createdAt!,
      ...(db.sentAt && { sentAt: db.sentAt }),
      ...(db.recalledAt && { recalledAt: db.recalledAt })
    };
  }
}