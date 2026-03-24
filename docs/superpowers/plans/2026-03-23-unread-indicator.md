# Unread Message Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a green dot unread indicator (LINE OA style) to all three conversation list views for visual consistency.

**Architecture:** Frontend-only change. The data model (`Conversation.unreadCount`) and API layer already support unread tracking. We add visual indicators (green dot + bold text + tinted background) to `ConversationDesktopTable.vue`, `ConversationMobileCards.vue`, and update `ConversationCard.vue` from red count badge to green dot.

**Tech Stack:** Vue 3 (Composition API), CSS scoped styles, Vitest + Vue Test Utils

**Spec:** `docs/superpowers/specs/2026-03-23-unread-indicator-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/components/conversations/ConversationDesktopTable.vue` | Modify | Add green dot, `has-unread` class, bold styles |
| `frontend/src/components/conversations/ConversationMobileCards.vue` | Modify | Add green dot, `has-unread` class, bold styles |
| `frontend/src/components/conversation/ConversationCard.vue` | Modify | Replace red badge with green dot, update background tint |
| `frontend/tests/unit/components/conversations/ConversationDesktopTable.test.ts` | Modify | Add unread indicator tests |
| `frontend/tests/unit/components/conversation/ConversationCard.test.ts` | Modify | Update badge tests for dot change |
| `frontend/tests/unit/components/conversations/ConversationMobileCards.test.ts` | Modify | Add unread indicator tests |

---

### Task 1: Add unread indicator to ConversationDesktopTable.vue

**Files:**
- Modify: `frontend/src/components/conversations/ConversationDesktopTable.vue`
- Test: `frontend/tests/unit/components/conversations/ConversationDesktopTable.test.ts`

- [ ] **Step 1: Write failing tests for unread indicator in desktop table**

Add these tests to `frontend/tests/unit/components/conversations/ConversationDesktopTable.test.ts`:

```typescript
describe('Unread indicator', () => {
  it('should show unread dot when conversation has unreadCount > 0', () => {
    const conv = createConversation({ unreadCount: 3 })
    const wrapper = mountTable([conv])
    expect(wrapper.find('.unread-dot').exists()).toBe(true)
  })

  it('should not show unread dot when unreadCount is 0', () => {
    const conv = createConversation({ unreadCount: 0 })
    const wrapper = mountTable([conv])
    expect(wrapper.find('.unread-dot').exists()).toBe(false)
  })

  it('should add has-unread class to row when unread', () => {
    const conv = createConversation({ unreadCount: 5 })
    const wrapper = mountTable([conv])
    expect(wrapper.find('.conversation-row').classes()).toContain('has-unread')
  })

  it('should not add has-unread class when read', () => {
    const conv = createConversation({ unreadCount: 0 })
    const wrapper = mountTable([conv])
    expect(wrapper.find('.conversation-row').classes()).not.toContain('has-unread')
  })

  it('should include sr-only text for accessibility', () => {
    const conv = createConversation({ unreadCount: 2 })
    const wrapper = mountTable([conv])
    const srOnly = wrapper.find('.sr-only')
    expect(srOnly.exists()).toBe(true)
    expect(srOnly.text()).toContain('未讀')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run tests/unit/components/conversations/ConversationDesktopTable.test.ts`
Expected: FAIL — `.unread-dot` and `.has-unread` not found

- [ ] **Step 3: Add unread indicator to template**

In `frontend/src/components/conversations/ConversationDesktopTable.vue`, modify the `<tr>` to add `has-unread` class and the customer cell to include the green dot:

```vue
<tr
  v-for="(conversation, index) in conversations"
  :key="conversation.id"
  class="conversation-row"
  :class="{ 'has-unread': conversation.unreadCount > 0 }"
  :style="{ animationDelay: `${index * 50}ms` }"
  @click="$emit('select', conversation.id)"
>
  <td class="customer-cell">
    <div class="customer-info">
      <div
        v-if="conversation.unreadCount > 0"
        class="unread-dot"
      >
        <span class="sr-only">未讀</span>
      </div>
      <div
        v-else
        class="unread-dot-spacer"
      />
      <div>
        <div class="customer-name">
          {{ conversation.customer?.name || conversation.user?.name || (conversation as any).customer_name || '未知用戶' }}
        </div>
        <div class="customer-id">
          ID: {{ conversation.userId }}
        </div>
      </div>
    </div>
  </td>
```

- [ ] **Step 4: Add CSS styles for unread indicator**

Add these styles to the `<style scoped>` section:

```css
/* Unread indicator */
.customer-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.unread-dot {
  width: 9px;
  height: 9px;
  background: #34C759;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(52, 199, 89, 0.4);
}

.unread-dot-spacer {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
}

.conversation-row.has-unread {
  background: #F8FAFF;
}

.conversation-row.has-unread .customer-name {
  font-weight: 700;
  color: #1C1C1E;
}

.conversation-row.has-unread .last-message {
  font-weight: 600;
  color: #1C1C1E;
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Remove the old `.customer-info` flex-direction column style (lines 232-236 of original) since the new layout uses row direction with the dot.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run tests/unit/components/conversations/ConversationDesktopTable.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/conversations/ConversationDesktopTable.vue frontend/tests/unit/components/conversations/ConversationDesktopTable.test.ts
git commit -m "feat(conversations): add green dot unread indicator to desktop table"
```

---

### Task 2: Add unread indicator to ConversationMobileCards.vue

**Files:**
- Modify: `frontend/src/components/conversations/ConversationMobileCards.vue`
- Test: `frontend/tests/unit/components/conversations/ConversationMobileCards.test.ts`

- [ ] **Step 1: Write failing tests for unread indicator in mobile cards**

Add these tests to `frontend/tests/unit/components/conversations/ConversationMobileCards.test.ts`:

```typescript
describe('Unread indicator', () => {
  it('should show unread dot when conversation has unreadCount > 0', () => {
    const conv = createConversation({ unreadCount: 3 })
    const wrapper = mountCards([conv])
    expect(wrapper.find('.unread-dot').exists()).toBe(true)
  })

  it('should not show unread dot when unreadCount is 0', () => {
    const conv = createConversation({ unreadCount: 0 })
    const wrapper = mountCards([conv])
    expect(wrapper.find('.unread-dot').exists()).toBe(false)
  })

  it('should add has-unread class to card when unread', () => {
    const conv = createConversation({ unreadCount: 5 })
    const wrapper = mountCards([conv])
    expect(wrapper.find('.conversation-card').classes()).toContain('has-unread')
  })

  it('should not add has-unread class when read', () => {
    const conv = createConversation({ unreadCount: 0 })
    const wrapper = mountCards([conv])
    expect(wrapper.find('.conversation-card').classes()).not.toContain('has-unread')
  })

  it('should include sr-only text for accessibility', () => {
    const conv = createConversation({ unreadCount: 2 })
    const wrapper = mountCards([conv])
    const srOnly = wrapper.find('.sr-only')
    expect(srOnly.exists()).toBe(true)
    expect(srOnly.text()).toContain('未讀')
  })
})
```

Note: Adapt mount helper name to match the existing test file's convention (may be `mountCards`, `mountComponent`, or similar).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run tests/unit/components/conversations/ConversationMobileCards.test.ts`
Expected: FAIL — `.unread-dot` and `.has-unread` not found

- [ ] **Step 3: Add unread indicator to mobile card template**

In `frontend/src/components/conversations/ConversationMobileCards.vue`, add `has-unread` class to the card div and add a green dot to the card header:

```vue
<div
  v-for="(conversation, index) in conversations"
  :key="conversation.id"
  class="conversation-card"
  :class="{ 'has-unread': conversation.unreadCount > 0 }"
  :style="{ animationDelay: `${index * 50}ms` }"
  @click="$emit('select', conversation.id)"
>
  <div class="card-header">
    <div class="customer-info">
      <div
        v-if="conversation.unreadCount > 0"
        class="unread-dot"
      >
        <span class="sr-only">未讀</span>
      </div>
      <div>
        <div class="customer-name">
          {{ conversation.customer?.name || conversation.user?.name || (conversation as any).customer_name || '未知用戶' }}
        </div>
        <div class="customer-id">
          ID: {{ conversation.userId }}
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Add CSS styles for unread indicator**

Add these styles to the `<style scoped>` section:

```css
/* Unread indicator */
.unread-dot {
  width: 9px;
  height: 9px;
  background: #34C759;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(52, 199, 89, 0.4);
}

.conversation-card.has-unread {
  background: #F8FAFF;
}

.conversation-card.has-unread .customer-name {
  font-weight: 700;
  color: #1C1C1E;
}

.conversation-card.has-unread .last-message {
  font-weight: 600;
  color: #1C1C1E;
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Update the existing `.customer-info` style (lines 188-192) to use flex row with alignment. **Preserve** `.card-header .customer-info { flex: 1; }` (line 184-186) — only modify the general `.customer-info` block:

```css
/* Keep this rule unchanged: */
.card-header .customer-info {
  flex: 1;
}

/* Update this rule — change flex-direction from column to row: */
.customer-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run tests/unit/components/conversations/ConversationMobileCards.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Run type check and lint**

Run: `cd frontend && bunx vue-tsc --noEmit && bunx eslint src/components/conversations/ConversationMobileCards.vue --fix`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/conversations/ConversationMobileCards.vue frontend/tests/unit/components/conversations/ConversationMobileCards.test.ts
git commit -m "feat(conversations): add green dot unread indicator to mobile cards"
```

---

### Task 3: Update ConversationCard.vue — replace red badge with green dot

**Files:**
- Modify: `frontend/src/components/conversation/ConversationCard.vue`
- Test: `frontend/tests/unit/components/conversation/ConversationCard.test.ts`

- [ ] **Step 1: Update tests for green dot instead of count badge**

In `frontend/tests/unit/components/conversation/ConversationCard.test.ts`, update the unread badge tests (around lines 236-263):

Replace the test `'當有未讀訊息時應顯示未讀徽章'`:

```typescript
it('當有未讀訊息時應顯示未讀標識 (green dot)', () => {
  const conversation = createMockConversation({
    unreadCount: 5
  })
  const wrapper = createWrapper(conversation)

  const unreadBadge = wrapper.find('.unread-badge')
  expect(unreadBadge.exists()).toBe(true)
  // Green dot has no text content (no count display)
  expect(unreadBadge.text()).toBe('')
})
```

Remove the test `'未讀數超過99時應顯示99+'` since the dot doesn't show counts.

Keep the test `'無未讀訊息時不應顯示未讀徽章'` as-is (it checks `.unread-badge` doesn't exist when `unreadCount: 0`).

Add a test for `has-unread` class applying green background:

```typescript
it('當有未讀訊息時應有 has-unread class', () => {
  const conversation = createMockConversation({
    unreadCount: 3
  })
  const wrapper = createWrapper(conversation)

  expect(wrapper.classes()).toContain('has-unread')
})

it('無未讀訊息時不應有 has-unread class', () => {
  const conversation = createMockConversation({
    unreadCount: 0
  })
  const wrapper = createWrapper(conversation)

  expect(wrapper.classes()).not.toContain('has-unread')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run tests/unit/components/conversation/ConversationCard.test.ts`
Expected: FAIL — badge still shows count text

- [ ] **Step 3: Update template — replace count badge with green dot**

In `frontend/src/components/conversation/ConversationCard.vue`, replace lines 106-114:

Old:
```vue
<!-- Unread Count -->
<Transition name="scale-pop">
  <div
    v-if="hasUnreadMessages"
    class="unread-badge"
  >
    {{ formattedUnreadCount }}
  </div>
</Transition>
```

New:
```vue
<!-- Unread Dot -->
<Transition name="scale-pop">
  <div
    v-if="hasUnreadMessages"
    class="unread-badge"
  />
</Transition>
```

Note: Keep class name as `unread-badge` to minimize test changes. The CSS will redefine its appearance.

- [ ] **Step 4: Update CSS — green dot + green tinted background**

In `frontend/src/components/conversation/ConversationCard.vue`, update these styles:

Replace `.has-unread` background (line ~380-382):
```css
.conversation-card-apple.has-unread {
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.06) 0%, var(--apple-bg) 50%);
}
```

Replace `.unread-badge` styles (lines ~628-640):
```css
.unread-badge {
  width: 12px;
  height: 12px;
  background: var(--apple-green);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(52, 199, 89, 0.5);
  flex-shrink: 0;
}
```

- [ ] **Step 5: Clean up unused computed — remove formattedUnreadCount**

In the `<script setup>` section, the `formattedUnreadCount` computed (lines 181-184) is no longer used. Remove it:

```typescript
// DELETE these lines:
const formattedUnreadCount = computed(() => {
  const count = props.conversation.unreadCount || 0
  return count > 99 ? '99+' : String(count)
})
```

Keep `hasUnreadMessages` — it's still used by the template and `is-unread` class on message preview.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run tests/unit/components/conversation/ConversationCard.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run full frontend test suite**

Run: `cd frontend && bunx vitest run`
Expected: ALL PASS — no regressions

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/conversation/ConversationCard.vue frontend/tests/unit/components/conversation/ConversationCard.test.ts
git commit -m "feat(conversations): replace red count badge with green dot in conversation card"
```

---

### Task 4: Visual verification

- [ ] **Step 1: Run dev server and verify in browser**

Run: `cd frontend && bun run dev`

Open the app and check:
1. Desktop table view: unread conversations show green dot + bold text + tinted background
2. Mobile view (resize to <768px): mobile cards show green dot + bold text
3. Conversation list (card view): unread cards show green dot instead of red count badge
4. Read conversations: no dot, normal weight, white background
5. Hover states still work correctly on all views

- [ ] **Step 2: Run full checks**

Run: `bash scripts/check.sh frontend`
Expected: PASS — no type errors, no lint warnings
