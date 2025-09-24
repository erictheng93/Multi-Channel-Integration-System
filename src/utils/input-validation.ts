// Input Validation and Sanitization Utilities
// Provides comprehensive validation for API endpoints and WebSocket messages

import { z } from 'zod';

// Maximum length constraints
export const LIMITS = {
  MESSAGE_CONTENT: 4096,
  USERNAME: 100,
  DISPLAY_NAME: 200,
  EMAIL: 255,
  PHONE: 20,
  CONVERSATION_ID: 50,
  USER_ID: 50,
  FILE_NAME: 255,
  URL: 2048
} as const;

// Common validation schemas
export const commonSchemas = {
  // User identification
  userId: z.string().min(1).max(LIMITS.USER_ID).regex(/^[a-zA-Z0-9_-]+$/),
  username: z.string().min(3).max(LIMITS.USERNAME).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(LIMITS.DISPLAY_NAME).trim(),

  // Communication
  email: z.string().email().max(LIMITS.EMAIL),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).max(LIMITS.PHONE),

  // Content
  messageContent: z.string().min(1).max(LIMITS.MESSAGE_CONTENT).trim(),
  conversationId: z.string().min(1).max(LIMITS.CONVERSATION_ID),

  // System
  role: z.enum(['admin', 'team', 'agent']),
  status: z.enum(['active', 'inactive', 'suspended']),
  platform: z.enum(['line', 'facebook', 'telegram', 'whatsapp']),

  // Security
  jwtToken: z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  challengeId: z.string().uuid(),

  // Files
  fileName: z.string().min(1).max(LIMITS.FILE_NAME),
  fileSize: z.number().positive().max(10 * 1024 * 1024), // 10MB max
  mimeType: z.string().regex(/^[a-z]+\/[a-z0-9][a-z0-9\-\+]*$/i),

  // Timestamps
  timestamp: z.number().positive(),
  dateString: z.string().datetime(),

  // URLs
  url: z.string().url().max(LIMITS.URL),
  websocketUrl: z.string().regex(/^wss?:\/\/.+$/).max(LIMITS.URL)
};

// WebSocket message validation schemas
export const websocketMessageSchemas = {
  // Base message structure
  base: z.object({
    type: z.string().min(1).max(50),
    timestamp: commonSchemas.timestamp,
    messageId: z.string().uuid().optional(),
    conversationId: commonSchemas.conversationId.optional(),
    userId: commonSchemas.userId.optional()
  }),

  // Chat message
  chatMessage: z.object({
    type: z.literal('message'),
    content: commonSchemas.messageContent,
    conversationId: commonSchemas.conversationId,
    userId: commonSchemas.userId,
    messageType: z.enum(['text', 'image', 'file', 'audio', 'video']).default('text'),
    metadata: z.record(z.string(), z.any()).optional()
  }),

  // Typing indicator
  typing: z.object({
    type: z.enum(['typing_start', 'typing_stop']),
    conversationId: commonSchemas.conversationId,
    userId: commonSchemas.userId
  }),

  // Presence update
  presence: z.object({
    type: z.literal('presence'),
    status: z.enum(['online', 'offline', 'away', 'busy']),
    userId: commonSchemas.userId
  }),

  // Authentication
  auth: z.object({
    type: z.literal('auth'),
    challengeId: commonSchemas.challengeId,
    token: commonSchemas.jwtToken,
    signature: z.string().min(1)
  }),

  // Heartbeat
  heartbeat: z.object({
    type: z.literal('heartbeat'),
    timestamp: commonSchemas.timestamp
  })
};

// API endpoint validation schemas
export const apiSchemas = {
  // Authentication
  login: z.object({
    username: commonSchemas.username,
    password: z.string().min(8).max(128)
  }),

  // User management
  createUser: z.object({
    username: commonSchemas.username,
    displayName: commonSchemas.displayName,
    email: commonSchemas.email,
    phone: commonSchemas.phone.optional(),
    role: commonSchemas.role,
    teamId: z.number().positive().optional()
  }),

  updateUser: z.object({
    displayName: commonSchemas.displayName.optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    role: commonSchemas.role.optional(),
    status: commonSchemas.status.optional()
  }),

  // Conversation management
  createConversation: z.object({
    customerId: z.number().positive(),
    platform: commonSchemas.platform,
    assignedUserId: commonSchemas.userId.optional(),
    assignedTeamId: z.number().positive().optional()
  }),

  // Message management
  sendMessage: z.object({
    conversationId: commonSchemas.conversationId,
    content: commonSchemas.messageContent,
    messageType: z.enum(['text', 'image', 'file', 'audio', 'video']).default('text'),
    metadata: z.record(z.string(), z.any()).optional()
  }),

  // File upload
  fileUpload: z.object({
    fileName: commonSchemas.fileName,
    fileSize: commonSchemas.fileSize,
    mimeType: commonSchemas.mimeType,
    conversationId: commonSchemas.conversationId.optional()
  })
};

// Validation utility functions
export class InputValidator {
  /**
   * Validate WebSocket message
   */
  static validateWebSocketMessage(data: unknown): {
    isValid: boolean;
    message?: any;
    error?: string;
  } {
    try {
      // First validate base structure
      const baseResult = websocketMessageSchemas.base.safeParse(data);
      if (!baseResult.success) {
        return {
          isValid: false,
          error: `Invalid base message structure: ${baseResult.error.message}`
        };
      }

      const message = baseResult.data;

      // Validate specific message type
      switch (message.type) {
        case 'message':
          const chatResult = websocketMessageSchemas.chatMessage.safeParse(data);
          if (!chatResult.success) {
            return {
              isValid: false,
              error: `Invalid chat message: ${chatResult.error.message}`
            };
          }
          return { isValid: true, message: chatResult.data };

        case 'typing_start':
        case 'typing_stop':
          const typingResult = websocketMessageSchemas.typing.safeParse(data);
          if (!typingResult.success) {
            return {
              isValid: false,
              error: `Invalid typing message: ${typingResult.error.message}`
            };
          }
          return { isValid: true, message: typingResult.data };

        case 'presence':
          const presenceResult = websocketMessageSchemas.presence.safeParse(data);
          if (!presenceResult.success) {
            return {
              isValid: false,
              error: `Invalid presence message: ${presenceResult.error.message}`
            };
          }
          return { isValid: true, message: presenceResult.data };

        case 'auth':
          const authResult = websocketMessageSchemas.auth.safeParse(data);
          if (!authResult.success) {
            return {
              isValid: false,
              error: `Invalid auth message: ${authResult.error.message}`
            };
          }
          return { isValid: true, message: authResult.data };

        case 'heartbeat':
          const heartbeatResult = websocketMessageSchemas.heartbeat.safeParse(data);
          if (!heartbeatResult.success) {
            return {
              isValid: false,
              error: `Invalid heartbeat message: ${heartbeatResult.error.message}`
            };
          }
          return { isValid: true, message: heartbeatResult.data };

        default:
          return {
            isValid: false,
            error: `Unknown message type: ${message.type}`
          };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate API request body
   */
  static validateApiRequest<T extends keyof typeof apiSchemas>(
    endpoint: T,
    data: unknown
  ): {
    isValid: boolean;
    data?: z.infer<typeof apiSchemas[T]>;
    error?: string;
  } {
    try {
      const schema = apiSchemas[endpoint];
      const result = schema.safeParse(data);

      if (!result.success) {
        return {
          isValid: false,
          error: `Validation failed for ${endpoint}: ${result.error.message}`
        };
      }

      return {
        isValid: true,
        data: result.data as any // Type assertion to work around complex generic inference
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(content: string): string {
    // Basic HTML sanitization - removes script tags and dangerous attributes
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/style\s*=/gi, '')
      .trim();
  }

  /**
   * Validate and sanitize message content
   */
  static sanitizeMessageContent(content: string): {
    isValid: boolean;
    sanitized?: string;
    error?: string;
  } {
    try {
      // Validate length
      if (!content || content.length === 0) {
        return { isValid: false, error: 'Message content cannot be empty' };
      }

      if (content.length > LIMITS.MESSAGE_CONTENT) {
        return {
          isValid: false,
          error: `Message content exceeds maximum length of ${LIMITS.MESSAGE_CONTENT} characters`
        };
      }

      // Sanitize HTML
      const sanitized = this.sanitizeHtml(content);

      return {
        isValid: true,
        sanitized
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check for rate limiting violations
   */
  static checkRateLimit(
    identifier: string,
    action: string,
    maxRequests: number,
    windowMs: number,
    storage: Map<string, { count: number; resetTime: number }>
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const key = `${identifier}:${action}`;
    const now = Date.now();
    const record = storage.get(key);

    if (!record || now > record.resetTime) {
      // First request or window expired
      storage.set(key, {
        count: 1,
        resetTime: now + windowMs
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs
      };
    }

    if (record.count >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      };
    }

    // Increment counter
    record.count++;
    storage.set(key, record);

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime
    };
  }
}