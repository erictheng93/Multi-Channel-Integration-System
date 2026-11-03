<template>
  <div
    class="rule-card"
    :class="{ 'rule-card--expanded': isExpanded, 'rule-card--off': !rule.isActive, 'is-first': first, 'is-last': last }"
  >
    <!-- Collapsed header (always visible) -->
    <div
      class="rule-card__header"
      @click="emit('toggle-expand')"
    >
      <div class="rule-card__left">
        <!-- Priority rung: rules are tried in this order, the first match answers -->
        <span
          class="rule-card__rung"
          role="img"
          :aria-label="`優先序 ${rule.priority}`"
          :title="`優先序 ${rule.priority}：數字越小越先比對；${rule.conditions.length} 個條件、${rule.actions.length} 個動作`"
        >{{ rule.priority }}</span>

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
            v-if="conditionSummary || replyOutcome"
            class="rule-card__summary"
          >
            <span
              v-if="conditionSummary"
              class="rule-card__when"
            >{{ conditionSummary }}</span>
            <span
              v-if="conditionSummary && replyOutcome"
              class="rule-card__then"
              aria-hidden="true"
            >→</span>
            <span
              v-if="replyOutcome"
              class="rule-card__reply"
              :title="replyOutcome"
            >回覆 {{ replyOutcome }}</span>
          </div>
          <!-- phone only: priority joins the meta line so the row keeps one trailing control -->
          <div class="rule-card__prio-line">
            <span class="rule-card__prio-when">{{ conditionSummary || (rule.conditions.length ? `${rule.conditions.length} 條件` : '不需條件') }}</span>
            <span
              v-if="hits"
              class="rule-card__prio-n"
            >觸發 {{ hits }} 次</span>
            <span class="rule-card__prio-n">優先 {{ rule.priority }}</span>
          </div>
        </div>
      </div>

      <div class="rule-card__right">
        <!-- How often it fired in the newest logs -->
        <span
          v-if="hits !== null && hits !== undefined"
          class="rule-card__hits"
          :class="{ 'is-zero': hits === 0 }"
          :title="`最近 ${hitsWindow} 筆日誌中觸發 ${hits} 次`"
        >
          <b>{{ hits }}</b> 次
        </span>
        <span
          v-else
          class="rule-card__none"
          aria-hidden="true"
        />

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

const props = withDefaults(defineProps<{
  rule: AutoReplyRule
  isExpanded: boolean
  formData: RuleFormData
  saving: boolean
  /** Times this rule fired within the newest logs; null = unknown (filtered log view) */
  hits?: number | null
  /** Largest hit count among the rules, to scale the bar */
  hitsMax?: number
  /** How many log rows the hit counts were taken from */
  hitsWindow?: number
  /** Position in the list, for the rail that joins the priority rungs */
  first?: boolean
  last?: boolean
}>(), { hits: null, hitsMax: 0, hitsWindow: 50, first: false, last: false })

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

// One line: when it fires (keyword rules) and what the customer gets back, from the rule's own data
const conditionSummary = computed(() => {
  const rule = props.rule
  if (rule.triggerType !== 'keyword' || rule.conditions.length === 0) { return '' }
  const first = rule.conditions[0]
  const sameType = rule.conditions.every(c => c.conditionType === first?.conditionType)
  const values = rule.conditions.map(c => `「${c.value}」`).join('')
  return sameType && first
    ? `${CONDITION_LABELS[first.conditionType] ?? first.conditionType}${values}`
    : rule.conditions.map(c => `${CONDITION_LABELS[c.conditionType] ?? c.conditionType}「${c.value}」`).join(' ')
})

const ACTION_LABELS: Record<string, string> = { 'reply_image': '圖片回覆', 'reply_flex': '卡片訊息' }
const replyOutcome = computed(() => {
  const first = props.rule.actions[0]
  if (!first) { return '' }
  if (first.actionType === 'reply_text') {
    const text = (first.content ?? '').replace(/\s+/g, ' ').trim()
    return text ? `「${text}」` : ''
  }
  return ACTION_LABELS[first.actionType] ?? ''
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
  position: relative;
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
  display: grid;
  grid-template-columns: 56px 18px;
  align-items: center;
  column-gap: 12px;
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
  display: flex;
  gap: 6px;
  margin-top: 2px;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-ink-2);
}

.rule-card__when,
.rule-card__then {
  flex: none;
}

.rule-card__reply {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: var(--ui-ink-2);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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

/* a disabled rule reads as off all the way across: neutral badge, quiet reply (no opacity, so contrast holds) */
.rule-card--off .rule-card__trigger-badge {
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.rule-card--off .rule-card__reply {
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

.rule-card__prio-line {
  display: none;
}

/* Priority rung: a numbered stop on the rail that runs down the list */
.rule-card__rung {
  position: relative;
  z-index: 1;
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-accent-soft);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent);
  font-variant-numeric: tabular-nums;
}

.rule-card--off .rule-card__rung {
  background: var(--ui-fill-strong);
  color: var(--ui-muted);
}

/* the numbered rungs stand alone: a hairline through them read as an error */

.rule-card__hits {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  font-size: 13px;
  color: var(--ui-muted);
  white-space: nowrap;
}

.rule-card__hits b {
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.rule-card__hits.is-zero b {
  color: var(--ui-muted);
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
    align-items: flex-start;
    padding: 14px 16px;
  }

  .rule-card__hits,
  .rule-card__rung,
  .rule-card::after {
    display: none;
  }

  .rule-card__right {
    display: block;
  }

  .rule-card__left {
    align-items: flex-start;
  }

  .rule-card__right {
    margin-top: 3px;
  }

  /* two quiet lines under the name: condition then reply on one line, and the size line */
  .rule-card__summary {
    flex-wrap: nowrap;
    gap: 6px;
  }

  /* the reply is the line; the condition moves to the meta line below it */
  .rule-card__when,
  .rule-card__then {
    display: none;
  }

  /* the reply wraps to two lines: it is the content the agent came to read */
  .rule-card__reply {
    display: -webkit-box;
    flex: 1 1 0;
    -webkit-line-clamp: 1;
  }

  .rule-card__prio-line {
    display: flex;
    flex-wrap: nowrap;
    gap: 2px 0;
    margin-top: 2px;
    font-size: 13px;
    color: var(--ui-muted);
    font-variant-numeric: tabular-nums;
  }

  /* phone: the meta line is just the numbers; the condition is read in the opened rule */
  .rule-card__prio-when {
    display: none;
  }

  .rule-card__prio-n {
    flex: none;
  }

  .rule-card__prio-n + .rule-card__prio-n::before {
    margin: 0 7px;
    content: '·';
  }

  .rule-card__body {
    padding: 0 12px 14px;
  }
}
</style>
