# Tag Conversation Count & Drilldown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show real conversation counts on each tag card, and let users click to see which conversations have that tag in a modal.

**Architecture:** 3 changes: (1) fix backend `list()` to include real counts via SQL subqueries, (2) add new backend `GET /tags/:id/conversations` endpoint mirroring the existing `GET /tags/:id/customers` pattern, (3) add frontend `TagConversationsModal.vue` + wire up the clickable stat in `TagCard.vue`.

**Tech Stack:** Hono + Drizzle ORM (D1 raw SQL), Vue 3 Composition API, Pinia store, TypeScript

---

## Context

### Root Cause of Missing Counts

In `src/modules/tags/services/tag-service.ts`, the `list()` function (lines 188–202) was simplified and hardcodes zeros:

```typescript
customerCount: 0,      // Simplified without subquery
conversationCount: 0,  // Simplified without subquery
```

The `TagCard.vue` UI already renders `{{ tag.conversationCount || 0 }} 對話` — it just always shows 0.

### Pattern to Follow

`getTagCustomers()` (lines 671–732 of tag-service.ts) is the exact pattern for the new `getTagConversations()` method. Mirror it.

---

## Task 1: Fix Backend — Return Real Counts in Tag List

**Files:**
- Modify: `src/modules/tags/services/tag-service.ts` (lines 127–213, the `list()` function)

### Step 1: Understand what the current query does

The `list()` function does a basic `SELECT` from `tags` with no JOINs to junction tables.
`customerCount` and `conversationCount` are set to `0` in the map. We'll fix this with subqueries.

### Step 2: Replace the query in `list()` with one that includes counts

Find the `list()` function. Replace the `result.map(...)` logic that sets counts to 0 with a raw SQL query that LEFT JOINs and counts.

**Replace this block** (lines ~140–202):

```typescript
// Simplified query: return all active tags
let query = drizzleDb
  .select({
    id: tags.id,
    name: tags.name,
    color: tags.color,
    description: tags.description,
    teamId: tags.teamId,
    isActive: tags.isActive,
    createdBy: tags.createdBy,
    createdAt: tags.createdAt,
    updatedAt: tags.updatedAt,
  })
  .from(tags);

// Build where conditions
const whereConditions: any[] = [eq(tags.isActive, true)];

// Search (simplified: no team distinction)
if (search) {
  const searchTerm = `%${search}%`;
  whereConditions.push(or(
    like(tags.name, searchTerm),
    like(tags.description, searchTerm)
  ));
}

if (whereConditions.length > 0) {
  query = query.where(and(...whereConditions)) as any;
}

query = (query as any)
  .orderBy(asc(tags.name))
  .limit(limit)
  .offset(offset);

const result = await query;

// Count total - use the same where conditions
let countQuery = drizzleDb
  .select({ total: count() })
  .from(tags);

if (whereConditions.length > 0) {
  countQuery = countQuery.where(and(...whereConditions)) as any;
}

const countResult = await countQuery;

const tagsResult: any[] = result.map((row: any) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  description: row.description,
  teamId: row.teamId,
  teamName: null as string | null,
  isActive: Boolean(row.isActive),
  createdBy: row.createdBy,
  createdByName: null as string | null,
  customerCount: 0,        // ← BUG: hardcoded 0
  conversationCount: 0,    // ← BUG: hardcoded 0
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
}));
```

**With this** (uses raw SQL with subqueries — same pattern as `getUsageStats`):

```typescript
// Build WHERE clause for search
const searchCondition = search
  ? sql`AND (t.name LIKE ${'%' + search + '%'} OR t.description LIKE ${'%' + search + '%'})`
  : sql``;

// Main query with counts via subqueries
const result = await drizzleDb.all(sql`
  SELECT
    t.id,
    t.name,
    t.color,
    t.description,
    t.team_id,
    t.is_active,
    t.created_by,
    t.created_at,
    t.updated_at,
    (SELECT COUNT(*) FROM customer_tags WHERE tag_id = t.id) as customer_count,
    (SELECT COUNT(*) FROM conversation_tags WHERE tag_id = t.id) as conversation_count
  FROM tags t
  WHERE t.is_active = TRUE
  ${searchCondition}
  ORDER BY t.name ASC
  LIMIT ${limit} OFFSET ${offset}
`);

// Count total
const countResult = await drizzleDb.get(sql`
  SELECT COUNT(*) as total
  FROM tags t
  WHERE t.is_active = TRUE
  ${searchCondition}
`);

const tagsResult: any[] = (result as any[]).map((row: any) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  description: row.description,
  teamId: row.team_id,
  teamName: null as string | null,
  isActive: Boolean(row.is_active),
  createdBy: row.created_by,
  createdByName: null as string | null,
  customerCount: row.customer_count || 0,
  conversationCount: row.conversation_count || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
}));
```

> **Note:** You no longer need the Drizzle ORM builder imports (`eq`, `and`, `or`, `asc`, `like`, `count`, `inArray`) for this function — but they're used by OTHER functions in the file, so leave the imports as-is.

### Step 3: Manually verify the fix

```bash
npm run dev
# In another terminal, hit the API:
curl -H "Authorization: Bearer <your-jwt>" http://localhost:8787/api/tags | jq '.data[0]'
# Expected: customerCount and conversationCount are non-zero integers (not 0), if data exists
```

### Step 4: Commit

```bash
git add src/modules/tags/services/tag-service.ts
git commit -m "fix(tags): include real customerCount and conversationCount in tag list query"
```

---

## Task 2: Backend — Add `GET /tags/:id/conversations` Endpoint

**Files:**
- Modify: `src/modules/tags/services/tag-service.ts` (add new method after `getTagCustomers`)
- Modify: `src/modules/tags/handlers/tag-main.ts` (register new route)

### Step 1: Add `getTagConversations()` to tag-service.ts

Add this method to the `tagHandler` object, directly after `getTagCustomers` (after line 732, before the closing `};`):

```typescript
// Get conversations for a tag
async getTagConversations(c: Context<{ Bindings: Bindings }>) {
  const drizzleDb = createDbClient(c.env.DB);
  try {
    const tagId = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Check if tag exists
    const tag = await drizzleDb.get(sql`
      SELECT * FROM tags WHERE id = ${tagId}
    `);

    if (!tag) {
      return notFoundResponse(c, 'Tag');
    }

    // Get conversations using this tag
    const conversations = await drizzleDb.all(sql`
      SELECT
        conv.id,
        conv.status,
        conv.channel,
        conv.created_at,
        conv.updated_at,
        cust.display_name as customer_name,
        cust.avatar_url as customer_avatar,
        cust.platform as customer_platform,
        ct.assigned_at,
        ct.assigned_by
      FROM conversation_tags ct
      JOIN conversations conv ON ct.conversation_id = conv.id
      JOIN customers cust ON conv.customer_id = cust.id
      WHERE ct.tag_id = ${tagId}
        AND conv.deleted_at IS NULL
      ORDER BY ct.assigned_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count
    const countResult = await drizzleDb.get(sql`
      SELECT COUNT(*) as total
      FROM conversation_tags ct
      JOIN conversations conv ON ct.conversation_id = conv.id
      WHERE ct.tag_id = ${tagId}
        AND conv.deleted_at IS NULL
    `);

    const total = (countResult as CountRow | null)?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return successResponse(c, {
      conversations: conversations || [],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }, 'Tag conversations retrieved successfully');

  } catch (error) {
    return handleApiError(error, c);
  }
},
```

### Step 2: Register the route in tag-main.ts

In `src/modules/tags/handlers/tag-main.ts`, add the new route in the **Priority 2** section (parameterized multi-segment routes), after the existing `/:id/customers` route:

```typescript
// Get tag's conversation list
tagMainHandler.get('/:id/conversations', tagHandler.getTagConversations);
```

The full Priority 2 section should look like:

```typescript
// ==================== Priority 2: PARAMETERIZED multi-segment routes ====================
// Get tag usage statistics
tagMainHandler.get('/:id/stats', tagHandler.getUsageStats);

// Get tag's customer list
tagMainHandler.get('/:id/customers', tagHandler.getTagCustomers);

// Get tag's conversation list   ← ADD THIS
tagMainHandler.get('/:id/conversations', tagHandler.getTagConversations);
```

### Step 3: Test the endpoint

```bash
npm run dev
curl -H "Authorization: Bearer <your-jwt>" \
  "http://localhost:8787/api/tags/1/conversations?page=1&limit=20" | jq '.'
# Expected: { success: true, data: { conversations: [...], pagination: {...} } }
```

### Step 4: Commit

```bash
git add src/modules/tags/services/tag-service.ts src/modules/tags/handlers/tag-main.ts
git commit -m "feat(tags): add GET /tags/:id/conversations endpoint"
```

---

## Task 3: Frontend API — Add `getTagConversations()` to tags.ts

**Files:**
- Modify: `frontend/src/api/tags.ts`

### Step 1: Add the `TagConversation` interface and response type

Add these types to `frontend/src/api/tags.ts` after the existing interfaces (e.g., after `BulkOperationRequest`):

```typescript
export interface TagConversation {
  id: string
  status: string
  channel: string
  createdAt: string
  updatedAt: string
  customerName: string
  customerAvatar: string | null
  customerPlatform: string
  assignedAt: string
  assignedBy: string
}

export interface TagConversationsResponse {
  success: boolean
  data: {
    conversations: TagConversation[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  message: string
}
```

### Step 2: Add the API function

Add this function at the bottom of `frontend/src/api/tags.ts` (after `getTagCustomers` or at end of file):

```typescript
/**
 * 獲取標籤的對話列表
 */
export const getTagConversations = async (
  tagId: number,
  params?: { page?: number; limit?: number }
): Promise<TagConversationsResponse> => {
  const queryString = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<{
    conversations: TagConversation[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(`/tags/${tagId}/conversations${queryString}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch tag conversations')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Tag conversations retrieved successfully'
  }
}
```

### Step 3: Verify TypeScript compiles

```bash
cd frontend && npm run type-check
# Expected: no errors
```

### Step 4: Commit

```bash
git add frontend/src/api/tags.ts
git commit -m "feat(tags): add getTagConversations API function"
```

---

## Task 4: Frontend — Make Conversation Count Clickable in TagCard

**Files:**
- Modify: `frontend/src/components/customerTags/TagCard.vue`

### Step 1: Add `view-conversations` emit and make count clickable

In `TagCard.vue`, the conversation stat is currently a plain `div`:

```html
<div class="stat-item">
  <MessageCircleIcon />
  <span>{{ tag.conversationCount || 0 }} 對話</span>
</div>
```

Replace with a button that emits `view-conversations` when clicked:

```html
<button
  class="stat-item stat-item-clickable"
  :title="`查看 ${tag.conversationCount || 0} 個對話`"
  :disabled="!tag.conversationCount"
  @click.stop="tag.conversationCount ? $emit('view-conversations') : null"
>
  <MessageCircleIcon />
  <span>{{ tag.conversationCount || 0 }} 對話</span>
</button>
```

Add the emit definition to the `defineEmits` block:

```typescript
defineEmits<{
  select: []
  edit: []
  delete: []
  'view-stats': []
  'view-conversations': []   // ← ADD THIS
}>()
```

Add this CSS class to the `<style scoped>` section:

```css
.stat-item-clickable {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline dotted var(--gray-400);
  transition: color var(--transition-fast);
}

.stat-item-clickable:hover:not(:disabled) {
  color: var(--primary-600);
}

.stat-item-clickable:hover:not(:disabled) svg {
  color: var(--primary-500);
}

.stat-item-clickable:disabled {
  cursor: default;
  text-decoration: none;
}
```

### Step 2: Bubble the event up through TagsList

In `frontend/src/components/customerTags/TagsList.vue`, add `view-conversations` to the emits and forward it from `TagCard`:

In `defineEmits`:
```typescript
defineEmits<{
  'select-tag': [id: number]
  'edit-tag': [tag: Tag]
  'delete-tag': [tag: Tag]
  'view-stats': [tag: Tag]
  'view-conversations': [tag: Tag]   // ← ADD THIS
}>()
```

In the `TagCard` usage:
```html
<TagCard
  v-for="tag in tags"
  :key="tag.id"
  :tag="tag"
  :is-selected="isSelected(tag.id)"
  @select="$emit('select-tag', tag.id)"
  @edit="$emit('edit-tag', tag)"
  @delete="$emit('delete-tag', tag)"
  @view-stats="$emit('view-stats', tag)"
  @view-conversations="$emit('view-conversations', tag)"   <!-- ← ADD THIS -->
/>
```

### Step 3: Verify TypeScript compiles

```bash
cd frontend && npm run type-check
# Expected: no errors
```

### Step 4: Commit

```bash
git add frontend/src/components/customerTags/TagCard.vue \
        frontend/src/components/customerTags/TagsList.vue
git commit -m "feat(tags): make conversation count clickable in TagCard"
```

---

## Task 5: Frontend — Create `TagConversationsModal.vue`

**Files:**
- Create: `frontend/src/components/customerTags/TagConversationsModal.vue`

This modal shows the list of conversations tagged with a specific tag.

### Step 1: Create the component file

```vue
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="`標籤「${tag?.name}」的對話列表`"
      @click.self="$emit('update:visible', false)"
    >
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title-area">
            <span
              class="tag-color-dot"
              :style="{ background: tag?.color }"
            />
            <h2 class="modal-title">{{ tag?.name }}</h2>
            <span class="conversation-count-badge">
              {{ pagination.total }} 個對話
            </span>
          </div>
          <button
            class="close-btn"
            aria-label="關閉"
            @click="$emit('update:visible', false)"
          >
            <XIcon />
          </button>
        </div>

        <!-- Content -->
        <div class="modal-body">
          <!-- Loading -->
          <div v-if="loading" class="state-container">
            <LoadingSpinner size="lg" />
            <p>載入對話中...</p>
          </div>

          <!-- Empty -->
          <div v-else-if="conversations.length === 0" class="state-container">
            <MessageCircleIcon class="empty-icon" />
            <p>此標籤尚未被應用到任何對話</p>
          </div>

          <!-- Conversation List -->
          <ul v-else class="conversation-list" role="list">
            <li
              v-for="conversation in conversations"
              :key="conversation.id"
              class="conversation-item"
              role="listitem"
            >
              <!-- Avatar -->
              <div class="avatar">
                <img
                  v-if="conversation.customerAvatar"
                  :src="conversation.customerAvatar"
                  :alt="conversation.customerName"
                  class="avatar-img"
                >
                <span v-else class="avatar-fallback">
                  {{ conversation.customerName?.charAt(0) || '?' }}
                </span>
              </div>

              <!-- Conversation Info -->
              <div class="conversation-info">
                <div class="conversation-top">
                  <span class="customer-name">{{ conversation.customerName }}</span>
                  <span
                    class="status-badge"
                    :class="`status-${conversation.status}`"
                  >
                    {{ statusLabel(conversation.status) }}
                  </span>
                </div>
                <div class="conversation-meta">
                  <span class="platform-badge">{{ platformLabel(conversation.customerPlatform) }}</span>
                  <span class="assigned-at">標記於 {{ formatDate(conversation.assignedAt) }}</span>
                </div>
              </div>

              <!-- Action -->
              <router-link
                :to="`/conversations/${conversation.id}`"
                class="view-link"
                :title="`前往對話`"
                @click="$emit('update:visible', false)"
              >
                <ExternalLinkIcon />
              </router-link>
            </li>
          </ul>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="pagination">
            <button
              class="pagination-btn"
              :disabled="pagination.page <= 1"
              @click="loadPage(pagination.page - 1)"
            >
              上一頁
            </button>
            <span class="pagination-info">
              第 {{ pagination.page }} / {{ pagination.totalPages }} 頁
            </span>
            <button
              class="pagination-btn"
              :disabled="pagination.page >= pagination.totalPages"
              @click="loadPage(pagination.page + 1)"
            >
              下一頁
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoadingSpinner } from '@/components/ui'
import { XIcon, MessageCircleIcon, ExternalLinkIcon } from '@/components/icons'
import { getTagConversations, type TagConversation } from '@/api/tags'
import type { Tag } from '@/types/tag'

// ==================== Props & Emits ====================

const props = defineProps<{
  visible: boolean
  tag: Tag | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

// ==================== State ====================

const loading = ref(false)
const conversations = ref<TagConversation[]>([])
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

// ==================== Data Loading ====================

async function loadPage(page: number) {
  if (!props.tag) return
  loading.value = true
  try {
    const res = await getTagConversations(props.tag.id, { page, limit: 20 })
    conversations.value = res.data.conversations
    pagination.value = res.data.pagination
  } catch (e) {
    conversations.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.visible, props.tag?.id],
  ([visible]) => {
    if (visible && props.tag) {
      conversations.value = []
      pagination.value = { page: 1, limit: 20, total: 0, totalPages: 0 }
      loadPage(1)
    }
  }
)

// ==================== Helpers ====================

function statusLabel(status: string): string {
  return status === 'active' ? '進行中' : status === 'closed' ? '已關閉' : status
}

function platformLabel(platform: string): string {
  return platform === 'line' ? 'LINE' : platform === 'facebook' ? 'Facebook' : platform
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal-container {
  background: white;
  border-radius: var(--radius-2xl);
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-100);
  flex-shrink: 0;
}

.modal-title-area {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tag-color-dot {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.conversation-count-badge {
  font-size: 0.75rem;
  color: var(--gray-500);
  background: var(--gray-100);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--gray-600);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.close-btn svg { width: 16px; height: 16px; }

.modal-body {
  overflow-y: auto;
  flex: 1;
  padding: var(--space-4) var(--space-6);
}

/* States */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-12) 0;
  color: var(--gray-500);
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--gray-300);
}

/* Conversation List */
.conversation-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-100);
  transition: background var(--transition-fast);
}

.conversation-item:hover {
  background: var(--gray-50);
}

/* Avatar */
.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
}

/* Info */
.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.customer-name {
  font-weight: 500;
  color: var(--gray-900);
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: 0.6875rem;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-weight: 500;
  flex-shrink: 0;
}

.status-active {
  background: var(--green-100);
  color: var(--green-700);
}

.status-closed {
  background: var(--gray-100);
  color: var(--gray-600);
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.platform-badge {
  background: var(--blue-50);
  color: var(--blue-600);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
}

/* View link */
.view-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--gray-400);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.view-link:hover {
  background: var(--primary-50);
  color: var(--primary-600);
}

.view-link svg { width: 16px; height: 16px; }

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--gray-100);
}

.pagination-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--gray-700);
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--gray-500);
}

@media (max-width: 640px) {
  .modal-overlay { padding: var(--space-2); }
  .modal-body { padding: var(--space-3) var(--space-4); }
}
</style>
```

### Step 2: Verify it compiles

```bash
cd frontend && npm run type-check
# Expected: no errors
```

### Step 3: Commit

```bash
git add frontend/src/components/customerTags/TagConversationsModal.vue
git commit -m "feat(tags): add TagConversationsModal component"
```

---

## Task 6: Frontend — Wire Up Modal in CustomerTags.vue

**Files:**
- Modify: `frontend/src/components/customerTags/index.ts` (export new modal)
- Modify: `frontend/src/composables/customerTags/useCustomerTagsController.ts` (add conversations modal state)
- Modify: `frontend/src/views/CustomerTags.vue` (import modal, handle event, render modal)

### Step 1: Export new modal from index.ts

Find `frontend/src/components/customerTags/index.ts`. Add this export:

```typescript
export { default as TagConversationsModal } from './TagConversationsModal.vue'
```

### Step 2: Add conversations modal state to controller

In `frontend/src/composables/customerTags/useCustomerTagsController.ts`, find the modal state section (around line 42–51 where `showStatsModal` is defined). Add:

```typescript
const showConversationsModal = ref(false)
const conversationsTag = ref<Tag | null>(null)
```

Add a function `openConversationsModal` alongside `openStatsModal`:

```typescript
const openConversationsModal = (tag: Tag) => {
  conversationsTag.value = tag
  showConversationsModal.value = true
}
```

In the controller's `return` statement, add `showConversationsModal`, `conversationsTag`, and `openConversationsModal` to the returned object.

### Step 3: Update CustomerTags.vue

**a) Import TagConversationsModal:**

Add `TagConversationsModal` to the import from `@/components/customerTags`:

```typescript
import {
  TagsHeader,
  TagsStats,
  TagsToolbar,
  TagsList,
  TagFormModal,
  DeleteConfirmModal,
  BulkDeleteModal,
  TagConversationsModal     // ← ADD
} from '@/components/customerTags'
```

**b) Destructure from controller:**

In the destructuring of `controller`, add:
```typescript
showConversationsModal,
conversationsTag,
openConversationsModal,
```

**c) Handle `view-conversations` in TagsList:**

In the `<TagsList>` component, add the event handler:

```html
<TagsList
  v-else
  :tags="tags"
  :loading="loading"
  :is-selected="selection.isTagSelected"
  @select-tag="selection.toggleTagSelection"
  @edit-tag="openEditModal"
  @delete-tag="openDeleteModal"
  @view-stats="openStatsModal"
  @view-conversations="openConversationsModal"   <!-- ← ADD -->
/>
```

**d) Add modal to template** (after `<BulkDeleteModal>`):

```html
<!-- Tag Conversations Modal -->
<TagConversationsModal
  v-model:visible="showConversationsModal"
  :tag="conversationsTag"
/>
```

### Step 4: Verify TypeScript and run tests

```bash
cd frontend && npm run type-check
# Expected: no errors

cd frontend && npm run test:run
# Expected: all tests pass (no regressions)
```

### Step 5: Commit

```bash
git add frontend/src/components/customerTags/index.ts \
        frontend/src/composables/customerTags/useCustomerTagsController.ts \
        frontend/src/views/CustomerTags.vue
git commit -m "feat(tags): wire up conversation drilldown modal in CustomerTags page"
```

---

## Task 7: Check Icon Availability

**Files:**
- Check: `frontend/src/components/icons/index.ts`

### Step 1: Verify `ExternalLinkIcon` exists

```bash
grep -r "ExternalLinkIcon\|ExternalLink" frontend/src/components/icons/
```

**If it exists:** great, no action needed.

**If it does NOT exist:** Add it. First check how other icons are defined in `frontend/src/components/icons/index.ts` or equivalent, then add:

```typescript
// External link icon (opens in new tab)
export const ExternalLinkIcon = defineComponent({
  render() {
    return h('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' })
    ])
  }
})
```

Also verify `XIcon` and `MessageCircleIcon` exist (they're already used in existing code, so they should be fine).

### Step 2: Commit if icons were added

```bash
git add frontend/src/components/icons/
git commit -m "feat(icons): add ExternalLinkIcon for tag conversation drilldown"
```

---

## Task 8: Manual E2E Verification

### Step 1: Start dev servers

```bash
# Terminal 1 - backend
npm run dev

# Terminal 2 - frontend
cd frontend && npm run dev
```

### Step 2: Verify in browser at http://localhost:5173/customers/tags

Check the following:

1. **Counts are correct**: Each tag card shows the real number for "X 對話" (not all zeros). If there are no conversations tagged, 0 is correct.

2. **Clickable behaviour**: When `conversationCount > 0`, clicking the "X 對話" text opens the modal.

3. **Modal content**: Modal shows tag name with color dot, total conversation count, and list of conversations with customer name, status badge, platform badge, and date.

4. **Navigation**: Clicking the external link icon on a conversation closes the modal and navigates to `/conversations/<id>`.

5. **Disabled when 0**: When `conversationCount === 0`, the button is non-interactive (no underline, no cursor pointer).

6. **Pagination**: If a tag has > 20 conversations, pagination controls appear and work.

### Step 3: Final commit if anything was tweaked

```bash
git add -A
git commit -m "fix(tags): post-verification tweaks for conversation drilldown"
```

---

## Summary of Changes

| Layer | File | Change |
|-------|------|--------|
| Backend | `src/modules/tags/services/tag-service.ts` | Fix `list()` to include real counts; add `getTagConversations()` |
| Backend | `src/modules/tags/handlers/tag-main.ts` | Register `GET /:id/conversations` route |
| Frontend API | `frontend/src/api/tags.ts` | Add `TagConversation` type + `getTagConversations()` |
| Frontend Component | `frontend/src/components/customerTags/TagCard.vue` | Make conversation count a clickable button |
| Frontend Component | `frontend/src/components/customerTags/TagsList.vue` | Bubble `view-conversations` event |
| Frontend Component | `frontend/src/components/customerTags/TagConversationsModal.vue` | **NEW** - full conversation list modal |
| Frontend Component | `frontend/src/components/customerTags/index.ts` | Export new modal |
| Frontend Composable | `frontend/src/composables/customerTags/useCustomerTagsController.ts` | Add conversations modal state |
| Frontend View | `frontend/src/views/CustomerTags.vue` | Import modal, handle event, render modal |

**Estimated time:** ~2 hours for an experienced developer following this plan.
