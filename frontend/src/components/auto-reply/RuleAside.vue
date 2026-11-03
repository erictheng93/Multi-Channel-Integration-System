<template>
  <aside class="rule-aside">
    <!-- Try a message: which rule would answer it, from the saved rules (nothing is sent) -->
    <section class="ui-group aside-card tester">
      <header class="aside-head">
        <h2>試算一句話</h2>
        <div
          class="ui-seg"
          role="group"
          aria-label="假設的營業狀態"
        >
          <button
            type="button"
            :aria-pressed="open"
            @click="open = true"
          >
            營業中
          </button>
          <button
            type="button"
            :aria-pressed="!open"
            @click="open = false"
          >
            非營業
          </button>
        </div>
      </header>
      <div class="aside-body">
        <input
          v-model="text"
          class="ui-input"
          type="text"
          maxlength="200"
          aria-label="客戶訊息"
          placeholder="輸入客戶可能會說的話，例如「報價多少」"
        >

        <p
          v-if="!text.trim()"
          class="tester-hint"
        >
          依優先序比對已啟用的規則，看哪一條會回覆。不會送出任何訊息。
        </p>

        <template v-else-if="winner">
          <div class="verdict">
            <span class="verdict-label">會由這條回覆</span>
            <button
              type="button"
              class="verdict-rule"
              @click="emit('open-rule', winner.rule.id)"
            >
              <span class="verdict-prio">優先 {{ winner.rule.priority }}</span>
              <strong>{{ winner.rule.name }}</strong>
            </button>
            <span class="verdict-why">{{ winner.reason }}</span>
            <p
              v-if="replyText(winner.rule)"
              class="verdict-reply"
            >
              {{ replyText(winner.rule) }}
            </p>
          </div>
          <p
            v-if="shadowed.length > 0"
            class="shadowed"
          >
            也符合但排在後面：{{ shadowed.map(m => m.rule.name).join('、') }}
          </p>
        </template>

        <p
          v-else
          class="verdict-none"
        >
          沒有規則會回覆這句話，客戶會等真人。
        </p>
      </div>
    </section>

    <!-- The newest triggers, so a rule's real effect is visible without opening the log tab -->
    <section class="ui-group aside-card recent">
      <header class="aside-head">
        <h2>最近觸發</h2>
        <button
          type="button"
          class="aside-link"
          @click="emit('open-logs')"
        >
          全部日誌
        </button>
      </header>
      <ul
        v-if="recent.length > 0"
        class="recent-list"
      >
        <li
          v-for="log in recent"
          :key="log.id"
        >
          <div class="r-top">
            <strong>{{ log.rule_name }}</strong>
            <time>{{ formatRelativeTime(log.created_at) }}</time>
          </div>
          <p>{{ log.trigger_content }}</p>
        </li>
      </ul>
      <p
        v-else
        class="recent-empty"
      >
        還沒有觸發記錄。規則被客戶訊息命中後會出現在這裡。
      </p>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AutoReplyLog, AutoReplyRule } from '@/api/autoReply'
import { matchAutoReplyRules } from '@/utils/auto-reply-match'
import { formatRelativeTime } from '@/utils/monitor-helpers'

const props = defineProps<{
  rules: AutoReplyRule[]
  logs: AutoReplyLog[]
  isBusinessHours: boolean
}>()

const emit = defineEmits<{
  'open-rule': [id: number]
  'open-logs': []
}>()

const text = ref('')
const open = ref(props.isBusinessHours)
watch(() => props.isBusinessHours, (v) => { open.value = v })

const matches = computed(() => matchAutoReplyRules(text.value, props.rules, open.value))
const winner = computed(() => matches.value[0] ?? null)
const shadowed = computed(() => matches.value.slice(1))
const recent = computed(() => props.logs.slice(0, 4))

function replyText(rule: AutoReplyRule): string {
  const first = rule.actions[0]
  if (!first) { return '' }
  if (first.actionType === 'reply_text') { return (first.content ?? '').trim() }
  return first.actionType === 'reply_image' ? '（回覆一張圖片）' : '（回覆一則卡片訊息）'
}
</script>

<style scoped>
.rule-aside {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.aside-card {
  padding-bottom: 6px;
}

/* the tester is the page's one hands-on tool: tinted so it is found, not scrolled past */
.tester {
  background: color-mix(in srgb, var(--ui-accent) 11%, var(--ui-surface));
}

.tester .ui-input {
  height: 44px;
  background: var(--ui-surface);
}

.aside-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 12px 20px 4px;
}

.aside-head h2 {
  margin: 0;
  font: 600 16px var(--ui-font-display);
}

.aside-link {
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-accent);
  cursor: pointer;
}

.aside-link:hover {
  background: var(--ui-accent-soft);
}

.aside-body {
  display: grid;
  gap: 12px;
  padding: 8px 20px 18px;
}

.tester-hint,
.verdict-none,
.recent-empty {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-muted);
}

.verdict-none {
  color: var(--ui-ink-2);
}

.verdict {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-green-soft);
}

.verdict-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-green-ink);
}

.verdict-rule {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: var(--ui-ink);
  text-align: left;
  cursor: pointer;
}

.verdict-rule strong {
  min-width: 0;
  overflow: hidden;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.verdict-rule:hover strong {
  text-decoration: underline;
}

.verdict-prio {
  flex: none;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ui-ink-2);
}

.verdict-why {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.verdict-reply {
  display: -webkit-box;
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.shadowed {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-muted);
}

/* the newest triggers fill what is left beside the rule list, so both columns end together */
.recent {
  flex: 1;
}

.recent-list {
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
}

.recent-list li {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 11px 20px;
}

.recent-list li + li::before {
  position: absolute;
  top: 0;
  right: 20px;
  left: 20px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.r-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.r-top strong {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.r-top time {
  flex: none;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.recent-list p {
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-empty {
  padding: 8px 20px 16px;
}

@media (max-width: 1024px) {
  .rule-aside {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 768px) {
  .rule-aside {
    grid-template-columns: minmax(0, 1fr);
  }

  /* with a result the hint is redundant, and without one the input says what it does */
  .tester-hint {
    display: none;
  }

  /* the log tab is one tap away; the phone keeps the tester only */
  .recent {
    display: none;
  }

  .aside-head {
    padding-right: 16px;
    padding-left: 16px;
  }

  .aside-body {
    padding-right: 16px;
    padding-left: 16px;
  }

  .recent-list li {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
