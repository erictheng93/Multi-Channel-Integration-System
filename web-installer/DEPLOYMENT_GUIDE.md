# Web Installer Deployment Guide

Complete guide for deploying the Multi-Channel CRM Web Installer to Cloudflare.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Automated)](#quick-start-automated)
3. [Manual Deployment](#manual-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Production Checklist](#production-checklist)

---

## Prerequisites

### Required Software

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Wrangler CLI** >= 3.0.0
- **Git** (for version control)

Install Wrangler globally:
```bash
npm install -g wrangler
```

### Cloudflare Account Requirements

- Active Cloudflare account (free or paid)
- Permissions to create:
  - Workers
  - Pages projects
  - OAuth applications
  - D1 databases
  - KV namespaces
  - R2 buckets
  - Queues

### Third-Party Services

- **Resend Account** - For sending email notifications
  - Sign up at: https://resend.com
  - Free tier: 100 emails/day

---

## Quick Start (Automated)

The fastest way to deploy both backend and frontend:

### Linux/macOS

```bash
cd web-installer

# Make script executable
chmod +x deploy-all.sh

# Run deployment
./deploy-all.sh
```

### Windows

```batch
cd web-installer
deploy-all.bat
```

The automated script will:
1. ✅ Check prerequisites
2. ✅ Deploy backend Worker
3. ✅ Deploy frontend Pages
4. ✅ Update configuration
5. ✅ Provide next steps

---

## Manual Deployment

For more control, deploy backend and frontend separately.

### Step 1: Backend Deployment

#### 1.1 Configure Environment Variables

Create `backend/.dev.vars` (for local development):

```bash
cd backend
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your actual values:

```bash
# Cloudflare OAuth
CF_CLIENT_ID=your_client_id_here
CF_CLIENT_SECRET=your_client_secret_here

# Email Service
RESEND_API_KEY=re_xxxxxxxxxxxx

# Email Configuration
FROM_EMAIL=installer@yourcompany.com
SUPPORT_EMAIL=support@yourcompany.com

# Environment
ENVIRONMENT=development
```

#### 1.2 Set Production Secrets

For production, use Wrangler secrets (encrypted):

```bash
wrangler secret put CF_CLIENT_ID
wrangler secret put CF_CLIENT_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put FROM_EMAIL
wrangler secret put SUPPORT_EMAIL
```

#### 1.3 Install Dependencies

```bash
npm install
```

#### 1.4 Type Check

```bash
npm run build
```

#### 1.5 Deploy to Cloudflare Workers

```bash
wrangler deploy
```

**Expected Output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded web-installer-backend (X.XX sec)
Published web-installer-backend (X.XX sec)
  https://web-installer-backend.your-subdomain.workers.dev
```

#### 1.6 Verify Backend

```bash
# Test health endpoint
curl https://web-installer-backend.your-subdomain.workers.dev/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "web-installer",
  "version": "1.0.0",
  "timestamp": 1234567890
}
```

---

### Step 2: Frontend Deployment

#### 2.1 Configure Environment Variables

Create `frontend/.env.production`:

```bash
cd frontend
cp .env.example .env.production
```

Edit `.env.production` with your Worker URL:

```bash
# API Base URL (your deployed Worker URL)
VITE_API_BASE_URL=https://web-installer-backend.your-subdomain.workers.dev

# OAuth Redirect URI (will be your Pages URL)
VITE_OAUTH_REDIRECT_URI=https://crm-installer-frontend.pages.dev/oauth/callback

# Environment
VITE_ENVIRONMENT=production
```

#### 2.2 Install Dependencies

```bash
npm install
```

#### 2.3 Type Check

```bash
npm run type-check
```

#### 2.4 Build Production Bundle

```bash
npm run build
```

This creates an optimized production build in `dist/`.

#### 2.5 Deploy to Cloudflare Pages

```bash
wrangler pages deploy dist --project-name=crm-installer-frontend
```

**Expected Output:**
```
✨ Success! Uploaded X files (X.XX sec)

✨ Deployment complete! Take a peek over at
   https://xxxxxxxx.crm-installer-frontend.pages.dev
```

#### 2.6 Verify Frontend

Open your browser to:
```
https://crm-installer-frontend.pages.dev
```

You should see the landing page with the "Deploy to Cloudflare" button.

---

## Environment Configuration

### Backend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CF_CLIENT_ID` | ✅ Yes | Cloudflare OAuth Client ID | `abc123...` |
| `CF_CLIENT_SECRET` | ✅ Yes | Cloudflare OAuth Client Secret | `xyz789...` |
| `RESEND_API_KEY` | ✅ Yes | Resend Email API Key | `re_abc123...` |
| `FROM_EMAIL` | ⚠️ Optional | Sender email address | `installer@yourcompany.com` |
| `SUPPORT_EMAIL` | ⚠️ Optional | Support email address | `support@yourcompany.com` |
| `ENVIRONMENT` | ⚠️ Optional | Environment name | `production` |

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE_URL` | ✅ Yes | Backend Worker URL | `https://xxx.workers.dev` |
| `VITE_OAUTH_REDIRECT_URI` | ✅ Yes | OAuth callback URL | `https://xxx.pages.dev/oauth/callback` |
| `VITE_ENVIRONMENT` | ⚠️ Optional | Environment name | `production` |

---

## Verification & Testing

### 1. Backend Health Check

```bash
curl https://your-worker-url.workers.dev/health
```

✅ **Expected:** 200 OK with JSON response

### 2. OAuth Authorization Flow

```bash
curl "https://your-worker-url.workers.dev/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback"
```

✅ **Expected:** JSON with `authorizationUrl`, `state`, and `codeVerifier`

### 3. Frontend Loading

Open: `https://your-pages-url.pages.dev`

✅ **Expected:**
- Landing page loads
- No console errors
- "Deploy to Cloudflare" button visible

### 4. Full OAuth Flow Test

1. Click "Deploy to Cloudflare" on frontend
2. ✅ Redirects to Cloudflare OAuth page
3. Authorize the application
4. ✅ Redirects back to callback page
5. ✅ Successfully exchanges token
6. ✅ Redirects to configuration form

### 5. Monitor Logs

**Backend Logs:**
```bash
cd backend
wrangler tail
```

**Frontend Console:**
Open browser DevTools → Console tab

---

## Troubleshooting

### Error: "Wrangler is not installed"

**Solution:**
```bash
npm install -g wrangler
```

### Error: "Not logged in to Cloudflare"

**Solution:**
```bash
wrangler login
```

Follow the OAuth flow to authenticate.

### Error: "Failed to deploy Worker"

**Possible Causes:**
1. Invalid `wrangler.toml` configuration
2. Missing required bindings (Durable Objects)
3. Syntax errors in code

**Solution:**
```bash
# Check configuration
cat wrangler.toml

# Type check
npm run build

# Check logs
wrangler tail
```

### Error: "Failed to deploy Pages"

**Possible Causes:**
1. Build failed
2. Invalid project name
3. Missing dist directory

**Solution:**
```bash
# Check build output
npm run build

# Verify dist exists
ls -la dist/

# Try manual deployment
wrangler pages deploy dist --project-name=your-project-name
```

### Error: "OAuth redirect_uri_mismatch"

**Cause:** Redirect URI in OAuth request doesn't match configured URIs

**Solution:**
1. Go to Cloudflare Dashboard → My Profile → API Tokens → OAuth Applications
2. Edit your application
3. Add the exact redirect URI:
   ```
   https://your-actual-pages-url.pages.dev/oauth/callback
   ```
4. No trailing slashes!

### Error: "CORS error in browser"

**Cause:** CORS headers not configured properly

**Solution:**
Check `backend/src/index.ts` CORS configuration:
```typescript
app.use('*', cors({
  origin: (origin) => {
    if (origin.includes('localhost')) return origin;
    if (origin.includes('.pages.dev')) return origin;
    return origin;
  }
}));
```

---

## Production Checklist

Before going live, verify:

### Security

- [ ] OAuth secrets are set via `wrangler secret put` (not in code)
- [ ] `.dev.vars` and `.env` files are in `.gitignore`
- [ ] HTTPS is enforced (automatic with Cloudflare)
- [ ] CORS origins are restricted to your domains
- [ ] OAuth application has minimal required scopes

### Configuration

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Environment variables updated with production URLs
- [ ] OAuth redirect URIs include production Pages URL
- [ ] Resend API key is valid and has sufficient quota
- [ ] Email addresses (FROM_EMAIL, SUPPORT_EMAIL) are correct

### Testing

- [ ] Health endpoint returns 200 OK
- [ ] OAuth flow completes successfully
- [ ] Can start a test deployment
- [ ] SSE events stream correctly
- [ ] Receives deployment completion email
- [ ] No errors in browser console
- [ ] No errors in Worker logs (`wrangler tail`)

### Monitoring

- [ ] Set up Cloudflare Analytics
- [ ] Configure email alerts for errors
- [ ] Set up uptime monitoring (optional)
- [ ] Review Worker logs regularly

### Documentation

- [ ] Document your production URLs
- [ ] Save OAuth credentials securely (password manager)
- [ ] Document custom domain setup (if applicable)
- [ ] Create runbook for common issues

---

## Custom Domain Setup (Optional)

### For Frontend (Pages)

1. **Add domain in Cloudflare Dashboard:**
   - Pages → Your Project → Custom domains
   - Add your domain (e.g., `installer.yourcompany.com`)
   - Wait for DNS propagation (usually < 5 minutes)

2. **Update OAuth Redirect URI:**
   - Add: `https://installer.yourcompany.com/oauth/callback`

3. **Update Frontend .env.production:**
   ```bash
   VITE_OAUTH_REDIRECT_URI=https://installer.yourcompany.com/oauth/callback
   ```

4. **Redeploy Frontend:**
   ```bash
   npm run build
   wrangler pages deploy dist
   ```

### For Backend (Worker)

1. **Add route in Cloudflare Dashboard:**
   - Workers → Your Worker → Settings → Triggers
   - Add Custom Domain
   - Enter: `api.yourcompany.com`

2. **Update Frontend .env.production:**
   ```bash
   VITE_API_BASE_URL=https://api.yourcompany.com
   ```

3. **Redeploy Frontend**

---

## Rollback Procedure

If deployment fails or has issues:

### Rollback Backend

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback <deployment-id>
```

### Rollback Frontend

```bash
# View deployments
wrangler pages deployment list --project-name=crm-installer-frontend

# Rollback to specific deployment
wrangler pages deployment promote <deployment-id>
```

---

## Maintenance

### Update Dependencies

**Backend:**
```bash
cd backend
npm update
npm audit fix
```

**Frontend:**
```bash
cd frontend
npm update
npm audit fix
```

### Rotate Secrets

Every 90 days:

```bash
# Generate new OAuth application
# Update secrets
wrangler secret put CF_CLIENT_ID
wrangler secret put CF_CLIENT_SECRET

# Test deployment
# Deprecate old OAuth application
```

---

## Support

- **Documentation:** See [README.md](./README.md)
- **OAuth Setup:** See [CLOUDFLARE_OAUTH_SETUP.md](./CLOUDFLARE_OAUTH_SETUP.md)
- **Issues:** [GitHub Issues](https://github.com/yourcompany/crm/issues)
- **Community:** [Discord](https://discord.gg/yourcompany)

---

## Next Steps

After successful deployment:

1. ✅ Share installer URL with customers
2. ✅ Monitor first few deployments
3. ✅ Collect user feedback
4. ✅ Iterate and improve
5. ✅ Set up analytics and tracking

🎉 **Congratulations! Your Web Installer is live!**
