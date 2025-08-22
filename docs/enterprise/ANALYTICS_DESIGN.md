# 企業級統計分析系統設計

## 分析維度和指標

### 1. 客服效能分析

#### 個人效能指標
```typescript
interface AgentPerformanceMetrics {
  agentId: number;
  agentName: string;
  period: {
    start: number;
    end: number;
  };
  
  // 對話處理指標
  conversationMetrics: {
    totalConversations: number;      // 總對話數
    activeConversations: number;     // 活躍對話數
    closedConversations: number;     // 已關閉對話數
    averageResponseTime: number;     // 平均回應時間（秒）
    averageResolutionTime: number;   // 平均解決時間（秒）
    firstResponseTime: number;       // 首次回應時間（秒）
  };
  
  // 訊息處理指標
  messageMetrics: {
    totalMessages: number;           // 總訊息數
    messagesPerConversation: number; // 每對話平均訊息數
    messagesSent: number;            // 發送訊息數
    messagesReceived: number;        // 接收訊息數
  };
  
  // 工作時間指標
  workTimeMetrics: {
    totalWorkTime: number;           // 總工作時間（秒）
    activeTime: number;              // 活躍時間（秒）
    idleTime: number;                // 閒置時間（秒）
    utilizationRate: number;         // 利用率（%）
  };
  
  // 客戶滿意度指標
  satisfactionMetrics: {
    averageRating: number;           // 平均評分
    totalRatings: number;            // 總評分數
    positiveRatings: number;         // 正面評分數
    negativeRatings: number;         // 負面評分數
    satisfactionRate: number;        // 滿意度（%）
  };
}
```

#### 團隊效能指標
```typescript
interface TeamPerformanceMetrics {
  teamId: number;
  teamName: string;
  period: {
    start: number;
    end: number;
  };
  
  // 團隊概況
  teamOverview: {
    totalAgents: number;             // 總客服數
    activeAgents: number;            // 活躍客服數
    averageExperience: number;       // 平均經驗（月）
  };
  
  // 工作負載分配
  workloadDistribution: {
    totalConversations: number;      // 總對話數
    conversationsPerAgent: number;   // 每人平均對話數
    workloadBalance: number;         // 工作負載平衡度（0-1）
    peakHours: Array<{
      hour: number;
      conversationCount: number;
    }>;
  };
  
  // 團隊效率指標
  efficiencyMetrics: {
    averageResponseTime: number;     // 團隊平均回應時間
    averageResolutionTime: number;   // 團隊平均解決時間
    escalationRate: number;          // 升級率（%）
    transferRate: number;            // 轉移率（%）
  };
  
  // 客戶滿意度
  customerSatisfaction: {
    averageRating: number;
    satisfactionTrend: Array<{
      date: string;
      rating: number;
    }>;
  };
}
```

### 2. 客戶行為分析

#### 客戶互動模式
```typescript
interface CustomerBehaviorAnalytics {
  // 平台使用分析
  platformUsage: {
    line: {
      totalUsers: number;
      activeUsers: number;
      messageVolume: number;
    };
    facebook: {
      totalUsers: number;
      activeUsers: number;
      messageVolume: number;
    };
  };
  
  // 時間分佈分析
  timeDistribution: {
    hourlyDistribution: Array<{
      hour: number;
      messageCount: number;
      conversationCount: number;
    }>;
    dailyDistribution: Array<{
      dayOfWeek: number;
      messageCount: number;
      conversationCount: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      messageCount: number;
      conversationCount: number;
      newUsers: number;
    }>;
  };
  
  // 對話模式分析
  conversationPatterns: {
    averageConversationLength: number;    // 平均對話長度
    averageMessagesPerConversation: number; // 每對話平均訊息數
    commonTopics: Array<{
      topic: string;
      frequency: number;
      averageResolutionTime: number;
    }>;
    resolutionRates: {
      firstContact: number;               // 首次接觸解決率
      withinDay: number;                  // 當日解決率
      withinWeek: number;                 // 週內解決率
    };
  };
  
  // 客戶生命週期分析
  customerLifecycle: {
    newCustomers: number;                 // 新客戶數
    returningCustomers: number;           // 回頭客戶數
    churnRate: number;                    // 流失率
    averageLifetimeValue: number;         // 平均生命週期價值
    retentionRate: Array<{
      period: string;
      rate: number;
    }>;
  };
}
```

### 3. 系統效能分析

#### 技術指標監控
```typescript
interface SystemPerformanceMetrics {
  // API 效能指標
  apiMetrics: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number; // 每秒請求數
    endpointPerformance: Array<{
      endpoint: string;
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    }>;
  };
  
  // 資料庫效能指標
  databaseMetrics: {
    queryCount: number;
    averageQueryTime: number;
    slowQueries: Array<{
      query: string;
      executionTime: number;
      frequency: number;
    }>;
    connectionPoolUsage: number;
  };
  
  // 第三方整合效能
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
  
  // 資源使用情況
  resourceUsage: {
    cpuUsage: number;
    memoryUsage: number;
    storageUsage: number;
    bandwidthUsage: number;
  };
}
```

### 4. 分析實現架構

#### 數據收集層
```typescript
class MetricsCollector {
  private db: D1Database;
  private kv: KVNamespace;
  
  constructor(db: D1Database, kv: KVNamespace) {
    this.db = db;
    this.kv = kv;
  }
  
  // 收集客服效能數據
  async collectAgentMetrics(agentId: number, period: { start: number; end: number }): Promise<AgentPerformanceMetrics> {
    const [conversationData, messageData, workTimeData, satisfactionData] = await Promise.all([
      this.getConversationMetrics(agentId, period),
      this.getMessageMetrics(agentId, period),
      this.getWorkTimeMetrics(agentId, period),
      this.getSatisfactionMetrics(agentId, period)
    ]);
    
    return {
      agentId,
      agentName: await this.getAgentName(agentId),
      period,
      conversationMetrics: conversationData,
      messageMetrics: messageData,
      workTimeMetrics: workTimeData,
      satisfactionMetrics: satisfactionData
    };
  }
  
  private async getConversationMetrics(agentId: number, period: { start: number; end: number }) {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_conversations,
        AVG(
          CASE 
            WHEN first_response_at IS NOT NULL 
            THEN (first_response_at - created_at) / 1000 
          END
        ) as avg_first_response_time,
        AVG(
          CASE 
            WHEN closed_at IS NOT NULL 
            THEN (closed_at - created_at) / 1000 
          END
        ) as avg_resolution_time
      FROM conversations 
      WHERE assigned_user_id = ? 
        AND created_at >= ? 
        AND created_at <= ?
    `).bind(agentId, period.start, period.end).first();
    
    return {
      totalConversations: result?.total_conversations || 0,
      activeConversations: result?.active_conversations || 0,
      closedConversations: result?.closed_conversations || 0,
      averageResponseTime: result?.avg_response_time || 0,
      averageResolutionTime: result?.avg_resolution_time || 0,
      firstResponseTime: result?.avg_first_response_time || 0
    };
  }
  
  // 實時指標更新
  async updateRealTimeMetrics(metric: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    const key = `metrics:${metric}:${Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',')}`;
    const timestamp = Date.now();
    
    // 存儲到 KV 以便快速查詢
    await this.kv.put(key, JSON.stringify({
      value,
      timestamp,
      tags
    }), { expirationTtl: 24 * 60 * 60 }); // 24 小時過期
    
    // 同時更新時間序列數據
    await this.updateTimeSeriesData(metric, value, timestamp, tags);
  }
  
  private async updateTimeSeriesData(metric: string, value: number, timestamp: number, tags: Record<string, string>): Promise<void> {
    const hour = Math.floor(timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const key = `timeseries:${metric}:${hour}`;
    
    const existing = await this.kv.get(key);
    const data = existing ? JSON.parse(existing) : { values: [], count: 0, sum: 0 };
    
    data.values.push({ timestamp, value, tags });
    data.count += 1;
    data.sum += value;
    
    await this.kv.put(key, JSON.stringify(data), { 
      expirationTtl: 7 * 24 * 60 * 60 // 7 天過期
    });
  }
}
```

#### 分析計算層
```typescript
class AnalyticsEngine {
  private collector: MetricsCollector;
  
  constructor(collector: MetricsCollector) {
    this.collector = collector;
  }
  
  // 生成客服效能報告
  async generateAgentPerformanceReport(
    agentId: number, 
    period: { start: number; end: number }
  ): Promise<AgentPerformanceMetrics> {
    return await this.collector.collectAgentMetrics(agentId, period);
  }
  
  // 生成團隊效能報告
  async generateTeamPerformanceReport(
    teamId: number,
    period: { start: number; end: number }
  ): Promise<TeamPerformanceMetrics> {
    const teamAgents = await this.getTeamAgents(teamId);
    const agentMetrics = await Promise.all(
      teamAgents.map(agent => this.collector.collectAgentMetrics(agent.id, period))
    );
    
    return this.aggregateTeamMetrics(teamId, agentMetrics, period);
  }
  
  // 預測分析
  async generatePredictiveAnalytics(period: { start: number; end: number }) {
    const historicalData = await this.getHistoricalData(period);
    
    return {
      volumePrediction: this.predictMessageVolume(historicalData),
      resourcePrediction: this.predictResourceNeeds(historicalData),
      satisfactionPrediction: this.predictSatisfactionTrend(historicalData)
    };
  }
  
  private predictMessageVolume(historicalData: any[]): any {
    // 使用簡單的線性回歸預測訊息量
    // 實際實現中可以使用更複雜的機器學習模型
    const trend = this.calculateTrend(historicalData.map(d => d.messageCount));
    const seasonality = this.calculateSeasonality(historicalData);
    
    return {
      nextWeek: this.applyTrendAndSeasonality(trend, seasonality, 7),
      nextMonth: this.applyTrendAndSeasonality(trend, seasonality, 30),
      confidence: this.calculateConfidence(historicalData)
    };
  }
  
  private calculateTrend(values: number[]): number {
    // 簡單線性回歸計算趨勢
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }
  
  private calculateSeasonality(data: any[]): Record<string, number> {
    // 計算週期性模式（小時、星期等）
    const hourlyPattern: Record<number, number[]> = {};
    
    data.forEach(item => {
      const hour = new Date(item.timestamp).getHours();
      if (!hourlyPattern[hour]) hourlyPattern[hour] = [];
      hourlyPattern[hour].push(item.messageCount);
    });
    
    const seasonality: Record<string, number> = {};
    Object.entries(hourlyPattern).forEach(([hour, values]) => {
      seasonality[`hour_${hour}`] = values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    return seasonality;
  }
}
```

### 5. 報告生成系統

#### 自動報告生成
```typescript
class ReportGenerator {
  private analytics: AnalyticsEngine;
  
  constructor(analytics: AnalyticsEngine) {
    this.analytics = analytics;
  }
  
  // 生成日報
  async generateDailyReport(date: Date): Promise<DailyReport> {
    const start = new Date(date).setHours(0, 0, 0, 0);
    const end = new Date(date).setHours(23, 59, 59, 999);
    
    const [systemMetrics, agentMetrics, customerMetrics] = await Promise.all([
      this.analytics.getSystemMetrics({ start, end }),
      this.analytics.getAgentMetrics({ start, end }),
      this.analytics.getCustomerMetrics({ start, end })
    ]);
    
    return {
      date: date.toISOString().split('T')[0],
      summary: this.generateSummary(systemMetrics, agentMetrics, customerMetrics),
      systemMetrics,
      agentMetrics,
      customerMetrics,
      recommendations: this.generateRecommendations(systemMetrics, agentMetrics)
    };
  }
  
  // 生成週報
  async generateWeeklyReport(weekStart: Date): Promise<WeeklyReport> {
    const start = weekStart.getTime();
    const end = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).getTime();
    
    const dailyReports = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start + i * 24 * 60 * 60 * 1000);
      dailyReports.push(await this.generateDailyReport(date));
    }
    
    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: new Date(end).toISOString().split('T')[0],
      summary: this.aggregateWeeklySummary(dailyReports),
      dailyReports,
      trends: this.calculateWeeklyTrends(dailyReports),
      insights: this.generateWeeklyInsights(dailyReports)
    };
  }
  
  // 匯出報告
  async exportReport(reportData: any, format: 'json' | 'csv' | 'pdf'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(reportData, null, 2);
      
      case 'csv':
        return this.convertToCSV(reportData);
      
      case 'pdf':
        return await this.generatePDF(reportData);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  private convertToCSV(data: any): string {
    // 將 JSON 數據轉換為 CSV 格式
    const flatten = (obj: any, prefix = ''): any => {
      const flattened: any = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(flattened, flatten(value, newKey));
        } else {
          flattened[newKey] = value;
        }
      });
      return flattened;
    };
    
    const flatData = flatten(data);
    const headers = Object.keys(flatData);
    const values = Object.values(flatData);
    
    return [headers.join(','), values.join(',')].join('\n');
  }
}
```

### 6. 資料庫結構擴展

```sql
-- 指標數據表
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    tags TEXT, -- JSON 格式的標籤
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 報告表
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT NOT NULL,
    report_period TEXT NOT NULL,
    report_data TEXT NOT NULL, -- JSON 格式的報告數據
    generated_by INTEGER,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_reports_type_period ON reports(report_type, report_period);
```