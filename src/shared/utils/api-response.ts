// API 響應標準化工具
import type { Context } from 'hono'
import type { 
  StandardApiResponse, 
  ApiError
} from '../../types/api-standard'
import { HTTP_STATUS, API_ERROR_CODES } from '../../types/api-standard'

// 生成請求 ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// 成功響應
export function successResponse<T>(
  c: Context,
  data: T,
  message?: string,
  status: number = HTTP_STATUS.OK
): Response {
  const response: StandardApiResponse<T> = {
    success: true,
    data,
    message: message || '',
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  }
  
  return c.json(response, status as any)
}

// 分頁響應
export function paginatedResponse<T>(
  c: Context,
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
  },
  message?: string
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit)
  
  const response = {
    success: true,
    data: {
      items: data,
      page: pagination.page,
      pageSize: pagination.limit,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    },
    message,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  }
  
  return c.json(response)
}

// 錯誤響應
export function errorResponse(
  c: Context,
  error: ApiError | string,
  status: number = HTTP_STATUS.BAD_REQUEST
): Response {
  const apiError: ApiError = typeof error === 'string' 
    ? { code: API_ERROR_CODES.INTERNAL_ERROR, message: error }
    : error
  
  const response: StandardApiResponse = {
    success: false,
    error: apiError.message,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  }
  
  return c.json(response, status as any)
}

// 驗證錯誤響應
export function validationErrorResponse(
  c: Context,
  errors: Array<{ field: string; message: string; value?: unknown }>
): Response {
  const response: StandardApiResponse = {
    success: false,
    error: 'Validation failed',
    data: {
      code: API_ERROR_CODES.VALIDATION_ERROR,
      errors
    },
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  }
  
  return c.json(response, HTTP_STATUS.UNPROCESSABLE_ENTITY as any)
}

// 未授權響應
export function unauthorizedResponse(c: Context, message: string = 'Unauthorized'): Response {
  return errorResponse(c, {
    code: API_ERROR_CODES.UNAUTHORIZED,
    message
  }, HTTP_STATUS.UNAUTHORIZED)
}

// 禁止訪問響應
export function forbiddenResponse(c: Context, message: string = 'Forbidden'): Response {
  return errorResponse(c, {
    code: API_ERROR_CODES.FORBIDDEN,
    message
  }, HTTP_STATUS.FORBIDDEN)
}

// 資源未找到響應
export function notFoundResponse(c: Context, resource: string = 'Resource'): Response {
  return errorResponse(c, {
    code: API_ERROR_CODES.NOT_FOUND,
    message: `${resource} not found`
  }, HTTP_STATUS.NOT_FOUND)
}

// 內部錯誤響應
export function internalErrorResponse(c: Context, message: string = 'Internal server error'): Response {
  return errorResponse(c, {
    code: API_ERROR_CODES.INTERNAL_ERROR,
    message
  }, HTTP_STATUS.INTERNAL_SERVER_ERROR)
}

// 錯誤處理中間件
export function handleApiError(error: unknown, c: Context): Response {
  console.error('API Error:', error)
  
  // 根據錯誤類型返回適當的響應
  if (error && typeof error === 'object' && 'name' in error) {
    const apiError = error as { name: string; message?: string; errors?: unknown[] };
    
    if (apiError.name === 'ValidationError') {
      return validationErrorResponse(c, (apiError.errors || []) as { field: string; message: string; value?: unknown; }[])
    }
    
    if (apiError.name === 'UnauthorizedError') {
      return unauthorizedResponse(c, apiError.message || 'Unauthorized')
    }
    
    if (apiError.name === 'ForbiddenError') {
      return forbiddenResponse(c, apiError.message || 'Forbidden')
    }
    
    if (apiError.name === 'NotFoundError') {
      return notFoundResponse(c, apiError.message || 'Not found')
    }
  }
  
  // 默認內部錯誤
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  return internalErrorResponse(c, errorMessage);
}