


- ****: 1,167
- ****: 71.4% (833/1,167)
- ****: 28.6% (334/1,167)
- ****: 100%
- **API **: 95%

## ()

### 1. DOM

```typescript
// frontend/vitest.setup.ts
import { config } from '@vue/test-utils'

// DOM
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

// DOM
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

// Vue Test Utils
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

### 2.

```typescript
// src/utils/error-messages.ts
export const ERROR_MESSAGES = {
 //
 CONTENT_REQUIRED: '',
 FETCH_FAILED: '',
 NETWORK_ERROR: '',
 UNAUTHORIZED: '',
 FORBIDDEN: '',
 NOT_FOUND: '',
 VALIDATION_ERROR: ''
} as const

//
export const expectErrorMessage = (actual: string, expected: keyof typeof ERROR_MESSAGES) => {
 expect(actual).toBe(ERROR_MESSAGES[expected])
}
```

### 3. Vue Router Mock

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


### 1.

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

### 2.

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

 //
 await Promise.all(messages.map(msg => processMessage(msg)))

 const endTime = Date.now()
 const duration = endTime - startTime

 expect(duration).toBeLessThan(5000) // 5
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

 expect(successCount).toBeGreaterThan(95) // 95%
 })
})
```

### 3.

```typescript
// tests/e2e/conversation-flow.test.ts
import { test, expect } from '@playwright/test'

test.describe('Complete Conversation Flow', () => {
 test('should handle LINE message to response flow', async ({ page }) => {
 // 1. LINE Webhook
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

 // 2.
 await page.goto('/admin-dashboard.html')
 await expect(page.locator('[data-testid="conversation-list"]')).toContainText('test_user')

 // 3.
 await page.click('[data-testid="conversation-item"]')
 await page.fill('[data-testid="message-input"]', 'Hello back!')
 await page.click('[data-testid="send-button"]')

 // 4.
 await expect(page.locator('[data-testid="message-sent"]')).toBeVisible()
 })
})
```


### 1.

```typescript
// src/utils/monitoring.ts
export class MonitoringService {
 static async recordMetric(name: string, value: number, tags: Record<string, string> = {}) {
 // Cloudflare Analytics Engine
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

//
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

### 2. CI/CD

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


### (1-2 )
1. ** DOM ** - 33
2. **** -
3. ** Mock ** -

### (3-5 )
1. ** Facebook ** - 90%
2. **** -
3. **** -

### (1 )
1. **** -
2. **** -
3. ** CI/CD** -


- ****: > 95%
- ****: 100%
- ****: > 90%
- **API **: > 95%


- **API **: < 200ms (P95)
- **Webhook **: < 100ms (P95)
- ****: < 2s
- ****: > 99.9%


- **Webhook **: 100%
- ****: 100%
- ****: 100%
- ****: 100%


- ****: 71.4% 95%+
- ****:
- ****:
- ****:
- ****:

****: 2-3
****: 1-2
****: ()