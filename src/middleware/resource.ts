/**
 * 資源中間件 - 自動選擇正確的環境資源
 * 這個中間件會根據環境變數自動設置正確的資源到 c.env 中
 */

import { Context, Next } from 'hono';
import type { Bindings } from '../types/bindings';
import { createResourceSelector } from '../utils/resource-selector';

/**
 * 資源選擇中間件
 * 根據 ENVIRONMENT 環境變數自動選擇正確的資源綁定
 */
export function resourceMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    // 創建資源選擇器
    const resourceSelector = createResourceSelector(c.env);
    const resources = resourceSelector.getResources();

    // 將選擇的資源設置到 env 中，保持向後兼容性
    c.env.DB = resources.DB;
    c.env.SESSIONS = resources.SESSIONS;
    c.env.CACHE = resources.CACHE;
    c.env.R2_BUCKET = resources.R2_BUCKET;
    c.env.MESSAGE_QUEUE = resources.MESSAGE_QUEUE;
    
    // Set KV alias for backward compatibility
    c.env.KV = resources.SESSIONS;
    
    // Set Facebook aliases for backward compatibility
    if (c.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      c.env.FB_PAGE_ACCESS_TOKEN = c.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    }
    if (c.env.FACEBOOK_APP_SECRET) {
      c.env.FB_APP_SECRET = c.env.FACEBOOK_APP_SECRET;
    }
    if (c.env.FACEBOOK_VERIFY_TOKEN) {
      c.env.FB_VERIFY_TOKEN = c.env.FACEBOOK_VERIFY_TOKEN;
    }

    // 在環境變數中添加環境信息，方便除錯
    c.env.CURRENT_ENVIRONMENT = resources.environment;

    // 記錄當前使用的環境（僅在開發模式下）
    if (resourceSelector.isDevelopment()) {
      console.log(`🔧 Using DEVELOPMENT resources`);
    } else {
      console.log(`🚀 Using PRODUCTION resources`);
    }

    // 繼續處理請求
    await next();
  };
}

/**
 * 驗證資源可用性中間件
 * 確保所有必要的資源都已正確綁定
 */
export function validateResourcesMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const requiredResources = ['DB', 'SESSIONS', 'CACHE', 'R2_BUCKET', 'MESSAGE_QUEUE'];
    const missingResources: string[] = [];

    for (const resource of requiredResources) {
      if (!c.env[resource as keyof Bindings]) {
        missingResources.push(resource);
      }
    }

    if (missingResources.length > 0) {
      console.error(`❌ Missing resources: ${missingResources.join(', ')}`);
      return c.json({
        success: false,
        error: 'Resource configuration error',
        message: `Missing required resources: ${missingResources.join(', ')}`,
        details: {
          environment: c.env.ENVIRONMENT || 'unknown',
          missingResources
        }
      }, 500);
    }

    // 繼續處理請求
    return await next();
  };
}