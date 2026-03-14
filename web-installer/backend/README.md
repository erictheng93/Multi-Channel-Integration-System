# Web Installer Backend

**Cloudflare Worker** that orchestrates the automated deployment of the Multi-Channel CRM system.

## Architecture

```
┌─────────────────────────────────────────────┐
│ Cloudflare Worker │
├─────────────────────────────────────────────┤
│ │
│  Routes: │
│  ├─ /oauth/authorize │
│  ├─ /oauth/callback │
│  ├─ /deployment/start │
│  ├─ /deployment/:name/status │
│  ├─ /deployment/:name/events (SSE) │
│  └─ /deployment/:name/cancel │
│ │
│  Durable Objects: │
│  └─ DeploymentOrchestrator │
│ ├─ 15-step deployment pipeline │
│ ├─ State persistence │
│ ├─ SSE broadcasting │
│ └─ Automatic rollback │
│ │
│  Services: │
│  ├─ CloudflareAPI │
│  ├─ MigrationRunner │
│  ├─ ConfigGenerator │
│  ├─ EmailService │
│  └─ RollbackService │
│ │
└─────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Wrangler CLI >= 3
- Cloudflare account

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables template
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your credentials
nano .dev.vars
```

### Development

```bash
# Start local development server
npm run dev

# The API will be available at http://localhost:8787
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Deployment

**Quick Deployment:**
```bash
# Use the automated deployment script
chmod +x deploy.sh
./deploy.sh
```

**Manual Deployment:**
```bash
# Set production secrets first
wrangler secret put CF_CLIENT_ID
wrangler secret put CF_CLIENT_SECRET
wrangler secret put RESEND_API_KEY

# Deploy
wrangler deploy

# The Worker will be deployed to:
# https://crm-installer-backend.<your-account>.workers.dev
```

For complete deployment instructions, see: [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)

## Environment Variables

Required environment variables (set via `wrangler secret put`):

| Variable | Description | Required |
|----------|-------------|----------|
| `CF_CLIENT_ID` | Cloudflare OAuth Client ID | Yes |
| `CF_CLIENT_SECRET` | Cloudflare OAuth Client Secret | Yes |
| `RESEND_API_KEY` | Resend Email API Key | Yes |
| `FROM_EMAIL` | Email sender address | No (default: installer@crm.com) |
| `SUPPORT_EMAIL` | Support email address | No |
| `ENVIRONMENT` | Environment name | No (default: development) |

### Setting Secrets

```bash
# Set OAuth credentials
wrangler secret put CF_CLIENT_ID
wrangler secret put CF_CLIENT_SECRET

# Set email API key
wrangler secret put RESEND_API_KEY
```

## API Endpoints

### OAuth Flow

#### 1. Initiate Authorization
```http
GET /oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback
```

Response:
```json
{
  "authorizationUrl": "https://dash.cloudflare.com/oauth2/auth?...",
  "state": "random_state_string",
  "codeVerifier": "random_verifier_string"
}
```

#### 2. Exchange Code for Token
```http
POST /oauth/callback
Content-Type: application/json

{
  "code": "authorization_code",
  "state": "state_from_step_1",
  "codeVerifier": "verifier_from_step_1",
  "redirectUri": "http://localhost:3000/oauth/callback"
}
```

Response:
```json
{
  "success": true,
  "accessToken": "cloudflare_access_token",
  "expiresIn": 3600,
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  },
  "accounts": [
    {
      "id": "account_id",
      "name": "My Account"
    }
  ]
}
```

### Deployment Management

#### 1. Start Deployment
```http
POST /deployment/start
Content-Type: application/json

{
  "projectName": "my-crm",
  "adminEmail": "admin@example.com",
  "customDomain": "crm.example.com",
  "accountId": "cloudflare_account_id",
  "oauthToken": "access_token_from_oauth"
}
```

Response:
```json
{
  "success": true,
  "deploymentId": "uuid",
  "message": "Deployment started"
}
```

#### 2. Get Deployment Status
```http
GET /deployment/my-crm/status
```

Response:
```json
{
  "deploymentId": "uuid",
  "status": "in_progress",
  "currentStep": "deploy_worker",
  "currentStepProgress": 45,
  "totalProgress": 62,
  "resources": {
    "d1DatabaseId": "...",
    "kvSessionNamespaceId": "...",
    "r2BucketName": "...",
    "workerUrl": "https://my-crm-worker.workers.dev"
  },
  "logs": [...]
}
```

#### 3. Stream Deployment Events (SSE)
```http
GET /deployment/my-crm/events
```

Server-Sent Events stream:
```
data: {"type":"progress","data":{"step":"create_d1","stepProgress":100,"totalProgress":8}}

data: {"type":"log","data":{"level":"success","message":"Created D1 database"}}

data: {"type":"complete","data":{"deploymentId":"...","resources":{...}}}
```

#### 4. Cancel Deployment
```http
POST /deployment/my-crm/cancel
```

Response:
```json
{
  "success": true,
  "message": "Deployment cancelled"
}
```

## Project Structure

```
backend/
├── src/
│ ├── index.ts # Worker entry point
│ ├── durable-objects/
│ │   └── DeploymentOrchestrator.ts
│ ├── routes/
│ │   ├── oauth.ts
│ │   └── deployment.ts
│ ├── services/
│ │   ├── CloudflareAPI.ts
│ │   ├── MigrationRunner.ts
│ │   ├── ConfigGenerator.ts
│ │   ├── EmailService.ts
│ │   └── RollbackService.ts
│ ├── utils/
│ │   ├── validation.ts
│ │   └── errors.ts
│ └── types/
│ ├── index.ts
│ ├── deployment.ts
│ └── cloudflare.ts
├── tests/
│ └── unit/
│ └── utils/
├── wrangler.toml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Deployment Steps

The DeploymentOrchestrator executes these 15 steps:

1. **initialize** - Initialize deployment (1%)
2. **create_d1** - Create D1 Database (8%)
3. **create_kv_session** - Create KV Namespace for sessions (5%)
4. **create_kv_cache** - Create KV Namespace for cache (5%)
5. **create_r2** - Create R2 Bucket (5%)
6. **create_queue** - Create Queue (5%)
7. **run_migrations** - Run database migrations (15%)
8. **generate_config** - Generate wrangler.toml (3%)
9. **deploy_worker** - Deploy Worker (12%)
10. **build_frontend** - Build frontend (10%)
11. **deploy_pages** - Deploy Pages (12%)
12. **configure_domain** - Configure custom domain (5%)
13. **create_admin** - Create admin user (5%)
14. **send_email** - Send credentials email (3%)
15. **verify_health** - Verify deployment (4%)
16. **complete** - Finish deployment (2%)

Total: 100%

## Error Handling

- Each step has a configurable timeout
- Failed steps can be retried (up to 3 times)
- Exponential backoff between retries
- Automatic rollback on failure
- Email notification on failure

## Support

- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com/installer
- Discord: https://discord.gg/yourcompany

## License

MIT
