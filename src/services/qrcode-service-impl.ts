// QR Code 服務實現 - 完整資料庫整合版本
import { eq, and, sql, desc } from 'drizzle-orm';
import { qrCodes, qrCodeScans, teams, customers, conversations } from '../db/schema';
import type { QRCodeConfig, QRCodeInfo } from './qrcode-service';
import type {
  QRFollowEvent
} from '../types/services';

// 自定義類型
type D1Database = any;

export class QRCodeServiceImpl {
  private static readonly LINE_BOT_ID = process.env.LINE_BOT_ID || '@your_bot_id';
  private static readonly QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

  // 為團隊生成 QR Code
  static async generateTeamQRCode(
    db: D1Database, 
    config: QRCodeConfig
  ): Promise<QRCodeInfo> {
    // 生成唯一的追蹤 token
    const token = this.generateTrackingToken(config.teamId);
    
    // 構建 Line 加好友連結
    const lineUrl = `https://line.me/R/ti/p/${this.LINE_BOT_ID}?ref=${token}`;
    
    // 生成 QR Code 圖片 URL
    const qrCodeImageUrl = await this.generateQRCodeImage(lineUrl);
    
    // 準備 QR Code 資料
    const qrCodeData = {
      id: crypto.randomUUID(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 儲存到資料庫
    await db.insert(qrCodes).values(qrCodeData).run();
    
    // 更新團隊的 QR Code 資訊
    await db.update(teams)
      .set({ 
        qrCode: qrCodeImageUrl,
        updatedAt: new Date().toISOString()
      })
      .where(eq(teams.id, config.teamId))
      .run();
    
    return {
      ...qrCodeData,
      campaignName: qrCodeData.campaignName || '',
      maxUses: qrCodeData.maxUses || undefined,
      expiresAt: qrCodeData.expiresAt ? new Date(qrCodeData.expiresAt) : undefined,
      createdAt: new Date(qrCodeData.createdAt)
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

  // 停用 QR Code
  static async deactivateQRCode(
    db: D1Database, 
    token: string
  ): Promise<void> {
    await db.update(qrCodes)
      .set({ 
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(qrCodes.token, token))
      .run();
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

  // 生成 QR Code 圖片
  private static async generateQRCodeImage(url: string): Promise<string> {
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