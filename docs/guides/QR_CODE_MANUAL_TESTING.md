# QR Code 雙向同步機制 - 手動測試指南

**快速驗證指南** - 無需安裝測試框架，使用 curl 或瀏覽器即可驗證

---

##  測試前準備

### 1. 獲取管理員 Token

```bash
# 登入取得 Token
curl -X POST https://your-worker.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'

# 響應範例:
# {
# "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
# "user": { "id": 1, "role": "admin", ... }
# }
```

### 2. 設置環境變數 (方便後續測試)

```bash
# Windows (PowerShell)
$TOKEN = "your-jwt-token-here"
$API_URL = "https://your-worker.workers.dev"

# Linux/Mac (Bash)
export TOKEN="your-jwt-token-here"
export API_URL="https://your-worker.workers.dev"
```

---

##  測試案例

### 測試 1: 驗證當前同步狀態

**目的**: 檢查有多少團隊已同步 QR Code

**Windows (PowerShell)**:
```powershell
curl -X GET "$API_URL/api/system/sync-qr-codes/validate" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json"
```

**Linux/Mac (Bash)**:
```bash
curl -X GET "$API_URL/api/system/sync-qr-codes/validate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**:
```json
{
  "success": true,
  "data": {
    "validation": {
      "totalTeams": 10,
      "synced": 8,
      "notSynced": 2,
      "syncRate": "80.00%",
      "healthStatus": "healthy",
      "details": [
        {
          "teamId": 3,
          "teamName": "測試團隊 A",
          "status": "not_synced",
          "reason": "No active QR code found in qr_codes table"
        },
        {
          "teamId": 7,
          "teamName": "測試團隊 B",
          "status": "not_synced",
          "reason": "teams.qrCode is NULL but qr_codes table has active QR"
        }
      ]
    }
  }
}
```

**評估標準**:
-  `syncRate >= 80%` → 健康
- `50% <= syncRate < 80%` → 需要同步
-  `syncRate < 50%` → 需要立即同步

---

### 測試 2: Dry Run 模式預覽同步

**目的**: 預覽同步操作，不實際修改資料庫

**命令**:
```bash
# Windows (PowerShell)
curl -X POST "$API_URL/api/system/sync-qr-codes?dryRun=true" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json"

# Linux/Mac (Bash)
curl -X POST "$API_URL/api/system/sync-qr-codes?dryRun=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalTeams": 10,
      "teamsWithQR": 8,
      "teamsWithoutQR": 2,
      "successfulSyncs": 5,
      "alreadySynced": 3,
      "failedSyncs": 0,
      "errors": []
    },
    "dryRun": true,
    "message": "Dry run completed. No data was modified."
  }
}
```

**解讀**:
- `successfulSyncs`: 實際執行時會同步的團隊數
- `alreadySynced`: 已經同步過的團隊數
- `teamsWithoutQR`: 沒有 QR Code 的團隊數

---

### 測試 3: 執行實際同步

**目的**: 將所有 qr_codes 表的資料同步到 teams.qrCode

** 警告**: 這會修改資料庫，建議先執行 Dry Run

**命令**:
```bash
# Windows (PowerShell)
curl -X POST "$API_URL/api/system/sync-qr-codes" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json"

# Linux/Mac (Bash)
curl -X POST "$API_URL/api/system/sync-qr-codes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalTeams": 10,
      "teamsWithQR": 8,
      "teamsWithoutQR": 2,
      "successfulSyncs": 5,
      "alreadySynced": 3,
      "failedSyncs": 0,
      "errors": []
    },
    "dryRun": false,
    "message": "QR codes synchronized successfully"
  }
}
```

**成功標準**:
-  `failedSyncs = 0`
-  `successfulSyncs > 0` (如果有需要同步的團隊)
-  響應時間 < 3 秒 (10 個團隊)

---

### 測試 4: 快速查詢端點 (Optimal Path)

**目的**: 驗證 teams.qrCode 欄位是否正確使用

**命令** (假設 teamId = 1):
```bash
# Windows (PowerShell)
curl -X GET "$API_URL/api/teams/1/qr-code/fast" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json"

# Linux/Mac (Bash)
curl -X GET "$API_URL/api/teams/1/qr-code/fast" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應 (Optimal Path)**:
```json
{
  "success": true,
  "data": {
    "qrCode": "https://api.qrserver.com/v1/create-qr-code/?data=...",
    "source": "teams_table",
    "performance": "optimal"
  }
}
```

**預期響應 (Fallback Path)**:
```json
{
  "success": true,
  "data": {
    "qrCode": "https://api.qrserver.com/v1/create-qr-code/?data=...",
    "source": "qr_codes_table",
    "performance": "fallback"
  }
}
```

**評估標準**:
-  `source = "teams_table"` → 最佳性能 (直接從 teams 表讀取)
- `source = "qr_codes_table"` → Fallback 路徑 (會自動同步回 teams 表)
-  `success = false` → 團隊沒有 QR Code 或權限不足

---

### 測試 5: 性能基準測試

**目的**: 測量快速查詢端點的響應時間

**Windows (PowerShell)**:
```powershell
# 測試 10 次並計算平均響應時間
for ($i=1; $i -le 10; $i++) {
  $start = Get-Date
  curl -X GET "$API_URL/api/teams/1/qr-code/fast" `
    -H "Authorization: Bearer $TOKEN" `
    -H "Content-Type: application/json" | Out-Null
  $end = Get-Date
  $duration = ($end - $start).TotalMilliseconds
  Write-Host "Test $i: ${duration}ms"
}
```

**Linux/Mac (Bash)**:
```bash
# 測試 10 次並計算平均響應時間
for i in {1..10}; do
  start=$(date +%s%3N)
  curl -s -X GET "$API_URL/api/teams/1/qr-code/fast" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" > /dev/null
  end=$(date +%s%3N)
  duration=$((end - start))
  echo "Test $i: ${duration}ms"
done
```

**性能目標**:
-  Optimal Path (teams_table): < 50ms
- Fallback Path (qr_codes_table): 50-200ms
-  > 200ms: 需要優化

---

##  完整測試流程

### 情境 1: 首次部署後驗證

```bash
# Step 1: 檢查同步狀態
curl -X GET "$API_URL/api/system/sync-qr-codes/validate" \
  -H "Authorization: Bearer $TOKEN"

# Step 2: 執行 Dry Run 預覽
curl -X POST "$API_URL/api/system/sync-qr-codes?dryRun=true" \
  -H "Authorization: Bearer $TOKEN"

# Step 3: 執行實際同步
curl -X POST "$API_URL/api/system/sync-qr-codes" \
  -H "Authorization: Bearer $TOKEN"

# Step 4: 再次驗證同步狀態
curl -X GET "$API_URL/api/system/sync-qr-codes/validate" \
  -H "Authorization: Bearer $TOKEN"

# Step 5: 測試快速查詢
curl -X GET "$API_URL/api/teams/1/qr-code/fast" \
  -H "Authorization: Bearer $TOKEN"
```

**預期結果**:
```
Step 1: syncRate < 100% (有未同步的團隊)
Step 2: successfulSyncs > 0 (會同步若干團隊)
Step 3: failedSyncs = 0 (同步成功)
Step 4: syncRate ≈ 100% (所有團隊已同步)
Step 5: source = "teams_table" (使用 optimal path)
```

---

### 情境 2: 新團隊生成 QR Code 後驗證

```bash
# Step 1: 為團隊生成新 QR Code (假設透過 UI 或 API)
curl -X POST "$API_URL/api/teams/5/qr-codes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "測試活動",
    "description": "測試 QR Code",
    "maxUses": 100
  }'

# Step 2: 立即查詢 (應該已自動同步到 teams.qrCode)
curl -X GET "$API_URL/api/teams/5/qr-code/fast" \
  -H "Authorization: Bearer $TOKEN"

# Step 3: 驗證數據來源
# 預期: source = "teams_table" (自動同步成功)
```

---

### 情境 3: 停用 QR Code 後驗證

```bash
# Step 1: 停用團隊的 QR Code
curl -X DELETE "$API_URL/api/teams/5/qr-codes/abc123" \
  -H "Authorization: Bearer $TOKEN"

# Step 2: 查詢快速端點
curl -X GET "$API_URL/api/teams/5/qr-code/fast" \
  -H "Authorization: Bearer $TOKEN"

# 預期結果:
# - 如果該團隊有其他活躍 QR Code: 返回最新的 QR Code
# - 如果沒有其他活躍 QR Code: 返回 404
```

---

##  測試結果評估

### 健康檢查清單

完成所有測試後，驗證以下指標:

- [ ] **同步率** ≥ 80%
- [ ] **快速查詢** 主要使用 `teams_table` (optimal path)
- [ ] **響應時間** < 50ms (optimal path)
- [ ] **同步失敗率** = 0%
- [ ] **新生成 QR Code** 自動同步到 `teams.qrCode`
- [ ] **停用 QR Code** 正確更新 `teams.qrCode`

### 常見問題排查

#### 問題 1: `syncRate < 80%`

**原因**: 部分團隊的 QR Code 未同步

**解決**:
```bash
# 執行同步
curl -X POST "$API_URL/api/system/sync-qr-codes" \
  -H "Authorization: Bearer $TOKEN"

# 再次驗證
curl -X GET "$API_URL/api/system/sync-qr-codes/validate" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### 問題 2: 快速查詢總是使用 `qr_codes_table`

**原因**: `teams.qrCode` 欄位為空

**解決**:
```bash
# 強制同步所有團隊
curl -X POST "$API_URL/api/system/sync-qr-codes" \
  -H "Authorization: Bearer $TOKEN"

# 等待 1-2 秒後重試
sleep 2
curl -X GET "$API_URL/api/teams/1/qr-code/fast" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### 問題 3: 響應時間過長 (> 200ms)

**可能原因**:
1. 資料庫未優化
2. Cloudflare Workers 冷啟動
3. 網路延遲

**診斷**:
```bash
# 連續測試 5 次觀察趨勢
for i in {1..5}; do
  time curl -X GET "$API_URL/api/teams/1/qr-code/fast" \
    -H "Authorization: Bearer $TOKEN"
done
```

**預期**: 第 2-5 次測試應該顯著變快 (< 50ms)

---

##  成功標準總結

當以下所有條件滿足時，QR Code 雙向同步機制即正確運行:

1.  **驗證端點** 返回 `syncRate >= 80%`
2.  **快速查詢** 主要使用 `source = "teams_table"`
3.  **新生成 QR Code** 自動同步到 `teams.qrCode`
4.  **停用 QR Code** 正確更新 `teams.qrCode`
5.  **響應時間** < 50ms (optimal path)
6.  **同步失敗率** = 0%

---

##  測試報告範例

完成測試後，可使用以下範本記錄結果:

```
==============================================
QR Code 雙向同步機制測試報告
==============================================

測試時間: 2025-01-28 14:30:00
測試環境: Production
執行人員: [Your Name]

--- 測試結果 ---

1. 同步狀態驗證
   - 總團隊數: 10
   - 同步率: 95.00%
   - 健康狀態: healthy
    通過

2. Dry Run 預覽
   - 將同步: 2 個團隊
   - 已同步: 8 個團隊
    通過

3. 實際同步執行
   - 成功同步: 2 個團隊
   - 失敗: 0 個團隊
    通過

4. 快速查詢測試
   - 數據來源: teams_table
   - 性能模式: optimal
   - 響應時間: 12ms
    通過

5. 性能基準測試
   - 平均響應時間: 15ms
   - 最快: 8ms
   - 最慢: 32ms
    通過

--- 總結 ---
 所有測試通過
 teams.qrCode 欄位正確使用
 性能達標 (50x 提升)
 雙向同步機制運行正常

==============================================
```

---

**最後更新**: 2025-01-28
**文檔版本**: 1.0.0
**相關文檔**: [QR_CODE_SYNC_GUIDE.md](./QR_CODE_SYNC_GUIDE.md)
