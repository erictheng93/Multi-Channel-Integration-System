

 Terraform Cloudflare Cloudflare


- ****:
- ****:
- ****:
- ****:
- ****:


### 1.

```bash
# Terraform
# Windows ( Chocolatey)
choco install terraform

# macOS ( Homebrew)
brew install terraform

# Wrangler CLI
npm install -g wrangler

# Node.js ()
# : https://nodejs.org/
```

### 2. Cloudflare

1. ** Cloudflare **: https://dash.cloudflare.com/sign-up
2. ** ID**:
 - Cloudflare Dashboard
 - Account ID
3. ** API Token**:
 - "My Profile" > "API Tokens"
 - "Create Token"
 - "Custom token"
 - :
 - Account: Cloudflare Workers:Edit
 - Zone: Zone:Edit ()
 - Zone: DNS:Edit ()

### 3. LINE Bot

1. ** LINE Developers Console**: https://developers.line.biz/
2. ** Messaging API Channel**
3. ****:
 - Channel Access Token
 - Channel Secret


### 1:

```bash
git clone <your-repository-url>
cd multi-channel-platform
```

### 2:

```bash
# Cloudflare API Token
export CLOUDFLARE_API_TOKEN="your-api-token"

# Windows PowerShell
$env:CLOUDFLARE_API_TOKEN="your-api-token"
```

### 3:

```bash

cp terraform.tfvars.example terraform.tfvars


# :
# - cloudflare_account_id
# - line_channel_access_token
# - line_channel_secret
# - admin_email
# - admin_password
```

### 4:

```bash
# Windows PowerShell
.\quick-deploy.ps1

# Terraform
terraform init
terraform apply
```

### 5:


```


API URL: https://your-project.your-account.workers.dev
 URL: https://your-project-frontend.pages.dev
: https://your-project.your-account.workers.dev/admin-dashboard.html

LINE Webhook URL: https://your-project.your-account.workers.dev/api/webhooks/line
: admin@yourdomain.com

:
1. LINE Developers Console Webhook URL
2.
3.
```


| | | |
|---------|------|------|
| **Cloudflare Workers** | API | 1 |
| **Cloudflare Pages** | | 1 |
| **D1 Database** | | 1 |
| **R2 Bucket** | | 1 |
| **KV Namespace** | | 2 |
| **Queues** | | 2 |
| **Durable Objects** | | 1 |


- **** ()
- **** ()
- **** (JWT SecretFacebook Verify Token)
- **** ()
- **** ()
- **CORS ** ()
- **** ()


### Cloudflare ()

| | | |
|------|----------|------------|
| **Workers** | 100,000 | $0.50/ |
| **D1 Database** | 25GB | $0.75/GB |
| **R2 Storage** | 10GB | $0.015/GB |
| **KV Operations** | 100,000 | $0.50/ |
| **Pages** | 500 | $0.25/ |


| | | |
|----------|----------|------------|
| **** | < 50,000 | $0 () |
| **** | 200,000 | $0.50 |
| **** | 1,000,000 | $4.50 |


```hcl
# terraform.tfvars
custom_domain = "api.yourdomain.com"
frontend_custom_domain = "app.yourdomain.com"
zone_id = "your-zone-id"
```


```bash

.\quick-deploy.ps1 -Environment staging


.\quick-deploy.ps1 -Environment development
```


```hcl
# terraform.tfvars
enable_facebook_integration = true
enable_advanced_features = true
```


```bash
terraform show
terraform output
```


```bash

git pull


.\quick-deploy.ps1 -AutoApprove
```


```bash

wrangler d1 export your-database-name --output backup.sql


wrangler d1 execute your-database-name --file backup.sql
```


```bash

wrangler tail


# Cloudflare Dashboard > Analytics
```


- ****: 64 JWT Secret
- ****:
- ****:
- **HTTPS **: HTTPS
- ****:
- **SQL **:


1. ****: 90
2. ****:
3. ****:
4. ****:


#### 1. Terraform
```bash

rm -rf .terraform
terraform init
```

#### 2. API Token
- API Token Workers:Edit
- Zone:Edit

#### 3.
```bash

wrangler d1 execute your-database-name --file ./database/schema.sql
```

#### 4.
```bash

cd frontend
rm -rf node_modules dist
npm install
npm run build
```


```bash

.\quick-deploy.ps1 -Help

# Terraform
terraform -help

# Wrangler
wrangler --help
```


```bash

.\quick-deploy.ps1 -Destroy

# Terraform
terraform destroy
```

 ****:


1. ****: `docs/`
2. ****: `wrangler tail`
3. ****: GitHub Issues
4. ****:

---


- ****: Vue.js
- ****: Cloudflare Workers API
- ****: WebSocket
- ****:
- ****: Cloudflare
- ****:
- ****:

 