# 75% Rollout 執行手冊

**版本**: 1.0.0
**建立日期**: 2025-10-08
**執行日期**: 2025-10-15 (暫定)
**預估執行時間**: 2-3 小時
**參與人員**: 系統管理員 + DevOps 團隊 + 待命工程師

---

## 📋 執行總覽

### 目標
從當前的 **50% WebSocket Rollout** 安全地遷移到 **75% Rollout**。

### 前置條件檢查清單
在執行日期前必須確認以下所有項目:

| 檢查項目 | 狀態 | 負責人 | 備註 |
|---------|------|--------|------|
| ✅ 50% Rollout 穩定運行 ≥ 7 天 | ⏰ 3/7 天 | DevOps | 當前 Day 3 |
| ✅ 100 並發負載測試通過 | ✅ 通過 | System Admin | 2025-10-08 完成 |
| ☐ 200 並發負載測試通過 | ⏳ 待執行 | DevOps | **必須在執行前完成** |
| ☐ 前端性能追蹤部署完成 | ⏳ 開發中 | Frontend Team | **必須在執行前完成** |
| ☐ 緊急回滾腳本測試成功 | ⏳ 待測試 | DevOps | **必須在執行前完成** |
| ☐ 告警系統配置完成 | ⏳ 配置中 | DevOps | **必須在執行前完成** |
| ☐ 團隊完成操作培訓 | ⏳ 待安排 | Team Lead | **必須在執行前完成** |
| ☐ 連續 7 天錯誤率 < 2% | ⏳ 監控中 | DevOps | 每日檢查 |

### 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 連接成功率下降 | 低 | 高 | 準備好緊急回滾腳本 |
| 延遲增加 | 中 | 中 | 監控 P95/P99 指標 |
| Durable Objects 錯誤 | 低 | 高 | 確保 DO 健康檢查正常 |
| 前端性能問題 | 低 | 中 | 前端性能追蹤實時監控 |

---

## 🚀 執行階段

### Phase 1: 部署前準備 (T-60分鐘)

#### 1.1 團隊集合與分工

**時間**: T-60分鐘
**地點**: 線上會議室或實體會議室

**人員角色分配**:
- **執行負責人**: ___________ (主要操作者)
- **監控負責人**: ___________ (儀表板監控)
- **溝通協調人**: ___________ (對外溝通)
- **技術待命**: ___________ (問題處理)

**溝通渠道確認**:
- ✅ Slack #deployment-war-room 頻道已創建
- ✅ 緊急聯絡電話清單已分發
- ✅ 視訊會議室已準備

#### 1.2 系統狀態檢查

**時間**: T-55分鐘

```bash
# 1. 檢查 API 健康狀態
curl https://multi-channel.imfinethankyouandyou.com/api/health/health

# 2. 檢查 WebSocket 健康狀態
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 3. 檢查當前 rollout 配置
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config

# 4. 檢查活躍連接數
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/connections
```

**預期結果**:
- ✅ API 健康狀態: `status: "healthy"`
- ✅ WebSocket 健康狀態: `status: "healthy"`
- ✅ 當前 rollout: `rolloutPercentage: 50`
- ✅ 活躍連接數: > 10 (視使用者數量而定)

**如果有異常**:
- 🚫 **停止部署**,先解決健康檢查問題
- 📞 通知團隊負責人
- 📝 記錄異常狀況

#### 1.3 備份當前配置

**時間**: T-50分鐘

```bash
# 執行配置備份
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/backup-config

# 驗證備份成功
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/backup-config/latest
```

**備份內容確認**:
- ✅ rolloutPercentage: 50
- ✅ enableWebSocket: true
- ✅ enableSSE: true
- ✅ migrationStrategy: "gradual"

#### 1.4 200 並發負載測試 (如果尚未執行)

**時間**: T-45分鐘
**預估時長**: 20 分鐘

**重要**: 如果在準備階段已完成此測試,可跳過。

```bash
# 執行 200 並發測試 (90 秒)
node scripts/websocket-load-test.cjs 200 90
```

**驗收標準**:
- ✅ 連接成功率 ≥ 95%
- ✅ 錯誤率 < 2%
- ✅ P95 連接時間 < 2000ms
- ✅ P99 延遲 < 500ms

**如果測試失敗**:
- 🚫 **中止部署**
- 🔍 檢查失敗原因
- 📊 分析測試報告
- ⏰ 重新安排部署時間

#### 1.5 通知利害關係人

**時間**: T-30分鐘

**發送通知**:
- ✅ 內部團隊 (Slack #general):
  ```
  📢 WebSocket 75% Rollout 將在 30 分鐘後開始執行
  執行時間: [具體時間]
  預計影響: 輕微 (用戶不會察覺)
  監控儀表板: [URL]
  ```
- ✅ 待命人員 (SMS/Email):
  ```
  🔔 WebSocket 75% Rollout Starting
  Time: [Time]
  Monitor: [Dashboard URL]
  Stay on standby for the next 2 hours.
  ```

#### 1.6 監控儀表板準備

**時間**: T-25分鐘

**開啟以下儀表板** (建議使用多顯示器):
1. 主要監控儀表板: `https://multi-channel.imfinethankyouandyou.com/websocket-monitoring`
2. Analytics 儀表板: `https://multi-channel.imfinethankyouandyou.com/websocket-analytics`
3. 系統健康儀表板: `https://multi-channel.imfinethankyouandyou.com/api/health/health`
4. Cloudflare Analytics: `https://dash.cloudflare.com`

**設定告警**:
- ✅ 錯誤率 > 3% 立即通知
- ✅ 連接失敗率 > 10% 立即通知
- ✅ 系統 unhealthy 立即通知

#### 1.7 準備緊急回滾

**時間**: T-20分鐘

**測試回滾腳本** (Dry Run):
```powershell
# Windows PowerShell
.\scripts\emergency-rollback.ps1 -RollbackLevel safe -WhatIf

# 或 Bash (如果使用 WSL/Git Bash)
bash scripts/emergency-rollback.sh safe --dry-run
```

**預期輸出**:
- ✅ 腳本可以正常執行
- ✅ API 連接正常
- ✅ 認證成功
- ✅ Dry-run 模式正確顯示將要執行的操作

**如果測試失敗**:
- 🚫 **停止部署**,修復回滾腳本
- 🔧 確保緊急回滾功能正常

#### 1.8 最後檢查點

**時間**: T-10分鐘

**Go/No-Go 決策檢查清單**:
- ☐ 所有團隊成員已就位
- ☐ 系統健康檢查全部通過
- ☐ 配置已成功備份
- ☐ 負載測試已通過 (200 並發)
- ☐ 監控儀表板已準備
- ☐ 緊急回滾已測試
- ☐ 告警系統已配置
- ☐ 通知已發送

**決策**:
- ✅ **GO**: 所有檢查通過,繼續執行
- 🚫 **NO-GO**: 有任何檢查未通過,中止部署

---

### Phase 2: 執行部署 (T-0分鐘)

#### 2.1 執行 Rollout 更新

**時間**: T+0分鐘
**執行人**: 執行負責人

**方法 1: API 調用** (推薦)
```bash
# 獲取 Token
TOKEN=$(curl -s -X POST \
  https://multi-channel.imfinethankyouandyou.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dacit.net","password":"16011587DaC"}' \
  | grep -o '"token":"[^"]*' | sed 's/"token":"//')

# 更新 Rollout 到 75%
curl -X PUT \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 75,
    "enableWebSocket": true,
    "enableSSE": true,
    "migrationStrategy": "gradual",
    "updateReason": "Planned rollout increase from 50% to 75%",
    "updateTimestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

**方法 2: 儀表板操作**
1. 登入 WebSocket Admin Dashboard
2. 導航到 "Migration Config"
3. 修改 Rollout Percentage: 50 → 75
4. 點擊 "Update Configuration"
5. 確認更新

**驗證更新成功**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config \
  | grep rolloutPercentage
```

**預期輸出**:
```json
{
  "rolloutPercentage": 75,
  "enableWebSocket": true,
  "enableSSE": true,
  "migrationStrategy": "gradual"
}
```

**如果更新失敗**:
- 🔄 重試 API 調用 (最多 3 次)
- 📞 如果仍然失敗,通知技術待命人員
- 🔍 檢查 API 錯誤日誌

#### 2.2 即時驗證 (T+1分鐘)

**監控負責人**: 開始密集監控

**每 30 秒檢查一次** (前 5 分鐘):
```bash
# 檢查系統健康
curl https://multi-channel.imfinethankyouandyou.com/api/health/health | jq '.status'

# 檢查錯誤率
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/metrics?period=1m \
  | jq '.errorRate'

# 檢查活躍連接數
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/connections \
  | jq '.activeConnections'
```

**正常指標範圍**:
- ✅ 系統狀態: `"healthy"` 或 `"degraded"` (可接受)
- ✅ 錯誤率: < 3%
- ✅ 活躍連接數: 穩定或增加 (預期 50% → 75% 會增加連接數)

**異常指標處理**:
- 🔴 錯誤率 > 5%: 執行緊急回滾
- 🟡 錯誤率 3-5%: 暫停rollout,密切監控
- 🔴 系統狀態 "unhealthy": 執行緊急回滾
- 🔴 大量連接斷開: 執行緊急回滾

---

### Phase 3: 部署後監控 (T+5分鐘 ~ T+2小時)

#### 3.1 第一個 15 分鐘密集監控 (T+5 ~ T+20分鐘)

**監控頻率**: 每 2 分鐘

**檢查項目**:
1. **連接成功率**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/metrics?period=5m
   ```
   - 目標: ≥ 95%
   - 警戒: < 95%
   - 緊急: < 90%

2. **錯誤率**
   - 目標: < 2%
   - 警戒: 2-3%
   - 緊急: > 3%

3. **平均延遲**
   - 目標: < 200ms
   - 警戒: 200-300ms
   - 關注: 300-500ms
   - 緊急: > 500ms

4. **P95 連接時間**
   - 目標: < 1500ms
   - 警戒: 1500-2000ms
   - 緊急: > 2000ms

**記錄檢查點**:
```
[T+5分]  ✅ 連接成功率: 98.5% | 錯誤率: 1.2% | 平均延遲: 150ms
[T+7分]  ✅ 連接成功率: 97.8% | 錯誤率: 1.5% | 平均延遲: 165ms
[T+9分]  ✅ 連接成功率: 98.1% | 錯誤率: 1.3% | 平均延遲: 142ms
[T+11分] ✅ 連接成功率: 98.6% | 錯誤率: 0.9% | 平均延遲: 138ms
[T+13分] ✅ 連接成功率: 99.2% | 錯誤率: 0.7% | 平均延遲: 145ms
[T+15分] ✅ 連接成功率: 98.9% | 錯誤率: 1.1% | 平均延遲: 152ms
[T+17分] ✅ 連接成功率: 98.4% | 錯誤率: 1.4% | 平均延遲: 149ms
[T+20分] ✅ 連接成功率: 98.7% | 錯誤率: 1.0% | 平均延遲: 146ms
```

#### 3.2 第一個小時常規監控 (T+20 ~ T+60分鐘)

**監控頻率**: 每 5 分鐘

**監控指標**:
- 連接成功率
- 錯誤率
- 平均延遲
- P95/P99 延遲
- 重連次數
- Durable Objects 錯誤計數

**告警閾值** (參考 `config/alert-thresholds.json`):
- 🚨 **Critical**: 立即執行緊急回滾
  - 連接成功率 < 90% (持續 5 分鐘)
  - 錯誤率 > 5% (持續 5 分鐘)
  - 系統狀態 "unhealthy" (持續 1 分鐘)

- ⚠️ **High**: 暫停rollout,密切監控
  - 連接成功率 < 95% (持續 3 分鐘)
  - 錯誤率 > 3% (持續 3 分鐘)
  - 平均延遲 > 500ms (持續 5 分鐘)

- 🟡 **Medium**: 記錄並持續觀察
  - 連接成功率 < 98% (持續 2 分鐘)
  - 錯誤率 > 2% (持續 2 分鐘)
  - 平均延遲 > 300ms (持續 3 分鐘)

#### 3.3 第二個小時穩定期監控 (T+60 ~ T+120分鐘)

**監控頻率**: 每 10 分鐘

**穩定性確認**:
- ✅ 連續 1 小時無 High 或 Critical 告警
- ✅ 錯誤率保持 < 2%
- ✅ 連接成功率保持 ≥ 95%
- ✅ 無異常的重連模式

**如果穩定**:
- ✅ 宣布部署成功
- 📢 發送成功通知
- 📝 記錄部署報告

**如果不穩定**:
- 🔍 分析不穩定原因
- 🤔 評估是否需要回滾
- 📞 與團隊討論下一步

---

### Phase 4: 緊急回滾程序 (如需要)

#### 4.1 回滾決策條件

**立即執行回滾** (無需討論):
- 🔴 系統狀態 "unhealthy" 持續 > 1 分鐘
- 🔴 錯誤率 > 5% 持續 > 5 分鐘
- 🔴 連接成功率 < 90% 持續 > 5 分鐘
- 🔴 大量用戶報告無法連接

**評估後決定回滾** (團隊討論):
- 🟡 錯誤率 3-5% 持續 > 10 分鐘
- 🟡 連接成功率 90-95% 持續 > 10 分鐘
- 🟡 P95 延遲 > 2000ms 持續 > 10 分鐘

#### 4.2 回滾執行

**方法 1: 緊急回滾腳本** (推薦)
```powershell
# Windows PowerShell
.\scripts\emergency-rollback.ps1 -RollbackLevel safe

# 這會將 rollout 從 75% 回滾到 50%
```

**方法 2: API 手動回滾**
```bash
curl -X PUT \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 50,
    "enableWebSocket": true,
    "enableSSE": true,
    "migrationStrategy": "gradual",
    "rollbackReason": "Emergency rollback due to [REASON]"
  }'
```

**方法 3: 完全SSE回滾** (最嚴重情況)
```powershell
.\scripts\emergency-rollback.ps1 -RollbackLevel emergency
```

#### 4.3 回滾後驗證

**立即檢查** (回滾後 1 分鐘):
```bash
# 1. 確認配置已回滾
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/dashboard/migration-config

# 2. 檢查系統健康
curl https://multi-channel.imfinethankyouandyou.com/api/health/health

# 3. 檢查錯誤率
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/websocket/analytics/metrics?period=1m
```

**持續監控** (回滾後 15 分鐘):
- 每 2 分鐘檢查系統指標
- 確認錯誤率降低
- 確認系統恢復穩定

**回滾後溝通**:
```
📢 緊急回滾已執行
Rollback Level: [safe/emergency]
從 75% 回滾到 [50%/0%]
原因: [具體原因]
當前狀態: [系統健康狀況]
下一步: [調查和修復計劃]
```

---

## 📊 部署後任務

### 即日完成

#### 1. 部署報告
- ✅ 記錄所有關鍵時間點
- ✅ 記錄所有指標數據
- ✅ 截圖關鍵儀表板
- ✅ 記錄遇到的問題和解決方法

**報告模板**:
```markdown
# 75% Rollout 部署報告

## 基本信息
- 執行日期: YYYY-MM-DD
- 執行時間: HH:MM - HH:MM
- 執行人員: [名單]

## 部署結果
- ✅/❌ 部署成功/失敗
- 最終 Rollout: XX%
- 是否回滾: 是/否

## 性能指標
- 連接成功率: XX%
- 錯誤率: XX%
- 平均延遲: XXms
- P95 連接時間: XXms

## 遇到的問題
[列出所有問題和解決方法]

## 改進建議
[列出改進建議]

## 下一步計劃
[90% rollout 計劃]
```

#### 2. 通知發送
```
✅ 75% Rollout 部署完成

時間: [完成時間]
結果: 成功/失敗
當前 Rollout: 75%
性能: 良好/需改進
下一步: 7天穩定期觀察,然後規劃 90% rollout

詳細報告: [連結]
```

### 未來 7 天

#### 3. 每日健康檢查
- 每天檢查系統健康狀態
- 每天檢查錯誤率和連接成功率
- 記錄任何異常
- 準備每週報告

#### 4. 穩定期評估 (Day 7)
- 評估 7 天穩定性
- 決定是否可以進入 90% rollout 準備
- 更新部署計劃

---

## 🔧 故障排除

### 常見問題

#### 問題 1: 錯誤率突然升高

**症狀**: 錯誤率從 1% 突然升到 5%

**排查步驟**:
1. 檢查 Cloudflare 狀態頁面
2. 檢查 Durable Objects 錯誤日誌
3. 檢查特定用戶群體是否受影響
4. 檢查是否有新的程式碼部署

**解決方案**:
- 如果是 Cloudflare 問題: 等待 Cloudflare 恢復
- 如果是 DO 問題: 考慮重啟 DO 或回滾
- 如果是特定用戶: 分析用戶特徵,調整 rollout 策略

#### 問題 2: 連接時間過長

**症狀**: P95 連接時間 > 2500ms

**排查步驟**:
1. 檢查 DO 冷啟動時間
2. 檢查網絡延遲
3. 檢查服務器負載

**解決方案**:
- 如果是 DO 冷啟動: 考慮預熱機制
- 如果是網絡問題: 檢查 CDN 配置
- 如果是負載問題: 考慮擴展資源

#### 問題 3: 回滾腳本執行失敗

**症狀**: 緊急回滾腳本報錯

**手動回滾步驟**:
1. 直接訪問 Admin Dashboard
2. 手動修改 Rollout Percentage
3. 或使用 curl 手動調用 API
4. 驗證回滾成功

---

## 📞 聯絡信息

### 緊急聯絡人

| 角色 | 姓名 | 電話 | Email | 備註 |
|------|------|------|-------|------|
| 系統管理員 | ___ | +886-XXX | admin@dacit.net | 主要負責人 |
| DevOps Lead | ___ | +886-XXX | devops@dacit.net | 技術支援 |
| 技術待命 | ___ | +886-XXX | oncall@dacit.net | 24/7 待命 |

### 協助資源

- **文檔**: `WEBSOCKET_100_PERCENT_DEPLOYMENT_PLAN.md`
- **負載測試指南**: `scripts/LOAD_TESTING_GUIDE.md`
- **告警配置**: `config/alert-thresholds.json`
- **儀表板**: https://multi-channel.imfinethankyouandyou.com/websocket-monitoring

---

## ✅ 檢查清單總結

### 部署前 (T-60分鐘)
- [ ] 團隊集合完成
- [ ] 系統健康檢查通過
- [ ] 配置備份完成
- [ ] 200 並發測試通過 (如需要)
- [ ] 通知已發送
- [ ] 監控儀表板準備完成
- [ ] 緊急回滾測試成功
- [ ] Go/No-Go 決策: **GO** ✅

### 部署時 (T+0分鐘)
- [ ] Rollout 更新執行完成
- [ ] 配置驗證通過
- [ ] 即時驗證開始

### 部署後 (T+5分鐘起)
- [ ] 密集監控 (15 分鐘)
- [ ] 常規監控 (1 小時)
- [ ] 穩定期監控 (2 小時)
- [ ] 部署報告完成
- [ ] 成功通知發送

---

**文檔版本**: 1.0.0
**生成時間**: 2025-10-08
**生成工具**: Claude Code Automated Documentation
