# Technology Stack / 技術棧

## Backend (Cloudflare Worker) / 後端 (Cloudflare Worker)

- **Runtime / 執行環境**: Cloudflare Workers
- **Framework / 框架**: Hono (lightweight web framework / 輕量級 Web 框架)
- **Database / 資料庫**: Cloudflare D1 (SQLite)
- **Language / 程式語言**: TypeScript
- **Authentication / 認證**: JWT with bcryptjs for password hashing / JWT 搭配 bcryptjs 進行密碼雜湊

### Key Dependencies / 主要依賴
- `hono`: Web framework for Cloudflare Workers / Cloudflare Workers 的 Web 框架
- `bcryptjs`: Password hashing / 密碼雜湊
- `jsonwebtoken`: JWT token management / JWT 令牌管理
- `uuid`: UUID generation for message IDs / 訊息 ID 的 UUID 生成

## Frontend / 前端

- **Framework / 框架**: Vue 3 (Composition API / 組合式 API)
- **State Management / 狀態管理**: Pinia
- **Router / 路由**: Vue Router 4
- **Build Tool / 建置工具**: Vite
- **Language / 程式語言**: TypeScript
- **Styling / 樣式**: Native CSS (no framework dependencies / 無框架依賴)

## Database Schema / 資料庫結構

Uses Cloudflare D1 with the following main tables: / 使用 Cloudflare D1，主要資料表如下：
- `users`: Platform users (LINE/Facebook users) / 平台用戶（LINE/Facebook 用戶）
- `conversations`: Chat conversations / 聊天對話
- `messages`: Individual messages / 個別訊息
- `agents`: Customer service agents / 客服人員
- `customers`: Legacy customer data (being migrated to users) / 舊版客戶資料（正在遷移至 users）

## Common Commands / 常用指令

### Development / 開發
```bash
# Start backend development server / 啟動後端開發伺服器
npm run dev

# Start frontend development server (in frontend/) / 啟動前端開發伺服器（在 frontend/ 目錄）
cd frontend && npm run dev

# Type checking / 型別檢查
npm run build
```

### Database Management / 資料庫管理
```bash
# Local database migration / 本地資料庫遷移
npm run db:migrate

# Production database migration / 生產環境資料庫遷移
npm run db:migrate:prod

# Seed database with test data / 填入測試資料
npm run db:seed
```

### Deployment / 部署
```bash
# Deploy to Cloudflare Workers / 部署到 Cloudflare Workers
npm run deploy

# Generate Cloudflare types / 生成 Cloudflare 型別
npm run cf-typegen
```

### Testing / 測試
```bash
# Run tests (in tests/) / 執行測試（在 tests/ 目錄）
cd tests && npm test

# Run specific test files / 執行特定測試檔案
node tests/test-line-connection.ts
```

## Configuration Files / 設定檔案

- `wrangler.toml`: Cloudflare Worker configuration / Cloudflare Worker 設定
- `tsconfig.json`: TypeScript configuration / TypeScript 設定
- `package.json`: Dependencies and scripts / 依賴和腳本
- `.env` files: Environment variables (not committed) / 環境變數（不提交到版本控制）