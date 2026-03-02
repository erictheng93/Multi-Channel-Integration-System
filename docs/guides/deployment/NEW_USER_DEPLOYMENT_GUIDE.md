
 Multi-Channel Customer Support System v3.0


- ****: LINE OAFacebook Messenger
- ****: AdminTeamAgent
- ****: WebSocket
- **API **: API
- ****: 1-120
- **QR Code**:
- ****: /


- ****: Cloudflare Workers + Hono.js + Drizzle ORM
- ****: Vue 3 + TypeScript + Vite
- ****: Cloudflare D1 (SQLite)
- ****: Cloudflare R2 + KV + Queues
- ****: Terraform (IaC) + PowerShell

---


### 1.1

#### **Node.js npm**
```bash
# Node.js LTS
# : https://nodejs.org
# : 18.x 20.x npm


node --version # v18.x.x v20.x.x
npm --version # 9.x.x
```

#### **Terraform**
```bash
# Windows - 1: Chocolatey
choco install terraform

# Windows - 2:
# 1. https://terraform.io/downloads
# 2.
# 3. PATH


terraform --version # v1.0.0
```

#### **Wrangler CLI**
```bash
# Wrangler
npm install -g wrangler


wrangler --version # 3.x.x
```

### 1.2
```bash

echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Terraform: $(terraform --version)"
echo "Wrangler: $(wrangler --version)"
```

---


### 2.1 Cloudflare

#### ** Cloudflare **
1. [https://cloudflare.com](https://cloudflare.com)
2. "Sign Up"
3.
4. Cloudflare Dashboard

#### ** API Token**
1. Cloudflare Dashboard
2. "My Profile"
3. "API Tokens"
4. "Create Token"
5. "Custom token"
6. Token
 ```
 Permissions:
 - Account: Cloudflare Workers:Edit
 - Account: Account Settings:Read
 - Zone: Zone:Read
 - Zone: DNS:Edit

 Account Resources:
 - Include: Your Account

 Zone Resources:
 - Include: All zones ()
 ```
7. "Continue to summary"
8. "Create Token"
9. ****: Token

#### ** Wrangler**
```bash
# Cloudflare API Token
wrangler login

# Token
wrangler auth login --api-token YOUR_CLOUDFLARE_API_TOKEN


wrangler whoami
```

### 2.2 LINE Developer

#### ** LINE Channel**
1. [LINE Developers Console](https://developers.line.biz)
2. LINE
3.
4. "Create Provider"
5. Provider
6. "Create"

#### ** Messaging API Channel**
1. Provider "Create Channel"
2. "Messaging API"
3. Channel
 ```
 Channel name:
 Channel description:
 Category: Business
 Subcategory: Customer Service
 ```
4. Channel
5.
6. "Create"

#### ** LINE Credentials**
1. Channel
2. "Basic settings" **Channel Secret**
3. "Messaging API"
4. **Channel Access Token**
 - "Issue"
5. ****:

### 2.3 Facebook Messenger

#### ** Facebook App**
1. [Facebook Developers](https://developers.facebook.com)
2. Facebook
3. "My Apps" "Create App"
4. "Business"
5.

#### ** Messenger**
1. Dashboard "Add Product"
2. "Messenger" "Set Up"
3. Page Access Token
4. App Secret

---


### 3.1

```powershell
# PowerShell
$env:CLOUDFLARE_API_TOKEN = "_Cloudflare_API_Token"
$env:TF_VAR_line_channel_access_token = "_LINE_Channel_Access_Token"
$env:TF_VAR_line_channel_secret = "_LINE_Channel_Secret"
$env:TF_VAR_admin_email = "admin@yourdomain.com"
$env:TF_VAR_admin_password = "__8"
```

### 3.2

```powershell
# Cloudflare ID
$env:TF_VAR_cloudflare_account_id = "_Cloudflare__ID"

# Facebook Messenger
$env:TF_VAR_facebook_page_access_token = "_Facebook_Page_Access_Token"
$env:TF_VAR_facebook_app_secret = "_Facebook_App_Secret"


$env:TF_VAR_custom_domain = "api.yourdomain.com"
$env:TF_VAR_frontend_custom_domain = "app.yourdomain.com"
```

### 3.3

#### ** 1: PowerShell **
```powershell

[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "_Token", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_line_channel_access_token", "_LINE_Token", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_line_channel_secret", "_LINE_Secret", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_admin_email", "admin@yourdomain.com", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_admin_password", "", "User")


$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
```

#### ** 2: Windows **
1. `Win + R` `sysdm.cpl`
2. ""
3. "" ""
4.

#### ** 3: .env **
```bash
# .env.local
# Git

CLOUDFLARE_API_TOKEN=_Token
TF_VAR_line_channel_access_token=_LINE_Token
TF_VAR_line_channel_secret=_LINE_Secret
TF_VAR_admin_email=admin@yourdomain.com
TF_VAR_admin_password=
```

### 3.4

```powershell

Write-Host "CLOUDFLARE_API_TOKEN: $($env:CLOUDFLARE_API_TOKEN -ne $null)"
Write-Host "TF_VAR_line_channel_access_token: $($env:TF_VAR_line_channel_access_token -ne $null)"
Write-Host "TF_VAR_line_channel_secret: $($env:TF_VAR_line_channel_secret -ne $null)"
Write-Host "TF_VAR_admin_email: $env:TF_VAR_admin_email"
Write-Host "TF_VAR_admin_password: $($env:TF_VAR_admin_password -ne $null)"
```

---


### 4.1

#### ** 1: Git Clone**
```bash
# Git
git clone [_Git_URL]
cd Multi_Channel_Integration_System
```

#### ** 2: **
```bash


# : C:\Projects\Multi_Channel_Integration_System
```

### 4.2

```bash

cd Multi_Channel_Integration_System


npm install


cd frontend
npm install
cd ..


npm ls --depth=0
cd frontend && npm ls --depth=0 && cd ..
```

### 4.3

```bash
# Worker
npm run build


cd frontend
npm run build:pages
cd ..


ls dist/ # index.js
ls frontend/dist/ #
```

---


### 5.1 Terraform

#### ****
```powershell

cd Multi_Channel_Integration_System


.\scripts\user-deploy.ps1


.\scripts\user-deploy.ps1 -Help
```

#### ****
```powershell

.\scripts\user-deploy.ps1 -PlanOnly


.\scripts\user-deploy.ps1 -AutoApprove


.\scripts\user-deploy.ps1 -Environment development


.\scripts\user-deploy.ps1 -Environment development -AutoApprove
```

### 5.2


1. **** - TerraformNode.jsWrangler
2. **** -
3. ** Wrangler ** - Cloudflare
4. **** -
5. **Terraform ** - Terraform
6. **** - Terraform
7. **** - Cloudflare
8. **** - API

### 5.3

- ****: 5-10
- ****: 2-3
- ****:

---


### 6.1

Terraform URL

```bash
Outputs:

api_url = "https://mcis-backend.daiwandist.com"
frontend_url = "https://mcis-ey7.pages.dev"
admin_dashboard_url = "https://mcis-backend.daiwandist.com/admin-dashboard.html"
line_webhook_url = "https://mcis-backend.daiwandist.com/api/webhooks/line"
facebook_webhook_url = "https://mcis-backend.daiwandist.com/api/webhooks/facebook"
database_name = "mcis-db"
facebook_verify_token = <sensitive>
```

****: URL

### 6.2 LINE Webhook

1. ** Webhook URL**
 ```bash
 # Terraform line_webhook_url
 # : https://mcis-backend.daiwandist.com/api/webhooks/line
 ```

2. ** LINE Developers Console **
 ```bash
 #
 # 1. LINE Developers Console
 # 2. Channel
 # 3. "Messaging API"
 # 4. "Webhook settings"
 # - Webhook URL: line_webhook_url
 # - "Verify"
 # - "Use webhook"
 # 5. "Auto-reply messages"
 # - "Auto-reply messages"
 # - "Greeting messages"
 ```

3. ** Webhook**
 ```bash
 # LINE Console "Verify"
 # "Success"
 ```

### 6.3 Facebook Webhook

1. ** Facebook Verify Token**
 ```bash
 # Terraform
 terraform output facebook_verify_token
 ```

2. ** Facebook Developers Console **
 ```bash
 #
 # 1. Facebook App Dashboard
 # 2. "Messenger" "Settings"
 # 3. "Webhooks" "Add Callback URL"
 # 4.
 # - Callback URL: facebook_webhook_url
 # - Verify Token: Terraform token
 # 5.
 # 6. "Verify and Save"
 ```

### 6.4

#### ****
```bash
# 1. URL
# https://your-worker-url/admin-dashboard.html
# 2.
# Email: TF_VAR_admin_email
# Password: TF_VAR_admin_password
# 3.
```

#### ** API **
```bash
# 1. "API "
# 2. API
# 3.
# 4. API ""
```

#### ** LINE Bot**
```bash
# 1. LINE Developers Console Bot
# 2. LINE App QR Code Bot ID
# 3.
# 4.
# 5.
```

### 6.5

#### ****
```bash
# 1.
# 2. ""
# 3. ""
# 4.
```

#### ****
```bash
# 1. ""
# 2. ""
# 3.
# 4.
```

#### ** QR Code**
```bash
# 1. "QR Code "
# 2. " QR Code"
# 3.
# 4. QR Code
```

---


### 7.1

#### ****:
```powershell

echo $env:CLOUDFLARE_API_TOKEN
echo $env:TF_VAR_line_channel_access_token

# null
$env:CLOUDFLARE_API_TOKEN = "_Token"
$env:TF_VAR_line_channel_access_token = "_LINE_Token"
# ...
```

#### ****: PowerShell
```powershell

[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "_Token", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_line_channel_access_token", "_LINE_Token", "User")
# ...

# PowerShell
refreshenv # Chocolatey
```

### 7.2 Terraform

#### ****: Terraform
```bash

rm -rf .terraform .terraform.lock.hcl
terraform init

# Terraform
terraform --version
```

#### ****:
```bash

terraform plan -detailed-exitcode

# Cloudflare
wrangler whoami

# Cloudflare
wrangler logout
wrangler login
```

#### ****:
```bash

rm terraform.tfstate*
terraform init
terraform plan
```

### 7.3 Wrangler

#### ****: Wrangler
```bash

wrangler logout


wrangler login

# API Token
wrangler auth login --api-token YOUR_CLOUDFLARE_API_TOKEN


wrangler whoami
```

#### ****: Worker
```bash

ls dist/index.js


npm run build

# wrangler.toml
cat wrangler.toml
```

### 7.4

#### ****: npm
```bash
# npm
npm cache clean --force

# node_modules
rm -rf node_modules package-lock.json
npm install


cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### ****: TypeScript
```bash
# TypeScript
npx tsc --noEmit

# TypeScript
cd frontend
npm run type-check


```

#### ****:
```bash
cd frontend


echo $env:NODE_ENV


$env:NODE_ENV = "production"


npm run build:pages


ls dist/
```

### 7.5 API Webhook

#### ****: LINE Webhook
```bash
# Webhook URL
curl https://your-worker-url/api/webhooks/line

# LINE Channel Secret
echo $env:TF_VAR_line_channel_secret

# Worker
wrangler tail --name your-worker-name
```

#### ****: API
```bash
# Worker
curl https://your-worker-url/api/system/health


wrangler d1 execute your-database-name --command="SELECT 1"


wrangler tail --name your-worker-name --format=pretty
```

### 7.6

#### ****:
```bash

wrangler d1 list

# Schema
wrangler d1 execute your-database-name --file=./database/schema.sql


wrangler d1 execute your-database-name --command="SELECT name FROM sqlite_master WHERE type='table'"
```

#### ****:
```bash

wrangler d1 execute your-database-name --command="SELECT * FROM users WHERE role='admin'"

# Node.js
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your_password', 10);
console.log('INSERT INTO users (email, password_hash, role, is_active, display_name, created_at, updated_at) VALUES (\"admin@example.com\", \"' + hash + '\", \"admin\", 1, \"\", datetime(\"now\"), datetime(\"now\"));');
" > create_admin.sql

wrangler d1 execute your-database-name --file=./create_admin.sql
rm create_admin.sql
```

---


- [ ] ****
 - [ ] Node.js 18+ 20+
 - [ ] npm
 - [ ] Terraform 1.0+
 - [ ] Wrangler CLI 3.x+

- [ ] ****
 - [ ] Cloudflare
 - [ ] Cloudflare API Token
 - [ ] Wrangler Cloudflare
 - [ ] LINE Channel
 - [ ] LINE Channel Access Token
 - [ ] LINE Channel Secret

- [ ] ****
 - [ ] CLOUDFLARE_API_TOKEN
 - [ ] TF_VAR_line_channel_access_token
 - [ ] TF_VAR_line_channel_secret
 - [ ] TF_VAR_admin_email
 - [ ] TF_VAR_admin_password

- [ ] ****
 - [ ]
 - [ ] (npm install)
 - [ ] (cd frontend && npm install)
 - [ ] (npm run build)
 - [ ] (npm run build:pages)


- [ ] ****
 - [ ] Terraform
 - [ ] Worker
 - [ ] Pages
 - [ ]
 - [ ]

- [ ] ****
 - [ ] API
 - [ ]
 - [ ]
 - [ ]

- [ ] ****
 - [ ] API
 - [ ] API
 - [ ] LINE Webhook
 - [ ] LINE Bot
 - [ ]

- [ ] ****
 - [ ]
 - [ ]
 - [ ] QR Code
 - [ ]

---


#### **Cloudflare Dashboard**
```bash
# URL
# Worker Analytics: https://dash.cloudflare.com/your-account-id/analytics/workers
# Worker Logs: https://dash.cloudflare.com/your-account-id/workers/services/view/your-worker-name/logs
# Pages Analytics: https://dash.cloudflare.com/your-account-id/pages/view/your-pages-name
```

#### ****
```bash
# Worker
wrangler tail --name your-worker-name

# D1
wrangler d1 info your-database-name

# KV
wrangler kv:namespace list
```


#### ****
- **API **: < 1000ms ()
- ****: < 3
- **WebSocket **: < 500ms
- ****: < 200ms

#### ****
- **Worker CPU**: 50ms ()
- **Worker **: 128MB ()
- **D1 **: 25GB
- **R2 **: 10GB
- **KV **: 100,000

---


### Cloudflare 2025

#### ****
- **Workers**: 100,000
- **D1 Database**: 25GB + 500 + 10
- **R2 Storage**: 10GB + 100 + 10
- **KV**: 100,000
- **Pages**: 500 +

#### ****
- **Workers**: $0.50
- **D1 Database**: GB $0.75/
- **R2 Storage**: GB $0.015/
- **KV**: $0.50
- **Pages**: $0.25

#### ****
```bash
# < 10,000 /
-
- : $0-5/

# 10,000-50,000 /
- : $10-25/

# > 50,000 /
- : $25-100/
```

---


#### **API Token **
```bash
# API Token
# 1. Cloudflare Token
# 2.
# 3. Token
# 4. Token
```

#### ****
```bash

# - 8
# -
# -
# - 90
```

#### ****
```bash

# -
# -
# - Token
```


#### ****
- API HTTPS
- WebSocket WSS
- Webhook

#### ****
- bcrypt
- KV
-

---


#### ****
- URL: `https://your-worker-url/admin-dashboard.html`
- :

#### ****
1. ****:
2. **API **: API
3. ****:
4. ****:
5. ****:
6. **QR Code **: QR Code

### API

#### ** API**
```bash
POST /api/auth/login #
POST /api/auth/logout #
GET /api/auth/profile #
POST /api/auth/refresh # Token
```

#### ** API**
```bash
GET /api/teams #
POST /api/teams #
PUT /api/teams/:id #
DELETE /api/teams/:id #
GET /api/teams/:id/members #
POST /api/teams/:id/members #
POST /api/teams/:id/qr-code # QR Code
```

#### ** API**
```bash
GET /api/conversations #
GET /api/conversations/:id #
POST /api/conversations/:id/assign #
POST /api/conversations/:id/transfer #
PUT /api/conversations/:id #
```

#### ** API**
```bash
GET /api/conversations/:id/messages #
POST /api/messages/send #
POST /api/messages/:id/recall #
GET /api/messages/pending #
DELETE /api/messages/:id #
```

#### ** API**
```bash
GET /api/customers #
GET /api/customers/:id #
PUT /api/customers/:id #
POST /api/customers/:id/tags #
```

#### ** API**
```bash
GET /api/system/health #
GET /api/system/status # API
GET /api/system/config #
```

#### **Webhook **
```bash
POST /api/webhooks/line # LINE Bot Webhook
POST /api/webhooks/facebook # Facebook Messenger Webhook
```


#### ****
```bash

wrangler d1 execute your-database-name --command="SELECT COUNT(*) FROM messages"


wrangler d1 export your-database-name --output backup.sql

# SQL
wrangler d1 execute your-database-name --file=./database/schema.sql


wrangler d1 execute your-database-name --command="
INSERT INTO users (email, password_hash, role, is_active, display_name, created_at, updated_at)
VALUES ('admin@example.com', 'hashed_password', 'admin', 1, '', datetime('now'), datetime('now'))
"
```

#### **KV **
```bash
# KV
wrangler kv:namespace list

# KV
wrangler kv:key list --namespace-id=your-namespace-id

# KV
wrangler kv:key put "test-key" "test-value" --namespace-id=your-namespace-id

# KV
wrangler kv:key delete "test-key" --namespace-id=your-namespace-id
```

#### **R2 **
```bash
# R2
wrangler r2 bucket list

# R2
wrangler r2 object put your-bucket-name/test.txt test-file.txt


wrangler r2 object get your-bucket-name/test.txt --file=downloaded-file.txt
```

#### **Queue **
```bash
# Queue
wrangler queues list

# Queue
wrangler queues producer your-queue-name "test message"

# Queue
wrangler queues consumer your-queue-name
```

---


1. ****:
2. ****:
3. ****: QR Code Webhook
4. ****: API
5. ****:


1.
2.
3.
4.

---


#### ****
1. ****
 ```bash
 # src/integrations/
 # : src/integrations/telegram-adapter.ts
 ```

2. ** PlatformAdapter **
 ```typescript
 export class TelegramAdapter implements PlatformAdapter {
 async sendMessage(message: Message): Promise<void> {
 // Telegram API
 }

 async processWebhook(request: Request): Promise<void> {
 // Telegram Webhook
 }
 }
 ```

3. ** Webhook **
 ```typescript
 // Worker
 app.post('/api/webhooks/telegram', async (c) => {
 const telegramAdapter = new TelegramAdapter();
 return await telegramAdapter.processWebhook(c.req);
 });
 ```

#### ****
- **Telegram Bot API**
- **WhatsApp Business API**
- **Instagram Direct Messages**
- **Twitter Direct Messages**
- **Discord Bot**

### AI

#### ** ChatGPT **
1. ****
 ```bash
 npm install openai
 ```

2. ** AI **
 ```typescript
 // src/services/ai-service.ts
 export class AIService {
 async generateReply(context: string): Promise<string> {
 // OpenAI API
 }
 }
 ```

3. ****
 ```typescript
 // AI
 if (conversation.enableAutoReply) {
 const aiReply = await aiService.generateReply(messageContext);
 await sendMessage(aiReply);
 }
 ```


#### ****
1. ****
 ```sql
 CREATE TABLE customer_analytics (
 id INTEGER PRIMARY KEY,
 customer_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 event_data JSON,
 timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
 );
 ```

2. ** API**
 ```bash
 GET /api/analytics/customers/:id #
 GET /api/analytics/teams/:id #
 GET /api/analytics/conversations #
 ```


#### ****
1. ****
 ```typescript
 // src/services/permission-service.ts
 export class PermissionService {
 async checkCustomPermission(user: User, resource: string, action: string): Promise<boolean> {
 //
 }
 }
 ```

2. ****
 ```sql
 INSERT INTO permissions (resource, action, role) VALUES
 ('analytics', 'view', 'manager'),
 ('export', 'data', 'admin');
 ```


#### **React Native App**
1. ****
 ```
 mobile-app/
 src/
 screens/
 components/
 services/
 utils/
 package.json
 ```

2. **API **
 ```typescript
 // REST API
 const apiClient = new ApiClient('https://your-worker-url');
 ```


#### ** Grafana **
1. ****
 ```typescript
 //
 await metrics.send({
 timestamp: Date.now(),
 apiResponseTime: responseTime,
 errorRate: errors / total
 });
 ```

2. ****
 ```yaml
 # grafana-alerts.yml
 alerts:
 - name: "High Error Rate"
 condition: "error_rate > 0.05"
 notification: "slack-webhook"
 ```


#### **CRM **
```typescript
// src/integrations/crm-integration.ts
export class CRMIntegration {
 async syncCustomer(customer: Customer): Promise<void> {
 // CRM
 }

 async createTicket(conversation: Conversation): Promise<string> {
 // CRM
 }
}
```

#### ** CRM **
- **Salesforce**
- **HubSpot**
- **Pipedrive**
- **Zendesk**
- **Freshworks**

---


- [Cloudflare Workers ](https://developers.cloudflare.com/workers/)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [LINE Messaging API ](https://developers.line.biz/en/docs/messaging-api/)
- [Vue.js 3 ](https://vuejs.org/)
- [Drizzle ORM ](https://orm.drizzle.team/)
- [Hono ](https://hono.dev/)

---

****: v3.0.0
****: 2025-08-25
****:
****: 45-60
****: 2-3 / 1

