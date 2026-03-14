# KV 使用最佳實踐指南

**版本**: 1.0
**創建日期**: 2025-01-08
**適用範圍**: Cloudflare Workers + KV

---

##  核心原則

### 1. **選擇正確的數據存儲**

| 數據類型 | 推薦存儲 | 原因 |
|---------|---------|------|
| **Stateful 數據** | KV SESSIONS | 需要持久化跨請求保存 |
| **Regenerable 快取** | KV CACHE | 可重新生成的數據 |
| **Debounce 狀態** | Worker Memory | 臨時狀態，無需持久化 |
| **Session 數據** | KV | 需要跨 Worker 實例共享 |
| **Rate Limit 計數** | Durable Objects | 需要強一致性 |

**決策樹**：
```
數據是否需要持久化？
├─ NO  → Worker Memory (Map, Set)
└─ YES → 數據是否可重新生成？
    ├─ YES → KV CACHE
    └─ NO  → 數據是否需要強一致性？
        ├─ YES → Durable Objects
        └─ NO  → KV SESSIONS
```

---

### 2. **最小化 KV 寫入操作**

####  反模式：每次驗證都寫入

```typescript
// BAD: 每個請求都寫入 KV
export async function validateSession(sessionId: string) {
  const session = await kv.get(`session:${sessionId}`)

  // 更新最後活動時間 - 每次都寫入！
  session.lastActivity = Date.now()
  await kv.put(`session:${sessionId}`, JSON.stringify(session))  //  高頻寫入

  return session
}
```

**問題**：
- 10 用戶 × 10 請求/小時 × 24 小時 = **2,400 KV writes/day** 
- 超過 Free Tier 限制（1,000 writes/day）

####  最佳實踐：純讀取驗證 + 記憶體 Debounce

```typescript
// GOOD: 純讀取驗證，配合記憶體去重
const lastActivityCache = new Map<string, number>()

export async function validateSession(sessionId: string) {
  // 純讀取操作（無寫入）
  const session = await kv.get(`session:${sessionId}`)

  // 使用記憶體快取去重
  const userId = session.userId
  const now = Date.now()
  const lastUpdate = lastActivityCache.get(userId)

  // 只在必要時寫入 D1（不寫 KV）
  if (!lastUpdate || (now - lastUpdate) > 15 * 60 * 1000) {
    await db.update(agents)
      .set({ lastActive: new Date().toISOString() })
      .where(eq(agents.id, userId))

    lastActivityCache.set(userId, now)  // 記憶體快取
  }

  return session
}
```

**效果**：
- KV 寫入：**0 writes/day** 
- D1 寫入：960 writes/day（保持不變）
- 性能提升：無網路調用延遲

---

### 3. **利用 KV 的自動過期機制**

####  反模式：手動管理過期

```typescript
// BAD: 手動儲存過期時間並檢查
await kv.put(key, JSON.stringify({
  data: value,
  expiresAt: Date.now() + 86400000  // 手動計算過期時間
}))

// 每次讀取都檢查過期
const cached = await kv.get(key)
if (cached && JSON.parse(cached).expiresAt < Date.now()) {
  await kv.delete(key)  // 手動刪除 - 額外的 KV 操作！
  return null
}
```

**問題**：
- 額外的刪除操作（浪費 KV quota）
- 需要手動處理過期邏輯
- 可能產生過期但未刪除的"幽靈"數據

####  最佳實踐：使用 expirationTtl

```typescript
// GOOD: 依賴 KV 自動過期
await kv.put(key, JSON.stringify(value), {
  expirationTtl: 86400  // Cloudflare 會自動刪除
})

// 讀取時無需檢查過期
const cached = await kv.get(key)  // null = 已過期或不存在
return cached ? JSON.parse(cached) : null
```

**優點**：
- Cloudflare 自動處理過期清理
- 無額外 KV 操作
- 代碼更簡潔可靠

---

### 4. **使用記憶體快取減少 KV 讀取**

####  兩層快取架構

```typescript
// GOOD: Memory → KV → Database
class TwoTierCache {
  private memoryCache = new Map<string, { data: any; cachedAt: number }>()
  private readonly MEMORY_TTL = 5 * 60 * 1000  // 5 分鐘

  async get(key: string): Promise<any> {
    // Layer 1: Memory Cache（最快）
    const memoryCached = this.memoryCache.get(key)
    if (memoryCached && (Date.now() - memoryCached.cachedAt) < this.MEMORY_TTL) {
      return memoryCached.data  //  即時返回
    }

    // Layer 2: KV Cache
    const kvCached = await kv.get(key)
    if (kvCached) {
      const data = JSON.parse(kvCached)
      this.memoryCache.set(key, { data, cachedAt: Date.now() })
      return data
    }

    // Layer 3: Database（最慢）
    const data = await db.query(...)

    // 寫入兩層快取
    await kv.put(key, JSON.stringify(data), { expirationTtl: 3600 })
    this.memoryCache.set(key, { data, cachedAt: Date.now() })

    return data
  }
}
```

**性能提升**：
- Memory hit: ~1ms 
- KV hit: ~10-50ms
- DB hit: ~50-200ms

---

### 5. **批量操作優化**

####  反模式：循環中的 KV 操作

```typescript
// BAD: N 次 KV 操作
for (const userId of userIds) {
  const data = await kv.get(`user:${userId}`)  // 串行執行
  results.push(data)
}
```

####  最佳實踐：並行批量操作

```typescript
// GOOD: 並行執行
const promises = userIds.map(userId =>
  kv.get(`user:${userId}`)
)
const results = await Promise.all(promises)  // 並行執行
```

**注意事項**：
- Cloudflare KV 不支持真正的批量 API
- 使用 `Promise.all` 模擬並行（仍然更快）
- 限制並行數量（建議 < 50 同時請求）

---

### 6. **合理的 TTL 設置**

| 數據類型 | 推薦 TTL | 原因 |
|---------|---------|------|
| **用戶 Session** | 30 天 | 長期登入狀態 |
| **WebSocket 連接** | 5 分鐘 | 連接通常短暫 |
| **API 響應快取** | 5-60 分鐘 | 平衡新鮮度與性能 |
| **聚合統計** | 1 小時 | 可容忍延遲 |
| **即時數據** | 30-60 秒 | 需要及時更新 |
| **永久配置** | 1 年 或不過期 | 很少變更 |

**配置示例**：
```typescript
// src/config/kv-config.ts
export const KV_TTL = {
  SESSION: 30 * 24 * 60 * 60, // 30 天
  WEBSOCKET_CONNECTION: 5 * 60, // 5 分鐘
  CACHE_MESSAGE: 24 * 60 * 60, // 24 小時
  CACHE_ANALYTICS: 60 * 60, // 1 小時
  CACHE_HTTP: 5 * 60, // 5 分鐘
  PERMANENT: 365 * 24 * 60 * 60, // 1 年
} as const
```

---

### 7. **避免 KV 作為數據庫使用**

####  反模式：頻繁更新的計數器

```typescript
// BAD: 使用 KV 做計數器
async function incrementCounter(userId: string) {
  const count = await kv.get(`counter:${userId}`)
  await kv.put(`counter:${userId}`, String(count + 1))  // 每次都寫入
}

// 10,000 次調用 = 10,000 KV writes 
```

####  最佳實踐：使用 Durable Objects

```typescript
// GOOD: 使用 Durable Objects 做計數器
class CounterDO {
  private state: DurableObjectState
  private counter = 0

  async increment() {
    this.counter++
    // 只在必要時持久化（如每 100 次）
    if (this.counter % 100 === 0) {
      await this.state.storage.put('counter', this.counter)
    }
    return this.counter
  }
}

// 10,000 次調用 = 100 次存儲寫入 
```

---

### 8. **監控與告警**

#### 設置 KV 使用率告警

```typescript
// 定期檢查 KV 使用率
async function checkKVQuota() {
  // Cloudflare Dashboard API 或自定義監控
  const stats = {
    dailyReads: await getKVReads(), // 從監控獲取
    dailyWrites: await getKVWrites(),
    dailyReadLimit: 100000,
    dailyWriteLimit: 1000
  }

  const writeUsage = (stats.dailyWrites / stats.dailyWriteLimit) * 100

  if (writeUsage > 80) {
    // 告警：接近限制
    await sendAlert({
      level: 'critical',
      message: `KV write usage at ${writeUsage.toFixed(1)}%`,
      data: stats
    })
  } else if (writeUsage > 50) {
    // 警告：超過一半
    await sendAlert({
      level: 'warning',
      message: `KV write usage at ${writeUsage.toFixed(1)}%`,
      data: stats
    })
  }
}

// 每小時檢查一次
setInterval(checkKVQuota, 60 * 60 * 1000)
```

---

##  開發檢查清單

在添加新 KV 操作前，請檢查：

- [ ] **是否真的需要 KV？** 能否用 Worker Memory 替代？
- [ ] **是否會高頻寫入？** 寫入頻率 > 1次/分鐘？
  - 如是 → 考慮 Debounce 或 Durable Objects
- [ ] **是否使用 expirationTtl？** 避免手動管理過期
- [ ] **是否有記憶體快取？** 減少 KV 讀取
- [ ] **TTL 設置合理？** 參考上表推薦值
- [ ] **是否並行操作？** 批量操作使用 Promise.all
- [ ] **是否監控使用率？** 添加日誌追蹤

---

##  常見問題

### Q1: Worker Memory 快取會在何時清除？

**A**: Worker 實例通常運行數小時，在以下情況清除：
- Worker 部署更新
- 長時間無請求（閒置）
- Cloudflare 基礎設施維護

**建議**: 記憶體快取適用於非關鍵、可重新生成的數據（如 debounce 狀態）

---

### Q2: KV 的最終一致性會影響 Session 嗎？

**A**: 影響極小：
- 寫入後 **通常 < 1 秒**即可全球讀取
- 最壞情況 **< 60 秒**
- Session 驗證通常在同一 region，延遲 < 100ms

**建議**: 如需強一致性（如金融交易），使用 Durable Objects

---

### Q3: 如何估算 KV quota 使用？

**計算公式**：
```
每日寫入 = 每小時請求數 × 寫入頻率 × 24 小時

示例：
- 每小時 100 請求
- 每 4 次請求寫入 1 次（Debounce）
- 每日寫入 = 100 ÷ 4 × 24 = 600 writes/day 
```

**檢查方法**：
```bash
# 使用監控端點
curl -H "Authorization: Bearer $TOKEN" \
  https://YOUR_DOMAIN/api/monitoring/kv/savings | jq '.data.projectedDaily'
```

---

### Q4: 何時該升級到 KV 付費方案？

**升級時機**：
- 每日寫入穩定 > 800 次（留 20% 緩衝）
- 需要更大存儲空間（> 1 GB）
- 需要更高讀取限制（> 100,000/day）

**成本**：
- 額外 1,000 writes = $0.50/month
- 額外 10,000,000 reads = $0.50/month
- 額外 1 GB 存儲 = $0.50/month

參考：[Cloudflare KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)

---

##  總結

**黃金法則**：

1.  **Prefer Memory over KV** - 能用記憶體就不用 KV
2.  **Read >> Write** - 最小化寫入操作
3.  **Let KV handle TTL** - 信任自動過期機制
4.  **Monitor Usage** - 持續追蹤 quota 使用率
5.  **Choose Right Tool** - KV, DO, Memory 各有所長

**這樣做的結果**：
-  穩定在 Free Tier 限制內
-  更快的響應時間
-  更低的成本
-  更好的可擴展性

---

**相關文檔**：
- [KV Optimization P0 Guide](./KV_OPTIMIZATION_P0_GUIDE.md)
- [Frontend Analysis Report](./KV_OPTIMIZATION_FRONTEND_ANALYSIS.md)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
