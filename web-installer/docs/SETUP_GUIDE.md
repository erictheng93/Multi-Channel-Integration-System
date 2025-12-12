# Web Installer - Complete Setup Guide

Step-by-step guide to set up and deploy the Multi-Channel CRM Web Installer from scratch.

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Initial Setup](#initial-setup)
4. [Cloudflare Configuration](#cloudflare-configuration)
5. [Backend Setup](#backend-setup)
6. [Frontend Setup](#frontend-setup)
7. [Local Development](#local-development)
8. [Production Deployment](#production-deployment)
9. [Post-Deployment](#post-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Web Installer allows customers to deploy the Multi-Channel CRM system to their own Cloudflare accounts with zero technical knowledge. It consists of:

- **Backend**: Cloudflare Worker that orchestrates deployment
- **Frontend**: Vue 3 application hosted on Cloudflare Pages
- **Services**: Integration with Cloudflare APIs and email service

**Total Setup Time**: ~30 minutes

---

## System Requirements

### Required Software

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** >= 2.30.0

Check your versions:
```bash
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 9.0.0
git --version   # Should be >= 2.30.0
```

### Install Wrangler CLI

```bash
npm install -g wrangler

# Verify installation
wrangler --version  # Should be >= 3.0.0
```

### Cloudflare Account

You need a Cloudflare account with:
- ✅ Workers enabled (free tier available)
- ✅ Pages enabled (free tier available)
- ✅ Ability to create OAuth applications

---

## Initial Setup

### Step 1: Clone Repository

```bash
# If you don't have the code yet
git clone <repository-url>
cd Multi_Channel_Integration_System/web-installer
```

### Step 2: Install Dependencies

**Backend:**
```bash
cd backend
npm install
cd ..
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### Step 3: Verify Installation

```bash
# Check backend
cd backend
npm run build  # Should complete without errors
cd ..

# Check frontend
cd frontend
npm run type-check  # Should complete without errors
cd ..
```

---

## Cloudflare Configuration

### Step 1: Login to Wrangler

```bash
wrangler login
```

This opens a browser window for authentication. Authorize Wrangler to access your account.

### Step 2: Create OAuth Application

Follow the detailed guide: [CLOUDFLARE_OAUTH_SETUP.md](./CLOUDFLARE_OAUTH_SETUP.md)

**Quick Steps:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Scroll to "OAuth Applications"
3. Click "Create Application"
4. Fill in details:
   - Name: `CRM Web Installer`
   - Redirect URIs:
     - `http://localhost:3000/oauth/callback` (for development)
     - `https://your-pages-url.pages.dev/oauth/callback` (for production)
   - Scopes: Account:Read, Workers:Write, D1:Write, KV:Write, R2:Write, Queues:Write, Pages:Write
5. Save and copy **Client ID** and **Client Secret**

### Step 3: Get Resend API Key

1. Sign up at: https://resend.com
2. Navigate to "API Keys"
3. Create new key: Name it "CRM Installer", Full Access
4. Copy the API key (starts with `re_`)

---

## Backend Setup

### Step 1: Configure Environment Variables

```bash
cd backend

# Copy template
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:
```bash
# Cloudflare OAuth Credentials
CF_CLIENT_ID=<your_client_id>
CF_CLIENT_SECRET=<your_client_secret>

# Resend Email API
RESEND_API_KEY=<your_resend_api_key>

# Email Configuration
FROM_EMAIL=installer@yourcompany.com
SUPPORT_EMAIL=support@yourcompany.com

# Environment
ENVIRONMENT=development
```

### Step 2: Set Production Secrets

These secrets are encrypted and stored securely by Cloudflare:

```bash
# Set OAuth credentials
wrangler secret put CF_CLIENT_ID
# Paste your Client ID when prompted

wrangler secret put CF_CLIENT_SECRET
# Paste your Client Secret when prompted

# Set email API key
wrangler secret put RESEND_API_KEY
# Paste your Resend API key when prompted

# Optional: Set custom emails
wrangler secret put FROM_EMAIL
wrangler secret put SUPPORT_EMAIL
```

### Step 3: Test Backend Locally

```bash
# Start development server
npm run dev

# In another terminal, test health endpoint
curl http://localhost:8787/health
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

## Frontend Setup

### Step 1: Configure Environment Variables

```bash
cd frontend

# Copy template
cp .env.example .env
```

Edit `.env`:
```bash
# API Base URL (empty for local development - uses proxy)
VITE_API_BASE_URL=

# OAuth Redirect URI
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback

# Environment
VITE_ENVIRONMENT=development
```

### Step 2: Test Frontend Locally

```bash
# Start development server
npm run dev
```

Open browser to: http://localhost:3000

You should see the landing page with:
- ✅ Hero section
- ✅ Features grid
- ✅ "Deploy to Cloudflare" button

### Step 3: Test OAuth Flow (Local)

1. Click "Deploy to Cloudflare" button
2. Should redirect to Cloudflare OAuth page
3. Authorize the application
4. Should redirect back to `http://localhost:3000/oauth/callback`
5. Should show configuration form

**If OAuth fails:** Check that `http://localhost:3000/oauth/callback` is in your OAuth app's redirect URIs

---

## Local Development

### Running Both Backend and Frontend

**Terminal 1 - Backend:**
```bash
cd web-installer/backend
npm run dev
# Backend running on http://localhost:8787
```

**Terminal 2 - Frontend:**
```bash
cd web-installer/frontend
npm run dev
# Frontend running on http://localhost:3000
```

### Development Workflow

1. **Make Changes** to backend or frontend code
2. **Hot Reload** automatically updates the application
3. **Test Changes** in browser
4. **Check Logs**:
   - Backend: See terminal 1 output
   - Frontend: See browser console

### Common Development Tasks

**Type Check:**
```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run type-check
```

**Linting:**
```bash
# Frontend (if ESLint configured)
cd frontend && npm run lint
```

---

## Production Deployment

### Option 1: Automated Deployment (Recommended)

**Linux/macOS:**
```bash
chmod +x deploy-all.sh
./deploy-all.sh
```

**Windows:**
```batch
deploy-all.bat
```

This script will:
1. ✅ Deploy backend Worker
2. ✅ Deploy frontend Pages
3. ✅ Update configuration
4. ✅ Provide testing instructions

### Option 2: Manual Deployment

**Deploy Backend:**
```bash
cd backend
chmod +x deploy.sh
./deploy.sh
```

Note your Worker URL (e.g., `https://web-installer-backend.xxx.workers.dev`)

**Deploy Frontend:**
```bash
cd frontend

# Update .env.production with Worker URL
cat > .env.production << EOF
VITE_API_BASE_URL=https://web-installer-backend.xxx.workers.dev
VITE_OAUTH_REDIRECT_URI=https://crm-installer-frontend.pages.dev/oauth/callback
VITE_ENVIRONMENT=production
EOF

# Deploy
chmod +x deploy.sh
./deploy.sh
```

---

## Post-Deployment

### Step 1: Update OAuth Redirect URIs

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Edit your "CRM Web Installer" OAuth application
3. Add production redirect URI:
   ```
   https://crm-installer-frontend.pages.dev/oauth/callback
   ```
4. Save changes

### Step 2: Test Production Deployment

Run the test script:
```bash
chmod +x test-deployment.sh
./test-deployment.sh
```

Enter your production URLs when prompted.

**Expected:**
- ✅ All 8 tests pass
- ✅ Backend health check OK
- ✅ Frontend loads correctly
- ✅ Integration working

### Step 3: Monitor Health

Start continuous monitoring:
```bash
chmod +x monitor-health.sh
./monitor-health.sh <backend-url> <frontend-url>
```

Press Ctrl+C to stop.

### Step 4: Set Up Custom Domain (Optional)

**For Frontend:**
1. Cloudflare Dashboard → Pages → Your Project → Custom Domains
2. Add domain: `installer.yourcompany.com`
3. Update OAuth redirect URI
4. Update `.env.production` and redeploy

**For Backend:**
1. Cloudflare Dashboard → Workers → Your Worker → Triggers
2. Add Custom Domain: `api.yourcompany.com`
3. Update `.env.production` and redeploy frontend

---

## Troubleshooting

### Issue: "Wrangler command not found"

**Solution:**
```bash
npm install -g wrangler
```

### Issue: "Not logged in to Cloudflare"

**Solution:**
```bash
wrangler login
```

### Issue: OAuth "redirect_uri_mismatch" Error

**Cause:** Redirect URI doesn't match OAuth app configuration

**Solution:**
1. Check your OAuth app redirect URIs
2. Make sure they exactly match (no trailing slashes)
3. Verify protocol (http vs https)
4. Verify port for localhost

### Issue: CORS Errors in Browser

**Cause:** Backend CORS configuration

**Solution:**
Check `backend/src/index.ts` CORS settings include your frontend URL.

### Issue: "Failed to deploy Worker"

**Possible Causes:**
1. Invalid `wrangler.toml`
2. Missing secrets
3. Syntax errors

**Solution:**
```bash
# Verify configuration
cd backend
npm run build

# Check secrets are set
wrangler secret list

# View logs
wrangler tail
```

### Issue: Frontend Build Fails

**Solution:**
```bash
cd frontend

# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

### Issue: SSE Events Not Received

**Possible Causes:**
1. Cloudflare proxy buffering
2. Browser blocking

**Solution:**
1. Check browser console for errors
2. Verify WebSocket/SSE not blocked by firewall
3. Test with `curl`:
   ```bash
   curl -N https://backend-url/deployment/test/events
   ```

---

## Next Steps

After successful setup:

1. ✅ **Test Complete Flow**:
   - Start deployment
   - Monitor progress
   - Verify success page
   - Check email notification

2. ✅ **Share with Users**:
   - Provide installer URL
   - Document requirements
   - Create user guide

3. ✅ **Monitor Usage**:
   - Check Cloudflare Analytics
   - Review Worker logs
   - Monitor email delivery

4. ✅ **Iterate**:
   - Collect user feedback
   - Fix issues
   - Add features

---

## Support Resources

- **OAuth Setup**: [CLOUDFLARE_OAUTH_SETUP.md](./CLOUDFLARE_OAUTH_SETUP.md)
- **Deployment Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Backend README**: [backend/README.md](./backend/README.md)
- **Cloudflare Docs**: https://developers.cloudflare.com
- **Discord Community**: https://discord.gg/yourcompany
- **GitHub Issues**: https://github.com/yourcompany/crm/issues

---

## Checklist

Use this checklist to track your progress:

### Initial Setup
- [ ] Node.js, npm, and Git installed
- [ ] Wrangler CLI installed
- [ ] Repository cloned
- [ ] Dependencies installed (backend + frontend)

### Cloudflare Configuration
- [ ] Logged in with `wrangler login`
- [ ] OAuth application created
- [ ] Client ID and Secret saved
- [ ] Resend account created
- [ ] Resend API key obtained

### Backend Setup
- [ ] `.dev.vars` configured
- [ ] Production secrets set via Wrangler
- [ ] Local development tested
- [ ] Health endpoint working

### Frontend Setup
- [ ] `.env` configured
- [ ] Local development tested
- [ ] OAuth flow tested locally
- [ ] Configuration form working

### Production Deployment
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] OAuth redirect URIs updated
- [ ] Test script passed
- [ ] Health monitoring started

### Optional
- [ ] Custom domains configured
- [ ] Monitoring alerts set up
- [ ] Documentation updated
- [ ] User guide created

---

🎉 **Congratulations!** You've successfully set up the Web Installer!
