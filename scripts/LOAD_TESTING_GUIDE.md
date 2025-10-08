# WebSocket 負載測試指南

## 📋 測試腳本功能

`websocket-load-test.js` 提供全面的 WebSocket 並發連接測試能力：

### 核心功能
- ✅ **100+ 並發連接測試** - 模擬大量同時連接
- ✅ **連接時間統計** - P50/P95/P99 延遲分析
- ✅ **消息吞吐量測試** - 持續發送測試消息
- ✅ **延遲監控** - 實時消息延遲測量
- ✅ **錯誤追蹤** - 詳細錯誤日誌和統計
- ✅ **自動認證** - JWT Token 自動獲取
- ✅ **批次連接** - 避免瞬時過載

## 🚀 快速開始

### 前置需求
```bash
# 確保安裝了 ws 套件
npm install ws
```

### 基本用法
```bash
# 預設測試：100 並發連接，持續 60 秒
node scripts/websocket-load-test.js

# 自定義測試：200 並發連接，持續 120 秒
node scripts/websocket-load-test.js 200 120

# 短時間快速測試：50 並發連接，持續 30 秒
node scripts/websocket-load-test.js 50 30
```

## 📊 測試場景範例

### 1. 基準性能測試
```bash
# 測試 50 個並發連接的基準性能
node scripts/websocket-load-test.js 50 60
```
**預期結果：**
- 連接成功率：> 98%
- P95 連接時間：< 500ms
- P95 延遲：< 200ms
- 錯誤率：< 1%

### 2. 目標負載測試 (100 並發)
```bash
# 測試 100 個並發連接（當前rollout目標）
node scripts/websocket-load-test.js 100 90
```
**預期結果：**
- 連接成功率：> 95%
- P95 連接時間：< 1000ms
- P95 延遲：< 300ms
- 錯誤率：< 2%

### 3. 壓力測試 (200+ 並發)
```bash
# 測試 200 個並發連接（壓力測試）
node scripts/websocket-load-test.js 200 120
```
**目的：** 發現系統極限和瓶頸

### 4. 峰值流量模擬
```bash
# 模擬峰值流量：300 並發，短時間
node scripts/websocket-load-test.js 300 60
```
**目的：** 測試突發流量處理能力

## 📈 測試報告解讀

### 測試結果範例
```
┌─────────────────────────────────────────────────────────┐
│                    測試結果報告                         │
├─────────────────────────────────────────────────────────┤
│ 【連接統計】                                            │
│   總嘗試次數: 100                                       │
│   成功連接: 98                                          │
│   失敗連接: 2                                           │
│   成功率: 98.00%                                        │
│                                                         │
│ 【連接時間 (ms)】                                       │
│   平均: 245.32                                          │
│   P50: 220                                              │
│   P95: 450                                              │
│   P99: 650                                              │
│                                                         │
│ 【消息統計】                                            │
│   發送: 1200                                            │
│   接收: 1195                                            │
│   吞吐量: 20.00 msg/s                                   │
│                                                         │
│ 【延遲 (ms)】                                           │
│   平均: 85.21                                           │
│   P50: 75                                               │
│   P95: 180                                              │
│   P99: 320                                              │
└─────────────────────────────────────────────────────────┘
```

### 關鍵指標說明

#### 1. 連接成功率
- **優秀**: ≥ 95%
- **良好**: 90-95%
- **需改進**: < 90%

#### 2. P95 連接時間
- **優秀**: < 1000ms
- **可接受**: 1000-2000ms
- **需優化**: > 2000ms

#### 3. P95 延遲
- **優秀**: < 200ms
- **可接受**: 200-500ms
- **需優化**: > 500ms

#### 4. 錯誤率
- **優秀**: < 2%
- **需關注**: 2-5%
- **嚴重**: > 5%

## 🔍 問題排查

### 常見問題

#### 1. 連接失敗率高
**可能原因：**
- Durable Objects 資源不足
- 網絡連接問題
- 認證 Token 過期

**排查步驟：**
```bash
# 檢查健康狀態
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 查看 Dashboard metrics
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/metrics
```

#### 2. 延遲過高
**可能原因：**
- Durable Objects CPU 時間過高
- KV 操作延遲
- 網絡延遲

**優化建議：**
- 檢查 Durable Objects 性能
- 優化 KV 緩存策略
- 添加更多 Cloudflare 邊緣節點

#### 3. 消息丟失
**可能原因：**
- WebSocket 連接中斷
- 消息隊列積壓
- Durable Objects 崩潰

**排查步驟：**
```bash
# 查看實時日誌
wrangler tail multi-channel-platform --format=pretty

# 檢查 Durable Objects 狀態
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/durable-objects
```

## 📅 建議測試計劃

### Week 1: 基準測試
```bash
# Day 1: 基準性能
node scripts/websocket-load-test.js 50 60

# Day 3: 目標負載
node scripts/websocket-load-test.js 100 90

# Day 5: 壓力測試
node scripts/websocket-load-test.js 150 120
```

### Week 2: 穩定性測試
```bash
# 長時間穩定性測試（5分鐘）
node scripts/websocket-load-test.js 100 300

# 長時間穩定性測試（10分鐘）
node scripts/websocket-load-test.js 100 600
```

### Week 3: 極限測試
```bash
# 找出系統極限
node scripts/websocket-load-test.js 200 120
node scripts/websocket-load-test.js 300 120
node scripts/websocket-load-test.js 500 120
```

## 🎯 測試目標與驗收標準

根據 `WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md`：

### 50% → 75% Rollout 驗收標準
- ✅ 100+ 並發連接測試通過
- ✅ 連接成功率 > 95%
- ✅ P95 延遲 < 300ms
- ✅ 錯誤率 < 2%
- ✅ 無重大功能故障

### 75% → 90% Rollout 驗收標準
- ✅ 200+ 並發連接測試通過
- ✅ 連接成功率 > 97%
- ✅ P95 延遲 < 250ms
- ✅ 錯誤率 < 1%

### 90% → 100% Rollout 驗收標準
- ✅ 300+ 並發連接測試通過
- ✅ 連接成功率 > 98%
- ✅ P95 延遲 < 200ms
- ✅ 錯誤率 < 0.5%

## 🔧 測試腳本配置

如需修改測試參數，編輯 `scripts/websocket-load-test.js` 中的 `CONFIG` 對象：

```javascript
const CONFIG = {
  WS_URL: 'wss://multi-channel.imfinethankyouandyou.com/ws',
  CONNECTION_TIMEOUT: 10000,  // 連接超時 (ms)
  PING_INTERVAL: 30000,       // 心跳間隔 (ms)
  MESSAGE_INTERVAL: 5000,     // 消息發送間隔 (ms)
};
```

## 📝 測試報告模板

測試完成後，建議記錄以下信息：

```markdown
## WebSocket 負載測試報告

**測試日期**: 2025-10-08
**測試人員**: [Name]
**測試環境**: Production (50% Rollout)

### 測試配置
- 並發連接數: 100
- 測試時長: 60 秒
- WebSocket URL: wss://multi-channel.imfinethankyouandyou.com/ws

### 測試結果
- 連接成功率: 98%
- P95 連接時間: 450ms
- P95 延遲: 180ms
- 錯誤率: 2%

### 評估結論
- [✅ / ⚠️ / ❌] 符合 Rollout 標準
- [問題描述和建議]

### 下一步行動
- [具體行動項目]
```

## 🚨 緊急問題處理

如果測試發現嚴重問題：

1. **立即停止測試**
2. **執行回滾** (如果錯誤率 > 10%)
   ```bash
   # 使用緊急回滾腳本
   ./scripts/emergency-rollback.sh 50
   ```
3. **收集診斷信息**
   ```bash
   # 查看日誌
   wrangler tail multi-channel-platform

   # 檢查健康狀態
   curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health
   ```
4. **分析根因並修復**
5. **重新測試驗證**

---

**最後更新**: 2025-10-08
**維護者**: Technical Team
**相關文檔**: WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md, ROLLOUT_STRATEGY_EVALUATION.md
