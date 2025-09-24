# 多渠道客服整合系統 (Multi-Channel Customer Support System)

一個基於 Cloudflare Workers 和 Vue 3 的現代化企業級客服系統，整合 **Drizzle ORM**、**Cloudflare KV** 和完整的 **API 監控儀表板**，提供型別安全的資料庫操作、高效能的快取機制，以及實時的系統監控功能。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/Vue-3.5-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-green.svg)
![Cloudflare KV](https://img.shields.io/badge/Cloudflare-KV-blue.svg)
![Test Coverage](https://img.shields.io/badge/Test%20Coverage-100%25-brightgreen.svg)
![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)
![Production Ready](https://img.shields.io/badge/Production-Ready-success.svg)

## 📋 文件導覽

### 🎯 針對不同用戶的文件

#### 👨‍💻 開發者使用場景
- **快速開發部署** → 使用 `.\scripts\developer-deploy.ps1` 快速部署和迭代
- **技術文件** → 本文件 (README.md) - 技術架構和開發指南
- **API 文檔** → [📚 API 文檔](docs/api/) - 完整的 API 參考
- **持續開發** → 不斷改進系統功能，維護代碼庫

#### 🏢 用戶使用場景  
- **一鍵部署** → 使用 `.\scripts\user-deploy.ps1` 獲得完整的客服系統基礎設施
- **用戶手冊** → [📖 用戶使用手冊](docs/USER_GUIDE.md) - 詳細的系統使用說明
- **快速設置** → [🚀 快速開始指南](docs/QUICK_START.md) - 5分鐘快速部署
- **無需技術細節** → 專注於業務使用，無需了解技術實現

### 📋 本文件目錄

- [🆕 最新更新](#-最新更新)
- [功能特色](#功能特色)
- [系統架構](#系統架構)
- [技術棧](#技術棧)
- [快速開始](#快速開始)
- [部署方案](#部署方案)
- [開發狀態](#開發狀態)
- [專案結構](#專案結構)
- [API 文件](#api-文件)
- [監控和維護](#監控和維護)
- [設定說明](#設定說明)
- [常見問題](#常見問題)
- [授權](#授權)

## 🆕 最新更新

### 🚀 WebSocket + Durable Objects 企業級實時系統完成 (v4.0.0) 🎉
- **完整技術棧升級** - 從 SSE + 輪詢升級到 WebSocket + Durable Objects 企業級架構
- **真正雙向即時通訊** - 毫秒級訊息傳遞，支援 1000+ 併發連接
- **分散式狀態管理** - 基於 Cloudflare Durable Objects 的全球分散式即時連接
- **漸進式遷移框架** - 平滑遷移，零停機時間，30秒緊急回滾能力
- **企業級負載測試驗證** - 通過 1000+ 併發連接和高頻訊息吞吐量測試
- **完整測試基礎設施** - 包含單元測試、整合測試、效能測試和壓力測試
- **即時 UI 組件** - 打字指示器、在線狀態、連接品質監控

### 🎯 API 監控儀表板完成 (v3.0.0)
- **企業級監控系統** - 完整的實時API狀態監控
- **智能診斷功能** - 自動檢測API問題並提供詳細分析
- **完美響應式設計** - 支援桌面、平板、手機的完整響應式體驗
- **統一設計系統** - 與其他管理頁面完全一致的設計風格
- **高效部署方案** - 混合 PowerShell + Terraform 部署架構

### 🚀 部署系統優化 (v3.0.0)
- **雙軌部署方案** - 開發人員快速部署 + 用戶基礎設施部署
- **自動化腳本** - 解決編碼問題，提供穩定的一鍵部署體驗
- **環境配置驗證** - 自動檢查部署前置條件和配置
- **錯誤處理優化** - 優雅處理部署中的各種問題情況

### 🎨 Dashboard 現代化完成 (v2.1.0)
- **極簡設計重新設計** - 採用現代極簡風格，大幅提升用戶體驗
- **TypeScript 0 錯誤** - 完整的類型安全，編譯零錯誤
- **100% 測試覆蓋** - 132 個測試全部通過，確保系統穩定性
- **企業級 UI/UX** - 專業的視覺設計和交互體驗

### 🔧 技術架構升級 (WebSocket + Durable Objects)
- **🚀 即時通訊革命**: WebSocket + Durable Objects 架構，真正的雙向即時通訊
- **⚡ 毫秒級延遲**: P95 延遲 < 500ms，支援 1000+ 併發連接
- **🏗️ 分散式狀態**: Durable Objects 提供全球分散式狀態管理
- **🔒 零競態條件**: 跨 Durable Objects 分散式鎖機制
- **📡 智能廣播**: 事件優先級佇列和批次處理優化
- **🔄 漸進式遷移**: 功能旗標控制的平滑升級，30秒緊急回滾
- **🧪 企業級測試**: 單元、整合、效能、壓力測試完整覆蓋
- **📊 即時監控**: 連接品質、效能指標、健康狀態即時監控

## ✨ 功能特色

### 🚀 WebSocket 即時通訊系統 (NEW! v4.0.0)
- **⚡ 真正雙向通訊** - 毫秒級訊息傳遞，告別輪詢延遲
- **📡 即時打字指示器** - 顯示用戶名稱的即時打字狀態
- **👥 線上狀態追蹤** - 即時顯示用戶在線/離線/忙碌狀態
- **🔄 自動重連機制** - 指數退避重連，網路中斷自動恢復
- **📊 連接品質監控** - 優秀/良好/一般/差的即時連接品質顯示
- **🎯 漸進式升級** - 從 SSE 平滑遷移到 WebSocket，零停機時間
- **🔒 企業級安全** - JWT 認證 + 角色權限控制的 WebSocket 連接
- **🏗️ 分散式架構** - Durable Objects 提供全球分散式狀態管理

### 🎯 API 監控儀表板
- **📊 實時監控** - 15秒自動刷新的API狀態監控
- **🔍 智能診斷** - 點擊統計卡片查看詳細API狀態和錯誤原因
- **📱 響應式設計** - 完美支援桌面、平板、手機設備
- **⚡ 快速操作** - 一鍵刷新、狀態篩選、搜索功能
- **🎨 統一設計** - 與團隊管理、系統設定等頁面風格完全一致
- **🔧 開發友好** - 詳細的錯誤信息和診斷建議

### 🚀 智能部署系統 (New!)
- **👨‍💻 開發者模式** - 快速迭代部署 (`developer-deploy.ps1`)
  - 支援前端/後端分別部署
  - 跳過測試和建置選項
  - 30秒快速部署週期
- **🏢 用戶模式** - 完整基礎設施部署 (`user-deploy.ps1`)
  - Terraform 基礎設施即程式碼
  - 自動環境檢查和配置
  - 完整的資源生命週期管理

### 核心功能
- 🔄 **多渠道整合** - 統一管理 LINE OA 和 Facebook Messenger 訊息
- 💬 **即時對話管理** - 即時接收和回覆客戶訊息，支援智能快取
- 👥 **企業級團隊協作** - 3級權限系統 (Admin/Team/Agent) 支援多客服協作
- 📊 **對話狀態追蹤** - 待處理、處理中、已結束的清晰狀態管理
- 🔐 **安全認證** - JWT 基礎的安全認證機制，完整的RBAC權限控制
- 📱 **響應式設計** - 完美支援桌面和移動裝置的現代化界面

### 已完成功能 (Production Ready)
- ✅ **WebSocket + Durable Objects 架構** - 企業級即時通訊系統，1000+ 併發連接驗證
- ✅ **LINE OA 完整整合** - Webhook 接收、訊息處理、客戶資料收集 + 即時 WebSocket 事件
- ✅ **完整認證系統** - JWT 認證、會話管理、3級權限控制 + WebSocket 安全連接
- ✅ **即時對話管理系統** - 對話列表、詳情檢視、狀態管理 + 即時更新和協作
- ✅ **即時訊息處理** - 發送、接收、附件支援、延遲發送 + WebSocket 即時廣播
- ✅ **企業級團隊管理** - 成員管理、邀請系統、團隊層級權限 + 即時狀態同步
- ✅ **系統設定** - 平台整合、進階設定、資料庫管理
- ✅ **檔案上傳** - 附件處理、Cloudflare R2 整合
- ✅ **完整測試系統** - WebSocket 測試基礎設施、效能測試、壓力測試
- ✅ **效能優化** - 虛擬滾動、延遲載入、打包優化 + WebSocket 連接優化
- ✅ **企業級安全** - 多層權限控制、資料隔離、加密存儲 + WebSocket 安全
- ✅ **現代化 Dashboard** - Vue 3 + TypeScript，企業級 UI/UX + 即時狀態指示器
- ✅ **API 監控系統** - 實時狀態監控，智能診斷，完美響應式
- ✅ **智能部署方案** - 雙軌部署，自動化腳本，環境驗證 + WebSocket 漸進式遷移
- ✅ **緊急回滾系統** - 30秒完整系統回滾到 SSE，零停機遷移

### 最新功能 (Latest Features - v4.0.0)
- ✅ **WebSocket 即時通訊革命** - 完整替換 SSE 架構，真正雙向即時通訊
- ✅ **Durable Objects 分散式狀態** - 全球邊緣分散式狀態管理
- ✅ **即時打字指示器** - 顯示用戶名稱的即時打字狀態
- ✅ **線上狀態追蹤** - 即時用戶在線/離線/忙碌狀態
- ✅ **漸進式遷移框架** - 功能旗標控制的平滑升級，30秒緊急回滾
- ✅ **企業級負載測試** - 1000+ 併發連接和高頻訊息吞吐量驗證
- ✅ **延遲發送訊息** - 支援 1-120 秒延遲發送，可撤回機制 + WebSocket 即時倒數
- ✅ **訊息撤回系統** - 完整的撤回功能和日誌記錄 + WebSocket 即時通知
- ✅ **API 監控儀表板** - 企業級監控，15秒自動刷新，智能診斷
- ✅ **混合部署系統** - PowerShell + Terraform + WebSocket 漸進式部署

## 🏗️ 系統架構

### 整體架構
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vue 3 前端    │────│  Cloudflare      │────│   外部平台 API   │
│   (TypeScript)  │    │   Workers 後端   │    │   (LINE/FB)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────────┐            │
         └──────────────│  Cloudflare 基礎  │────────────┘
                       │     設施生態系統    │
                       └──────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   D1 資料庫   │    │   KV 存儲     │    │   R2 對象存儲  │
│ (SQLite 相容) │    │  (快取/會話)  │    │  (檔案/附件)   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                       │                       │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Queues     │    │    AI 整合    │    │  監控系統     │
│ (訊息佇列)    │    │ (Chat 機器人)  │    │ (API Monitor) │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 核心技術棧

#### 後端 (Cloudflare Workers)
- **🔧 框架**: Hono.js (輕量級、高效能)
- **💾 資料庫**: Cloudflare D1 (SQLite) + Drizzle ORM
- **⚡ 快取**: Cloudflare KV (分散式鍵值存儲)
- **📁 檔案存儲**: Cloudflare R2 (S3 相容)
- **🔄 訊息佇列**: Cloudflare Queues (延遲訊息)
- **🔒 認證**: JWT + 3級權限系統
- **📊 監控**: 內建API監控系統

#### 前端 (Vue 3 Application)
- **🖼️ 框架**: Vue 3 + Composition API + TypeScript
- **📦 狀態管理**: Pinia + 響應式架構
- **🎨 UI/UX**: 現代極簡設計 + 完美響應式
- **🧪 測試**: Vitest + 100% 測試覆蓋
- **🛠️ 建置**: Vite + 先進打包優化
- **📱 設計系統**: 統一的組件和設計語言

## 🚀 快速開始

### 前置需求
- Node.js 16+ 和 npm
- Wrangler CLI (Cloudflare 開發工具)
- Cloudflare 帳戶和 API Token
- LINE Developer 帳戶 (可選)

### 1. 環境設置 (5分鐘)
```bash
# 1. 複製專案
git clone <repository-url>
cd Multi_Channel_Integration_System

# 2. 自動環境設置 (Windows)
.\setup-env.ps1

# 3. 登入 Cloudflare
wrangler login
```

### 2. 選擇部署方式

#### 🔧 開發者快速部署 (推薦用於開發)
```bash
# 完整部署 (約2分鐘)
.\scripts\developer-deploy.ps1

# 只部署後端
.\scripts\developer-deploy.ps1 -BackendOnly

# 只部署前端
.\scripts\developer-deploy.ps1 -FrontendOnly

# 跳過建置的快速部署
.\scripts\developer-deploy.ps1 -SkipBuild -Force
```

#### 🏢 用戶基礎設施部署 (推薦用於生產)
```bash
# 設置環境變數
$env:CLOUDFLARE_API_TOKEN = "your-api-token"
$env:TF_VAR_line_channel_access_token = "your-line-token"
$env:TF_VAR_line_channel_secret = "your-line-secret"
$env:TF_VAR_admin_email = "admin@example.com"
$env:TF_VAR_admin_password = "secure-password"

# 查看部署計劃
.\scripts\user-deploy.ps1 -PlanOnly

# 完整部署
.\scripts\user-deploy.ps1 -AutoApprove
```

### 3. 訪問應用
- **後端 API**: https://multi-channel.imfinethankyouandyou.com
- **前端應用**: https://multi-channel-platform-frontend.pages.dev
- **API 監控**: 登入後點擊側邊欄「API監控」

## 📊 部署方案

我們提供了兩套部署方案，滿足不同場景需求：

### 🔧 開發者部署 (`developer-deploy.ps1`)
**適用場景**: 日常開發、功能測試、快速迭代

**特點**:
- ⚡ 快速部署 (30秒-2分鐘)
- 🎯 靈活選項 (前端/後端分別部署)
- 🔄 簡單易用 (基於 Wrangler CLI)
- 🚫 不需要 Terraform 知識

**使用方法**:
```bash
# 查看所有選項
.\scripts\developer-deploy.ps1 -Help

# 完整部署
.\scripts\developer-deploy.ps1

# 快速部署 (跳過建置和確認)
.\scripts\developer-deploy.ps1 -SkipBuild -Force
```

### 🏢 用戶部署 (`user-deploy.ps1`)
**適用場景**: 生產環境、初次部署、基礎設施管理

**特點**:
- 🏗️ 完整基礎設施 (Terraform IaC)
- 🔒 環境隔離 (development/production)
- 📊 狀態管理 (資源追蹤和回滾)
- 🔄 可重複部署 (標準化流程)

**使用方法**:
```bash
# 查看所有選項
.\scripts\user-deploy.ps1 -Help

# 查看部署計劃
.\scripts\user-deploy.ps1 -PlanOnly

# 生產環境部署
.\scripts\user-deploy.ps1 -AutoApprove
```

### 📋 部署方案對比

| 特性 | 開發者部署 | 用戶部署 |
|------|-----------|----------|
| **部署時間** | 30秒-2分鐘 | 5-10分鐘 |
| **學習成本** | 低 (PowerShell) | 中等 (Terraform) |
| **基礎設施管理** | 基礎 | 完整 |
| **環境一致性** | 中等 | 優秀 |
| **適用場景** | 開發迭代 | 生產部署 |
| **回滾能力** | 手動 | 自動 |

## 📊 監控和維護

### API 監控儀表板
本系統內建完整的API監控功能：

#### 🎯 核心功能
- **📊 實時狀態監控** - 15秒自動刷新，即時掌握API健康狀況
- **🔍 智能診斷** - 點擊統計卡片查看詳細錯誤信息和解決建議
- **📱 響應式設計** - 完美支援桌面、平板、手機的監控體驗
- **⚡ 快速操作** - 一鍵測試API、查看日誌、搜索篩選

#### 📈 監控指標
- **正常端點** - 響應時間 < 1秒，狀態碼 200-299
- **警告端點** - 響應時間 > 1秒 或 需要認證 (401)
- **錯誤端點** - 網絡錯誤、5xx錯誤、連接超時
- **總端點數** - 系統監控的API端點總覽

#### 📋 使用方法
1. 管理員登入系統
2. 點擊左側導航「API監控」
3. 查看統計概覽和點擊卡片獲取詳情
4. 使用篩選和搜索功能定位問題
5. 點擊「測試API」按鈕驗證修復結果

### 系統維護
- **日誌監控**: Cloudflare Workers 日誌
- **效能監控**: Worker 啟動時間和執行時間
- **錯誤追蹤**: 完整的錯誤堆疊和上下文
- **健康檢查**: `/api/system/health` 端點

## 🎯 開發狀態

### 當前版本: v4.0.0 (Enterprise-Ready WebSocket System)

#### ✅ 已完成 (100% Ready)
- **🚀 WebSocket + Durable Objects 架構** - 企業級即時通訊，1000+ 併發連接驗證
- **⚡ 真正雙向即時通訊** - 毫秒級訊息傳遞，P95 延遲 < 500ms
- **🏗️ 分散式狀態管理** - 全球邊緣 Durable Objects 狀態同步
- **🔒 零競態條件** - 跨 Durable Objects 分散式鎖機制
- **📡 智能事件廣播** - 優先級佇列和批次處理優化
- **🔄 漸進式遷移** - 功能旗標控制，30秒緊急回滾
- **🧪 企業級測試** - 完整 WebSocket 測試基礎設施
- **📊 即時監控** - 連接品質、效能指標、健康狀態追蹤
- **多平台整合** - LINE OA 完整支援 + WebSocket 事件，Facebook Messenger 準備就緒
- **企業級權限系統** - Admin/Team/Agent 3級權限，完整RBAC + WebSocket 安全
- **即時團隊協作** - 打字指示器、線上狀態、對話分配即時同步
- **延遲訊息系統** - 1-120秒延遲發送 + WebSocket 即時倒數和撤回
- **現代化前端** - Vue 3 + TypeScript + WebSocket 客戶端，100%測試覆蓋
- **API 監控系統** - 實時監控，智能診斷，響應式設計
- **智能部署方案** - 雙軌部署 + WebSocket 漸進式遷移

#### 🔄 持續優化中
- **AI 整合** - Chat 機器人和智能回覆 (規劃中)
- **高級分析** - 對話分析和客戶洞察 (規劃中)
- **多語言支援** - 國際化界面 (規劃中)

### 測試狀況
- **前端測試**: 132個測試，100%通過率
- **TypeScript**: 0個編譯錯誤，完整類型安全
- **ESLint**: 符合代碼規範，無警告
- **建置**: 所有環境建置成功

### 效能指標 (WebSocket System)
- **WebSocket 連接時間**: <100ms
- **訊息傳遞延遲**: <500ms (P95)，<200ms (P50)
- **併發連接支援**: 1000+ 連接經負載測試驗證
- **訊息吞吐量**: 100+ 訊息/秒持續處理能力
- **Worker 啟動時間**: <15ms
- **API 響應時間**: <200ms (P95)
- **前端載入時間**: <3s (首次)，<1s (後續)
- **WebSocket 重連時間**: <3s (指數退避)
- **測試執行時間**: <60s (包含 WebSocket 測試套件)

## 📁 專案結構

```
Multi_Channel_Integration_System/
├── 📁 src/                          # 後端代碼 (Cloudflare Workers)
│   ├── 📁 handlers/                 # API 處理器
│   │   ├── auth-main.ts             # 認證相關API
│   │   ├── conversation-main.ts     # 對話管理API
│   │   ├── team-main.ts            # 團隊管理API
│   │   ├── system-main.ts          # 系統設定API
│   │   └── customer-main.ts        # 客戶管理API
│   ├── 📁 db/                       # 資料庫相關
│   │   └── schema.ts               # Drizzle ORM 架構定義
│   ├── 📁 services/                # 業務邏輯服務
│   ├── 📁 utils/                   # 工具函數
│   ├── 📁 types/                   # TypeScript 類型定義
│   └── index.ts                    # Worker 入口點
├── 📁 frontend/                     # 前端應用 (Vue 3)
│   ├── 📁 src/
│   │   ├── 📁 components/          # Vue 組件
│   │   ├── 📁 views/              # 頁面視圖
│   │   │   ├── ApiMonitor.vue     # API監控儀表板
│   │   │   ├── TeamManagement.vue # 團隊管理
│   │   │   └── Dashboard.vue      # 主儀表板
│   │   ├── 📁 stores/             # Pinia 狀態管理
│   │   ├── 📁 api/                # API 客戶端
│   │   └── main.ts                # 應用入口
│   ├── 📁 tests/                  # 測試檔案 (132個測試)
│   └── package.json               # 前端依賴
├── 📁 scripts/                     # 部署和工具腳本
│   ├── developer-deploy.ps1       # 開發者快速部署
│   ├── user-deploy.ps1            # 用戶基礎設施部署
│   └── deploy-production.ps1      # 完整生產部署
├── 📁 terraform/                   # 基礎設施即程式碼
│   ├── main.tf                    # 主要 Terraform 配置
│   ├── variables.tf               # 變數定義
│   └── outputs.tf                 # 輸出定義
├── 📁 docs/                        # 項目文檔
│   ├── API_MONITOR_FINAL_UPDATES.md # API監控功能文檔
│   ├── USER_GUIDE.md              # 用戶使用指南
│   └── QUICK_START.md             # 快速開始指南
├── wrangler.toml                   # Cloudflare Workers 配置
├── package.json                    # 後端依賴和腳本
└── README.md                       # 項目說明 (本文件)
```

## 📚 API 文件

### 核心 API 端點
- `GET /api/system/health` - 系統健康檢查
- `GET /api/system/api-status` - API 狀態監控 (新功能)
- `POST /api/auth/login` - 用戶登入
- `GET /api/conversations` - 對話列表
- `GET /api/team/members` - 團隊成員管理
- `POST /api/messages/delayed` - 延遲訊息發送

### API 監控功能
系統提供完整的API監控功能，包括：
- **實時狀態檢查** - 每15秒自動檢查所有API端點
- **智能分類** - 自動分類正常/警告/錯誤狀態
- **詳細診斷** - 提供具體錯誤原因和解決建議
- **響應式界面** - 完美支援所有設備尺寸

### 認證和權限
- **JWT Token** - 所有API使用JWT進行認證
- **3級權限系統** - Admin(管理員) > Team(團隊主管) > Agent(客服專員)
- **團隊隔離** - 確保不同團隊間的資料隔離

## ⚙️ 設定說明

### 環境變數
**後端 (Cloudflare Workers)**:
```bash
ENVIRONMENT=production
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

**前端 (Cloudflare Pages)**:
```bash
VITE_API_BASE_URL=https://multi-channel.imfinethankyouandyou.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
```

### 資料庫配置
- **D1 資料庫** - 自動創建和遷移
- **KV 存儲** - 會話和快取管理
- **R2 存儲** - 檔案上傳和附件

### LINE OA 設定
1. 在 LINE Developers Console 創建 Messaging API 頻道
2. 設定 Webhook URL: `https://your-domain.com/api/webhooks/line`
3. 獲取 Channel Access Token 和 Channel Secret
4. 在部署時設定環境變數

## 🔧 常見問題

### 部署相關

**Q: 應該選擇哪種部署方式？**
A: 
- 開發和測試: 使用 `developer-deploy.ps1`
- 生產環境首次部署: 使用 `user-deploy.ps1`
- 日常更新: 使用 `developer-deploy.ps1`

**Q: 部署失敗怎麼辦？**
A:
1. 檢查 Cloudflare 登入狀態: `wrangler whoami`
2. 確認環境變數設定正確
3. 查看詳細錯誤日誌
4. 檢查 API 監控儀表板中的系統狀態

**Q: 如何更新現有的部署？**
A:
```bash
# 快速更新 (推薦)
.\scripts\developer-deploy.ps1 -Force

# 只更新後端
.\scripts\developer-deploy.ps1 -BackendOnly

# 只更新前端
.\scripts\developer-deploy.ps1 -FrontendOnly
```

### 功能相關

**Q: API 監控顯示錯誤狀態？**
A:
1. 點擊錯誤狀態卡片查看詳細信息
2. 檢查具體的錯誤原因和時間
3. 使用「測試API」按鈕驗證修復
4. 查看系統健康檢查: `/api/system/health`

**Q: 如何設定團隊權限？**
A:
1. 以Admin身份登入
2. 進入「團隊管理」頁面
3. 創建團隊並指派團隊主管
4. 邀請成員並設定適當權限

### 技術問題

**Q: 前端測試失敗？**
A:
```bash
cd frontend
npm run test           # 運行測試
npm run type-check     # 類型檢查
npm run lint          # 代碼規範檢查
```

**Q: 如何查看系統日誌？**
A:
1. Cloudflare Dashboard → Workers & Pages → 選擇 Worker
2. 點擊「Logs」標籤查看實時日誌
3. 使用 API 監控儀表板查看狀態概覽

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 文件

---

## 🔗 相關連結

- [🎯 API 監控功能詳細說明](API_MONITOR_FINAL_UPDATES.md)
- [📚 用戶使用手冊](docs/USER_GUIDE.md)
- [🚀 快速開始指南](docs/QUICK_START.md)
- [🏗️ 架構設計文檔](docs/ARCHITECTURE.md)
- [🧪 測試指南](docs/TESTING.md)

**🎉 感謝使用多渠道客服整合系統！如果您覺得這個項目有用，請給我們一個 ⭐ Star！**