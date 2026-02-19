// Customer 驗證中間件
// 提供客戶數據的輸入驗證和格式檢查

import { Context, Next } from 'hono';
import {
  validationErrorResponse,
  errorResponse
} from '@shared/utils/api-response';
import {
  CreateCustomerData,
  UpdateCustomerData,
  CustomerTagOperation,
  CustomerSearchQuery,
  CustomerFilters,
  DEFAULT_CUSTOMER_VALIDATION
} from '../types/customer-types';
import type { Bindings } from '@/types';

// ======================== 通用驗證中間件 ========================

/**
 * 驗證分頁參數
 */
export const validatePaginationParams = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    const { page = '1', pageSize = '20' } = c.req.query();

    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);

    const errors = [];

    if (isNaN(pageNum) || pageNum < 1) {
      errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }

    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      errors.push({ field: 'pageSize', message: 'Page size must be between 1 and 100' });
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    // 將驗證後的參數設置到上下文中
    c.set('paginationParams', { page: pageNum, pageSize: pageSizeNum });

    return await next();
  } catch (error) {
    console.error('Error validating pagination params:', error);
    return errorResponse(c, 'Invalid pagination parameters');
  }
};

/**
 * 驗證客戶ID參數
 */
export const validateCustomerId = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    const customerId = c.req.param('id');

    if (!customerId) {
      return validationErrorResponse(c, [
        { field: 'id', message: 'Customer ID is required' }
      ]);
    }

    const customerIdNum = parseInt(customerId);

    if (isNaN(customerIdNum) || customerIdNum < 1) {
      return validationErrorResponse(c, [
        { field: 'id', message: 'Customer ID must be a positive integer' }
      ]);
    }

    c.set('customerId', customerIdNum.toString());

    return await next();
  } catch (error) {
    console.error('Error validating customer ID:', error);
    return errorResponse(c, 'Invalid customer ID');
  }
};

// ======================== 客戶數據驗證中間件 ========================

/**
 * 驗證客戶創建數據
 */
export const validateCreateCustomerData = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    let data: CreateCustomerData;

    try {
      data = await c.req.json();
    } catch (error) {
      return errorResponse(c, 'Invalid JSON data');
    }

    const errors = validateCustomerBasicData(data);

    // 驗證必填字段
    if (!data.platform) {
      errors.push({ field: 'platform', message: 'Platform is required' });
    } else if (typeof data.platform !== 'string' || data.platform.trim().length === 0) {
      errors.push({ field: 'platform', message: 'Platform must be a non-empty string' });
    }

    if (!data.platformUserId) {
      errors.push({ field: 'platformUserId', message: 'Platform user ID is required' });
    } else if (typeof data.platformUserId !== 'string' || data.platformUserId.trim().length === 0) {
      errors.push({ field: 'platformUserId', message: 'Platform user ID must be a non-empty string' });
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    c.set('createCustomerData', data);

    return await next();
  } catch (error) {
    console.error('Error validating create customer data:', error);
    return errorResponse(c, 'Invalid customer data');
  }
};

/**
 * 驗證客戶更新數據
 */
export const validateUpdateCustomerData = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    let data: UpdateCustomerData;

    try {
      data = await c.req.json();
    } catch (error) {
      return errorResponse(c, 'Invalid JSON data');
    }

    const errors = validateCustomerBasicData(data);

    // 更新數據不能全部為空
    const hasData = Object.values(data).some(value => value !== undefined);
    if (!hasData) {
      errors.push({ field: 'data', message: 'At least one field must be provided for update' });
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    c.set('updateCustomerData', data);

    return await next();
  } catch (error) {
    console.error('Error validating update customer data:', error);
    return errorResponse(c, 'Invalid customer data');
  }
};

// ======================== 標籤操作驗證中間件 ========================

/**
 * 驗證標籤操作數據
 */
export const validateTagOperation = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    let data: CustomerTagOperation;

    try {
      data = await c.req.json();
    } catch (error) {
      return errorResponse(c, 'Invalid JSON data');
    }

    const errors = [];

    if (!Array.isArray(data.tagIds)) {
      errors.push({ field: 'tagIds', message: 'Tag IDs must be an array' });
    } else if (data.tagIds.length === 0) {
      errors.push({ field: 'tagIds', message: 'At least one tag ID is required' });
    } else {
      const invalidTagIds = data.tagIds.filter(id => typeof id !== 'number' || id < 1);
      if (invalidTagIds.length > 0) {
        errors.push({ field: 'tagIds', message: 'All tag IDs must be positive integers' });
      }
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    c.set('tagOperation', data);

    return await next();
  } catch (error) {
    console.error('Error validating tag operation:', error);
    return errorResponse(c, 'Invalid tag operation data');
  }
};

// ======================== 搜索驗證中間件 ========================

/**
 * 驗證搜索查詢參數
 */
export const validateSearchQuery = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    const { q, limit = '10', platform } = c.req.query();

    const errors = [];

    if (!q) {
      errors.push({ field: 'q', message: 'Search query is required' });
    } else if (typeof q !== 'string' || q.trim().length < 2) {
      errors.push({ field: 'q', message: 'Search query must be at least 2 characters long' });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push({ field: 'limit', message: 'Limit must be between 1 and 50' });
    }

    if (platform && (typeof platform !== 'string' || platform.trim().length === 0)) {
      errors.push({ field: 'platform', message: 'Platform must be a non-empty string' });
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    const searchQuery: CustomerSearchQuery = {
      q: q.trim(),
      limit: limitNum,
      platform: platform?.trim()
    };

    c.set('searchQuery', searchQuery);

    return await next();
  } catch (error) {
    console.error('Error validating search query:', error);
    return errorResponse(c, 'Invalid search parameters');
  }
};

/**
 * 驗證篩選參數
 */
export const validateFilterParams = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    const query = c.req.query();
    const errors = [];

    const filters: CustomerFilters = {};

    // 平台篩選
    if (query.platform) {
      if (typeof query.platform !== 'string' || query.platform.trim().length === 0) {
        errors.push({ field: 'platform', message: 'Platform must be a non-empty string' });
      } else {
        filters.platform = query.platform.trim();
      }
    }

    // 團隊ID篩選
    if (query.teamId) {
      const teamId = parseInt(query.teamId);
      if (isNaN(teamId) || teamId < 1) {
        errors.push({ field: 'teamId', message: 'Team ID must be a positive integer' });
      } else {
        filters.teamId = teamId;
      }
    }

    // 標籤ID篩選
    if (query.tagId) {
      const tagId = parseInt(query.tagId);
      if (isNaN(tagId) || tagId < 1) {
        errors.push({ field: 'tagId', message: 'Tag ID must be a positive integer' });
      } else {
        filters.tagId = tagId;
      }
    }

    // 搜索關鍵字
    if (query.search) {
      if (typeof query.search !== 'string' || query.search.trim().length < 2) {
        errors.push({ field: 'search', message: 'Search term must be at least 2 characters long' });
      } else {
        filters.search = query.search.trim();
      }
    }

    // Email篩選
    if (query.hasEmail) {
      if (query.hasEmail !== 'true' && query.hasEmail !== 'false') {
        errors.push({ field: 'hasEmail', message: 'hasEmail must be "true" or "false"' });
      } else {
        filters.hasEmail = query.hasEmail === 'true';
      }
    }

    // 電話篩選
    if (query.hasPhone) {
      if (query.hasPhone !== 'true' && query.hasPhone !== 'false') {
        errors.push({ field: 'hasPhone', message: 'hasPhone must be "true" or "false"' });
      } else {
        filters.hasPhone = query.hasPhone === 'true';
      }
    }

    // 日期範圍篩選
    if (query.dateFrom) {
      const dateFrom = new Date(query.dateFrom);
      if (isNaN(dateFrom.getTime())) {
        errors.push({ field: 'dateFrom', message: 'Invalid dateFrom format' });
      } else {
        filters.dateFrom = dateFrom.toISOString();
      }
    }

    if (query.dateTo) {
      const dateTo = new Date(query.dateTo);
      if (isNaN(dateTo.getTime())) {
        errors.push({ field: 'dateTo', message: 'Invalid dateTo format' });
      } else {
        filters.dateTo = dateTo.toISOString();
      }
    }

    // 狀態篩選
    if (query.status) {
      if (query.status !== 'active' && query.status !== 'inactive') {
        errors.push({ field: 'status', message: 'Status must be "active" or "inactive"' });
      } else {
        filters.status = query.status;
      }
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    c.set('customerFilters', filters);

    return await next();
  } catch (error) {
    console.error('Error validating filter params:', error);
    return errorResponse(c, 'Invalid filter parameters');
  }
};

// ======================== 輔助驗證函數 ========================

/**
 * 驗證客戶基本數據 (共用於創建和更新)
 */
function validateCustomerBasicData(data: Partial<CreateCustomerData | UpdateCustomerData>) {
  const errors = [];
  const validation = DEFAULT_CUSTOMER_VALIDATION;

  // 顯示名稱驗證
  if (data.displayName !== undefined) {
    if (data.displayName !== null && typeof data.displayName !== 'string') {
      errors.push({ field: 'displayName', message: 'Display name must be a string or null' });
    } else if (data.displayName && data.displayName.length > validation.displayName!.maxLength) {
      errors.push({
        field: 'displayName',
        message: `Display name must be less than ${validation.displayName!.maxLength} characters`
      });
    }
  }

  // Email驗證
  if (data.email !== undefined) {
    if (data.email !== null && typeof data.email !== 'string') {
      errors.push({ field: 'email', message: 'Email must be a string or null' });
    } else if (data.email && !validation.email!.pattern.test(data.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }
  }

  // 電話驗證
  if (data.phone !== undefined) {
    if (data.phone !== null && typeof data.phone !== 'string') {
      errors.push({ field: 'phone', message: 'Phone must be a string or null' });
    } else if (data.phone && !validation.phone!.pattern.test(data.phone)) {
      errors.push({ field: 'phone', message: 'Invalid phone format' });
    }
  }

  // 團隊ID驗證
  if (data.sourceTeamId !== undefined) {
    if (data.sourceTeamId !== null && (typeof data.sourceTeamId !== 'number' || data.sourceTeamId < 1)) {
      errors.push({ field: 'sourceTeamId', message: 'Source team ID must be a positive integer or null' });
    }
  }

  // 元數據驗證
  if (data.metadata !== undefined) {
    if (data.metadata !== null) {
      try {
        const metadataStr = JSON.stringify(data.metadata);
        if (metadataStr.length > validation.metadata!.maxSize) {
          errors.push({
            field: 'metadata',
            message: `Metadata size must be less than ${validation.metadata!.maxSize} bytes`
          });
        }
      } catch (error) {
        errors.push({ field: 'metadata', message: 'Metadata must be a valid JSON object' });
      }
    }
  }

  return errors;
}

/**
 * 清理和標準化輸入數據
 */
export function sanitizeCustomerData<T extends Partial<CreateCustomerData | UpdateCustomerData>>(data: T): T {
  const sanitized = { ...data };

  // 清理字符串字段
  if (sanitized.displayName && typeof sanitized.displayName === 'string') {
    sanitized.displayName = sanitized.displayName.trim();
    if (sanitized.displayName === '') {
      sanitized.displayName = null;
    }
  }

  if (sanitized.email && typeof sanitized.email === 'string') {
    sanitized.email = sanitized.email.trim().toLowerCase();
    if (sanitized.email === '') {
      sanitized.email = null;
    }
  }

  if (sanitized.phone && typeof sanitized.phone === 'string') {
    sanitized.phone = sanitized.phone.trim();
    if (sanitized.phone === '') {
      sanitized.phone = null;
    }
  }

  if (sanitized.avatarUrl && typeof sanitized.avatarUrl === 'string') {
    sanitized.avatarUrl = sanitized.avatarUrl.trim();
    if (sanitized.avatarUrl === '') {
      sanitized.avatarUrl = null;
    }
  }

  return sanitized;
}

/**
 * 驗證批量操作參數
 */
export const validateBatchOperation = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  try {
    let data: { customerIds: number[] };

    try {
      data = await c.req.json();
    } catch (error) {
      return errorResponse(c, 'Invalid JSON data');
    }

    const errors = [];

    if (!Array.isArray(data.customerIds)) {
      errors.push({ field: 'customerIds', message: 'Customer IDs must be an array' });
    } else if (data.customerIds.length === 0) {
      errors.push({ field: 'customerIds', message: 'At least one customer ID is required' });
    } else if (data.customerIds.length > 100) {
      errors.push({ field: 'customerIds', message: 'Maximum 100 customer IDs allowed per batch operation' });
    } else {
      const invalidIds = data.customerIds.filter(id => typeof id !== 'number' || id < 1);
      if (invalidIds.length > 0) {
        errors.push({ field: 'customerIds', message: 'All customer IDs must be positive integers' });
      }
    }

    if (errors.length > 0) {
      return validationErrorResponse(c, errors);
    }

    c.set('batchOperation', data);

    return await next();
  } catch (error) {
    console.error('Error validating batch operation:', error);
    return errorResponse(c, 'Invalid batch operation data');
  }
};