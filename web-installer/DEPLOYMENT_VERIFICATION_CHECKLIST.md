# Deployment Verification Checklist

**Purpose**: Quick checklist to verify Web Installer deployment was successful
**Time**: 15-20 minutes
**Use this after**: Completing a full deployment via Web Installer

---

## ??Quick Verification (5 minutes)

### 1. Cloudflare Resources Created

Log into Cloudflare Dashboard and verify:

**Workers & Pages**:
- [ ] Worker deployed: `{project-name}-worker`
  - URL: `https://{project-name}-worker.{account}.workers.dev`
  - Status: Active

- [ ] Pages deployed: `{project-name}-frontend`
  - URL: `https://{project-name}.pages.dev`
  - Status: Active
  - Build: Successful

**D1 Database**:
- [ ] Database created: `{project-name}-db`
- [ ] Tables count: 26+ tables
- [ ] Sample query works (SELECT COUNT(*) FROM teams)

**KV Namespaces**:
- [ ] Session namespace: `{project-name}-session`
- [ ] Cache namespace: `{project-name}-cache`

**R2 Storage**:
- [ ] Bucket created: `{project-name}-uploads`
- [ ] Bucket is empty (ready for uploads)

**Queues**:
- [ ] Queue created: `{project-name}-queue`
- [ ] Status: Active

---

## ?? Detailed Verification (10-15 minutes)

### 2. Generated Configuration Files

**Check `wrangler.toml`**:
- [ ] File exists in deployment package
- [ ] Worker name matches: `{project-name}-worker`
- [ ] All bindings present:
  - [ ] D1: `DB`
  - [ ] KV: `SESSION_KV`, `CACHE_KV`
  - [ ] R2: `FILE_STORAGE`
  - [ ] Queue: `MESSAGE_QUEUE`
  - [ ] Durable Objects: 5 bindings
- [ ] Environment variables section present
- [ ] **NO hardcoded domains** (verify no `example.com`)

**Check frontend `.env`**:
- [ ] `VITE_BACKEND_URL` set correctly
- [ ] `VITE_WEBSOCKET_URL` set correctly
- [ ] `VITE_FRONTEND_URL` set correctly
- [ ] `VITE_STORAGE_PUBLIC_URL` set correctly (if provided)
- [ ] `VITE_ENVIRONMENT=production`

### 3. Application Accessibility

**Frontend Access**:
- [ ] Navigate to Pages URL: `https://{project-name}.pages.dev`
- [ ] Page loads without errors
- [ ] No console errors (check DevTools)
- [ ] Login page displays

**Backend Access**:
- [ ] Test health endpoint: `https://{project-name}-worker.{account}.workers.dev/api/system/health`
- [ ] Returns 200 OK
- [ ] Response contains: `{ "status": "healthy", ... }`

### 4. Admin Login Test

**Credentials**:
- Check email for admin credentials
- Email should contain:
  - [ ] Admin username or email
  - [ ] Temporary admin password
  - [ ] Login URL

**Login Attempt**:
- [ ] Navigate to frontend URL
- [ ] Enter admin credentials
- [ ] Click Login
- [ ] **Expected**: Successful login, redirect to dashboard
- [ ] **Actual**: [Record result]

### 5. Database Verification

**Tables Created** (should have 26+ tables):
```sql
-- Run in D1 console or via Wrangler CLI
SELECT name FROM sqlite_master WHERE type='table';
```

**Expected tables** (partial list):
- [ ] `teams`
- [ ] `agents`
- [ ] `customers`
- [ ] `conversations`
- [ ] `messages`
- [ ] `channel_integrations`
- [ ] `tags`
- [ ] `file_attachments`
- [ ] `delayed_messages`
- [ ] (17 more tables)

**Initial Data**:
```sql
-- Check if admin user created
SELECT COUNT(*) FROM agents WHERE role = 'admin';
-- Expected: 1
```

### 6. Basic Functionality Test

**Create Test Team**:
- [ ] Navigate to Teams page
- [ ] Click "Create Team"
- [ ] Enter team name: "Test Team"
- [ ] Save
- [ ] **Expected**: Team created successfully
- [ ] **Actual**: [Record result]

**Create Test Agent**:
- [ ] Navigate to Agents page
- [ ] Click "Add Agent"
- [ ] Fill in agent details
- [ ] Assign to test team
- [ ] Save
- [ ] **Expected**: Agent created successfully
- [ ] **Actual**: [Record result]

**Create Test Conversation**:
- [ ] Navigate to Conversations
- [ ] Click "New Conversation"
- [ ] Enter customer info
- [ ] Save
- [ ] **Expected**: Conversation created
- [ ] **Actual**: [Record result]

---

## ?š¨ Common Issues & Quick Fixes

### Issue: Frontend shows 404

**Check**:
- [ ] Pages deployment status in Cloudflare
- [ ] Build logs for errors
- [ ] DNS propagation (if using custom domain)

**Fix**:
- Re-deploy Pages project
- Check `_routes.json` configuration

### Issue: Backend API returns 500

**Check**:
- [ ] Worker logs in Cloudflare Dashboard
- [ ] Environment variables set correctly
- [ ] D1 binding configured

**Fix**:
- Check Worker logs for specific error
- Verify bindings in `wrangler.toml`
- Re-deploy Worker if needed

### Issue: Admin login fails

**Check**:
- [ ] Credentials email received
- [ ] Database has admin user
- [ ] Session KV namespace accessible

**Fix**:
```sql
-- Check admin user in D1
SELECT * FROM agents WHERE role = 'admin';
```
- Reset admin password if needed
- Check JWT_SECRET environment variable

### Issue: Database tables missing

**Check**:
- [ ] Migrations ran successfully
- [ ] Deployment logs for migration errors

**Fix**:
```bash
# Re-run migrations manually
npx wrangler d1 migrations apply {project-name}-db
```

---

## ?? Verification Status Summary

### Overall Status

- [ ] ??All Cloudflare resources created
- [ ] ??Configuration files correct
- [ ] ??Application accessible
- [ ] ??Admin login works
- [ ] ??Database initialized
- [ ] ??Basic functionality works

**Deployment Status**: [PASS / FAIL / PARTIAL]

---

## ?? Quick Reference URLs

After deployment, record these URLs for easy access:

```
Frontend URL: https://{project-name}.pages.dev
Backend URL: https://{project-name}-worker.{account}.workers.dev
Health Check: https://{project-name}-worker.{account}.workers.dev/api/system/health

Cloudflare Dashboard:
- Workers: https://dash.cloudflare.com/{account-id}/workers/services/view/{project-name}-worker
- Pages: https://dash.cloudflare.com/{account-id}/pages/view/{project-name}-frontend
- D1: https://dash.cloudflare.com/{account-id}/d1
- KV: https://dash.cloudflare.com/{account-id}/kv/namespaces
- R2: https://dash.cloudflare.com/{account-id}/r2
```

---

## ?Ž¯ Next Steps

### If All Checks Pass ??

**Congratulations! Deployment successful.**

Next actions:
1. [ ] Change admin password from temporary to secure password
2. [ ] Configure LINE OA integration (if skipped during deployment)
3. [ ] Set up custom domain (if desired)
4. [ ] Invite team members
5. [ ] Begin using the system!

### If Some Checks Fail ? ï?

**Partial deployment - needs attention.**

Actions:
1. Document which checks failed
2. Review deployment logs
3. Check troubleshooting guide
4. Fix issues and re-verify
5. Contact support if needed

### If Most Checks Fail ??

**Deployment failed - troubleshooting needed.**

Actions:
1. Review full deployment logs
2. Check Cloudflare account permissions
3. Verify all credentials and tokens
4. Consider re-running deployment
5. Consult detailed troubleshooting guide

---

## ?? Support Resources

If you encounter issues:

1. **Check Logs**:
   - Cloudflare Worker logs
   - Pages build logs
   - Browser console logs

2. **Review Documentation**:
   - `TESTING_VALIDATION_GUIDE.md` - Comprehensive testing guide
   - `TROUBLESHOOTING_GUIDE.md` - Common issues and solutions
   - `PHASE1_COMPLETION_SUMMARY.md` - Implementation details

3. **Cloudflare Resources**:
   - [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
   - [D1 Documentation](https://developers.cloudflare.com/d1/)
   - [Pages Deployment](https://developers.cloudflare.com/pages/)

---

**Deployment Verified**: [??/ ? ï? / ?Œ]
**Verified By**: [Your Name]
**Date**: [Date]
**Notes**: [Any additional notes]
