// QR Code Service - LIFF QR Code Generation
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { createDbClient } from '../db/drizzle-factory';
import { teamLiffQrCodes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createContextLogger } from '../utils/logger';
import type { Bindings } from '../types';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('QRCodeService');

export interface QRCodeGenerationResult {
  success: boolean;
  qrCodeId?: string;
  liffUrl?: string;
  qrCodeUrl?: string;
  error?: string;
}

export async function generateTeamQRCode(
  teamId: number,
  teamName: string,
  env: Bindings
): Promise<QRCodeGenerationResult> {
  try {
    log.info('Starting QR Code generation', { teamId, teamName });
    
    const liffId = env.LINE_LIFF_ID;
    if (!liffId) {
      return { success: false, error: 'LINE_LIFF_ID not configured' };
    }

    const liffUrl = 'https://liff.line.me/' + liffId + '?team=' + teamId;

    // Use toString with SVG output for Cloudflare Workers compatibility
    // SVG is fully supported in Workers and can be rendered by browsers
    const qrCodeSvg = await QRCode.toString(liffUrl, {
      type: 'svg',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'H'
    });

    const fileName = 'qr-codes/team-' + teamId + '-' + Date.now() + '.svg';
    const r2Bucket = env.R2_BUCKET;

    if (!r2Bucket) {
      return { success: false, error: 'R2_BUCKET not configured' };
    }

    await r2Bucket.put(fileName, qrCodeSvg, {
      httpMetadata: { contentType: 'image/svg+xml' },
      customMetadata: {
        teamId: teamId.toString(),
        teamName: teamName,
        generatedAt: nowISO(),
      }
    });

    // Support both STORAGE_PUBLIC_URL (primary) and R2_PUBLIC_URL (legacy) for compatibility
    // This aligns with the pattern used in src/config/runtime.ts
    const r2PublicUrl = env.STORAGE_PUBLIC_URL || env.R2_PUBLIC_URL;
    if (!r2PublicUrl) {
      return { success: false, error: 'STORAGE_PUBLIC_URL or R2_PUBLIC_URL not configured' };
    }

    const qrCodeUrl = r2PublicUrl + '/' + fileName;
    const db = createDbClient(env.DB);
    const qrCodeId = uuidv4();

    const existingQrCode = await db
      .select()
      .from(teamLiffQrCodes)
      .where(eq(teamLiffQrCodes.teamId, teamId))
      .get();

    if (existingQrCode) {
      await db
        .update(teamLiffQrCodes)
        .set({
          liffUrl,
          qrCodeUrl,
          updatedAt: nowISO(),
        })
        .where(eq(teamLiffQrCodes.id, existingQrCode.id));

      return {
        success: true,
        qrCodeId: existingQrCode.id,
        liffUrl,
        qrCodeUrl
      };
    } else {
      await db.insert(teamLiffQrCodes).values({
        id: qrCodeId,
        teamId,
        liffUrl,
        qrCodeUrl,
        scanCount: 0,
        isActive: true,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });

      return {
        success: true,
        qrCodeId,
        liffUrl,
        qrCodeUrl
      };
    }
  } catch (error) {
    log.error('QR Code generation failed', { error, teamId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed'
    };
  }
}

export async function getTeamQRCode(teamId: number, env: Bindings) {
  try {
    const db = createDbClient(env.DB);
    const qrCode = await db
      .select()
      .from(teamLiffQrCodes)
      .where(eq(teamLiffQrCodes.teamId, teamId))
      .get();
    return qrCode || null;
  } catch (error) {
    log.error('Failed to get team QR Code', { error, teamId });
    return null;
  }
}

export async function deactivateTeamQRCode(teamId: number, env: Bindings): Promise<boolean> {
  try {
    const db = createDbClient(env.DB);
    await db
      .update(teamLiffQrCodes)
      .set({
        isActive: false,
        updatedAt: nowISO(),
      })
      .where(eq(teamLiffQrCodes.teamId, teamId));
    return true;
  } catch (error) {
    log.error('Failed to deactivate QR Code', { error, teamId });
    return false;
  }
}
