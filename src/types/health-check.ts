// 統一健康檢查系統類型定義
export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  timestamp: string;
  responseTime?: number;
  details?: Record<string, any>;
  metrics?: HealthMetrics;
}

export interface HealthMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkLatency?: number;
  errorRate?: number;
  throughput?: number;
}

export interface ComponentHealth {
  component: string;
  version: string;
  status: HealthCheckResult;
  dependencies?: ComponentHealth[];
  lastCheck: string;
  checkInterval: number; // seconds
}

export interface SystemHealth {
  overall: HealthCheckResult;
  components: ComponentHealth[];
  infrastructure: {
    database: HealthCheckResult;
    cache: HealthCheckResult;
  };
  performance: {
    apiResponseTime: number;
    databaseQueryTime: number;
    cacheHitRate: number;
  };
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  alertThresholds: {
    warning: number; // response time in ms
    critical: number; // response time in ms
  };
  notifications: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
}

// 健康檢查標準等級
export enum HealthLevel {
  INFRASTRUCTURE = 'infrastructure', // 基礎設施
  SERVICE = 'service',               // 服務層
  APPLICATION = 'application',       // 應用層
  INTEGRATION = 'integration'        // 整合層
}

// 檢查器接口
export interface HealthChecker {
  name: string;
  level: HealthLevel;
  description: string;
  check(): Promise<HealthCheckResult>;
  getConfig(): HealthCheckConfig;
}