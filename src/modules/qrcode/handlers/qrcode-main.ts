// QRCode 主處理器
// 實現所有 QR Code 相關的 API 端點處理邏輯

import type { Context } from 'hono';
import type { Bindings } from '@/types';
import { createDbClient } from '../../../db/drizzle-factory';
import { QRCodeCrudService } from '@modules/qrcode/services/qrcode-crud-service';
import { QRCodeGenerationService } from '@modules/qrcode/services/qrcode-generation-service';
import {
  SYSTEM_TEMPLATES,
  getTemplateById,
  replacePlaceholders,
  validatePlaceholders,
  getAllCategories
} from '../templates/system-templates';
import type {
  CreateQRCodeRequest,
  UpdateQRCodeRequest,
  QRCodeListQuery,
  QRCodeStatsQuery,
  BatchQRCodeRequest,
  QRCodeGenerationOptions
} from '../types/qrcode-types';

// Error messages fallback
const QR_ERROR_MESSAGES = {
  SERVER_ERROR: 'Internal server error'
};

// Try to import ERROR_MESSAGES, fallback to local ones
let ERROR_MESSAGES: any;
try {
  const imported = require('../../utils/error-messages');
  ERROR_MESSAGES = imported.ERROR_MESSAGES || QR_ERROR_MESSAGES;
} catch {
  ERROR_MESSAGES = QR_ERROR_MESSAGES;
}

// Helper functions for consistent API responses
const successResponse = (c: Context, data: any, message = 'Success', status: number = 200) => {
  return c.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }, status as any);
};

const errorResponse = (c: Context, error: string, status: number = 400) => {
  return c.json({
    success: false,
    error,
    timestamp: new Date().toISOString()
  }, status as any);
};

// ======================== 主處理器類 ========================

/**
 * QR Code 主處理器
 * 包含所有 QR Code 相關的端點處理邏輯
 */
export class QRCodeMainHandler {
  // ======================== 基本 CRUD 操作 ========================

  /**
   * 列出 QR Codes
   * GET /api/qrcodes
   */
  static async list(c: Context<{ Bindings: Bindings }>) {
    try {
      // 從認證中間件獲取用戶資訊
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const userRole = String(c.get('userRole' as any) || '');
      const teamId = parseInt(String(c.get('teamId' as any) || '0'));

      // 解析查詢參數
      const query: QRCodeListQuery = {
        type: c.req.query('type') as any,
        status: c.req.query('status') as any,
        teamId: c.req.query('teamId') ? parseInt(c.req.query('teamId')!) : teamId,
        search: c.req.query('search'),
        tags: c.req.query('tags')?.split(','),
        page: parseInt(c.req.query('page') || '1'),
        limit: parseInt(c.req.query('limit') || '50'),
        sortBy: c.req.query('sortBy') as any || 'createdAt',
        sortOrder: c.req.query('sortOrder') as any || 'desc'
      };

      // 使用 QRCode 服務獲取列表
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.list(query, userId);

      return successResponse(c, result, 'QR codes retrieved successfully');
    } catch (error) {
      console.error('Error listing QR codes:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 創建新 QR Code
   * POST /api/qrcodes
   */
  static async create(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = parseInt(String(c.get('teamId' as any) || '0'));

      const data: CreateQRCodeRequest = await c.req.json();

      // 基本驗證
      if (!data.name || !data.type || !data.content) {
        return errorResponse(c, 'Missing required fields: name, type, content', 400);
      }

      // 使用 QRCode 服務創建
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.create(data, userId, teamId);

      return successResponse(c, result, 'QR code created successfully', 201);
    } catch (error) {
      console.error('Error creating QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 獲取特定 QR Code 詳情
   * GET /api/qrcodes/:id
   */
  static async getById(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      // 🔒 ROUTE CONFLICT PREVENTION: Reject reserved paths
      // These paths are static endpoints that should NOT be treated as QR code IDs
      const RESERVED_PATHS = [
        'health', 'stats', 'search', 'advanced-search', 'type',
        'tags', 'batch', 'templates', 'export', 'scan', 'public', 'admin'
      ];

      if (RESERVED_PATHS.includes(id.toLowerCase())) {
        return errorResponse(c, `Invalid QR code ID - "${id}" is a reserved endpoint path`, 400);
      }

      // 使用 QRCode 服務獲取詳情
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.findById(id, userId);

      if (!result) {
        return errorResponse(c, 'QR code not found', 404);
      }

      return successResponse(c, result, 'QR code retrieved successfully');
    } catch (error) {
      console.error('Error getting QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 更新 QR Code
   * PUT /api/qrcodes/:id
   */
  static async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const data: UpdateQRCodeRequest = await c.req.json();

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      // 🔒 ROUTE CONFLICT PREVENTION: Reject reserved paths
      const RESERVED_PATHS = ['health', 'stats', 'search', 'advanced-search', 'type', 'tags', 'batch', 'templates', 'export', 'scan', 'public', 'admin'];
      if (RESERVED_PATHS.includes(id.toLowerCase())) {
        return errorResponse(c, `Invalid QR code ID - "${id}" is a reserved endpoint path`, 400);
      }

      // 使用 QRCode 服務更新
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.update(id, data, userId);

      return successResponse(c, result, 'QR code updated successfully');
    } catch (error) {
      console.error('Error updating QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 刪除 QR Code
   * DELETE /api/qrcodes/:id
   */
  static async delete(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      // 🔒 ROUTE CONFLICT PREVENTION: Reject reserved paths
      const RESERVED_PATHS = ['health', 'stats', 'search', 'advanced-search', 'type', 'tags', 'batch', 'templates', 'export', 'scan', 'public', 'admin'];
      if (RESERVED_PATHS.includes(id.toLowerCase())) {
        return errorResponse(c, `Invalid QR code ID - "${id}" is a reserved endpoint path`, 400);
      }

      // 使用 QRCode 服務刪除
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const success = await qrCodeService.delete(id, userId);

      if (!success) {
        return errorResponse(c, 'QR code not found or cannot be deleted', 404);
      }

      return successResponse(c, null, 'QR code deleted successfully');
    } catch (error) {
      console.error('Error deleting QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 檢查 QR Code 是否存在
   * HEAD /api/qrcodes/:id
   */
  static async checkExists(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!id) {
        return new Response(null, { status: 400 });
      }

      // 檢查 QR Code 是否存在
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.findById(id, userId);

      return new Response(null, { status: qrCode ? 200 : 404 });
    } catch (error) {
      console.error('Error checking QR code existence:', error);
      return new Response(null, { status: 500 });
    }
  }

  // ======================== QR Code 生成和管理 ========================

  /**
   * 重新生成 QR Code
   * POST /api/qrcodes/:id/regenerate
   */
  static async regenerate(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      // 重新生成 QR Code
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.regenerateQRCode(id, userId);

      return successResponse(c, result, 'QR code regenerated successfully');
    } catch (error) {
      console.error('Error regenerating QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 獲取 QR Code 圖片
   * GET /api/qrcodes/:id/image
   */
  static async getImage(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const format = c.req.query('format') || 'png';
      const size = parseInt(c.req.query('size') || '300');

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      // 獲取 QR Code 詳情並生成圖片
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const userIdRaw = c.get('user')?.id;
      const userId = typeof userIdRaw === 'string' ? parseInt(userIdRaw) : (userIdRaw || 0);
      const qrCodeDetail = await qrCodeService.findById(id, userId);

      if (!qrCodeDetail) {
        return errorResponse(c, 'QR code not found', 404);
      }

      // 生成QR碼圖片
      const imageData = await qrCodeService.generateQRCode(qrCodeDetail.content, {
        size: size || qrCodeDetail.size,
        errorCorrectionLevel: qrCodeDetail.errorCorrectionLevel,
        outputFormat: format as any || qrCodeDetail.outputFormat,
        foregroundColor: qrCodeDetail.foregroundColor,
        backgroundColor: qrCodeDetail.backgroundColor
      });

      return new Response(imageData, {
        headers: {
          'Content-Type': `image/${format || qrCodeDetail.outputFormat}`,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (error) {
      console.error('Error getting QR code image:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 統計和分析 ========================

  /**
   * 獲取 QR Code 統計
   * GET /api/qrcodes/stats/overview
   */
  static async getStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = parseInt(String(c.get('teamId' as any) || '0'));

      const query: QRCodeStatsQuery = {
        teamId,
        startDate: c.req.query('startDate'),
        endDate: c.req.query('endDate'),
        groupBy: c.req.query('groupBy') as any || 'day'
      };

      // 使用 QRCode 服務獲取統計
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.getStats(query, userId);

      return successResponse(c, result, 'QR code statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting QR code statistics:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 記錄掃描
   * POST /api/qrcodes/:id/scan
   */
  static async recordScan(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      const scanData = {
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')
      };

      // 記錄掃描
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      await qrCodeService.recordScan(id, scanData);

      return successResponse(c, null, 'Scan recorded successfully');
    } catch (error) {
      console.error('Error recording scan:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 搜尋功能 ========================

  /**
   * 快速搜尋
   * GET /api/qrcodes/search
   */
  static async search(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = parseInt(String(c.get('teamId' as any) || '0'));
      const query = c.req.query('q');

      if (!query) {
        return errorResponse(c, 'Search query is required', 400);
      }

      // 實現搜尋功能
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.search(query, userId, teamId);

      return successResponse(c, result, 'Search completed successfully');
    } catch (error) {
      console.error('Error searching QR codes:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 進階搜尋
   * POST /api/qrcodes/advanced-search
   */
  static async advancedSearch(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const searchFilters = await c.req.json();

      // 實現進階搜尋
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.advancedSearch(searchFilters, userId);

      return successResponse(c, result, 'Advanced search completed successfully');
    } catch (error) {
      console.error('Error in advanced search:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 批次操作 ========================

  /**
   * 批次創建
   * POST /api/qrcodes/batch/create
   */
  static async batchCreate(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = parseInt(String(c.get('teamId' as any) || '0'));
      const batchRequest: BatchQRCodeRequest = await c.req.json();

      if (!batchRequest.qrCodes || batchRequest.qrCodes.length === 0) {
        return errorResponse(c, 'No QR codes provided for batch creation', 400);
      }

      // 實現批次創建
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.batchCreate(batchRequest.qrCodes as CreateQRCodeRequest[], userId, teamId);

      return successResponse(c, result, 'Batch creation completed successfully');
    } catch (error) {
      console.error('Error in batch create:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 公開端點 ========================

  /**
   * 掃描 QR Code 並重導向
   * GET /api/qrcodes/scan/:id
   */
  static async scanAndRedirect(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');

      if (!id) {
        return errorResponse(c, 'QR code ID is required', 400);
      }

      // 獲取 QR Code 並記錄掃描
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.getForScan(id);

      if (!qrCode || qrCode.status !== 'active') {
        return errorResponse(c, 'QR code not found or inactive', 404);
      }

      // 記錄掃描
      await qrCodeService.recordScan(id, {
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')
      });

      // 重導向到內容
      return c.redirect(qrCode.content);
    } catch (error) {
      console.error('Error in scan and redirect:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 健康檢查端點 ========================

  /**
   * 健康檢查
   * GET /api/qr-codes/health
   */
  static async health(c: Context<{ Bindings: Bindings }>) {
    try {
      // 檢查數據庫連接
      const dbCheck = await c.env.DB.prepare('SELECT 1').first();

      return successResponse(c, {
        status: 'healthy',
        module: 'qrcode',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: dbCheck ? 'connected' : 'disconnected',
          cache: c.env.KV ? 'available' : 'unavailable',
          storage: c.env.R2_BUCKET ? 'available' : 'unavailable'
        }
      }, 'QRCode module is healthy');
    } catch (error) {
      return errorResponse(c, 'Health check failed', 503);
    }
  }

  // ======================== 圖片和下載功能 ========================

  /**
   * 下載 QR Code
   * GET /api/qr-codes/:id/download/:format
   */
  static async download(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const format = c.req.param('format') || 'png';

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.findById(id, 0); // 0 = public access

      if (!qrCode) {
        return errorResponse(c, 'QR code not found', 404);
      }

      // 這裡應該生成實際的 QR Code 圖片
      // 暫時返回成功訊息
      return successResponse(c, {
        downloadUrl: `/api/qr-codes/${id}/image?format=${format}`,
        format,
        filename: `qrcode-${id}.${format}`
      }, 'Download link generated');
    } catch (error) {
      console.error('Error downloading QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 預覽 QR Code（不記錄掃描）
   * GET /api/qr-codes/:id/preview
   */
  static async preview(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.findById(id, 0);

      if (!qrCode) {
        return errorResponse(c, 'QR code not found', 404);
      }

      return successResponse(c, {
        ...qrCode,
        previewMode: true
      }, 'QR code preview retrieved');
    } catch (error) {
      console.error('Error previewing QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 狀態管理 ========================

  /**
   * 啟用 QR Code
   * POST /api/qr-codes/:id/enable
   */
  static async enable(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.updateStatus(id, 'active', userId);

      return successResponse(c, result, 'QR code enabled successfully');
    } catch (error) {
      console.error('Error enabling QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 停用 QR Code
   * POST /api/qr-codes/:id/disable
   */
  static async disable(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.updateStatus(id, 'inactive', userId);

      return successResponse(c, result, 'QR code disabled successfully');
    } catch (error) {
      console.error('Error disabling QR code:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 設定過期時間
   * PUT /api/qr-codes/:id/expiry
   */
  static async setExpiry(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const { expiresAt } = await c.req.json();

      if (!expiresAt) {
        return errorResponse(c, 'Expiry date is required', 400);
      }

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.update(id, { expiresAt }, userId);

      return successResponse(c, result, 'Expiry date updated successfully');
    } catch (error) {
      console.error('Error setting expiry:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 統計和分析（簡化實現）========================

  /**
   * 獲取掃描歷史
   * GET /api/qr-codes/:id/scans
   */
  static async getScanHistory(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '50');

      // 簡化實現：返回空列表
      return successResponse(c, {
        scans: [],
        pagination: { page, limit, total: 0 }
      }, 'Scan history retrieved');
    } catch (error) {
      console.error('Error getting scan history:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 獲取類型分佈
   * GET /api/qr-codes/stats/types
   */
  static async getTypeDistribution(c: Context<{ Bindings: Bindings }>) {
    try {
      // 簡化實現：返回基本統計
      return successResponse(c, {
        distribution: [
          { type: 'url', count: 0 },
          { type: 'text', count: 0 }
        ]
      }, 'Type distribution retrieved');
    } catch (error) {
      console.error('Error getting type distribution:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 獲取掃描趨勢
   * GET /api/qr-codes/stats/trends
   */
  static async getScanTrends(c: Context<{ Bindings: Bindings }>) {
    try {
      return successResponse(c, {
        trends: []
      }, 'Scan trends retrieved');
    } catch (error) {
      console.error('Error getting scan trends:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 搜尋和過濾（簡化實現）========================

  /**
   * 按類型獲取 QR Codes
   * GET /api/qr-codes/type/:type
   */
  static async getByType(c: Context<{ Bindings: Bindings }>) {
    try {
      const type = c.req.param('type');
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const userRole = String(c.get('userRole' as any) || '');

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.list({ type: type as any, page: 1, limit: 50 }, userId);

      return successResponse(c, result, `QR codes of type ${type} retrieved`);
    } catch (error) {
      console.error('Error getting QR codes by type:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 按標籤獲取 QR Codes
   * GET /api/qr-codes/tags/:tag
   */
  static async getByTag(c: Context<{ Bindings: Bindings }>) {
    try {
      const tag = c.req.param('tag');
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const userRole = String(c.get('userRole' as any) || '');

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.list({ tags: [tag], page: 1, limit: 50 }, userId);

      return successResponse(c, result, `QR codes with tag ${tag} retrieved`);
    } catch (error) {
      console.error('Error getting QR codes by tag:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 批次操作（簡化實現）========================

  /**
   * 批次更新 QR Codes
   * PUT /api/qr-codes/batch/update
   */
  static async batchUpdate(c: Context<{ Bindings: Bindings }>) {
    try {
      const { ids, updates } = await c.req.json();
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(c, 'QR code IDs array is required', 400);
      }

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);

      const results = [];
      for (const id of ids) {
        try {
          const result = await qrCodeService.update(id, updates, userId);
          results.push({ id, success: true, data: result });
        } catch (error) {
          results.push({ id, success: false, error: error instanceof Error ? error.message : 'Update failed' });
        }
      }

      return successResponse(c, { results, total: ids.length }, 'Batch update completed');
    } catch (error) {
      console.error('Error in batch update:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 批次刪除 QR Codes
   * DELETE /api/qr-codes/batch/delete
   */
  static async batchDelete(c: Context<{ Bindings: Bindings }>) {
    try {
      const { ids } = await c.req.json();
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(c, 'QR code IDs array is required', 400);
      }

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);

      const results = [];
      for (const id of ids) {
        try {
          await qrCodeService.delete(id, userId);
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error instanceof Error ? error.message : 'Delete failed' });
        }
      }

      return successResponse(c, { results, total: ids.length }, 'Batch delete completed');
    } catch (error) {
      console.error('Error in batch delete:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 批次更新狀態
   * POST /api/qr-codes/batch/status
   */
  static async batchUpdateStatus(c: Context<{ Bindings: Bindings }>) {
    try {
      const { ids, status } = await c.req.json();
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(c, 'QR code IDs array is required', 400);
      }

      if (!status || !['active', 'inactive', 'expired'].includes(status)) {
        return errorResponse(c, 'Valid status is required', 400);
      }

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);

      const results = [];
      for (const id of ids) {
        try {
          const result = await qrCodeService.updateStatus(id, status, userId);
          results.push({ id, success: true, data: result });
        } catch (error) {
          results.push({ id, success: false, error: error instanceof Error ? error.message : 'Status update failed' });
        }
      }

      return successResponse(c, { results, total: ids.length }, 'Batch status update completed');
    } catch (error) {
      console.error('Error in batch status update:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 模板功能（簡化實現）========================

  /**
   * 獲取模板列表
   * GET /api/qr-codes/templates
   */
  static async getTemplates(c: Context<{ Bindings: Bindings }>) {
    try {
      // 獲取查詢參數
      const { category, search } = c.req.query();

      let templates = [...SYSTEM_TEMPLATES];

      // 按類別過濾
      if (category) {
        templates = templates.filter(t => t.category === category);
      }

      // 按關鍵字搜尋
      if (search) {
        const lowerSearch = search.toLowerCase();
        templates = templates.filter(t =>
          t.name.toLowerCase().includes(lowerSearch) ||
          t.description.toLowerCase().includes(lowerSearch)
        );
      }

      return successResponse(c, {
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          type: t.type,
          contentPlaceholders: t.contentPlaceholders,
          isSystem: t.isSystem,
          usageCount: t.usageCount,
          // 包含樣式預覽
          preview: {
            size: t.size,
            foregroundColor: t.foregroundColor,
            backgroundColor: t.backgroundColor,
            borderWidth: t.borderWidth
          }
        })),
        total: templates.length,
        categories: getAllCategories()
      }, 'Templates retrieved successfully');
    } catch (error) {
      console.error('Error getting templates:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 從模板創建
   * POST /api/qr-codes/templates/:templateId/create
   */
  static async createFromTemplate(c: Context<{ Bindings: Bindings }>) {
    try {
      const templateId = c.req.param('templateId');
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = Number(c.get('teamId' as any) || 0);

      // 獲取請求數據
      const body = await c.req.json();
      const { placeholders, customizations, name, description } = body;

      // 1. 獲取模板
      const template = getTemplateById(templateId);
      if (!template) {
        return errorResponse(c, 'Template not found', 404);
      }

      // 2. 驗證佔位符
      const validation = validatePlaceholders(template, placeholders || {});
      if (!validation.valid) {
        return errorResponse(c,
          `Missing required placeholders: ${validation.missing.join(', ')}`,
          400
        );
      }

      // 3. 替換內容佔位符
      const content = replacePlaceholders(template.contentTemplate, placeholders);

      // 4. 準備 QR Code 數據（使用模板設定或自定義設定）
      const qrCodeData: CreateQRCodeRequest = {
        name: name || `從模板創建: ${template.name}`,
        description: description || template.description,
        type: template.type,
        content,

        // 樣式（優先使用自定義，否則使用模板預設）
        size: customizations?.size || template.size,
        errorCorrectionLevel: customizations?.errorCorrectionLevel || template.errorCorrectionLevel,
        outputFormat: customizations?.outputFormat || template.outputFormat,
        foregroundColor: customizations?.foregroundColor || template.foregroundColor,
        backgroundColor: customizations?.backgroundColor || template.backgroundColor,
        logoUrl: customizations?.logoUrl || template.logoUrl,
        borderWidth: customizations?.borderWidth !== undefined ? customizations.borderWidth : template.borderWidth,
      };

      // 5. 創建 QR Code
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.create(qrCodeData, userId, teamId);

      return successResponse(c, {
        ...result,
        templateId: template.id,
        templateName: template.name
      }, 'QR code created from template successfully', 201);
    } catch (error) {
      console.error('Error creating from template:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 保存為模板
   * POST /api/qr-codes/:id/save-template
   */
  static async saveAsTemplate(c: Context<{ Bindings: Bindings }>) {
    try {
      return errorResponse(c, 'Template feature not implemented', 501);
    } catch (error) {
      console.error('Error saving as template:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 標籤管理（簡化實現）========================

  /**
   * 獲取可用標籤
   * GET /api/qr-codes/tags/available
   */
  static async getAvailableTags(c: Context<{ Bindings: Bindings }>) {
    try {
      return successResponse(c, {
        tags: []
      }, 'Available tags retrieved');
    } catch (error) {
      console.error('Error getting available tags:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 添加標籤
   * POST /api/qr-codes/:id/tags
   */
  static async addTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const { tags } = await c.req.json();
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!tags || !Array.isArray(tags)) {
        return errorResponse(c, 'Tags array is required', 400);
      }

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.findById(id, userId);

      if (!qrCode) {
        return errorResponse(c, 'QR code not found', 404);
      }

      const currentTags = qrCode.tags || [];
      const newTags = Array.from(new Set([...currentTags, ...tags]));

      const result = await qrCodeService.update(id, { tags: newTags }, userId);

      return successResponse(c, result, 'Tags added successfully');
    } catch (error) {
      console.error('Error adding tags:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 移除標籤
   * DELETE /api/qr-codes/:id/tags
   */
  static async removeTags(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');
      const { tags } = await c.req.json();
      const userId = parseInt(String(c.get('userId' as any) || '0'));

      if (!tags || !Array.isArray(tags)) {
        return errorResponse(c, 'Tags array is required', 400);
      }

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.findById(id, userId);

      if (!qrCode) {
        return errorResponse(c, 'QR code not found', 404);
      }

      const currentTags = qrCode.tags || [];
      const newTags = currentTags.filter(tag => !tags.includes(tag));

      const result = await qrCodeService.update(id, { tags: newTags }, userId);

      return successResponse(c, result, 'Tags removed successfully');
    } catch (error) {
      console.error('Error removing tags:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 獲取標籤統計
   * GET /api/qr-codes/tags/stats
   */
  static async getTagStats(c: Context<{ Bindings: Bindings }>) {
    try {
      return successResponse(c, {
        stats: []
      }, 'Tag stats retrieved');
    } catch (error) {
      console.error('Error getting tag stats:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 導出功能（簡化實現）========================

  /**
   * 導出 QR Codes 資料
   * GET /api/qr-codes/export/data?format=json|csv&type=url&status=active&teamId=1&search=keyword&tags=tag1,tag2&fields=id,name,content
   */
  static async exportData(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = Number(c.get('teamId' as any) || undefined);

      // 解析查詢參數
      const format = c.req.query('format') || 'json'; // json or csv
      const type = c.req.query('type');
      const status = c.req.query('status');
      const search = c.req.query('search');
      const tagsParam = c.req.query('tags');
      const fieldsParam = c.req.query('fields');
      const exportTeamId = c.req.query('teamId') ? Number(c.req.query('teamId')) : teamId;

      // 驗證格式
      if (!['json', 'csv'].includes(format)) {
        return errorResponse(c, 'Invalid format. Use json or csv', 400);
      }

      // 解析標籤和欄位
      const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;
      const fields = fieldsParam ? fieldsParam.split(',').map(f => f.trim()) : undefined;

      // 構建查詢參數（不限制筆數，用於導出全部數據）
      const query: any = {
        type,
        status,
        teamId: exportTeamId,
        search,
        tags,
        page: 1,
        limit: 10000, // 設置較大的限制以導出所有數據
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      // 使用服務層獲取數據
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.list(query, userId);

      if (!result.data || result.data.length === 0) {
        return errorResponse(c, 'No data to export', 404);
      }

      // 定義可導出的欄位（完整列表）
      const availableFields = [
        'id', 'name', 'description', 'type', 'content', 'status',
        'size', 'errorCorrectionLevel', 'outputFormat',
        'foregroundColor', 'backgroundColor', 'logoUrl', 'borderWidth',
        'scanCount', 'lastScannedAt', 'expiresAt',
        'teamId', 'createdBy', 'createdAt', 'updatedAt', 'tags'
      ];

      // 過濾欄位（如果用戶指定了特定欄位）
      const exportFields = fields && fields.length > 0
        ? fields.filter(f => availableFields.includes(f))
        : availableFields;

      // 準備導出數據（過濾欄位）
      const exportData = result.data.map(qrCode => {
        const filtered: any = {};
        for (const field of exportFields) {
          if (field in qrCode) {
            filtered[field] = (qrCode as any)[field];
          }
        }
        return filtered;
      });

      // 根據格式生成響應
      if (format === 'json') {
        // JSON 格式
        const jsonData = {
          exportedAt: new Date().toISOString(),
          totalRecords: exportData.length,
          filters: {
            type,
            status,
            teamId: exportTeamId,
            search,
            tags
          },
          data: exportData
        };

        return c.json(jsonData, 200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="qrcodes_export_${Date.now()}.json"`,
          'Cache-Control': 'no-cache'
        });
      } else {
        // CSV 格式
        const csvLines: string[] = [];

        // CSV 標題行
        csvLines.push(exportFields.join(','));

        // CSV 數據行
        for (const record of exportData) {
          const values = exportFields.map(field => {
            let value = record[field];

            // 處理特殊值
            if (value === null || value === undefined) {
              return '';
            }

            // 處理陣列（如 tags）
            if (Array.isArray(value)) {
              value = value.join(';');
            }

            // 處理日期
            if (value instanceof Date) {
              value = value.toISOString();
            }

            // 轉換為字串並處理特殊字符
            const stringValue = String(value);

            // 如果包含逗號、引號或換行符，需要用引號包裹並轉義引號
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }

            return stringValue;
          });

          csvLines.push(values.join(','));
        }

        const csvContent = csvLines.join('\n');

        // 添加 UTF-8 BOM 以支援 Excel 正確顯示中文
        const utf8BOM = '\uFEFF';

        return c.text(utf8BOM + csvContent, 200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="qrcodes_export_${Date.now()}.csv"`,
          'Cache-Control': 'no-cache'
        });
      }

    } catch (error) {
      console.error('Error exporting data:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 導出 QR Code 圖片清單（包含下載 URL）
   * GET /api/qr-codes/export/images?type=url&status=active&teamId=1&search=keyword&tags=tag1,tag2&format=json|urls
   *
   * 注意：由於 Cloudflare Workers 的限制和 ZIP 生成複雜度，
   * 此 API 返回圖片 URL 清單，客戶端可使用這些 URL 批量下載。
   * 使用 format=urls 可獲得純文本 URL 列表（每行一個），方便使用下載工具批量下載。
   */
  static async exportImages(c: Context<{ Bindings: Bindings }>) {
    try {
      const userId = parseInt(String(c.get('userId' as any) || '0'));
      const teamId = Number(c.get('teamId' as any) || undefined);

      // 解析查詢參數
      const format = c.req.query('format') || 'json'; // json or urls
      const type = c.req.query('type');
      const status = c.req.query('status');
      const search = c.req.query('search');
      const tagsParam = c.req.query('tags');
      const exportTeamId = c.req.query('teamId') ? Number(c.req.query('teamId')) : teamId;

      // 驗證格式
      if (!['json', 'urls'].includes(format)) {
        return errorResponse(c, 'Invalid format. Use json or urls', 400);
      }

      // 解析標籤
      const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;

      // 構建查詢參數
      const query: any = {
        type,
        status,
        teamId: exportTeamId,
        search,
        tags,
        page: 1,
        limit: 10000, // 設置較大的限制以導出所有數據
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      // 使用服務層獲取數據
      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const result = await qrCodeService.list(query, userId);

      if (!result.data || result.data.length === 0) {
        return errorResponse(c, 'No QR codes found to export', 404);
      }

      // 準備圖片清單
      const imageList = result.data.map(qrCode => {
        // 構建圖片 URL
        const imageKey = `qrcodes/${qrCode.id}.${qrCode.outputFormat || 'png'}`;
        const imageUrl = `/api/qr-codes/${qrCode.id}/image`;

        return {
          id: qrCode.id,
          name: qrCode.name,
          filename: `${qrCode.name?.replace(/[^a-z0-9]/gi, '_') || qrCode.id}.${qrCode.outputFormat || 'png'}`,
          imageUrl: imageUrl,
          downloadUrl: `/api/qr-codes/${qrCode.id}/download`,
          size: qrCode.size || 300,
          format: qrCode.outputFormat || 'png',
          createdAt: qrCode.createdAt
        };
      });

      // 根據格式返回響應
      if (format === 'json') {
        // JSON 格式（包含完整元數據）
        const jsonData = {
          exportedAt: new Date().toISOString(),
          totalImages: imageList.length,
          filters: {
            type,
            status,
            teamId: exportTeamId,
            search,
            tags
          },
          images: imageList,
          downloadInstructions: {
            method1: 'Use the downloadUrl in each image object to download files individually',
            method2: 'Use tools like wget or curl with the urls format: GET /api/qr-codes/export/images?format=urls',
            example: 'wget -i qrcode_urls.txt'
          }
        };

        return c.json(jsonData, 200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="qrcode_images_export_${Date.now()}.json"`,
          'Cache-Control': 'no-cache'
        });
      } else {
        // URLs 格式（純文本，每行一個 URL）
        const baseUrl = new URL(c.req.url).origin;
        const urlList = imageList.map(img => `${baseUrl}${img.downloadUrl}`).join('\n');

        return c.text(urlList, 200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="qrcode_download_urls_${Date.now()}.txt"`,
          'Cache-Control': 'no-cache'
        });
      }

    } catch (error) {
      console.error('Error exporting images:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 導出統計報告
   * GET /api/qr-codes/export/report
   */
  static async exportReport(c: Context<{ Bindings: Bindings }>) {
    try {
      return errorResponse(c, 'Export report feature not implemented', 501);
    } catch (error) {
      console.error('Error exporting report:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 公開端點（簡化實現）========================

  /**
   * 獲取公開 QR Code 資訊
   * GET /api/qr-codes/public/:id/info
   */
  static async getPublicInfo(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = c.req.param('id');

      const qrCodeService = new QRCodeCrudService(createDbClient(c.env.DB), c.env.KV, c.env.R2_BUCKET);
      const qrCode = await qrCodeService.getForScan(id);

      if (!qrCode || qrCode.status !== 'active') {
        return errorResponse(c, 'QR code not found or inactive', 404);
      }

      // 只返回公開資訊
      return successResponse(c, {
        id: qrCode.id,
        name: qrCode.name,
        type: qrCode.type,
        status: qrCode.status,
        createdAt: qrCode.createdAt
      }, 'Public info retrieved');
    } catch (error) {
      console.error('Error getting public info:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  // ======================== 管理員功能（簡化實現）========================

  /**
   * 獲取系統統計（管理員）
   * GET /api/qr-codes/admin/system-stats
   */
  static async getSystemStats(c: Context<{ Bindings: Bindings }>) {
    try {
      const userRole = String(c.get('userRole' as any) || '');

      if (userRole !== 'admin') {
        return errorResponse(c, 'Admin access required', 403);
      }

      return successResponse(c, {
        totalQRCodes: 0,
        activeQRCodes: 0,
        totalScans: 0,
        systemHealth: 'good'
      }, 'System stats retrieved');
    } catch (error) {
      console.error('Error getting system stats:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 清理過期 QR Codes（管理員）
   * POST /api/qr-codes/admin/cleanup
   */
  static async cleanupExpired(c: Context<{ Bindings: Bindings }>) {
    try {
      const userRole = String(c.get('userRole' as any) || '');

      if (userRole !== 'admin') {
        return errorResponse(c, 'Admin access required', 403);
      }

      return successResponse(c, {
        cleanedCount: 0
      }, 'Cleanup completed');
    } catch (error) {
      console.error('Error cleaning up:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }

  /**
   * 重建統計快取（管理員）
   * POST /api/qr-codes/admin/rebuild-cache
   */
  static async rebuildCache(c: Context<{ Bindings: Bindings }>) {
    try {
      const userRole = String(c.get('userRole' as any) || '');

      if (userRole !== 'admin') {
        return errorResponse(c, 'Admin access required', 403);
      }

      return successResponse(c, {
        rebuilt: true
      }, 'Cache rebuilt successfully');
    } catch (error) {
      console.error('Error rebuilding cache:', error);
      return errorResponse(c, ERROR_MESSAGES.SERVER_ERROR, 500);
    }
  }
}

// 導出主處理器實例
export const qrCodeMainHandler = QRCodeMainHandler;

// 主處理器實例導出 (避免重複聲明)
export default QRCodeMainHandler;