// QR Code Service for Teams
// 團隊 QR Code 服務
// Phase 2 優化：雙向同步機制 - teams.qrCode 欄位同步

import { drizzle } from 'drizzle-orm/d1';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('TeamQRService')

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { teams } from '@/db/schema';
import { QRCodeServiceImpl } from '@/services/qrcode-service-impl';
import type { QRCodeMetadata } from '@/types/services';
import { nowISO } from '@/utils/timestamp'

export class TeamQRService {
  private db: DrizzleD1Database;
  private kv?: KVNamespace;
  private lineBotId?: string;
  private frontendUrl?: string;

  constructor(database: D1Database, kv?: KVNamespace, lineBotId?: string, frontendUrl?: string) {
    this.db = drizzle(database);
    this.kv = kv;
    this.lineBotId = lineBotId;
    this.frontendUrl = frontendUrl;
  }

  /**
   * 生成團隊 QR 碼
   * Phase 2 優化：生成後同步到 teams.qrCode 欄位
   * LIFF 方案：QR Code 指向 LIFF 頁面，確保 100% 團隊綁定成功率
   */
  async generateTeamQRCode(params: {
    teamId: number;
    campaignName?: string;
    description?: string;
    expiresAt?: Date;
    maxUses?: number;
    metadata?: QRCodeMetadata;
  }) {
    // 1. 生成 QR Code 並存入 qr_codes 表
    const qrCodeInfo = await QRCodeServiceImpl.generateTeamQRCode(
      this.db,
      {
        teamId: params.teamId,
        ...(params.campaignName && { campaignName: params.campaignName }),
        ...(params.expiresAt && { expiresAt: params.expiresAt }),
        ...(params.maxUses && { maxUses: params.maxUses }),
        metadata: params.metadata || ({
          description: params.description || '',
          teamId: params.teamId,
          createdBy: 0
        } as QRCodeMetadata)
      },
      this.kv, // 傳遞 KV 命名空間
      this.lineBotId, // 傳遞 LINE Bot ID
      this.frontendUrl // 傳遞前端 URL（用於 LIFF 方案）
    );

    // 2. 同步更新 teams.qrCode 欄位 (雙向同步機制)
    try {
      await this.db
        .update(teams)
        .set({
          qrCode: qrCodeInfo.qrCodeImageUrl,
          updatedAt: nowISO()
        })
        .where(eq(teams.id, params.teamId));

      log.info(`QR Code synced to teams table: teamId=${params.teamId}`);
    } catch (error) {
      log.error(`Sync QR Code failed: teamId=${params.teamId}`, {}, error as Error);
      // 不拋出錯誤，因為 QR Code 已成功生成並存入 qr_codes 表
      // 後續可透過資料修復腳本補救
    }

    return {
      id: qrCodeInfo.id,
      qrCode: qrCodeInfo.qrCodeImageUrl,
      lineUrl: qrCodeInfo.lineUrl,
      token: qrCodeInfo.token,
      campaignName: qrCodeInfo.campaignName,
      expiresAt: qrCodeInfo.expiresAt,
      maxUses: qrCodeInfo.maxUses,
      usageCount: qrCodeInfo.usageCount
    };
  }

  /**
   * 快速獲取團隊最新 QR 碼 (優先從快取讀取)
   * 用於前端懸停預載
   */
  async getLatestQRCodeFast(teamId: number) {
    return await QRCodeServiceImpl.getLatestQRCodeFast(this.db, teamId, this.kv);
  }

  /**
   * 獲取團隊所有 QR 碼
   */
  async getTeamQRCodes(teamId: number) {
    const qrCodes = await QRCodeServiceImpl.getTeamQRCodes(this.db, teamId);

    return qrCodes.map(qr => ({
      id: qr.id,
      qrCode: qr.qrCodeImageUrl,
      lineUrl: qr.lineUrl,
      token: qr.token,
      campaignName: qr.campaignName,
      usageCount: qr.usageCount,
      maxUses: qr.maxUses,
      isActive: qr.isActive,
      expiresAt: qr.expiresAt,
      createdAt: qr.createdAt
    }));
  }

  /**
   * 停用 QR 碼
   * Phase 2 優化：停用後清除 teams.qrCode 欄位並更新到最新活躍的 QR Code
   */
  async deactivateQRCode(teamId: number, qrCodeId: string): Promise<void> {
    // First, get the QR code to verify ownership and get token
    const qrCodes = await QRCodeServiceImpl.getTeamQRCodes(this.db, teamId);
    const qrCode = qrCodes.find(qr => qr.id === qrCodeId);

    if (!qrCode) {
      throw new Error('QR code not found or does not belong to this team');
    }

    // Deactivate using the token and invalidate cache
    await QRCodeServiceImpl.deactivateQRCode(this.db, qrCode.token, teamId, this.kv);

    // 同步更新 teams.qrCode 欄位 (雙向同步機制)
    try {
      // 查找該團隊其他還活躍的 QR Code
      const remainingQRCodes = qrCodes.filter(qr => qr.id !== qrCodeId && qr.isActive);

      if (remainingQRCodes.length > 0) {
        // 如果還有其他活躍的 QR Code，更新為最新的
        const latestQR = remainingQRCodes.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        await this.db
          .update(teams)
          .set({
            qrCode: latestQR.qrCodeImageUrl,
            updatedAt: nowISO()
          })
          .where(eq(teams.id, teamId));

        log.info(`Updated teams.qrCode to latest active QR Code: teamId=${teamId}`);
      } else {
        // 如果沒有其他活躍的 QR Code，清空欄位
        await this.db
          .update(teams)
          .set({
            qrCode: null,
            updatedAt: nowISO()
          })
          .where(eq(teams.id, teamId));

        log.info(`Cleared teams.qrCode: teamId=${teamId} (no active QR Code)`);
      }
    } catch (error) {
      log.error(`Sync deactivate QR Code failed: teamId=${teamId}`, {}, error as Error);
    }
  }

  /**
   * 生成測試 QR 碼 (僅供測試用途)
   */
  async generateTestQRCode() {
    return {
      id: 'test-123',
      qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://example.com&format=png',
      message: 'Test QR code generated successfully'
    };
  }
}