# Claude 程式碼文檔索引 (Documentation Index)

歡迎使用多渠道客戶支援系統的擴充文檔。本目錄包含從主 `CLAUDE.md` 文件中提取的詳細指南，旨在提供更好的組織結構和性能。

##  快速導覽

### 核心文檔
- **[CLAUDE.md](../../CLAUDE.md)** - 主專案概覽與快速參考 ( 針對快速加載進行了優化)

### 詳細指南

####  **環境配置 (Environment Configuration)**
- **文件：** [`ENVIRONMENT_CONFIG.md`](ENVIRONMENT_CONFIG.md)
- **大小：** 約 6,000 字元
- **內容：**
  - 完整的 3 層架構說明
  - 所有環境變數 (前端 + 後端)
  - 配置函數參考
  - 環境切換指南
  - 最佳實踐與故障排除
- **使用場景：** 設置環境、在開發/生產環境間切換、配置 URL

####  **測試策略 (Testing Strategy)**
- **文件：** [`TESTING.md`](TESTING.md)
- **大小：** 約 2,000 字元
- **內容：**
  - WebSocket 測試基礎設施
  - 前端測試 (132+ 個測試)
  - 後端測試
  - 運行測試指南
  - 測試最佳實踐
- **使用場景：** 編寫測試、運行測試套件、瞭解測試架構

####  **路由註冊 (Route Registration)**
- **文件：** [`ROUTE_REGISTRATION.md`](ROUTE_REGISTRATION.md)
- **大小：** 約 4,000 字元
- **內容：**
  - 關鍵路由順序規則
  - src/index.ts 中的優先級層級
  - 常見陷阱與解決方案
  - 註冊檢查清單
  - 調試技巧
- **使用場景：** 添加新 API 端點、調試 401 錯誤、解決路由衝突

####  **Web 安裝程式 (Web Installer)**
- **文件：** [`WEB_INSTALLER.md`](WEB_INSTALLER.md)
- **大小：** 約 5,000 字元
- **內容：**
  - 完整架構概覽
  - 15 步部署流水線
  - 測試結果與覆蓋率
  - 文檔引用
  - 成本估算
- **使用場景：** 瞭解 Web 安裝程式、為客戶進行部署、故障排除

####  **團隊管理 (Team Management)** (新)
- **文件：** [`TEAM_MANAGEMENT.md`](TEAM_MANAGEMENT.md)
- **大小：** 約 8,000 字元
- **內容：**
  - 雙重角色架構 (系統角色 + 團隊角色)
  - 基於 JWT 緩存的多團隊支持
  - 帶有拖放功能的動態排序系統
  - 團隊範圍的 WebSocket 廣播
  - 帶有外鍵清理的成員刪除功能
  - 受保護的 API 端點
- **使用場景：** 開發團隊功能、瞭解角色層級、實現排序

##  尋找所需內容

### 按任務查找

**我想要...**

- **設置開發環境** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md) + [CLAUDE.md 快速開始](../../CLAUDE.md#quick-start-for-development)
- **切換開發與生產環境** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md#environment-switching-guide)
- **添加新的 API 端點** → [ROUTE_REGISTRATION.md](ROUTE_REGISTRATION.md)
- **為程式碼編寫測試** → [TESTING.md](TESTING.md)
- **瞭解 Web 安裝程式** → [WEB_INSTALLER.md](WEB_INSTALLER.md)
- **開發團隊管理功能** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md)
- **實現排序/拖放功能** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md#dynamic-sorting-system)
- **修復 CORS 問題** → [CLAUDE.md CORS 文檔](../../CLAUDE.md#cors-configuration-documentation)
- **部署到生產環境** → [CLAUDE.md 生產環境部署](../../CLAUDE.md#production-deployment)

### 按組件查找

**我正在開發...**

- **前端 (Vue 3)** → [CLAUDE.md 前端架構](../../CLAUDE.md#frontend-vue-3-application)
- **後端 (Cloudflare Workers)** → [CLAUDE.md 後端架構](../../CLAUDE.md#backend-cloudflare-worker)
- **資料庫 (D1 + Drizzle)** → [CLAUDE.md 資料庫與 ORM](../../CLAUDE.md#database--orm)
- **WebSocket** → [TESTING.md WebSocket 測試](TESTING.md#comprehensive-websocket-testing-infrastructure)
- **團隊管理** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md)
- **排序與拖放** → [TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md#dynamic-sorting-system)
- **環境配置** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md)
- **測試** → [TESTING.md](TESTING.md)

### 按問題查找

**我遇到了...**

- **401 Unauthorized 錯誤** → [ROUTE_REGISTRATION.md 常見陷阱](ROUTE_REGISTRATION.md#common-pitfalls--solutions)
- **CORS 錯誤** → [CLAUDE.md CORS 文檔](../../CLAUDE.md#cors-configuration-documentation)
- **環境變數錯誤** → [ENVIRONMENT_CONFIG.md 故障排除](ENVIRONMENT_CONFIG.md#troubleshooting-configuration-issues)
- **測試失敗** → [TESTING.md](TESTING.md) + [CLAUDE.md 故障排除](../../CLAUDE.md#troubleshooting)
- **WebSocket 連接問題** → [ENVIRONMENT_CONFIG.md](ENVIRONMENT_CONFIG.md#troubleshooting-configuration-issues)

##  文檔統計

```
總文檔大小：約 25,000 字元 (從 48,300 字元拆分)
CLAUDE.md：約 28,000 字元 (已更新新功能)
模組化文檔：5 個文件，總計約 25,000 字元

文件結構：
├── ENVIRONMENT_CONFIG.md  (約 6,000 字元)
├── TESTING.md (約 2,000 字元)
├── ROUTE_REGISTRATION.md  (約 4,000 字元)
├── WEB_INSTALLER.md (約 5,000 字元)
└── TEAM_MANAGEMENT.md (約 8,000 字元) [新]

維護性：6 個專注的文件，更易於導覽
```

##  最佳實踐

1. **從 CLAUDE.md 開始** - 獲取整體架構和快速參考。
2. **需要時深入瞭解** - 打開特定主題的詳細指南。
3. **使用搜索** - 每個文件都非常專注且易於搜索。
4. **保持更新** - 更新文檔時，請同時維護 `CLAUDE.md` 中的摘要和模組化文件中的詳細內容。

##  更新流程

添加新文檔時：

1. **在 CLAUDE.md 添加摘要** (最多 2-3 段)。
2. 如果超過 2,000 字元，在 `docs/claude/` 中 **創建詳細指南**。
3. 從 `CLAUDE.md` **添加鏈接** 到詳細指南。
4. **更新此 INDEX.md**，加入新的文件參考。
5. **測試** 所有鏈接是否正常工作。

##  最近更改

### 2025-01-16：企業級團隊管理與排序系統
-  **RBAC 第 2 階段**：團隊角色層級 (成員 → 領導 → 主管)。
-  **多團隊支持**：JWT 緩存權限，減少 50% 資料庫查詢。
-  **動態排序**：基於字段的排序系統與 SortDropdown 組件。
-  **拖放功能**：自定義排序並持久化至 localStorage (vue-draggable-plus)。
-  **團隊範圍廣播**：WebSocket 安全隔離。
-  **成員刪除**：完整的外鍵清理。
-  **自動分配廣播**：LINE 追蹤事件的實時 UI 更新。
-  **競態條件修復**：解決了對話視圖中空訊息閃爍的問題。
-  **程式碼質量**：消除了所有 TypeScript 未使用變數警告。

### 2025-01-31：模組化文檔遷移
-  創建了模組化文檔結構。
-  從 `CLAUDE.md` 中提取了 4 個主要章節。
-  將 `CLAUDE.md` 從 48.3k 減少到約 27k 字元 (減少 44%)。
-  創建了導覽索引 (即本文件)。
-  驗證了所有交叉引用。

##  獲取幫助

- **文檔問題**：檢查內容是否過時或不明確。
- **技術問題**：參閱 [CLAUDE.md 故障排除](../../CLAUDE.md#troubleshooting)。
- **問題諮詢**：查閱相關詳細指南或在專案討論中提問。

---

**導覽：** [返回 CLAUDE.md](../../CLAUDE.md) | [專案 README](../../README.md)
