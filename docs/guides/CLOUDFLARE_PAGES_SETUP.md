# Cloudflare Pages Git

## Git

1. ****
2. **** PR URL
3. ****
4. ****


### 1. Cloudflare Dashboard

1. [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **"Pages"**
3. **"Create a project"**
4. **"Connect to Git"**
5. Git GitHub/GitLab
6. Cloudflare
7.

### 2.

```yaml

Project name: multi-channel-platform-frontend


Production branch: main ( master)


Build command: cd frontend && npm ci && npm run build:pages
Build output directory: frontend/dist
Root directory: / ( /)

# Node.js
Environment variables:
NODE_VERSION: 18
```

### 3.

 **Settings > Environment variables**

#### Production
```
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
NODE_VERSION=18
```

#### Preview
```
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
NODE_VERSION=18
```


```bash
# 1.
git checkout -b feature/new-feature
# ...

# 2.
git add .
git commit -m "feat: "
git push origin feature/new-feature

# 3. Pull Request
# Cloudflare PR
```


```bash
# 1.
git checkout main
git merge feature/new-feature
git push origin main

# 2. Cloudflare

```


- PR URL
- `https://abc123.multi-channel-platform-frontend.pages.dev`
-


- GitHub/GitLab
-
- commit


- Cloudflare Dashboard
-
-


1. **Deployments**
2.
 - Node.js
 -
 - TypeScript
 -


```bash

cd frontend
npm ci
npm run build:pages


npm run type-check
npm run lint:check
```


1. **Custom domains**
2. DNS CNAME
3. SSL


- `main`
- `develop`
-

### Webhook
 Webhook
- Slack
- Discord
- API


- **** 500
- ****
- ****


Git
1. ****
2. ****
3. ****
4. ****
5. ****

