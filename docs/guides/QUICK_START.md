#  立即開始：multi-channel-platform 快速設置 (Drizzle ORM + KV)

##  選擇您的使用場景

###  客戶 - 獲得完整客服系統 (現已整合 Drizzle ORM + KV)
**目標**: 快速部署生產就緒的客服系統，享受型別安全和高效能快取
**腳本**: `.\quick-deploy.ps1`
**時間**: 10 分鐘自動化部署
**新功能**: 智能快取、Session 管理、型別安全

### ‍ 開發者 - 開發環境設置 (Drizzle + KV 整合)
**目標**: 設置現代化開發環境，使用 Drizzle ORM 和 KV 快取
**腳本**: `.\setup-env.ps1`
**時間**: 5 分鐘環境設置 + 開發工作
**新工具**: Drizzle Studio、KV 管理、型別生成

---

##  客戶快速部署 (10 分鐘)

### 第一步：一鍵部署
```bash
# 克隆專案
git clone https://github.com/your-username/multi-channel-platform.git
cd multi-channel-platform

# 一鍵部署完整系統
.\quick-deploy.ps1

# 腳本會自動：
#  檢查所有必要工具 (Node.js, npm, wrangler, terraform)
#  驗證 Cloudflare 登入狀態
#  檢查和建立配置檔案
#  建置前後端應用程式
#  部署到 Cloudflare 服務
#  初始化資料庫
#  顯示部署結果和下一步指引
```

### 第二步：配置 LINE 整合
部署完成後，設置 LINE Webhook：
1. 登入 [LINE Developers Console](https://developers.line.biz/)
2. 設置 Webhook URL: `https://your-domain.workers.dev/api/webhook`
3. 啟用 Webhook 並測試連接

---

##  開發者環境設置 (5 分鐘)

### 第一步：設置開發環境
```bash
# 克隆專案
git clone https://github.com/your-username/multi-channel-platform.git
cd multi-channel-platform

# 一鍵設置開發環境
.\setup-env.ps1

# 腳本會自動：
#  生成 .env 檔案（後端環境變數）
#  生成 frontend/.env.local（前端環境變數）
#  自動生成 JWT Secret 和加密密鑰
#  建立配置指南 ENV-SETUP-GUIDE.md
```

### 第二步：安裝依賴和啟動開發服務器
```bash
# 安裝後端依賴
bun install

# 安裝前端依賴
cd frontend
bun install
cd ..

# 啟動後端開發服務器
bun run dev

# 在另一個終端啟動前端開發服務器
cd frontend
bun run dev
```

### 第三步：開始開發
- 後端服務器: http://localhost:8787
- 前端應用: http://localhost:3000
- 查看 ENV-SETUP-GUIDE.md 了解下一步配置

---

##  傳統手動設置 (進階用戶)

### 確認環境
```bash
# 檢查 Node.js 版本 (需要 18+)
node --version

# 檢查 npm 版本
npm --version

# 安裝 Wrangler CLI
bun install -g wrangler

# 登入 Cloudflare
wrangler login
```

### 第二步：建立 Cloudflare 服務
```bash
# 進入專案目錄
cd multi-channel-platform

# 建立 D1 資料庫 (如果還沒有)
wrangler d1 create omni-channel-platform

# 建立 R2 儲存桶 (用於檔案附件)
wrangler r2 bucket create omni-channel-attachments-develop
wrangler r2 bucket create omni-channel-attachments-production

# 複製返回的 database_id，稍後會用到
```

### 第三步：更新配置文件 (如果需要)
1. 打開 `wrangler.toml`
2. 確認資料庫和 R2 配置正確：
```toml
[[d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"
database_id = "37537e1f-625e-4cf9-be60-a01b5c063772"  # 你的實際資料庫ID

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "omni-channel-attachments-develop"  # 開發環境
```

### 第四步：設置 LINE 憑證
```bash
# 設置 LINE Channel Access Token
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# 輸入你的 LINE Channel Access Token

# 設置 LINE Channel Secret
wrangler secret put LINE_CHANNEL_SECRET
# 輸入你的 LINE Channel Secret

# 設置 JWT 密鑰
wrangler secret put JWT_SECRET
# 輸入一個強密碼，例如：your-super-secret-jwt-key-here
```

### 第五步：初始化資料庫
```bash
# 執行主要資料庫結構
wrangler d1 execute omni-channel-platform --local --file=./database/schema.sql

# 執行檔案附件資料庫結構
wrangler d1 execute omni-channel-platform --local --file=./database/file-attachments-schema.sql

# 或使用自動化腳本
bun run db:migrate:attachments
```

### 第六步：啟動開發服務器
```bash
# 安裝後端依賴
bun install

# 安裝前端依賴
cd frontend
bun install
cd ..

# 生成類型定義
bun run cf-typegen

# 啟動後端開發服務器
bun run dev

# 在另一個終端啟動前端開發服務器
cd frontend
bun run dev
```

### 第七步：測試基本功能
```bash
# 測試後端健康檢查
curl http://localhost:8787/health

# 測試前端應用
# 打開瀏覽器訪問 http://localhost:3000

# 測試檔案上傳功能
bun run test:upload
```

##  下一步：設置 LINE Webhook

### 1. 取得你的開發 URL
開發服務器啟動後，你會看到類似這樣的輸出：
```
⎔ Starting local server...
[mf:inf] Ready on http://localhost:8787
```

### 2. 使用 ngrok 建立公開 URL（開發用）
```bash
# 安裝 ngrok (如果還沒有)
bun install -g ngrok

# 在另一個終端建立隧道
ngrok http 8787
```

### 3. 設置 LINE Webhook
1. 登入 [LINE Developers Console](https://developers.line.biz/)
2. 選擇你的 Messaging API Channel
3. 在 "Webhook settings" 中：
   - Webhook URL: `https://your-ngrok-url.ngrok.io/api/webhook`
   - 啟用 "Use webhook"
   - 點擊 "Verify" 測試連接

### 4. 測試 LINE 整合
1. 掃描你的 LINE Bot QR Code
2. 發送一條訊息
3. 檢查開發服務器日誌，應該會看到 webhook 事件

##  部署到生產環境

### 1. 一鍵部署 (推薦)
```bash
# 使用自動化部署腳本
.\quick-deploy.ps1

# 部署到測試環境
.\quick-deploy.ps1 -Environment staging

# 查看所有選項
.\quick-deploy.ps1 -Help
```

### 2. 手動部署到 Cloudflare Workers
```bash
# 部署
bun run deploy

# 檢查部署狀態
wrangler deployments list
```

### 2. 設置生產環境資料庫
```bash
# 執行生產環境資料庫遷移
wrangler d1 execute omni-channel-platform --file=./database/schema.sql
wrangler d1 execute omni-channel-platform --file=./database/file-attachments-schema.sql

# 或使用自動化腳本
bun run setup:production
```

### 3. 部署前端應用
```bash
# 建置前端應用
cd frontend
bun run build

# 部署到 Cloudflare Pages (或其他靜態託管服務)
wrangler pages publish dist --project-name multi-channel-platform-ui
```

### 4. 更新 LINE Webhook URL
將 Webhook URL 更新為你的生產域名：
`https://multi-channel-platform.imfinethankyouandyou.com/api/webhook`

##  驗證清單

- [ ]  Cloudflare 帳戶已設置 (Workers + D1 + R2)
- [ ]  D1 資料庫已建立並初始化
- [ ]  R2 儲存桶已建立
- [ ]  LINE 憑證已設置
- [ ]  JWT 密鑰已設置
- [ ]  後端開發服務器正常啟動
- [ ]  前端開發服務器正常啟動
- [ ]  健康檢查端點回應正常
- [ ]  前端應用可正常訪問
- [ ]  LINE Webhook 設置完成
- [ ]  檔案上傳功能正常
- [ ]  能接收並回覆 LINE 訊息
- [ ]  管理員帳戶可正常登入
- [ ]  前端測試套件通過 (100% 覆蓋率，132/132 測試)
- [ ]  團隊管理和邀請系統正常
- [ ]  延遲訊息功能正常 (43 個測試通過)
- [ ]  訊息撤回機制正常
- [ ]  API 代理配置正確 (12 個測試通過)
- [ ]  TypeScript 類型檢查通過 (0 個錯誤)

##  恭喜！

你的 multi-channel-platform 系統已經成功運行！這是一個功能完整的生產就緒系統，具備最新的延遲訊息功能。

##  接下來的步驟

1. **查看用戶手冊**：`USER_MANUAL.md` - 了解如何使用系統，包含延遲訊息功能
2. **查看技術文件**：`README.md` - 了解技術架構和 132 個測試報告
3. **查看文件中心**：`docs/README.md` - 完整文件導覽
4. **開始使用系統功能**：
   -  用戶認證和會話管理
   -  團隊管理和成員邀請
   -  對話管理和訊息處理
   -  **延遲發送訊息** - 1-120 秒延遲發送，可撤回機制
   -  **訊息撤回系統** - 完整的撤回功能和日誌記錄
   -  檔案附件上傳和管理 (Cloudflare R2)
   -  系統設定和平台整合
   -  LINE OA 完整整合

##  最新功能亮點

### 延遲訊息系統
- **靈活延遲設定**: 支援 1-120 秒延遲發送
- **即時撤回機制**: 發送前可隨時撤回
- **實時狀態管理**: 動態倒數計時，顏色編碼
- **企業級日誌**: 完整的操作記錄和統計

### 技術優化
- **API 代理優化**: 統一環境變數配置
- **TypeScript 優化**: 解決 207 個警告，0 個錯誤
- **測試系統完善**: 132 個測試，100% 通過率

##  遇到問題？

### 常見問題：

**Q: 資料庫連接失敗**
```bash
# 檢查資料庫是否存在
wrangler d1 list

# 檢查 wrangler.toml 中的 database_id 是否正確
# 重新執行資料庫初始化
bun run db:migrate:attachments
```

**Q: LINE Webhook 驗證失敗**
- 確認 Channel Secret 設置正確
- 檢查 Webhook URL 是否可訪問
- 查看 Worker 日誌：`wrangler tail`

**Q: 開發服務器啟動失敗**
```bash
# 檢查 TypeScript 編譯
bunx tsc --noEmit

# 重新生成類型定義
bun run cf-typegen
```

**Q: 檔案上傳失敗**
```bash
# 檢查 R2 儲存桶是否存在
wrangler r2 bucket list

# 測試檔案上傳功能
bun run test:upload
bun run verify:upload

# 執行完整測試套件 (前端)
cd frontend
bun run test:run

# 檢查測試覆蓋率
bun run test:coverage
```

**Q: 前端無法連接後端**
- 確認後端服務器在 http://localhost:8787 運行
- 確認前端服務器在 http://localhost:3000 運行
- 檢查 CORS 設定

**需要幫助？** 查看 `docs/SETUP_GUIDE.md` 中的詳細故障排除指南。