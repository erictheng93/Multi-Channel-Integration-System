/**
 * Shared types for ConfigForm child components
 */

export interface ConfigFormData {
  // Basic Configuration
  projectName: string;
  adminEmail: string;
  customDomain: string;
  // Phase 1 Enhancement: URL Configuration
  backendUrl: string;
  frontendUrl: string;
  r2PublicUrl: string;
  // LINE OA Integration (Enhanced)
  enableLineIntegration: boolean;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  lineBotId: string;
  lineLiffId: string;
  // Facebook Integration
  enableFacebookIntegration: boolean;
  facebookPageAccessToken: string;
  facebookAppSecret: string;
  // System Configuration (Phase 1)
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

export interface ResourceNames {
  worker: string;
  database: string;
  kvSession: string;
  kvCache: string;
  r2Bucket: string;
  queue: string;
  pages: string;
}

export function createDefaultFormData(): ConfigFormData {
  return {
    projectName: '',
    adminEmail: '',
    customDomain: '',
    backendUrl: '',
    frontendUrl: '',
    r2PublicUrl: '',
    enableLineIntegration: true,
    lineChannelAccessToken: '',
    lineChannelSecret: '',
    lineBotId: '',
    lineLiffId: '',
    enableFacebookIntegration: false,
    facebookPageAccessToken: '',
    facebookAppSecret: '',
    logLevel: 'info',
  };
}
