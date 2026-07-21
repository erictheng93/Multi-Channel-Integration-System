// Mark conversation as read/unread handler
// Handles: PUT /:id/read, PUT /:id/unread

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations } from '@/db/schema';
import type { Bindings } from '@/types';
import { PermissionService } from '@/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { nowISO } from '@/utils/timestamp';

const conversationReadHandler = new Hono<{ Bindings: Bindings }>();

// Mark conversation as read — updates last_read_at timestamp
conversationReadHandler.put('/:id/read', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;

    // Check permission
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const drizzleDb = createDbClient(c.env.DB);
    const now = nowISO();

    await drizzleDb
      .update(conversations)
      .set({ lastReadAt: now })
      .where(eq(conversations.id, conversationId));

    return c.json({
      success: true,
      data: { lastReadAt: now },
      timestamp: now
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

// Mark conversation as unread — clears last_read_at so the derived unread count
// reverts to "customer messages after the last agent reply" (the pre-read value)
conversationReadHandler.put('/:id/unread', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('id')!;

    // Check permission
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'conversation',
      'view',
      {
        userId: Number(user.id),
        role: user.role,
        resourceId: conversationId
      },
      c.env.DB
    );

    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, HTTP_STATUS.FORBIDDEN);
    }

    const drizzleDb = createDbClient(c.env.DB);
    const now = nowISO();

    const existing = await drizzleDb
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();

    if (!existing) {
      return c.json({ error: 'Conversation not found' }, HTTP_STATUS.NOT_FOUND);
    }

    await drizzleDb
      .update(conversations)
      .set({ lastReadAt: null, updatedAt: now })
      .where(eq(conversations.id, conversationId));

    // Recompute the unread count with the same formula as conversation-queries.ts:
    // "Unread" = customer messages after MAX(last_agent_reply, last_read_at)
    // Threshold subqueries reference the bound id (not m.conversation_id) so
    // they are uncorrelated and evaluated once, not per message row.
    const unreadResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as unreadCount
      FROM messages m
      WHERE m.conversation_id = ?
        AND m.sender_type = 'customer'
        AND m.deleted_at IS NULL
        AND m.created_at > MAX(
          COALESCE(
            (SELECT MAX(m2.created_at) FROM messages m2
             WHERE m2.conversation_id = ?
             AND m2.sender_type IN ('agent', 'system')
             AND m2.deleted_at IS NULL),
            '1970-01-01'
          ),
          COALESCE(
            (SELECT last_read_at FROM conversations WHERE id = ?),
            '1970-01-01'
          )
        )
    `).bind(conversationId, conversationId, conversationId).first<{ unreadCount: number }>();

    const unreadCount = Number(unreadResult?.unreadCount) || 0;

    return c.json({
      success: true,
      data: { unreadCount },
      timestamp: now
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default conversationReadHandler;
