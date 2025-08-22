# Project Structure / 專案結構

## Root Directory Layout / 根目錄結構

```
├── src/                    # Backend Worker source code / 後端 Worker 原始碼
├── frontend/               # Vue.js frontend application / Vue.js 前端應用
├── shared/                 # Shared types between frontend/backend / 前後端共用型別
├── database/               # Database schema and migration files / 資料庫結構和遷移檔案
├── tests/                  # Test files and utilities / 測試檔案和工具
├── docs/                   # Documentation and guides / 文件和指南
├── .kiro/                  # Kiro configuration and steering / Kiro 設定和引導
└── config files            # Various configuration files / 各種設定檔案
```

## Backend Structure (`src/`) / 後端結構 (`src/`)

```
src/
├── handlers/               # Request handlers (modular API endpoints) / 請求處理器（模組化 API 端點）
│   ├── webhook.ts         # Webhook processing (LINE/Facebook) / Webhook 處理（LINE/Facebook）
│   ├── auth.ts            # Authentication endpoints / 認證端點
│   ├── conversation.ts    # Conversation management / 對話管理
│   └── message.ts         # Message handling / 訊息處理
├── types/                 # TypeScript type definitions / TypeScript 型別定義
│   ├── shared.ts          # Modern shared types / 現代化共用型別
│   ├── converters.ts      # Type conversion utilities / 型別轉換工具
│   └── index.ts           # Legacy database types / 舊版資料庫型別
├── utils/                 # Utility functions / 工具函數
├── services/              # Business logic services / 業務邏輯服務
├── middleware/            # Authentication and other middleware / 認證和其他中間件
├── integrations/          # Platform adapters (LINE, Facebook) / 平台適配器（LINE、Facebook）
├── durable-objects/       # Cloudflare Durable Objects / Cloudflare 持久物件
├── index.ts               # Main system entry point / 主要系統入口點
└── index-simple.ts        # Simplified version / 簡化版本
```

## Frontend Structure (`frontend/src/`) / 前端結構 (`frontend/src/`)

```
frontend/src/
├── views/                 # Page components / 頁面元件
├── components/            # Reusable Vue components / 可重用的 Vue 元件
├── stores/                # Pinia state management / Pinia 狀態管理
├── api/                   # API client functions / API 客戶端函數
├── types/                 # Frontend-specific types / 前端專用型別
├── router/                # Vue Router configuration / Vue Router 設定
└── main.ts                # Application entry point / 應用程式入口點
```

## Key Architecture Patterns / 關鍵架構模式

### Entry Points / 入口點
- `src/index.ts`: Main system entry point with full features / 具完整功能的主要系統入口點
- `src/index-simple.ts`: Simplified version for basic use cases / 基本用例的簡化版本

### Handler Pattern / 處理器模式
All API endpoints are organized into handler modules: / 所有 API 端點都組織成處理器模組：
- Each handler exports functions for specific routes / 每個處理器為特定路由匯出函數
- Handlers use dependency injection pattern with Cloudflare bindings / 處理器使用依賴注入模式搭配 Cloudflare 綁定
- Consistent error handling and response formatting / 一致的錯誤處理和回應格式

### Type System / 型別系統
- **Legacy types** (`src/types/index.ts`): Database-focused types / **舊版型別**：以資料庫為中心的型別
- **Modern types** (`src/types/shared.ts`): Clean, frontend-friendly types / **現代型別**：乾淨、前端友好的型別
- **Converters** (`src/types/converters.ts`): Transform between type systems / **轉換器**：在型別系統間轉換

### Database Organization / 資料庫組織
- `database/schema.sql`: Main database schema / 主要資料庫結構
- `database/init.sql`: Initial setup queries / 初始設定查詢
- `database/init-database.ps1`: Database initialization script / 資料庫初始化腳本
- `database/verify-schema.js`: Schema validation / 結構驗證

### Testing Structure / 測試結構
- `tests/unit/`: Unit tests / 單元測試
- `tests/helpers/`: Test utilities / 測試工具
- Individual test files for specific features / 特定功能的個別測試檔案
- PowerShell scripts for integration testing / 整合測試的 PowerShell 腳本

## Configuration Files / 設定檔案

- `wrangler.toml`: Cloudflare Worker deployment configuration / Cloudflare Worker 部署設定
- `tsconfig.json`: TypeScript compiler settings / TypeScript 編譯器設定
- `package.json`: Dependencies and npm scripts / 依賴和 npm 腳本
- Frontend has its own `package.json` and `vite.config.ts` / 前端有自己的 `package.json` 和 `vite.config.ts`

## Naming Conventions / 命名慣例

- **Files / 檔案**: kebab-case for most files, PascalCase for components / 大部分檔案使用 kebab-case，元件使用 PascalCase
- **Directories / 目錄**: lowercase with hyphens / 小寫加連字符
- **Types / 型別**: PascalCase for interfaces and types / 介面和型別使用 PascalCase
- **Functions / 函數**: camelCase
- **Constants / 常數**: UPPER_SNAKE_CASE
- **Database / 資料庫**: snake_case for table and column names / 資料表和欄位名稱使用 snake_case

## Import Patterns / 匯入模式

```typescript
// Relative imports for local modules / 本地模組的相對匯入
import { webhookHandler } from './handlers/webhook';

// Type imports / 型別匯入
import type { Bindings, User, Conversation } from './types';

// Shared types / 共用型別
import type { SharedUser } from '@/types/shared';
```