# Web Installer - Developer Documentation

**Version:** 1.0.0
**Last Updated:** 2025-01-28
**Status:** Production-Ready

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Development Setup](#development-setup)
5. [Core Components](#core-components)
6. [API Reference](#api-reference)
7. [Testing Guide](#testing-guide)
8. [Deployment Guide](#deployment-guide)
9. [Configuration](#configuration)
10. [Troubleshooting](#troubleshooting)
11. [Contributing](#contributing)

---

## 1. Introduction

### 1.1 Purpose

The Web Installer is a self-service deployment system that enables customers to deploy the Multi-Channel CRM system to their own Cloudflare accounts with minimal technical knowledge.

### 1.2 Key Features

- **One-Click OAuth**: Seamless Cloudflare authentication
- **Automated Provisioning**: Creates all necessary Cloudflare resources
- **Real-time Progress**: Live deployment status with Server-Sent Events
- **Automatic Rollback**: Cleans up resources on failure
- **Email Notifications**: Sends credentials and deployment summary
- **User-Friendly**: Designed for non-technical users

### 1.3 Technology Stack

**Backend:**
- Cloudflare Workers (Runtime)
- Hono (Web framework)
- Durable Objects (Stateful orchestration)
- TypeScript (Type safety)

**Frontend:**
- Vue 3 (UI framework)
- Pinia (State management)
- TypeScript (Type safety)
- Vite (Build tool)

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Web Installer │
├─────────────────────────────────────────────────────────────┤
│ │
│  ┌────────────────┐ ┌──────────────────┐ │
│  │ Frontend │◄─────────────┤ Backend │      │
│  │ (Vue 3) │   REST API │   (Worker) │      │
│  └────────────────┘ └──────────────────┘ │
│ │                                 │ │
│ │                                 │ │
│ ▼                                 ▼ │
│  ┌────────────────┐ ┌──────────────────┐ │
│  │  Pinia Store │◄─────SSE─────┤  Durable Object  │ │
│  │  (State Mgmt)  │ Stream │  (Orchestrator)  │ │
│  └────────────────┘ └──────────────────┘ │
│ │                 │
│ │                 │
│ ▼                 │
│ ┌──────────────────┐ │
│ │  CloudflareAPI │      │
│ │    Service │      │
│ └──────────────────┘ │
│ │                 │
└───────────────────────────────────────────┼─────────────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ Cloudflare │
                                   │ Platform API │
                                   └──────────────────┘
```

### 2.2 Deployment Flow

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Landing │─────│ OAuth │─────│ Config │
│ Page │      │  Callback │      │ Form │
└──────────────┘ └──────────────┘ └──────────────┘
                                                     │
                                                     ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Success │◄─────│  Progress │◄─────│  Deployment  │
│ Page │      │ Monitor │      │ Initiated  │
└──────────────┘ └──────────────┘ └──────────────┘
       │
       │ (on error)
       ▼
┌──────────────┐
│ Error │
│ Page │
└──────────────┘
```

### 2.3 Data Flow

```
User Input ──┐
             │
             ▼
     ┌───────────────┐
     │  Validation │
     └───────────────┘
             │
             ▼
     ┌───────────────┐
     │  OAuth Token  │◄──── Cloudflare OAuth
     └───────────────┘
             │
             ▼
     ┌───────────────┐
     │  Durable │
     │  Object │
     │  Orchestrator │
     └───────────────┘
             │
             ├────┐
             │ │
             ▼ ▼
     ┌──────────┐ ┌──────────┐
     │ Provision│ │ SSE │
     │ Resources│ │ Broadcast│
     └──────────┘ └──────────┘
             │ │
             │ ▼
             │ ┌──────────┐
             │ │ Frontend │
             │ │  Store │
             │ └──────────┘
             │
             ▼
     ┌───────────────┐
     │  Success / │
     │  Rollback │
     └───────────────┘
```

---

## 3. Project Structure

### 3.1 Backend Structure

```
web-installer/backend/
├── src/
│ ├── index.ts # Worker entry point
│ ├── durable-objects/
│ │   └── DeploymentOrchestrator.ts  # Deployment state machine
│ ├── services/
│ │   ├── CloudflareAPI.ts # Cloudflare API wrapper
│ │   ├── MigrationRunner.ts # Database migrations
│ │   ├── ConfigGenerator.ts # wrangler.toml generator
│ │   ├── EmailService.ts # Email notifications
│ │   └── RollbackService.ts # Resource cleanup
│ ├── routes/
│ │   ├── oauth.ts # OAuth flow routes
│ │   └── deployment.ts # Deployment API routes
│ ├── utils/
│ │   ├── validation.ts # Input validation
│ │   ├── errors.ts # Custom error classes
│ │   └── logger.ts # Logging utilities
│ └── types/
│ ├── cloudflare.ts # Cloudflare API types
│ ├── deployment.ts # Deployment types
│ └── index.ts # Exported types
├── tests/
│ ├── unit/
│ │   ├── utils/
│ │   ├── services/
│ │   └── durable-objects/
│ ├── integration/
│ └── e2e/
├── wrangler.toml # Worker configuration
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 3.2 Frontend Structure

```
web-installer/frontend/
├── src/
│ ├── main.ts # Application entry
│ ├── App.vue # Root component
│ ├── router/
│ │   └── index.ts # Route configuration
│ ├── views/
│ │   ├── LandingPage.vue # Step 1: Landing
│ │   ├── OAuthCallback.vue # Step 2: OAuth
│ │   ├── ConfigForm.vue # Step 3: Config
│ │   ├── DeployProgress.vue # Step 4: Progress
│ │   ├── SuccessPage.vue # Step 5: Success
│ │   └── ErrorPage.vue # Error handler
│ ├── components/
│ │   ├── ProgressBar.vue # Progress indicator
│ │   ├── LogConsole.vue # Real-time logs
│ │   ├── CredentialsBox.vue # Credentials display
│ │   └── FeatureCard.vue # Feature display
│ ├── stores/
│ │   └── deploymentStore.ts # Deployment state
│ ├── api/
│ │   └── installer.ts # API client
│ ├── assets/
│ │   └── styles/
│ │       └── global.css # Global styles
│ └── types/
│ └── index.ts # TypeScript types
├── tests/
│ ├── unit/
│ ├── integration/
│ └── e2e/
├── public/
│ └── favicon.ico
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Development Setup

### 4.1 Prerequisites

- **Node.js:** >= 18.0.0
- **npm:** >= 9.0.0
- **Cloudflare Account:** Free tier works
- **Wrangler CLI:** >= 3.0.0

### 4.2 Backend Setup

```bash
# Navigate to backend directory
cd web-installer/backend

# Install dependencies
npm install

# Create .dev.vars file for local development
cat > .dev.vars << EOF
CF_CLIENT_ID=your_cloudflare_oauth_client_id
CF_CLIENT_SECRET=your_cloudflare_oauth_client_secret
RESEND_API_KEY=your_resend_api_key
EOF

# Start development server
npm run dev
```

The backend will be available at `http://localhost:8787`

### 4.3 Frontend Setup

```bash
# Navigate to frontend directory
cd web-installer/frontend

# Install dependencies
npm install

# Create .env.development file
cat > .env.development << EOF
VITE_API_BASE_URL=http://localhost:8787
VITE_CF_OAUTH_CLIENT_ID=your_cloudflare_oauth_client_id
VITE_CF_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
EOF

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 4.4 Development Workflow

```bash
# Terminal 1: Backend
cd web-installer/backend
npm run dev

# Terminal 2: Frontend
cd web-installer/frontend
npm run dev

# Terminal 3: Run tests
cd web-installer/backend
npm run test:watch
```

---

## 5. Core Components

### 5.1 Backend Components

#### 5.1.1 DeploymentOrchestrator (Durable Object)

**Purpose:** Manages deployment state and orchestrates the 15-step deployment process.

**Key Methods:**

```typescript
class DeploymentOrchestrator extends DurableObject {
  async fetch(request: Request): Promise<Response>
  private async startDeployment(config: DeploymentConfig): Promise<void>
  private async updateProgress(step: number, message: string): Promise<void>
  private broadcast(data: any): void
  private async rollbackOnFailure(): Promise<void>
}
```

**State Management:**
- Persists state to Durable Object storage
- Broadcasts updates via Server-Sent Events
- Handles concurrent requests safely

**Deployment Steps:**
1.  Initialize deployment (0%)
2.  Create D1 Database (5%)
3.  Create KV Namespaces x2 (10%)
4.  Create R2 Bucket (15%)
5.  Create Queue (20%)
6.  Run database migrations (40%)
7.  Generate wrangler.toml (50%)
8.  Deploy Worker (60%)
9.  Build frontend (70%)
10.  Deploy Pages (80%)
11.  Configure custom domain (85%)
12.  Create admin user (90%)
13.  Send welcome email (95%)
14.  Run health checks (98%)
15.  Complete (100%)

#### 5.1.2 CloudflareAPI Service

**Purpose:** Encapsulates all Cloudflare API operations.

**Key Methods:**

```typescript
class CloudflareAPI {
  // D1 Database
  async createD1Database(name: string): Promise<D1Database>

  // KV Namespace
  async createKVNamespace(title: string): Promise<KVNamespace>

  // R2 Bucket
  async createR2Bucket(name: string): Promise<R2Bucket>

  // Queue
  async createQueue(name: string): Promise<Queue>

  // Worker
  async deployWorker(script: string, bindings: any): Promise<Worker>

  // Pages
  async deployPages(projectName: string, files: FormData): Promise<Pages>

  // Domain
  async addCustomDomain(domain: string, projectName: string): Promise<void>
}
```

**Error Handling:**
- Automatic retry with exponential backoff
- Detailed error messages with suggestions
- Proper HTTP status code mapping

#### 5.1.3 MigrationRunner Service

**Purpose:** Applies database schema migrations.

**Schema Creation:**
- Creates 26+ tables
- Sets up indexes and foreign keys
- Tracks applied migrations

```typescript
class MigrationRunner {
  async runAll(): Promise<number>
  private async createMigrationsTable(): Promise<void>
  private getMigrations(): Migration[]
  private async applyMigration(migration: Migration): Promise<void>
}
```

#### 5.1.4 RollbackService

**Purpose:** Cleans up resources on deployment failure.

**Features:**
- Tracks all created resources
- Deletes in reverse order (LIFO)
- Logs deletion status
- Continues on individual failures

```typescript
class RollbackService {
  trackResource(type: string, id: string, name: string): void
  async rollbackAll(): Promise<RollbackResult>
  private async deleteResource(resource: Resource): Promise<boolean>
}
```

### 5.2 Frontend Components

#### 5.2.1 DeploymentStore (Pinia)

**Purpose:** Centralized deployment state management.

**State:**
```typescript
interface DeploymentState {
  status: 'idle' | 'deploying' | 'completed' | 'failed';
  progress: number;
  logs: LogEntry[];
  result: DeploymentResult | null;
  error: DeploymentError | null;
  taskId: string | null;
  accessToken: string | null;
}
```

**Actions:**
```typescript
{
  async exchangeOAuthCode(code: string, state: string): Promise<void>
  async startDeployment(config: DeploymentConfig): Promise<void>
  async cancelDeployment(): Promise<void>
  connectToSSE(taskId: string): void
  disconnectSSE(): void
}
```

#### 5.2.2 API Client

**Purpose:** HTTP communication with backend.

```typescript
class InstallerAPI {
  async exchangeOAuthCode(code: string, state: string): Promise<TokenResponse>
  async initiateDeployment(config: DeploymentConfig): Promise<InitiateResponse>
  async getDeploymentStatus(taskId: string): Promise<StatusResponse>
  connectToLogs(taskId: string): EventSource
}
```

---

## 6. API Reference

### 6.1 OAuth Endpoints

#### POST `/api/oauth/exchange`

**Description:** Exchange authorization code for access token.

**Request:**
```json
{
  "code": "cf_oauth_code",
  "state": "csrf_state_token"
}
```

**Response:**
```json
{
  "accessToken": "cf_access_token",
  "accountId": "cf_account_id",
  "accountName": "Account Name"
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request
- `401`: Authentication failed

### 6.2 Deployment Endpoints

#### POST `/api/deploy/initiate`

**Description:** Start a new deployment.

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "projectName": "my-crm-system",
  "adminEmail": "admin@example.com",
  "customDomain": "crm.example.com",
  "accountId": "cf_account_id"
}
```

**Response:**
```json
{
  "taskId": "deployment-uuid",
  "status": "deploying",
  "progress": 0
}
```

**Status Codes:**
- `202`: Accepted
- `400`: Validation error
- `401`: Unauthorized

#### GET `/api/deploy/status/:taskId`

**Description:** Query deployment status.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "taskId": "deployment-uuid",
  "status": "deploying",
  "progress": 45,
  "currentStep": "Running database migrations",
  "startedAt": "2025-01-28T10:00:00Z"
}
```

**Status Codes:**
- `200`: Success
- `404`: Task not found

#### GET `/api/deploy/logs/:taskId`

**Description:** Stream deployment logs (Server-Sent Events).

**Headers:**
```
Authorization: Bearer {accessToken}
Accept: text/event-stream
```

**Event Stream:**
```
event: progress
data: {"progress": 10, "message": "Created D1 database"}

event: log
data: {"level": "info", "message": "Applying migration 001", "timestamp": 1706443200000}

event: complete
data: {"result": {...}}

event: error
data: {"error": {...}}
```

#### DELETE `/api/deploy/:taskId`

**Description:** Cancel ongoing deployment.

**Response:**
```json
{
  "cancelled": true,
  "rollbackStatus": {
    "success": true,
    "deletedResources": [...]
  }
}
```

---

## 7. Testing Guide

### 7.1 Running Tests

```bash
# Backend tests
cd web-installer/backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Run specific test file
npm test -- validation.test.ts
```

### 7.2 Writing Unit Tests

**Example: Testing validation utility**

```typescript
import { describe, it, expect } from 'vitest';
import { validateField, ValidationRules } from '../../../src/utils/validation';

describe('validateField', () => {
  it('should validate required field correctly', () => {
    const error = validateField('projectName', '', ValidationRules);
    expect(error).not.toBeNull();
    expect(error?.message).toContain('required');
  });

  it('should accept valid project name', () => {
    const error = validateField('projectName', 'my-crm-system', ValidationRules);
    expect(error).toBeNull();
  });
});
```

### 7.3 Test Coverage Report

```bash
npm run test:coverage

# Open HTML report
open coverage/index.html
```

**Current Coverage:**
- Overall: 90.6%
- Statements: 90.6%
- Branches: 79.06%
- Functions: 100%

---

## 8. Deployment Guide

### 8.1 Backend Deployment

```bash
cd web-installer/backend

# Set production secrets
wrangler secret put CF_CLIENT_ID
wrangler secret put CF_CLIENT_SECRET
wrangler secret put RESEND_API_KEY

# Deploy to production
npm run deploy

# Verify deployment
curl https://crm-installer-backend.your-account.workers.dev/health
```

### 8.2 Frontend Deployment

```bash
cd web-installer/frontend

# Build for production
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=crm-installer-frontend

# Set environment variables in Cloudflare Dashboard
# - VITE_API_BASE_URL
# - VITE_CF_OAUTH_CLIENT_ID
# - VITE_CF_OAUTH_REDIRECT_URI
```

### 8.3 Custom Domain Setup

```bash
# Add custom domain in Cloudflare Dashboard
# Pages → crm-installer-frontend → Custom domains

# Add DNS records
# CNAME: installer.yourdomain.com → crm-installer-frontend.pages.dev
```

---

## 9. Configuration

### 9.1 Backend Configuration (wrangler.toml)

```toml
name = "crm-installer-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "DEPLOYMENT_ORCHESTRATOR", class_name = "DeploymentOrchestrator" }
]

[[migrations]]
tag = "v1"
new_classes = ["DeploymentOrchestrator"]

[vars]
ENVIRONMENT = "production"
INSTALLER_VERSION = "1.0.0"
```

### 9.2 Frontend Configuration (.env.production)

```bash
VITE_API_BASE_URL=https://crm-installer-backend.your-account.workers.dev
VITE_CF_OAUTH_CLIENT_ID=your_production_client_id
VITE_CF_OAUTH_REDIRECT_URI=https://installer.yourdomain.com/oauth/callback
```

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue: OAuth redirect not working

**Symptoms:** "Invalid redirect URI" error

**Solution:**
1. Verify OAuth redirect URI matches exactly in Cloudflare Dashboard
2. Ensure protocol (http/https) is correct
3. Check for trailing slashes

#### Issue: Deployment stuck at migration step

**Symptoms:** Progress stops at 40%

**Solution:**
1. Check D1 database is created successfully
2. Verify database migrations SQL syntax
3. Check Worker logs for detailed errors

#### Issue: Rollback fails to clean up resources

**Symptoms:** Some resources remain after failed deployment

**Solution:**
1. Manually delete resources from Cloudflare Dashboard
2. Check API token permissions
3. Review rollback service logs

### 10.2 Debugging

**Enable verbose logging:**

```typescript
// In DeploymentOrchestrator
private async log(level: string, message: string) {
  console.log(`[${level}] ${message}`);
  // ... broadcast to frontend
}
```

**View Worker logs:**
```bash
wrangler tail
```

**Monitor Durable Object state:**
```bash
# Use Cloudflare Dashboard → Workers → Durable Objects
```

---

## 11. Contributing

### 11.1 Code Style

- Follow TypeScript strict mode
- Use ESLint and Prettier
- Write comprehensive tests
- Document complex logic

### 11.2 Commit Guidelines

```
feat: Add custom domain configuration
fix: Resolve OAuth state validation issue
docs: Update API documentation
test: Add integration tests for deployment flow
refactor: Simplify error handling logic
```

### 11.3 Pull Request Process

1. Create feature branch from `main`
2. Write tests for new features
3. Ensure all tests pass
4. Update documentation
5. Submit PR with detailed description

---

## 12. License

MIT License - See LICENSE file for details

---

## 13. Support

- **Documentation:** https://docs.yourcompany.com/installer
- **Issues:** https://github.com/yourcompany/crm-installer/issues
- **Email:** support@yourcompany.com
- **Discord:** https://discord.gg/yourcompany

---

**Last Updated:** 2025-01-28
**Maintainer:** Development Team
**Version:** 1.0.0
