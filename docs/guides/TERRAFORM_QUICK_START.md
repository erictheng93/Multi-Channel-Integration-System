# Terraform


 Terraform


- [Terraform](https://www.terraform.io/downloads) (>= 1.0)
- [Cloudflare CLI (wrangler)](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Node.js](https://nodejs.org/) (>= 18)
- [Git](https://git-scm.com/)


- [Cloudflare ](https://dash.cloudflare.com/sign-up)
 - Workers D1KVR2 Queue
 -


- **Cloudflare API **
 - Zone:Zone Settings:Edit
 - Zone:Zone:Read
 - Account:Cloudflare Workers:Edit
 - Account:Account Settings:Read

## 5

### 1.
```bash
git clone <repository-url>
cd Multi_Channel_Integration_System
bun install
```

### 2.
```bash

cp terraform.tfvars.example terraform.tfvars
cp .env.example .env

# Cloudflare API
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

### 3.
 `terraform.tfvars`
```hcl

cloudflare_account_id = "your-account-id"
project_name = "my-customer-support"
admin_email = "admin@yourcompany.com"
admin_password = "secure-password-123"

# LINE
line_channel_access_token = "your-line-channel-access-token"
line_channel_secret = "your-line-channel-secret"

# Facebook
facebook_page_access_token = "your-facebook-page-access-token"
facebook_app_secret = "your-facebook-app-secret"


custom_domain = "api.yourcompany.com"
frontend_custom_domain = "support.yourcompany.com"
zone_id = "your-cloudflare-zone-id"
```

### 4.
```bash
# Terraform
terraform init


terraform plan

# 2-3
terraform apply
```

### 5.
```bash

terraform output

# API
curl https://your-worker-url.workers.dev/api/health
```


| | | |
|------|------|------|
| `cloudflare_account_id` | Cloudflare ID | `abc123...` |
| `project_name` | | `customer-support` |
| `admin_email` | | `admin@company.com` |
| `admin_password` | | `SecurePass123!` |
| `line_channel_access_token` | LINE Bot | `abc123...` |
| `line_channel_secret` | LINE Bot | `def456...` |


| | | |
|------|------|--------|
| `environment` | | `production` |
| `custom_domain` | API | `""` ( workers.dev) |
| `frontend_custom_domain` | | `""` ( pages.dev) |
| `zone_id` | Cloudflare Zone ID | `""` |
| `r2_location` | R2 | `auto` |
| `facebook_page_access_token` | Facebook | `""` |
| `facebook_app_secret` | Facebook | `""` |


### Cloudflare
- **Worker**: API
- **D1 **: SQLite
- **KV **:
- **R2 **:
- ****:
- **Pages **:


-
-
-
- Webhook


### 1. LINE Bot
 LINE Developers Console webhook URL
```
https://your-domain/api/webhooks/line
```

### 2. Facebook Messenger
 Facebook Developers Console webhook URL
```
Webhook URL: https://your-domain/api/webhooks/facebook
Verify Token: ( terraform output )
```

### 3.
```
URL: https://your-domain/admin-dashboard.html
Email: (your admin_email)
Password: (your admin_password)
```

### 4.
```
URL: https://your-frontend-domain
```


```bash

terraform workspace new development
terraform apply -var="environment=development"
```


```bash

terraform workspace new staging
terraform apply -var="environment=staging"
```


```bash

terraform workspace select default
terraform apply -var="environment=production"
```


#### 1. API
```bash
# API
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

#### 2. ID
```bash
# ID
wrangler whoami
```

#### 3.
```bash
# zone ID
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
 -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

#### 4.
- Workers
- D1KVR2 Queues


```bash

terraform state list


wrangler d1 execute omni-channel-platform --command="SELECT COUNT(*) FROM users"

# API
curl https://your-domain/api/health
curl https://your-domain/api/system/status
```


```bash

git pull origin main


terraform plan
terraform apply
```


```bash
# terraform.tfvars
vim terraform.tfvars


terraform apply
```


```bash

terraform destroy


rm -rf .terraform
rm terraform.tfstate*
```


### Cloudflare Workers
- **Workers**: $5/ +
- **D1**: 25GB $0.75/GB
- **KV**: 100k $0.50/
- **R2**: 10GB $0.015/GB
- **Pages**: 500 $0.25/
- **Queues**: 100 $0.40/


- ****: $5-15/
- ****: $15-50/
- ****: $50-200/


- `terraform.tfvars`
- Terraform Cloud
- API


- API
- Cloudflare 2FA
-


- SSL/TLS
- Cloudflare
- CORS


1. [](DEPLOYMENT_GUIDE.md)
2. [](SYSTEM_HEALTH_REPORT.md)
3. GitHub


- Cloudflare Analytics
- Worker
- D1

---

* 10 [](DEPLOYMENT_GUIDE.md)*