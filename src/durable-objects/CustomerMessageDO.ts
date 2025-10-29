// CustomerMessageDO - Message Management for Customer Conversations
// Inspired by Chat Project's ConversationDurableObject
// Handles message CRUD operations and file uploads to R2

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { eq, lt, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { messages } from '../db/schema';

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
        const db = drizzle(this.env.DB);

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

        return c.json({
          success: true,
          messages: fetchedMessages,
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
        // TODO: Validate session and get agentId from KV
        // For now, use sessionId as agentId (simplified)
        const agentId = sessionId;

        const { content, assets } = await c.req.json();

        if (!content?.trim()) {
          return c.json({ success: false, error: 'Message content is required' }, 400);
        }

        console.log(`📝 [CustomerMessageDO] Creating message:`, {
          conversationId,
          agentId,
          contentLength: content.length,
          assetsCount: assets?.length || 0
        });

        const messageId = crypto.randomUUID();

        // Store assets in metadata field as JSON
        const metadata = JSON.stringify({
          assets: assets || []
        });

        // Store message in D1 database
        const db = drizzle(this.env.DB);

        await db.insert(messages).values({
          id: messageId,
          conversationId: conversationId,
          senderType: 'agent',
          agentSenderId: agentId,
          content: content,
          messageType: 'text',
          metadata: metadata,
          createdAt: new Date().toISOString()
        });

        // Fetch the created message
        const [createdMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        console.log(`✅ [CustomerMessageDO] Message created: ${messageId}`);

        // Notify CustomerConversationDO to broadcast the message
        // This triggers real-time delivery to all connected clients
        try {
          const conversationDOId = this.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
          const conversationDO = this.env.CUSTOMER_CONVERSATION_DO.get(conversationDOId);

          await (conversationDO as any).notifyNewMessage(conversationId, createdMessage);

          console.log(`📡 [CustomerMessageDO] Notified CustomerConversationDO for broadcast`);
        } catch (error) {
          console.error('⚠️  [CustomerMessageDO] Failed to notify CustomerConversationDO:', error);
          // Message is still stored, just not broadcasted in real-time
          // Clients will receive it on next fetch
        }

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
        // TODO: Validate session
        const userId = sessionId;

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
  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env);
  }
}
