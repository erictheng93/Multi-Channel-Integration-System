// Real-time 版本選擇器 - 智能選擇最適合的版本

import type { Bindings } from '@/types';
import type { RealtimeConfig } from '@modules/realtime/types';

// 版本特性定義
export interface VersionFeatures {
  supportEventDriven: boolean;
  supportQueueProcessing: boolean;
  supportAdvancedSSE: boolean;
  supportBatchProcessing: boolean;
  supportAdvancedAuth: boolean;
  supportRealTimeMetrics: boolean;
  performanceLevel: 'basic' | 'standard' | 'advanced';
  stabilityLevel: 'experimental' | 'stable' | 'production';
}

// 版本信息
export interface VersionInfo {
  version: 'v1' | 'v2' | 'modular';
  name: string;
  description: string;
  features: VersionFeatures;
  compatibility: string[];
  recommendedFor: string[];
  deprecationWarning?: string;
}

// 支援的版本定義
const supportedVersions: Record<string, VersionInfo> = {
  v1: {
    version: 'v1',
    name: 'Real-time v1 (Legacy)',
    description: '傳統的即時通訊實作，使用定時查詢機制',
    features: {
      supportEventDriven: false,
      supportQueueProcessing: false,
      supportAdvancedSSE: false,
      supportBatchProcessing: false,
      supportAdvancedAuth: false,
      supportRealTimeMetrics: false,
      performanceLevel: 'basic',
      stabilityLevel: 'production'
    },
    compatibility: ['all-browsers', 'old-clients'],
    recommendedFor: ['legacy-support', 'simple-use-cases'],
    deprecationWarning: '此版本將在未來版本中移除，建議升級到 v2 或 modular 版本'
  },

  v2: {
    version: 'v2',
    name: 'Real-time v2 (Event-Driven)',
    description: '事件驱动的即時通訊系統，使用 Cloudflare Queue',
    features: {
      supportEventDriven: true,
      supportQueueProcessing: true,
      supportAdvancedSSE: true,
      supportBatchProcessing: false,
      supportAdvancedAuth: false,
      supportRealTimeMetrics: true,
      performanceLevel: 'standard',
      stabilityLevel: 'stable'
    },
    compatibility: ['modern-browsers', 'sse-clients'],
    recommendedFor: ['production-use', 'high-performance']
  },

  modular: {
    version: 'modular',
    name: 'Real-time Modular (Advanced)',
    description: '完全模組化的即時通訊系統，支援所有進階功能',
    features: {
      supportEventDriven: true,
      supportQueueProcessing: true,
      supportAdvancedSSE: true,
      supportBatchProcessing: true,
      supportAdvancedAuth: true,
      supportRealTimeMetrics: true,
      performanceLevel: 'advanced',
      stabilityLevel: 'production'
    },
    compatibility: ['modern-browsers', 'sse-clients', 'websocket-clients'],
    recommendedFor: ['enterprise-use', 'advanced-features', 'scalable-systems']
  }
};

// 環境檢測結果
interface EnvironmentCapabilities {
  hasCloudflareQueue: boolean;
  hasKVStorage: boolean;
  hasD1Database: boolean;
  hasR2Storage: boolean;
  supportsCookies: boolean;
  supportsJWT: boolean;
  clientCapabilities: {
    supportsEventSource: boolean;
    supportsWebSockets: boolean;
    supportsModernJS: boolean;
    userAgent: string;
  };
}

// 版本選擇器類
export class RealtimeVersionSelector {
  private static instance: RealtimeVersionSelector;
  private currentVersion: string = 'auto';
  private capabilities?: EnvironmentCapabilities;

  static getInstance(): RealtimeVersionSelector {
    if (!RealtimeVersionSelector.instance) {
      RealtimeVersionSelector.instance = new RealtimeVersionSelector();
    }
    return RealtimeVersionSelector.instance;
  }

  // 設置版本
  setVersion(version: 'v1' | 'v2' | 'modular' | 'auto'): void {
    this.currentVersion = version;
    console.log(`🔧 [Version Selector] 版本設置為: ${version}`);
  }

  // 檢測環境能力
  async detectEnvironmentCapabilities(env: Bindings, context?: any): Promise<EnvironmentCapabilities> {
    const capabilities: EnvironmentCapabilities = {
      hasCloudflareQueue: !!env.REALTIME_QUEUE,
      hasKVStorage: !!env.SESSIONS,
      hasD1Database: !!env.DB,
      hasR2Storage: !!env.R2_BUCKET,
      supportsCookies: true, // 假設支援
      supportsJWT: !!env.JWT_SECRET,
      clientCapabilities: {
        supportsEventSource: true, // 預設支援
        supportsWebSockets: false, // 預設不支援
        supportsModernJS: true,    // 預設支援
        userAgent: context?.req?.header('User-Agent') || 'unknown'
      }
    };

    // 客戶端能力檢測
    if (context?.req) {
      const userAgent = context.req.header('User-Agent') || '';
      const accept = context.req.header('Accept') || '';

      // 檢測 EventSource 支援
      capabilities.clientCapabilities.supportsEventSource =
        accept.includes('text/event-stream') ||
        userAgent.includes('EventSource');

      // 檢測 WebSocket 支援
      capabilities.clientCapabilities.supportsWebSockets =
        context.req.header('Upgrade') === 'websocket' ||
        userAgent.includes('WebSocket');

      // 檢測現代 JavaScript 支援
      capabilities.clientCapabilities.supportsModernJS =
        !userAgent.includes('IE') &&
        !userAgent.includes('MSIE');

      capabilities.clientCapabilities.userAgent = userAgent;
    }

    this.capabilities = capabilities;

    console.log(`🔍 [Version Selector] 環境能力檢測完成:`, {
      cloudflareQueue: capabilities.hasCloudflareQueue,
      kvStorage: capabilities.hasKVStorage,
      database: capabilities.hasD1Database,
      eventSource: capabilities.clientCapabilities.supportsEventSource,
      userAgent: capabilities.clientCapabilities.userAgent.substring(0, 50)
    });

    return capabilities;
  }

  // 選擇最佳版本
  async selectBestVersion(env: Bindings, context?: any, config?: RealtimeConfig): Promise<{
    selectedVersion: 'v1' | 'v2' | 'modular';
    reason: string;
    versionInfo: VersionInfo;
    capabilities: EnvironmentCapabilities;
  }> {
    // 檢測環境能力
    const capabilities = await this.detectEnvironmentCapabilities(env, context);

    // 如果手動設置了版本，優先使用
    if (this.currentVersion !== 'auto') {
      const version = this.currentVersion as 'v1' | 'v2' | 'modular';
      return {
        selectedVersion: version,
        reason: `手動指定版本: ${version}`,
        versionInfo: supportedVersions[version],
        capabilities
      };
    }

    // 智能選擇邏輯
    let selectedVersion: 'v1' | 'v2' | 'modular' = 'v1';
    let reason = '預設版本';

    // 檢查是否支援模組化版本的所有功能
    if (capabilities.hasCloudflareQueue &&
        capabilities.hasKVStorage &&
        capabilities.hasD1Database &&
        capabilities.clientCapabilities.supportsEventSource &&
        capabilities.clientCapabilities.supportsModernJS) {

      selectedVersion = 'modular';
      reason = '環境支援所有進階功能，選擇模組化版本';
    }
    // 檢查是否支援 v2 版本
    else if (capabilities.hasCloudflareQueue &&
             capabilities.hasKVStorage &&
             capabilities.clientCapabilities.supportsEventSource) {

      selectedVersion = 'v2';
      reason = '環境支援事件驅動功能，選擇 v2 版本';
    }
    // 使用 v1 版本
    else {
      selectedVersion = 'v1';
      reason = '環境限制，使用相容性最佳的 v1 版本';
    }

    // 根據配置調整選擇
    if (config) {
      if (!config.enableEventDriven && selectedVersion !== 'v1') {
        selectedVersion = 'v1';
        reason += ' (配置禁用事件驅動功能)';
      }

      if (!config.enableQueueProcessing && selectedVersion === 'modular') {
        selectedVersion = 'v2';
        reason += ' (配置禁用隊列處理功能)';
      }
    }

    console.log(`🎯 [Version Selector] 選擇版本: ${selectedVersion}`, {
      reason,
      capabilities: {
        queue: capabilities.hasCloudflareQueue,
        kv: capabilities.hasKVStorage,
        eventSource: capabilities.clientCapabilities.supportsEventSource
      }
    });

    return {
      selectedVersion,
      reason,
      versionInfo: supportedVersions[selectedVersion],
      capabilities
    };
  }

  // 驗證版本相容性
  validateVersionCompatibility(
    version: 'v1' | 'v2' | 'modular',
    capabilities: EnvironmentCapabilities
  ): {
    compatible: boolean;
    warnings: string[];
    blockers: string[];
  } {
    const versionInfo = supportedVersions[version];
    const warnings: string[] = [];
    const blockers: string[] = [];

    // 檢查關鍵功能相容性
    if (versionInfo.features.supportEventDriven && !capabilities.hasCloudflareQueue) {
      blockers.push('事件驅動功能需要 Cloudflare Queue 支援');
    }

    if (versionInfo.features.supportAdvancedSSE && !capabilities.clientCapabilities.supportsEventSource) {
      blockers.push('進階 SSE 功能需要客戶端支援 EventSource');
    }

    if (versionInfo.features.supportQueueProcessing && !capabilities.hasKVStorage) {
      warnings.push('隊列處理功能建議有 KV 存儲支援');
    }

    if (versionInfo.features.supportAdvancedAuth && !capabilities.supportsJWT) {
      warnings.push('進階認證功能需要 JWT 支援');
    }

    if (!capabilities.clientCapabilities.supportsModernJS) {
      warnings.push('客戶端可能不支援現代 JavaScript 功能');
    }

    const compatible = blockers.length === 0;

    console.log(`✅ [Version Selector] 版本相容性檢查 ${version}:`, {
      compatible,
      warnings: warnings.length,
      blockers: blockers.length
    });

    return { compatible, warnings, blockers };
  }

  // 獲取版本資訊
  getVersionInfo(version: 'v1' | 'v2' | 'modular'): VersionInfo {
    return supportedVersions[version];
  }

  // 獲取所有支援的版本
  getAllVersions(): Record<string, VersionInfo> {
    return supportedVersions;
  }

  // 獲取當前檢測到的能力
  getCurrentCapabilities(): EnvironmentCapabilities | undefined {
    return this.capabilities;
  }

  // 版本升級建議
  getUpgradeRecommendation(currentVersion: 'v1' | 'v2' | 'modular'): {
    shouldUpgrade: boolean;
    recommendedVersion: 'v1' | 'v2' | 'modular';
    benefits: string[];
    requirements: string[];
  } {
    const benefits: string[] = [];
    const requirements: string[] = [];
    let shouldUpgrade = false;
    let recommendedVersion: 'v1' | 'v2' | 'modular' = currentVersion;

    if (currentVersion === 'v1') {
      shouldUpgrade = true;
      recommendedVersion = 'v2';
      benefits.push(
        '事件驅動架構提升性能',
        '更好的即時性',
        '減少資源消耗',
        'Cloudflare Queue 整合'
      );
      requirements.push(
        'Cloudflare Queue 支援',
        'KV 存儲',
        '客戶端 EventSource 支援'
      );
    }

    if (currentVersion === 'v2') {
      shouldUpgrade = true;
      recommendedVersion = 'modular';
      benefits.push(
        '完整的模組化架構',
        '進階認證功能',
        '批量處理支援',
        '全面的監控統計',
        '更好的可擴展性'
      );
      requirements.push(
        '完整的 Cloudflare 服務支援',
        '現代瀏覽器環境',
        '進階配置管理'
      );
    }

    return {
      shouldUpgrade,
      recommendedVersion,
      benefits,
      requirements
    };
  }
}