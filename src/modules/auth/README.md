# Auth Module (認證模組)

> **Version:** 1.2.0
> **Status:** ✅ Production Ready
> **TypeScript Path:** `@auth/*`

## 📋 模組簡介

完整的 JWT 認證與授權系統，支援企業級三角色權限控制（Admin、Team Leader、Agent），提供安全的用戶身份驗證、會話管理和權限驗證功能。

## 🚀 核心功能

- ✅ **JWT 認證** - 基於 Token 的無狀態認證機制
- ✅ **三角色系統** - Admin / Team Leader / Agent 權限分級
- ✅ **會話管理** - Cloudflare KV 快取會話持久化
- ✅ **密碼安全** - bcrypt 加密存儲
- ✅ **Token 刷新** - 自動 Token 續期機制
- ✅ **權限驗證中間件** - 路由級別權限控制

## 📡 API 端點

### 認證端點

```
POST   /api/auth/login              # 用戶登入
POST   /api/auth/register           # 用戶註冊
POST   /api/auth/logout             # 登出
POST   /api/auth/refresh            # 刷新 Token
GET    /api/auth/me                 # 獲取當前用戶資訊
POST   /api/auth/verify-token       # 驗證 Token 有效性
GET    /api/auth/health             # 健康檢查
```

## 🔐 權限系統

### 角色權限矩陣

| 功能 | Admin | Team Leader | Agent |
|------|-------|-------------|-------|
| 系統管理 | ✅ | ❌ | ❌ |
| 團隊管理 | ✅ | ✅ | ❌ |
| 對話處理 | ✅ | ✅ | ✅ |
| 查看報表 | ✅ | ✅ (團隊) | ✅ (個人) |

## 💻 使用範例

### 登入驗證

```typescript
import { authHandler } from '@auth/handlers';

// 用戶登入
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin@example.com',
    password: 'secure_password'
  })
});

const { token, user } = await response.json();
```

### 使用中間件保護路由

```typescript
import { jwtAuth } from '@auth/middleware';
import { Hono } from 'hono';

const app = new Hono();

// 所有 /api/admin/* 路由需要認證
app.use('/api/admin/*', jwtAuth);

// 獲取受保護的資源
app.get('/api/admin/users', async (c) => {
  const user = c.get('user'); // 從中間件注入的用戶資訊
  return c.json({ user });
});
```

### 權限檢查

```typescript
import { requireRole } from '@auth/middleware';

// 只允許 Admin 訪問
app.get('/api/system/settings', requireRole('admin'), async (c) => {
  // 處理邏輯
});

// 允許 Admin 和 Team Leader
app.get('/api/team/members', requireRole(['admin', 'team']), async (c) => {
  // 處理邏輯
});
```

## 🗂️ 模組結構

```
src/modules/auth/
├── handlers/
│   ├── auth-main.ts         # 主要認證處理器
│   └── index.ts             # Handler 導出
├── middleware/
│   ├── auth.ts              # JWT 認證中間件
│   └── index.ts             # Middleware 導出
├── services/
│   ├── auth-service.ts      # 認證服務邏輯
│   └── index.ts             # Service 導出
├── types/
│   ├── auth-types.ts        # 認證相關類型定義
│   └── index.ts             # Type 導出
├── utils/
│   ├── jwt.ts               # JWT 工具函數
│   ├── password.ts          # 密碼處理工具
│   └── index.ts             # Util 導出
└── index.ts                 # 模組主導出
```

## 📦 依賴關係

### 內部依賴
- `@shared/database` - 數據庫操作
- `@shared/utils` - 共享工具函數

### 外部依賴
- `hono` - Web 框架
- `jose` - JWT 處理
- `bcrypt` - 密碼加密
- `drizzle-orm` - ORM

## 🔧 配置選項

```typescript
interface AuthConfig {
  jwt: {
    secret: string;           // JWT 密鑰
    expiresIn: string;        // Token 過期時間 (預設: '24h')
    refreshExpiresIn: string; // Refresh Token 過期時間 (預設: '7d')
  };
  session: {
    kvNamespace: string;      // KV 命名空間
    sessionTTL: number;       // 會話 TTL (秒)
  };
  security: {
    bcryptRounds: number;     // bcrypt 加密輪數 (預設: 12)
    maxLoginAttempts: number; // 最大登入嘗試次數
    lockoutDuration: number;  // 鎖定時間 (秒)
  };
}
```

## 🧪 測試

```bash
# 運行認證模組測試
npm run test -- src/modules/auth

# 運行整合測試
npm run test:integration -- auth
```

## 🔒 安全考量

1. **密碼儲存** - 使用 bcrypt 單向加密，不可逆
2. **Token 安全** - JWT 使用 HS256 簽名，密鑰存儲在環境變數
3. **會話管理** - KV 存儲提供自動過期機制
4. **防暴力破解** - 登入失敗次數限制和帳號鎖定
5. **HTTPS Only** - 生產環境強制 HTTPS 傳輸

## 📊 性能指標

- **登入響應時間**: < 200ms (P95)
- **Token 驗證**: < 50ms (P95)
- **會話查詢 (KV)**: < 10ms (P95)
- **併發支援**: 1000+ req/s

## 🐛 常見問題

### Q: Token 過期後如何處理？

A: 前端應攔截 401 錯誤，自動調用 `/api/auth/refresh` 刷新 Token。

### Q: 如何實現「記住我」功能？

A: 使用更長的 Refresh Token 過期時間（如 30 天），並在 localStorage 持久化。

### Q: 多設備登入如何處理？

A: 每次登入生成新 Token，KV 存儲支援同一用戶多個活躍會話。

## 📝 更新日誌

### v1.2.0 (2025-09-30)
- ✨ 新增 TypeScript 路徑別名 `@auth/*`
- 🐛 修復 Token 刷新邏輯的時序問題
- 📝 完善 API 文檔和類型定義

### v1.1.0
- ✨ 支援三角色權限系統
- 🔐 增強密碼安全策略

### v1.0.0
- 🎉 初始版本發布

## 🤝 貢獻指南

請參考項目根目錄的 [CONTRIBUTING.md](../../../CONTRIBUTING.md)

## 📄 授權

MIT License - 請參考 [LICENSE](../../../LICENSE)

---

**維護團隊**: Multi-Channel Integration System Team
**最後更新**: 2025-09-30