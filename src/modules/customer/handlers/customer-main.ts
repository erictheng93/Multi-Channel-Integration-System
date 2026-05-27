// 客戶管理處理器 - 主要實現
import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings, JWTPayload } from '@/types';
import { handleApiError } from '@/utils/api-response';
import { customerTagsHandler } from './customer-tags';
import { jwtAuth } from '@/middleware/auth';
import { requireIntId, getValidatedParam } from '@/middleware/param-validator';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger'

// F10: gate a customer record by the caller's team scope. Admins see all.
// Other agents see customers whose sourceTeamId is in their allowedTeamIds
// (or null, treated as a shared pool consistent with conversations).
function canAccessCustomer(
  customer: { sourceTeamId?: number | null | undefined },
  user: JWTPayload
): boolean {
  if (user.role === 'admin') return true;
  const sourceTeamId = customer.sourceTeamId;
  if (sourceTeamId === null || sourceTeamId === undefined) return true;
  return (user.allowedTeamIds ?? []).includes(sourceTeamId);
}

const log = createContextLogger('CustomerMain')


const customerHandler = new Hono<{ Bindings: Bindings }>();

// CORS 處理已移至 src/index.ts 統一管理
// 不再需要 handler 級別的 CORS middleware

// 應用 JWT 認證中間件到所有端點
customerHandler.use('/*', jwtAuth);

// ========================================
// 客戶標籤管理端點（需要在其他路由之前定義）
// ========================================

// 獲取可用的標籤列表（用於標籤選擇器）
customerHandler.get('/tags/available', customerTagsHandler.getAvailableTags);

// ========================================
// 客戶管理端點
// Route registration order: STATIC → SPECIFIC → PARAMETERIZED → WILDCARD
// ========================================

// ==================== Priority 1: SPECIFIC multi-segment routes ====================
// 根據平台用戶ID查詢客戶 (moved from line 44 to before /:customerId)
customerHandler.get('/platform/:platform/:platformUserId', async (c) => {
  try {
    const platform = c.req.param('platform');
    const platformUserId = c.req.param('platformUserId');
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const { getCustomerByPlatformId, getCustomerConversations } = await import('@/utils/database');

    const customer = await getCustomerByPlatformId(c.env.DB, platform, platformUserId);
    if (!customer) {
      return c.json({
        success: false,
        error: 'Customer not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    // F10: gate by team. Return 404 (not 403) so the lookup doesn't leak
    // whether a given LINE/FB user is in another team's customer book.
    if (!canAccessCustomer(customer, userPayload)) {
      return c.json({
        success: false,
        error: 'Customer not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    const conversations = await getCustomerConversations(c.env.DB, customer.id);

    return c.json({
      success: true,
      data: {
        customer,
        conversations,
        conversationCount: conversations.length
      },
      timestamp: nowISO()
    });
  } catch (error) {
    log.error('Operation failed', {}, error as Error);
    return handleApiError(error, c);
  }
});

// ==================== Priority 2: PARAMETERIZED multi-segment routes ====================
// 獲取客戶的所有標籤 (moved from line 117 - more specific, 2 segments)
customerHandler.get('/:customerId/tags', requireIntId('customerId'), customerTagsHandler.getCustomerTags);

// ==================== Priority 3: PARAMETERIZED single-segment routes ====================
// 特定客戶資訊查詢端點 (moved from line 77 to before /)
customerHandler.get('/:customerId', requireIntId('customerId'), async (c) => {
  try {
    const customerId = getValidatedParam<number>(c, 'customerId');
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const { getCustomerById, getCustomerConversations } = await import('@/utils/database');

    const customer = await getCustomerById(c.env.DB, customerId);
    if (!customer) {
      return c.json({
        success: false,
        error: 'Customer not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    // F10: same team-scope gate as the platform-lookup route. 404 hides
    // existence to avoid enumeration of customers in other teams.
    if (!canAccessCustomer(customer, userPayload)) {
      return c.json({
        success: false,
        error: 'Customer not found',
        timestamp: nowISO()
      }, HTTP_STATUS.NOT_FOUND);
    }

    const conversations = await getCustomerConversations(c.env.DB, customerId);

    return c.json({
      success: true,
      data: {
        customer,
        conversations,
        conversationCount: conversations.length
      },
      timestamp: nowISO()
    });
  } catch (error) {
    log.error('Operation failed', {}, error as Error);
    return handleApiError(error, c);
  }
});

// ==================== Priority 4: WILDCARD routes ====================
// 客戶資訊查詢端點 - 列表所有客戶 (moved from line 24 to after /:customerId)
customerHandler.get('/', async (c) => {
  try {
    const userPayload = c.get('jwtPayload') as JWTPayload;
    const { getAllCustomers } = await import('@/utils/database');
    const allCustomers = await getAllCustomers(c.env.DB);

    // F10: filter to customers the caller can access. Admins see everything;
    // other agents see customers whose sourceTeamId is in their
    // allowedTeamIds (or null, the shared-pool convention). This is a
    // post-fetch trim so the visible count may be lower than the underlying
    // limit; a follow-up pagination redesign should push the filter into
    // the SQL WHERE clause.
    const visibleCustomers = allCustomers.filter((customer) =>
      canAccessCustomer(customer, userPayload)
    );

    return c.json({
      success: true,
      data: {
        customers: visibleCustomers,
        count: visibleCustomers.length
      },
      timestamp: nowISO()
    });
  } catch (error) {
    log.error('Operation failed', {}, error as Error);
    return handleApiError(error, c);
  }
});

// ========================================
// 客戶標籤關聯端點 (other HTTP methods)
// ========================================

// 為客戶添加標籤
customerHandler.post('/:customerId/tags', requireIntId('customerId'), customerTagsHandler.addTagsToCustomer);

// 從客戶移除標籤
customerHandler.delete('/:customerId/tags', requireIntId('customerId'), customerTagsHandler.removeTagsFromCustomer);

// 設置客戶標籤（替換所有現有標籤）
customerHandler.put('/:customerId/tags', requireIntId('customerId'), customerTagsHandler.setCustomerTags);

export default customerHandler;
