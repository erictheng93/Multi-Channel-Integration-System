# TypeScript


****: 202518
****: TypeScript


#### 1. (111 )
- ****:
- ****: API Store
- ****: -

#### 2.

| | | |
|---------|---------|---------|
| API `status` | 35 | API |
| | 20 | Store Mock |
| | 25 | Composables |
| | 15 | Store |
| Mock | 16 | |


### A: ()
****:
****:
****: 30

### B:
****:
****:
****: 2-3

### C: ()
****:
****:
****: 1

## ( C)

### 1:


```typescript
// src/types/shared.ts
// shared/api-types.ts
//
```

### 2:
```typescript
// shared/types/adapters.ts
//
export function legacyToModernConversation(legacy: LegacyConversation): Conversation {
 //
}
```

### 3:
```typescript
//
/** @deprecated shared/types/entities.ts */
export interface Agent {
 //
}
```


### : ()
- [x]
- [ ]
- [ ]
- [ ]

### : ()
- [ ]
- [ ]
- [ ]
- [ ]

### : ()
- [ ]
- [ ]
- [ ]
- [ ]


### 1. API
```typescript
// ApiResponse status
export interface ApiResponse<T = unknown> {
 success: boolean
 data?: T
 error?: string
 message?: string
 status?: number //
}
```

### 2.
```typescript
//
export interface Conversation {
 id: string
 userId: string
 user?: User
 customer?: User //
 assignedTo?: string
 assignedAgent?: Agent
 assignedAgentId?: string //
 status: 'open' | 'assigned' | 'closed'
 platform?: Platform //
 lastMessageAt: number
 lastMessage?: Message //
 unreadCount: number
 createdAt: number | Date //
 updatedAt: number | Date //
}
```

### 3.
```typescript
// 'customer'
export type SenderType = 'user' | 'agent' | 'system' | 'customer'
```


```bash
cd frontend && bunx vue-tsc --noEmit
# : 0
```


```bash
cd frontend && npm test
# :
```


```bash
cd frontend && bun run build
# :
```


### ()
- TypeScript
-
-

### ()
-
-
-

### ()
-
-
- 100%


1. ****:
2. ****: API
3. ****:
4. ****:

---

****: 