// Shapes returned by the API metrics service (mirrors frontend/src/types/api-monitor.ts).

export interface ApiStatistics {
  totalEndpoints: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  avgResponseTime: number;
}

export interface ApiEndpointMetric {
  id: string;
  endpoint: string;
  method: string;
  category: string;
  description: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number; // p95 ms
  avgResponseTime: number;
  p50ResponseTime: number;
  successRate: number; // percent, non-5xx
  requestCount: number;
  errorCount: number;
  statusCodes: Record<string, number>;
  statusClasses: Record<string, number>;
  lastCheck: string;
  previousAvgResponseTime: number | null;
  avgResponseTimeDeltaPct: number | null;
}

export interface MetricEvent {
  id: string;
  type: 'error' | 'warning';
  message: string;
  timestamp: string;
}

export interface ApiMetricsSummary {
  configured: boolean;
  windowMinutes: number;
  generatedAt: string;
  endpoints: ApiEndpointMetric[];
  events: MetricEvent[];
  stats: ApiStatistics;
  error?: string;
}
