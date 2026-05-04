# TypeScript


 TypeScript


| | | |
|------|---------|------|
| `@modules` | `src/modules` | |
| `@shared` | `src/shared` | |
| `@infrastructure` | `src/infrastructure` | |


| | | |
|------|---------|------|
| `@auth` | `src/modules/auth` | |
| `@conversations` | `src/modules/conversations` | |
| `@teams` | `src/modules/teams` | |
| `@customer` | `src/modules/customer` | |
| `@integrations` | `src/modules/integrations` | |
| `@real-time` | `src/modules/real-time` | |
| `@messaging` | `src/modules/messaging` | |
| `@analytics` | `src/modules/analytics` | |
| `@file-management` | `src/modules/file-management` | |


```typescript
// -
import { analyticsService } from '@modules/analytics/services/analytics-core';
import { logger } from '@shared/utils/logger';
import { PermissionService } from '@shared/services/permission-service';
import { AuthHandler } from '@auth/handlers/auth';

// -
// src/modules/analytics/services/dashboard.ts
import { AnalyticsCore } from './analytics-core';
import { MetricsCollector } from './metrics-collector';
import { DashboardTypes } from '../types/dashboard-types';
```


```typescript
// -
import { analyticsService } from '../../../modules/analytics/services/analytics-core';
import { logger } from '../../../../shared/utils/logger';

// -
import { logger } from '@shared/utils/logger';
import { auth } from '../../../modules/auth/services/auth'; //
```


### 1:

```typescript
// src/modules/teams/services/team-service.ts

//
import { AuthService } from '@auth/services/auth';
import { ConversationService } from '@conversations/services/conversation-service';
import { logger } from '@shared/utils/logger';
```

### 2:

```typescript
// src/modules/analytics/services/dashboard.ts

// -
import { AnalyticsCore } from './analytics-core';

// -
import { DashboardTypes } from '../types/dashboard-types';
import { MetricsDefinitions } from '../constants/metrics-definitions';

// -
import { logger } from '@shared/utils/logger';
import { MessageService } from '@messaging/services/message-service';
```

### 3: handlers modules

```typescript
// src/handlers/analytics-main.ts

//
import { AnalyticsService } from '@analytics/services/analytics-core';
import { ReportsService } from '@modules/reports/services/reports-service';
import { logger } from '@shared/utils/logger';
```


### tsconfig.json

```json
{
 "compilerOptions": {
 "baseUrl": "./src",
 "paths": {
 "@modules/*": ["modules/*"],
 "@shared/*": ["shared/*"],
 "@analytics/*": ["modules/analytics/*"],
 // ...
 }
 }
}
```

### build.js (esbuild )

 esbuild Cloudflare Workers


```bash

bunx tsx scripts/migrate-to-path-aliases.ts src/modules/your-module --dry-run


bunx tsx scripts/migrate-to-path-aliases.ts src/modules/your-module


bunx tsx scripts/migrate-to-path-aliases.ts src/modules
```

### Pre-commit Hook

 pre-commit hook

```bash
# Hook
git commit -m "your commit message"
```


```


 (./ ../)


 (@modules, @shared )
```

## IDE

### VS Code

VS Code `tsconfig.json`

1. TypeScript
2.
3. VS Code

### WebStorm / IntelliJ IDEA

WebStorm


### Q:

**A:** VS Code IDE `tsconfig.json`

### Q:

**A:** 1-2

### Q:

**A:**


- `src/modules/analytics` (46 )
- `src/modules/reports` (3 )
- `src/modules/*` (205 )
- `src/shared/*` (8 )
- `src/handlers/*` (14 )
- `src/middleware/*` (2 )


- ****: 337
- ****: 103
- ****: 278
- ****: 44.48%


- [TypeScript - Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [esbuild ](https://esbuild.github.io/api/#resolve-extensions)
- [](../../scripts/migrate-to-path-aliases.ts)

---

****: $(date +%Y-%m-%d)
****: Development Team