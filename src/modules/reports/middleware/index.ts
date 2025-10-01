// Reports 模組中間件統一導出
// Reports module middleware exports

// 權限控制中間件
export {
  checkReportsAccess,
  checkReportsViewPermission,
  checkReportsGeneratePermission,
  checkReportsDownloadPermission,
  checkReportsDeletePermission,
  checkReportsStatsPermission,
  checkReportsBatchPermission,
  checkScheduledReportsPermission,
  checkSpecialReportTypePermission,
  logReportsOperation
} from './reports-auth';

// 資料驗證中間件
export {
  sanitizeString,
  validateNumberRange,
  validateUUID,
  validateISODate,
  validateEmail,
  validateTimeFormat,
  validateRequestSize,
  validateRateLimit,
  validateReportId,
  validateScheduledReportId,
  validateReportGenerationParams,
  validateReportListQuery,
  validateBatchReportOperation,
  validateScheduledReportData,
  validateReportPreviewRequest
} from './reports-validation';

// 暫時註釋掉中間件組合以避免部署問題
/*
// ======================== 中間件組合 ========================

import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { Bindings } from '@/types';

// 基礎報告訪問中間件組合
export const basicReportsAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    return checkReportsAccess(c, next);
  }
);

// 報告檢視中間件組合
export const reportsViewAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await checkReportsAccess(c, () => Promise.resolve());
    return checkReportsViewPermission(c, next);
  }
);

// 報告生成中間件組合
export const reportsGenerateAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await checkReportsAccess(c, () => Promise.resolve());
    return checkReportsGeneratePermission(c, next);
  }
);

// 報告管理中間件組合
export const reportsManageAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await checkReportsAccess(c, () => Promise.resolve());
    await checkReportsViewPermission(c, () => Promise.resolve());
    return checkReportsDeletePermission(c, next);
  }
);

// 報告統計中間件組合
export const reportsStatsAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await checkReportsAccess(c, () => Promise.resolve());
    return checkReportsStatsPermission(c, next);
  }
);

// 批量操作中間件組合
export const reportsBatchAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await checkReportsAccess(c, () => Promise.resolve());
    return checkReportsBatchPermission(c, next);
  }
);

// 排程報告中間件組合
export const scheduledReportsAccess = createMiddleware<{ Bindings: Bindings }>(
  async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await checkReportsAccess(c, () => Promise.resolve());
    return checkScheduledReportsPermission(c, next);
  }
);
*/

// ======================== 類型導出 ========================

export type {
  ReportsPermissions,
  ReportsAccessScope,
  ReportTypePermissions
} from './reports-auth';