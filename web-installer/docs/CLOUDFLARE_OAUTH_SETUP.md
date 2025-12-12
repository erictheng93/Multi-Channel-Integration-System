# Cloudflare OAuth Application Setup Guide

This guide walks you through creating a Cloudflare OAuth Application for the Web Installer.

## Prerequisites

- A Cloudflare account (free or paid)
- Access to Cloudflare Dashboard
- Admin permissions on your account

## Step 1: Navigate to OAuth Applications

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on your **profile icon** in the top right
3. Select **"My Profile"**
4. In the left sidebar, click **"API Tokens"**
5. Scroll down to the **"OAuth Applications"** section
6. Click **"Create Application"**

## Step 2: Create New OAuth Application

Fill in the application details:

### Application Name
```
CRM Web Installer
```

### Redirect URIs

Add these redirect URIs (one per line):

**For Local Development:**
```
http://localhost:3000/oauth/callback
```

**For Production:**
```
https://your-installer-frontend.pages.dev/oauth/callback
```

Replace `your-installer-frontend` with your actual Cloudflare Pages project name.

### Required Scopes

Select the following scopes for the Web Installer to function properly:

- ✅ **Account:Read** - Read account information
- ✅ **Workers:Write** - Deploy Workers
- ✅ **D1:Write** - Create and manage D1 databases
- ✅ **KV:Write** - Create and manage KV namespaces
- ✅ **R2:Write** - Create and manage R2 buckets
- ✅ **Queues:Write** - Create and manage Queues
- ✅ **Pages:Write** - Deploy Pages projects

### Client Type
Select: **Public Client** (for browser-based applications)

## Step 3: Save and Retrieve Credentials

1. Click **"Create Application"**
2. You'll be presented with:
   - **Client ID** - Copy this immediately
   - **Client Secret** - Copy this immediately (you won't see it again!)

## Step 4: Configure Backend Environment Variables

### For Local Development

Create or update `web-installer/backend/.dev.vars`:

```bash
# Cloudflare OAuth Credentials
CF_CLIENT_ID=your_client_id_here
CF_CLIENT_SECRET=your_client_secret_here

# Resend Email API (Get from: https://resend.com/api-keys)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email Configuration
FROM_EMAIL=installer@yourcompany.com
SUPPORT_EMAIL=support@yourcompany.com

# Environment
ENVIRONMENT=development
```

### For Production Deployment

Set secrets using Wrangler CLI:

```bash
cd web-installer/backend

# Set OAuth credentials
wrangler secret put CF_CLIENT_ID
# Enter your Client ID when prompted

wrangler secret put CF_CLIENT_SECRET
# Enter your Client Secret when prompted

# Set email API key
wrangler secret put RESEND_API_KEY
# Enter your Resend API key when prompted

# Optional: Set custom email addresses
wrangler secret put FROM_EMAIL
# Enter: installer@yourcompany.com

wrangler secret put SUPPORT_EMAIL
# Enter: support@yourcompany.com
```

## Step 5: Configure Frontend Environment Variables

### For Local Development

Create `web-installer/frontend/.env`:

```bash
# API Base URL (empty for local proxy)
VITE_API_BASE_URL=

# OAuth Redirect URI
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback

# Environment
VITE_ENVIRONMENT=development
```

### For Production

Create `web-installer/frontend/.env.production`:

```bash
# API Base URL (your deployed Worker URL)
VITE_API_BASE_URL=https://crm-installer-backend.your-account.workers.dev

# OAuth Redirect URI (your deployed Pages URL)
VITE_OAUTH_REDIRECT_URI=https://your-installer-frontend.pages.dev/oauth/callback

# Environment
VITE_ENVIRONMENT=production
```

## Step 6: Get Resend API Key

The Web Installer sends email notifications with deployment credentials.

1. Sign up at [Resend.com](https://resend.com)
2. Navigate to **API Keys**
3. Click **"Create API Key"**
4. Name it: `CRM Installer`
5. Select scope: **Full Access**
6. Copy the API key (starts with `re_`)
7. Add it to your environment variables (see Step 4)

## Step 7: Verify Configuration

### Test Backend Configuration

```bash
cd web-installer/backend

# Start local development server
npm run dev

# In another terminal, test health endpoint
curl http://localhost:8787/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "web-installer",
  "version": "1.0.0",
  "timestamp": 1234567890
}
```

### Test Frontend Configuration

```bash
cd web-installer/frontend

# Start local development server
npm run dev

# Open browser to http://localhost:3000
# Click "Deploy to Cloudflare" button
# Should redirect to Cloudflare OAuth page
```

## Step 8: Update Production URLs

After deploying to production, update these URLs:

### In Cloudflare OAuth Application
1. Go back to Cloudflare Dashboard → My Profile → API Tokens → OAuth Applications
2. Click on your **"CRM Web Installer"** application
3. Add production redirect URI:
   ```
   https://your-actual-pages-url.pages.dev/oauth/callback
   ```

### In Frontend .env.production
Update `VITE_OAUTH_REDIRECT_URI` with your actual Pages URL.

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause:** The redirect URI in your OAuth request doesn't match any URIs configured in the OAuth application.

**Solution:**
1. Check that the redirect URI in `.env` exactly matches one in your OAuth app
2. Make sure there are no trailing slashes
3. Protocol must match (http vs https)
4. Port must match for localhost

### Error: "invalid_client"

**Cause:** Client ID or Client Secret is incorrect.

**Solution:**
1. Double-check your Client ID and Secret
2. Make sure there are no extra spaces
3. If you lost the Client Secret, create a new OAuth application

### Error: "insufficient_scope"

**Cause:** The OAuth application doesn't have required scopes.

**Solution:**
1. Edit your OAuth application in Cloudflare Dashboard
2. Add all required scopes listed in Step 2
3. Save changes
4. Try authorization again

## Security Best Practices

1. ✅ **Never commit** `.dev.vars` or `.env` files to Git
2. ✅ **Use different** OAuth applications for development and production
3. ✅ **Rotate secrets** regularly (every 90 days recommended)
4. ✅ **Limit redirect URIs** to only what's needed
5. ✅ **Use HTTPS** in production (Cloudflare Pages provides this automatically)
6. ✅ **Monitor usage** in Cloudflare Dashboard → Analytics

## Next Steps

After completing this setup:

1. ✅ Test OAuth flow locally
2. ✅ Deploy backend to Cloudflare Workers
3. ✅ Deploy frontend to Cloudflare Pages
4. ✅ Update production OAuth redirect URIs
5. ✅ Test end-to-end deployment flow

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment instructions.

## Support

- **Documentation:** [Cloudflare OAuth Docs](https://developers.cloudflare.com/api/tokens/oauth/)
- **Issues:** [GitHub Issues](https://github.com/yourcompany/crm/issues)
- **Discord:** [Community Discord](https://discord.gg/yourcompany)
