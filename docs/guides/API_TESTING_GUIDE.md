# API 測試指南

這個文件說明如何測試所有 API 端點是否正常工作。

##  測試概覽

我們提供了完整的 API 測試方案，包含三種測試類型：

1. **端點測試** - 驗證所有 API 端點的基本功能
2. **整合測試** - 測試完整的業務流程和端點間的整合
3. **負載測試** - 測試 API 在高併發情況下的表現

##  快速開始

### 方法一：使用 PowerShell 腳本（推薦）

```powershell
# 執行所有測試（本地環境）
.\scripts\test-all-apis.ps1

# 執行特定類型的測試
.\scripts\test-all-apis.ps1 -TestType endpoints

# 測試生產環境
.\scripts\test-all-apis.ps1 -Environment prod

# 使用自定義 URL 並啟用詳細輸出
.\scripts\test-all-apis.ps1 -BaseUrl "https://your-api.example.com" -Verbose
```

### 方法二：使用 Node.js 腳本

```bash
# 進入測試目錄
cd tests

# 執行所有測試
node --loader tsx run-api-tests.ts

# 執行特定測試
node --loader tsx run-api-tests.ts endpoints integration

# 指定測試目標和啟用詳細輸出
node --loader tsx run-api-tests.ts --url http://localhost:8787 --verbose
```

### 方法三：直接執行單個測試

```bash
cd tests

# 端點測試
node --loader tsx api-endpoints-test.ts [baseUrl] [timeout]

# 整合測試
node --loader tsx api-integration-test.ts [baseUrl] [timeout]

# 負載測試
node --loader tsx api-load-test.ts [baseUrl] [concurrency] [duration]
```

##  測試類型詳解

### 1. 端點測試 (api-endpoints-test.ts)

測試所有 API 端點的基本功能：

-  根路由健康檢查
-  系統統計和健康檢查
-  用戶認證（登入、註冊、登出）
-  團隊管理
-  對話管理
-  客戶管理
-  延遲訊息
-  QR Code 管理
-  會話管理
-  Webhook 處理

**特點：**
- 自動獲取認證 token
- 跳過需要認證但無法獲取 token 的端點
- 生成詳細的測試報告

### 2. 整合測試 (api-integration-test.ts)

測試完整的業務流程：

-  **用戶認證流程**：註冊 → 登入 → 獲取用戶資訊 → 登出
-  **對話管理流程**：獲取對話列表 → 待處理對話 → 已分配對話
-  **客戶管理流程**：獲取客戶列表 → 搜索客戶
- ⏰ **延遲訊息流程**：創建 → 獲取列表 → 取消
-  **QR Code 流程**：創建 → 獲取列表
-  **Webhook 流程**：空事件 → 測試訊息事件

**特點：**
- 測試端點間的依賴關係
- 驗證業務邏輯的完整性
- 上下文保持（如 token 傳遞）

### 3. 負載測試 (api-load-test.ts)

測試 API 的性能表現：

-  併發請求測試
- ⏱️ 響應時間統計
-  成功率分析
-  錯誤類型統計

**預設配置：**
- 併發數：5
- 持續時間：30 秒
- 測試端點：`/`, `/api/health`, `/api/conversations`, `/api/customers`

##  測試報告

測試完成後會生成以下報告文件：

- `api-test-report.json` - 端點測試詳細報告
- `integration-test-report.json` - 整合測試詳細報告
- `load-test-report.json` - 負載測試詳細報告
- `api-test-summary.json` - 綜合測試摘要

## ️ 環境設定

### 本地開發環境

確保你的 Cloudflare Worker 在本地運行：

```bash
# 啟動本地開發服務器
bun run dev
```

預設 URL：`http://localhost:8787`

### 生產環境

更新 PowerShell 腳本中的生產環境 URL：

```powershell
# 在 scripts/test-all-apis.ps1 中修改
"prod" { return "https://your-actual-production-url.com" }
```

##  自定義測試

### 添加新的測試端點

在 `api-endpoints-test.ts` 中的 `getEndpoints()` 方法添加新端點：

```typescript
{
  path: '/api/your-new-endpoint',
  method: 'GET',
  description: '你的新端點描述',
  requiresAuth: true,
  expectedStatus: 200,
  testData: { /* 測試資料 */ }
}
```

### 添加新的整合測試場景

在 `api-integration-test.ts` 中的 `getTestScenarios()` 方法添加新場景：

```typescript
{
  name: 'your-new-scenario',
  description: '你的新場景描述',
  steps: [
    // 測試步驟
  ]
}
```

### 修改負載測試配置

在 `api-load-test.ts` 中修改預設配置：

```typescript
const config: LoadTestConfig = {
  baseUrl,
  concurrency: 10,        // 併發數
  duration: 60,           // 持續時間（秒）
  endpoints: [            // 測試端點
    '/api/your-endpoint'
  ]
};
```

##  故障排除

### 常見問題

1. **服務不可用**
   ```
    服務不可用，無法執行測試
   ```
   - 確保 Cloudflare Worker 正在運行
   - 檢查 URL 是否正確
   - 檢查網路連接

2. **認證失敗**
   ```
   ️ 無法獲取認證 token，將跳過需要認證的端點
   ```
   - 確保有有效的測試用戶帳號
   - 檢查登入端點是否正常工作
   - 確認用戶名和密碼正確

3. **測試超時**
   ```
   ⏰ 測試套件 xxx 超時
   ```
   - 增加超時時間
   - 檢查服務器響應速度
   - 減少併發數或測試持續時間

4. **Node.js 模組錯誤**
   ```
   Error: Cannot find module 'tsx'
   ```
   - 安裝必要的依賴：`bun install tsx --save-dev`
   - 確保在正確的目錄執行命令

### 調試技巧

1. **啟用詳細輸出**
   ```bash
   node --loader tsx run-api-tests.ts --verbose
   ```

2. **執行單個測試類型**
   ```bash
   node --loader tsx run-api-tests.ts endpoints
   ```

3. **檢查測試報告**
   ```bash
   cat api-test-summary.json | jq .
   ```

##  進階用法

### CI/CD 整合

在 GitHub Actions 中使用：

```yaml
- name: Run API Tests
  run: |
    cd tests
    node --loader tsx run-api-tests.ts --url ${{ secrets.API_URL }}
```

### 自動化測試腳本

創建定期執行的測試腳本：

```bash
#!/bin/bash
# daily-api-test.sh

echo "開始每日 API 測試..."
cd /path/to/your/project/tests
node --loader tsx run-api-tests.ts --url https://your-api.com

# 發送測試結果到 Slack 或 Email
if [ $? -eq 0 ]; then
    echo " API 測試通過"
else
    echo " API 測試失敗" | mail -s "API Test Failed" admin@example.com
fi
```

### 性能基準測試

使用負載測試建立性能基準：

```bash
# 建立基準
node --loader tsx api-load-test.ts http://localhost:8787 10 60 > baseline.log

# 比較性能
node --loader tsx api-load-test.ts http://localhost:8787 10 60 > current.log
diff baseline.log current.log
```

##  貢獻

如果你想改進測試腳本或添加新功能：

1. Fork 這個專案
2. 創建功能分支
3. 添加測試
4. 提交 Pull Request

##  授權

這些測試腳本遵循與主專案相同的授權條款。