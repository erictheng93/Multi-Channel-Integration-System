// CustomerMessageDO - Message Management for Customer Conversations
// Inspired by Chat Project's ConversationDurableObject
// Handles message CRUD operations and file uploads to R2

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../types';
import { eq, lt, desc, and, inArray } from 'drizzle-orm';
import { createDbClient } from '../db/drizzle-factory';
import { messages, fileAttachments, conversations, customers, agents } from '../db/schema';
import { nowISO, nowMs } from '@/utils/timestamp'
import { getPublicFileUrl, getSignedDownloadUrl } from '@/utils/file-url';
import { resolveDisplaySenderName } from '@/utils/sender-name-repair';
import { getRecallWindowSeconds } from '@/services/recall-window-config';
import { scheduleOrDeliverNow } from '@modules/conversations/services/buffered-send-scheduler';

type MessageInsert = typeof messages.$inferInsert;
type FileAttachment = typeof fileAttachments.$inferSelect;

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
  private recallWindowCache: { value: number; expiresAtMs: number } | null = null;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.setupRoutes();
    console.log('[CustomerMessageDO] Initialized');
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
      if (session.expiresAt < nowMs()) {
        return { valid: false, error: 'Session expired' };
      }

      return { valid: true, session };
    } catch (error) {
      console.error('[CustomerMessageDO] Session validation error:', error);
      return { valid: false, error: 'Invalid session format' };
    }
  }

  private async getCachedRecallWindowSeconds(): Promise<number> {
    const now = nowMs();
    if (this.recallWindowCache && this.recallWindowCache.expiresAtMs > now) {
      return this.recallWindowCache.value;
    }

    const value = await getRecallWindowSeconds(this.env);
    this.recallWindowCache = {
      value,
      expiresAtMs: now + 60_000
    };
    return value;
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

      console.log(`[CustomerMessageDO] Fetching messages:`, {
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

        console.log(`[CustomerMessageDO] Fetched ${fetchedMessages.length} messages`);

        // FIX: Query attachments for all fetched messages
        let attachmentsByMessageId: Record<string, unknown[]> = {};
        if (fetchedMessages.length > 0) {
          const messageIds = fetchedMessages.map(m => m.id);
          const allAttachments = await db
            .select()
            .from(fileAttachments)
            .where(inArray(fileAttachments.messageId, messageIds))
            .all();

          // Group attachments by messageId, attaching a signed force-download
          // URL. fileUrl points at the raw R2 object (served `inline`, used as
          // <img> src), so the explicit download button needs a separate
          // attachment-disposition URL or it just opens the image in a new view.
          // Minted only when r2Key exists; failures degrade to undefined and the
          // frontend falls back to fileUrl.
          for (const attachment of allAttachments) {
            const msgId = attachment.messageId;
            if (msgId) {
              if (!attachmentsByMessageId[msgId]) {
                attachmentsByMessageId[msgId] = [];
              }
              const downloadUrl = attachment.r2Key
                ? await getSignedDownloadUrl(this.env, attachment.id, attachment.r2Key).catch(() => undefined)
                : undefined;
              attachmentsByMessageId[msgId].push({ ...attachment, downloadUrl });
            }
          }
        }

        const agentIds = [...new Set(
          fetchedMessages
            .map(msg => msg.agentSenderId)
            .filter((agentId): agentId is string => Boolean(agentId))
        )];
        const agentDisplayNamesById = new Map<string, string>();
        if (agentIds.length > 0) {
          const agentRows = await db
            .select({
              id: agents.id,
              displayName: agents.displayName
            })
            .from(agents)
            .where(inArray(agents.id, agentIds))
            .all();

          for (const agent of agentRows) {
            agentDisplayNamesById.set(agent.id, agent.displayName);
          }
        }

        // FIX: Map agentSenderId/customerSenderId to senderId and include attachments
        return c.json({
          success: true,
          messages: fetchedMessages.map(msg => ({
            ...msg,
            senderId: msg.agentSenderId || msg.customerSenderId,
            senderName: resolveDisplaySenderName({
              senderType: msg.senderType,
              senderName: msg.senderName,
              agentDisplayName: msg.agentSenderId
                ? agentDisplayNamesById.get(msg.agentSenderId)
                : null
            }),
            file_attachments: attachmentsByMessageId[msg.id] || []  //  FIX: Include attachments
          })),
          hasMore: fetchedMessages.length === limit
        });
      } catch (error) {
        console.error('[CustomerMessageDO] Error fetching messages:', error);
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
      const authenticatedUserId = c.req.header('X-Authenticated-User-Id');
      // The proxy URL-encodes this header (Latin-1 restriction on header
      // values); decode it back. Guard against malformed sequences so a bad
      // value degrades to the raw string instead of throwing.
      const rawDisplayName = c.req.header('X-Authenticated-Display-Name');
      let authenticatedDisplayName = rawDisplayName;
      if (rawDisplayName) {
        try {
          authenticatedDisplayName = decodeURIComponent(rawDisplayName);
        } catch {
          authenticatedDisplayName = rawDisplayName;
        }
      }

      if (!conversationId) {
        return c.json({ success: false, error: 'Conversation ID is required' }, 400);
      }

      if (!sessionId) {
        return c.json({ success: false, error: 'Session ID is required' }, 401);
      }

      if (!authenticatedUserId) {
        return c.json({ success: false, error: 'Authenticated user is required' }, 401);
      }

      try {
        const agentId = authenticatedUserId;
        const agentDisplayName = authenticatedDisplayName || null;

        const { content, assets, attachmentIds, messageType, platform, correlationId } = await c.req.json();

        // Allow empty content if there are attachments
        const hasAttachments = attachmentIds && attachmentIds.length > 0;
        if (!content?.trim() && !hasAttachments) {
          return c.json({ success: false, error: 'Message content or attachments are required' }, 400);
        }

        console.log(`[CustomerMessageDO] Creating message:`, {
          conversationId,
          agentId,
          contentLength: content?.length || 0,
          assetsCount: assets?.length || 0,
          attachmentIds: attachmentIds || [],
          correlationId: correlationId || 'N/A'  //  Phase 3: Log correlationId
        });

        const messageId = crypto.randomUUID();
        const createdAt = nowISO();

        // Recall window (ADR-0003): when enabled, hold the outbound LINE push in
        // the DelayedMessageScheduler DO so the agent can recall within the
        // window. Only LINE messages are buffered — LINE is the only platform
        // this DO pushes to; other platforms keep store-and-broadcast behavior.
        const db = createDbClient(this.env.DB);
        const recallWindowSeconds = await this.getCachedRecallWindowSeconds();
        let shouldUseSharedDelivery = false;
        let buffered = false;
        let targetPlatform: string | null = null;
        try {
          const target = await db
            .select({
              customerId: customers.id,
              platform: customers.platform,
              platformUserId: customers.platformUserId
            })
            .from(conversations)
            .innerJoin(customers, eq(conversations.customerId, customers.id))
            .where(eq(conversations.id, conversationId))
            .get();
          targetPlatform = target?.platform ?? null;
          shouldUseSharedDelivery = targetPlatform === 'line';
          buffered = shouldUseSharedDelivery && recallWindowSeconds > 0;
        } catch (error) {
          // Recall-window platform detection is optional. If it fails, keep the
          // message creation path available and fall back to immediate send.
          console.warn('[CustomerMessageDO] Recall-window platform lookup failed; sending immediately', error);
          shouldUseSharedDelivery = false;
          buffered = false;
        }

        // Store assets and attachmentIds in metadata field as JSON
        // Phase 3: Include correlationId for deduplication
        const metadata = JSON.stringify({
          assets: assets || [],
          attachmentIds: attachmentIds || [],
          platform: targetPlatform || platform || 'system',
          correlationId: correlationId || null  //  Phase 3: Track correlation for WebSocket dedup
        });

        // Determine message type - use 'file' if there are attachments
        const effectiveMessageType = hasAttachments ? 'file' : (messageType || 'text');

        // Construct the complete message object with ALL required fields
        // This prevents Drizzle ORM schema mismatch errors
        const messageData: MessageInsert = {
          id: messageId,
          conversationId: conversationId,
          senderType: 'agent' as const,
          customerSenderId: null,
          agentSenderId: agentId,
          content: content || '',
          messageType: effectiveMessageType as 'text' | 'file',
          platformMessageId: null as string | null,
          isRecalled: false,
          recallDeadline: null,
          recalledAt: null as string | null,
          isSent: !shouldUseSharedDelivery,
          sentAt: null as string | null,
          deliveryStatus: buffered
            ? ('buffered' as const)
            : shouldUseSharedDelivery
              ? ('pending' as const)
              : ('delivered' as const),
          replyToMessageId: null as string | null,
          threadId: null as string | null,
          sessionId: null as string | null,
          sessionSequence: 1,
          metadata: metadata,
          senderName: agentDisplayName, // 持久化發送者名稱快照
          createdAt: createdAt
        };

        // Store message in D1 database
        await db.insert(messages).values(messageData);

        // Recall window (ADR-0003): arm the scheduler immediately after insert,
        // before any non-critical post-insert D1 work can fail and strand a
        // buffered row without an alarm.
        let deliverAfterInitialBroadcast = false;
        if (buffered) {
          const deliveryPlan = await scheduleOrDeliverNow(this.env, {
            messageId,
            conversationId,
            recallWindowSeconds,
            canBuffer: true
          });
          messageData.deliveryStatus = deliveryPlan.deliveryStatus;
          messageData.recallDeadline = deliveryPlan.recallDeadline;
          messageData.isSent = deliveryPlan.isSent;
          // Scheduling can fail (DO unreachable, etc). Never deliver here —
          // that would broadcast a message_updated event before the client
          // has even received new_message for this id, and the FE silently
          // drops updates for messages it doesn't know about yet. Defer to
          // the same deliverAfterInitialBroadcast path the non-buffered
          // case uses below, ordered after the initial broadcast.
          deliverAfterInitialBroadcast = deliveryPlan.needsImmediateDelivery;
        } else if (shouldUseSharedDelivery) {
          deliverAfterInitialBroadcast = true;
        }

        // FIX: Link attachments to the message
        if (hasAttachments) {
          console.log(`[CustomerMessageDO] Linking ${attachmentIds.length} attachments to message ${messageId}`);
          for (const attachmentId of attachmentIds) {
            await db
              .update(fileAttachments)
              .set({ messageId: messageId })
              .where(eq(fileAttachments.id, attachmentId));
          }
          console.log(`[CustomerMessageDO] Attachments linked successfully`);
        }

        console.log(`[CustomerMessageDO] Message created: ${messageId}`);

        // FIX: Update conversation timestamps (updatedAt + lastMessageAt)
        // This was missing, causing conversations to not re-sort after new messages
        await db
          .update(conversations)
          .set({ lastMessageAt: createdAt, updatedAt: createdAt })
          .where(eq(conversations.id, conversationId));
        console.log(`[CustomerMessageDO] Conversation timestamps updated: ${createdAt}`);

        // FIX: Fetch linked attachments for response
        let linkedAttachments: FileAttachment[] = [];
        if (hasAttachments) {
          linkedAttachments = await db
            .select()
            .from(fileAttachments)
            .where(eq(fileAttachments.messageId, messageId))
            .all();
          console.log(`[CustomerMessageDO] Fetched ${linkedAttachments.length} linked attachments`);
        }

        // Use the inserted data directly for broadcasting
        // This avoids D1 eventual consistency issues
        // FIX: Add senderId field and file_attachments for frontend compatibility
        // Phase 3: Add correlationId for WebSocket deduplication
        const createdMessage = {
          ...messageData,
          senderId: messageData.agentSenderId || messageData.customerSenderId,
          file_attachments: linkedAttachments,
          correlationId: correlationId || null  //  Phase 3: For WebSocket deduplication
        };

        console.log(`[CustomerMessageDO] Using direct message data for broadcast`);

        // Notify CustomerConversationDO to broadcast the message
        // This triggers real-time delivery to all connected clients
        try {
          const conversationDOId = this.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
          const conversationDO = this.env.CUSTOMER_CONVERSATION_DO.get(conversationDOId);

          console.log(`[CustomerMessageDO] Preparing to notify CustomerConversationDO`);

          // Use fetch() to send notification to CustomerConversationDO
          // Cannot directly call methods on other Durable Objects!
          const notifyRequest = new Request('https://customer-conversation-do/notify-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              message: createdMessage
            })
          });

          const response = await conversationDO.fetch(notifyRequest);

          if (response.ok) {
            // DEBUG: Log response with connection info
            const responseData = await response.json() as { success: boolean; debug?: { totalConnections: number; connectedUsers: string[]; doConversationId: string } };
            console.log(`[CustomerMessageDO] Notified CustomerConversationDO for broadcast:`, {
              conversationId,
              debug: responseData.debug
            });
          } else {
            const errorText = await response.text();
            console.error(`  [CustomerMessageDO] CustomerConversationDO returned error:`, errorText);
          }
        } catch (error) {
          console.error('  [CustomerMessageDO] Failed to notify CustomerConversationDO:', error);
          // Message is still stored, just not broadcasted in real-time
          // Clients will receive it on next fetch
        }

        if (deliverAfterInitialBroadcast) {
          const { MessageDeliveryService } = await import('@modules/conversations/services/message-delivery-service');
          await new MessageDeliveryService(this.env).deliver(messageId);
        }

        // Broadcast to MessageBroadcaster for global updates (conversation list page)
        // This ensures conversation list lastMessage updates in real-time
        try {
          if (this.env.MESSAGE_BROADCASTER) {
            const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
            const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

            const globalEvent = {
              id: crypto.randomUUID(),
              type: 'new_message',
              source: 'api',
              timestamp: nowMs(),
              conversationId,
              data: {
                conversationId,
                messageId: createdMessage.id,
                content: createdMessage.content,
                messageType: createdMessage.messageType,
                senderType: createdMessage.senderType,
                senderId: createdMessage.senderId,
                platform: 'line',
                timestamp: createdMessage.createdAt
              },
              priority: 'normal'
            };

            const globalResponse = await broadcasterStub.fetch(new Request('https://message-broadcaster/broadcast-global', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: globalEvent,
                target: { type: 'global', targets: ['all'] }
              })
            }));

            if (globalResponse.ok) {
              console.log(`[CustomerMessageDO] Global broadcast sent to MessageBroadcaster for conversation list updates`);
            } else {
              console.warn(`  [CustomerMessageDO] MessageBroadcaster returned non-ok:`, await globalResponse.text());
            }
          }
        } catch (globalError) {
          console.error(`  [CustomerMessageDO] Failed to broadcast globally:`, globalError);
          // Non-critical - conversation detail page still gets updates via CustomerConversationDO
        }

        console.log(`[CustomerMessageDO] Returning success response`);
        return c.json({
          success: true,
          message: createdMessage
        });
      } catch (error) {
        console.error('[CustomerMessageDO] Error creating message:', error);
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

        console.log(`[CustomerMessageDO] Uploading file:`, {
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
            contentType: file.type,
            cacheControl: 'public, max-age=604800'
          }
        });

        // Generate the public URL
        const assetUrl = getPublicFileUrl(this.env, uniqueFilename);

        console.log(`[CustomerMessageDO] File uploaded: ${assetUrl}`);

        return c.json({
          success: true,
          url: assetUrl,
          filename: file.name,
          size: file.size,
          contentType: file.type
        });
      } catch (error) {
        console.error('[CustomerMessageDO] File upload error:', error);
        return c.json({
          success: false,
          error: 'Failed to upload file'
        }, 500);
      }
    });

    console.log('  [CustomerMessageDO] Routes configured');
  }

  /**
   * Handle incoming HTTP requests
   */
  // P2-6: Added override modifier for strict mode compliance
  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env);
  }
}
