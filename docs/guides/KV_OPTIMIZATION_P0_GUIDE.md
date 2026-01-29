# KV 優化 P0 部署指南

**創建日期**: 2025-01-08
**優化版本**: v3.0
**預期效果**: 100% 減少 KV 寫入操作（960 writes/day → 0 writes/day）

---

## 📋 變更摘要

### 核心優化

**問題**：
- 每次 API 請求都讀取 KV 檢查活動時間
- 每 15 分鐘寫入一次 KV 更新活動時間
- 10 個用戶 × 10 請求/小時 × 24 小時 = 960 KV 寫入/天（96% quota 使用率 ⚠️）

**解決方案**：
- ✅ 移除 KV 操作，改用 Worker-scoped Map
- ✅ 純記憶體去重邏輯（15 分鐘間隔）
- ✅ 零網路調用，性能更佳
- ✅ 100% KV quota 節省

### 修改文件

1. **`src/utils/auth.ts`**
   - 添加 `lastActivityCache` Map（全域記憶體快取）
   - 重構 `updateUserActivityDebounced`（零 KV 操作）
   - 新增 `getActivityCacheStats()`（監控函數）
   - 新增 `clearActivityCache()`（測試函數）

2. **`src/middleware/auth.ts`**
   - 集成 `incrementRequestCounter`（請求頻率追蹤）
   - 集成 `trackTheoreticalKVSavings`（節省量追蹤）

3. **`src/handlers/kv-optimization-monitoring.ts`** (新增)
   - 5 個監控端點（僅 admin 可訪問）
   - 實時追蹤活動快取狀態
   - 計算理論 KV 節省量
   - 檢測高頻請求異常

4. **`src/index.ts`**
   - 註冊 `/api/monitoring/kv` 路由
   - Pre-register BEFORE unified route system（關鍵！）

---

## 🚀 部署步驟

### Step 1: 本地測試

```bash
# 1. 運行自動化測試
bun run scripts/test-kv-optimization.ts
# 或
npx tsx scripts/test-kv-optimization.ts

# 預期輸出：
# ✅ ALL TESTS PASSED - KV OPTIMIZATION IS WORKING CORRECTLY

# 2. 編譯檢查
npm run build

# 3. 本地開發環境測試
npm run dev
```

### Step 2: 驗證監控端點

本地環境（http://localhost:8787）測試：

```bash
# 獲取管理員 token（替換 YOUR_ADMIN_TOKEN）
export TOKEN="YOUR_ADMIN_TOKEN"

# 1. 檢查活動快取狀態
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/api/monitoring/kv/activity-cache | jq

# 2. 檢查 KV 節省統計
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/api/monitoring/kv/savings | jq

# 3. 檢查健康狀態
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8787/api/monitoring/kv/health | jq
```

### Step 3: 部署到生產環境

```bash
# 1. 部署到 Cloudflare Workers
npm run deploy

# 2. 等待 1-2 分鐘讓 Worker 啟動

# 3. 驗證監控端點（生產環境）
curl -H "Authorization: Bearer $TOKEN" \
  https://YOUR_PRODUCTION_DOMAIN/api/monitoring/kv/health | jq
```

### Step 4: 持續監控

部署後 **24 小時內**觀察：

1. **Cloudflare Dashboard → KV → Analytics**
   - 查看 SESSIONS namespace 的寫入操作
   - 預期：接近 0 writes/day（只有登入/登出）

2. **監控端點**（每小時檢查一次）
   ```bash
   # 檢查 KV 節省量
   curl -H "Authorization: Bearer $TOKEN" \
     https://YOUR_DOMAIN/api/monitoring/kv/savings | jq '.data.savings.projectedDaily'

   # 預期輸出：
   # {
   #   "savedReads": 2400,
   #   "savedWrites": 960,
   #   "savedWritesPercentage": "96.00%"
   # }
   ```

3. **檢測異常**
   ```bash
   # 查看高頻用戶
   curl -H "Authorization: Bearer $TOKEN" \
     https://YOUR_DOMAIN/api/monitoring/kv/request-frequency | jq '.data.highFrequencyUsers'
   ```

---

## 📊 監控端點說明

### 1. GET /api/monitoring/kv/activity-cache

**用途**: 查看活動快取當前狀態

**示例響應**:
```json
{
  "success": true,
  "data": {
    "cache": {
      "size": 10,
      "estimatedMemoryKB": 0.16,
      "entries": [
        {
          "userId": "user-123",
          "lastUpdate": 1704729600000,
          "ageMinutes": 5
        }
      ]
    },
    "optimization": {
      "version": "v3.0",
      "implementation": "Pure in-memory debouncing",
      "kvOperations": "Zero KV reads/writes",
      "memoryFootprint": "0.16 KB"
    }
  }
}
```

### 2. GET /api/monitoring/kv/request-frequency

**用途**: 檢測高頻請求用戶（找出潛在問題）

**示例響應**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 10,
    "topUsers": [
      {
        "userId": "user-123",
        "currentHourRequests": 25,
        "averageRequestsPerHour": "20.5",
        "peakRequestsPerHour": 35,
        "isHighFrequency": false
      }
    ],
    "highFrequencyUsers": [],
    "summary": {
      "totalRequestsThisHour": 150,
      "averageRequestsPerUser": "15.0"
    }
  }
}
```

**⚠️ 警告閾值**:
- `currentHourRequests > 50`: 當前小時請求過高
- `peakRequestsPerHour > 100`: 歷史峰值異常

### 3. GET /api/monitoring/kv/savings

**用途**: 計算 KV quota 節省量

**示例響應**:
```json
{
  "success": true,
  "data": {
    "optimization": {
      "version": "v3.0",
      "status": "Active since 2025-01-08T10:00:00Z"
    },
    "savings": {
      "projectedDaily": {
        "savedReads": 2400,
        "savedWrites": 960,
        "savedWritesPercentage": "96.00%"
      }
    },
    "freeTierImpact": {
      "dailyWriteLimit": 1000,
      "quotaUtilizationBefore": "96.0%",
      "quotaUtilizationAfter": "0%",
      "quotaSavings": "960 writes/day freed up"
    }
  }
}
```

### 4. GET /api/monitoring/kv/health

**用途**: 整體健康檢查

**示例響應**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "summary": {
      "optimizationActive": true,
      "cacheSizeOK": true,
      "noHighFrequencyAnomalies": true,
      "kvSavingsDetected": true
    },
    "metrics": {
      "cacheSize": 10,
      "memoryUsageKB": 0.16,
      "requestCountersActive": 10,
      "uptimeHours": "12.5",
      "kvReadsSaved": 1500,
      "kvWritesSaved": 600
    },
    "warnings": null,
    "recommendations": ["System operating optimally"]
  }
}
```

**健康狀態**:
- `healthy`: 一切正常 ✅
- `warning`: 有警告但不嚴重 ⚠️
- `error`: 發現問題需要處理 ❌

### 5. POST /api/monitoring/kv/reset

**用途**: 重置監控計數器（僅用於測試）

**請求**:
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://YOUR_DOMAIN/api/monitoring/kv/reset
```

---

## ⚠️ 重要注意事項

### 權衡取捨

| 項目 | 影響 | 可接受性 |
|------|------|---------|
| **Worker 重啟** | 快取丟失，最多 15 分鐘活動時間不準確 | ✅ 可接受（Worker 通常運行數小時）|
| **多 Worker 實例** | 每個實例獨立快取 | ✅ 可接受（debounce 仍然生效）|
| **記憶體使用** | 10,000 用戶 ≈ 160 KB | ✅ 可接受（Worker 有 128 MB 限制）|

### 回滾計劃

如果需要回滾到 v2.0（KV-based debouncing）：

```bash
git revert <commit-hash>
npm run deploy
```

或手動恢復：
1. 恢復 `src/utils/auth.ts` 中的 `updateUserActivityDebounced`
2. 移除 `incrementRequestCounter` 調用
3. 重新部署

---

## 📈 預期成效

### 性能提升

| 指標 | v2.0 (KV) | v3.0 (Memory) | 改善 |
|------|-----------|---------------|------|
| KV 讀取/天 | 2,400 | 0 | ✅ -100% |
| KV 寫入/天 | 960 | 0 | ✅ -100% |
| D1 寫入/天 | 960 | 960 | 無變化 |
| 響應時間 | ~50ms | ~5ms | ✅ -90% |
| Quota 使用率 | 96% | 0% | ✅ -96% |

### Cloudflare KV Free Tier

- **每日寫入限制**: 1,000 次
- **優化前使用**: 960 次（96%）⚠️
- **優化後使用**: ~40 次（4%）✅（僅登入/登出）
- **釋放額度**: 960 次/天 ✅

---

## 🐛 故障排除

### 問題 1: 監控端點返回 401

**原因**: 沒有管理員權限或 token 無效

**解決**:
```bash
# 檢查 token 是否有效
curl -H "Authorization: Bearer $TOKEN" \
  https://YOUR_DOMAIN/api/system/health

# 確認用戶角色為 admin
```

### 問題 2: 健康檢查顯示 "No KV read savings detected"

**原因**: Worker 剛啟動，還沒有請求進來

**解決**: 等待 1 小時後重新檢查，或手動發送測試請求

### 問題 3: 記憶體使用過高（>500 KB）

**原因**: 用戶數量過多或快取未清理

**解決**:
```bash
# 手動清理快取（重啟 Worker）
wrangler deploy

# 或檢查是否有記憶體洩漏
curl -H "Authorization: Bearer $TOKEN" \
  https://YOUR_DOMAIN/api/monitoring/kv/activity-cache | jq '.data.cache.size'
```

---

## ✅ 驗收標準

部署後 24 小時內：

- [ ] Cloudflare KV Dashboard 顯示 SESSIONS 寫入量 < 100/day
- [ ] `/api/monitoring/kv/health` 返回 `"status": "healthy"`
- [ ] `/api/monitoring/kv/savings` 顯示 `savedWrites > 900`
- [ ] 無用戶報告 `lastActive` 時間異常
- [ ] 無高頻請求異常用戶（`isHighFrequency: false`）

---

## 📞 支援

如遇問題，請檢查：
1. **日誌**: `wrangler tail` 查看 Worker 日誌
2. **監控**: 所有 5 個監控端點的輸出
3. **KV Dashboard**: Cloudflare Dashboard → KV → Analytics

相關文檔：
- [CLAUDE.md - KV Configuration](../CLAUDE.md#kv-configuration)
- [KV Config Source](../src/config/kv-config.ts)
