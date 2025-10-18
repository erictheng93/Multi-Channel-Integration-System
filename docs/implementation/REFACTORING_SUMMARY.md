# Handler-based


 `src/index.ts` Handler-based


### 1. ** Handler **

| Handler | | |
|-------------|------|---------|
| `src/handlers/auth-main.ts` | | `src/index.ts` |
| `src/handlers/team-main.ts` | | `src/index.ts` |
| `src/handlers/delayed-message-main.ts` | | `src/index.ts` |
| `src/handlers/conversation-main.ts` | | `src/index.ts` |
| `src/handlers/system-main.ts` | | `src/index.ts` |
| `src/handlers/customer-main.ts` | | `src/index.ts` |
| `src/handlers/qrcode-main.ts` | QR Code | `src/index.ts` QR Code |
| `src/handlers/session-main.ts` | | `src/index.ts` |

### 2. ****

** `src/index.ts`**
-
-
- Webhook
-

****
- ****: ~1200+
- ****: ~300

### 3. ****

```typescript
//
app.route('/', systemMainHandler);
app.route('/api', systemMainHandler);

//
app.route('/api/auth', authMainHandler);

//
app.route('/api/teams', teamMainHandler);

//
app.route('/api/delayed-messages', delayedMessageMainHandler);

//
app.route('/api/conversations', conversationMainHandler);

//
app.route('/api/customers', customerMainHandler);

// QR Code
app.route('/api/qr-codes', qrcodeMainHandler);

//
app.route('/api/sessions', sessionMainHandler);
```


### 1. ****
-
-
-

### 2. ****
-
-
-

### 3. ****
-
-
-

### 4. ****
- handler
-
-


### 1. ****
- `MessageRecallService`
- `PermissionService`
- QR Code `QRCodeService`
-

### 2. ****
- handler
-
-

### 3. ****
```typescript
//
{
 success: true,
 data: {...},
 timestamp: "2025-01-01T00:00:00.000Z"
}

//
{
 success: false,
 error: "Error message",
 timestamp: "2025-01-01T00:00:00.000Z"
}
```


```
src/
 index.ts #
 index-original-backup.ts #
 handlers/
 index.ts # Handler
 auth-main.ts #
 team-main.ts #
 delayed-message-main.ts #
 conversation-main.ts #
 system-main.ts #
 customer-main.ts #
 qrcode-main.ts # QR Code
 session-main.ts #
```


- TypeScript
-
-


- Drizzle-based handler
- handler
- MessageRecallService-based handlers


### 1. ****
-
- API
-

### 2. ****
-
-
-

### 3. ****
- API
-
-


### 1. **1-2 **
-
- handler
-

### 2. **1 **
- handler
-
-

### 3. **3 **
- handler
- API
-


 Handler-based

- **** 85%
- **** 90%
- **** 80%
- **** 75%


---

****: 2025812
****: v2.0.0 - Handler-based Architecture
****: 