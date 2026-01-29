# API


 `base.ts` API API axios fetch API


### 1. API

****: `frontend/src/api/base.ts`

- fetch API axios
-
- 401
- Bearer Token
-

****:
```typescript
class ApiClient {
 setAuthHeader(token: string) //
 removeAuthHeader() //
 get<T>(endpoint: string) // GET
 post<T>(endpoint, data?) // POST
 put<T>(endpoint, data?) // PUT
 delete<T>(endpoint) // DELETE
}
```

### 2. API

#### Auth API (`frontend/src/api/auth.ts`)
- axios
- `apiClient`
-
-

#### Conversations API (`frontend/src/api/conversations.ts`)
- fetch API
-
-
-

#### Messages API (`frontend/src/api/message.ts`)
-
-
-

### 3.


- `.env` -
- `.env.development` -
- `.env.production` -

****:
```bash
VITE_API_URL=http://localhost:8787 # API URL
VITE_APP_TITLE=Multi-Channel Support MVP
VITE_DEBUG=true #
```

### 4.

****:
- `axios` - HTTP

****:
- Vue 3
- TypeScript
-


### 1.
- axios 13KB
- fetch API

### 2.
- `ApiResponse<T>`
- TypeScript
-

### 3.
-
- 401
-

### 4.
-
-
- /


 ****
- API
- Store
-


```typescript
import { apiClient } from '@/api/base'

// GET
const response = await apiClient.get<User[]>('/users')

// POST
const result = await apiClient.post<User>('/users', userData)
```


```typescript
import { authApi } from '@/api/auth'

//
authApi.setAuthHeader(token)

//
authApi.removeAuthHeader()
```


-
-
- API
-


1. **API **: API
2. ****:
3. ****: /
4. ****: API URL

 API 