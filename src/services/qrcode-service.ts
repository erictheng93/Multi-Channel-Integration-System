// QR Code Service Type Definitions
// This file contains only type definitions used by qrcode-service-impl.ts

export interface QRCodeConfig {
  teamId: number;
  campaignName?: string;
  description?: string;
  maxUses?: number;
  expiresAt?: Date;
  metadata?: {
    description?: string;
    [key: string]: unknown;
  };
}

export interface QRCodeInfo {
  id: string;
  teamId: number;
  token: string;
  lineUrl: string;
  qrCodeImageUrl: string;
  campaignName: string;
  description: string | null;
  usageCount: number;
  maxUses?: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: string;
}
