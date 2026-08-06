<template>
  <div class="condition-editor">
    <div class="condition-list">
      <div
        v-for="(condition, index) in conditions"
        :key="index"
        class="condition-tag"
      >
        <span class="condition-type-label">{{ conditionTypeLabel(condition.conditionType) }}</span>
        <span class="condition-value">{{ condition.value }}</span>
        <button
          class="condition-remove"
          type="button"
          @click="emit('remove', index)"
        >
          &times;
        </button>
      </div>

      <div
        v-if="conditions.length === 0"
        class="condition-empty"
      >
        尚未設定條件
      </div>
    </div>

    <div class="condition-add-form">
      <div class="form-group">
        <select
          v-model="newConditionType"
          class="form-input condition-select"
        >
          <option value="exact">
            完全匹配
          </option>
          <option value="contains">
            包含
          </option>
          <option value="regex">
            正則表達式
          </option>
          <option value="message_type">
            訊息類型
          </option>
        </select>
      </div>

      <div class="form-group condition-input-group">
        <input
          v-model="newValue"
          type="text"
          class="form-input"
          placeholder="輸入條件值..."
          @keydown.enter.prevent="handleEnterKey"
          @compositionend="ime.onCompositionEnd"
        >
      </div>

      <button
        type="button"
        class="btn btn-primary btn-add"
        :disabled="!newValue.trim()"
        @click="handleAdd"
      >
        新增
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useImeGuard } from '@/composables/useImeGuard'

defineProps<{
  conditions: Array<{
    conditionType: 'exact' | 'contains' | 'regex' | 'message_type'
    value: string
    caseSensitive: boolean
    matchMode: 'any' | 'all'
  }>
}>()

const emit = defineEmits<{
  'add': [conditionType: string, value: string]
  'remove': [index: number]
}>()

// IME (注音/拼音/日文) 組字守門 — 見 useImeGuard
const ime = useImeGuard()

const newConditionType = ref<string>('contains')
const newValue = ref('')

function conditionTypeLabel(type: string): string {
  /* eslint-disable camelcase */
  const labels: Record<string, string> = {
    exact: '完全匹配',
    contains: '包含',
    regex: '正則',
    message_type: '訊息類型'
  }
  /* eslint-enable camelcase */
  return labels[type] ?? type
}

// 組字中的 Enter 是確認選字，不是新增條件
function handleEnterKey(event: KeyboardEvent): void {
  if (ime.isImeKey(event)) {return}
  handleAdd()
}

function handleAdd(): void {
  const value = newValue.value.trim()
  if (!value) {return}
  emit('add', newConditionType.value, value)
  newValue.value = ''
}
</script>

<style scoped>
.condition-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.condition-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-height: 36px;
  align-items: center;
}

.condition-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--primary-50);
  border: 1px solid var(--primary-200, #bfdbfe);
  border-radius: 9999px;
  padding: var(--space-1) var(--space-3);
  font-size: 0.8125rem;
  line-height: 1.4;
  transition: background-color var(--transition-fast);
}

.condition-tag:hover {
  background: var(--primary-100, #dbeafe);
}

.condition-type-label {
  color: var(--primary-700);
  font-weight: 600;
  font-size: 0.75rem;
}

.condition-value {
  color: var(--gray-900);
}

.condition-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--gray-600);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  padding: 0;
  transition: all var(--transition-fast);
}

.condition-remove:hover {
  background: var(--primary-200, #bfdbfe);
  color: var(--primary-700);
}

.condition-empty {
  color: var(--gray-600);
  font-size: 0.875rem;
  font-style: italic;
}

.condition-add-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.condition-add-form .form-group {
  margin-bottom: 0;
}

.condition-select {
  width: 140px;
  flex-shrink: 0;
}

.condition-input-group {
  flex: 1;
}

.btn-add {
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .condition-add-form {
    flex-direction: column;
    align-items: stretch;
  }

  .condition-select {
    width: 100%;
  }

  .btn-add {
    align-self: flex-end;
  }
}
</style>
