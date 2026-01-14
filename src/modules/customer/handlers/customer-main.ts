// Customer 主要處理器
// 提供客戶的基礎CRUD操作API端點

import { Context } from 'hono';
import {
  successResponse,
  notFoundResponse,
  handleApiError
} from '@shared/utils/api-response';
import { CustomerCrudService } from '@modules/customer/services/customer-crud';
import { sanitizeCustomerData } from '@modules/customer/middleware/customer-validation';
import {
  Customer,
  CustomerWithDetails,
  CreateCustomerData,
  UpdateCustomerData,
  CustomerNotFoundError
} from '../types/customer-types';
import type { Bindings, JWTPayload } from '@/types';

/**
 * Customer CRUD 操作處理器類
 */
export class CustomerMainHandler {
  /**
   * 創建新客戶
   * POST /api/customers
   */
  static async create(c: Context<{ Bindings: Bindings }>) {
    try {
      const createData = c.get('createCustomerData') as CreateCustomerData;
      const userPayload = c.get('jwtPayload') as JWTPayload;

      // 清理和標準化輸入數據
      const sanitizedData = sanitizeCustomerData(createData);

      // 如果用戶不是admin且沒有指定sourceTeamId，則自動設置為用戶的團隊
      if (userPayload.role !== 'admin' && !sanitizedData.sourceTeamId && userPayload.teamId) {
        sanitizedData.sourceTeamId = userPayload.teamId;
      }

      const customerService = new CustomerCrudService(c.env.DB);
      const newCustomer = await customerService.create(sanitizedData);

      return successResponse(c, newCustomer, 'Customer created successfully');
    } catch (error) {
      console.error('Error creating customer:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取客戶詳情
   * GET /api/customers/:id
   */
  static async get(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerIdStr = c.get('customerId') as string;
      const customerId = parseInt(customerIdStr);

      const customerService = new CustomerCrudService(c.env.DB);
      const customer = await customerService.findByIdWithDetails(customerId);

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      return successResponse(c, customer, 'Customer retrieved successfully');
    } catch (error) {
      console.error('Error getting customer:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 更新客戶資料
   * PUT /api/customers/:id
   */
  static async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerIdStr = c.get('customerId') as string;
      const customerId = parseInt(customerIdStr);
      const updateData = c.get('updateCustomerData') as UpdateCustomerData;

      // 清理和標準化輸入數據
      const sanitizedData = sanitizeCustomerData(updateData);

      const customerService = new CustomerCrudService(c.env.DB);
      const updatedCustomer = await customerService.update(customerId, sanitizedData);

      return successResponse(c, updatedCustomer, 'Customer updated successfully');
    } catch (error) {
      console.error('Error updating customer:', error);
      if (error instanceof CustomerNotFoundError) {
        return notFoundResponse(c, 'Customer');
      }
      return handleApiError(error, c);
    }
  }

  /**
   * 軟刪除客戶
   * DELETE /api/customers/:id
   */
  static async softDelete(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerIdStr = c.get('customerId') as string;
      const customerId = parseInt(customerIdStr);

      const customerService = new CustomerCrudService(c.env.DB);
      await customerService.softDelete(customerId);

      return successResponse(c, null, 'Customer deleted successfully');
    } catch (error) {
      console.error('Error deleting customer:', error);
      if (error instanceof CustomerNotFoundError) {
        return notFoundResponse(c, 'Customer');
      }
      return handleApiError(error, c);
    }
  }

  /**
   * 根據平台ID查詢客戶
   * GET /api/customers/platform/:platform/:platformUserId
   *
   * 安全性修復 (2025-01-14): 加入團隊所有權驗證，防止跨團隊資料洩漏
   */
  static async getByPlatformId(c: Context<{ Bindings: Bindings }>) {
    try {
      const platform = c.req.param('platform');
      const platformUserId = c.req.param('platformUserId');

      if (!platform || !platformUserId) {
        return c.json({
          success: false,
          error: 'Platform and platform user ID are required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const customerService = new CustomerCrudService(c.env.DB);
      const customer = await customerService.findByPlatformId(platform, platformUserId);

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      // 安全性檢查: 驗證用戶是否有權限存取此客戶
      const userPayload = c.get('jwtPayload') as JWTPayload;

      // Admin 可以存取所有客戶
      if (userPayload.role !== 'admin') {
        // 非 Admin 需要檢查團隊所有權
        // 客戶有團隊歸屬且不屬於當前用戶的團隊時，拒絕存取
        if (customer.sourceTeamId && customer.sourceTeamId !== userPayload.teamId) {
          return c.json({
            success: false,
            error: 'Access denied to this customer',
            timestamp: new Date().toISOString()
          }, 403);
        }
      }

      // 獲取完整的客戶資料 (包含詳情)
      const customerWithDetails = await customerService.findByIdWithDetails(customer.id);

      return successResponse(c, customerWithDetails, 'Customer retrieved successfully');
    } catch (error) {
      console.error('Error getting customer by platform ID:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 尋找或創建客戶 (用於自動客戶管理)
   * POST /api/customers/find-or-create
   *
   * 安全性修復 (2025-01-14): 加入團隊所有權驗證，防止跨團隊資料存取
   */
  static async findOrCreate(c: Context<{ Bindings: Bindings }>) {
    try {
      let requestData: {
        platform: string;
        platformUserId: string;
        additionalInfo?: Partial<CreateCustomerData>;
      };

      try {
        requestData = await c.req.json();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid JSON data',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const { platform, platformUserId, additionalInfo } = requestData;

      if (!platform || !platformUserId) {
        return c.json({
          success: false,
          error: 'Platform and platform user ID are required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const userPayload = c.get('jwtPayload') as JWTPayload;
      const customerService = new CustomerCrudService(c.env.DB);

      // 安全性檢查: 先檢查是否存在現有客戶，並驗證團隊所有權
      const existingCustomer = await customerService.findByPlatformId(platform, platformUserId);

      if (existingCustomer) {
        // 客戶已存在，檢查用戶是否有權限存取
        if (userPayload.role !== 'admin') {
          // 非 Admin 需要檢查團隊所有權
          if (existingCustomer.sourceTeamId && existingCustomer.sourceTeamId !== userPayload.teamId) {
            // 客戶屬於其他團隊，拒絕存取
            return c.json({
              success: false,
              error: 'Access denied: Customer belongs to another team',
              timestamp: new Date().toISOString()
            }, 403);
          }
        }

        // 有權限存取，返回現有客戶 (不更新，避免跨團隊修改)
        return successResponse(c, existingCustomer, 'Customer retrieved successfully');
      }

      // 客戶不存在，創建新客戶
      // 清理附加信息
      const sanitizedAdditionalInfo = additionalInfo ? sanitizeCustomerData(additionalInfo) : {};

      // 如果用戶不是admin且沒有指定sourceTeamId，則自動設置為用戶的團隊
      if (userPayload.role !== 'admin' && !sanitizedAdditionalInfo.sourceTeamId && userPayload.teamId) {
        sanitizedAdditionalInfo.sourceTeamId = userPayload.teamId;
      }

      const newCustomer = await customerService.create({
        platform,
        platformUserId,
        ...sanitizedAdditionalInfo
      });

      return successResponse(c, newCustomer, 'Customer created successfully');
    } catch (error) {
      console.error('Error in find or create customer:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 獲取客戶的基本資料 (簡化版本，不包含統計數據)
   * GET /api/customers/:id/basic
   */
  static async getBasic(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerIdStr = c.get('customerId') as string;
      const customerId = parseInt(customerIdStr);

      const customerService = new CustomerCrudService(c.env.DB);
      const customer = await customerService.findById(customerId);

      if (!customer) {
        return notFoundResponse(c, 'Customer');
      }

      return successResponse(c, customer, 'Customer basic info retrieved successfully');
    } catch (error) {
      console.error('Error getting customer basic info:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 批量獲取客戶基本資料
   * POST /api/customers/batch/basic
   */
  static async getBatchBasic(c: Context<{ Bindings: Bindings }>) {
    try {
      const batchOperation = c.get('batchOperation') as { customerIds: number[] };
      const { customerIds } = batchOperation;

      const customerService = new CustomerCrudService(c.env.DB);
      const customers: (Customer | null)[] = await Promise.all(
        customerIds.map(id => customerService.findById(id))
      );

      // 過濾掉不存在的客戶
      const validCustomers = customers.filter((customer): customer is Customer => customer !== null);

      return successResponse(c, {
        customers: validCustomers,
        requested: customerIds.length,
        found: validCustomers.length,
        missing: customerIds.length - validCustomers.length
      }, 'Batch customer retrieval completed');
    } catch (error) {
      console.error('Error in batch get basic:', error);
      return handleApiError(error, c);
    }
  }

  /**
   * 檢查客戶是否存在
   * HEAD /api/customers/:id
   */
  static async exists(c: Context<{ Bindings: Bindings }>) {
    try {
      const customerIdStr = c.get('customerId') as string;
      const customerId = parseInt(customerIdStr);

      const customerService = new CustomerCrudService(c.env.DB);
      const customer = await customerService.findById(customerId);

      if (!customer) {
        return c.body(null, 404);
      }

      return c.body(null, 200);
    } catch (error) {
      console.error('Error checking customer existence:', error);
      return c.body(null, 500);
    }
  }

  /**
   * 檢查平台客戶是否存在
   * HEAD /api/customers/platform/:platform/:platformUserId
   *
   * 安全性修復 (2025-01-14): 加入團隊所有權驗證，防止跨團隊資料探測
   */
  static async existsByPlatformId(c: Context<{ Bindings: Bindings }>) {
    try {
      const platform = c.req.param('platform');
      const platformUserId = c.req.param('platformUserId');

      if (!platform || !platformUserId) {
        return c.body(null, 400);
      }

      const customerService = new CustomerCrudService(c.env.DB);
      const customer = await customerService.findByPlatformId(platform, platformUserId);

      if (!customer) {
        return c.body(null, 404);
      }

      // 安全性檢查: 驗證用戶是否有權限存取此客戶
      const userPayload = c.get('jwtPayload') as JWTPayload;

      if (userPayload.role !== 'admin') {
        // 非 Admin 需要檢查團隊所有權
        if (customer.sourceTeamId && customer.sourceTeamId !== userPayload.teamId) {
          // 客戶屬於其他團隊，返回 404 (不透露客戶存在)
          // 使用 404 而非 403 以防止資訊洩漏
          return c.body(null, 404);
        }
      }

      return c.body(null, 200);
    } catch (error) {
      console.error('Error checking customer existence by platform ID:', error);
      return c.body(null, 500);
    }
  }
}