<template>
  <div class="rule-list">
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

    <!-- Rule list: the search and type filter are the card's own toolbar, with the count -->
    <div class="ui-group rule-list__items">
      <div class="rule-list__toolbar">
        <div class="rule-list__filters">
          <div class="rule-list__search-wrap">
            <svg
              class="rule-list__search-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            ><circle
              cx="11"
              cy="11"
              r="7"
            /><path d="m20 20-3.5-3.5" /></svg>
            <input
              class="ui-input rule-list__search"
              aria-label="搜尋規則"
              type="text"
              placeholder="搜尋規則"
              :value="searchQuery"
              @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            >
          </div>
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
        <span class="rule-list__count">{{ rules.length }} 條規則<template v-if="hits">，觸發次數取自最近 {{ hitsWindow ?? 50 }} 筆日誌</template></span>
      </div>

      <RuleCard
        v-for="rule in rules"
        :key="rule.id"
        :rule="rule"
        :is-expanded="expandedRuleId === rule.id"
        :form-data="formData"
        :saving="saving"
        :hits="hits ? (hits[rule.id] ?? 0) : null"
        :hits-max="hitsMax"
        :hits-window="hitsWindow"
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
    <UiEmptyState
      v-if="rules.length === 0 && !isCreating"
      class="ui-card rule-list__empty"
      title="尚未建立自動回覆規則"
      description="規則會在客戶來訊符合條件時自動回覆。"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M13 2 3 14h9l-1 8 10-12h-9Z" /></svg>
      </template>
      <template #action>
        <button
          class="btn btn-primary"
          type="button"
          @click="emit('start-create')"
        >
          新增規則
        </button>
      </template>
    </UiEmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { TRIGGER_TYPE_OPTIONS, type AutoReplyRule } from '@/api/autoReply'
import RuleEditor from './RuleEditor.vue'
import type { RuleFormData } from './RuleEditor.vue'
import RuleCard from './RuleCard.vue'

const props = defineProps<{
  /** Fires per rule id in the newest logs; null while the log view is filtered */
  hits?: Record<number, number> | null
  hitsWindow?: number
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

const hitsMax = computed(() => Math.max(0, ...Object.values(props.hits ?? {})))

</script>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-list__count {
  flex: none;
  margin-left: auto;
  font-size: 14px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

/* the toolbar is the top row of the rules card */
.rule-list__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  border-bottom: 0.5px solid var(--ui-sep);
}

.rule-list__filters {
  display: flex;
  flex: 0 1 560px;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.rule-list__search-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.rule-list__search-ico {
  position: absolute;
  top: 50%;
  left: 13px;
  width: 16px;
  height: 16px;
  color: var(--ui-muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.rule-list__search {
  height: 36px;
  padding-left: 36px;
  border-radius: 999px;
}

.rule-list__filter-select {
  width: auto;
  min-width: 132px;
  height: 36px;
  border-radius: 999px;
}

.rule-list__items {
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
  /* Phone: the search takes the row, the type filter sits beside it as a compact chip */
  .rule-list__toolbar {
    padding: 10px 12px;
  }

  .rule-list__filters {
    flex: 1 1 auto;
  }

  .rule-list__count {
    display: none;
  }

  .rule-list__filter-select {
    flex: none;
    width: 128px;
    min-width: 0;
  }
}

/* placeholder text must read at AA on the grey field fill */
.ui-input::placeholder,
.ui-textarea::placeholder {
  color: var(--ui-muted);
}
</style>
