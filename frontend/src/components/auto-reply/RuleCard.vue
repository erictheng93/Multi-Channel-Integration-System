<template>
  <div
    class="rule-card card"
    :class="{ 'rule-card--expanded': isExpanded }"
  >
    <!-- Collapsed header (always visible) -->
    <div
      class="rule-card__header"
      @click="emit('toggle-expand')"
    >
      <div class="rule-card__left">
        <!-- Active toggle -->
        <div
          class="rule-card__toggle"
          :class="{ 'rule-card__toggle--active': rule.isActive }"
          @click.stop="emit('toggle-active')"
        >
          <div class="rule-card__toggle-knob" />
        </div>

        <!-- Rule name -->
        <span class="rule-card__name">{{ rule.name }}</span>

        <!-- Trigger type badge -->
        <span
          class="badge rule-card__trigger-badge"
          :class="`rule-card__trigger-badge--${rule.triggerType}`"
        >
          {{ triggerTypeLabel }}
        </span>
      </div>

      <div class="rule-card__right">
        <!-- Priority badge -->
        <span class="badge rule-card__priority-badge">
          P{{ rule.priority }}
        </span>

        <!-- Meta text -->
        <span class="rule-card__meta">
          {{ rule.conditions.length }} 條件 · {{ rule.actions.length }} 動作
        </span>

        <!-- Expand arrow -->
        <span class="rule-card__arrow">
          {{ isExpanded ? '\u25BC' : '\u25B6' }}
        </span>
      </div>
    </div>

    <!-- Expanded body -->
    <div
      v-if="isExpanded"
      class="rule-card__body"
    >
      <RuleEditor
        :form-data="formData"
        :saving="saving"
        :is-new="false"
        @save="emit('save')"
        @cancel="emit('cancel')"
        @delete="emit('delete')"
        @add-condition="(ct: string, v: string) => emit('add-condition', ct, v)"
        @remove-condition="(i: number) => emit('remove-condition', i)"
        @add-action="(at: string) => emit('add-action', at)"
        @remove-action="(i: number) => emit('remove-action', i)"
        @update-action-content="(i: number, c: string) => emit('update-action-content', i, c)"
        @update-field="(f: string, v: unknown) => emit('update-field', f, v)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AutoReplyRule } from '@/api/autoReply'
import RuleEditor from './RuleEditor.vue'
import type { RuleFormData } from './RuleEditor.vue'

const props = defineProps<{
  rule: AutoReplyRule
  isExpanded: boolean
  formData: RuleFormData
  saving: boolean
}>()

const emit = defineEmits<{
  'toggle-expand': []
  'toggle-active': []
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

const triggerTypeLabel = computed(() => {
  /* eslint-disable camelcase */
  const labels: Record<string, string> = {
    welcome: '歡迎訊息',
    keyword: '關鍵字',
    off_hours: '非營業時間',
    fallback: '兜底回覆',
  }
  /* eslint-enable camelcase */
  return labels[props.rule.triggerType] || props.rule.triggerType
})
</script>

<style scoped>
.rule-card {
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  overflow: hidden;
}

.rule-card:hover {
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
}

.rule-card--expanded {
  border-color: var(--primary-400);
}

/* Header */
.rule-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.rule-card__header:hover {
  background: var(--gray-50);
}

.rule-card__left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.rule-card__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

/* Toggle switch */
.rule-card__toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--gray-300);
  cursor: pointer;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.rule-card__toggle--active {
  background: var(--primary-500);
}

.rule-card__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: white;
  transition: transform var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.rule-card__toggle--active .rule-card__toggle-knob {
  transform: translateX(16px);
}

/* Name */
.rule-card__name {
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Trigger badge */
.rule-card__trigger-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.rule-card__trigger-badge--welcome {
  background: #164e3f;
  color: #34d399;
}

.rule-card__trigger-badge--keyword {
  background: #1e3a5f;
  color: #60a5fa;
}

.rule-card__trigger-badge--off_hours {
  background: #4a3728;
  color: #fbbf24;
}

.rule-card__trigger-badge--fallback {
  background: #3b1f4a;
  color: #c084fc;
}

/* Priority badge */
.rule-card__priority-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--radius-md);
  background: var(--gray-100);
  color: var(--gray-600);
}

/* Meta text */
.rule-card__meta {
  font-size: 0.8125rem;
  color: var(--gray-500);
  white-space: nowrap;
}

/* Arrow */
.rule-card__arrow {
  font-size: 0.75rem;
  color: var(--gray-400);
  transition: transform var(--transition-fast);
}

/* Body */
.rule-card__body {
  border-top: 1px solid var(--gray-200);
  background: var(--primary-50);
}

@media (max-width: 640px) {
  .rule-card__header {
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .rule-card__meta {
    display: none;
  }
}
</style>
