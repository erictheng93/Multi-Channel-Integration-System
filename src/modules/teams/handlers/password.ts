// Password Management Handler
// 密碼管理路由處理器

import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';
import { jwtAuth, requireManagerOrAdmin } from '@/middleware/auth';
import { getUserById, verifyJWT } from '@/utils/auth';
import { createDbClient } from '@/db/drizzle-factory';
import { eq } from 'drizzle-orm';
import { agents } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/modules/auth/services/auth';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import type {
  ResetPasswordRequest,
  ChangePasswordRequest
} from '../types/password-types';
import { nowISO } from '@/utils/timestamp'
import { teamContracts, type ContractResponse } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';

const passwordHandler = new Hono<{ Bindings: Bindings }>();
type PasswordContext = Context<{ Bindings: Bindings }>;

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

async function changePasswordAuth(c: PasswordContext, next: Next): Promise<Response | void> {
  const tempToken = getBearerToken(c.req.header('Authorization'));

  if (!tempToken) {
    return jwtAuth(c, next);
  }

  try {
    const payload = await verifyJWT(tempToken, c.env.JWT_SECRET);
    if (payload.type !== 'temp_password_change') {
      return c.json({ error: 'Invalid password change token' }, HTTP_STATUS.UNAUTHORIZED);
    }
    if (!payload.jti) {
      return c.json({ error: 'Invalid password change token' }, HTTP_STATUS.UNAUTHORIZED);
    }

    const revoked = await c.env.CACHE.get(`revoked:${payload.jti}`);
    if (revoked) {
      return c.json({ error: 'Password change token has already been used' }, HTTP_STATUS.UNAUTHORIZED);
    }

    const user = await getUserById(c.env.DB, payload.userId);
    if (!user.isActive) {
      return c.json({ error: 'User account is inactive' }, HTTP_STATUS.UNAUTHORIZED);
    }

    c.set('user', user);
    c.set('jwtPayload', payload);
    await next();
  } catch (error) {
    return c.json({
      error: 'Invalid or expired password change token',
      message: error instanceof Error ? error.message : 'Authentication failed'
    }, HTTP_STATUS.UNAUTHORIZED);
  }
}

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

    return contractJson(c, teamContracts.resetPasswordWithPolicy, {
      success: true,
      message: 'Password reset successfully',
      timestamp: nowISO()
    } as ContractResponse<typeof teamContracts.resetPasswordWithPolicy>);

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 用戶更改自己的密碼
 * POST /api/auth/change-password
 */
passwordHandler.post('/change-password', changePasswordAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = String(user.id);
    const data = await c.req.json() as Partial<ChangePasswordRequest> & { newPassword?: string };
    const jwtPayload = c.get('jwtPayload');
    const usingTempPasswordToken = jwtPayload?.type === 'temp_password_change';
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const userAgent = c.req.header('User-Agent');
    const activityService = new ActivityService(c.env.DB);

    if (!data.newPassword || (!usingTempPasswordToken && !data.currentPassword)) {
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
      .where(eq(agents.id, userId))
      .limit(1);

    if (!member) {
      return c.json({
        success: false,
        error: 'User not found'
      }, HTTP_STATUS.NOT_FOUND);
    }

    if (!usingTempPasswordToken) {
      // Verify current password using bcrypt
      const isCurrentPasswordValid = await verifyPassword(data.currentPassword!, member.passwordHash);
      if (!isCurrentPasswordValid) {
        // 記錄安全事件：舊密碼錯誤 (可能是被盜或誤輸入)
        await activityService.logActivity({
          userId,
          userName: member.displayName,
          userRole: user.role,
          action: ACTIVITY_ACTIONS.USER_UPDATE,
          resourceType: RESOURCE_TYPES.USER,
          resourceId: userId,
          details: {
            event: 'password_change_failed',
            reason: 'wrong_current_password',
            selfService: true,
          },
          ipAddress,
          userAgent,
        });
        return c.json({
          success: false,
          error: 'Current password is incorrect'
        }, HTTP_STATUS.UNAUTHORIZED);
      }
    }

    // Hash the new password before storing
    const hashedNewPassword = await hashPassword(data.newPassword);

    // Update password
    await db
      .update(agents)
      .set({
        passwordHash: hashedNewPassword,
        passwordPolicy: 'changeable',
        updatedAt: nowISO()
      })
      .where(eq(agents.id, userId));

    if (usingTempPasswordToken && jwtPayload?.jti) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ttl = typeof jwtPayload.exp === 'number'
        ? Math.max(1, jwtPayload.exp - nowSeconds)
        : 30 * 60;
      await c.env.CACHE.put(`revoked:${jwtPayload.jti}`, '1', { expirationTtl: ttl });
    }

    // 記錄稽核日誌 (不記密碼本身)
    await activityService.logActivity({
      userId,
      userName: member.displayName,
      userRole: user.role,
      action: ACTIVITY_ACTIONS.USER_UPDATE,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: userId,
      details: {
        event: 'password_change',
        selfService: true,
      },
      ipAddress,
      userAgent,
    });

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
