# ActionEditor Collapsible Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ActionEditor action cards into collapsible dual-state cards (editing/collapsed) to provide completion feedback and reduce visual clutter.

**Architecture:** Pure UI change within `ActionEditor.vue`. A local `Set<number>` tracks which card indices are in editing mode. Collapsed cards show a single-row preview; editing cards show the full form. No changes to parent components or event contracts.

**Tech Stack:** Vue 3 Composition API, TypeScript strict mode, Vitest + Vue Test Utils

**Spec:** `docs/superpowers/specs/2026-03-19-action-editor-collapsible-cards-design.md`

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `frontend/src/components/auto-reply/ActionEditor.vue` | Major rewrite | Collapsible card template, editing state management, styles |
| `frontend/src/components/auto-reply/ActionEditor.test.ts` | Update + add tests | Test collapsed/editing states, transitions, index recalculation |

No other files are modified. The emit interface (`add`, `remove`, `update-content`) is unchanged.

## CSS Variable Reference

These existing variables from `frontend/src/styles/variables.css` will be used:

```
--gray-50: #f9fafb         (collapsed card bg)
--primary-50: #eff6ff      (editing highlight tint)
--success-500: #22c55e     (done status dot)
--warning-500: #f59e0b     (editing status dot)
--error-500: #ef4444       (delete icon hover)
--error-50: #fef2f2        (delete icon hover bg)
--shadow-sm                (editing card shadow)
--radius-xl: 0.75rem       (card border-radius, 12px — nested card level)
--radius-full: 9999px      (confirm/cancel buttons, capsule)
--transition-normal: 300ms (expand/collapse animation)
--transition-fast: 150ms   (hover states)
--space-1..space-6         (spacing tokens)
```

---

### Task 1: Update Existing Tests for New DOM Structure

The template rewrite changes CSS class names. Update existing tests first so we have a clear target.

**Files:**
- Modify: `frontend/src/components/auto-reply/ActionEditor.test.ts`

- [ ] **Step 1: Update rendering tests for new class names**

Replace `.action-card` with `.action-card-new` throughout. Update selectors for the new collapsed/editing structure. The key class mapping:

| Old selector | New selector | Notes |
|---|---|---|
| `.action-card` | `.action-card-new` | Card wrapper |
| `.btn-danger` (delete) | `.btn-icon--delete` | Icon button in collapsed header |
| `.action-body input` | `.expanded-body input` | Form fields inside expanded body |
| `.action-textarea` | `.expanded-body .action-textarea` | Textarea inside expanded body |
| `.action-textarea--json` | `.expanded-body .action-textarea--json` | JSON textarea |
| `.action-empty` | `.action-empty` | Unchanged |
| `.action-dropdown` | `.action-dropdown` | Unchanged |
| `.btn-add-action` | `.btn-add-action` | Unchanged |
| `.action-dropdown-item` | `.action-dropdown-item` | Unchanged |

Update `ActionEditor.test.ts` — replace the full `describe('ActionEditor -- rendering')` and `describe('ActionEditor -- emitted events')` blocks:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionEditor from './ActionEditor.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Action {
  actionType: 'reply_text' | 'reply_image' | 'reply_flex'
  content: string
  sortOrder: number
}

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    actionType: 'reply_text',
    content: JSON.stringify({ text: 'Hello' }),
    sortOrder: 0,
    ...overrides,
  }
}

function mountEditor(actions: Action[] = []) {
  return mount(ActionEditor, {
    props: { actions },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('ActionEditor -- rendering', () => {
  it('renders action cards for each action', () => {
    const actions = [makeAction(), makeAction({ sortOrder: 1 })]
    const wrapper = mountEditor(actions)
    expect(wrapper.findAll('.action-card-new')).toHaveLength(2)
  })

  it('shows action type label badge (reply_text -> text label)', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    expect(wrapper.find('.badge').text()).toBe('文字')
  })

  it('shows empty state when actions=[]', () => {
    const wrapper = mountEditor([])
    expect(wrapper.find('.action-empty').exists()).toBe(true)
    expect(wrapper.find('.action-empty').text()).toContain('尚未設定動作')
  })

  it('renders cards in collapsed state by default (existing content)', () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')
    expect(card.classes()).not.toContain('editing')
    expect(card.find('.collapsed-preview').exists()).toBe(true)
  })

  it('shows preview text for reply_text in collapsed state', () => {
    const wrapper = mountEditor([makeAction({ content: JSON.stringify({ text: 'Hello World' }) })])
    expect(wrapper.find('.collapsed-preview').text()).toBe('Hello World')
  })

  it('shows preview url for reply_image in collapsed state', () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: 'https://example.com/img.jpg', previewUrl: '' }),
      }),
    ])
    expect(wrapper.find('.collapsed-preview').text()).toBe('https://example.com/img.jpg')
  })

  it('hides dropdown by default', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)
  })

  it('shows dropdown menu with 3 options when open', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')
    const items = wrapper.findAll('.action-dropdown-item')
    expect(items).toHaveLength(3)
  })
})

// ===========================================================================
// Collapse / Expand behavior
// ===========================================================================

describe('ActionEditor -- collapse/expand', () => {
  it('expands card when clicking collapsed header', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')
    expect(card.classes()).not.toContain('editing')

    await card.find('.collapsed-header').trigger('click')
    expect(card.classes()).toContain('editing')
  })

  it('expands card when clicking edit icon button', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')
    await card.find('.btn-icon--edit').trigger('click')
    expect(card.classes()).toContain('editing')
  })

  it('collapses card when clicking confirm button', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')

    // First expand
    await card.find('.collapsed-header').trigger('click')
    expect(card.classes()).toContain('editing')

    // Then confirm
    await card.find('.btn-confirm').trigger('click')
    expect(card.classes()).not.toContain('editing')
  })

  it('collapses card when clicking cancel button', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')

    await card.find('.collapsed-header').trigger('click')
    expect(card.classes()).toContain('editing')

    await card.find('.btn-cancel').trigger('click')
    expect(card.classes()).not.toContain('editing')
  })

  it('shows status-dot--done when collapsed', () => {
    const wrapper = mountEditor([makeAction()])
    expect(wrapper.find('.status-dot--done').exists()).toBe(true)
  })

  it('shows status-dot--editing when expanded', async () => {
    const wrapper = mountEditor([makeAction()])
    await wrapper.find('.collapsed-header').trigger('click')
    expect(wrapper.find('.status-dot--editing').exists()).toBe(true)
  })

  it('shows expanded-body with textarea when editing reply_text', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    await wrapper.find('.collapsed-header').trigger('click')
    expect(wrapper.find('.expanded-body .action-textarea').exists()).toBe(true)
  })

  it('shows expanded-body with inputs when editing reply_image', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: '', previewUrl: '' }),
      }),
    ])
    await wrapper.find('.collapsed-header').trigger('click')
    const inputs = wrapper.findAll('.expanded-body input[type="text"]')
    expect(inputs).toHaveLength(2)
  })

  it('shows expanded-body with JSON textarea when editing reply_flex', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_flex',
        content: JSON.stringify({ type: 'bubble' }),
      }),
    ])
    await wrapper.find('.collapsed-header').trigger('click')
    expect(wrapper.find('.expanded-body .action-textarea--json').exists()).toBe(true)
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('ActionEditor -- emitted events', () => {
  it('emits remove with index on delete button click', async () => {
    const wrapper = mountEditor([makeAction(), makeAction({ sortOrder: 1 })])
    const deleteButtons = wrapper.findAll('.btn-icon--delete')
    await deleteButtons[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([1])
  })

  it('toggles dropdown on add button click', async () => {
    const wrapper = mountEditor()
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)

    await wrapper.find('.btn-add-action').trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(true)

    await wrapper.find('.btn-add-action').trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)
  })

  it('emits add with reply_text when selecting text option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[0]!.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_text'])
  })

  it('emits add with reply_image when selecting image option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[1]!.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_image'])
  })

  it('emits add with reply_flex when selecting flex option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[2]!.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_flex'])
  })

  it('closes dropdown after selecting action type', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(true)

    const items = wrapper.findAll('.action-dropdown-item')
    await items[0]!.trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)
  })

  it('emits update-content when editing text content in expanded card', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])

    // Expand first
    await wrapper.find('.collapsed-header').trigger('click')

    const textarea = wrapper.find('.expanded-body .action-textarea')
    const el = textarea.element as HTMLTextAreaElement
    el.value = 'new text'
    await textarea.trigger('input')

    expect(wrapper.emitted('update-content')).toBeTruthy()
    const payload = wrapper.emitted('update-content')![0]!
    expect(payload[0]).toBe(0)
    expect(JSON.parse(payload[1] as string)).toEqual({ text: 'new text' })
  })
})

// ===========================================================================
// Index management on delete
// ===========================================================================

describe('ActionEditor -- editing index recalculation', () => {
  it('shifts editing state down when a card before it is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 2, content: JSON.stringify({ text: 'Third' }) }),
    ]
    const wrapper = mountEditor(actions)

    // Expand card at index 2
    const cards = wrapper.findAll('.action-card-new')
    await cards[2]!.find('.collapsed-header').trigger('click')
    expect(cards[2]!.classes()).toContain('editing')

    // Delete card at index 0 — triggers handleRemove which shifts indices
    await cards[0]!.find('.btn-icon--delete').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    // Simulate parent removing item 0 and re-rendering
    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Third' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    // Card formerly at index 2 (now index 1) should still be editing
    const newCards = wrapper.findAll('.action-card-new')
    expect(newCards).toHaveLength(2)
    expect(newCards[1]!.classes()).toContain('editing')
    expect(newCards[0]!.classes()).not.toContain('editing')
  })

  it('removes editing state when the editing card itself is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
    ]
    const wrapper = mountEditor(actions)

    // Expand card at index 0
    const cards = wrapper.findAll('.action-card-new')
    await cards[0]!.find('.collapsed-header').trigger('click')
    expect(cards[0]!.classes()).toContain('editing')

    // Delete card at index 0
    // Need to find the delete button inside expanded-body or use handleRemove
    // In editing state, the delete button is hidden (collapsed-actions hidden)
    // So we cancel first, then delete from collapsed state
    await wrapper.find('.btn-cancel').trigger('click')
    await cards[0]!.find('.btn-icon--delete').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    // Simulate parent removing item 0
    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    // Remaining card should NOT be editing
    const newCards = wrapper.findAll('.action-card-new')
    expect(newCards).toHaveLength(1)
    expect(newCards[0]!.classes()).not.toContain('editing')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (component not updated yet)**

Run: `cd frontend && bunx vitest run src/components/auto-reply/ActionEditor.test.ts`
Expected: Multiple FAILs — `.action-card-new` not found, `.collapsed-header` not found, etc.

- [ ] **Step 3: Commit test updates**

```bash
git add frontend/src/components/auto-reply/ActionEditor.test.ts
git commit -m "test: update ActionEditor tests for collapsible card structure"
```

---

### Task 2: Rewrite ActionEditor.vue Template

Replace the always-expanded card template with the dual-state collapsed/editing template.

**Files:**
- Modify: `frontend/src/components/auto-reply/ActionEditor.vue` (template section only)

- [ ] **Step 1: Replace the template block**

Replace the entire `<template>` section of `ActionEditor.vue` with:

```html
<template>
  <div class="action-editor">
    <div class="action-list">
      <div
        v-for="(action, index) in actions"
        :key="index"
        :class="['action-card-new', { editing: editingIndices.has(index) }]"
      >
        <!-- Collapsed header (always visible) -->
        <div
          class="collapsed-header"
          @click="toggleEdit(index)"
        >
          <span
            :class="[
              'status-dot',
              editingIndices.has(index) ? 'status-dot--editing' : 'status-dot--done'
            ]"
          />
          <span :class="['badge', `badge--${action.actionType}`]">
            {{ actionTypeLabel(action.actionType) }}
          </span>
          <span
            v-if="!editingIndices.has(index)"
            class="collapsed-preview"
          >
            {{ getPreviewText(action) }}
          </span>
          <div
            v-if="!editingIndices.has(index)"
            class="collapsed-actions"
          >
            <button
              type="button"
              class="btn-icon btn-icon--edit"
              title="編輯"
              @click.stop="startEdit(index)"
            >
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button
              type="button"
              class="btn-icon btn-icon--delete"
              title="刪除"
              @click.stop="handleRemove(index)"
            >
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            </button>
          </div>
        </div>

        <!-- Expanded body (only visible when editing) -->
        <div
          v-if="editingIndices.has(index)"
          class="expanded-body"
        >
          <!-- reply_text -->
          <template v-if="action.actionType === 'reply_text'">
            <div class="form-group">
              <label class="form-label">回覆文字</label>
              <textarea
                class="form-input action-textarea"
                rows="3"
                :value="parseTextContent(action.content)"
                placeholder="輸入回覆文字..."
                @input="handleTextUpdate(index, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </template>

          <!-- reply_image -->
          <template v-else-if="action.actionType === 'reply_image'">
            <div class="form-group">
              <label class="form-label">圖片網址</label>
              <input
                type="text"
                class="form-input"
                :value="parseImageField(action.content, 'url')"
                placeholder="https://example.com/image.jpg"
                @input="handleImageUpdate(index, action.content, 'url', ($event.target as HTMLInputElement).value)"
              >
            </div>
            <div class="form-group">
              <label class="form-label">預覽圖網址</label>
              <input
                type="text"
                class="form-input"
                :value="parseImageField(action.content, 'previewUrl')"
                placeholder="https://example.com/preview.jpg"
                @input="handleImageUpdate(index, action.content, 'previewUrl', ($event.target as HTMLInputElement).value)"
              >
            </div>
          </template>

          <!-- reply_flex -->
          <template v-else-if="action.actionType === 'reply_flex'">
            <div class="form-group">
              <label class="form-label">Flex Message JSON</label>
              <textarea
                class="form-input action-textarea action-textarea--json"
                rows="6"
                :value="formatJsonContent(action.content)"
                placeholder="{&quot;type&quot;: &quot;bubble&quot;, ...}"
                @input="handleFlexUpdate(index, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </template>

          <!-- Confirm / Cancel footer -->
          <div class="expanded-footer">
            <button
              type="button"
              class="btn btn-secondary btn-cancel"
              @click="cancelEdit(index)"
            >
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary btn-confirm"
              @click="confirmEdit(index)"
            >
              確認完成
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="actions.length === 0"
        class="action-empty"
      >
        尚未設定動作
      </div>
    </div>

    <div class="action-add">
      <div class="action-add-wrapper">
        <button
          type="button"
          class="btn btn-secondary btn-add-action"
          @click="toggleDropdown"
        >
          + 新增動作
        </button>
        <div
          v-if="showDropdown"
          class="action-dropdown"
        >
          <button
            type="button"
            class="action-dropdown-item"
            @click="handleAddAction('reply_text')"
          >
            文字回覆
          </button>
          <button
            type="button"
            class="action-dropdown-item"
            @click="handleAddAction('reply_image')"
          >
            圖片回覆
          </button>
          <button
            type="button"
            class="action-dropdown-item"
            @click="handleAddAction('reply_flex')"
          >
            Flex 訊息
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit template change**

```bash
git add frontend/src/components/auto-reply/ActionEditor.vue
git commit -m "feat(auto-reply): rewrite ActionEditor template for collapsible cards"
```

---

### Task 3: Update ActionEditor.vue Script for Editing State

Add the `editingIndices` Set and all the state management functions.

**Files:**
- Modify: `frontend/src/components/auto-reply/ActionEditor.vue` (script section only)

- [ ] **Step 1: Replace the script block**

Replace the entire `<script setup lang="ts">` section with:

```typescript
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  actions: Array<{
    actionType: 'reply_text' | 'reply_image' | 'reply_flex'
    content: string
    sortOrder: number
  }>
}>()

const emit = defineEmits<{
  'add': [actionType: string]
  'remove': [index: number]
  'update-content': [index: number, content: string]
}>()

const showDropdown = ref(false)
const editingIndices = ref<Set<number>>(new Set())

// ---------------------------------------------------------------------------
// Editing state management
// ---------------------------------------------------------------------------

function startEdit(index: number): void {
  editingIndices.value = new Set(editingIndices.value).add(index)
}

function confirmEdit(index: number): void {
  const updated = new Set(editingIndices.value)
  updated.delete(index)
  editingIndices.value = updated
}

function cancelEdit(index: number): void {
  const updated = new Set(editingIndices.value)
  updated.delete(index)
  editingIndices.value = updated
}

function toggleEdit(index: number): void {
  if (editingIndices.value.has(index)) return // don't collapse by clicking header while editing
  startEdit(index)
}

function handleRemove(index: number): void {
  // Recalculate editingIndices: remove the deleted index, shift higher indices down by 1
  const updated = new Set<number>()
  for (const idx of editingIndices.value) {
    if (idx === index) continue // remove deleted
    if (idx > index) {
      updated.add(idx - 1) // shift down
    } else {
      updated.add(idx) // keep as-is
    }
  }
  editingIndices.value = updated
  emit('remove', index)
}

// ---------------------------------------------------------------------------
// Preview text
// ---------------------------------------------------------------------------

function getPreviewText(action: { actionType: string; content: string }): string {
  try {
    const parsed = JSON.parse(action.content)
    if (typeof parsed !== 'object' || parsed === null) return String(parsed)

    switch (action.actionType) {
      case 'reply_text':
        return parsed.text ?? ''
      case 'reply_image':
        return parsed.url ?? ''
      case 'reply_flex':
        return action.content.length > 50
          ? action.content.substring(0, 50) + '...'
          : action.content
      default:
        return ''
    }
  } catch {
    return action.content
  }
}

// ---------------------------------------------------------------------------
// Action type labels
// ---------------------------------------------------------------------------

function actionTypeLabel(type: string): string {
  /* eslint-disable camelcase */
  const labels: Record<string, string> = {
    reply_text: '文字',
    reply_image: '圖片',
    reply_flex: 'Flex'
  }
  /* eslint-enable camelcase */
  return labels[type] ?? type
}

// ---------------------------------------------------------------------------
// Content parsing (unchanged from original)
// ---------------------------------------------------------------------------

function parseTextContent(content: string): string {
  try {
    const parsed = JSON.parse(content)
    return typeof parsed === 'object' && parsed !== null ? (parsed.text ?? '') : String(parsed)
  } catch {
    return content
  }
}

function parseImageField(content: string, field: 'url' | 'previewUrl'): string {
  try {
    const parsed = JSON.parse(content)
    return typeof parsed === 'object' && parsed !== null ? (parsed[field] ?? '') : ''
  } catch {
    return ''
  }
}

function formatJsonContent(content: string): string {
  try {
    const parsed = JSON.parse(content)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return content
  }
}

// ---------------------------------------------------------------------------
// Content update handlers (unchanged from original)
// ---------------------------------------------------------------------------

function handleTextUpdate(index: number, text: string): void {
  emit('update-content', index, JSON.stringify({ text }))
}

function handleImageUpdate(
  index: number,
  currentContent: string,
  field: 'url' | 'previewUrl',
  value: string
): void {
  let parsed: Record<string, string> = {}
  try {
    const obj = JSON.parse(currentContent)
    if (typeof obj === 'object' && obj !== null) {
      parsed = obj as Record<string, string>
    }
  } catch {
    // use empty object
  }
  parsed[field] = value
  emit('update-content', index, JSON.stringify(parsed))
}

function handleFlexUpdate(index: number, raw: string): void {
  emit('update-content', index, raw)
}

// ---------------------------------------------------------------------------
// Dropdown & add action
// ---------------------------------------------------------------------------

function toggleDropdown(): void {
  showDropdown.value = !showDropdown.value
}

function handleAddAction(actionType: string): void {
  const newIndex = props.actions.length
  emit('add', actionType)
  // Auto-expand the newly added card
  editingIndices.value = new Set(editingIndices.value).add(newIndex)
  showDropdown.value = false
}
</script>
```

- [ ] **Step 2: Commit script change**

```bash
git add frontend/src/components/auto-reply/ActionEditor.vue
git commit -m "feat(auto-reply): add editing state management for collapsible cards"
```

---

### Task 4: Update ActionEditor.vue Styles

Replace old styles with the new collapsible card styles following the Apple-Native Soft Minimalism design system.

**Files:**
- Modify: `frontend/src/components/auto-reply/ActionEditor.vue` (style section only)

- [ ] **Step 1: Replace the style block**

Replace the entire `<style scoped>` section with:

```css
<style scoped>
.action-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ── Card base ───────────────────────────────── */
.action-card-new {
  background: var(--gray-50);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.action-card-new.editing {
  background: white;
  box-shadow: var(--shadow-sm), 0 0 0 2px var(--primary-50);
}

/* ── Collapsed header ────────────────────────── */
.collapsed-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: background var(--transition-fast);
  user-select: none;
}

.collapsed-header:hover {
  background: var(--gray-100);
}

.action-card-new.editing .collapsed-header {
  cursor: default;
  padding-bottom: var(--space-2);
}

.action-card-new.editing .collapsed-header:hover {
  background: transparent;
}

/* ── Status dot ──────────────────────────────── */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-dot--done {
  background: var(--success-500);
}

.status-dot--editing {
  background: var(--warning-500);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Badge ───────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  flex-shrink: 0;
}

.badge--reply_text {
  background: var(--primary-50);
  color: var(--primary-700);
}

.badge--reply_image {
  background: #dcfce7;
  color: #15803d;
}

.badge--reply_flex {
  background: #f3e8ff;
  color: #7e22ce;
}

/* ── Collapsed preview ───────────────────────── */
.collapsed-preview {
  flex: 1;
  font-size: 0.875rem;
  color: var(--gray-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* ── Collapsed action buttons ────────────────── */
.collapsed-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-lg);
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
}

.btn-icon--edit {
  color: var(--primary-500);
}

.btn-icon--edit:hover {
  background: var(--primary-50);
}

.btn-icon--delete {
  color: var(--error-500);
}

.btn-icon--delete:hover {
  background: var(--error-50);
}

.icon {
  width: 16px;
  height: 16px;
}

/* ── Expanded body ───────────────────────────── */
.expanded-body {
  padding: 0 var(--space-4) var(--space-4);
}

.expanded-body .form-group {
  margin-bottom: var(--space-3);
}

.expanded-body .form-group:last-of-type {
  margin-bottom: 0;
}

.action-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 72px;
}

.action-textarea--json {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  min-height: 120px;
}

/* ── Expanded footer ─────────────────────────── */
.expanded-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.btn-confirm,
.btn-cancel {
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-4);
  font-size: 0.8125rem;
  font-weight: 500;
}

/* ── Empty state ─────────────────────────────── */
.action-empty {
  color: var(--gray-500);
  font-size: 0.875rem;
  font-style: italic;
  text-align: center;
  padding: var(--space-6) 0;
}

/* ── Add action dropdown ─────────────────────── */
.action-add {
  display: flex;
}

.action-add-wrapper {
  position: relative;
}

.btn-add-action {
  white-space: nowrap;
  border-radius: var(--radius-full);
}

.action-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  z-index: 10;
  min-width: 140px;
  overflow: hidden;
}

.action-dropdown-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.875rem;
  color: var(--gray-900);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.action-dropdown-item:hover {
  background: var(--gray-100);
}
</style>
```

- [ ] **Step 2: Run all tests**

Run: `cd frontend && bunx vitest run src/components/auto-reply/ActionEditor.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Run type-check and lint**

Run: `cd frontend && bunx vue-tsc --noEmit && bunx eslint src/components/auto-reply/ActionEditor.vue --fix`
Expected: No errors

- [ ] **Step 4: Commit styles**

```bash
git add frontend/src/components/auto-reply/ActionEditor.vue
git commit -m "feat(auto-reply): add collapsible card styles following design system"
```

---

### Task 5: Visual Verification and Final Commit

**Files:**
- No new files

- [ ] **Step 1: Run full frontend test suite to ensure no regressions**

Run: `cd frontend && bunx vitest run`
Expected: All tests pass (3624+ tests)

- [ ] **Step 2: Run backend type check to confirm no cross-impact**

Run: `bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual verification checklist**

Open the auto-reply page in browser and verify:
1. Existing actions with content appear collapsed (single row with preview)
2. Clicking a collapsed card expands it with the form
3. "Confirm" button collapses back to preview
4. "Cancel" button collapses back
5. "+Add Action" creates a new card in editing state
6. Delete button works from collapsed state
7. Green dot for done, orange pulsing dot for editing
8. Badge colors correct (blue text, green image, purple flex)
9. No hard borders — only shadows and background color difference
10. Capsule-shaped confirm/cancel buttons
