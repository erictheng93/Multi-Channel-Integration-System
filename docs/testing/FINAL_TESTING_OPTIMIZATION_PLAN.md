# 最終測試和調優計劃

## 📊 當前測試狀態總結

### 整體測試統計
- **總測試數**: 1,167 個測試
- **通過率**: 71.4% (833/1,167)
- **失敗率**: 28.6% (334/1,167)
- **核心功能**: 認證系統 100% 通過 ✅
- **API 層**: 95% 通過 ✅

## 🔴 立即修復項目 (第一優先級)

### 1. DOM 事件處理問題修復

```typescript
// frontend/vitest.setup.ts
import { config } from '@vue/test-utils'

// 修復 DOM 事件構造器問題
Object.defineProperty(window, 'Event', {
  value: class Event {
    type: string
    bubbles: boolean
    cancelable: boolean
    
    constructor(type: string, options: EventInit = {}) {
      this.type = type
      this.bubbles = options.bubbles || false
      this.cancelable = options.cancelable || false
    }
  }
})

// 修復其他 DOM 事件接口
Object.defineProperty(window, 'MouseEvent', {
  value: class MouseEvent extends Event {
    constructor(type: string, options: MouseEventInit = {}) {
      super(type, options)
    }
  }
})

Object.defineProperty(window, 'KeyboardEvent', {
  value: class KeyboardEvent extends Event {
    key: string
    code: string
    
    constructor(type: string, options: KeyboardEventInit = {}) {
      super(type, options)
      this.key = options.key || ''
      this.code = options.code || ''
    }
  }
})

// Vue Test Utils 全局配置
config.global.mocks = {
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  },
  $route: {
    path: '/',
    params: {},
    query: {},
    hash: '',
    name: null,
    meta: {}
  }
}
```

### 2. 錯誤訊息統一修復

```typescript
// src/utils/error-messages.ts
export const ERROR_MESSAGES = {
  // 統一使用中文錯誤訊息
  CONTENT_REQUIRED: '內容或媒體檔案為必填項',
  FETCH_FAILED: '獲取對話列表失敗',
  NETWORK_ERROR: '網路錯誤，無法載入對話列表',
  UNAUTHORIZED: '未授權訪問',
  FORBIDDEN: '權限不足',
  NOT_FOUND: '資源不存在',
  VALIDATION_ERROR: '資料驗證失敗'
} as const

// 在所有測試中使用統一的錯誤訊息
export const expectErrorMessage = (actual: string, expected: keyof typeof ERROR_MESSAGES) => {
  expect(actual).toBe(ERROR_MESSAGES[expected])
}
```

### 3. Vue Router Mock 標準化

```typescript
// tests/helpers/router-mock.ts
import { vi } from 'vitest'

export const createMockRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  currentRoute: {
    value: {
      path: '/',
      params: {},
      query: {},
      hash: '',
      name: null,
      meta: {}
    }
  }
})

export const createMockRoute = (overrides = {}) => ({
  path: '/',
  params: {},
  query: {},
  hash: '',
  name: null,
  meta: {},
  ...overrides
})
```

## 🔶 中優先級改進項目

### 1. 測試覆蓋率提升

```typescript
// tests/unit/integrations/facebook-adapter.test.ts
import { FacebookIntegrationService } from '../../../src/modules/integration/services/facebook-integration-service'

describe('FacebookAdapter', () => {
  let adapter: FacebookAdapter
  
  beforeEach(() => {
    adapter = new FacebookAdapter('test-secret', 'test-token')
  })
  
  describe('normalizeMessage', () => {
    test('should handle text messages', () => {
      const fbMessage = {
        sender: { id: 'user123' },
        message: { mid: 'msg123', text: 'Hello World' },
        timestamp: 1640995200000
      }
      
      const result = adapter.normalizeMessage(fbMessage)
      
      expect(result).toEqual({
        platform: 'facebook',
        userId: 'user123',
        messageId: 'msg123',
        content: 'Hello World',
        messageType: 'text',
        timestamp: new Date(1640995200000),
        metadata: { originalMessage: fbMessage }
      })
    })
    
    test('should handle image attachments', () => {
      const fbMessage = {
        sender: { id: 'user123' },
        message: { 
          mid: 'msg123', 
          attachments: [{ type: 'image', payload: { url: 'image.jpg' } }]
        },
        timestamp: 1640995200000
      }
      
      const result = adapter.normalizeMessage(fbMessage)
      expect(result.messageType).toBe('image')
    })
  })
  
  describe('verifyWebhook', () => {
    test('should verify valid signature', async () => {
      // Mock crypto.subtle for testing
      const mockSign = vi.fn().mockResolvedValue(new ArrayBuffer(20))
      global.crypto = {
        subtle: { sign: mockSign, importKey: vi.fn().mockResolvedValue({}) }
      } as any
      
      const result = await adapter.verifyWebhook('sha1=valid', 'test body')
      expect(result).toBe(true)
    })
  })
})
```

### 2. 性能測試套件

```typescript
// tests/performance/message-processing.test.ts
import { describe, test, expect } from 'vitest'

describe('Message Processing Performance', () => {
  test('should process 1000 messages within 5 seconds', async () => {
    const startTime = Date.now()
    const messages = Array.from({ length: 1000 }, (_, i) => ({
      id: `msg_${i}`,
      content: `Test message ${i}`,
      platform: 'line'
    }))
    
    // 批次處理訊息
    await Promise.all(messages.map(msg => processMessage(msg)))
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    expect(duration).toBeLessThan(5000) // 5 秒內完成
  })
  
  test('should handle concurrent webhook requests', async () => {
    const requests = Array.from({ length: 100 }, () => 
      fetch('/api/webhook', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })
    )
    
    const responses = await Promise.all(requests)
    const successCount = responses.filter(r => r.ok).length
    
    expect(successCount).toBeGreaterThan(95) // 95% 成功率
  })
})
```

### 3. 端到端測試

```typescript
// tests/e2e/conversation-flow.test.ts
import { test, expect } from '@playwright/test'

test.describe('Complete Conversation Flow', () => {
  test('should handle LINE message to response flow', async ({ page }) => {
    // 1. 模擬 LINE Webhook
    const webhookResponse = await page.request.post('/api/webhooks/line', {
      data: {
        events: [{
          type: 'message',
          message: { type: 'text', text: 'Hello' },
          source: { userId: 'test_user' },
          replyToken: 'test_token'
        }]
      }
    })
    expect(webhookResponse.ok()).toBeTruthy()
    
    // 2. 檢查對話是否創建
    await page.goto('/admin-dashboard.html')
    await expect(page.locator('[data-testid="conversation-list"]')).toContainText('test_user')
    
    // 3. 發送回覆
    await page.click('[data-testid="conversation-item"]')
    await page.fill('[data-testid="message-input"]', 'Hello back!')
    await page.click('[data-testid="send-button"]')
    
    // 4. 驗證訊息已發送
    await expect(page.locator('[data-testid="message-sent"]')).toBeVisible()
  })
})
```

## 🔷 長期優化項目

### 1. 監控和告警系統

```typescript
// src/utils/monitoring.ts
export class MonitoringService {
  static async recordMetric(name: string, value: number, tags: Record<string, string> = {}) {
    // 記錄到 Cloudflare Analytics Engine
    if (typeof ANALYTICS !== 'undefined') {
      ANALYTICS.writeDataPoint({
        blobs: [name, JSON.stringify(tags)],
        doubles: [value],
        indexes: [Date.now()]
      })
    }
  }
  
  static async recordError(error: Error, context: Record<string, any> = {}) {
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    })
    
    await this.recordMetric('error_count', 1, {
      error_type: error.constructor.name,
      ...context
    })
  }
  
  static async recordPerformance(operation: string, duration: number) {
    await this.recordMetric('operation_duration', duration, {
      operation
    })
    
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${operation} took ${duration}ms`)
    }
  }
}

// 使用範例
export const withMonitoring = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now()
  try {
    const result = await fn()
    await MonitoringService.recordPerformance(operation, Date.now() - startTime)
    return result
  } catch (error) {
    await MonitoringService.recordError(error as Error, { operation })
    throw error
  }
}
```

### 2. 自動化測試 CI/CD

```yaml
# .github/workflows/test-and-deploy.yml
name: Test and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci
      
      - name: Run backend tests
        run: npm test -- --coverage
      
      - name: Run frontend tests
        run: cd frontend && npm test -- --coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info,./frontend/coverage/lcov.info
      
      - name: Type check
        run: |
          npm run type-check
          cd frontend && npm run type-check
      
      - name: Lint
        run: |
          npm run lint
          cd frontend && npm run lint

  e2e-test:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start development server
        run: npm run dev &
        
      - name: Wait for server
        run: npx wait-on http://localhost:8787
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload E2E results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    runs-on: ubuntu-latest
    needs: [test, e2e-test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 📋 測試執行計劃

### 第一階段：緊急修復 (1-2 天)
1. **修復 DOM 事件問題** - 解決 33 個前端測試失敗
2. **統一錯誤訊息** - 修復中英文不一致問題
3. **標準化 Mock 配置** - 統一測試環境配置

### 第二階段：覆蓋率提升 (3-5 天)
1. **補充 Facebook 測試** - 達到 90% 覆蓋率
2. **完善組件測試** - 修復視圖組件測試
3. **添加整合測試** - 端到端流程測試

### 第三階段：性能優化 (1 週)
1. **性能測試套件** - 建立性能基準
2. **監控系統** - 實時監控和告警
3. **自動化 CI/CD** - 完整的測試和部署流程

## 🎯 成功標準

### 測試品質目標
- **整體通過率**: > 95%
- **核心功能覆蓋率**: 100%
- **前端組件覆蓋率**: > 90%
- **API 端點覆蓋率**: > 95%

### 性能目標
- **API 響應時間**: < 200ms (P95)
- **Webhook 處理時間**: < 100ms (P95)
- **前端首屏載入**: < 2s
- **系統可用性**: > 99.9%

### 安全目標
- **Webhook 簽名驗證**: 100% 通過
- **權限檢查**: 100% 覆蓋
- **輸入驗證**: 100% 覆蓋
- **敏感資料加密**: 100% 實施

## 📊 預期結果

執行完整的測試和優化計劃後，系統將達到：

- **測試通過率**: 從 71.4% 提升到 95%+
- **代碼品質**: 達到生產級別標準
- **性能表現**: 滿足企業級需求
- **安全性**: 符合行業最佳實踐
- **可維護性**: 完整的文檔和測試覆蓋

**預計完成時間**: 2-3 週
**投入資源**: 1-2 名開發人員
**風險等級**: 低 (主要是測試修復，不涉及核心邏輯變更)