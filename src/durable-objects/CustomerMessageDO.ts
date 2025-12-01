// CustomerMessageDO - Message Management for Customer Conversations
// Inspired by Chat Project's ConversationDurableObject
// Handles message CRUD operations and file uploads to R2

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { eq, lt, desc, and, inArray } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { messages, fileAttachments } from '../db/schema';

/**
 * Session data structure for validation
 */
interface SessionData {
  userId: string;
  displayName: string;
  role?: 'admin' | 'agent' | 'customer';
  expiresAt: number;
}

/**
 * Session validation result
 */
interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
}

/**
 * CustomerMessageDO
 *
 * Purpose: Handle message operations for customer conversations
 * Responsibilities:
 * 1. Message CRUD operations (using D1 database)
 * 2. Message pagination with "load more" support
 * 3. File upload to Cloudflare R2
 * 4. Notify CustomerConversationDO after message creation
 *
 * Architecture Pattern (from Chat Project):
 * - REST API endpoints for message operations
 * - After message creation, notify CustomerConversationDO for broadcasting
 * - R2 file upload with public URL generation
 * - Uses D1 database (NOT DO SQL Storage like Chat Project)
 */
export class CustomerMessageDO extends DurableObject<Bindings> {
  private app: Hono = new Hono();

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.setupRoutes();
    console.log('🏗️ [CustomerMessageDO] Initialized');
  }

  /**
   * Validate session against KV store
   * Uses the same session key format as KVSessionService
   */
  private async validateSession(sessionId: string): Promise<SessionValidationResult> {
    if (!sessionId) {
      return { valid: false, error: 'Session ID is required' };
    }

    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.env.SESSIONS.get(sessionKey, 'text');

      if (!sessionData) {
        return { valid: false, error: 'Session not found' };
      }

      const session: SessionData = JSON.parse(sessionData);

      // Check expiration
      if (session.expiresAt < Date.now()) {
        return { valid: false, error: 'Session expired' };
      }

      return { valid: true, session };
    } catch (error) {
      console.error('[CustomerMessageDO] Session validation error:', error);
      return { valid: false, error: 'Invalid session format' };
    }
  }

  /**
   * Set up HTTP routes
   * Adapted from Chat Project's ConversationDurableObject.setupRoutes()
   */
  private setupRoutes() {
    // Apply CORS middleware
    this.app.use('*', cors());

    /**
     * GET /messages - Fetch messages with pagination
     * Query params:
     * - limit: Number of messages to fetch (default: 50)
     * - before: Message ID to fetch messages before (for pagination)
     */
    this.app.get('/messages', async (c) => {
      const conversationId = c.req.header('X-Conversation-Id');
      const limit = parseInt(c.req.query('limit') || '50');
      const before = c.req.query('before');

      if (!conversationId) {
        return c.json({ success: false, error: 'Conversation ID is required' }, 400);
      }

      console.log(`📥 [CustomerMessageDO] Fetching messages:`, {
        conversationId,
        limit,
        before
      });

      try {
        const db = createDbClient(this.env.DB);

        let fetchedMessages;

        // If before is specified, fetch messages before that timestamp
        if (before) {
          // Get the timestamp of the 'before' message
          const beforeMessage = await db
            .select()
            .from(messages)
            .where(eq(messages.id, before))
            .limit(1);

          if (beforeMessage.length > 0) {
            const beforeTimestamp = beforeMessage[0].createdAt;
            // Only fetch if we have a valid timestamp
            if (beforeTimestamp) {
              fetchedMessages = await db
                .select()
                .from(messages)
                .where(and(
                  eq(messages.conversationId, conversationId),
                  lt(messages.createdAt, beforeTimestamp)
                ))
                .orderBy(desc(messages.createdAt))
                .limit(limit);
            } else {
              // Fallback if timestamp is null
              fetchedMessages = await db
                .select()
                .from(messages)
                .where(eq(messages.conversationId, conversationId))
                .orderBy(desc(messages.createdAt))
                .limit(limit);
            }
          } else {
            // If 'before' message not found, just fetch latest
            fetchedMessages = await db
              .select()
              .from(messages)
              .where(eq(messages.conversationId, conversationId))
              .orderBy(desc(messages.createdAt))
              .limit(limit);
          }
        } else {
          // Fetch latest messages
          fetchedMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(desc(messages.createdAt))
            .limit(limit);
        }

        console.log(`✅ [CustomerMessageDO] Fetched ${fetchedMessages.length} messages`);

        // 🔧 FIX: Query attachments for all fetched messages
        let attachmentsByMessageId: Record<string, any[]> = {};
        if (fetchedMessages.length > 0) {
          const messageIds = fetchedMessages.map(m => m.id);
          const allAttachments = await db
            .select()
            .from(fileAttachments)
            .where(inArray(fileAttachments.messageId, messageIds))
            .all();

          // Group attachments by messageId
          for (const attachment of allAttachments) {
            const msgId = attachment.messageId;
            if (msgId) {
              if (!attachmentsByMessageId[msgId]) {
                attachmentsByMessageId[msgId] = [];
              }
              attachmentsByMessageId[msgId].push(attachment);
            }
          }
        }

        // 🔧 FIX: Map agentSenderId/customerSenderId to senderId and include attachments
        return c.json({
          success: true,
          messages: fetchedMessages.map(msg => ({
            ...msg,
            senderId: msg.agentSenderId || msg.customerSenderId,
            file_attachments: attachmentsByMessageId[msg.id] || []  // 🔧 FIX: Include attachments
          })),
          hasMore: fetchedMessages.length === limit
        });
      } catch (error) {
        console.error('❌ [CustomerMessageDO] Error fetching messages:', error);
        return c.json({
          success: false,
          error: 'Failed to fetch messages'
        }, 500);
      }
    });

    /**
     * POST /messages - Create a new message
     * Body:
     * - content: Message text content
     * - assets: Array of R2 URLs (from file uploads)
     */
    this.app.post('/messages', async (c) => {
      const conversationId = c.req.header('X-Conversation-Id');
      const sessionId = c.req.header('X-Session-Id');

      if (!conversationId) {
        return c.json({ success: false, error: 'Conversation ID is required' }, 400);
      }

      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      try {
        // Extract userId from JWT token
        // JWT format: header.payload.signature
        // Payload contains: { userId, displayName, email, role, ... }
        let agentId: string;
        try {
          const parts = sessionId.split('.');
          if (parts.length === 3) {
            // Decode the payload (base64url)
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            agentId = payload.userId || sessionId;
          } else {
            // Not a JWT, use as-is (for backward compatibility with direct user ID)
            agentId = sessionId;
          }
        } catch (decodeError) {
          console.error('⚠️  [CustomerMessageDO] Failed to decode JWT, using sessionId as-is:', decodeError);
          agentId = sessionId;
        }

        const { content, assets, attachmentIds, messageType, platform } = await c.req.json();

        // Allow empty content if there are attachments
        const hasAttachments = attachmentIds && attachmentIds.length > 0;
        if (!content?.trim() && !hasAttachments) {
          return c.json({ success: false, error: 'Message content or attachments are required' }, 400);
        }

        console.log(`📝 [CustomerMessageDO] Creating message:`, {
          conversationId,
          agentId,
          contentLength: content?.length || 0,
          assetsCount: assets?.length || 0,
          attachmentIds: attachmentIds || []
        });

        const messageId = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        // Store assets and attachmentIds in metadata field as JSON
        const metadata = JSON.stringify({
          assets: assets || [],
          attachmentIds: attachmentIds || [],
          platform: platform || 'system'
        });

        // Determine message type - use 'file' if there are attachments
        const effectiveMessageType = hasAttachments ? 'file' : (messageType || 'text');

        // Construct the complete message object with ALL required fields
        // This prevents Drizzle ORM schema mismatch errors
        const messageData = {
          id: messageId,
          conversationId: conversationId,
          senderType: 'agent' as const,
          customerSenderId: null as string | null,
          agentSenderId: agentId,
          content: content || '',
          messageType: effectiveMessageType as 'text' | 'file',
          platformMessageId: null as string | null,
          isRecalled: false,
          recallDeadline: null as string | null,
          recalledAt: null as string | null,
          isSent: true,
          sentAt: null as string | null,
          deliveryStatus: 'delivered' as const,
          replyToMessageId: null as string | null,
          threadId: null as string | null,
          sessionId: null as string | null,
          sessionSequence: 1,
          metadata: metadata,
          createdAt: createdAt
        };

        // Store message in D1 database
        const db = createDbClient(this.env.DB);
        await db.insert(messages).values(messageData as any);

        // 🔧 FIX: Link attachments to the message
        if (hasAttachments) {
          console.log(`📎 [CustomerMessageDO] Linking ${attachmentIds.length} attachments to message ${messageId}`);
          for (const attachmentId of attachmentIds) {
            await db
              .update(fileAttachments)
              .set({ messageId: messageId })
              .where(eq(fileAttachments.id, attachmentId));
          }
          console.log(`✅ [CustomerMessageDO] Attachments linked successfully`);
        }

        console.log(`✅ [CustomerMessageDO] Message created: ${messageId}`);

        // 🔧 FIX: Fetch linked attachments for response
        let linkedAttachments: any[] = [];
        if (hasAttachments) {
          linkedAttachments = await db
            .select()
            .from(fileAttachments)
            .where(eq(fileAttachments.messageId, messageId))
            .all();
          console.log(`📎 [CustomerMessageDO] Fetched ${linkedAttachments.length} linked attachments`);
        }

        // Use the inserted data directly for broadcasting
        // This avoids D1 eventual consistency issues
        // 🔧 FIX: Add senderId field and file_attachments for frontend compatibility
        const createdMessage = {
          ...messageData,
          senderId: messageData.agentSenderId || messageData.customerSenderId,
          file_attachments: linkedAttachments
        };

        console.log(`📋 [CustomerMessageDO] Using direct message data for broadcast`);


        // Notify CustomerConversationDO to broadcast the message
        // This triggers real-time delivery to all connected clients
        try {
          const conversationDOId = this.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
          const conversationDO = this.env.CUSTOMER_CONVERSATION_DO.get(conversationDOId);

          console.log(`📡 [CustomerMessageDO] Preparing to notify CustomerConversationDO`);

          // Use fetch() to send notification to CustomerConversationDO
          // Cannot directly call methods on other Durable Objects!
          const notifyRequest = new Request('https://fake-host/notify-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              message: createdMessage
            })
          });

          const response = await conversationDO.fetch(notifyRequest);

          if (response.ok) {
            console.log(`✅ [CustomerMessageDO] Notified CustomerConversationDO for broadcast`);
          } else {
            const errorText = await response.text();
            console.error(`⚠️  [CustomerMessageDO] CustomerConversationDO returned error:`, errorText);
          }
        } catch (error) {
          console.error('⚠️  [CustomerMessageDO] Failed to notify CustomerConversationDO:', error);
          // Message is still stored, just not broadcasted in real-time
          // Clients will receive it on next fetch
        }

        console.log(`📤 [CustomerMessageDO] Returning success response`);
        return c.json({
          success: true,
          message: createdMessage
        });
      } catch (error) {
        console.error('❌ [CustomerMessageDO] Error creating message:', error);
        return c.json({
          success: false,
          error: 'Failed to create message'
        }, 500);
      }
    });

    /**
     * POST /upload - Upload file to Cloudflare R2
     * Adapted from Chat Project's ConversationDO file upload
     */
    this.app.post('/upload', async (c) => {
      const conversationId = c.req.header('X-Conversation-Id');
      const sessionId = c.req.header('X-Session-Id');

      if (!conversationId) {
        return c.json({ success: false, error: 'Conversation ID is required' }, 400);
      }

      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      try {
        // Validate session against KV store
        const validation = await this.validateSession(sessionId);
        if (!validation.valid || !validation.session) {
          return c.json({ success: false, error: validation.error || 'Invalid session' }, 401);
        }
        const userId = validation.session.userId;

        // Get the file from the request
        const formData = await c.req.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return c.json({ success: false, error: 'No file provided' }, 400);
        }

        console.log(`📤 [CustomerMessageDO] Uploading file:`, {
          conversationId,
          userId,
          filename: file.name,
          size: file.size,
          type: file.type
        });

        // Generate a unique filename
        const fileExtension = file.name.split('.').pop();
        const uniqueFilename = `${conversationId}/${crypto.randomUUID()}.${fileExtension}`;

        // Upload to R2
        await this.env.R2_BUCKET.put(uniqueFilename, file, {
          httpMetadata: {
            contentType: file.type
          }
        });

        // Generate the public URL
        const assetUrl = `${this.env.R2_PUBLIC_URL}/${uniqueFilename}`;

        console.log(`✅ [CustomerMessageDO] File uploaded: ${assetUrl}`);

        return c.json({
          success: true,
          url: assetUrl,
          filename: file.name,
          size: file.size,
          contentType: file.type
        });
      } catch (error) {
        console.error('❌ [CustomerMessageDO] File upload error:', error);
        return c.json({
          success: false,
          error: 'Failed to upload file'
        }, 500);
      }
    });

    console.log('🛣️  [CustomerMessageDO] Routes configured');
  }

  /**
   * Handle incoming HTTP requests
   */
  // P2-6: Added override modifier for strict mode compliance
  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env);
  }
}
