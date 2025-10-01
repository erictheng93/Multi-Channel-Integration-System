# TypeScript 路徑別名使用指南

## 📖 概述

本項目使用 TypeScript 路徑別名來簡化導入語句，提升代碼可讀性和可維護性。

## 🎯 可用的路徑別名

### 主要別名

| 別名 | 實際路徑 | 用途 |
|------|---------|------|
| `@modules` | `src/modules` | 所有功能模組 |
| `@shared` | `src/shared` | 共享代碼和工具 |
| `@infrastructure` | `src/infrastructure` | 基礎設施代碼 |

### 模組別名

| 別名 | 實際路徑 | 用途 |
|------|---------|------|
| `@auth` | `src/modules/auth` | 認證模組 |
| `@conversations` | `src/modules/conversations` | 對話管理模組 |
| `@teams` | `src/modules/teams` | 團隊管理模組 |
| `@customer` | `src/modules/customer` | 客戶管理模組 |
| `@integrations` | `src/modules/integrations` | 整合模組 |
| `@real-time` | `src/modules/real-time` | 即時通訊模組 |
| `@messaging` | `src/modules/messaging` | 訊息處理模組 |
| `@analytics` | `src/modules/analytics` | 分析模組 |
| `@file-management` | `src/modules/file-management` | 文件管理模組 |

## ✅ 使用規範

### ✅ 推薦做法

```typescript
// ✅ 使用路徑別名 - 清晰明確
import { analyticsService } from '@modules/analytics/services/analytics-core';
import { logger } from '@shared/utils/logger';
import { PermissionService } from '@shared/services/permission-service';
import { AuthHandler } from '@auth/handlers/auth';

// ✅ 模組內部的相對路徑 - 簡短且明確
// 位於 src/modules/analytics/services/dashboard.ts
import { AnalyticsCore } from './analytics-core';
import { MetricsCollector } from './metrics-collector';
import { DashboardTypes } from '../types/dashboard-types';
```

### ❌ 避免的做法

```typescript
// ❌ 深層相對路徑 - 難以維護
import { analyticsService } from '../../../modules/analytics/services/analytics-core';
import { logger } from '../../../../shared/utils/logger';

// ❌ 混合使用 - 不一致
import { logger } from '@shared/utils/logger';
import { auth } from '../../../modules/auth/services/auth';  // 應該用別名
```

## 🎨 使用場景指南

### 場景 1: 跨模組導入

```typescript
// src/modules/teams/services/team-service.ts

// ✅ 使用別名導入其他模組
import { AuthService } from '@auth/services/auth';
import { ConversationService } from '@conversations/services/conversation-service';
import { logger } from '@shared/utils/logger';
```

### 場景 2: 模組內部導入

```typescript
// src/modules/analytics/services/dashboard.ts

// ✅ 同一目錄 - 使用相對路徑
import { AnalyticsCore } from './analytics-core';

// ✅ 父級或子級目錄 - 使用相對路徑
import { DashboardTypes } from '../types/dashboard-types';
import { MetricsDefinitions } from '../constants/metrics-definitions';

// ✅ 其他模組 - 使用別名
import { logger } from '@shared/utils/logger';
import { MessageService } from '@messaging/services/message-service';
```

### 場景 3: handlers 導入 modules

```typescript
// src/handlers/analytics-main.ts

// ✅ 使用別名
import { AnalyticsService } from '@analytics/services/analytics-core';
import { ReportsService } from '@modules/reports/services/reports-service';
import { logger } from '@shared/utils/logger';
```

## 🔧 配置說明

### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@modules/*": ["modules/*"],
      "@shared/*": ["shared/*"],
      "@analytics/*": ["modules/analytics/*"],
      // ... 其他別名
    }
  }
}
```

### build.js (esbuild 配置)

項目包含自定義的 esbuild 配置來支援 Cloudflare Workers 的路徑別名解析。

## 🛠️ 開發工具

### 自動遷移腳本

```bash
# 預覽模式（不修改文件）
npx tsx scripts/migrate-to-path-aliases.ts src/modules/your-module --dry-run

# 實際遷移
npx tsx scripts/migrate-to-path-aliases.ts src/modules/your-module

# 遷移整個目錄
npx tsx scripts/migrate-to-path-aliases.ts src/modules
```

### Pre-commit Hook

項目配置了 pre-commit hook 來防止提交深層相對路徑：

```bash
# Hook 會自動檢查並警告
git commit -m "your commit message"
```

## 📋 決策樹

使用以下決策樹來判斷應該使用別名還是相對路徑：

```
是否在同一模組內？
  ├─ 是 → 是否在同一目錄或父子目錄？
  │      ├─ 是 → 使用相對路徑 (./ 或 ../)
  │      └─ 否 → 考慮使用別名（如果路徑很深）
  │
  └─ 否 → 使用路徑別名 (@modules, @shared 等)
```

## ⚡ IDE 配置

### VS Code

VS Code 會自動識別 `tsconfig.json` 中的路徑別名。確保：

1. 安裝 TypeScript 擴展
2. 打開項目根目錄
3. 重新載入 VS Code 窗口（如果需要）

### WebStorm / IntelliJ IDEA

WebStorm 會自動識別路徑別名配置，無需額外設置。

## 🐛 常見問題

### Q: 路徑別名在編輯器中無法識別？

**A:** 重新載入 VS Code 窗口或重啟 IDE，確保 `tsconfig.json` 配置正確。

### Q: 什麼時候應該使用相對路徑？

**A:** 在同一模組內部且路徑不深時（1-2 層），使用相對路徑更簡潔。

### Q: 可以混合使用嗎？

**A:** 可以，但要保持一致性。推薦：模組內部用相對路徑，跨模組用別名。

## 📊 遷移狀態

### 已遷移模組

- ✅ `src/modules/analytics` (46 個導入)
- ✅ `src/modules/reports` (3 個導入)
- ✅ `src/modules/*` (205 個導入)
- ✅ `src/shared/*` (8 個導入)
- ✅ `src/handlers/*` (14 個導入)
- ✅ `src/middleware/*` (2 個導入)

### 總計

- **總文件數**: 337
- **修改文件數**: 103
- **已轉換導入**: 278
- **轉換率**: 44.48%

## 🔗 相關資源

- [TypeScript 官方文檔 - Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [esbuild 路徑解析](https://esbuild.github.io/api/#resolve-extensions)
- [項目遷移腳本](../../scripts/migrate-to-path-aliases.ts)

---

**最後更新**: $(date +%Y-%m-%d)
**維護者**: Development Team