# Multi-Channel Integration System - Complete API Reference

**Version:** 2.0.0
**Last Updated:** 2025-01-28
**Base URL (Development):** `http://localhost:8787`
**Base URL (Production):** `https://your-api-domain.example.com`

---

## ?? Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Response Standards](#response-standards)
- [Error Handling](#error-handling)
- [API Modules](#api-modules)
- [Rate Limiting](#rate-limiting)
- [Versioning](#versioning)
- [Quick Start Guide](#quick-start-guide)

---

## ?? Overview

The Multi-Channel Integration System provides a comprehensive REST API for managing customer support operations across multiple messaging platforms (LINE, Facebook, etc.). This API is built on Cloudflare Workers for edge computing performance and uses modern web standards.

### Key Features

- **?? JWT Authentication** - Secure token-based authentication
- **?? Multi-Platform Support** - LINE OA, Facebook Messenger integration
- **??Real-time Communication** - WebSocket and SSE support
- **?? Analytics & Reporting** - Comprehensive data analytics
- **?? Collaboration Tools** - Real-time presence and typing indicators
- **?? File Management** - R2-based file storage with 10MB limit
- **?è∑Ô∏?Tagging System** - Flexible message and customer tagging
- **?? Bulk Operations** - Efficient batch processing (up to 100 items)

### Architecture

```
?å‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
??                   API Gateway Layer                     ??
??          (Cloudflare Workers + Hono Framework)          ??
?î‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?¨‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
                    ??
        ?å‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?¥‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
        ??                      ??
?å‚??Ä?Ä?Ä?Ä?Ä?Ä?º‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä??   ?å‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?º‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
?? HTTP/REST API ??   ?? WebSocket API   ??
??  (Standard)   ??   ?? (Real-time)     ??
?î‚??Ä?Ä?Ä?Ä?Ä?Ä?¨‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä??   ?î‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?¨‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
        ??                     ??
?å‚??Ä?Ä?Ä?Ä?Ä?Ä?¥‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?¥‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
??         Module Layer                   ??
?? ?å‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?? ??
?? ??Auth ??Conversations ??Messages  ?? ??
?? ??Teams ??Customers ??Analytics   ?? ??
?? ??Collaboration ??Files ??Webhooks ?? ??
?? ?î‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?? ??
?î‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?¨‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
            ??
?å‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?º‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
??        Data Layer                       ??
?? ?å‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?? ??
?? ??D1 Database ??KV Store ??R2 Storage????
?? ??Queues ??Durable Objects         ?? ??
?? ?î‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?? ??
?î‚??Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä??
```

---

## ?? Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### Obtaining a Token

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "agent": {
      "id": "agent-123",
      "email": "user@example.com",
      "displayName": "User Name",
      "role": "agent|admin",
      "teamId": 1
    }
  },
  "message": "Login successful"
}
```

### Role-Based Access Control (RBAC)

| Role    | Permissions                                      |
|---------|--------------------------------------------------|
| `admin` | Full system access including configuration       |
| `agent` | Conversation management, customer interaction    |

### Token Refresh

**Endpoint:** `POST /api/auth/refresh`

Tokens expire after 24 hours. Use the refresh token to obtain a new access token without re-authentication.

**?? Full Documentation:** [Authentication API Reference](./modules/AUTH_API.md)

---

## ?? Response Standards

### Standard Response Format

All API responses follow this structure:

```typescript
{
  "success": boolean,
  "data": object | array | null,
  "message": string,
  "timestamp": string,      // ISO 8601 format
  "requestId": string       // Unique request identifier
}
```

### Paginated Response Format

List endpoints include pagination metadata:

```typescript
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "message": "Data retrieved successfully",
  "timestamp": "2025-01-28T10:00:00.000Z",
  "requestId": "req_1234567890_abc123"
}
```

### Success Response Examples

**Single Resource:**
```json
{
  "success": true,
  "data": {
    "id": "conv-123",
    "status": "open"
  },
  "message": "Resource retrieved successfully"
}
```

**List of Resources:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {...}
  }
}
```

**Operation Result:**
```json
{
  "success": true,
  "data": null,
  "message": "Operation completed successfully"
}
```

---

## ?†Ô? Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": {
      "field": "fieldName",
      "value": "invalidValue"
    },
    "timestamp": "2025-01-28T10:00:00.000Z",
    "requestId": "req_1234567890_abc123"
  }
}
```

### HTTP Status Codes

| Code | Status                  | Description                           |
|------|-------------------------|---------------------------------------|
| 200  | OK                      | Request successful                    |
| 201  | Created                 | Resource created successfully         |
| 204  | No Content              | Successful deletion                   |
| 400  | Bad Request             | Invalid request parameters            |
| 401  | Unauthorized            | Missing or invalid authentication     |
| 403  | Forbidden               | Insufficient permissions              |
| 404  | Not Found               | Resource does not exist               |
| 409  | Conflict                | Resource already exists               |
| 422  | Unprocessable Entity    | Validation failed                     |
| 429  | Too Many Requests       | Rate limit exceeded                   |
| 500  | Internal Server Error   | Server-side error                     |
| 503  | Service Unavailable     | Temporary service outage              |

### Common Error Codes

| Code                      | HTTP | Description                           |
|---------------------------|------|---------------------------------------|
| `AUTHENTICATION_ERROR`    | 401  | Invalid or missing credentials        |
| `AUTHORIZATION_ERROR`     | 403  | Insufficient permissions              |
| `VALIDATION_ERROR`        | 400  | Request validation failed             |
| `NOT_FOUND_ERROR`         | 404  | Resource not found                    |
| `CONFLICT_ERROR`          | 409  | Resource already exists               |
| `RATE_LIMIT_ERROR`        | 429  | Too many requests                     |
| `SYSTEM_ERROR`            | 500  | Internal server error                 |
| `DATABASE_ERROR`          | 500  | Database operation failed             |
| `EXTERNAL_SERVICE_ERROR`  | 502  | External service unavailable          |

### Error Response Examples

**Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Email is required",
          "value": ""
        },
        {
          "field": "password",
          "message": "Password must be at least 8 characters",
          "value": "short"
        }
      ]
    }
  }
}
```

**Authentication Error:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid credentials",
    "timestamp": "2025-01-28T10:00:00.000Z",
    "requestId": "req_1234567890_abc123"
  }
}
```

---

## ??Ô∏?API Modules

The API is organized into the following modules:

### ?? Authentication & Authorization

- **[Authentication API](./modules/AUTH_API.md)** - Login, logout, token management
  - `POST /api/auth/login` - User login
  - `POST /api/auth/logout` - User logout
  - `POST /api/auth/refresh` - Refresh access token
  - `GET /api/auth/me` - Get current user information
  - `POST /api/auth/change-password` - Change password

### ?í¨ Conversation Management

- **[Conversations API](./modules/CONVERSATIONS_API.md)** - Conversation lifecycle and assignment
  - `GET /api/conversations` - List conversations
  - `POST /api/conversations` - Create conversation
  - `GET /api/conversations/:id` - Get conversation details
  - `PUT /api/conversations/:id` - Update conversation
  - `DELETE /api/conversations/:id` - Delete conversation
  - `POST /api/conversations/:id/assign` - Assign conversation to agent/team
  - `POST /api/conversations/:id/transfer` - Transfer conversation
  - `POST /api/conversations/:id/close` - Close conversation

### ?ì® Messaging

- **[Messaging API](./modules/MESSAGING_API.md)** - Complete messaging system (??Already documented)
  - Message CRUD operations
  - Bulk operations (create/delete up to 100 messages)
  - File attachments (R2 integration, 10MB limit)
  - Message forwarding (up to 20 conversations)
  - Message tagging (up to 10 tags)
  - Message recall functionality
  - Data export (JSON/CSV formats)

### ?ë• Customer Management

- **[Customer API](./modules/CUSTOMER_API.md)** - Customer profiles and data
  - `GET /api/customers` - List customers
  - `POST /api/customers` - Create customer
  - `GET /api/customers/:id` - Get customer details
  - `PUT /api/customers/:id` - Update customer
  - `DELETE /api/customers/:id` - Delete customer
  - `GET /api/customers/:id/conversations` - Get customer conversations
  - `GET /api/customers/search` - Search customers

### ?è∑Ô∏?Tag Management

- **[Tag API](./modules/TAG_API.md)** - Customer and conversation tagging
  - `GET /api/tags` - List all tags
  - `POST /api/tags` - Create tag
  - `GET /api/tags/:id` - Get tag details
  - `PUT /api/tags/:id` - Update tag
  - `DELETE /api/tags/:id` - Delete tag
  - `POST /api/tags/bulk-create` - Bulk create tags
  - `DELETE /api/tags/bulk-delete` - Bulk delete tags
  - `GET /api/tags/stats` - Get tag usage statistics

### ?ë®?ç??Team Management

- **[Teams API](./modules/TEAMS_API.md)** - Team and member management
  - Team CRUD operations
  - Member management
  - Invitation system
  - Role assignment
  - Team statistics

### ?? Analytics & Reporting

- **[Analytics API](./modules/ANALYTICS_API.md)** - ?†Ô? **NEW - Previously Undocumented!**
  - `GET /api/analytics/conversations` - Conversation analytics
  - `GET /api/analytics/messages` - Message analytics
  - `GET /api/analytics/users` - User activity analytics
  - `GET /api/analytics/performance` - System performance metrics
  - `POST /api/analytics/custom` - Custom analytics queries
  - `POST /api/analytics/export` - Export analytics data
  - `GET /api/analytics/health` - Analytics service health
  - `POST /api/analytics/metrics` - Collect metrics
  - `GET /api/analytics/metrics/:name` - Query specific metrics

### ?? Collaboration & Real-time

- **[Collaboration API](./modules/COLLABORATION_API.md)** - ?†Ô? **NEW - Previously Undocumented!**
  - `GET /api/collaboration/conversations/:id/state` - Get collaboration state
  - `GET /api/collaboration/conversations/:id/viewers` - Get active viewers
  - `POST /api/collaboration/conversations/:id/join` - Join conversation
  - `POST /api/collaboration/conversations/:id/leave` - Leave conversation
  - `POST /api/collaboration/typing` - Send typing indicator
  - `POST /api/collaboration/presence` - Update online status
  - `GET /api/collaboration/stats` - Get collaboration statistics
  - `POST /api/collaboration/cleanup` - Cleanup expired states

### ?? WebSocket & Real-time Communication

- **[WebSocket API](./modules/WEBSOCKET_API.md)** - ?†Ô? **Newly Unified Documentation!**
  - Connection management
  - Real-time message delivery
  - Presence tracking
  - Typing indicators
  - WebSocket health monitoring
  - Dashboard metrics
  - Durable Objects integration

### ?? File Management

- **[File Management API](./modules/FILE_MANAGEMENT_API.md)** - File upload and storage
  - File upload to R2 storage
  - File retrieval and download
  - File metadata management
  - Multi-file attachments
  - File type validation
  - Storage quota management

### ?? Notifications

- **[Notifications API](./modules/NOTIFICATIONS_API.md)** - System notifications
  - Push notifications
  - Email notifications
  - In-app notifications
  - Notification preferences
  - Notification history

### ?? Activity Logging

- **[Activities API](./modules/ACTIVITIES_API.md)** - Audit trail and activity logs
  - `GET /api/activities` - List activities
  - `GET /api/activities/stream` - Real-time activity stream
  - Activity filtering and search
  - Audit trail export

### ?ë§ Agents & Users

- **[Agents API](./modules/AGENTS_API.md)** - Agent management
  - Agent CRUD operations
  - Agent performance metrics
  - Agent availability status
  - Agent assignment rules

### ?ôÔ? System Configuration

- **[System API](./modules/SYSTEM_API.md)** - System settings and health
  - `GET /api/system/health` - System health check
  - `GET /api/system/info` - System information
  - `GET /api/system/settings` - Get system settings
  - `PUT /api/system/settings` - Update system settings
  - `GET /api/system/metrics` - System metrics
  - Cache management
  - Backup and restore

### ?? Integration & Webhooks

- **[Integration API](./modules/INTEGRATION_API.md)** - Platform integrations
  - `POST /api/webhooks/line` - LINE webhook endpoint
  - `POST /api/webhooks/line/:teamId/:token` - Multi-tenant LINE webhook
  - `POST /api/webhooks/facebook` - Facebook webhook endpoint
  - Platform configuration
  - Webhook verification
  - Channel management

### ?? QR Code Management

- **[QRCode API](./modules/QRCODE_API.md)** - QR code generation and tracking
  - `POST /api/qrcode/generate` - Generate QR code
  - `GET /api/qrcode/:id` - Get QR code details
  - `GET /api/qrcode/:id/image` - Get QR code image
  - `PUT /api/qrcode/:id` - Update QR code
  - `DELETE /api/qrcode/:id` - Delete QR code
  - `GET /api/qrcode` - List QR codes

### ?? CORS & Monitoring

- **[CORS Monitoring API](./modules/CORS_MONITORING_API.md)** - CORS configuration and analytics
  - `GET /api/cors/health` - CORS health check (Public)
  - `GET /api/cors/config` - Get CORS configuration (Public)
  - `GET /api/cors/stats` - CORS statistics (Admin)
  - `GET /api/cors/events` - CORS events log (Admin)
  - `GET /api/cors/rejected-origins` - Rejected origins (Admin)
  - `POST /api/cors/cleanup` - Cleanup old data (Admin)

---

## ?ö¶ Rate Limiting

To ensure fair usage and system stability, rate limiting is applied:

| Endpoint Type          | Limit              | Window  |
|------------------------|-------------------|---------|
| Authentication         | 5 requests        | 1 min   |
| Read Operations (GET)  | 100 requests      | 1 min   |
| Write Operations       | 50 requests       | 1 min   |
| Bulk Operations        | 10 requests       | 1 min   |
| File Uploads           | 20 requests       | 1 min   |
| Analytics Queries      | 30 requests       | 1 min   |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706432400
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded. Please try again later.",
    "retryAfter": 60
  }
}
```

---

## ?? Versioning

The API uses URL versioning for major changes:

- **Current Version:** v2 (default, no prefix required)
- **Legacy Version:** v1 (deprecated, use `/api/v1/...` prefix)

### Version Support

| Version | Status       | End of Life  |
|---------|--------------|--------------|
| v2      | Current      | -            |
| v1      | Deprecated   | 2025-12-31   |

### Breaking Changes Policy

- Major version changes (v1 ??v2) may include breaking changes
- Minor changes are backward compatible
- 6-month deprecation notice for breaking changes
- Changelog available at `/api/changelog`

---

## ?? Quick Start Guide

### 1. Authentication

```bash
# Login to get access token
curl -X POST https://your-api-domain.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'

# Save the token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. List Conversations

```bash
curl -X GET "https://your-api-domain.example.com/api/conversations?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Create a Message

```bash
curl -X POST "https://your-api-domain.example.com/api/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_123",
    "content": "Hello, how can I help you?",
    "messageType": "text"
  }'
```

### 4. Get Analytics

```bash
curl -X GET "https://your-api-domain.example.com/api/analytics/conversations?timeRange=7d" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Connect to WebSocket

```javascript
const ws = new WebSocket(
  'wss://your-api-domain.example.com/api/websocket?token=' + TOKEN
);

ws.onopen = () => {
  console.log('Connected to WebSocket');
  ws.send(JSON.stringify({
    type: 'subscribe',
    conversationId: 'conv_123'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

---

## ?? Additional Resources

### Developer Tools

- **Postman Collection:** [Download Collection](./postman/Multi-Channel-API.postman_collection.json)
- **OpenAPI Spec:** [Download Spec](./openapi/api-spec.yaml)
- **SDK (JavaScript):** [NPM Package](https://npmjs.com/package/@multi-channel/sdk)

### Guides & Tutorials

- [Authentication Guide](./guides/AUTHENTICATION.md)
- [WebSocket Integration Guide](./guides/WEBSOCKET_INTEGRATION.md)
- [Bulk Operations Best Practices](./guides/BULK_OPERATIONS.md)
- [Error Handling Guide](./guides/ERROR_HANDLING.md)
- [Rate Limiting Guide](./guides/RATE_LIMITING.md)
- [Analytics Query Examples](./guides/ANALYTICS_EXAMPLES.md)

### Support

- **Documentation:** [https://docs.multi-channel.com](https://docs.multi-channel.com)
- **GitHub Issues:** [https://github.com/your-org/multi-channel/issues](https://github.com/your-org/multi-channel/issues)
- **Email Support:** support@multi-channel.com

---

## ?? Changelog

### Version 2.0.0 (2025-01-28)

**New Features:**
- ??Analytics API (9 endpoints)
- ??Collaboration API (8 endpoints)
- ??Unified WebSocket API documentation
- ??File Management API
- ??Tag Management API with bulk operations
- ??CORS Monitoring API

**Improvements:**
- Enhanced error responses with detailed codes
- Improved rate limiting with custom limits per endpoint
- Better pagination support
- WebSocket reconnection handling

**Deprecated:**
- Server-Sent Events (SSE) API (use WebSocket instead)
- Legacy webhook endpoints without team support

### Version 1.0.0 (2024-09-01)

- Initial API release
- Basic authentication and authorization
- Conversation and message management
- LINE OA integration

---

## ?? Security Best Practices

1. **Never expose your JWT token** in client-side code or public repositories
2. **Use HTTPS** for all API requests in production
3. **Rotate tokens regularly** using the refresh token mechanism
4. **Validate webhook signatures** for external integrations
5. **Use environment variables** for sensitive configuration
6. **Enable CORS** only for trusted domains
7. **Monitor API usage** for suspicious patterns
8. **Implement proper error handling** to avoid information leakage

---

## ?? API Status

Current system status: [https://status.multi-channel.com](https://status.multi-channel.com)

| Service              | Status    | Uptime   |
|----------------------|-----------|----------|
| API Gateway          | ??Operational | 99.9%  |
| WebSocket Service    | ??Operational | 99.8%  |
| Database (D1)        | ??Operational | 99.9%  |
| File Storage (R2)    | ??Operational | 99.9%  |
| Message Queue        | ??Operational | 99.7%  |
| Analytics Service    | ??Operational | 99.5%  |

---

**Last Updated:** 2025-01-28
**API Version:** 2.0.0
**Documentation Version:** 2.0.0
