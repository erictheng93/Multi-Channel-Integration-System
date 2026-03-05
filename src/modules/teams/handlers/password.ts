// Password Management Handler
// 密碼管理路由處理器

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth, requireManagerOrAdmin } from '@/middleware/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { eq } from 'drizzle-orm';
import { agents } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/modules/auth/services/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import type {
  ResetPasswordRequest,
  ChangePasswordRequest
} from '../types/password-types';
import { nowISO } from '@/utils/timestamp'

const passwordHandler = new Hono<{ Bindings: Bindings }>();

/**
 * 管理員重置成員密碼
 * POST /api/teams/members/:memberId/reset
 */
passwordHandler.post('/:memberId/reset', jwtAuth, requireManagerOrAdmin(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = c.req.param('memberId')!;
    const data: ResetPasswordRequest & { policy?: 'changeable' | 'unchangeable' | 'must_change' } = await c.req.json();

    if (!data.newPassword) {
      return c.json({
        success: false,
        error: 'newPassword is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // Cannot reset your own password through this endpoint
    if (memberId === user.id) {
      return c.json({
        success: false,
        error: 'Use change-password endpoint to change your own password'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(data.newPassword);

    // Prepare update data
    const updateData: {
      passwordHash: string;
      passwordPolicy?: string;
      updatedAt: string;
    } = {
      passwordHash: hashedPassword,
      updatedAt: nowISO()
    };

    // Add password policy if provided
    if (data.policy) {
      updateData.passwordPolicy = data.policy;
    }

    // Update password
    const [updated] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, memberId))
      .returning();

    if (!updated) {
      return c.json({
        success: false,
        error: 'Member not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    return c.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        passwordPolicy: updated.passwordPolicy
      },
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 用戶更改自己的密碼
 * POST /api/auth/change-password
 */
passwordHandler.post('/change-password', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const data: ChangePasswordRequest = await c.req.json();

    if (!data.currentPassword || !data.newPassword) {
      return c.json({
        success: false,
        error: 'currentPassword and newPassword are required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const db = createDbClient(c.env.DB);

    // Verify current password
    const [member] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, String(user.id)))
      .limit(1);

    if (!member) {
      return c.json({
        success: false,
        error: 'User not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    // Verify current password using bcrypt
    const isCurrentPasswordValid = await verifyPassword(data.currentPassword, member.passwordHash);
    if (!isCurrentPasswordValid) {
      return c.json({
        success: false,
        error: 'Current password is incorrect'
      }, HTTP_STATUS.UNAUTHORIZED);
    }

    // Hash the new password before storing
    const hashedNewPassword = await hashPassword(data.newPassword);

    // Update password
    await db
      .update(agents)
      .set({
        passwordHash: hashedNewPassword,
        updatedAt: nowISO()
      })
      .where(eq(agents.id, String(user.id)));

    return c.json({
      success: true,
      message: 'Password changed successfully',
      timestamp: nowISO()
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default passwordHandler;
