<template>
  <div
    class="rule-card"
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
          role="switch"
          :aria-checked="rule.isActive"
          :aria-label="`啟用規則 ${rule.name}`"
          @click.stop="emit('toggle-active')"
        >
          <div class="rule-card__toggle-knob" />
        </div>

        <div class="rule-card__text">
          <div class="rule-card__title">
            <!-- Rule name -->
            <span
              class="rule-card__name"
              :class="{ 'is-off': !rule.isActive }"
            >{{ rule.name }}</span>

            <!-- Trigger type badge -->
            <span
              class="badge rule-card__trigger-badge"
              :class="`rule-card__trigger-badge--${rule.triggerType}`"
            >
              {{ triggerTypeLabel }}
            </span>
            <span
              v-if="!rule.isActive"
              class="rule-card__off-badge"
            >已停用</span>
          </div>
          <div
            v-if="summary"
            class="rule-card__summary"
          >
            {{ summary }}
          </div>
        </div>
      </div>

      <div class="rule-card__right">
        <!-- Priority badge -->
        <span
          class="rule-card__priority-badge"
          title="數字越小越先比對"
        >
          優先 {{ rule.priority }}
        </span>

        <!-- Meta text -->
        <span class="rule-card__meta">
          {{ rule.conditions.length }} 條件 · {{ rule.actions.length }} 動作
        </span>

        <!-- Expand arrow -->
        <span
          class="rule-card__arrow"
          :class="{ 'is-open': isExpanded }"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="m9 6 6 6-6 6" /></svg>
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
import { TRIGGER_TYPE_LABELS, type AutoReplyRule } from '@/api/autoReply'
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

const CONDITION_LABELS: Record<string, string> = {
  exact: '完全符合',
  contains: '包含',
  regex: '正規',
  'message_type': '訊息類型'
}

// One line of what the rule does, built only from the rule's own conditions / first reply text
const summary = computed(() => {
  const rule = props.rule
  if (rule.triggerType === 'keyword' && rule.conditions.length > 0) {
    const first = rule.conditions[0]
    const sameType = rule.conditions.every(c => c.conditionType === first?.conditionType)
    const values = rule.conditions.map(c => `「${c.value}」`).join('')
    return sameType && first
      ? `${CONDITION_LABELS[first.conditionType] ?? first.conditionType}${values}`
      : rule.conditions.map(c => `${CONDITION_LABELS[c.conditionType] ?? c.conditionType}「${c.value}」`).join(' ')
  }
  const text = rule.actions.find(a => a.actionType === 'reply_text')?.content
  return text ? `「${text.replace(/s+/g, ' ')}」` : ''
})

const triggerTypeLabel = computed(() => {
  return TRIGGER_TYPE_LABELS[props.rule.triggerType] || props.rule.triggerType
})
</script>

<style scoped>
.rule-card {
  position: relative;
}

.rule-card + .rule-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.rule-card--expanded {
  background: color-mix(in srgb, var(--ui-fill) 35%, transparent);
}

/* Header */
.rule-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  cursor: pointer;
  user-select: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.rule-card__header:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.rule-card__left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.rule-card__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.rule-card__text {
  min-width: 0;
  flex: 1;
}

.rule-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rule-card__summary {
  margin-top: 2px;
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Toggle switch (same spec as .ui-switch) */
.rule-card__toggle {
  position: relative;
  flex: none;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--ui-fill-strong);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.rule-card__toggle--active {
  background: var(--ui-green);
}

.rule-card__toggle-knob {
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

.rule-card__toggle--active .rule-card__toggle-knob {
  transform: translateX(18px);
}

/* Name */
.rule-card__name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-card__name.is-off {
  color: var(--ui-muted);
}

/* Trigger badge */
.rule-card__trigger-badge {
  flex: none;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  line-height: 22px;
  color: var(--ui-ink-2);
  white-space: nowrap;
}

.rule-card__trigger-badge--welcome {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.rule-card__trigger-badge--keyword {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.rule-card__trigger-badge--off_hours {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.rule-card__trigger-badge--fallback {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.rule-card__off-badge {
  flex: none;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  line-height: 22px;
  color: var(--ui-muted);
  white-space: nowrap;
}

/* Priority badge */
.rule-card__priority-badge {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Meta text */
.rule-card__meta {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Arrow */
.rule-card__arrow {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  color: var(--ui-muted);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.rule-card__arrow svg {
  width: 16px;
  height: 16px;
}

.rule-card__arrow.is-open {
  transform: rotate(90deg);
}

/* Body */
.rule-card__body {
  padding: 0 22px 18px;
}

@media (max-width: 768px) {
  .rule-card__header {
    padding: 14px 16px;
  }

  .rule-card__meta,
  .rule-card__priority-badge {
    display: none;
  }

  .rule-card__body {
    padding: 0 12px 14px;
  }
}
</style>
