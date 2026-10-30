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
          class="ui-select condition-select"
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
          class="ui-input"
          placeholder="輸入條件值，Enter 新增"
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
  gap: 12px;
}

.condition-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.condition-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 6px 0 12px;
  border-radius: 999px;
  background: var(--ui-surface-2);
  box-shadow: inset 0 0 0 0.5px var(--ui-sep);
  font-size: 13px;
}

.condition-type-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent);
}

.condition-value {
  color: var(--ui-ink);
}

.condition-remove {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.condition-remove:hover {
  background: var(--ui-fill-strong);
  color: var(--ui-ink);
}

.condition-empty {
  font-size: 13px;
  color: var(--ui-muted);
}

.condition-add-form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.condition-add-form .form-group {
  margin: 0;
}

.condition-select {
  width: 140px;
  flex-shrink: 0;
}

.condition-input-group {
  flex: 1;
  min-width: 0;
}

.btn-add {
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 768px) {
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
