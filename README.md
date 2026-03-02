# (Multi-Channel Customer Support System)

 Cloudflare Workers Vue 3 **Drizzle ORM****Cloudflare KV** **API **

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/Vue-3.5-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-green.svg)
![Cloudflare KV](https://img.shields.io/badge/Cloudflare-KV-blue.svg)
![Test Coverage](https://img.shields.io/badge/Test%20Coverage-100%25-brightgreen.svg)
![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)
![Production Ready](https://img.shields.io/badge/Production-Ready-success.svg)


- **** `.\scripts\developer-deploy.ps1`
- **** (README.md) -
- **API ** [ API ](docs/api/) - API
- ****


- **** `.\scripts\user-deploy.ps1`
- **** [ ](docs/USER_GUIDE.md) -
- **** [ ](docs/QUICK_START.md) - 5
- ****


- [ ](#-)
- [](#)
- [](#)
- [](#)
- [](#)
- [](#)
- [](#)
- [](#)
- [API ](#api-)
- [](#)
- [](#)
- [](#)
- [](#)


### WebSocket + Durable Objects (v4.0.0)
- **** - SSE + WebSocket + Durable Objects
- **** - 1000+
- **** - Cloudflare Durable Objects
- **** - 30
- **** - 1000+
- **** -
- ** UI ** -

### API (v3.0.0)
- **** - API
- **** - API
- **** -
- **** -
- **** - PowerShell + Terraform

### (v3.0.0)
- **** - +
- **** -
- **** -
- **** -

### Dashboard (v2.1.0)
- **** -
- **TypeScript 0 ** -
- **100% ** - 132
- ** UI/UX** -

### (WebSocket + Durable Objects)
- ** **: WebSocket + Durable Objects
- ** **: P95 < 500ms 1000+
- ** **: Durable Objects
- ** **: Durable Objects
- ** **:
- ** **: 30
- ** **:
- ** **:


### WebSocket (NEW! v4.0.0)
- ** ** -
- ** ** -
- ** ** - //
- ** ** -
- ** ** - ///
- ** ** - SSE WebSocket
- ** ** - JWT + WebSocket
- ** ** - Durable Objects

### API
- ** ** - 15API
- ** ** - API
- ** ** -
- ** ** -
- ** ** -
- ** ** -

### (New!)
- ** ** - (`developer-deploy.ps1`)
 - /
 -
 - 30
- ** ** - (`user-deploy.ps1`)
 - Terraform
 -
 -


- **** - LINE OA Facebook Messenger
- **** -
- **** - 2 (Admin/Agent)
- **** -
- **** - JWT 2 RBAC
- **** -

### (Production Ready)
- **WebSocket + Durable Objects ** - 1000+
- **LINE OA ** - Webhook + WebSocket
- **** - JWT 2 + WebSocket
- **** - +
- **** - + WebSocket
- **** - +
- **** -
- **** - Cloudflare R2
- **** - WebSocket
- **** - + WebSocket
- **** - + WebSocket
- ** Dashboard** - Vue 3 + TypeScript UI/UX +
- **API ** -
- **** - + WebSocket
- **** - 30 SSE

### (Latest Features - v4.0.0)
- **WebSocket ** - SSE
- **Durable Objects ** -
- **** -
- **** - //
- **** - 30
- **** - 1000+
- **** - 1-120 + WebSocket
- **** - + WebSocket
- **API ** - 15
- **** - PowerShell + Terraform + WebSocket


```

 Vue 3 Cloudflare API
 (TypeScript) Workers (LINE/FB)


 Cloudflare


 D1 KV R2
 (SQLite ) (/) (/)


 Queues AI
 () (Chat ) (API Monitor)

```


#### (Cloudflare Workers)
- ** **: Hono.js ()
- ** **: Cloudflare D1 (SQLite) + Drizzle ORM
- ** **: Cloudflare KV ()
- ** **: Cloudflare R2 (S3 )
- ** **: Cloudflare Queues ()
- ** **: JWT + 2
- ** **: API

#### (Vue 3 Application)
- ** **: Vue 3 + Composition API + TypeScript
- ** **: Pinia +
- ** UI/UX**: +
- ** **: Vitest + 100%
- ** **: Vite +
- ** **:


- Node.js 16+ ??npm
- Wrangler CLI (Cloudflare ?¨ç½²å·¥å…·)
- Cloudflare API Token
- LINE Developer å¸³è?(å¦‚é? LINE OA ?´å?)

## ?°å??ç½®ç³»çµ± (Environment Configuration)

?¬ç³»çµ±æ¡??**3 å±¤æ¶æ§‹æ¨¡å¼?* ?²è??°å??ç½®ç®¡ç?ï¼Œå¯¦?¾ç????‹ç™¼?°å??„ç„¡ç¸«å??›ï?

### ?ç½®?¶æ?å±¤ç?
```
ç¬?1 å±¤ï??°å?è®Šæ•¸ (.env æª”æ?)
    ??
ç¬?2 å±¤ï??‹è??‚é?ç½®å±¤ (runtime.ts)
    ??
ç¬?3 å±¤ï?æ¥­å??è¼¯ç¨‹å?ç¢?
```

### ?ç«¯?°å?è®Šæ•¸
?ç½®æª”æ?ä½ç½®ï¼š`frontend/`
- `.env.development` - ?‹ç™¼?°å??ç½®
- `.env.production` - ?Ÿç”¢?°å??ç½®
- `.env.example` - ?°å?è®Šæ•¸ç¯„æœ¬ï¼ˆå«å®Œæ•´èªªæ?ï¼?

**?¸å??°å?è®Šæ•¸ï¼?*
```bash
VITE_BACKEND_URL=https://your-api-domain.example.com
VITE_FRONTEND_URL=http://localhost:3000
VITE_WEBSOCKET_URL=wss://your-api-domain.example.com/ws
VITE_STORAGE_PUBLIC_URL=https://your-storage-domain.example.com
VITE_ENV=development
VITE_DEBUG=true
```

### å¾Œç«¯?°å?è®Šæ•¸
?ç½®æª”æ?ï¼š`.dev.vars`ï¼ˆé??¼ç’°å¢ƒï?
```bash
BACKEND_URL=http://localhost:8787
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
ENVIRONMENT=development
```

### ?‹è??‚é?ç½®å‡½??
ç³»çµ±?ä?çµ±ä??„é?ç½®å??–ä??¢ï?

**?ç«¯ (`frontend/src/config/runtime.ts`):**
```typescript
import { getBackendUrl, getWebSocketUrl, getApiEndpoint } from '@/config/runtime';

// ?²å?å¾Œç«¯ API URL
const apiUrl = getBackendUrl();

// ?²å? WebSocket URLï¼ˆè‡ª?•å?è­°è??›ï?
const wsUrl = getWebSocketUrl();

// ?²å?å®Œæ•´ API ç«¯é?
const endpoint = getApiEndpoint('/api/messages');
```

**å¾Œç«¯ (`src/config/runtime.ts`):**
```typescript
import { getBackendUrl, getFrontendUrl } from './config/runtime';

// ??Handler ä¸­ä½¿??
export default {
  async fetch(request: Request, env: WorkerEnv) {
    const backendUrl = getBackendUrl(env);
    const frontendUrl = getFrontendUrl(env);
  }
}
```

### ?°å??‡æ??‡å?
**?‡æ??°é??¼ç’°å¢ƒï?**
1. è¤‡è£½ `frontend/.env.development` ??`frontend/.env`
2. ä¿®æ”¹ URL ?ºæœ¬?°åœ°?€
3. ?·è? `npm run dev`

**?‡æ??°ç??¢ç’°å¢ƒï?**
1. è¤‡è£½ `frontend/.env.production` ??`frontend/.env`
2. ?·è? `npm run build && npm run deploy`

### ?ªå‹¢
??**å¿«é€Ÿå???* - 5-10 ?†é?å®Œæ??°å??‡æ?ï¼ˆç›¸è¼ƒå‚³çµ?4-6 å°æ?ï¼?
??**?‹åˆ¥å®‰å…¨** - å®Œæ•´??TypeScript é¡å?å®šç¾©
??**?¶ç¡¬ç·¨ç¢¼** - ?€??URL çµ±ä?ç®¡ç?
??**?ªå?é©—è?** - ?‹è??‚é?ç½®é?è­‰è??¯èª¤?•ç?

---

## ?ç½®?€æ±?

### 1. (5)
```bash
# 1.
git clone <repository-url>
cd Multi_Channel_Integration_System

# 2. (Windows)
.\setup-env.ps1

# 3. Cloudflare
wrangler login
```

### 2. ?‹ç™¼?°å??¸æ?ï¼šnpm ??Bun

?¬å?æ¡ˆæ”¯?´å…©ç¨®é??¼ç’°å¢ƒï?**npm** (ç©©å?) ??**Bun** (å¿«é€??‚ä??¯ä»¥?¹æ??€æ±‚è‡ª?±é¸?‡æ??‡æ???

#### ?? Bun ?ªå‹¢
- **3x ?´å¿«?„ä?è³´å?è£é€Ÿåº¦** (10 ?†é? ??3 ?†é?)
- **2x ?´å¿«?„æ¸¬è©¦åŸ·è¡Œé€Ÿåº¦** (20 ç§???10 ç§?
- **?§å»º TypeScript ?¯æ?** (?¡é?é¡å?ç·¨è­¯??
- **50% ?´å¿«?„è…³?¬å??•æ???*

#### ?? ?°å?å°ç…§è¡?

| ?Ÿèƒ½ | npm ?½ä»¤ | Bun ?½ä»¤ |
|------|----------|----------|
| **å®‰è?ä¾è³´** | `npm install` | `bun install` |
| **å¾Œç«¯?‹ç™¼** | `npm run dev` | `bun run dev` |
| **?ç«¯?‹ç™¼** | `cd frontend && npm run dev` | `cd frontend && bun run bun:dev` |
| **?·è?æ¸¬è©¦** | `npm test` | `bun test` |
| **TypeScript ç·¨è­¯** | `npm run build` | `bun run build` |

#### ?? å®‰è? Bun (?¯é¸)

**Windows:**
```powershell
powershell -c "irm bun.sh/install.ps1|iex"
bun --version  # é©—è?å®‰è?
```

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
bun --version  # é©—è?å®‰è?
```

#### ?? ?°å??‡æ?

**?‡æ???Bun ?‹ç™¼?°å?ï¼?*
```powershell
.\scripts\switch-to-bun.ps1
```

**?‡æ???npm ?‹ç™¼?°å?ï¼?*
```powershell
.\scripts\switch-to-npm.ps1
```

#### ? ï? ?è?èªªæ?
- **CI/CD ?°å?ä¿æ?ä½¿ç”¨ npm** - ç¢ºä??Ÿç”¢?°å?ç©©å???
- **?©ç¨®?°å??¯ä»¥?±å?** - ?˜é??å“¡?¯è‡ª?±é¸??
- **å¿«é€Ÿå?æ»?* - ?‡åˆ°?é??¯åœ¨ 3 ?†é??§å???npm
- **?Ÿç”¢?¨ç½²ä¸å?å½±éŸ¿** - ?€?‰éƒ¨ç½²ä?ä½¿ç”¨ npm + Wrangler

#### ?? ä½¿ç”¨å»ºè­°

**?¨è–¦ä½¿ç”¨ Bun ?„æ?æ³ï?**
- ???¬åœ°?‹ç™¼?Œæ¸¬è©¦ï??Ÿåº¦?ªå‹¢?é¡¯ï¼?
- ???»ç?å®‰è?ä¾è³´ï¼ˆç??å¤§?æ??“ï?
- ???·è? TypeScript ?³æœ¬ï¼ˆå…§å»ºæ”¯?ï?

**å»ºè­°ä¿æ? npm ?„æ?æ³ï?**
- ??CI/CD æµç?ï¼ˆç??¢ç©©å®šæ€§ï?
- ???€è¦å??¨ç›¸å®¹æ€§ï??ä?å·¥å…·?¯èƒ½å°šæœª?¯æ? Bunï¼?
- ???˜é??”ä?è¦ç?è¦æ?ä½¿ç”¨ npm

### 3. ?¨ç½²?¹å?

#### ?‹ç™¼?…éƒ¨ç½?()
```bash
# ?‹ç™¼?…å¿«?Ÿéƒ¨ç½?(2 æ­¥é?)
.\scripts\developer-deploy.ps1


.\scripts\developer-deploy.ps1 -BackendOnly


.\scripts\developer-deploy.ps1 -FrontendOnly


.\scripts\developer-deploy.ps1 -SkipBuild -Force
```

#### ()
```bash

$env:CLOUDFLARE_API_TOKEN = "your-api-token"
$env:TF_VAR_line_channel_access_token = "your-line-token"
$env:TF_VAR_line_channel_secret = "your-line-secret"
$env:TF_VAR_admin_email = "admin@example.com"
$env:TF_VAR_admin_password = "secure-password"


.\scripts\user-deploy.ps1 -PlanOnly


.\scripts\user-deploy.ps1 -AutoApprove
```

### 3.
- ** API**: https://your-api-domain.example.com
- ****: https://mcis-ey7.pages.dev
- **API **: API


### (`developer-deploy.ps1`)
****:

****:
- (30-2)
- (/)
- ( Wrangler CLI)
- Terraform

****:
```bash

.\scripts\developer-deploy.ps1 -Help


.\scripts\developer-deploy.ps1

# ()
.\scripts\developer-deploy.ps1 -SkipBuild -Force
```

### (`user-deploy.ps1`)
****:

****:
- (Terraform IaC)
- (development/production)
- ()
- ()

****:
```bash

.\scripts\user-deploy.ps1 -Help


.\scripts\user-deploy.ps1 -PlanOnly


.\scripts\user-deploy.ps1 -AutoApprove
```


| | | |
|------|-----------|----------|
| **** | 30-2 | 5-10 |
| **** | (PowerShell) | (Terraform) |
| **** | | |
| **** | | |
| **** | | |
| **** | | |


### API
API


- ** ** - 15API
- ** ** -
- ** ** -
- ** ** - API


- **** - < 1 200-299
- **** - > 1 (401)
- **** - 5xx
- **** - API


1.
2. API
3.
4.
5. API


- ****: Cloudflare Workers
- ****: Worker
- ****:
- ****: `/api/system/health`


### : v4.0.0 (Enterprise-Ready WebSocket System)

#### (100% Ready)
- ** WebSocket + Durable Objects ** - 1000+
- ** ** - P95 < 500ms
- ** ** - Durable Objects
- ** ** - Durable Objects
- ** ** -
- ** ** - 30
- ** ** - WebSocket
- ** ** -
- **** - LINE OA + WebSocket Facebook Messenger
- **** - Admin/Agent 2RBAC + WebSocket
- **** -
- **** - 1-120 + WebSocket
- **** - Vue 3 + TypeScript + WebSocket 100%
- **API ** -
- **** - + WebSocket


- **AI ** - Chat ()
- **** - ()
- **** - ()


- ****: 132100%
- **TypeScript**: 0
- **ESLint**:
- ****:

### (WebSocket System)
- **WebSocket **: <100ms
- ****: <500ms (P95)<200ms (P50)
- ****: 1000+
- ****: 100+ /
- **Worker **: <15ms
- **API **: <200ms (P95)
- ****: <3s ()<1s ()
- **WebSocket **: <3s ()
- ****: <60s ( WebSocket )


```
Multi_Channel_Integration_System/
 src/ # (Cloudflare Workers)
 handlers/ # API
 auth-main.ts # API
 conversation-main.ts # API
 team-main.ts # API
 system-main.ts # API
 customer-main.ts # API
 db/ #
 schema.ts # Drizzle ORM
 services/ #
 utils/ #
 types/ # TypeScript
 index.ts # Worker
 frontend/ # (Vue 3)
 src/
 components/ # Vue
 views/ #
 ApiMonitor.vue # API
 TeamManagement.vue #
 Dashboard.vue #
 stores/ # Pinia
 api/ # API
 main.ts #
 tests/ # (132)
 package.json #
 scripts/ #
 developer-deploy.ps1 #
 user-deploy.ps1 #
 deploy-production.ps1 #
 terraform/ #
 main.tf # Terraform
 variables.tf #
 outputs.tf #
 docs/ #
 API_MONITOR_FINAL_UPDATES.md # API
 USER_GUIDE.md #
 QUICK_START.md #
 wrangler.toml # Cloudflare Workers
 package.json #
 README.md # ()
```

## API

### API
- `GET /api/system/health` -
- `GET /api/system/api-status` - API ()
- `POST /api/auth/login` -
- `GET /api/conversations` -
- `GET /api/team/members` -
- `POST /api/messages/delayed` -

### API
API
- **** - 15API
- **** - //
- **** -
- **** -


- **JWT Token** - APIJWT
- **2** - Admin() > Agent()
- **** -


** (Cloudflare Workers)**:
```bash
ENVIRONMENT=production
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

** (Cloudflare Pages)**:
```bash
VITE_API_BASE_URL=https://your-api-domain.example.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
```


- **D1 ** -
- **KV ** -
- **R2 ** -

### LINE OA
1. LINE Developers Console Messaging API
2. Webhook URL: `https://your-domain.com/api/webhooks/line`
3. Channel Access Token Channel Secret
4.


**Q: **
A:
- : `developer-deploy.ps1`
- : `user-deploy.ps1`
- : `developer-deploy.ps1`

**Q: **
A:
1. Cloudflare : `wrangler whoami`
2.
3.
4. API

**Q: **
A:
```bash
# ()
.\scripts\developer-deploy.ps1 -Force


.\scripts\developer-deploy.ps1 -BackendOnly


.\scripts\developer-deploy.ps1 -FrontendOnly
```


**Q: API **
A:
1.
2.
3. API
4. : `/api/system/health`

**Q: **
A:
1. Admin
2.
3.
4.


**Q: **
A:
```bash
cd frontend
npm run test #
npm run type-check #
npm run lint #
```

**Q: **
A:
1. Cloudflare Dashboard Workers & Pages Worker
2. Logs
3. API


MIT License - [LICENSE](LICENSE)

---

## ?‡æ?å°èˆª

### ?¸å??‡æ?
- [?‡æ?ç¸½ç´¢å¼•](docs/DOCUMENTATION_INDEX.md) - å®Œæ•´?„æ?æª”æ¶æ§‹å???
- [Claude ?‹ç™¼?‡å?](CLAUDE.md) - Claude Code å°ˆç”¨?‹ç™¼?‡å?
- [ä½¿ç”¨?…æ??—](docs/USER_GUIDE.md) - å®Œæ•´ä½¿ç”¨?…æ?ä½œæ???
- [å¿«é€Ÿé?å§‹](docs/guides/QUICK_START.md) - 5 ?†é?å¿«é€Ÿä???

### ç³»çµ±?¶æ?
- [WebSocket ?€çµ‚æ¶æ§‹](docs/architecture/WEBSOCKET_FINAL_ARCHITECTURE.md) - WebSocket ç³»çµ±?¶æ?è¨­è?
- [è·¯ç”±è¨»å??†å?](docs/architecture/ROUTE_REGISTRATION_ORDER.md) - ?œéµè·¯ç”±?ç½®?‡å?
- [æ¨¡ç?ä¾è³´?œä?](docs/architecture/MODULE_DEPENDENCY_DIAGRAM.md) - ç³»çµ±æ¨¡ç?ä¾è³´??

### API ?ƒè€?
- [API ç«¯é?ç¸½è¦½](docs/api/api-endpoints.md) - ?€??API ç«¯é??‡æ?
- [è¨Šæ¯ API](docs/api/MESSAGING_API_REFERENCE.md) - å®Œæ•´è¨Šæ¯ç³»çµ± API
- [æ¨¡ç???API](docs/api/MODULAR_API_REFERENCE.md) - æ¨¡ç??–æ¶æ§?API

### ?¨ç½²?‡é?ç¶?
- [?¨ç½²?‡å?](docs/guides/DEPLOYMENT_GUIDE.md) - å®Œæ•´?¨ç½²æµç?
- [Cloudflare Pages ?¨ç½²](docs/guides/CLOUDFLARE_PAGES_DEPLOYMENT.md) - ?ç«¯?¨ç½²?‡å?
- [WebSocket ?·ç§»?±å?](docs/deployment/WEBSOCKET_MIGRATION_COMPLETE.md) - WebSocket ç³»çµ±ä¸Šç??±å?

### æ¸¬è©¦?‡å„ª??
- [æ¸¬è©¦?‡å?](docs/testing/testing-guide.md) - å®Œæ•´æ¸¬è©¦ç­–ç•¥
- [?ˆèƒ½?ªå??‡å?](docs/PERFORMANCE_OPTIMIZATION_GUIDE.md) - ç³»çµ±?ˆèƒ½?ªå??¹æ?
- [è² è?æ¸¬è©¦](docs/performance/LOAD_TESTING_GUIDE.md) - è² è?æ¸¬è©¦?¹æ?

**?Ÿè?ä½¿ç”¨?¬ç³»çµ±ï?å¦‚æ?è¦ºå??‰å¹«?©ï?è«‹çµ¦??Star**