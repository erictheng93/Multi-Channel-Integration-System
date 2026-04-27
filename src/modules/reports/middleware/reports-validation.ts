// Reports 模組資料驗證中間件
// Reports module data validation middleware

import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';
import type {
  ReportGenerationParams,
  ReportListQuery,
  BatchReportOperation,
  ReportType,
  ReportFormat,
  ScheduledReport
} from '../types/report-types';
import { REPORT_TYPE_CONFIG } from '@modules/reports/types/report-types';
import { HTTP_STATUS } from '@/constants/http-status';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';
import { checkSimpleRateLimit } from '@/utils/simple-rate-limiter';

const log = createContextLogger('ReportsValidation');

// ======================== 基礎驗證函數 ========================

/**
 * 清理字符串，移除潛在的XSS攻擊字符
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // 移除尖括號
    .replace(/javascript:/gi, '') // 移除 javascript: 協議
    .replace(/on\w+=/gi, '') // 移除事件處理器
    .substring(0, 2000); // 限制長度
}

/**
 * 驗證數值範圍
 */
export function validateNumberRange(value: any, min: number, max: number): number | null {
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    return null;
  }
  return num;
}

/**
 * 驗證 UUID 格式
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 驗證日期格式 (ISO 8601)
 */
export function validateISODate(dateString: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoDateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * 驗證 email 格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 驗證時間格式 (HH:mm)
 */
export function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

// ======================== 請求大小驗證 ========================

/**
 * 驗證請求大小
 */
export async function validateRequestSize(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const contentLength = c.req.header('content-length');

    if (contentLength && parseInt(contentLength) > 2097152) { // 2MB limit for reports
      return c.json({
        success: false,
        error: 'Request size too large (max 2MB)',
        timestamp: nowISO()
      }, HTTP_STATUS.PAYLOAD_TOO_LARGE);
    }

    return await next();
  } catch (error) {
    log.error('Request size validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Request validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * 驗證速率限制
 */
export async function validateRateLimit(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const result = checkSimpleRateLimit(c, {
      namespace: 'reports',
      windowMs: 60 * 1000,
      maxRequests: 30,
    });

    c.header('X-RateLimit-Limit', result.limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, result.limit - result.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed) {
      log.warn('Reports rate limit exceeded', {
        namespace: 'reports',
        method: c.req.method,
        path: c.req.path,
        clientType: result.clientType,
        clientHash: result.clientHash,
        count: result.count,
        limit: result.limit,
        retryAfterSeconds: result.retryAfterSeconds,
        resetTime: result.resetTime,
      });
      c.header('Retry-After', result.retryAfterSeconds.toString());
      return c.json({
        success: false,
        error: 'Rate limit exceeded',
        timestamp: nowISO()
      }, HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    return await next();
  } catch (error) {
    log.error('Rate limit validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return await next();
  }
}

// ======================== 報告ID驗證 ========================

/**
 * 驗證報告ID參數
 */
export async function validateReportId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const reportId = c.req.param('id');

    if (!reportId) {
      return c.json({
        success: false,
        error: 'Report ID is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!validateUUID(reportId)) {
      return c.json({
        success: false,
        error: 'Invalid report ID format',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    (c as any).set('reportId', reportId);
    return await next();
  } catch (error) {
    log.error('Report ID validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Report ID validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * 驗證排程報告ID參數
 */
export async function validateScheduledReportId(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const scheduledReportId = c.req.param('id');

    if (!scheduledReportId) {
      return c.json({
        success: false,
        error: 'Scheduled report ID is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!validateUUID(scheduledReportId)) {
      return c.json({
        success: false,
        error: 'Invalid scheduled report ID format',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    (c as any).set('scheduledReportId', scheduledReportId);
    return await next();
  } catch (error) {
    log.error('Scheduled report ID validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Scheduled report ID validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 報告生成資料驗證 ========================

/**
 * 驗證報告生成參數
 */
export async function validateReportGenerationParams(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const body = await c.req.json() as ReportGenerationParams;

    // 必填欄位檢查
    if (!body.type) {
      return c.json({
        success: false,
        error: 'Report type is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!Object.keys(REPORT_TYPE_CONFIG).includes(body.type)) {
      return c.json({
        success: false,
        error: 'Invalid report type',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.title || body.title.length < 1) {
      return c.json({
        success: false,
        error: 'Report title is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.format) {
      return c.json({
        success: false,
        error: 'Report format is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查報告類型支持的格式
    const supportedFormats = REPORT_TYPE_CONFIG[body.type].supportedFormats;
    if (!supportedFormats.includes(body.format)) {
      return c.json({
        success: false,
        error: `Format '${body.format}' not supported for report type '${body.type}'`,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.timeRange) {
      return c.json({
        success: false,
        error: 'Time range is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 時間範圍驗證
    const validTimeRanges = [
      'last_24_hours', 'last_7_days', 'last_30_days', 'last_90_days',
      'current_month', 'last_month', 'current_quarter', 'last_quarter',
      'current_year', 'last_year', 'custom'
    ];

    if (!validTimeRanges.includes(body.timeRange)) {
      return c.json({
        success: false,
        error: 'Invalid time range',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 自定義時間範圍驗證
    if (body.timeRange === 'custom') {
      if (!body.startDate || !body.endDate) {
        return c.json({
          success: false,
          error: 'Start date and end date are required for custom time range',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      if (!validateISODate(body.startDate) || !validateISODate(body.endDate)) {
        return c.json({
          success: false,
          error: 'Invalid date format. Use ISO 8601 format',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      const start = new Date(body.startDate);
      const end = new Date(body.endDate);

      if (start >= end) {
        return c.json({
          success: false,
          error: 'Start date must be before end date',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      if (end > new Date()) {
        return c.json({
          success: false,
          error: 'End date cannot be in the future',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 清理字符串欄位
    body.title = sanitizeString(body.title);
    if (body.title.length > 200) {
      return c.json({
        success: false,
        error: 'Title cannot exceed 200 characters',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.description) {
      body.description = sanitizeString(body.description);
      if (body.description.length > 1000) {
        return c.json({
          success: false,
          error: 'Description cannot exceed 1000 characters',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證篩選條件
    if (body.filters) {
      if (body.filters.teamIds && (!Array.isArray(body.filters.teamIds) || body.filters.teamIds.length > 10)) {
        return c.json({
          success: false,
          error: 'teamIds must be an array with maximum 10 items',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      if (body.filters.agentIds && (!Array.isArray(body.filters.agentIds) || body.filters.agentIds.length > 50)) {
        return c.json({
          success: false,
          error: 'agentIds must be an array with maximum 50 items',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      // 驗證優先級篩選
      if (body.filters.priority) {
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        for (const priority of body.filters.priority) {
          if (!validPriorities.includes(priority)) {
            return c.json({
              success: false,
              error: 'Invalid priority value',
              timestamp: nowISO()
            }, HTTP_STATUS.BAD_REQUEST);
          }
        }
      }

      // 驗證標籤
      if (body.filters.tags && (!Array.isArray(body.filters.tags) || body.filters.tags.length > 20)) {
        return c.json({
          success: false,
          error: 'tags must be an array with maximum 20 items',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證選項
    if (body.options) {
      if (body.options.maxRecords && (body.options.maxRecords < 1 || body.options.maxRecords > 100000)) {
        return c.json({
          success: false,
          error: 'maxRecords must be between 1 and 100000',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      if (body.options.chartType) {
        const validChartTypes = ['line', 'bar', 'pie', 'donut', 'area'];
        if (!validChartTypes.includes(body.options.chartType)) {
          return c.json({
            success: false,
            error: 'Invalid chart type',
            timestamp: nowISO()
          }, HTTP_STATUS.BAD_REQUEST);
        }
      }
    }

    (c as any).set('reportParams', body);
    return await next();
  } catch (error) {
    log.error('Report generation params validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 查詢參數驗證 ========================

/**
 * 驗證報告列表查詢參數
 */
export async function validateReportListQuery(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const query: ReportListQuery = {};

    // 報告類型
    const type = c.req.query('type') as ReportType;
    if (type && !Object.keys(REPORT_TYPE_CONFIG).includes(type)) {
      return c.json({
        success: false,
        error: 'Invalid report type',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    if (type) query.type = type;

    // 報告狀態
    const status = c.req.query('status');
    if (status) {
      const validStatuses = ['pending', 'generating', 'completed', 'failed', 'expired'];
      if (!validStatuses.includes(status)) {
        return c.json({
          success: false,
          error: 'Invalid status',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.status = status as any;
    }

    // 報告格式
    const format = c.req.query('format') as ReportFormat;
    if (format) {
      const validFormats = ['json', 'csv', 'excel', 'pdf', 'html'];
      if (!validFormats.includes(format)) {
        return c.json({
          success: false,
          error: 'Invalid format',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.format = format;
    }

    // 創建者
    const createdBy = c.req.query('createdBy');
    if (createdBy) {
      if (!validateUUID(createdBy)) {
        return c.json({
          success: false,
          error: 'Invalid createdBy format',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.createdBy = createdBy;
    }

    // 日期範圍
    const startDate = c.req.query('startDate');
    if (startDate) {
      if (!validateISODate(startDate)) {
        return c.json({
          success: false,
          error: 'Invalid startDate format',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.startDate = startDate;
    }

    const endDate = c.req.query('endDate');
    if (endDate) {
      if (!validateISODate(endDate)) {
        return c.json({
          success: false,
          error: 'Invalid endDate format',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.endDate = endDate;
    }

    // 分頁參數
    const page = validateNumberRange(c.req.query('page') || '1', 1, 1000);
    const pageSize = validateNumberRange(c.req.query('pageSize') || '20', 1, 100);

    if (!page) {
      return c.json({
        success: false,
        error: 'page must be between 1 and 1000',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!pageSize) {
      return c.json({
        success: false,
        error: 'pageSize must be between 1 and 100',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    query.page = page;
    query.pageSize = pageSize;

    // 排序參數
    const sortBy = c.req.query('sortBy');
    if (sortBy) {
      const validSortFields = ['createdAt', 'completedAt', 'title', 'type', 'status', 'format'];
      if (!validSortFields.includes(sortBy)) {
        return c.json({
          success: false,
          error: 'Invalid sortBy field',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
      query.sortBy = sortBy;
    }

    const sortOrder = c.req.query('sortOrder');
    if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
      return c.json({
        success: false,
        error: 'sortOrder must be asc or desc',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }
    if (sortOrder) query.sortOrder = sortOrder as 'asc' | 'desc';

    (c as any).set('reportQuery', query);
    return await next();
  } catch (error) {
    log.error('Report list query validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Query validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 批量操作驗證 ========================

/**
 * 驗證批量報告操作資料
 */
export async function validateBatchReportOperation(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const body = await c.req.json() as BatchReportOperation;

    if (!body.reportIds || !Array.isArray(body.reportIds) || body.reportIds.length === 0) {
      return c.json({
        success: false,
        error: 'reportIds must be a non-empty array',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.reportIds.length > 50) {
      return c.json({
        success: false,
        error: 'Cannot process more than 50 reports at once',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證所有報告ID格式
    for (const reportId of body.reportIds) {
      if (!validateUUID(reportId)) {
        return c.json({
          success: false,
          error: `Invalid report ID format: ${reportId}`,
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    if (!['delete', 'regenerate', 'download', 'export'].includes(body.action)) {
      return c.json({
        success: false,
        error: 'action must be one of: delete, regenerate, download, export',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證操作相關選項
    if (body.options) {
      if (body.options.format) {
        const validFormats = ['json', 'csv', 'excel', 'pdf', 'html'];
        if (!validFormats.includes(body.options.format)) {
          return c.json({
            success: false,
            error: 'Invalid format in options',
            timestamp: nowISO()
          }, HTTP_STATUS.BAD_REQUEST);
        }
      }

      if (typeof body.options.mergeReports !== 'undefined' && typeof body.options.mergeReports !== 'boolean') {
        return c.json({
          success: false,
          error: 'mergeReports must be a boolean',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    (c as any).set('batchOperation', body);
    return await next();
  } catch (error) {
    log.error('Batch operation validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 排程報告驗證 ========================

/**
 * 驗證排程報告資料
 */
export async function validateScheduledReportData(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const body = await c.req.json() as Partial<ScheduledReport>;

    // 必填欄位檢查
    if (!body.name || body.name.length < 1) {
      return c.json({
        success: false,
        error: 'Report name is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.type || !Object.keys(REPORT_TYPE_CONFIG).includes(body.type)) {
      return c.json({
        success: false,
        error: 'Valid report type is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.format || !REPORT_TYPE_CONFIG[body.type].supportedFormats.includes(body.format)) {
      return c.json({
        success: false,
        error: `Format '${body.format}' not supported for report type '${body.type}'`,
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證排程配置
    if (!body.schedule) {
      return c.json({
        success: false,
        error: 'Schedule configuration is required',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(body.schedule.frequency)) {
      return c.json({
        success: false,
        error: 'Invalid schedule frequency',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!validateTimeFormat(body.schedule.time)) {
      return c.json({
        success: false,
        error: 'Invalid time format. Use HH:mm format',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 週頻率需要指定星期幾
    if (body.schedule.frequency === 'weekly') {
      if (body.schedule.dayOfWeek === undefined || body.schedule.dayOfWeek < 0 || body.schedule.dayOfWeek > 6) {
        return c.json({
          success: false,
          error: 'dayOfWeek must be between 0 and 6 for weekly schedule',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 月頻率需要指定日期
    if (body.schedule.frequency === 'monthly') {
      if (body.schedule.dayOfMonth === undefined || body.schedule.dayOfMonth < 1 || body.schedule.dayOfMonth > 31) {
        return c.json({
          success: false,
          error: 'dayOfMonth must be between 1 and 31 for monthly schedule',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 清理字符串欄位
    body.name = sanitizeString(body.name);
    if (body.name.length > 200) {
      return c.json({
        success: false,
        error: 'Name cannot exceed 200 characters',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.description) {
      body.description = sanitizeString(body.description);
      if (body.description.length > 1000) {
        return c.json({
          success: false,
          error: 'Description cannot exceed 1000 characters',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // 驗證接收者
    if (body.recipients && body.recipients.length > 0) {
      if (body.recipients.length > 20) {
        return c.json({
          success: false,
          error: 'Cannot have more than 20 recipients',
          timestamp: nowISO()
        }, HTTP_STATUS.BAD_REQUEST);
      }

      for (const recipient of body.recipients) {
        if (!validateEmail(recipient.email)) {
          return c.json({
            success: false,
            error: `Invalid email format: ${recipient.email}`,
            timestamp: nowISO()
          }, HTTP_STATUS.BAD_REQUEST);
        }

        if (!recipient.name || recipient.name.length < 1) {
          return c.json({
            success: false,
            error: 'Recipient name is required',
            timestamp: nowISO()
          }, HTTP_STATUS.BAD_REQUEST);
        }
      }
    }

    (c as any).set('scheduledReportData', body);
    return await next();
  } catch (error) {
    log.error('Scheduled report data validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}

// ======================== 報告預覽驗證 ========================

/**
 * 驗證報告預覽請求
 */
export async function validateReportPreviewRequest(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const body = await c.req.json() as ReportGenerationParams;

    // 重用報告生成參數驗證，但不需要所有欄位都完整
    if (!body.type || !Object.keys(REPORT_TYPE_CONFIG).includes(body.type)) {
      return c.json({
        success: false,
        error: 'Valid report type is required for preview',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!body.timeRange) {
      return c.json({
        success: false,
        error: 'Time range is required for preview',
        timestamp: nowISO()
      }, HTTP_STATUS.BAD_REQUEST);
    }

    (c as any).set('previewParams', body);
    return await next();
  } catch (error) {
    log.error('Report preview validation error:', {}, error instanceof Error ? error : new Error(String(error)));
    return c.json({
      success: false,
      error: 'Invalid JSON data or validation failed',
      timestamp: nowISO()
    }, HTTP_STATUS.BAD_REQUEST);
  }
}
