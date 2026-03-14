#  Web Installer Deployment Checklist

Use this checklist to ensure a successful production deployment of the Web Installer.

---

## Pre-Deployment Checklist

### 1. Cloudflare Account Setup

- [ ] Create or use existing Cloudflare account
- [ ] Verify account email
- [ ] Enable 2FA on account (recommended)
- [ ] Note your Account ID (found in Workers & Pages → Overview)

### 2. OAuth Application Setup

- [ ] Go to Cloudflare Dashboard → My Profile → API Tokens → OAuth Applications
- [ ] Create new OAuth Application:
  - **Name:** "CRM Web Installer Production"
  - **Redirect URIs:**
    - `https://installer.yourdomain.com/oauth/callback`
    - `http://localhost:3000/oauth/callback` (for testing)
  - **Scopes:** All Workers, D1, KV, R2, Queues, Pages
- [ ] Save Client ID
- [ ] Save Client Secret (shown only once!)

### 3. Email Service Setup (Resend)

- [ ] Sign up for Resend account: https://resend.com
- [ ] Verify your domain
- [ ] Create API key
- [ ] Test sending an email
- [ ] Note API key for deployment

### 4. Domain Setup (Optional)

- [ ] Purchase domain or use existing
- [ ] Add domain to Cloudflare (if not already)
- [ ] Note domain name for configuration

---

## Backend Deployment

### 5. Prepare Backend Code

```bash
cd web-installer/backend

# Install dependencies
npm install

# Run tests
npm test

# Verify type checking
npm run type-check
```

- [ ] All tests passing (28/28)
- [ ] No TypeScript errors
- [ ] Code coverage ≥ 90%

### 6. Configure Backend Secrets

```bash
# Set production secrets
wrangler secret put CF_CLIENT_ID
# Paste your OAuth Client ID

wrangler secret put CF_CLIENT_SECRET
# Paste your OAuth Client Secret

wrangler secret put RESEND_API_KEY
# Paste your Resend API key
```

- [ ] CF_CLIENT_ID set
- [ ] CF_CLIENT_SECRET set
- [ ] RESEND_API_KEY set

### 7. Update wrangler.toml

```toml
name = "crm-installer-backend-prod"
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
FROM_EMAIL = "installer@yourdomain.com"
SUPPORT_EMAIL = "support@yourdomain.com"

[routes]
pattern = "installer-api.yourdomain.com/*"
custom_domain = true
```

- [ ] Updated name to production name
- [ ] Set ENVIRONMENT to "production"
- [ ] Configured FROM_EMAIL
- [ ] Configured SUPPORT_EMAIL
- [ ] Updated custom_domain (if using)

### 8. Deploy Backend

```bash
# Deploy to production
wrangler deploy

# Verify deployment
curl https://crm-installer-backend-prod.your-account.workers.dev/health
```

- [ ] Deployment successful
- [ ] Health check returns 200 OK
- [ ] Worker URL noted

---

## Frontend Deployment

### 9. Prepare Frontend Code

```bash
cd web-installer/frontend

# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build
```

- [ ] All tests passing
- [ ] Build successful
- [ ] No build errors or warnings

### 10. Configure Frontend Environment

Create `.env.production`:

```bash
VITE_API_BASE_URL=https://crm-installer-backend-prod.your-account.workers.dev
VITE_CF_OAUTH_CLIENT_ID=your_production_client_id
VITE_CF_OAUTH_REDIRECT_URI=https://installer.yourdomain.com/oauth/callback
VITE_INSTALLER_VERSION=1.0.0
```

- [ ] VITE_API_BASE_URL set to production Worker URL
- [ ] VITE_CF_OAUTH_CLIENT_ID set
- [ ] VITE_CF_OAUTH_REDIRECT_URI matches OAuth app config
- [ ] VITE_INSTALLER_VERSION set

### 11. Deploy Frontend to Pages

```bash
# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=crm-installer-frontend

# Or create Pages project first in dashboard
# Then deploy
npx wrangler pages deploy dist
```

- [ ] Deployment successful
- [ ] Pages URL noted (e.g., `crm-installer-frontend.pages.dev`)
- [ ] Site accessible

### 12. Configure Custom Domain (Optional)

**In Cloudflare Dashboard:**

1. Pages → crm-installer-frontend → Custom domains
2. Add custom domain: `installer.yourdomain.com`
3. Wait for DNS propagation (1-5 minutes)

**DNS Record:**
```
Type: CNAME
Name: installer
Target: crm-installer-frontend.pages.dev
```

- [ ] Custom domain added
- [ ] DNS record created
- [ ] SSL certificate issued
- [ ] Domain accessible

---

## Post-Deployment Verification

### 13. End-to-End Testing

Test the complete flow:

- [ ] Visit landing page
- [ ] Click "Deploy to Cloudflare"
- [ ] OAuth redirect works
- [ ] OAuth callback successful
- [ ] Configuration form loads
- [ ] Form validation works
- [ ] Can submit deployment (use test account)
- [ ] Progress page shows updates
- [ ] Deployment completes successfully
- [ ] Success page shows credentials
- [ ] Email notification received

### 14. Error Handling Testing

- [ ] Test invalid OAuth state
- [ ] Test cancelled OAuth
- [ ] Test invalid project name
- [ ] Test invalid email
- [ ] Test deployment failure
- [ ] Rollback works correctly
- [ ] Error messages are user-friendly

### 15. Performance Testing

```bash
# Load test OAuth endpoint
npx autocannon -c 50 -d 30 https://installer-api.yourdomain.com/api/oauth/authorize

# Load test status endpoint
npx autocannon -c 100 -d 30 https://installer-api.yourdomain.com/api/deploy/status/test-id
```

- [ ] OAuth endpoint < 200ms average
- [ ] Status endpoint < 100ms average
- [ ] No errors under load

### 16. Security Verification

- [ ] HTTPS enforced (no HTTP)
- [ ] CORS configured correctly
- [ ] OAuth state validation working
- [ ] Input validation on all fields
- [ ] No sensitive data in logs
- [ ] Secrets not exposed in responses

---

## Monitoring Setup

### 17. Cloudflare Analytics

- [ ] Enable Workers Analytics
- [ ] Enable Pages Analytics
- [ ] Set up email alerts for errors
- [ ] Create dashboard for key metrics

### 18. Error Tracking

- [ ] Integrate Sentry (optional)
- [ ] Configure error reporting
- [ ] Test error notifications

### 19. Uptime Monitoring

- [ ] Set up UptimeRobot or similar
- [ ] Monitor frontend URL
- [ ] Monitor backend health endpoint
- [ ] Configure alert emails

---

## Documentation Updates

### 20. Update Documentation

- [ ] Update README with production URLs
- [ ] Update API documentation
- [ ] Update deployment guide
- [ ] Add troubleshooting guide
- [ ] Document rollback procedure

### 21. User Documentation

- [ ] Create user guide
- [ ] Create video tutorial
- [ ] Update FAQ
- [ ] Prepare support materials

---

## Launch Communication

### 22. Internal Communication

- [ ] Notify team of deployment
- [ ] Share production URLs
- [ ] Review support procedures
- [ ] Schedule post-launch meeting

### 23. External Communication

- [ ] Announce to users (if applicable)
- [ ] Update website
- [ ] Publish blog post
- [ ] Social media announcement

---

## Post-Launch Monitoring (First 48 Hours)

### 24. Monitor Metrics

**Check every 4 hours:**

- [ ] Worker requests
- [ ] Error rate
- [ ] Deployment success rate
- [ ] Average deployment time
- [ ] User feedback

### 25. Quick Response Checklist

If issues occur:

- [ ] Check Worker logs: `wrangler tail`
- [ ] Check Durable Objects status
- [ ] Verify secrets are set correctly
- [ ] Check OAuth application status
- [ ] Review recent deployments in dashboard
- [ ] Prepare rollback if necessary

---

## Rollback Procedure (If Needed)

### Emergency Rollback

```bash
# Backend rollback
wrangler rollback --message "Rollback to previous version"

# Frontend rollback
# In Cloudflare Dashboard:
# Pages → crm-installer-frontend → Deployments
# Click "Rollback" on previous successful deployment
```

- [ ] Identify issue
- [ ] Document issue
- [ ] Execute rollback
- [ ] Verify rollback successful
- [ ] Notify stakeholders
- [ ] Plan hotfix

---

## Success Criteria

Deployment is considered successful when:

-  All checklist items completed
-  End-to-end flow working
-  Zero critical errors in first 24 hours
-  < 1% error rate
-  Average deployment time < 3 minutes
-  All monitoring alerts configured
-  Team trained on support procedures

---

## Deployment Sign-Off

**Deployed By:** _______________
**Date:** _______________
**Version:** _______________

**Backend URL:** _______________
**Frontend URL:** _______________

**Sign-Off:**
- [ ] Technical Lead
- [ ] DevOps Engineer
- [ ] Product Manager
- [ ] QA Engineer

---

**Notes:**
_Add any deployment-specific notes or issues here_

_______________________________________________
_______________________________________________
_______________________________________________

---

**Next Review Date:** _______________
