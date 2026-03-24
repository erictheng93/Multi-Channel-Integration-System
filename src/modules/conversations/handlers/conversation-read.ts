// Mark conversation as read handler
// Handles: PUT /:id/read

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { conversations } from '@/db/schema';
import type { Bindings } from '@/types';
import { PermissionService } from '@shared/services/permission-service';
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

export default conversationReadHandler;
