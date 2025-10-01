// Authentication Handlers Index
// 認證處理器索引

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { authHandler } from '@modules/auth/handlers/auth';

// 創建認證路由
const authRouter = new Hono<{ Bindings: Bindings }>();

// 健康檢查端點
authRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    module: 'auth',
    version: '1.0.0'
  });
});

// 模組資訊端點
authRouter.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      module: 'authentication',
      version: '1.0.0',
      endpoints: [
        'GET /health - Health check',
        'GET /info - Module information',
        'POST /login - User login',
        'POST /logout - User logout',
        'GET /profile - Get user profile',
        'POST /refresh - Refresh token'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// 註冊認證路由
authRouter.post('/login', authHandler.login);

// 登出端點 (基礎實現)
authRouter.post('/logout', (c) => {
  return c.json({
    success: true,
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
});

// 導出路由
export { authRouter as authMainHandler };
export * from './auth';