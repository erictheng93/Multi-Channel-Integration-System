// 標籤管理處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { tagHandler } from './tag';
import { jwtAuth } from '../middleware/auth';

const tagMainHandler = new Hono<{ Bindings: Bindings }>();

// ✅ CORS 處理已移至 src/index.ts 統一管理
// 不再需要 handler 級別的 CORS middleware

// 🔒 應用 JWT 認證中間件到所有端點（除了健康檢查）
tagMainHandler.use('/*', async (c, next) => {
  // 健康檢查端點不需要認證
  if (c.req.path.endsWith('/health')) {
    return next();
  }
  return jwtAuth(c, next);
});

// ========================================
// 標籤管理端點
// Route registration order: STATIC → SPECIFIC → PARAMETERIZED → WILDCARD
// ========================================

// ========================================
// 健康檢查端點
// Route Order: Registered first to prevent any potential interception
// ========================================
tagMainHandler.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      handler: 'tag-main',
      timestamp: new Date().toISOString()
    },
    message: 'Tag handler is operational'
  });
});

// ==================== Priority 1: SPECIFIC multi-segment routes ====================
// 批量操作標籤 (must be before /:id routes)
tagMainHandler.post('/bulk', tagHandler.bulkOperation);

// ==================== Priority 2: PARAMETERIZED multi-segment routes ====================
// 獲取標籤使用統計
tagMainHandler.get('/:id/stats', tagHandler.getUsageStats);

// ==================== Priority 3: PARAMETERIZED single-segment routes ====================
// 獲取單一標籤詳情
tagMainHandler.get('/:id', tagHandler.get);

// 更新標籤
tagMainHandler.put('/:id', tagHandler.update);

// 刪除標籤（軟刪除）
tagMainHandler.delete('/:id', tagHandler.delete);

// ==================== Priority 4: WILDCARD routes ====================
// 獲取標籤列表
tagMainHandler.get('/', tagHandler.list);

// 創建標籤
tagMainHandler.post('/', tagHandler.create);

export default tagMainHandler;
