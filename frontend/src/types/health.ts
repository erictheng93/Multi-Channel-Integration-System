// 前端健康檢查類型定義
export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  timestamp: string;
  responseTime?: number;
  details?: Record<string, unknown>;
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
    storage: HealthCheckResult;
    queue: HealthCheckResult;
  };
  services: {
    auth: HealthCheckResult;
    messaging: HealthCheckResult;
    notifications: HealthCheckResult;
    reports: HealthCheckResult;
  };
  frontend: {
    components: HealthCheckResult;
    routing: HealthCheckResult;
    api: HealthCheckResult;
  };
  performance: {
    apiResponseTime: number;
    frontendLoadTime: number;
    databaseQueryTime: number;
    cacheHitRate: number;
  };
}

export interface HealthStats {
  overview: {
    overallStatus: string;
    totalComponents: number;
    uptime: string;
    lastCheck: string;
  };
  distribution: {
    healthy: {
      count: number;
      percentage: number;
    };
    warning: {
      count: number;
      percentage: number;
    };
    critical: {
      count: number;
      percentage: number;
    };
    unknown: {
      count: number;
      percentage: number;
    };
  };
  performance: {
    apiResponseTime: number;
    frontendLoadTime: number;
    databaseQueryTime: number;
    cacheHitRate: number;
  };
  trends: {
    avgResponseTime: number;
    reliability: number;
  };
}

export type HealthLevel = 'infrastructure' | 'service' | 'application' | 'integration';

export interface HealthConfig {
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