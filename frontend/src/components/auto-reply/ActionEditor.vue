<template>
  <div class="action-editor">
    <div class="action-list">
      <div
        v-for="(action, index) in actions"
        :key="index"
        class="card action-card"
      >
        <div class="action-header">
          <span :class="['badge',`badge--${action.actionType}`]">
            {{ actionTypeLabel(action.actionType) }}
          </span>
          <button
            type="button"
            class="btn btn-danger btn-sm"
            @click="emit('remove', index)"
          >
            刪除
          </button>
        </div>

        <div class="action-body">
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

defineProps<{
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
  // Emit raw string; the parent can validate JSON if needed
  emit('update-content', index, raw)
}

function toggleDropdown(): void {
  showDropdown.value = !showDropdown.value
}

function handleAddAction(actionType: string): void {
  emit('add', actionType)
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

.action-card {
  padding: var(--space-4);
}

.action-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
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

.btn-sm {
  padding: var(--space-1) var(--space-3);
  font-size: 0.8125rem;
}

.action-body .form-group {
  margin-bottom: var(--space-3);
}

.action-body .form-group:last-child {
  margin-bottom: 0;
}

.action-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 72px;
}

.action-textarea--json {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8125rem;
  min-height: 120px;
}

.action-empty {
  color: var(--gray-600);
  font-size: 0.875rem;
  font-style: italic;
  text-align: center;
  padding: var(--space-6) 0;
}

.action-add {
  display: flex;
}

.action-add-wrapper {
  position: relative;
}

.btn-add-action {
  white-space: nowrap;
}

.action-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  background: white;
  border: 1px solid var(--gray-100);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
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
