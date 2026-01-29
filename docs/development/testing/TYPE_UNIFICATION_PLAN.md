


| | | |
|---------|---------|---------|
| `Agent` | `src/types/shared.ts`, `shared/api-types.ts` | |
| `ApiResponse` | `src/types/shared.ts`, `shared/api-types.ts` | |
| `Conversation` | `src/types/shared.ts`, `shared/api-types.ts` | |
| `Message` | `src/types/shared.ts`, `shared/api-types.ts` | |
| `User` | `src/types/shared.ts`, `shared/api-types.ts` | |


```
shared/
 api-types.ts # API
 types/
 core.ts #
 api.ts # API
 index.ts #
```


#### 1. (`shared/types/core.ts`)
```typescript
//
export type Platform = 'line' | 'facebook'
export type UserRole = 'admin' | 'agent'
export type ConversationStatus = 'open' | 'assigned' | 'closed'
export type MessageType = 'text' | 'image' | 'video' | 'file'
export type SenderType = 'user' | 'agent' | 'system'
```

#### 2. API (`shared/types/api.ts`)
```typescript
// API /
export interface StandardApiResponse<T = unknown> {
 success: boolean
 data?: T
 error?: string
 message?: string
 timestamp?: string
}

export interface PaginatedResponse<T> extends StandardApiResponse<T[]> {
 pagination: {
 page: number
 limit: number
 total: number
 totalPages: number
 hasNext: boolean
 hasPrev: boolean
 }
}
```

#### 3. (`shared/types/entities.ts`)
```typescript
//
export interface User {
 id: string
 name: string
 platform: Platform
 platformUserId: string
 avatarUrl?: string
 createdAt: number
}

export interface Agent {
 id: string
 email: string
 name: string
 role: UserRole
 isActive: boolean
 createdAt: number
 lastActive?: number
}

export interface Conversation {
 id: string
 userId: string
 user?: User
 assignedTo?: string
 assignedAgent?: Agent
 status: ConversationStatus
 lastMessageAt: number
 unreadCount: number
 createdAt: number
 updatedAt: number
}

export interface Message {
 id: string
 conversationId: string
 senderType: SenderType
 senderId: string
 content: string
 messageType: MessageType
 mediaUrl?: string
 platform: Platform
 timestamp: number
 createdAt: number
}
```


### 1:
1. `shared/types/`
2.
3. API
4.

### 2:
1. `shared/api-types.ts`
2. `src/types/shared.ts`
3. `src/types/index.ts`

### 3:
1. store
2. API
3.

### 4:
1. TypeScript
2.
3.


```typescript
// src/types/converters.ts -
//
export function dbUserToUser(dbUser: DbUser): User {
 return {
 id: dbUser.id.toString(),
 name: dbUser.displayName,
 platform: dbUser.platform as Platform,
 platformUserId: dbUser.platform_user_id,
 avatarUrl: dbUser.avatar_url,
 createdAt: new Date(dbUser.created_at).getTime()
 }
}
```


-
-
-


```bash

cd frontend && npx vue-tsc --noEmit


npx tsc --noEmit
```


```bash

cd frontend && npm test


cd tests && npm test
```


- 95%
- TypeScript API
-


- [x]
- [x]
- [ ]


- [ ]
- [ ]
- [ ]


- [ ]
- [ ]
- [ ]


-
-
-


-
-
-

---

****: 1