/// <reference types="vite/client" />

/**
 * ============================================================================
 * Vite 環境變量類型定義
 * ============================================================================
 *
 * 本文件為 Vite 環境變量提供 TypeScript 類型安全
 * 擴展 ImportMetaEnv 接口以包含所有自定義環境變量
 *
 * 使用方法:
 * ```ts
 * const backendUrl: string = import.meta.env.VITE_BACKEND_URL;
 * const debug: boolean = import.meta.env.VITE_DEBUG === 'true';
 * ```
 */

interface ImportMetaEnv {
  // ============================================================================
  // 核心 URL 配置
  // ============================================================================

  /** 後端 API 基礎 URL */
  readonly VITE_BACKEND_URL: string;

  /** 前端 URL */
  readonly VITE_FRONTEND_URL: string;

  /** 前端備用 URL (Cloudflare Pages 默認域名) */
  readonly VITE_FRONTEND_PAGES_URL?: string;

  /** WebSocket URL */
  readonly VITE_WEBSOCKET_URL: string;

  /** R2 存儲公開 URL */
  readonly VITE_STORAGE_PUBLIC_URL: string;

  // ============================================================================
  // 環境標識
  // ============================================================================

  /** 環境類型: development | staging | production */
  readonly VITE_ENV: 'development' | 'staging' | 'production';

  /** 開發模式標識 */
  readonly VITE_DEV_MODE: 'true' | 'false';

  // ============================================================================
  // 調試與日誌配置
  // ============================================================================

  /** 啟用調試日誌 */
  readonly VITE_ENABLE_DEBUG_LOGS: 'true' | 'false';

  /** 調試模式 */
  readonly VITE_DEBUG: 'true' | 'false';

  /** WebSocket 調試 */
  readonly VITE_WEBSOCKET_DEBUG: 'true' | 'false';

  /** 搜索調試 */
  readonly VITE_SEARCH_DEBUG?: 'true' | 'false';

  // ============================================================================
  // WebSocket 配置
  // ============================================================================

  /** 啟用 WebSocket */
  readonly VITE_WEBSOCKET_ENABLED: 'true' | 'false';

  /** 自動重連 */
  readonly VITE_WEBSOCKET_AUTO_RECONNECT: 'true' | 'false';

  /** 重連延遲 (毫秒) */
  readonly VITE_WEBSOCKET_RECONNECT_DELAY: string;

  /** 最大重試次數 */
  readonly VITE_WEBSOCKET_MAX_RETRIES: string;

  // ============================================================================
  // 功能開關
  // ============================================================================

  /** 啟用搜索緩存 */
  readonly VITE_ENABLE_SEARCH_CACHE: 'true' | 'false';

  /** 啟用性能監控 */
  readonly VITE_ENABLE_PERFORMANCE_MONITORING: 'true' | 'false';

  /** 啟用實驗性功能 */
  readonly VITE_ENABLE_EXPERIMENTAL_FEATURES: 'true' | 'false';

  /** Enables the activity restore UI surface */
  readonly VITE_ENABLE_ACTIVITY_RESTORE?: 'true' | 'false';

  // ============================================================================
  // 安全配置 (可選)
  // ============================================================================

  /** 本地存儲加密密鑰 */
  readonly VITE_ENCRYPTION_KEY?: string;

  // ============================================================================
  // 第三方集成 (可選)
  // ============================================================================

  /** LINE LIFF ID */
  readonly VITE_LIFF_ID?: string;

  /** 分析服務 ID */
  readonly VITE_ANALYTICS_ID?: string;

  /** 錯誤報告 DSN */
  readonly VITE_ERROR_REPORTING_DSN?: string;

  // ============================================================================
  // Vite 內置變量 (已由 vite/client 定義，這裡僅作文檔說明)
  // ============================================================================

  /** 應用運行模式 */
  readonly MODE: string;

  /** 基礎 URL */
  readonly BASE_URL: string;

  /** 是否為生產環境 */
  readonly PROD: boolean;

  /** 是否為開發環境 */
  readonly DEV: boolean;

  /** 是否為 SSR */
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
