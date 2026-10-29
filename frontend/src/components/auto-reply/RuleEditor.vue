<template>
  <div class="rule-editor ui-card">
    <!-- Basic settings row -->
    <div class="rule-editor__basics">
      <div class="ui-field rule-editor__name">
        <label for="rule-name">規則名稱</label>
        <input
          id="rule-name"
          class="ui-input"
          type="text"
          :value="formData.name"
          placeholder="輸入規則名稱"
          @input="emit('update-field', 'name', ($event.target as HTMLInputElement).value)"
        >
      </div>
      <div class="ui-field rule-editor__trigger">
        <label for="rule-trigger">觸發類型</label>
        <select
          id="rule-trigger"
          class="ui-select"
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
      <div class="ui-field rule-editor__priority">
        <label for="rule-priority">優先序</label>
        <input
          id="rule-priority"
          class="ui-input"
          type="number"
          min="0"
          :value="formData.priority"
          @input="emit('update-field', 'priority', Number(($event.target as HTMLInputElement).value))"
        >
      </div>
    </div>

    <!-- Conditions section -->
    <div class="rule-editor__section">
      <span class="rule-editor__label">觸發條件 <small>任一符合即觸發</small></span>
      <ConditionEditor
        :conditions="formData.conditions"
        @add="(conditionType: string, value: string) => emit('add-condition', conditionType, value)"
        @remove="(index: number) => emit('remove-condition', index)"
      />
    </div>

    <!-- Actions section -->
    <div class="rule-editor__section">
      <span class="rule-editor__label">回覆動作 <small>依序執行</small></span>
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
          <span class="rule-editor__advanced-title">失敗時消耗 Push 額度確保送達</span>
          <span class="rule-editor__advanced-desc">
            Reply API 回覆失敗時改用 Push API 補送，會消耗 LINE 月度額度。建議只對客訴、訂單、付款等關鍵規則開啟。
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
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 22px;
}

.rule-editor__basics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px 110px;
  gap: 14px;
}

.rule-editor__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rule-editor__label small {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--ui-muted);
}

.rule-editor__advanced {
  padding: 14px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-orange-soft);
}

.rule-editor__advanced-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.rule-editor__advanced-text {
  display: grid;
  gap: 2px;
}

.rule-editor__advanced-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ui-ink);
}

.rule-editor__advanced-desc {
  font-size: 12.5px;
  color: var(--ui-ink-2);
}

.rule-editor__toggle {
  position: relative;
  flex: none;
  width: 44px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--ui-fill-strong);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.rule-editor__toggle--active {
  background: var(--ui-green);
}

.rule-editor__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.15),
    0 0 0 0.5px rgb(0 0 0 / 0.04);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.rule-editor__toggle--active .rule-editor__toggle-knob {
  transform: translateX(18px);
}

.rule-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rule-editor__footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.rule-editor__delete-btn {
  border: 0;
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

@media (max-width: 768px) {
  .rule-editor {
    padding: 16px;
  }

  .rule-editor__basics {
    grid-template-columns: 1fr 100px;
  }

  .rule-editor__name {
    grid-column: 1 / -1;
  }

  .rule-editor__advanced-row {
    align-items: flex-start;
  }
}
</style>
