// Analytics sub-module: shared types and interfaces

// Legacy analytics metric interface (backward compatible)
export interface AnalyticsMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  unit?: string;
}

// Agent performance metrics
export interface AgentPerformanceMetrics {
  agentId: number;
  agentName: string;
  period: { start: number; end: number };

  conversationMetrics: {
    totalConversations: number;
    activeConversations: number;
    closedConversations: number;
    averageResponseTime: number; // seconds
    averageResolutionTime: number; // seconds
    firstResponseTime: number; // seconds
  };

  messageMetrics: {
    totalMessages: number;
    messagesPerConversation: number;
    messagesSent: number;
    messagesReceived: number;
  };

  workTimeMetrics: {
    totalWorkTime: number; // seconds
    activeTime: number; // seconds
    idleTime: number; // seconds
    utilizationRate: number; // percentage
  };

  satisfactionMetrics: {
    averageRating: number;
    totalRatings: number;
    positiveRatings: number;
    negativeRatings: number;
    satisfactionRate: number; // percentage
  };
}

// System performance metrics
export interface SystemPerformanceMetrics {
  period: { start: number; end: number };

  apiMetrics: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number; // requests per second
    endpointPerformance: Array<{
      endpoint: string;
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    }>;
  };

  databaseMetrics: {
    queryCount: number;
    averageQueryTime: number;
    slowQueries: Array<{
      query: string;
      executionTime: number;
      frequency: number;
    }>;
  };

  integrationMetrics: {
    line: {
      webhookLatency: number;
      apiCallSuccess: number;
      apiCallFailure: number;
    };
    facebook: {
      webhookLatency: number;
      apiCallSuccess: number;
      apiCallFailure: number;
    };
  };
}
