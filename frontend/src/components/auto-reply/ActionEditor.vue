<template>
  <div class="action-editor">
    <div
      v-if="actions.length > 0"
      class="action-row-list"
    >
      <template
        v-for="(action, index) in actions"
        :key="index"
      >
        <!-- Collapsed: row display -->
        <div
          v-if="!editingIndices.has(index)"
          :class="['action-row', `action-row--${action.actionType}`]"
          @click="toggleEdit(index)"
        >
          <span class="action-accent" />
          <span class="action-step">{{ index + 1 }}</span>
          <span :class="['action-badge', `action-badge--${action.actionType}`]">
            {{ actionTypeLabel(action.actionType) }}
          </span>
          <span class="action-preview">{{ getPreviewText(action) }}</span>
          <button
            class="action-row-remove"
            type="button"
            title="移除動作"
            @click.stop="handleRemove(index)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
            /><line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
            /></svg>
          </button>
        </div>

        <!-- Expanded: editing row -->
        <div
          v-else
          :class="['action-row', 'action-row--editing', `action-row--${action.actionType}`]"
        >
          <div class="action-row-header">
            <span class="action-accent" />
            <span class="action-step">{{ index + 1 }}</span>
            <span :class="['action-badge', `action-badge--${action.actionType}`]">
              {{ actionTypeLabel(action.actionType) }}
            </span>
            <span class="action-editing-indicator">
              <span class="status-dot" />
              編輯中
            </span>
          </div>

          <div class="action-row-body">
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
            <div class="action-row-footer">
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
      </template>
    </div>

    <div
      v-else
      class="action-empty"
    >
      尚未設定動作
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
// Track indices added via "+ 新增動作" that haven't been confirmed yet
const newIndices = ref<Set<number>>(new Set())

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

  // Action is now confirmed — no longer "new"
  const updatedNew = new Set(newIndices.value)
  updatedNew.delete(index)
  newIndices.value = updatedNew
}

function cancelEdit(index: number): void {
  const updated = new Set(editingIndices.value)
  updated.delete(index)
  editingIndices.value = updated

  // If this action was newly added and never confirmed, remove it entirely
  if (newIndices.value.has(index)) {
    const updatedNew = new Set(newIndices.value)
    updatedNew.delete(index)
    newIndices.value = updatedNew
    handleRemove(index)
  }
}

function toggleEdit(index: number): void {
  if (editingIndices.value.has(index)) {return}
  startEdit(index)
}

function handleRemove(index: number): void {
  const updated = new Set<number>()
  for (const idx of editingIndices.value) {
    if (idx === index) {continue}
    updated.add(idx > index ? idx - 1 : idx)
  }
  editingIndices.value = updated

  // Re-index newIndices to keep in sync after removal
  const updatedNew = new Set<number>()
  for (const idx of newIndices.value) {
    if (idx === index) {continue}
    updatedNew.add(idx > index ? idx - 1 : idx)
  }
  newIndices.value = updatedNew

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
        return action.content.length > 80
          ? `${action.content.substring(0, 80)}...`
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
  newIndices.value = new Set(newIndices.value).add(newIndex)
  showDropdown.value = false
}
</script>

<style scoped>
.action-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ================================================================
   Row list container — iOS-style white card
   ================================================================ */
.action-row-list {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: var(--radius-2xl, 1rem);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.04);
  overflow: hidden;
}

/* ================================================================
   Collapsed action row
   ================================================================ */
.action-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 14px var(--space-4) 14px 0;
  cursor: pointer;
  transition: background-color 200ms ease-out;
}

.action-row:not(.action-row--editing):hover {
  background: var(--gray-50, #f9fafb);
}

/* Divider: thin, indented past accent bar (iOS Settings-style) */
.action-row:not(.action-row--editing) + .action-row:not(.action-row--editing) {
  box-shadow: inset 0 1px 0 0 var(--gray-100, #f3f4f6);
}

/* ================================================================
   Left accent bar — type color indicator
   Creates a vertical "timeline" reinforcing execution order
   ================================================================ */
.action-accent {
  width: 3px;
  align-self: stretch;
  border-radius: 0 var(--radius-full, 9999px) var(--radius-full, 9999px) 0;
  flex-shrink: 0;
  transition: opacity 200ms ease-out;
}

.action-row--reply_text .action-accent {
  background: var(--primary-400, #60a5fa);
}

.action-row--reply_image .action-accent {
  background: #4ade80;
}

.action-row--reply_flex .action-accent {
  background: #a78bfa;
}

/* ================================================================
   Step number — minimal, no circle background
   ================================================================ */
.action-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  color: var(--gray-400, #9ca3af);
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  line-height: 1;
  text-align: center;
}

/* ================================================================
   Type badge — compact pastel capsule
   ================================================================ */
.action-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full, 9999px);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  flex-shrink: 0;
  line-height: 1;
}

.action-badge--reply_text {
  background: var(--primary-50, #eff6ff);
  color: var(--primary-600, #2563eb);
}

.action-badge--reply_image {
  background: #dcfce7;
  color: #16a34a;
}

.action-badge--reply_flex {
  background: #f3e8ff;
  color: #7c3aed;
}

/* ================================================================
   Content preview
   ================================================================ */
.action-preview {
  flex: 1;
  min-width: 0;
  color: var(--gray-500, #6b7280);
  font-size: 0.8125rem;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ================================================================
   Remove button — hover-reveal, soft transition
   ================================================================ */
.action-row-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--gray-300, #d1d5db);
  cursor: pointer;
  border-radius: var(--radius-full, 9999px);
  padding: 0;
  flex-shrink: 0;
  transition: all 200ms ease-out;
  opacity: 0;
}

.action-row:hover .action-row-remove {
  opacity: 1;
  color: var(--gray-400, #9ca3af);
}

.action-row-remove:hover {
  background: var(--error-50, #fef2f2);
  color: var(--error-500, #ef4444);
}

/* ================================================================
   Editing state — lifted card with type-tinted ring
   ================================================================ */
.action-row--editing {
  flex-direction: column;
  align-items: stretch;
  cursor: default;
  background: white;
  border-radius: var(--radius-2xl, 1rem);
  padding: 0;
  position: relative;
  z-index: 1;
  margin: var(--space-1) 0;
}

/* Type-tinted focus ring */
.action-row--editing.action-row--reply_text {
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.06),
    0 0 0 2px var(--primary-100, #dbeafe);
}

.action-row--editing.action-row--reply_image {
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.06),
    0 0 0 2px #bbf7d0;
}

.action-row--editing.action-row--reply_flex {
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.06),
    0 0 0 2px #e9d5ff;
}

.action-row--editing + .action-row {
  box-shadow: none;
}

.action-row + .action-row--editing {
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06), 0 0 0 2px var(--primary-100, #dbeafe);
}

/* Re-apply type-tinted ring (specificity override for adjacent sibling) */
.action-row + .action-row--editing.action-row--reply_text {
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.06),
    0 0 0 2px var(--primary-100, #dbeafe);
}

.action-row + .action-row--editing.action-row--reply_image {
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.06),
    0 0 0 2px #bbf7d0;
}

.action-row + .action-row--editing.action-row--reply_flex {
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.06),
    0 0 0 2px #e9d5ff;
}

.action-row-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 14px var(--space-4) var(--space-2) 0;
}

.action-editing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--gray-400, #9ca3af);
  font-size: 0.75rem;
  font-weight: 500;
}

/* ================================================================
   Status dot — editing pulse
   ================================================================ */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full, 9999px);
  background: var(--warning-500, #f59e0b);
  flex-shrink: 0;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ================================================================
   Row body (form area)
   ================================================================ */
.action-row-body {
  padding: 0 var(--space-4) var(--space-4) calc(3px + var(--space-3) + 18px + var(--space-3));
}

.action-row-body .form-group {
  margin-bottom: var(--space-3);
}

.action-row-body .form-group:last-of-type {
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

/* ================================================================
   Row footer (confirm / cancel)
   ================================================================ */
.action-row-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.btn-confirm,
.btn-cancel {
  border-radius: var(--radius-full, 9999px);
  padding: var(--space-2) var(--space-4);
  font-size: 0.8125rem;
  font-weight: 500;
}

/* ================================================================
   Empty state
   ================================================================ */
.action-empty {
  color: var(--gray-400, #9ca3af);
  font-size: 0.8125rem;
  text-align: center;
  padding: var(--space-6) 0;
}

/* ================================================================
   Add action dropdown
   ================================================================ */
.action-add {
  display: flex;
}

.action-add-wrapper {
  position: relative;
}

.btn-add-action {
  white-space: nowrap;
  border-radius: var(--radius-full, 9999px);
}

.action-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: white;
  border-radius: var(--radius-xl, 0.75rem);
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.08);
  z-index: 10;
  min-width: 140px;
  overflow: hidden;
}

.action-dropdown-item {
  display: block;
  width: 100%;
  padding: 10px var(--space-4);
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.8125rem;
  color: var(--gray-700, #374151);
  cursor: pointer;
  transition: background-color 150ms ease-out;
}

.action-dropdown-item:hover {
  background: var(--gray-50, #f9fafb);
}

.action-dropdown-item + .action-dropdown-item {
  box-shadow: inset 0 1px 0 0 var(--gray-100, #f3f4f6);
}
</style>
