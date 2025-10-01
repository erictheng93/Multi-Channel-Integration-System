// QRCode 驗證中間件
// 負責 QR Code 請求數據的驗證和清理

import type { Context, Next } from 'hono';
import type { Bindings } from '../../../types';
import { errorResponse } from '@shared/utils/api-response';
import { QR_CODE_DEFAULTS } from '@modules/qrcode/types/qrcode-types';
import { QRCodeGenerationService } from '@modules/qrcode/services/qrcode-generation-service';

// ======================== 驗證中間件 ========================

/**
 * QR Code 創建請求驗證
 */
export async function validateCreateRequest(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const data = await c.req.json();

    // 必要字段檢查
    const requiredFields = ['name', 'type', 'content'];
    const missingFields = requiredFields.filter(field => !data[field] || (typeof data[field] === 'string' && data[field].trim().length === 0));

    if (missingFields.length > 0) {
      return errorResponse(c, `Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    // 字段長度檢查
    if (data.name.length > 100) {
      return errorResponse(c, 'Name must not exceed 100 characters', 400);
    }

    if (data.description && data.description.length > 500) {
      return errorResponse(c, 'Description must not exceed 500 characters', 400);
    }

    // QR Code 類型驗證
    const validTypes = ['url', 'text', 'contact', 'wifi', 'sms', 'email', 'phone', 'event', 'location', 'app', 'social'];
    if (!validTypes.includes(data.type)) {
      return errorResponse(c, `Invalid QR code type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    // 內容驗證
    const contentValidation = QRCodeGenerationService.validateContent(data.type, data.content);
    if (!contentValidation.valid) {
      return errorResponse(c, `Invalid content: ${contentValidation.errors.join(', ')}`, 400);
    }

    // 內容長度檢查
    if (typeof data.content === 'string' && data.content.length > QR_CODE_DEFAULTS.maxContentLength) {
      return errorResponse(c, `Content too long. Maximum ${QR_CODE_DEFAULTS.maxContentLength} characters allowed`, 400);
    }

    // 生成設定驗證
    if (data.size !== undefined) {
      if (typeof data.size !== 'number' || data.size < QR_CODE_DEFAULTS.minSize || data.size > QR_CODE_DEFAULTS.maxSize) {
        return errorResponse(c, `Size must be between ${QR_CODE_DEFAULTS.minSize} and ${QR_CODE_DEFAULTS.maxSize} pixels`, 400);
      }
    }

    if (data.errorCorrectionLevel !== undefined) {
      const validLevels = ['L', 'M', 'Q', 'H'];
      if (!validLevels.includes(data.errorCorrectionLevel)) {
        return errorResponse(c, `Invalid error correction level. Must be one of: ${validLevels.join(', ')}`, 400);
      }
    }

    if (data.outputFormat !== undefined) {
      const validFormats = ['png', 'jpg', 'svg', 'pdf', 'base64'];
      if (!validFormats.includes(data.outputFormat)) {
        return errorResponse(c, `Invalid output format. Must be one of: ${validFormats.join(', ')}`, 400);
      }
    }

    // 顏色格式驗證
    if (data.foregroundColor && !isValidHexColor(data.foregroundColor)) {
      return errorResponse(c, 'Invalid foreground color format. Must be a valid hex color (e.g., #000000)', 400);
    }

    if (data.backgroundColor && !isValidHexColor(data.backgroundColor)) {
      return errorResponse(c, 'Invalid background color format. Must be a valid hex color (e.g., #FFFFFF)', 400);
    }

    // 邊框寬度驗證
    if (data.borderWidth !== undefined) {
      if (typeof data.borderWidth !== 'number' || data.borderWidth < 0 || data.borderWidth > 50) {
        return errorResponse(c, 'Border width must be between 0 and 50 pixels', 400);
      }
    }

    // Logo URL 驗證
    if (data.logoUrl && !isValidUrl(data.logoUrl)) {
      return errorResponse(c, 'Invalid logo URL format', 400);
    }

    // 過期時間驗證
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return errorResponse(c, 'Invalid expiry date format', 400);
      }

      if (expiryDate <= new Date()) {
        return errorResponse(c, 'Expiry date must be in the future', 400);
      }
    }

    // 標籤驗證
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        return errorResponse(c, 'Tags must be an array', 400);
      }

      if (data.tags.length > 10) {
        return errorResponse(c, 'Maximum 10 tags allowed', 400);
      }

      for (const tag of data.tags) {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          return errorResponse(c, 'All tags must be non-empty strings', 400);
        }

        if (tag.length > 50) {
          return errorResponse(c, 'Each tag must not exceed 50 characters', 400);
        }
      }
    }

    // 自定義數據驗證
    if (data.customData) {
      if (typeof data.customData !== 'object') {
        return errorResponse(c, 'Custom data must be an object', 400);
      }

      const customDataString = JSON.stringify(data.customData);
      if (customDataString.length > 5000) {
        return errorResponse(c, 'Custom data too large. Maximum 5000 characters allowed', 400);
      }
    }

    // 清理和標準化數據
    const cleanedData = {
      ...data,
      name: data.name.trim(),
      description: data.description ? data.description.trim() : undefined,
      content: typeof data.content === 'string' ? data.content.trim() : data.content,
      tags: data.tags ? data.tags.map((tag: string) => tag.trim()) : undefined,
    };

    // 將清理後的數據設置到上下文中
    c.set('validatedData', cleanedData);

    await next();
  } catch (error) {
    console.error('Create request validation error:', error);
    return errorResponse(c, 'Invalid request data', 400);
  }
}

/**
 * QR Code 更新請求驗證
 */
export async function validateUpdateRequest(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const data = await c.req.json();

    // 更新請求可以是部分更新，所以不需要必要字段檢查

    // 字段長度檢查
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim().length === 0) {
        return errorResponse(c, 'Name must be a non-empty string', 400);
      }

      if (data.name.length > 100) {
        return errorResponse(c, 'Name must not exceed 100 characters', 400);
      }
    }

    if (data.description !== undefined) {
      if (data.description !== null && typeof data.description !== 'string') {
        return errorResponse(c, 'Description must be a string or null', 400);
      }

      if (data.description && data.description.length > 500) {
        return errorResponse(c, 'Description must not exceed 500 characters', 400);
      }
    }

    // 內容驗證（如果提供）
    if (data.content !== undefined) {
      if (typeof data.content !== 'string' || data.content.trim().length === 0) {
        return errorResponse(c, 'Content must be a non-empty string', 400);
      }

      if (data.content.length > QR_CODE_DEFAULTS.maxContentLength) {
        return errorResponse(c, `Content too long. Maximum ${QR_CODE_DEFAULTS.maxContentLength} characters allowed`, 400);
      }

      // 如果有現有的 QR Code 數據，驗證新內容是否與類型匹配
      const existingQRCode = c.get('qrCode');
      if (existingQRCode) {
        const contentValidation = QRCodeGenerationService.validateContent(existingQRCode.type, data.content);
        if (!contentValidation.valid) {
          return errorResponse(c, `Invalid content for type ${existingQRCode.type}: ${contentValidation.errors.join(', ')}`, 400);
        }
      }
    }

    // 狀態驗證
    if (data.status !== undefined) {
      const validStatuses = ['active', 'expired', 'disabled', 'pending'];
      if (!validStatuses.includes(data.status)) {
        return errorResponse(c, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }
    }

    // 顏色格式驗證
    if (data.foregroundColor !== undefined && !isValidHexColor(data.foregroundColor)) {
      return errorResponse(c, 'Invalid foreground color format. Must be a valid hex color', 400);
    }

    if (data.backgroundColor !== undefined && !isValidHexColor(data.backgroundColor)) {
      return errorResponse(c, 'Invalid background color format. Must be a valid hex color', 400);
    }

    // 邊框寬度驗證
    if (data.borderWidth !== undefined) {
      if (typeof data.borderWidth !== 'number' || data.borderWidth < 0 || data.borderWidth > 50) {
        return errorResponse(c, 'Border width must be between 0 and 50 pixels', 400);
      }
    }

    // Logo URL 驗證
    if (data.logoUrl !== undefined) {
      if (data.logoUrl !== null && !isValidUrl(data.logoUrl)) {
        return errorResponse(c, 'Invalid logo URL format', 400);
      }
    }

    // 過期時間驗證
    if (data.expiresAt !== undefined) {
      if (data.expiresAt !== null) {
        const expiryDate = new Date(data.expiresAt);
        if (isNaN(expiryDate.getTime())) {
          return errorResponse(c, 'Invalid expiry date format', 400);
        }

        if (expiryDate <= new Date()) {
          return errorResponse(c, 'Expiry date must be in the future', 400);
        }
      }
    }

    // 標籤驗證
    if (data.tags !== undefined) {
      if (data.tags !== null && !Array.isArray(data.tags)) {
        return errorResponse(c, 'Tags must be an array or null', 400);
      }

      if (data.tags && data.tags.length > 10) {
        return errorResponse(c, 'Maximum 10 tags allowed', 400);
      }

      if (data.tags) {
        for (const tag of data.tags) {
          if (typeof tag !== 'string' || tag.trim().length === 0) {
            return errorResponse(c, 'All tags must be non-empty strings', 400);
          }

          if (tag.length > 50) {
            return errorResponse(c, 'Each tag must not exceed 50 characters', 400);
          }
        }
      }
    }

    // 自定義數據驗證
    if (data.customData !== undefined) {
      if (data.customData !== null && typeof data.customData !== 'object') {
        return errorResponse(c, 'Custom data must be an object or null', 400);
      }

      if (data.customData) {
        const customDataString = JSON.stringify(data.customData);
        if (customDataString.length > 5000) {
          return errorResponse(c, 'Custom data too large. Maximum 5000 characters allowed', 400);
        }
      }
    }

    // 清理數據
    const cleanedData: any = {};

    if (data.name !== undefined) cleanedData.name = data.name.trim();
    if (data.description !== undefined) cleanedData.description = data.description ? data.description.trim() : null;
    if (data.content !== undefined) cleanedData.content = data.content.trim();
    if (data.status !== undefined) cleanedData.status = data.status;
    if (data.foregroundColor !== undefined) cleanedData.foregroundColor = data.foregroundColor;
    if (data.backgroundColor !== undefined) cleanedData.backgroundColor = data.backgroundColor;
    if (data.logoUrl !== undefined) cleanedData.logoUrl = data.logoUrl;
    if (data.borderWidth !== undefined) cleanedData.borderWidth = data.borderWidth;
    if (data.expiresAt !== undefined) cleanedData.expiresAt = data.expiresAt;
    if (data.tags !== undefined) cleanedData.tags = data.tags ? data.tags.map((tag: string) => tag.trim()) : null;
    if (data.customData !== undefined) cleanedData.customData = data.customData;

    c.set('validatedData', cleanedData);

    await next();
  } catch (error) {
    console.error('Update request validation error:', error);
    return errorResponse(c, 'Invalid request data', 400);
  }
}

/**
 * 查詢參數驗證
 */
export async function validateQueryParams(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const query = c.req.query();
    const validatedQuery: any = {};

    // 分頁參數驗證
    if (query.page) {
      const page = parseInt(query.page);
      if (isNaN(page) || page < 1) {
        return errorResponse(c, 'Page must be a positive integer', 400);
      }
      validatedQuery.page = page;
    }

    if (query.limit) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return errorResponse(c, 'Limit must be between 1 and 100', 400);
      }
      validatedQuery.limit = limit;
    }

    // 排序參數驗證
    if (query.sortBy) {
      const validSortFields = ['name', 'createdAt', 'scanCount', 'lastScannedAt'];
      if (!validSortFields.includes(query.sortBy)) {
        return errorResponse(c, `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`, 400);
      }
      validatedQuery.sortBy = query.sortBy;
    }

    if (query.sortOrder) {
      const validSortOrders = ['asc', 'desc'];
      if (!validSortOrders.includes(query.sortOrder)) {
        return errorResponse(c, `Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`, 400);
      }
      validatedQuery.sortOrder = query.sortOrder;
    }

    // 過濾參數驗證
    if (query.type) {
      const validTypes = ['url', 'text', 'contact', 'wifi', 'sms', 'email', 'phone', 'event', 'location', 'app', 'social'];
      if (!validTypes.includes(query.type)) {
        return errorResponse(c, `Invalid type filter. Must be one of: ${validTypes.join(', ')}`, 400);
      }
      validatedQuery.type = query.type;
    }

    if (query.status) {
      const validStatuses = ['active', 'expired', 'disabled', 'pending'];
      if (!validStatuses.includes(query.status)) {
        return errorResponse(c, `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`, 400);
      }
      validatedQuery.status = query.status;
    }

    if (query.teamId) {
      const teamId = parseInt(query.teamId);
      if (isNaN(teamId) || teamId < 1) {
        return errorResponse(c, 'TeamId must be a positive integer', 400);
      }
      validatedQuery.teamId = teamId;
    }

    if (query.createdBy) {
      const createdBy = parseInt(query.createdBy);
      if (isNaN(createdBy) || createdBy < 1) {
        return errorResponse(c, 'CreatedBy must be a positive integer', 400);
      }
      validatedQuery.createdBy = createdBy;
    }

    // 搜尋參數驗證
    if (query.search) {
      if (query.search.length > 100) {
        return errorResponse(c, 'Search query must not exceed 100 characters', 400);
      }
      validatedQuery.search = query.search.trim();
    }

    // 標籤過濾驗證
    if (query.tags) {
      const tags = query.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      if (tags.length > 5) {
        return errorResponse(c, 'Maximum 5 tags allowed in filter', 400);
      }
      validatedQuery.tags = tags;
    }

    // 日期範圍驗證
    if (query.createdAfter) {
      const date = new Date(query.createdAfter);
      if (isNaN(date.getTime())) {
        return errorResponse(c, 'Invalid createdAfter date format', 400);
      }
      validatedQuery.createdAfter = date.toISOString();
    }

    if (query.createdBefore) {
      const date = new Date(query.createdBefore);
      if (isNaN(date.getTime())) {
        return errorResponse(c, 'Invalid createdBefore date format', 400);
      }
      validatedQuery.createdBefore = date.toISOString();
    }

    c.set('validatedQuery', validatedQuery);

    await next();
  } catch (error) {
    console.error('Query params validation error:', error);
    return errorResponse(c, 'Invalid query parameters', 400);
  }
}

/**
 * 批次請求驗證
 */
export async function validateBatchRequest(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const data = await c.req.json();

    if (!data.operation) {
      return errorResponse(c, 'Operation is required', 400);
    }

    const validOperations = ['create', 'update', 'delete', 'disable'];
    if (!validOperations.includes(data.operation)) {
      return errorResponse(c, `Invalid operation. Must be one of: ${validOperations.join(', ')}`, 400);
    }

    if (!Array.isArray(data.qrCodes)) {
      return errorResponse(c, 'qrCodes must be an array', 400);
    }

    if (data.qrCodes.length === 0) {
      return errorResponse(c, 'At least one QR code required', 400);
    }

    if (data.qrCodes.length > QR_CODE_DEFAULTS.maxBatchSize) {
      return errorResponse(c, `Maximum ${QR_CODE_DEFAULTS.maxBatchSize} items allowed in batch operation`, 400);
    }

    // 驗證每個項目
    for (let i = 0; i < data.qrCodes.length; i++) {
      const item = data.qrCodes[i];

      if (data.operation === 'create') {
        // 對於創建操作，需要完整驗證
        const requiredFields = ['name', 'type', 'content'];
        const missingFields = requiredFields.filter(field => !item[field]);

        if (missingFields.length > 0) {
          return errorResponse(c, `Item ${i + 1}: Missing required fields: ${missingFields.join(', ')}`, 400);
        }
      } else if (['update', 'delete', 'disable'].includes(data.operation)) {
        // 對於更新/刪除操作，需要 ID
        if (!item.id) {
          return errorResponse(c, `Item ${i + 1}: ID is required for ${data.operation} operation`, 400);
        }
      }
    }

    c.set('validatedData', data);

    await next();
  } catch (error) {
    console.error('Batch request validation error:', error);
    return errorResponse(c, 'Invalid batch request data', 400);
  }
}

// ======================== 輔助函數 ========================

/**
 * 驗證十六進制顏色格式
 */
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * 驗證 URL 格式
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}