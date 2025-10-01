// QRCode 模組處理器主要導出
// 定義所有 QR Code 相關的路由處理器

import { Hono } from 'hono';
import type { Bindings } from '../../../types';
import { qrCodeMainHandler } from '@modules/qrcode/handlers/qrcode-main';

// ======================== 路由器定義 ========================

/**
 * QR Code 主路由器
 * 包含所有 QR Code 相關的端點
 */
export const qrCodeRouter = new Hono<{ Bindings: Bindings }>();

// ======================== 健康檢查 ========================

// 健康檢查端點（公開端點，無需認證）
qrCodeRouter.get('/health', qrCodeMainHandler.health);

// ======================== 基本 CRUD 路由 ========================

// 列出 QR Codes
qrCodeRouter.get('/', qrCodeMainHandler.list);

// 創建新 QR Code
qrCodeRouter.post('/', qrCodeMainHandler.create);

// 獲取特定 QR Code 詳情
qrCodeRouter.get('/:id', qrCodeMainHandler.getById);

// 更新 QR Code
qrCodeRouter.put('/:id', qrCodeMainHandler.update);

// 刪除 QR Code (軟刪除)
qrCodeRouter.delete('/:id', qrCodeMainHandler.delete);

// 檢查 QR Code 是否存在 (HEAD 方法) - Use GET with special header handling
qrCodeRouter.get('/:id/check', qrCodeMainHandler.checkExists);

// 檢查 QR Code 是否存在 (GET 方法，用於直接查詢)
qrCodeRouter.get('/:id/exists', qrCodeMainHandler.checkExists);

// ======================== QR Code 生成和管理 ========================

// 重新生成 QR Code
qrCodeRouter.post('/:id/regenerate', qrCodeMainHandler.regenerate);

// 獲取 QR Code 圖片
qrCodeRouter.get('/:id/image', qrCodeMainHandler.getImage);

// 下載 QR Code（支援多種格式）
qrCodeRouter.get('/:id/download/:format', qrCodeMainHandler.download);

// 預覽 QR Code（不記錄掃描）
qrCodeRouter.get('/:id/preview', qrCodeMainHandler.preview);

// ======================== 狀態管理 ========================

// 啟用 QR Code
qrCodeRouter.post('/:id/enable', qrCodeMainHandler.enable);

// 停用 QR Code
qrCodeRouter.post('/:id/disable', qrCodeMainHandler.disable);

// 設定過期時間
qrCodeRouter.put('/:id/expiry', qrCodeMainHandler.setExpiry);

// ======================== 統計和分析 ========================

// 獲取 QR Code 統計
qrCodeRouter.get('/stats/overview', qrCodeMainHandler.getStats);

// 獲取掃描歷史
qrCodeRouter.get('/:id/scans', qrCodeMainHandler.getScanHistory);

// 記錄掃描（公開端點，無需認證）
qrCodeRouter.post('/:id/scan', qrCodeMainHandler.recordScan);

// 獲取類型分佈
qrCodeRouter.get('/stats/types', qrCodeMainHandler.getTypeDistribution);

// 獲取掃描趨勢
qrCodeRouter.get('/stats/trends', qrCodeMainHandler.getScanTrends);

// ======================== 搜尋和過濾 ========================

// 快速搜尋
qrCodeRouter.get('/search', qrCodeMainHandler.search);

// 進階搜尋
qrCodeRouter.post('/advanced-search', qrCodeMainHandler.advancedSearch);

// 按類型過濾
qrCodeRouter.get('/type/:type', qrCodeMainHandler.getByType);

// 按標籤過濾
qrCodeRouter.get('/tags/:tag', qrCodeMainHandler.getByTag);

// ======================== 批次操作 ========================

// 批次創建
qrCodeRouter.post('/batch/create', qrCodeMainHandler.batchCreate);

// 批次更新
qrCodeRouter.put('/batch/update', qrCodeMainHandler.batchUpdate);

// 批次刪除
qrCodeRouter.delete('/batch/delete', qrCodeMainHandler.batchDelete);

// 批次狀態更新
qrCodeRouter.post('/batch/status', qrCodeMainHandler.batchUpdateStatus);

// ======================== 模板和預設 ========================

// 獲取 QR Code 模板
qrCodeRouter.get('/templates', qrCodeMainHandler.getTemplates);

// 從模板創建
qrCodeRouter.post('/templates/:templateId/create', qrCodeMainHandler.createFromTemplate);

// 保存為模板
qrCodeRouter.post('/:id/save-template', qrCodeMainHandler.saveAsTemplate);

// ======================== 標籤管理 ========================

// 獲取可用標籤
qrCodeRouter.get('/tags/available', qrCodeMainHandler.getAvailableTags);

// 添加標籤到 QR Code
qrCodeRouter.post('/:id/tags', qrCodeMainHandler.addTags);

// 移除 QR Code 標籤
qrCodeRouter.delete('/:id/tags', qrCodeMainHandler.removeTags);

// 獲取標籤使用統計
qrCodeRouter.get('/tags/stats', qrCodeMainHandler.getTagStats);

// ======================== 導出功能 ========================

// 導出 QR Codes 資料
qrCodeRouter.get('/export/data', qrCodeMainHandler.exportData);

// 導出 QR Code 圖片（壓縮檔）
qrCodeRouter.get('/export/images', qrCodeMainHandler.exportImages);

// 導出統計報告
qrCodeRouter.get('/export/report', qrCodeMainHandler.exportReport);

// ======================== 公開端點（無需認證）========================

// 掃描 QR Code（重導向到內容）
qrCodeRouter.get('/scan/:id', qrCodeMainHandler.scanAndRedirect);

// 獲取 QR Code 資訊（公開）
qrCodeRouter.get('/public/:id/info', qrCodeMainHandler.getPublicInfo);

// ======================== 管理員功能 ========================

// 獲取系統 QR Code 統計（管理員）
qrCodeRouter.get('/admin/system-stats', qrCodeMainHandler.getSystemStats);

// 清理過期 QR Codes（管理員）
qrCodeRouter.post('/admin/cleanup', qrCodeMainHandler.cleanupExpired);

// 重建統計快取（管理員）
qrCodeRouter.post('/admin/rebuild-cache', qrCodeMainHandler.rebuildCache);

// ======================== 路由器資訊 ========================

/**
 * QR Code 路由器資訊
 * 包含所有端點的元資料
 */
export const QR_CODE_ROUTER_INFO = {
  basePath: '/api/qr-codes',
  version: '2.0.0',
  description: 'QR Code management and generation API',

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
  }
} as const;

// ======================== 主處理器導出 ========================

export { qrCodeMainHandler } from './qrcode-main';
export type { QRCodeMainHandler } from './qrcode-main';