# TypeScript


****: 202518
****: TypeScript


- **TypeScript **:
- ****: 393
- ****:
- **Store **: store


#### 1. ESLint (94 )
 `any`

****:
- `any` mock
- Composables `any`
- props `any`

#### 2.
****:
- `Agent` - `src/types/shared.ts` `shared/api-types.ts`
- `ApiResponse` -
- `Conversation` -
- `Message` -
- `User` -


### 1:

#### A:
```typescript
// shared/api-types.ts
// src/types/shared.ts
//
```

#### B:
```typescript
// shared/api-types.ts - API
// src/types/shared.ts -
// src/types/database.ts -
//
```

### 2: `any`


```typescript
// mock
interface MockApiResponse<T> {
 success: boolean
 data?: T
 error?: string
}

// any
interface MockEvent {
 preventDefault: () => void
 target: { value: string }
}
```

#### Composables
```typescript
// any
export function useFilter<T extends Record<string, unknown>>(
 data: T[],
 options: FilterOptions<T>
) {
 //
}
```

### 3:


```json
// tsconfig.json
{
 "compilerOptions": {
 "strict": true,
 "noImplicitAny": true,
 "strictNullChecks": true,
 "strictFunctionTypes": true
 }
}
```


### (1-2 )
1. ****
 -
 -
 -

2. ****
 -
 - `any`

### (3-5 )
1. **Composables **
 -
 - `any`

2. ****
 - props
 -

### (1 )
1. ****
 - TypeScript
 -

2. ****
 -
 -


### (1 )
- ESLint < 20
-
-

### (2 )
- 100%
- `any`
-


- [ ]
- [ ]
- [ ]
- [ ]

### ESLint
- [ ]
- [ ] Composables
- [ ]
- [ ]


- [ ]
- [ ]
- [ ]
- [ ]

---

****: TypeScript `any` 