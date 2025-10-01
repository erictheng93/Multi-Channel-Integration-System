// SSE (Server-Sent Events) 專用類型定義

export interface SSEConnection {
  connectionId: string;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  userId: number;
  conversationId?: number;
  lastActivity: number;
  metadata?: Record<string, any>;
}

export interface SSEEvent {
  type: 'connection' | 'heartbeat' | 'data' | 'error' | 'close';
  data?: any;
  timestamp: string;
  connectionId?: string;
  retry?: number;
}

export interface SSEHeaders {
  'Content-Type': 'text/event-stream';
  'Cache-Control': 'no-cache, no-store, must-revalidate';
  'Connection': 'keep-alive';
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
  'X-Accel-Buffering': 'no';
  'Keep-Alive'?: string;
  'Pragma'?: 'no-cache';
  'Transfer-Encoding'?: 'chunked';
}

export interface SSEConnectionMetrics {
  establishedAt: number;
  lastHeartbeat: number;
  eventsSent: number;
  errorsCount: number;
  dataTransferred: number;
}

export interface SSEManagerStats {
  totalConnections: number;
  connectionsByUser: Record<number, number>;
  connectionsByConversation: Record<number, number>;
  averageUptime: number;
  totalEventsSent: number;
  errorRate: number;
}

export interface SSEConfig {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxConnectionsPerUser: number;
  enableCompression: boolean;
  retryInterval: number;
  maxRetryAttempts: number;
}

export interface SSEAuthPayload {
  userId: number;
  displayName?: string;
  role?: string;
  teamId?: number;
  conversationAccess?: number[];
}