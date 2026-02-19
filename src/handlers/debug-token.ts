// Debug token generation endpoint — extracted from src/index.ts
// Development-only: generates short-lived JWT tokens for testing

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { jwtAuth } from '../middleware/auth';
import { signJWT } from '../utils/auth';
import { globalErrorHandler } from '@/core/error-handler';

const router = new Hono<{ Bindings: Bindings }>();

router.post('/generate-token', jwtAuth, async (c) => {
  try {
    const user = c.get('user');

    // Only administrators can use this endpoint
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Only administrators can generate debug tokens'
      }, 403);
    }

    const { userId = "debug-user", displayName = "Debug User", role = "agent" } = await c.req.json();

    // Prevent generating tokens with higher privileges
    if (role === 'admin' && user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Cannot generate admin tokens'
      }, 403);
    }

    const payload = {
      userId,
      displayName,
      role,
      teamId: user.primaryTeamId || 1,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes only
    };

    const token = await signJWT(payload, c.env.JWT_SECRET);

    return c.json({
      success: true,
      token,
      expiresAt: new Date((payload.exp * 1000)).toISOString(),
      note: 'Debug token - limited to 30 minutes'
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

export default router;
