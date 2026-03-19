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
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            </button>
            <button
              type="button"
              class="btn-icon btn-icon--delete"
              title="刪除"
              @click.stop="handleRemove(index)"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
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

// confirmEdit and cancelEdit are intentionally separate functions despite
// identical logic today — Cancel may gain content-revert behavior in the future
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
  if (editingIndices.value.has(index)) {return}
  startEdit(index)
}

function handleRemove(index: number): void {
  const updated = new Set<number>()
  for (const idx of editingIndices.value) {
    if (idx === index) {continue}
    if (idx > index) {
      updated.add(idx - 1)
    } else {
      updated.add(idx)
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
    if (typeof parsed !== 'object' || parsed === null) {return String(parsed)}

    switch (action.actionType) {
      case 'reply_text':
        return parsed.text ?? ''
      case 'reply_image':
        return parsed.url ?? ''
      case 'reply_flex':
        return action.content.length > 50
          ? `${action.content.substring(0, 50)  }...`
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
  editingIndices.value = new Set(editingIndices.value).add(newIndex)
  showDropdown.value = false
}
</script>

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

/* -- Card base -- */
.action-card-new {
  background: var(--gray-50);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.action-card-new.editing {
  background: white;
  box-shadow: var(--shadow-sm), 0 0 0 2px var(--primary-100);
}

/* -- Collapsed header -- */
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

/* -- Status dot -- */
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

/* -- Badge -- */
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

/* -- Collapsed preview -- */
.collapsed-preview {
  flex: 1;
  font-size: 0.875rem;
  color: var(--gray-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* -- Collapsed action buttons -- */
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

/* -- Expanded body -- */
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

/* -- Expanded footer -- */
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

/* -- Empty state -- */
.action-empty {
  color: var(--gray-500);
  font-size: 0.875rem;
  font-style: italic;
  text-align: center;
  padding: var(--space-6) 0;
}

/* -- Add action dropdown -- */
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
