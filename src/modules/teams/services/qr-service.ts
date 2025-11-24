// QR Code Service for Teams
// 團隊 QR Code 服務

import { createDbClient } from '../../../db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { QRCodeServiceImpl } from '@/services/qrcode-service-impl';
import type { QRCodeMetadata } from '@/types/services';

export class TeamQRService {
  private db: DrizzleD1Database;

  constructor(database: D1Database) {
    this.db = drizzle(database);
  }

  // Generate team QR code
  async generateTeamQRCode(params: {
    teamId: number;
    campaignName?: string;
    description?: string;
    expiresAt?: Date;
    maxUses?: number;
    metadata?: QRCodeMetadata;
  }) {
    const qrCodeInfo = await QRCodeServiceImpl.generateTeamQRCode(this.db, {
      teamId: params.teamId,
      ...(params.campaignName && { campaignName: params.campaignName }),
      ...(params.expiresAt && { expiresAt: params.expiresAt }),
      ...(params.maxUses && { maxUses: params.maxUses }),
      metadata: params.metadata || ({
        description: params.description || '',
        teamId: params.teamId,
        createdBy: 0
      } as QRCodeMetadata)
    });

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

  // Get team QR codes
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

  // Deactivate QR code
  async deactivateQRCode(teamId: number, qrCodeId: string): Promise<void> {
    // First, get the QR code to verify ownership and get token
    const qrCodes = await QRCodeServiceImpl.getTeamQRCodes(this.db, teamId);
    const qrCode = qrCodes.find(qr => qr.id === qrCodeId);

    if (!qrCode) {
      throw new Error('QR code not found or does not belong to this team');
    }

    // Deactivate using the token
    await QRCodeServiceImpl.deactivateQRCode(this.db, qrCode.token);
  }

  // Generate test QR code (for testing purposes)
  async generateTestQRCode() {
    return {
      id: 'test-123',
      qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://example.com&format=png',
      message: 'Test QR code generated successfully'
    };
  }
}