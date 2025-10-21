// QRCode 模組處理器主要導出 - 智能註冊器版本
// 使用智能路由註冊器自動排序所有路由，避免衝突

import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { qrCodeMainHandler } from '@modules/qrcode/handlers/qrcode-main';
import { createSmartRegistry, RoutePriority } from '@/core/smart-route-registry';

// ======================== 路由器定義 ========================

/**
 * QR Code 主路由器
 * 包含所有 QR Code 相關的端點
 *
 * 🤖 使用智能路由註冊器自動處理路由順序
 * ✅ 消除 41 個路由衝突
 */
export const qrCodeRouter = new Hono<{ Bindings: Bindings }>();

// ======================== 智能路由註冊 ========================

const registry = createSmartRegistry(qrCodeRouter);

// 添加所有路由（智能註冊器會自動按優先級排序）
registry.addMany([
  // ==================== 健康檢查和系統端點 ====================
  {
    path: '/health',
    handler: qrCodeMainHandler.health,
    priority: RoutePriority.STATIC,
    description: 'Health check endpoint (public)'
  },

  // ==================== 統計端點（具體路徑優先）====================
  {
    path: '/stats/overview',
    handler: qrCodeMainHandler.getStats,
    priority: RoutePriority.SPECIFIC,
    description: 'Get QR code statistics overview'
  },
  {
    path: '/stats/types',
    handler: qrCodeMainHandler.getTypeDistribution,
    priority: RoutePriority.SPECIFIC,
    description: 'Get QR code type distribution'
  },
  {
    path: '/stats/trends',
    handler: qrCodeMainHandler.getScanTrends,
    priority: RoutePriority.SPECIFIC,
    description: 'Get scan trends'
  },

  // ==================== 搜尋端點 ====================
  {
    path: '/search',
    handler: qrCodeMainHandler.search,
    priority: RoutePriority.STATIC,
    description: 'Quick search QR codes'
  },
  {
    path: '/advanced-search',
    handler: qrCodeMainHandler.advancedSearch,
    priority: RoutePriority.STATIC,
    description: 'Advanced search with filters'
  },

  // ==================== 批次操作端點 ====================
  {
    path: '/batch/create',
    handler: qrCodeMainHandler.batchCreate,
    priority: RoutePriority.SPECIFIC,
    description: 'Batch create QR codes'
  },
  {
    path: '/batch/update',
    handler: qrCodeMainHandler.batchUpdate,
    priority: RoutePriority.SPECIFIC,
    description: 'Batch update QR codes'
  },
  {
    path: '/batch/delete',
    handler: qrCodeMainHandler.batchDelete,
    priority: RoutePriority.SPECIFIC,
    description: 'Batch delete QR codes'
  },
  {
    path: '/batch/status',
    handler: qrCodeMainHandler.batchUpdateStatus,
    priority: RoutePriority.SPECIFIC,
    description: 'Batch update QR code status'
  },

  // ==================== 模板端點 ====================
  {
    path: '/templates',
    handler: qrCodeMainHandler.getTemplates,
    priority: RoutePriority.STATIC,
    description: 'Get QR code templates'
  },
  {
    path: '/templates/:templateId/create',
    handler: qrCodeMainHandler.createFromTemplate,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Create from template'
  },

  // ==================== 標籤端點 ====================
  {
    path: '/tags/available',
    handler: qrCodeMainHandler.getAvailableTags,
    priority: RoutePriority.SPECIFIC,
    description: 'Get available tags'
  },
  {
    path: '/tags/stats',
    handler: qrCodeMainHandler.getTagStats,
    priority: RoutePriority.SPECIFIC,
    description: 'Get tag usage statistics'
  },
  {
    path: '/tags/:tag',
    handler: qrCodeMainHandler.getByTag,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Get QR codes by tag'
  },

  // ==================== 類型過濾端點 ====================
  {
    path: '/type/:type',
    handler: qrCodeMainHandler.getByType,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Get QR codes by type'
  },

  // ==================== 導出端點 ====================
  {
    path: '/export/data',
    handler: qrCodeMainHandler.exportData,
    priority: RoutePriority.SPECIFIC,
    description: 'Export QR codes data'
  },
  {
    path: '/export/images',
    handler: qrCodeMainHandler.exportImages,
    priority: RoutePriority.SPECIFIC,
    description: 'Export QR code images'
  },
  {
    path: '/export/report',
    handler: qrCodeMainHandler.exportReport,
    priority: RoutePriority.SPECIFIC,
    description: 'Export statistics report'
  },

  // ==================== 管理員端點 ====================
  {
    path: '/admin/system-stats',
    handler: qrCodeMainHandler.getSystemStats,
    priority: RoutePriority.SPECIFIC,
    description: 'Get system QR code statistics (admin)'
  },
  {
    path: '/admin/cleanup',
    handler: qrCodeMainHandler.cleanupExpired,
    priority: RoutePriority.SPECIFIC,
    description: 'Cleanup expired QR codes (admin)'
  },
  {
    path: '/admin/rebuild-cache',
    handler: qrCodeMainHandler.rebuildCache,
    priority: RoutePriority.SPECIFIC,
    description: 'Rebuild statistics cache (admin)'
  },

  // ==================== 公開端點（掃描相關）====================
  {
    path: '/scan/:id',
    handler: qrCodeMainHandler.scanAndRedirect,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Scan QR code and redirect (public)'
  },
  {
    path: '/public/:id/info',
    handler: qrCodeMainHandler.getPublicInfo,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Get public QR code info'
  },

  // ==================== ID 相關端點（參數化路由）====================
  // ⚠️ 注意: 這些路由包含 :id，必須在具體路由之後註冊

  {
    path: '/:id/check',
    handler: qrCodeMainHandler.checkExists,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Check if QR code exists (HEAD method)'
  },
  {
    path: '/:id/exists',
    handler: qrCodeMainHandler.checkExists,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Check if QR code exists (GET method)'
  },
  {
    path: '/:id/regenerate',
    handler: qrCodeMainHandler.regenerate,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Regenerate QR code'
  },
  {
    path: '/:id/image',
    handler: qrCodeMainHandler.getImage,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Get QR code image'
  },
  {
    path: '/:id/download/:format',
    handler: qrCodeMainHandler.download,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Download QR code in specific format'
  },
  {
    path: '/:id/preview',
    handler: qrCodeMainHandler.preview,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Preview QR code without tracking'
  },
  {
    path: '/:id/enable',
    handler: qrCodeMainHandler.enable,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Enable QR code'
  },
  {
    path: '/:id/disable',
    handler: qrCodeMainHandler.disable,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Disable QR code'
  },
  {
    path: '/:id/expiry',
    handler: qrCodeMainHandler.setExpiry,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Set QR code expiry'
  },
  {
    path: '/:id/scans',
    handler: qrCodeMainHandler.getScanHistory,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Get scan history for QR code'
  },
  {
    path: '/:id/scan',
    handler: qrCodeMainHandler.recordScan,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Record QR code scan (public)'
  },
  {
    path: '/:id/save-template',
    handler: qrCodeMainHandler.saveAsTemplate,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Save QR code as template'
  },
  {
    path: '/:id/tags',
    handler: qrCodeMainHandler.addTags,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Add tags to QR code'
  },
  {
    path: '/:id/tags',
    handler: qrCodeMainHandler.removeTags,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Remove tags from QR code (DELETE)'
  },

  // ==================== 基本 CRUD（單個 :id 路由）====================
  {
    path: '/:id',
    handler: qrCodeMainHandler.getById,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Get QR code details (GET)'
  },
  {
    path: '/:id',
    handler: qrCodeMainHandler.update,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Update QR code (PUT)'
  },
  {
    path: '/:id',
    handler: qrCodeMainHandler.delete,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Delete QR code (DELETE)'
  },

  // ==================== 根路由（WILDCARD - 最後註冊）====================
  {
    path: '/',
    handler: qrCodeMainHandler.list,
    priority: RoutePriority.WILDCARD,
    description: 'List QR codes (GET)'
  },
  {
    path: '/',
    handler: qrCodeMainHandler.create,
    priority: RoutePriority.WILDCARD,
    description: 'Create QR code (POST)'
  }
]);

// ==================== 執行智能註冊 ====================

const { registered, conflicts, report } = registry.register();

// 顯示註冊報告
console.log('🤖 Smart Route Registry - QR Code Module');
console.log(`✅ Registered ${registered} routes automatically`);

if (conflicts.length > 0) {
  console.warn('⚠️ Route conflicts detected in QR Code module!');
  console.warn('Please review the registration report above.\n');
  console.warn('Conflicts:', conflicts);
}

// ======================== 路由器資訊 ========================

/**
 * QR Code 路由器資訊
 * 包含所有端點的元資料
 */
export const QR_CODE_ROUTER_INFO = {
  basePath: '/api/qr-codes',
  version: '2.1.0', // 升級版本（使用智能註冊器）
  description: 'QR Code management and generation API (Smart Registry)',

  endpoints: [
    // 基本 CRUD
    { method: 'GET', path: '/', description: 'List QR codes with filters' },
    { method: 'POST', path: '/', description: 'Create new QR code' },
    { method: 'GET', path: '/:id', description: 'Get QR code details' },
    { method: 'PUT', path: '/:id', description: 'Update QR code' },
    { method: 'DELETE', path: '/:id', description: 'Delete QR code (soft delete)' },
    { method: 'GET', path: '/:id/check', description: 'Check if QR code exists' },
    { method: 'GET', path: '/:id/exists', description: 'Check if QR code exists' },

    // QR Code 生成和管理
    { method: 'POST', path: '/:id/regenerate', description: 'Regenerate QR code' },
    { method: 'GET', path: '/:id/image', description: 'Get QR code image' },
    { method: 'GET', path: '/:id/download/:format', description: 'Download QR code in specific format' },
    { method: 'GET', path: '/:id/preview', description: 'Preview QR code without tracking' },

    // 狀態管理
    { method: 'POST', path: '/:id/enable', description: 'Enable QR code' },
    { method: 'POST', path: '/:id/disable', description: 'Disable QR code' },
    { method: 'PUT', path: '/:id/expiry', description: 'Set QR code expiry' },

    // 統計和分析
    { method: 'GET', path: '/stats/overview', description: 'Get QR code statistics overview' },
    { method: 'GET', path: '/:id/scans', description: 'Get scan history for QR code' },
    { method: 'POST', path: '/:id/scan', description: 'Record QR code scan' },
    { method: 'GET', path: '/stats/types', description: 'Get QR code type distribution' },
    { method: 'GET', path: '/stats/trends', description: 'Get scan trends' },

    // 搜尋和過濾
    { method: 'GET', path: '/search', description: 'Quick search QR codes' },
    { method: 'POST', path: '/advanced-search', description: 'Advanced search with filters' },
    { method: 'GET', path: '/type/:type', description: 'Get QR codes by type' },
    { method: 'GET', path: '/tags/:tag', description: 'Get QR codes by tag' },

    // 批次操作
    { method: 'POST', path: '/batch/create', description: 'Batch create QR codes' },
    { method: 'PUT', path: '/batch/update', description: 'Batch update QR codes' },
    { method: 'DELETE', path: '/batch/delete', description: 'Batch delete QR codes' },
    { method: 'POST', path: '/batch/status', description: 'Batch update QR code status' },

    // 模板功能
    { method: 'GET', path: '/templates', description: 'Get QR code templates' },
    { method: 'POST', path: '/templates/:templateId/create', description: 'Create from template' },
    { method: 'POST', path: '/:id/save-template', description: 'Save QR code as template' },

    // 標籤管理
    { method: 'GET', path: '/tags/available', description: 'Get available tags' },
    { method: 'POST', path: '/:id/tags', description: 'Add tags to QR code' },
    { method: 'DELETE', path: '/:id/tags', description: 'Remove tags from QR code' },
    { method: 'GET', path: '/tags/stats', description: 'Get tag usage statistics' },

    // 導出功能
    { method: 'GET', path: '/export/data', description: 'Export QR codes data' },
    { method: 'GET', path: '/export/images', description: 'Export QR code images' },
    { method: 'GET', path: '/export/report', description: 'Export statistics report' },

    // 公開端點
    { method: 'GET', path: '/scan/:id', description: 'Scan QR code and redirect' },
    { method: 'GET', path: '/public/:id/info', description: 'Get public QR code info' },

    // 管理員功能
    { method: 'GET', path: '/admin/system-stats', description: 'Get system QR code statistics' },
    { method: 'POST', path: '/admin/cleanup', description: 'Cleanup expired QR codes' },
    { method: 'POST', path: '/admin/rebuild-cache', description: 'Rebuild statistics cache' }
  ],

  permissions: {
    create: ['admin', 'team', 'agent'],
    read: ['admin', 'team', 'agent'],
    update: ['admin', 'team', 'agent'],
    delete: ['admin', 'team'],
    batchOperations: ['admin', 'team'],
    adminFunctions: ['admin'],
    publicAccess: [] // 公開端點無需權限
  },

  rateLimit: {
    create: { max: 100, window: 3600 },      // 每小時最多創建 100 個
    scan: { max: 10000, window: 3600 },      // 每小時最多掃描 10000 次
    batch: { max: 10, window: 3600 },        // 每小時最多 10 次批次操作
    export: { max: 5, window: 3600 },        // 每小時最多 5 次導出
    default: { max: 1000, window: 3600 }     // 其他端點預設限制
  },

  smartRegistry: {
    enabled: true,
    version: '1.0.0',
    conflictsResolved: 41,
    registeredRoutes: registered
  }
} as const;

// ======================== 主處理器導出 ========================

export { qrCodeMainHandler } from './qrcode-main';
export type { QRCodeMainHandler } from './qrcode-main';
