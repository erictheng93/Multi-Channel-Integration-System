# Web Installer - Troubleshooting Guide

**Last Updated**: 2026-01-05
**Purpose**: Solutions for common Web Installer and deployment issues
**Target Audience**: Developers and system administrators

---

##  Table of Contents

1. [General Troubleshooting Approach](#general-troubleshooting-approach)
2. [Web Installer Issues](#web-installer-issues)
3. [OAuth Authentication Issues](#oauth-authentication-issues)
4. [Configuration & Validation Issues](#configuration--validation-issues)
5. [Deployment Issues](#deployment-issues)
6. [Resource Creation Issues](#resource-creation-issues)
7. [Post-Deployment Issues](#post-deployment-issues)
8. [LINE Integration Issues](#line-integration-issues)
9. [Performance Issues](#performance-issues)
10. [Browser-Specific Issues](#browser-specific-issues)

---

##  General Troubleshooting Approach

### Step-by-Step Debugging Process

1. **Identify the Problem**
   - What were you trying to do?
   - What did you expect to happen?
   - What actually happened?
   - When did it first occur?

2. **Gather Information**
   - Check browser console for errors (F12 → Console)
   - Check Network tab for failed requests (F12 → Network)
   - Check Cloudflare Worker logs
   - Note any error messages or codes

3. **Isolate the Issue**
   - Can you reproduce the problem?
   - Does it happen in different browsers?
   - Does it happen on different devices?
   - Does it happen for all users or just some?

4. **Search for Solutions**
   - Check this guide for similar issues
   - Search error messages in documentation
   - Check Cloudflare community forums

5. **Apply Fix and Verify**
   - Implement recommended solution
   - Test the fix thoroughly
   - Document what worked for future reference

### Essential Debugging Tools

**Browser DevTools (F12)**:
- **Console**: View JavaScript errors and logs
- **Network**: Monitor API requests and responses
- **Application**: Inspect cookies, local storage, session storage
- **Elements**: Inspect DOM and CSS

**Cloudflare Dashboard**:
- **Workers → View Worker**: Check logs and errors
- **Pages → Deployment**: View build logs
- **D1**: Run SQL queries, view tables
- **Analytics**: Monitor traffic and errors

**Command Line Tools**:
```bash
# View Worker logs in real-time
npx wrangler tail {worker-name}

# Test D1 database
npx wrangler d1 execute {database-name} --command "SELECT * FROM teams"

# Check deployment status
npx wrangler deployments list
```

---

##  Web Installer Issues

### Issue: Web Installer Page Won't Load

**Symptoms**:
- Blank white page
- "Cannot GET /" error
- Infinite loading spinner

**Possible Causes**:
1. Backend server not running
2. Frontend server not running
3. Port already in use
4. Build errors

**Solutions**:

**Check Backend Status**:
```bash
cd web-installer/backend
npm run dev
# Should show: Server started on http://localhost:8787
```

**Check Frontend Status**:
```bash
cd web-installer/frontend
npm run dev
# Should show: Local: http://localhost:3000
```

**Fix Port Conflict**:
```bash
# Windows: Find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux: Find and kill process
lsof -ti:3000 | xargs kill -9
```

**Clear Build Cache**:
```bash
# Frontend
cd web-installer/frontend
rm -rf node_modules .vite dist
npm install
npm run dev
```

### Issue: "Module not found" Errors

**Symptoms**:
- Import errors in console
- Components not rendering
- TypeScript errors

**Solutions**:

**Reinstall Dependencies**:
```bash
# Backend
cd web-installer/backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd web-installer/frontend
rm -rf node_modules package-lock.json
npm install
```

**Check Node Version**:
```bash
node --version
# Should be 18.x or higher
```

**Verify Package.json**:
- Check that all required dependencies are listed
- Run `npm audit fix` to fix vulnerabilities

---

##  OAuth Authentication Issues

### Issue: OAuth Login Fails

**Symptoms**:
- Redirects to error page
- "Invalid OAuth token" error
- Authentication loop (keeps redirecting)

**Solutions**:

**Check Cloudflare OAuth App Configuration**:
1. Go to Cloudflare Dashboard → API Tokens
2. Verify OAuth app is configured correctly
3. Check redirect URLs match:
   ```
   http://localhost:3000/auth/callback  (development)
   https://your-domain.com/auth/callback  (production)
   ```

**Clear Browser Cookies**:
```javascript
// In browser console
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "")
    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
```

**Check Environment Variables**:
```bash
# Backend .dev.vars should have:
CLOUDFLARE_CLIENT_ID=your-client-id
CLOUDFLARE_CLIENT_SECRET=your-client-secret
CLOUDFLARE_REDIRECT_URI=http://localhost:3000/auth/callback
```

### Issue: OAuth Callback Fails

**Symptoms**:
- Error: "Code parameter missing"
- Error: "State mismatch"
- Redirect to frontend but no user data

**Solutions**:

**Verify State Parameter**:
- Clear browser session storage
- Try login again
- If persists, check session middleware in backend

**Check CORS Configuration**:
```typescript
// In backend index.ts
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  credentials: true
}));
```

---

##  Configuration & Validation Issues

### Issue: Form Validation Not Working

**Symptoms**:
- Valid input shows error
- Invalid input accepted
- Error messages not appearing

**Solutions**:

**Check Validation Logic**:
1. Open browser DevTools → Console
2. Look for JavaScript errors
3. Verify validation patterns in `ConfigForm.vue`

**Test Validation Patterns**:
```javascript
// In browser console
const projectName = "test-crm";
console.log(/^[a-z0-9-]+$/.test(projectName)); // Should be true

const email = "admin@example.com";
console.log(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)); // Should be true
```

**Clear Form State**:
- Refresh page
- Clear browser cache
- Try in incognito mode

### Issue: Smart Suggestions Not Appearing

**Symptoms**:
- No suggestion boxes show up
- "Use Suggestion" button doesn't work
- Suggestions show wrong values

**Solutions**:

**Verify Custom Domain Input**:
- Make sure you entered domain without protocol
- Correct: `crm.example.com`
- Wrong: `https://crm.example.com`

**Check Computed Properties**:
1. Open Vue DevTools
2. Navigate to ConfigForm component
3. Check computed values:
   - `suggestedFrontendUrl`
   - `suggestedBackendUrl`
   - `suggestedR2Url`

**Debug in Console**:
```javascript
// Check Vue instance
const app = document.querySelector('#app').__vueParentComponent;
console.log(app.ctx.suggestedFrontendUrl);
```

### Issue: Character Counter Not Updating

**Symptoms**:
- Counter stuck at 0
- Counter doesn't turn red/orange
- Counter shows wrong count

**Solutions**:

**Check Reactivity**:
- Verify `v-model` bindings in template
- Check if `formData` is reactive (uses `ref()`)

**Force Update**:
```javascript
// In browser console
location.reload();
```

---

##  Deployment Issues

### Issue: Deployment Fails at Worker Creation

**Symptoms**:
- Error: "Failed to create Worker"
- Error: "Worker name already exists"
- Deployment stops at step 1

**Solutions**:

**Check Worker Name**:
- Worker names must be unique within account
- Try different project name
- Check existing workers in Cloudflare Dashboard

**Verify API Token Permissions**:
Required permissions:
- Workers Scripts: Edit
- Workers KV Storage: Edit
- Workers Routes: Edit
- Account Settings: Read

**Delete Existing Worker** (if testing):
```bash
npx wrangler delete {worker-name}
```

### Issue: D1 Database Creation Fails

**Symptoms**:
- Error: "Failed to create database"
- Error: "Database name too long"
- Migrations fail to run

**Solutions**:

**Check Database Name Length**:
- Maximum: 32 characters
- Use shorter project name if needed

**Manually Create Database**:
```bash
npx wrangler d1 create {database-name}
# Note the database ID
```

**Run Migrations Manually**:
```bash
npx wrangler d1 migrations apply {database-name}
```

### Issue: Pages Deployment Fails

**Symptoms**:
- Build fails
- Error: "Build command failed"
- Frontend doesn't appear

**Solutions**:

**Check Build Logs**:
1. Cloudflare Dashboard → Pages
2. View deployment logs
3. Look for specific error

**Common Build Errors**:

**Missing Environment Variables**:
```bash
# Add to Pages project settings:
VITE_BACKEND_URL=https://your-worker.workers.dev
VITE_FRONTEND_URL=https://your-pages.pages.dev
```

**TypeScript Errors**:
```bash
# Run type check locally
cd web-installer/frontend
npm run type-check
# Fix any errors before deploying
```

**Out of Memory**:
```json
// package.json
{
  "scripts": {
    "build": "NODE_OPTIONS=--max_old_space_size=4096 vite build"
  }
}
```

---

##  Resource Creation Issues

### Issue: KV Namespace Creation Fails

**Symptoms**:
- Error: "Failed to create KV namespace"
- Error: "Namespace name already exists"

**Solutions**:

**Check Existing Namespaces**:
```bash
npx wrangler kv:namespace list
```

**Delete Existing Namespace** (if testing):
```bash
npx wrangler kv:namespace delete --namespace-id={id}
```

**Create Manually**:
```bash
npx wrangler kv:namespace create {namespace-name}
```

### Issue: R2 Bucket Creation Fails

**Symptoms**:
- Error: "Failed to create R2 bucket"
- Error: "Bucket name contains invalid characters"

**Solutions**:

**Check Bucket Name**:
- Only lowercase letters, numbers, hyphens
- Must be 3-63 characters
- No consecutive hyphens

**Create Manually**:
```bash
npx wrangler r2 bucket create {bucket-name}
```

**Verify R2 Enabled**:
- Check Cloudflare plan supports R2
- Free tier: 10GB storage free

---

##  Post-Deployment Issues

### Issue: Deployed App Shows 404

**Symptoms**:
- Frontend URL returns 404
- All pages show "Not Found"
- Static files not loading

**Solutions**:

**Check Pages Deployment Status**:
1. Cloudflare Dashboard → Pages
2. Verify deployment succeeded
3. Check deployment URL

**Verify Routes Configuration**:
```json
// _routes.json should exist
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/api/*"]
}
```

**Check DNS** (if using custom domain):
- Verify CNAME record points to Pages
- Check SSL/TLS certificate status
- Wait for DNS propagation (up to 48 hours)

### Issue: Backend API Returns 500 Error

**Symptoms**:
- All API calls return 500
- Health endpoint fails
- Worker logs show errors

**Solutions**:

**Check Worker Logs**:
```bash
npx wrangler tail {worker-name}
```

**Common Causes**:

**Missing Bindings**:
```toml
# wrangler.toml should have all bindings
[[d1_databases]]
binding = "DB"
database_id = "your-db-id"

[[kv_namespaces]]
binding = "SESSION_KV"
id = "your-kv-id"
```

**Environment Variables Missing**:
```bash
# Set via Cloudflare Dashboard or wrangler
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_KEY
```

**Database Migration Failed**:
```bash
# Re-run migrations
npx wrangler d1 migrations apply {database-name}
```

### Issue: Admin Login Fails

**Symptoms**:
- "Invalid credentials" error
- Login form freezes
- Redirect loop after login

**Solutions**:

**Verify Admin User Exists**:
```sql
-- Run in D1 console
SELECT * FROM agents WHERE role = 'admin';
-- Should return 1 row
```

**Check Admin Password**:
- Password sent to admin email during deployment
- Check spam folder
- If not received, reset manually:

```sql
-- In D1 console
UPDATE agents
SET password_hash = 'bcrypt-hash-here'
WHERE role = 'admin';
```

**Generate Bcrypt Hash**:
```javascript
// Use online bcrypt generator
// Password: your-new-password
// Rounds: 10
```

**Verify JWT Secret**:
```bash
# Check if JWT_SECRET is set
npx wrangler secret list
# If missing, set it
npx wrangler secret put JWT_SECRET
```

---

##  LINE Integration Issues

### Issue: LINE Bot ID Validation Fails

**Symptoms**:
- Valid Bot ID shows error
- Cannot proceed to next step
- Pattern validation incorrect

**Solutions**:

**Verify Bot ID Format**:
- Must start with `@`
- Followed by lowercase letters and numbers
- Example: `@110xsqef`

**Check Where to Find Bot ID**:
1. LINE Developers Console
2. Select your channel
3. Channel Settings → Basic settings
4. Look for "Basic ID" (not Channel ID)

**Bypass Validation** (temporary):
- Check "Skip LINE configuration"
- Complete deployment
- Configure LINE later in admin panel

### Issue: LINE LIFF ID Validation Fails

**Symptoms**:
- "LIFF ID too short" error
- Character counter red even when valid

**Solutions**:

**Verify LIFF ID Format**:
- Minimum 10 characters
- Format: `xxxxxxxxxx-xxxxxxxx`
- Example: `2008756115-vWtFyDMA`

**Create LIFF App**:
1. LINE Developers Console
2. Your channel → LIFF tab
3. Click "Add"
4. Configure and create
5. Copy LIFF ID

**Leave Empty** (if optional):
- LIFF ID is only needed for team binding feature
- Can be added later

---

##  Performance Issues

### Issue: Web Installer Loads Slowly

**Symptoms**:
- Page takes >5 seconds to load
- Forms lag when typing
- Buttons slow to respond

**Solutions**:

**Check Network Speed**:
- Use browser DevTools → Network
- Look for slow requests
- Check if backend is responding quickly

**Clear Browser Cache**:
```
Ctrl+Shift+Delete (Windows)
Cmd+Shift+Delete (Mac)
```

**Optimize Development Server**:
```bash
# Restart with fresh cache
cd web-installer/frontend
rm -rf node_modules/.vite
npm run dev
```

**Check Resource Usage**:
- Close unnecessary browser tabs
- Check CPU usage (shouldn't be >50%)
- Check memory usage

### Issue: Deployment Takes Too Long

**Symptoms**:
- Deployment stuck at one step
- Timeout errors
- Takes >10 minutes

**Solutions**:

**Check Cloudflare Status**:
- Visit https://www.cloudflarestatus.com/
- Verify no outages

**Monitor Deployment Steps**:
- Each step should complete in 30-60 seconds
- If stuck >2 minutes, may be issue

**Cancel and Retry**:
- Stop deployment
- Wait 5 minutes
- Retry with same configuration

---

##  Browser-Specific Issues

### Chrome Issues

**Issue: Form Inputs Not Accepting Text**

**Solution**:
- Disable autofill: `chrome://settings/autofill`
- Clear cache and cookies
- Try incognito mode

**Issue: WebSocket Connection Fails**

**Solution**:
- Check browser extensions (ad blockers)
- Disable extensions temporarily
- Try different network

### Firefox Issues

**Issue: CSS Animations Janky**

**Solution**:
```
about:config
→ layers.acceleration.force-enabled = true
```

**Issue: OAuth Popup Blocked**

**Solution**:
- Allow popups for localhost
- `Preferences → Privacy & Security → Permissions → Popups`

### Safari Issues

**Issue: Form Validation Not Working**

**Solution**:
- Safari has strict validation rules
- Check browser console for errors
- Update to latest Safari version

**Issue: LocalStorage Access Denied**

**Solution**:
- `Safari → Preferences → Privacy`
- Disable "Prevent cross-site tracking" for localhost

---

##  Emergency Recovery

### Complete Deployment Failure

If everything fails and you need to start over:

1. **Delete All Resources**:
```bash
# Delete Worker
npx wrangler delete {worker-name}

# Delete D1 Database
npx wrangler d1 delete {database-name}

# Delete KV Namespaces
npx wrangler kv:namespace delete --namespace-id={id}

# Delete R2 Bucket
npx wrangler r2 bucket delete {bucket-name}

# Delete Pages Project
# (Via Cloudflare Dashboard → Pages → Settings → Delete)
```

2. **Clear Local State**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules
rm -rf web-installer/backend/node_modules
rm -rf web-installer/frontend/node_modules

# Reinstall
cd web-installer/backend && npm install
cd web-installer/frontend && npm install
```

3. **Start Fresh**:
- Choose different project name
- Verify all credentials
- Run deployment again

---

##  Getting Help

### Before Asking for Help

1. **Search This Guide**: Use Ctrl+F to search for error messages
2. **Check Logs**: Gather error messages from console and logs
3. **Document Steps**: Note exactly what you did before the error
4. **Try Basic Fixes**: Restart servers, clear cache, try different browser

### Information to Provide

When asking for help, include:

```markdown
**Issue**: [Brief description]

**Environment**:
- OS: [Windows/Mac/Linux + version]
- Browser: [Name + version]
- Node: [Version from `node --version`]
- npm: [Version from `npm --version`]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**: [What should happen]
**Actual Behavior**: [What actually happens]

**Error Messages**:
```
[Paste error messages here]
```

**Console Logs**:
```
[Paste console logs here]
```

**Network Requests**:
- Request URL: [URL]
- Status Code: [Code]
- Response: [Response body]

**Screenshots**: [Attach if helpful]
```

### Support Resources

**Documentation**:
- `TESTING_VALIDATION_GUIDE.md` - Comprehensive testing guide
- `DEPLOYMENT_VERIFICATION_CHECKLIST.md` - Quick verification
- `PHASE1_COMPLETION_SUMMARY.md` - Implementation details
- `PHASE2_COMPLETION_SUMMARY.md` - UI/UX features

**Cloudflare Resources**:
- [Community Forums](https://community.cloudflare.com/)
- [Developer Docs](https://developers.cloudflare.com/)
- [Status Page](https://www.cloudflarestatus.com/)

**LINE Resources**:
- [LINE Developers](https://developers.line.biz/)
- [Messaging API Docs](https://developers.line.biz/en/docs/messaging-api/)
- [LIFF Documentation](https://developers.line.biz/en/docs/liff/)

---

##  Debug Mode

### Enable Verbose Logging

**Backend**:
```typescript
// In .dev.vars
LOG_LEVEL=debug
```

**Frontend**:
```typescript
// In .env.development
VITE_DEBUG=true
```

**Browser Console**:
```javascript
// Enable verbose logs
localStorage.setItem('debug', '*');
location.reload();
```

---

**Last Updated**: 2026-01-05
**Need more help?** Create an issue with detailed information following the template above.
