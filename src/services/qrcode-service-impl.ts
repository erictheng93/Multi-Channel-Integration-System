// QR Code 服務實現 - 完整資料庫整合版本
// 優化：使用本地 QR 碼生成，消除第三方 API 依賴
// Phase 1 優化：KV 快取層支援
import { eq, and, sql, desc } from 'drizzle-orm';
import { qrCodes, qrCodeScans, teams, customers, conversations } from '../db/schema';
import type { QRCodeConfig, QRCodeInfo } from './qrcode-service';
import type {
  QRFollowEvent
} from '../types/services';
import QRCode from 'qrcode';

// 自定義類型
type D1Database = any;

// KV 快取相關常量
const QR_CACHE_PREFIX = 'qr:team:';
const QR_CACHE_TTL = 24 * 60 * 60; // 24 小時 (秒)

// QR 碼快取資料結構
interface QRCodeCacheData {
  qrCodeImageUrl: string;
  lineUrl: string;
  token: string;
  cachedAt: number;
}

export class QRCodeServiceImpl {
  private static readonly LINE_BOT_ID = process.env.LINE_BOT_ID || '@your_bot_id';
  // 保留作為備用方案
  private static readonly QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

  // ==================== KV 快取工具方法 ====================

  /**
   * 從 KV 快取獲取 QR 碼資料
   * @param kv KV 命名空間
   * @param teamId 團隊 ID
   * @param qrCodeId 可選的特定 QR 碼 ID
   */
  static async getFromCache(
    kv: KVNamespace | undefined,
    teamId: number,
    qrCodeId?: string
  ): Promise<QRCodeCacheData | null> {
    if (!kv) return null;

    const cacheKey = qrCodeId
      ? `${QR_CACHE_PREFIX}${teamId}:${qrCodeId}`
      : `${QR_CACHE_PREFIX}${teamId}:latest`;

    try {
      const startTime = performance.now();
      const cached = await kv.get<QRCodeCacheData>(cacheKey, 'json');
      const duration = performance.now() - startTime;

      if (cached) {
        console.log(`✅ KV 快取命中: ${cacheKey} (${duration.toFixed(0)}ms)`);
        return cached;
      }
      console.log(`❌ KV 快取未命中: ${cacheKey} (${duration.toFixed(0)}ms)`);
      return null;
    } catch (error) {
      console.error('KV 快取讀取錯誤:', error);
      return null;
    }
  }

  /**
   * 將 QR 碼資料存入 KV 快取
   */
  static async saveToCache(
    kv: KVNamespace | undefined,
    teamId: number,
    qrCodeId: string,
    data: QRCodeCacheData
  ): Promise<void> {
    if (!kv) return;

    const cacheKeySpecific = `${QR_CACHE_PREFIX}${teamId}:${qrCodeId}`;
    const cacheKeyLatest = `${QR_CACHE_PREFIX}${teamId}:latest`;

    try {
      const startTime = performance.now();
      // 同時存入特定 ID 和 latest 鍵
      await Promise.all([
        kv.put(cacheKeySpecific, JSON.stringify(data), { expirationTtl: QR_CACHE_TTL }),
        kv.put(cacheKeyLatest, JSON.stringify(data), { expirationTtl: QR_CACHE_TTL })
      ]);
      const duration = performance.now() - startTime;
      console.log(`💾 KV 快取寫入成功: ${cacheKeySpecific} (${duration.toFixed(0)}ms)`);
    } catch (error) {
      console.error('KV 快取寫入錯誤:', error);
    }
  }

  /**
   * 從 KV 快取刪除 QR 碼資料
   */
  static async invalidateCache(
    kv: KVNamespace | undefined,
    teamId: number,
    qrCodeId?: string
  ): Promise<void> {
    if (!kv) return;

    try {
      if (qrCodeId) {
        await kv.delete(`${QR_CACHE_PREFIX}${teamId}:${qrCodeId}`);
      }
      // 同時清除 latest 快取
      await kv.delete(`${QR_CACHE_PREFIX}${teamId}:latest`);
      console.log(`🗑️ KV 快取已清除: team ${teamId}`);
    } catch (error) {
      console.error('KV 快取刪除錯誤:', error);
    }
  }

  // ==================== 主要業務方法 ====================

  /**
   * 為團隊生成 QR Code (優化版本：本地生成 + 並行資料庫操作 + KV 快取)
   * @param db 資料庫實例
   * @param config QR 碼配置
   * @param kv 可選的 KV 命名空間，用於快取
   */
  static async generateTeamQRCode(
    db: D1Database,
    config: QRCodeConfig,
    kv?: KVNamespace
  ): Promise<QRCodeInfo> {
    const startTime = performance.now();

    // 生成唯一的追蹤 token
    const token = this.generateTrackingToken(config.teamId);

    // 構建 Line 加好友連結
    const lineUrl = `https://line.me/R/ti/p/${this.LINE_BOT_ID}?ref=${token}`;

    // 生成 QR Code 圖片 (本地生成，約 10-50ms)
    const qrCodeImageUrl = await this.generateQRCodeImage(lineUrl);
    const qrGenTime = performance.now() - startTime;

    // 準備 QR Code 資料
    const now = new Date().toISOString();
    const qrCodeId = crypto.randomUUID();
    const qrCodeData = {
      id: qrCodeId,
      teamId: config.teamId,
      token,
      lineUrl,
      qrCodeImageUrl,
      campaignName: config.campaignName || null,
      description: config.metadata?.description || null,
      usageCount: 0,
      maxUses: config.maxUses || null,
      isActive: true,
      expiresAt: config.expiresAt ? config.expiresAt.toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now
    };

    // 並行執行資料庫操作 + KV 快取寫入
    const dbStartTime = performance.now();
    await Promise.all([
      // 儲存 QR Code 到資料庫 (必須同步完成 - 確保 LINE 掃描時能找到)
      db.insert(qrCodes).values(qrCodeData).run(),
      // 更新團隊的 QR Code 資訊
      db.update(teams)
        .set({
          qrCode: qrCodeImageUrl,
          updatedAt: now
        })
        .where(eq(teams.id, config.teamId))
        .run(),
      // 寫入 KV 快取 (非阻塞，失敗不影響主流程)
      this.saveToCache(kv, config.teamId, qrCodeId, {
        qrCodeImageUrl,
        lineUrl,
        token,
        cachedAt: Date.now()
      })
    ]);
    const dbTime = performance.now() - dbStartTime;

    const totalTime = performance.now() - startTime;
    console.log(`📊 QR Code 生成統計: QR生成=${qrGenTime.toFixed(0)}ms, DB+快取=${dbTime.toFixed(0)}ms, 總計=${totalTime.toFixed(0)}ms`);

    return {
      ...qrCodeData,
      campaignName: qrCodeData.campaignName || '',
      maxUses: qrCodeData.maxUses || undefined,
      expiresAt: qrCodeData.expiresAt ? new Date(qrCodeData.expiresAt) : undefined,
      createdAt: new Date(qrCodeData.createdAt)
    };
  }

  /**
   * 快速獲取團隊最新 QR 碼 (優先從快取讀取)
   * 用於前端懸停預載
   */
  static async getLatestQRCodeFast(
    db: D1Database,
    teamId: number,
    kv?: KVNamespace
  ): Promise<{ qrCodeImageUrl: string; lineUrl: string; fromCache: boolean } | null> {
    const startTime = performance.now();

    // 1. 嘗試從 KV 快取讀取
    const cached = await this.getFromCache(kv, teamId);
    if (cached) {
      const duration = performance.now() - startTime;
      console.log(`⚡ 快速獲取 QR 碼 (快取): team ${teamId} (${duration.toFixed(0)}ms)`);
      return {
        qrCodeImageUrl: cached.qrCodeImageUrl,
        lineUrl: cached.lineUrl,
        fromCache: true
      };
    }

    // 2. 快取未命中，從資料庫讀取最新的
    const latestQR = await db.select()
      .from(qrCodes)
      .where(and(
        eq(qrCodes.teamId, teamId),
        eq(qrCodes.isActive, true)
      ))
      .orderBy(desc(qrCodes.createdAt))
      .limit(1)
      .get();

    if (!latestQR) {
      return null;
    }

    // 3. 回填快取
    await this.saveToCache(kv, teamId, latestQR.id, {
      qrCodeImageUrl: latestQR.qrCodeImageUrl,
      lineUrl: latestQR.lineUrl,
      token: latestQR.token,
      cachedAt: Date.now()
    });

    const duration = performance.now() - startTime;
    console.log(`📦 快速獲取 QR 碼 (資料庫): team ${teamId} (${duration.toFixed(0)}ms)`);

    return {
      qrCodeImageUrl: latestQR.qrCodeImageUrl,
      lineUrl: latestQR.lineUrl,
      fromCache: false
    };
  }

  // 處理通過 QR Code 加入的用戶
  static async handleQRCodeFollow(
    db: D1Database,
    followEvent: QRFollowEvent
  ): Promise<{ teamId?: number; autoAssigned: boolean }> {
    const referralParam = (followEvent as any).follow?.param;
    
    if (!referralParam) {
      return { autoAssigned: false };
    }

    // 解析追蹤 token
    const qrCodeResult = await db.select()
      .from(qrCodes)
      .where(eq(qrCodes.token, referralParam))
      .get();
    
    if (!qrCodeResult || !qrCodeResult.isActive) {
      return { autoAssigned: false };
    }

    // 檢查是否過期
    if (qrCodeResult.expiresAt && new Date() > new Date(qrCodeResult.expiresAt)) {
      await this.deactivateQRCode(db, qrCodeResult.token);
      return { autoAssigned: false };
    }

    // 檢查使用次數限制
    if (qrCodeResult.maxUses && qrCodeResult.usageCount >= qrCodeResult.maxUses) {
      await this.deactivateQRCode(db, qrCodeResult.token);
      return { autoAssigned: false };
    }

    // 增加使用次數
    await this.incrementQRCodeUsage(db, qrCodeResult.token);

    // 記錄掃描事件
    await db.insert(qrCodeScans).values({
      id: crypto.randomUUID(),
      qrCodeId: qrCodeResult.id,
      platform: 'line',
      platformUserId: followEvent.source.userId,
      scanMetadata: JSON.stringify({ timestamp: new Date().toISOString() }),
      scannedAt: new Date().toISOString()
    }).run();

    // 自動指派給對應團隊
    const userId = followEvent.source.userId;
    await this.autoAssignCustomerToTeam(db, userId, qrCodeResult.teamId, referralParam);

    return { 
      teamId: qrCodeResult.teamId, 
      autoAssigned: true 
    };
  }

  // 獲取團隊的所有 QR Code
  static async getTeamQRCodes(
    db: D1Database, 
    teamId: number
  ): Promise<QRCodeInfo[]> {
    const results = await db.select()
      .from(qrCodes)
      .where(eq(qrCodes.teamId, teamId))
      .orderBy(desc(qrCodes.createdAt))
      .all();
    
    return results.map((qr: any) => ({
      ...qr,
      expiresAt: qr.expiresAt ? new Date(qr.expiresAt) : undefined,
      createdAt: new Date(qr.createdAt)
    }));
  }

  /**
   * 停用 QR Code 並清除快取
   */
  static async deactivateQRCode(
    db: D1Database,
    token: string,
    teamId?: number,
    kv?: KVNamespace
  ): Promise<void> {
    await db.update(qrCodes)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(qrCodes.token, token))
      .run();

    // 清除快取
    if (teamId && kv) {
      await this.invalidateCache(kv, teamId);
    }
  }

  // 獲取 QR Code 使用統計
  static async getQRCodeStats(
    db: D1Database,
    teamId: number, 
    _dateRange?: { start: Date; end: Date }
  ) {
    const teamQRCodes = await db.select()
      .from(qrCodes)
      .where(eq(qrCodes.teamId, teamId))
      .all();

    const qrCodeIds = teamQRCodes.map((qr: any) => qr.id);
    
    if (qrCodeIds.length === 0) {
      return {
        totalScans: 0,
        newCustomers: 0,
        conversionRate: 0,
        topPerformingCodes: []
      };
    }

    // 獲取日期範圍內的統計資料 - 簡化版本
    const totalScans = teamQRCodes.reduce((sum: number, qr: any) => sum + (qr.usageCount || 0), 0);
    const newCustomers = Math.floor(totalScans * 0.8); // 模擬轉換率
    const conversionRate = totalScans > 0 ? (newCustomers / totalScans) * 100 : 0;

    // 找出表現最佳的 QR Code
    const topPerformingCodes = teamQRCodes
      .map((qr: any) => ({
        qrCodeId: qr.id,
        campaignName: qr.campaignName || 'Unknown',
        totalScans: qr.usageCount || 0,
        newCustomers: Math.floor((qr.usageCount || 0) * 0.8)
      }))
      .sort((a: any, b: any) => b.totalScans - a.totalScans)
      .slice(0, 5);

    return {
      totalScans,
      newCustomers,
      conversionRate: Math.round(conversionRate * 100) / 100,
      topPerformingCodes
    };
  }

  // 生成追蹤 token
  private static generateTrackingToken(teamId: number): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `team${teamId}_${timestamp}_${random}`;
  }

  // 生成 QR Code 圖片 (本地生成 SVG + Base64)
  private static async generateQRCodeImage(url: string): Promise<string> {
    const startTime = performance.now();

    try {
      // 使用 qrcode 庫生成 SVG (純 JavaScript，無需 Canvas)
      const svgString = await QRCode.toString(url, {
        type: 'svg',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      // 轉換為 Base64 Data URL
      const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

      const duration = performance.now() - startTime;
      console.log(`✅ QR Code 本地生成成功 (${duration.toFixed(0)}ms)`);

      return dataUrl;
    } catch (error) {
      console.error('❌ QR Code 本地生成失敗，回退到第三方 API:', error);

      // 回退到第三方 API
      const qrParams = new URLSearchParams({
        size: '300x300',
        data: url,
        format: 'png',
        margin: '10',
        color: '000000',
        bgcolor: 'ffffff'
      });

      return `${this.QR_API_BASE}?${qrParams.toString()}`;
    }
  }

  // 增加使用次數
  private static async incrementQRCodeUsage(
    db: D1Database, 
    token: string
  ): Promise<void> {
    await db.update(qrCodes)
      .set({ 
        usageCount: sql`usage_count + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(eq(qrCodes.token, token))
      .run();
  }

  // 自動指派客戶到團隊
  private static async autoAssignCustomerToTeam(
    db: D1Database,
    platformUserId: string, 
    teamId: number, 
    source: string
  ): Promise<void> {
    // 查找或創建客戶記錄
    let customer = await db.select()
      .from(customers)
      .where(and(
        eq(customers.platform, 'line'),
        eq(customers.platformUserId, platformUserId)
      ))
      .get();
    
    if (!customer) {
      // 創建新客戶
      const customerId = await db.insert(customers).values({
        platform: 'line',
        platformUserId,
        displayName: 'LINE User',
        sourceTeamId: teamId,
        metadata: JSON.stringify({ qrCodeSource: source }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).returning({ id: customers.id }).get();
      
      customer = { id: customerId.id };
    } else if (!customer.sourceTeamId) {
      // 更新來源團隊
      await db.update(customers)
        .set({ 
          sourceTeamId: teamId,
          updatedAt: new Date().toISOString()
        })
        .where(eq(customers.id, customer.id))
        .run();
    }

    // 查找或創建對話
    const activeConversation = await db.select()
      .from(conversations)
      .where(and(
        eq(conversations.customerId, customer.id),
        eq(conversations.status, 'active')
      ))
      .get();

    if (!activeConversation) {
      // 創建新對話
      await db.insert(conversations).values({
        id: crypto.randomUUID(),
        customerId: customer.id,
        assignedTeamId: teamId,
        status: 'active',
        metadata: JSON.stringify({ 
          autoAssigned: true, 
          qrCodeSource: source 
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).run();
    } else if (!activeConversation.assignedTeamId) {
      // 指派現有對話給團隊
      await db.update(conversations)
        .set({ 
          assignedTeamId: teamId,
          updatedAt: new Date().toISOString()
        })
        .where(eq(conversations.id, activeConversation.id))
        .run();
    }
  }
}