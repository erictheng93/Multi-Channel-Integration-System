

, Glassmorphism ,


### 1. API (`frontend/src/api/tags.ts`)
- Tags API
- CRUD
- API
-
- TypeScript

**API :**
- `getTags()` - ()
- `createTag()` -
- `getTagById()` -
- `updateTag()` -
- `deleteTag()` - ()
- `getTagUsageStats()` -
- `bulkOperateTags()` -
- `getCustomerTags()` -
- `addTagsToCustomer()` -
- `removeTagsFromCustomer()` -
- `setCustomerTags()` - ()

### 2. TagSelector (`frontend/src/components/customer/TagSelector.vue`)
- Glassmorphism
-
-
-
-
-

**:**
-
-
-
-
- `alwaysOpen`
-

### 3. (`frontend/src/views/CustomerTags.vue`)
-
-
-
-
-
- //

**:**
```

 [+ ]

 : 12 : 156 : 89

 [] [] []


 VIP

 125 87 43
 [] [] []
 [] [] []
 [] [] []


```

### 4. (`frontend/src/components/conversation/ConversationHeader.vue`)
-
-
-
-
-

**:**
```

 [ ] LINE
 VIP +2
 [ ] []

```

### 5. (`frontend/src/components/ui/AppLayout.vue`)
-
- TagIcon
-
-

### 6. (`frontend/src/router/index.ts`)
- `/customers/tags` -
-
-


### Glassmorphism
```css
/* */
.glass {
 background: rgba(255, 255, 255, 0.08);
 backdrop-filter: blur(20px) saturate(180%);
 border: 1px solid rgba(255, 255, 255, 0.15);
 box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* */
.glass-light {
 background: rgba(255, 255, 255, 0.05);
 backdrop-filter: blur(10px);
 border: 1px solid rgba(255, 255, 255, 0.1);
}

/* */
.glass-primary {
 background: rgba(59, 130, 246, 0.2);
 backdrop-filter: blur(10px);
 border: 1px solid rgba(59, 130, 246, 0.4);
}
```


-
-
-
-


 8 :
- #3B82F6 ()
- #10B981 ()
- #F59E0B ()
- #EF4444 ()
- #8B5CF6 ()
- #EC4899 ()
- #06B6D4 ()
- #84CC16 ()


```
frontend/src/
 api/
 tags.ts # Tags API
 components/
 customer/
 TagSelector.vue #
 conversation/
 ConversationHeader.vue # ()
 icons/
 TagIcon.vue #
 ui/
 AppLayout.vue # ()
 views/
 CustomerTags.vue #
 router/
 index.ts # ()
```


```


ConversationHeader mounted

loadCustomerTags()

getCustomerTags(customerId)


```


```


TagSelector

/


handleTagsChange()

addTagsToCustomer(customerId, tagIds)


```


### TypeScript
```bash
cd frontend && npm run type-check
```
 **0 **


- Tag interface
- CreateTagRequest
- UpdateTagRequest
- TagUsageStats
- BulkOperationRequest
- PaginatedTagsResponse
- TagResponse
- TagStatsResponse


### 1.
 `/customers/tags`

### 2.
1. +
2. :
 - ()
 -
 - ()
 - (/)
3.

### 3.
:
1.
2.
3.
4.

### 4.
:
-
- /
-
- /
-


### API

#### CRUD
- `GET /api/tags` -
- `POST /api/tags` -
- `GET /api/tags/:id` -
- `PUT /api/tags/:id` -
- `DELETE /api/tags/:id` -
- `GET /api/tags/:id/stats` -
- `POST /api/tags/bulk` -


- `GET /api/customers/:id/tags` -
- `POST /api/customers/:id/tags` -
- `DELETE /api/customers/:id/tags` -
- `PUT /api/customers/:id/tags` -


 API :
```typescript
{
 success: boolean
 data?: T
 error?: string
 message?: string
}
```


- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ] /
- [ ]


-
-
-
-
-
- API


- < 200ms
- < 100ms
- < 50ms
- < 300ms


1. 8 ( color input )
2. UI
3.
4.


- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+


### 2025-10-01
- Tags API
- TagSelector
-
-
-
- TypeScript


,,


,:
1. TypeScript
2. API
3.
4.

---

****: 2025-10-01
****: Claude Code
****: 1.0.0
****:
