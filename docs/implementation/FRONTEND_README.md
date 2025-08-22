# 多渠道客服系統前端應用

現代化、響應式的 Vue 3 前端應用程式，用於管理多平台客戶支援對話。

## 🚀 功能特色

- **現代化 UI/UX**：簡潔專業的介面設計，支援響應式佈局
- **多平台支援**：統一管理 LINE、Facebook、Instagram 和 WhatsApp 對話
- **即時更新**：透過輪詢機制實現對話即時更新
- **組件庫**：可重用的 UI 組件，具有一致的設計系統
- **類型安全**：完整的 TypeScript 支援，嚴格類型檢查
- **狀態管理**：使用 Pinia 進行高效狀態管理
- **路由系統**：Vue Router 搭配認證守衛和導航
- **效能優化**：使用 Vite 構建工具和代碼分割優化

## 技術棧

- **Vue 3** - 漸進式 JavaScript 框架
- **TypeScript** - 類型安全的 JavaScript
- **Vite** - 快速的前端構建工具
- **Vue Router** - Vue.js 官方路由管理器
- **Pinia** - Vue 的狀態管理庫
- **Axios** - HTTP 客戶端

## 專案結構

```
frontend/
├── src/
│   ├── components/          # 可重用組件
│   ├── views/              # 頁面組件
│   │   ├── Login.vue       # 登入頁面
│   │   ├── Dashboard.vue   # 儀表板
│   │   ├── Conversations.vue # 對話列表
│   │   └── ConversationDetail.vue # 對話詳情
│   ├── stores/             # Pinia 狀態管理
│   │   ├── auth.ts         # 認證狀態
│   │   └── conversations.ts # 對話狀態
│   ├── services/           # API 服務
│   │   └── api.ts          # API 客戶端
│   ├── types/              # TypeScript 類型定義
│   │   └── index.ts        # 前端類型
│   ├── router/             # 路由配置
│   │   └── index.ts        # 路由定義
│   ├── App.vue             # 根組件
│   ├── main.ts             # 應用入口
│   └── style.css           # 全局樣式
├── shared/                 # 共享類型定義
│   └── types/
│       └── index.ts        # 共享類型
├── package.json            # 依賴配置
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
└── index.html              # HTML 模板
```

## 功能特性

### 已實現功能
- ✅ 用戶認證（登入/登出）
- ✅ 儀表板概覽
- ✅ 對話列表與篩選
- ✅ 對話詳情與訊息顯示
- ✅ 發送訊息
- ✅ 對話指派
- ✅ 響應式設計

### 主要頁面
1. **登入頁面** (`/login`) - 客服人員登入
2. **儀表板** (`/dashboard`) - 系統概覽與統計
3. **對話管理** (`/conversations`) - 對話列表與篩選
4. **對話詳情** (`/conversations/:id`) - 具體對話的訊息與操作

## 安裝與運行

### 前置需求
- Node.js 18+
- npm 或 yarn

### 安裝依賴
```bash
cd frontend
npm install
```

### 開發模式
```bash
npm run dev
```
應用將在 http://localhost:3000 啟動

### 構建生產版本
```bash
npm run build
```

### 預覽生產版本
```bash
npm run preview
```

## API 整合

前端通過 `/api` 路徑與後端 API 通信，Vite 開發服務器會將這些請求代理到 `http://localhost:8787`（Cloudflare Workers 開發服務器）。

### API 端點
- `POST /api/auth/login` - 用戶登入
- `GET /api/auth/me` - 獲取當前用戶信息
- `GET /api/conversations` - 獲取對話列表
- `GET /api/conversations/:id` - 獲取特定對話
- `GET /api/conversations/:id/messages` - 獲取對話訊息
- `POST /api/conversations/:id/messages` - 發送訊息
- `POST /api/conversations/:id/assign` - 指派對話

## 狀態管理

使用 Pinia 進行狀態管理：

- **authStore** - 管理用戶認證狀態
- **conversationsStore** - 管理對話和訊息狀態

## 類型安全

項目使用 TypeScript 確保類型安全，共享類型定義位於 `shared/types/` 目錄，可被前後端共同使用。

## 樣式設計

- 使用原生 CSS 變量進行主題管理
- 響應式設計支持各種設備
- 簡潔現代的 UI 設計

## 開發注意事項

1. 確保後端 API 服務正在運行
2. 檢查 API 代理配置是否正確
3. 遵循 Vue 3 Composition API 最佳實踐
4. 保持類型定義的同步更新