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
          <option
            v-for="opt in TRIGGER_TYPE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
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

    <!-- Advanced: Push fallback opt-in (per-rule) -->
    <div class="rule-editor__section rule-editor__advanced">
      <div class="rule-editor__advanced-row">
        <div class="rule-editor__advanced-text">
          <span class="rule-editor__advanced-title">失敗時消耗 Push quota 確保送達</span>
          <span class="rule-editor__advanced-desc">
            啟用後若主要的 Reply API 回覆失敗，會自動改用 Push API 補救（會消耗 LINE 月度 quota）。
            建議僅在業務關鍵規則啟用，例如客訴、訂單、付款通知。
          </span>
        </div>
        <button
          type="button"
          class="rule-editor__toggle"
          :class="{ 'rule-editor__toggle--active': formData.allowPushFallback }"
          :aria-pressed="formData.allowPushFallback"
          aria-label="切換 Push API 補救"
          @click="emit('update-field', 'allowPushFallback', !formData.allowPushFallback)"
        >
          <span class="rule-editor__toggle-knob" />
        </button>
      </div>
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
import { TRIGGER_TYPE_OPTIONS, type ConditionType, type ActionType, type MatchMode, type TriggerType } from '@/api/autoReply'
import ConditionEditor from './ConditionEditor.vue'
import ActionEditor from './ActionEditor.vue'

export interface RuleFormData {
  name: string
  triggerType: TriggerType
  priority: number
  isActive: boolean
  allowPushFallback: boolean
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

.rule-editor__advanced {
  background: #F2F2F7;
  border-radius: 16px;
  padding: var(--space-3) var(--space-4);
}

.rule-editor__advanced-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.rule-editor__advanced-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.rule-editor__advanced-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1C1C1E;
}

.rule-editor__advanced-desc {
  font-size: 0.8125rem;
  color: #8E8E93;
  line-height: 1.45;
}

/* iOS-native toggle (mirrors RuleCard pattern) */
.rule-editor__toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 9999px;
  background: #E5E5EA;
  cursor: pointer;
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  border: none;
  padding: 0;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
}

.rule-editor__toggle--active {
  background: #34C759;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
}

.rule-editor__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  background: #FFFFFF;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.06);
}

.rule-editor__toggle--active .rule-editor__toggle-knob {
  transform: translateX(18px);
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
