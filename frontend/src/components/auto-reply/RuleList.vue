<template>
  <div class="rule-list">
    <!-- Toolbar -->
    <div class="ui-card rule-list__toolbar">
      <div class="rule-list__filters">
        <input
          class="ui-input rule-list__search"
          aria-label="搜尋規則"
          type="text"
          placeholder="搜尋規則"
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
        <select
          class="ui-select rule-list__filter-select"
          aria-label="規則類型"
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
      class="ui-card rule-list__new-card"
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
      class="ui-card rule-list__items"
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
      class="ui-card ui-empty rule-list__empty"
    >
      <div class="ui-empty-art">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M13 2 3 14h9l-1 8 10-12h-9Z" /></svg>
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
  gap: 16px;
}

.rule-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}

.rule-list__filters {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.rule-list__search {
  flex: 1 1 220px;
  max-width: 340px;
  height: 38px;
  border-radius: 999px;
}

.rule-list__filter-select {
  width: auto;
  min-width: 140px;
  height: 38px;
  border-radius: 999px;
}

.rule-list__items {
  overflow: hidden;
  padding: 4px 0;
}

.rule-list__new-card {
  overflow: hidden;
}

.rule-list__new-header {
  padding: 16px 22px 0;
  font: 600 var(--ui-t-title) var(--ui-font-display);
}

.rule-list__empty-text {
  margin: 0;
  font-size: 13.5px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .rule-list__search,
  .rule-list__filter-select {
    flex: 1 1 100%;
    max-width: none;
  }

  .rule-list__toolbar > .btn {
    width: 100%;
  }
}
</style>
