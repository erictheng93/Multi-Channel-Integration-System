<template>
  <div class="rule-list">
    <!-- Toolbar -->
    <div class="rule-list__toolbar">
      <div class="rule-list__filters">
        <input
          class="form-input rule-list__search"
          type="text"
          placeholder="搜尋規則..."
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
        <select
          class="form-input rule-list__filter-select"
          :value="filterTriggerType"
          @change="emit('update:filterTriggerType', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            所有類型
          </option>
          <option
            v-for="opt in TRIGGER_TYPE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
      <button
        class="btn btn-primary"
        type="button"
        @click="emit('start-create')"
      >
        ＋ 新增規則
      </button>
    </div>

    <!-- New rule editor -->
    <div
      v-if="isCreating"
      class="rule-list__new-card card"
    >
      <div class="rule-list__new-header">
        新增規則
      </div>
      <RuleEditor
        :form-data="formData"
        :saving="saving"
        :is-new="true"
        @save="emit('save')"
        @cancel="emit('collapse')"
        @delete="emit('delete')"
        @add-condition="(ct: string, v: string) => emit('add-condition', ct, v)"
        @remove-condition="(i: number) => emit('remove-condition', i)"
        @add-action="(at: string) => emit('add-action', at)"
        @remove-action="(i: number) => emit('remove-action', i)"
        @update-action-content="(i: number, c: string) => emit('update-action-content', i, c)"
        @update-field="(f: string, v: unknown) => emit('update-field', f, v)"
      />
    </div>

    <!-- Rule list -->
    <div
      v-if="rules.length > 0"
      class="rule-list__items"
    >
      <RuleCard
        v-for="rule in rules"
        :key="rule.id"
        :rule="rule"
        :is-expanded="expandedRuleId === rule.id"
        :form-data="formData"
        :saving="saving"
        @toggle-expand="emit('expand-rule', rule)"
        @toggle-active="emit('toggle-active', rule)"
        @save="emit('save')"
        @cancel="emit('collapse')"
        @delete="emit('delete')"
        @add-condition="(ct: string, v: string) => emit('add-condition', ct, v)"
        @remove-condition="(i: number) => emit('remove-condition', i)"
        @add-action="(at: string) => emit('add-action', at)"
        @remove-action="(i: number) => emit('remove-action', i)"
        @update-action-content="(i: number, c: string) => emit('update-action-content', i, c)"
        @update-field="(f: string, v: unknown) => emit('update-field', f, v)"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isCreating"
      class="rule-list__empty"
    >
      <div class="rule-list__empty-icon">
        --
      </div>
      <p class="rule-list__empty-text">
        尚未建立自動回覆規則
      </p>
      <button
        class="btn btn-primary"
        type="button"
        @click="emit('start-create')"
      >
        ＋ 新增規則
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TRIGGER_TYPE_OPTIONS, type AutoReplyRule } from '@/api/autoReply'
import RuleEditor from './RuleEditor.vue'
import type { RuleFormData } from './RuleEditor.vue'
import RuleCard from './RuleCard.vue'

defineProps<{
  rules: AutoReplyRule[]
  expandedRuleId: number | null
  isCreating: boolean
  formData: RuleFormData
  saving: boolean
  searchQuery: string
  filterTriggerType: string
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:filterTriggerType': [value: string]
  'start-create': []
  'expand-rule': [rule: AutoReplyRule]
  'toggle-active': [rule: AutoReplyRule]
  'collapse': []
  'save': []
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
.rule-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Toolbar */
.rule-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.rule-list__filters {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.rule-list__search {
  max-width: 280px;
  flex: 1;
}

.rule-list__filter-select {
  max-width: 160px;
}

/* New card */
.rule-list__new-card {
  border: 2px dashed var(--primary-300);
  border-radius: var(--radius-lg);
  background: var(--primary-50);
  overflow: hidden;
}

.rule-list__new-header {
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  color: var(--primary-700);
  border-bottom: 1px solid var(--primary-200);
}

/* Items list */
.rule-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Empty state */
.rule-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
  background: var(--gray-50);
  border: 1px dashed var(--gray-300);
  border-radius: var(--radius-lg);
  text-align: center;
}

.rule-list__empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
  opacity: 0.6;
}

.rule-list__empty-text {
  color: var(--gray-500);
  font-size: 1rem;
  margin: 0 0 var(--space-4);
}

@media (max-width: 640px) {
  .rule-list__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .rule-list__filters {
    flex-direction: column;
  }

  .rule-list__search,
  .rule-list__filter-select {
    max-width: none;
  }
}
</style>
