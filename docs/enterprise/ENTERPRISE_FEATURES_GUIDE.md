# 企業級功能使用指南

## 概述

本指南介紹如何在多渠道客服系統中使用企業級功能，包括權限控制、操作日誌和統計分析。

## 1. 權限控制系統 (RBAC)

### 基本概念

- **角色 (Roles)**: 定義一組權限的集合
- **權限 (Permissions)**: 對特定資源執行特定操作的能力
- **用戶 (Users)**: 系統使用者，可以被分配多個角色
- **資源 (Resources)**: 系統中的實體，如對話、訊息、用戶等

### 使用方式

#### 在 API 端點中使用權限檢查

```typescript
import { requirePermission } from '../enterprise/rbac';

// 要求用戶有查看所有對話的權限
app.get('/api/conversations', 
  jwtAuth, 
  requirePermission('conversation', 'view_all'),
  conversationHandler.list
);

// 要求用戶有創建用戶的權限
app.post('/api/users', 
  jwtAuth, 
  requirePermission('user', 'create'),
  userHandler.create
);
```

#### 在業務邏輯中檢查權限

```typescript
import { EnterpriseRBACManager } from '../enterprise/rbac';

async function assignConversation(userId: number, conversationId: number, assigneeId: number) {
  const rbac = new EnterpriseRBACManager(db, kv);
  
  // 檢查用戶是否有分配對話的權限
  const canAssign = await rbac.checkPermission(
    userId, 
    'conversation', 
    'assign',
    { conversationId }
  );
  
  if (!canAssign.allowed) {
    throw new Error(`Permission denied: ${canAssign.reason}`);
  }
  
  // 執行分配邏輯
  await assignConversationToAgent(conversationId, assigneeId);
}
```

#### 管理角色和權限

```typescript
const rbac = new EnterpriseRBACManager(db, kv);

// 創建自定義角色
const customRole = await rbac.createRole({
  name: 'senior_agent',
  displayName: '資深客服',
  permissions: [
    'conversation:view_team',
    'conversation:assign',
    'message:send',
    'message:edit'
  ]
}, adminUserId);

// 分配角色給用戶
await rbac.assignRole(userId, customRole.id, adminUserId);

// 撤銷角色
await rbac.revokeRole(userId, customRole.id);
```

### 預定義角色

系統提供以下預定義角色：

- **Super Admin**: 系統超級管理員，擁有所有權限
- **Admin**: 管理員，可以管理用戶和系統設定
- **Team Lead**: 團隊主管，可以管理團隊內的對話和客服
- **Agent**: 一般客服，只能處理分配給自己的對話

## 2. 操作日誌系統

### 基本概念

- **審計日誌**: 記錄所有重要的系統操作
- **日誌級別**: DEBUG, INFO, WARN, ERROR, CRITICAL
- **日誌分類**: SECURITY, BUSINESS, SYSTEM, AUDIT

### 使用方式

#### 自動日誌記錄

```typescript
import { auditMiddleware } from '../enterprise/audit-logger';

// 在應用中使用審計中間件
app.use(auditMiddleware());

// 所有 API 調用都會自動記錄
```

#### 手動記錄業務操作

```typescript
import { EnterpriseAuditLogger, LogLevel, LogCategory } from '../enterprise/audit-logger';

const logger = new EnterpriseAuditLogger(db, kv);

// 記錄用戶操作
await logger.logUserAction(
  user,
  'conversation_assign',
  'conversation',
  {
    before: { assignedTo: null },
    after: { assignedTo: newAgentId },
    reason: 'Workload balancing'
  },
  {
    ipAddress: clientIP,
    userAgent: userAgent,
    resourceId: conversationId.toString()
  }
);

// 記錄安全事件
await logger.logSecurityEvent(
  'login_failure',
  {
    context: {
      email: attemptedEmail,
      ipAddress: clientIP,
      reason: 'Invalid password'
    }
  },
  LogLevel.WARN,
  { ipAddress: clientIP }
);
```

#### 查詢和分析日誌

```typescript
// 查詢特定用戶的操作日誌
const userLogs = await logger.queryLogs({
  userId: 123,
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 天前
  endDate: Date.now(),
  page: 1,
  pageSize: 50
});

// 生成日誌統計
const stats = await logger.generateLogStats({
  start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 天前
  end: Date.now()
});

console.log(`總日誌數: ${stats.totalLogs}`);
console.log(`錯誤率: ${stats.errorRate}%`);
```

### 日誌保留策略

- **低級別日誌**: 保留 90 天
- **中級別日誌**: 保留 180 天
- **高級別日誌**: 保留 1 年
- **關鍵日誌**: 保留 7 年

## 3. 統計分析系統

### 基本概念

- **指標 (Metrics)**: 可測量的數值，如回應時間、對話數量等
- **維度 (Dimensions)**: 指標的分類標籤，如客服ID、時間段等
- **儀表板 (Dashboard)**: 實時顯示關鍵指標的界面
- **報告 (Reports)**: 定期生成的分析報告

### 使用方式

#### 記錄自定義指標

```typescript
import { EnterpriseAnalyticsEngine } from '../enterprise/analytics';

const analytics = new EnterpriseAnalyticsEngine(db, kv);

// 記錄客服回應時間
await analytics.recordMetric({
  name: 'agent_response_time',
  value: responseTimeInSeconds,
  timestamp: Date.now(),
  tags: {
    agentId: agentId.toString(),
    conversationId: conversationId.toString(),
    platform: 'line'
  },
  unit: 'seconds'
});

// 記錄客戶滿意度評分
await analytics.recordMetric({
  name: 'customer_satisfaction',
  value: rating,
  timestamp: Date.now(),
  tags: {
    agentId: agentId.toString(),
    conversationId: conversationId.toString()
  },
  unit: 'rating'
});
```

#### 生成效能報告

```typescript
// 生成客服效能報告
const agentReport = await analytics.getAgentPerformanceMetrics(
  agentId,
  {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 天前
    end: Date.now()
  }
);

console.log(`客服 ${agentReport.agentName} 的週報告:`);
console.log(`- 處理對話數: ${agentReport.conversationMetrics.totalConversations}`);
console.log(`- 平均回應時間: ${agentReport.conversationMetrics.averageResponseTime} 秒`);
console.log(`- 客戶滿意度: ${agentReport.satisfactionMetrics.averageRating}/5`);

// 生成系統效能報告
const systemReport = await analytics.getSystemPerformanceMetrics({
  start: Date.now() - 24 * 60 * 60 * 1000, // 24 小時前
  end: Date.now()
});

console.log(`系統 24 小時報告:`);
console.log(`- API 總請求數: ${systemReport.apiMetrics.totalRequests}`);
console.log(`- 平均回應時間: ${systemReport.apiMetrics.averageResponseTime} ms`);
console.log(`- 錯誤率: ${systemReport.apiMetrics.errorRate}%`);
```

#### 生成預測分析

```typescript
// 生成未來工作負載預測
const predictions = await analytics.generatePredictiveAnalytics({
  start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 天前
  end: Date.now()
});

console.log('工作負載預測:');
console.log(`- 下週預計訊息量: ${predictions.volumePrediction.nextWeek}`);
console.log(`- 建議客服人數: ${predictions.resourcePrediction.requiredAgents}`);
console.log(`- 客戶滿意度趨勢: ${predictions.satisfactionPrediction.trend}`);
```

#### 生成自定義報告

```typescript
// 生成自定義分析報告
const customReport = await analytics.generateCustomReport({
  metrics: ['agent_response_time', 'customer_satisfaction'],
  filters: {
    platform: 'line',
    team_id: 1
  },
  groupBy: ['agent_id', 'date'],
  period: {
    start: Date.now() - 30 * 24 * 60 * 60 * 1000,
    end: Date.now()
  },
  format: 'json'
});

// 匯出為 CSV
const csvReport = await analytics.generateCustomReport({
  metrics: ['conversation_count', 'message_count'],
  filters: {},
  groupBy: ['date'],
  period: {
    start: Date.now() - 7 * 24 * 60 * 60 * 1000,
    end: Date.now()
  },
  format: 'csv'
});
```

## 4. 整合使用示例

### 完整的企業級 API 端點

```typescript
import { jwtAuth } from '../middleware/auth';
import { requirePermission } from '../enterprise/rbac';
import { auditMiddleware } from '../enterprise/audit-logger';
import { metricsMiddleware } from '../enterprise/analytics';

// 應用企業級中間件
app.use(auditMiddleware());
app.use(metricsMiddleware());

// 企業級對話管理端點
app.get('/api/conversations',
  jwtAuth,
  requirePermission('conversation', 'view_all'),
  async (c) => {
    const user = c.get('user');
    const analytics = new EnterpriseAnalyticsEngine(c.env.DB, c.env.KV);
    
    // 記錄查詢指標
    await analytics.recordMetric({
      name: 'conversation_list_query',
      value: 1,
      timestamp: Date.now(),
      tags: {
        userId: user.id.toString(),
        userRole: user.role
      }
    });
    
    // 執行業務邏輯
    const conversations = await getConversations(user);
    
    return c.json({
      success: true,
      data: conversations
    });
  }
);

// 企業級對話分配端點
app.post('/api/conversations/:id/assign',
  jwtAuth,
  requirePermission('conversation', 'assign'),
  async (c) => {
    const user = c.get('user');
    const conversationId = c.req.param('id');
    const { assigneeId } = await c.req.json();
    
    const logger = new EnterpriseAuditLogger(c.env.DB, c.env.KV);
    const analytics = new EnterpriseAnalyticsEngine(c.env.DB, c.env.KV);
    
    try {
      // 獲取原始狀態
      const originalConversation = await getConversation(conversationId);
      
      // 執行分配
      await assignConversation(conversationId, assigneeId);
      
      // 記錄操作日誌
      await logger.logUserAction(
        user,
        'conversation_assign',
        'conversation',
        {
          before: { assignedTo: originalConversation.assignedTo },
          after: { assignedTo: assigneeId },
          context: { conversationId }
        },
        {
          ipAddress: c.req.header('CF-Connecting-IP'),
          userAgent: c.req.header('User-Agent'),
          resourceId: conversationId
        }
      );
      
      // 記錄分析指標
      await analytics.recordMetric({
        name: 'conversation_assignment',
        value: 1,
        timestamp: Date.now(),
        tags: {
          assignerId: user.id.toString(),
          assigneeId: assigneeId.toString(),
          conversationId
        }
      });
      
      return c.json({
        success: true,
        message: 'Conversation assigned successfully'
      });
      
    } catch (error) {
      // 記錄錯誤日誌
      await logger.logUserAction(
        user,
        'conversation_assign_failed',
        'conversation',
        {
          context: { 
            conversationId, 
            assigneeId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        },
        {
          ipAddress: c.req.header('CF-Connecting-IP'),
          userAgent: c.req.header('User-Agent'),
          resourceId: conversationId
        }
      );
      
      throw error;
    }
  }
);
```

## 5. 最佳實踐

### 權限控制最佳實踐

1. **最小權限原則**: 只給用戶完成工作所需的最小權限
2. **定期審查**: 定期檢查和更新用戶權限
3. **角色分離**: 避免單一用戶擁有過多權限
4. **權限繼承**: 合理使用角色繼承減少管理複雜度

### 日誌記錄最佳實踐

1. **記錄關鍵操作**: 所有涉及數據變更的操作都應記錄
2. **包含上下文**: 記錄足夠的上下文信息以便後續分析
3. **保護敏感信息**: 避免在日誌中記錄密碼等敏感信息
4. **定期清理**: 根據保留策略定期清理舊日誌

### 分析統計最佳實踐

1. **選擇關鍵指標**: 專注於對業務最重要的指標
2. **實時監控**: 對關鍵指標設置實時監控和警報
3. **趨勢分析**: 關注指標的變化趨勢而不僅僅是絕對值
4. **數據驅動決策**: 基於分析結果做出業務決策

## 6. 故障排除

### 常見問題

#### 權限檢查失敗
- 檢查用戶是否有正確的角色分配
- 確認權限定義是否正確
- 檢查權限緩存是否過期

#### 日誌記錄失敗
- 檢查資料庫連接是否正常
- 確認 KV 存儲是否可用
- 檢查日誌格式是否正確

#### 分析數據不準確
- 檢查指標記錄是否完整
- 確認時間範圍設置是否正確
- 檢查數據聚合邏輯是否正確

### 監控和警報

建議設置以下監控指標：

- 權限檢查失敗率
- 日誌記錄失敗率
- 關鍵業務指標異常
- 系統效能指標異常

## 7. 擴展和自定義

### 自定義權限

```typescript
// 定義自定義權限
const CUSTOM_PERMISSIONS = {
  EXPORT_DATA: { resource: 'data', action: 'export' },
  VIEW_ANALYTICS: { resource: 'analytics', action: 'view' },
  MANAGE_INTEGRATIONS: { resource: 'integration', action: 'manage' }
};

// 創建自定義角色
const dataAnalystRole = await rbac.createRole({
  name: 'data_analyst',
  displayName: '數據分析師',
  permissions: [
    'conversation:view_all',
    'data:export',
    'analytics:view'
  ]
}, adminUserId);
```

### 自定義指標

```typescript
// 定義業務特定指標
await analytics.recordMetric({
  name: 'customer_retention_rate',
  value: retentionRate,
  timestamp: Date.now(),
  tags: {
    period: 'monthly',
    cohort: '2024-01'
  },
  unit: 'percentage'
});

// 自定義分析邏輯
class CustomAnalytics extends EnterpriseAnalyticsEngine {
  async calculateCustomerLifetimeValue(customerId: number): Promise<number> {
    // 實現自定義分析邏輯
    return 0;
  }
}
```

這個企業級功能系統為你的多渠道客服平台提供了完整的權限控制、操作審計和數據分析能力，確保系統的安全性、合規性和可觀測性。