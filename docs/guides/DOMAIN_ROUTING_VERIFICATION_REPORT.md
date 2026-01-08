

 **multi-channel-platform.example.com**


### 1.
**URL**: `https://multi-channel-platform.example.com/`
****: (HTTP 200)
****:
```json
{
 "message": "Hello! My LINE Bot Worker is running!",
 "timestamp": "2025-08-12T10:57:56.060Z",
 "version": "1.0.0"
}
```

### 2.
**URL**: `https://multi-channel-platform.example.com/health`
****: (HTTP 200)
****:
```json
{
 "status": "healthy",
 "timestamp": "2025-08-12T10:58:09.039Z",
 "database": "connected",
 "version": "1.0.0"
}
```

### 3. API
**URL**: `https://multi-channel-platform.example.com/api/health`
****: 404 Not Found
****:
```json
{
 "error": "Not Found",
 "message": "The requested endpoint was not found",
 "timestamp": "2025-08-12T10:57:40.803Z"
}
```


1. ****: DNS
2. **SSL/TLS**: HTTPS
3. **Worker **: Worker
4. ****: `/health`
5. ****: "connected"


1. **API **: `/api/*` 404


### (2 )
- `wrangler.toml` -
- `wrangler-delayed-message.toml` -

### (4 )
- `frontend/src/views/PlatformIntegration.vue` - Webhook URL
- `frontend/_redirects` - API URL
- `frontend/.env.development` -
- `frontend/.env.local.example` -
- `frontend/src/test/api-proxy.test.ts` - URL

### (6 )
- `tests/test-message-relations.ts`
- `tests/test-session-management.ts`
- `tests/check-recent-messages.ts`
- `tests/verify-production.ts`
- `tests/test-line-api.ts`
- `tests/monitor-line-messages.ts`

### (1 )
- `src/utils/team.ts` - QR Code URL

### (2 )
- `test-api.ps1` - URL
- `deploy-production.ps1` -

### (17 )
- URL


### 1.
 URL
- `https://multi-channel-platform.example.com/`
- `https://multi-channel-platform.example.com/health`

### 2.
```bash

curl https://multi-channel-platform.example.com/health


curl https://multi-channel-platform.example.com/


curl -I https://multi-channel-platform.example.com/
```

### 3.
```bash
# ()
curl https://multi-channel-platform.example.com/admin-dashboard.html


curl https://multi-channel-platform.example.com/system/status
```

## API

 `/api/*`

1. ** Worker **
2. **** (`src/index.ts` )
3. ** Worker**:
 ```bash
 wrangler deploy
 ```


-
- SSL/TLS
- Worker
-
-
-
-
-


****: ****

 `multi-channel-platform.example.com` Worker

****:
1. `https://multi-channel-platform.example.com/health`
2. `curl` HTTP 200
3. JSON

