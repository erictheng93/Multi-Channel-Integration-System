<template>
  <div class="rule-editor">
    <!-- Basic settings row -->
    <div class="rule-editor__basics">
      <div class="form-group rule-editor__name">
        <label class="form-label">規則名稱</label>
        <input
          class="form-input"
          type="text"
          :value="formData.name"
          placeholder="輸入規則名稱"
          @input="emit('update-field', 'name', ($event.target as HTMLInputElement).value)"
        >
      </div>
      <div class="form-group rule-editor__trigger">
        <label class="form-label">觸發類型</label>
        <select
          class="form-input"
          :value="formData.triggerType"
          @change="emit('update-field', 'triggerType', ($event.target as HTMLSelectElement).value)"
        >
          <option value="welcome">
            歡迎訊息
          </option>
          <option value="keyword">
            關鍵字
          </option>
          <option value="off_hours">
            非營業時間
          </option>
          <option value="fallback">
            兜底回覆
          </option>
        </select>
      </div>
      <div class="form-group rule-editor__priority">
        <label class="form-label">優先序</label>
        <input
          class="form-input"
          type="number"
          min="0"
          :value="formData.priority"
          @input="emit('update-field', 'priority', Number(($event.target as HTMLInputElement).value))"
        >
      </div>
    </div>

    <!-- Conditions section -->
    <div class="rule-editor__section">
      <label class="form-label">觸發條件 (任一符合即觸發)</label>
      <ConditionEditor
        :conditions="formData.conditions"
        @add="(conditionType: string, value: string) => emit('add-condition', conditionType, value)"
        @remove="(index: number) => emit('remove-condition', index)"
      />
    </div>

    <!-- Actions section -->
    <div class="rule-editor__section">
      <label class="form-label">回覆動作 (依序執行)</label>
      <ActionEditor
        :actions="formData.actions"
        @add="(actionType: string) => emit('add-action', actionType)"
        @remove="(index: number) => emit('remove-action', index)"
        @update-content="(index: number, content: string) => emit('update-action-content', index, content)"
      />
    </div>

    <!-- Footer -->
    <div class="rule-editor__footer">
      <button
        v-if="!isNew"
        class="btn rule-editor__delete-btn"
        type="button"
        @click="emit('delete')"
      >
        刪除規則
      </button>
      <div class="rule-editor__footer-right">
        <button
          class="btn btn-secondary"
          type="button"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="saving"
          @click="emit('save')"
        >
          {{ saving ? '儲存中...' : '儲存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConditionType, ActionType, MatchMode, TriggerType } from '@/api/autoReply'
import ConditionEditor from './ConditionEditor.vue'
import ActionEditor from './ActionEditor.vue'

export interface RuleFormData {
  name: string
  triggerType: TriggerType
  priority: number
  isActive: boolean
  conditions: Array<{
    conditionType: ConditionType
    value: string
    caseSensitive: boolean
    matchMode: MatchMode
  }>
  actions: Array<{
    actionType: ActionType
    content: string
    sortOrder: number
  }>
}

defineProps<{
  formData: RuleFormData
  saving: boolean
  isNew: boolean
}>()

const emit = defineEmits<{
  'save': []
  'cancel': []
  'delete': []
  'add-condition': [conditionType: string, value: string]
  'remove-condition': [index: number]
  'add-action': [actionType: string]
  'remove-action': [index: number]
  'update-action-content': [index: number, content: string]
  'update-field': [field: string, value: unknown]
}>()
</script>

<style scoped>
.rule-editor {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.rule-editor__basics {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
}

.rule-editor__name {
  flex: 2;
}

.rule-editor__trigger {
  flex: 1;
}

.rule-editor__priority {
  flex: 0.5;
}

.rule-editor__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rule-editor__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-3);
  border-top: 1px solid var(--gray-200);
}

.rule-editor__footer-right {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.rule-editor__delete-btn {
  color: var(--error-600);
  background: transparent;
  border: none;
  font-weight: 500;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.rule-editor__delete-btn:hover {
  background: var(--error-50);
}

@media (max-width: 640px) {
  .rule-editor__basics {
    flex-direction: column;
    align-items: stretch;
  }

  .rule-editor__name,
  .rule-editor__trigger,
  .rule-editor__priority {
    flex: 1;
  }
}
</style>
