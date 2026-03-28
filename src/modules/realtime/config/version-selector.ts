// Real-time 版本選擇器 - 智能選擇最適合的版本

import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('VersionSelector')

import type { RealtimeConfig } from '@modules/realtime/types';

// 版本特性定義
export interface VersionFeatures {
  supportEventDriven: boolean;
  supportQueueProcessing: boolean;
  supportAdvancedRealtime: boolean;
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
      supportAdvancedRealtime: false,
      supportBatchProcessing: false,
      supportAdvancedAuth: false,
      supportRealTimeMetrics: false,
      performanceLevel: 'basic',
      stabilityLevel: 'production'
    },
    compatibility: ['all-browsers', 'old-clients'],
    recommendedFor: ['legacy-support', 'simple-use-cases'],
    deprecationWarning: 'This version will be removed in a future release. Please upgrade to v2 or modular.'
  },

  v2: {
    version: 'v2',
    name: 'Real-time v2 (Event-Driven)',
    description: '事件驱动的即時通訊系統，使用 Cloudflare Queue',
    features: {
      supportEventDriven: true,
      supportQueueProcessing: true,
      supportAdvancedRealtime: true,
      supportBatchProcessing: false,
      supportAdvancedAuth: false,
      supportRealTimeMetrics: true,
      performanceLevel: 'standard',
      stabilityLevel: 'stable'
    },
    compatibility: ['modern-browsers', 'websocket-clients'],
    recommendedFor: ['production-use', 'high-performance']
  },

  modular: {
    version: 'modular',
    name: 'Real-time Modular (Advanced)',
    description: '完全模組化的即時通訊系統，支援所有進階功能',
    features: {
      supportEventDriven: true,
      supportQueueProcessing: true,
      supportAdvancedRealtime: true,
      supportBatchProcessing: true,
      supportAdvancedAuth: true,
      supportRealTimeMetrics: true,
      performanceLevel: 'advanced',
      stabilityLevel: 'production'
    },
    compatibility: ['modern-browsers', 'websocket-clients'],
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
    log.info(`Version set to: ${version}`);
  }

  // 檢測環境能力
  async detectEnvironmentCapabilities(env: Bindings, context?: any): Promise<EnvironmentCapabilities> {
    const capabilities: EnvironmentCapabilities = {
      // Phase 2: Queue replaced by Durable Objects (MessageBroadcaster, LatestMessageCacheCoordinator)
      hasCloudflareQueue: !!env.MESSAGE_BROADCASTER && !!env.LATEST_MESSAGE_COORDINATOR,
      hasKVStorage: !!env.SESSIONS,
      hasD1Database: !!env.DB,
      hasR2Storage: !!env.R2_BUCKET,
      supportsCookies: true, // 假設支援
      supportsJWT: !!env.JWT_SECRET,
      clientCapabilities: {
        supportsWebSockets: false,
        supportsModernJS: true,
        userAgent: context?.req?.header('User-Agent') || 'unknown'
      }
    };

    // Client capability detection
    if (context?.req) {
      const userAgent = context.req.header('User-Agent') || '';

      // Detect WebSocket support
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

    log.info('Environment capability detection complete:', {
      cloudflareQueue: capabilities.hasCloudflareQueue,
      kvStorage: capabilities.hasKVStorage,
      database: capabilities.hasD1Database,
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

    // Check if modular version is supported
    if (capabilities.hasCloudflareQueue &&
        capabilities.hasKVStorage &&
        capabilities.hasD1Database &&
        capabilities.clientCapabilities.supportsModernJS) {

      selectedVersion = 'modular';
      reason = 'Environment supports all advanced features, selecting modular version';
    }
    // Check if v2 is supported
    else if (capabilities.hasCloudflareQueue &&
             capabilities.hasKVStorage) {

      selectedVersion = 'v2';
      reason = 'Environment supports event-driven features, selecting v2';
    }
    // Fall back to v1
    else {
      selectedVersion = 'v1';
      reason = 'Environment limitations, using v1 for best compatibility';
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

    log.info(`Selected version: ${selectedVersion}`, {
      reason,
      capabilities: {
        queue: capabilities.hasCloudflareQueue,
        kv: capabilities.hasKVStorage
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

    log.info(`Version compatibility check ${version}:`, {
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
        'Cloudflare Queue support',
        'KV storage',
        'WebSocket support'
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