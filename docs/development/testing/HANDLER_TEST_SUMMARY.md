# Handler-based


 Handler-based handler


### 1. ** Handler **
- ****: `tests/unit/handlers/delayed-message-main.test.ts`
- ****: (16/16 )
- ****:
 - POST /send -
 - POST /recall/:messageId -
 - GET /pending -
 - POST /process -
 -

### 2. ** Handler **
- ****: `tests/unit/handlers/auth-main.test.ts`
- ****: (4/8 )
- ****:
 - POST /login -
 - POST /register -
 - POST /logout -
 - GET /profile -

### 3. ** Handler **
- ****: `tests/unit/handlers/team-main.test.ts`
- ****:
- ****:
 - CRUD ()
 -
 -
 - QR Code

### 4. ** Handler **
- ****: `tests/unit/handlers/system-main.test.ts`
- ****:
- ****:
 -
 - API
 -
 -

### 5. ** Handler **
- ****: `tests/unit/handlers/conversation-main.test.ts`
- ****:
- ****:
 -
 -
 -
 -

### 6. ** Handler **
- ****: `tests/unit/handlers/customer-main.test.ts`
- ****:
- ****:
 -
 -
 -
 -


### **Mock **
- ** Mock**: MessageRecallService, PermissionService, QRCodeService
- ** Mock**:
- ** Mock**: JWT

### ****
-
-
-
-
-

### ****
- ****: handler
- ****: Handler
- ****:


### ** Handler**
```
 16/16
 API


```

### ** Handler**
```
 4/8

 Mock
```

## NPM

```json
{
 "test:handlers": "npx tsx tests/run-handler-tests.ts",
 "test:handlers:main": "npx vitest tests/unit/handlers/*-main.test.ts",
 "test:handlers:delayed": "npx vitest tests/unit/handlers/delayed-message-main.test.ts",
 "test:handlers:auth": "npx vitest tests/unit/handlers/auth-main.test.ts",
 "test:handlers:team": "npx vitest tests/unit/handlers/team-main.test.ts",
 "test:handlers:system": "npx vitest tests/unit/handlers/system-main.test.ts",
 "test:handlers:conversation": "npx vitest tests/unit/handlers/conversation-main.test.ts",
 "test:handlers:customer": "npx vitest tests/unit/handlers/customer-main.test.ts"
}
```


### ** Handler **
1. ****: `c.env`
2. **Mock **: authenticateUser, signJWT mock
3. ****:

### ** Handler **
1. ****: handler
2. ****:
3. ****:


### ****
| | (Drizzle-based) | (Handler-based) |
|------|------------------------|------------------------|
| **** | | |
| **** | DatabaseService | MessageRecallService |
| **** | | |
| **** | | |

### ****
- ****: handler
- ****: API
- ****:
- ****:


### ****
1. handler
2. handler
3.

### ** (1-2 )**
1. handler
2. 100%
3.

### ** (1 )**
1. CI/CD
2.
3.


### ****
- Handler: 100%
- Handler: 50% ()
- Handler:

### ****
- Handler: 100%
- : > 90%
- CI/CD :


- ****: `REFACTORING_SUMMARY.md`
- **Handler **: `src/handlers/*-main.ts`
- ****: `tests/unit/handlers/*-main.test.ts`
- ****: `tests/run-handler-tests.ts`

---

****: 2025812
****: v2.0.0 - Handler-based Architecture Tests
****:
****: 