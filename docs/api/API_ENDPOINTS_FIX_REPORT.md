# API


 API


### 1. `/api/system/status`
****: **** ( 404 200)

****:
```bash
curl https://multi-channel-platform.example.com/api/system/status
```

**** (HTTP 200):
```json
{
 "overall": "healthy",
 "timestamp": "2025-08-12T11:04:15.665Z",
 "version": "1.0.0",
 "services": {
 "database": {
 "status": "connected",
 "type": "D1"
 },
 "kv": {
 "status": "available",
 "namespaces": ["SESSIONS", "CACHE"]
 },
 "r2": {
 "status": "available",
 "bucket": "omni-channel-attachments"
 },
 "queue": {
 "status": "available",
 "name": "MESSAGE_QUEUE"
 }
 },
 "environment": "development"
}
```

### 2. `/api/stats`
****: **** ( 500 200)

****:
```bash
curl https://multi-channel-platform.example.com/api/stats
```

**** (HTTP 200):
```json
{
 "success": true,
 "data": {
 "totalMessages": 0,
 "totalCustomers": 0,
 "totalConversations": 0,
 "recentMessages": []
 },
 "timestamp": "2025-08-12T11:04:25.306Z"
}
```


### 1: `/api/system/status` 404
****: `/system/status`

****:
- `/system/status`
-
 -
 -
 - KV
 - R2
 - Queue
 -

### 2: `/api/stats` 500
****:
-
-

****:
-
-
-
-

## API


1. ****:
 - `GET /` HTTP 200
 - `GET /health` HTTP 200

2. **API **:
 - `GET /api/health` HTTP 200
 - `GET /api/system/status` HTTP 200 ()
 - `GET /api/stats` HTTP 200 ()
 - `GET /api` HTTP 200 (API )


#### `/api/health`
- ****:
- ****:

#### `/api/system/status`
- ****:
- ****: Cloudflare

#### `/api/stats`
- ****:
- ****:

#### `/api`
- ****: API
- ****: API


```bash

curl https://multi-channel-platform.example.com/api/health


curl https://multi-channel-platform.example.com/api/system/status


curl https://multi-channel-platform.example.com/api/stats

# API
curl https://multi-channel-platform.example.com/api
```


 URL JSON


### 1.
-
-
-

### 2.
-
- SQL
-

### 3.
-
- Cloudflare
-


- `/api/health` -
- `/api/system/status` -
- `/api/stats` -
- `/api` - API
-
-
- JSON


****: ****

 API

1. **`/api/system/status`**: 404 200
2. **`/api/stats`**: 500 200

 `multi-channel-platform.example.com` API

****: 9c8825b6-60b8-46c2-a85d-1ad1080128e5
****: 2025-08-12T11:04:00Z

 ** API **