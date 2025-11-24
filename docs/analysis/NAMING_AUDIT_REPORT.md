# 命名規範審查報告 (Naming Convention Audit Report)

**審查日期**: 2025-11-10
**審查範圍**: 整個專案 (Backend + Frontend)
**審查標準**: [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md)

---

## ✅ Executive Summary / 執行摘要

### 已修復的問題 (Fixed Issues)

| 文件 | 問題數量 | 狀態 |
|------|---------|------|
| `src/handlers/customer.ts` | 15+ 處 | ✅ 已修復 |
| `src/modules/session/handlers/session-main.ts` | 1 處 | ✅ 已修復 |
| `src/modules/session/handlers/session.ts` | 3 處 | ✅ 已修復 |
| `src/modules/session/services/analytics-service.ts` | 1 處 | ✅ 已修復 |
| `frontend/eslint.config.js` | - | ✅ 已添加 camelcase 規則 |

**總計已修復**: ~20+ 處 snake_case 使用問題

---

## ⚠️ 待修復的問題 (Pending Issues)

### 🔴 Priority 1: Drizzle 查詢結果命名

#### 1. `src/services/message-recall-service.ts`

**問題位置**: Line 283-284

```typescript
// ❌ 錯誤
.select({
  conversation_id: conversations.id,
  customer_name: customers.displayName,
})
```

**應修正為**:

```typescript
// ✅ 正確
.select({
  conversationId: conversations.id,
  customerName: customers.displayName,
})
```

**影響**: 影響消息撤回功能的數據查詢

---

#### 2. `src/modules/delayed-message/infrastructure/StorageService.ts`

**問題位置**: Line 133-134

```typescript
// ❌ 錯誤
.select({
  conversation_id: conversations.id,
  customer_name: customers.displayName,
})
```

**應修正為**:

```typescript
// ✅ 正確
.select({
  conversationId: conversations.id,
  customerName: customers.displayName,
})
```

**影響**: 影響延遲消息存儲服務的查詢

---

### 🟡 Priority 2: 非 Drizzle 對象屬性命名

#### 3. `src/durable-objects/DelayedMessageScheduler.ts`

**問題位置**: Line 557-565 (metrics 對象)

```typescript
// ❌ 錯誤
{
  messages_scheduled_total: this.metrics.messagesScheduledTotal,
  messages_sent_total: this.metrics.messagesSentTotal,
  messages_failed_total: this.metrics.messagesFailedTotal,
  messages_cancelled_total: this.metrics.messagesCancelledTotal,
  retry_attempts_total: this.metrics.retryAttemptsTotal,
  dlq_writes_total: this.metrics.dlqWritesTotal,
  dlq_write_failures_total: this.metrics.dlqWriteFailuresTotal,
  alarm_triggers_total: this.metrics.alarmTriggersTotal,
  idempotency_preventions_total: this.metrics.idempotencyPreventionsTotal
}
```

**應修正為**:

```typescript
// ✅ 正確
{
  messagesScheduledTotal: this.metrics.messagesScheduledTotal,
  messagesSentTotal: this.metrics.messagesSentTotal,
  messagesFailedTotal: this.metrics.messagesFailedTotal,
  messagesCancelledTotal: this.metrics.messagesCancelledTotal,
  retryAttemptsTotal: this.metrics.retryAttemptsTotal,
  dlqWritesTotal: this.metrics.dlqWritesTotal,
  dlqWriteFailuresToal: this.metrics.dlqWriteFailuresTotal,
  alarmTriggersTotal: this.metrics.alarmTriggersTotal,
  idempotencyPreventionsTotal: this.metrics.idempotencyPreventionsTotal
}
```

**問題位置**: Line 588, 597, 602, 617, 619 (其他 metrics 相關)

```typescript
// ❌ 錯誤
next_alarm_scheduled: ...,
sample_count: ...,
durable_object_id: ...,
uptime_seconds: ...
```

**應修正為**:

```typescript
// ✅ 正確
nextAlarmScheduled: ...,
sampleCount: ...,
durableObjectId: ...,
uptimeSeconds: ...
```

**影響**: 影響延遲消息調度器的監控指標格式

---

#### 4. `src/modules/file-management/services/validation-service.ts`

**問題位置**: Line 147-148

```typescript
// ❌ 錯誤
{
  line_platform: this.getRulesForPlatform('line'),
  facebook_platform: this.getRulesForPlatform('facebook'),
}
```

**應修正為**:

```typescript
// ✅ 正確
{
  linePlatform: this.getRulesForPlatform('line'),
  facebookPlatform: this.getRulesForPlatform('facebook'),
}
```

**影響**: 影響文件驗證服務的平台規則組織

---

#### 5. `src/modules/session/handlers/session.ts`

**問題位置**: Line 45 (查詢參數處理)

```typescript
// ❌ 錯誤（可能）
conversation_id: c.req.query('conversation_id'),
```

**需要確認**: 如果這是從 URL 查詢參數獲取，則屬於外部 API 接口，可能需要保持為 `conversation_id` 以保持向後兼容。但如果是內部使用，應該修正為：

```typescript
// ✅ 建議
conversationId: c.req.query('conversation_id'),
```

**影響**: 可能影響 API 向後兼容性（需要評估）

---

### 🟢 Priority 3: 合法的 snake_case 使用（無需修改）

以下使用 snake_case 是**符合規範**的，**不需要修改**：

#### ✅ 環境變量 (SCREAMING_SNAKE_CASE)

- `src/handlers/webhook-multitenant.ts:180-181`
  ```typescript
  // ✅ 正確：環境變量使用 SCREAMING_SNAKE_CASE
  LINE_CHANNEL_ACCESS_TOKEN
  LINE_CHANNEL_SECRET
  ```

- `src/services/emergency-rollback-service.ts:33-35`
  ```typescript
  // ✅ 正確：常量使用 SCREAMING_SNAKE_CASE
  ERROR_RATE: 0.05,
  CONNECTION_FAILURES: 0.1,
  ```

#### ✅ 模塊元數據常量

- `src/core/module-templates.ts:247-249`
  ```typescript
  // ✅ 正確：常量使用 SCREAMING_SNAKE_CASE
  MODULE_DESCRIPTION
  MODULE_VERSION
  MODULE_AUTHOR
  ```

---

## 📊 統計摘要

### 問題分佈

| 類別 | 數量 | 優先級 |
|------|------|--------|
| Drizzle 查詢結果命名 | 2 個文件 (4 處) | 🔴 High |
| 非 Drizzle 對象屬性 | 3 個文件 (13+ 處) | 🟡 Medium |
| 合法使用（無需修改） | 4 個文件 (10+ 處) | 🟢 N/A |

### 文件統計

```
總掃描文件數: 200+ TypeScript 文件
發現問題文件: 5 個
已修復文件: 4 個
待修復文件: 5 個
合法使用文件: 4 個
```

---

## 🔧 修復建議

### 立即修復（本週內）

1. ✅ **Drizzle 查詢命名** (Priority 1)
   - `src/services/message-recall-service.ts`
   - `src/modules/delayed-message/infrastructure/StorageService.ts`

2. ⚠️ **驗證和測試**
   - 修復後運行 `npm run lint:check`
   - 運行相關單元測試
   - 確保沒有破壞現有功能

### 下週修復

3. **非關鍵對象命名** (Priority 2)
   - `src/durable-objects/DelayedMessageScheduler.ts` (metrics)
   - `src/modules/file-management/services/validation-service.ts`

4. **API 接口評估** (Priority 2)
   - 評估 `src/modules/session/handlers/session.ts` 的向後兼容性影響
   - 如果需要保持向後兼容，考慮創建適配層

### 長期改進

5. **防護措施**
   - ✅ 已添加 ESLint camelcase 規則到 `frontend/eslint.config.js`
   - 為 backend 添加相同的 ESLint 規則
   - 在 CI/CD 中強制執行 linting 檢查

6. **文檔和培訓**
   - ✅ 已創建 `NAMING_CONVENTIONS.md` 文檔
   - 在團隊會議中分享命名規範
   - 在 PR review 時檢查命名規範

---

## 🎯 修復優先級決策樹

```
是否為 Drizzle 查詢結果？
├─ 是 → 🔴 Priority 1 (立即修復)
│   └─ TypeScript 會立刻報錯
│
└─ 否 → 是否為公開 API 響應？
    ├─ 是 → 🟡 Priority 2 (評估影響)
    │   └─ 考慮向後兼容性
    │
    └─ 否 → 是否為常量/環境變量？
        ├─ 是 → 🟢 無需修改
        │   └─ SCREAMING_SNAKE_CASE 合法
        │
        └─ 否 → 🟡 Priority 2 (計劃修復)
            └─ 內部使用，影響較小
```

---

## 📝 後續行動

### 開發團隊

- [ ] 修復 Priority 1 問題 (2 個文件)
- [ ] 運行完整測試套件驗證修復
- [ ] 評估 API 向後兼容性影響
- [ ] 修復 Priority 2 問題 (3 個文件)
- [ ] 為 backend 添加 ESLint camelcase 規則

### DevOps 團隊

- [ ] 在 CI/CD 流程中添加 linting 檢查
- [ ] 設置 pre-commit hooks 強制命名規範

### 產品團隊

- [ ] 評估 API 變更的客戶影響
- [ ] 規劃 API 版本升級策略（如需要）

---

## 🔗 相關資源

- [命名規範指南](./NAMING_CONVENTIONS.md)
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
- [ESLint camelcase 規則](https://eslint.org/docs/latest/rules/camelcase)

---

**報告生成**: 2025-11-10
**下次審查**: 2025-11-17 (修復完成後)
