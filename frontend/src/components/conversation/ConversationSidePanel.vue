<template>
  <aside
    class="side-panel ui-card"
    aria-label="客戶資訊"
  >
    <template v-if="conversation">
      <div class="who">
        <div
          class="avatar"
          :class="`ui-av-${avatarToneOf(customerName)}`"
        >
          {{ initial }}
          <span
            v-if="platform === 'line' || platform === 'facebook'"
            class="ui-ch ch"
            :class="platform === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
          ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
        </div>
        <div class="name">
          {{ customerName }}
        </div>
        <div class="sub">
          {{ platformLabel }}<template v-if="customerId">
            · ID {{ customerId }}
          </template>
        </div>
      </div>

      <!-- At a glance: the four numbers an agent asks for first, each shown once -->
      <dl
        v-if="activity"
        class="glance"
        :aria-label="`往來 共 ${activity.customer + activity.agent} 則`"
      >
        <div>
          <dd>{{ activity.customer }}</dd>
          <dt>客戶來訊</dt>
        </div>
        <div>
          <dd>{{ activity.agent }}</dd>
          <dt>客服回覆</dt>
        </div>
        <div v-if="activity.firstReply">
          <dd class="glance-text">
            {{ activity.firstReply }}
          </dd>
          <dt>首次回覆</dt>
        </div>
        <div v-if="lastInboundText">
          <dd class="glance-text">
            {{ lastInboundText }}
          </dd>
          <dt>客戶最後來訊</dt>
        </div>
      </dl>

      <section class="block">
        <h3>歸屬</h3>
        <div class="assign-row">
          <span class="kv-k">負責團隊</span>
          <span
            v-if="conversation.assignedTeam?.name"
            class="ui-pill ui-pill-blue"
          >{{ conversation.assignedTeam.name }}</span>
          <span
            v-else
            class="ui-pill ui-pill-orange"
          >未指派</span>
        </div>
        <div
          v-if="tags.length > 0"
          class="tag-row"
        >
          <span
            v-for="tag in tags"
            :key="tag.id"
            class="tag"
            :style="{ '--tag': tag.color }"
          >
            <i />{{ tag.name }}
          </span>
        </div>
      </section>

      <!-- Timeline of the loaded messages: when the customer wrote and when the team answered (real times) -->
      <section
        v-if="timeline.length > 0"
        class="block timeline-block"
      >
        <h3>
          往來時間軸<small v-if="hasMore">僅已載入</small>
        </h3>
        <ol class="timeline">
          <li
            v-for="step in timeline"
            :key="step.key"
            :class="step.side"
          >
            <span class="t-time">{{ step.time }}</span>
            <span class="t-label">{{ step.label }}</span>
          </li>
        </ol>
      </section>

      <section class="block">
        <h3>對話</h3>
        <dl class="kv">
          <div>
            <dt>狀態</dt>
            <dd>{{ status.text }}</dd>
          </div>
          <div v-if="createdAtText">
            <dt>開始時間</dt>
            <dd>{{ createdAtText }}</dd>
          </div>
          <div v-if="customerSinceText">
            <dt>客戶建檔</dt>
            <dd>{{ customerSinceText }}</dd>
          </div>
          <div v-if="messageCount !== null && hasMore">
            <dt>已載入訊息</dt>
            <dd>{{ messageCount }} 則</dd>
          </div>
        </dl>
      </section>
    </template>
    <div
      v-else
      class="skeleton"
    >
      <span class="sk sk-a" />
      <span class="sk sk-b" />
      <span class="sk sk-c" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Conversation } from '@/types'
import type { Tag } from '@/api/tags'
import { avatarToneOf, initialOf, platformName, relativeTime, statusOf } from '@/composables/conversation/useConversationRowMeta'

const props = defineProps<{
  conversation?: Conversation
  tags: Tag[]
  /** Messages currently loaded for this conversation (null while unknown) */
  messageCount: number | null
  /** More history exists on the server, so messageCount is only what is loaded */
  hasMore: boolean
  /** Loaded messages, used for the customer/agent split and the first-reply time */
  messages?: ReadonlyArray<{ senderType?: string; createdAt?: string | number | Date; timestamp?: number | Date }>
}>()

const customerName = computed(() => props.conversation?.customer?.name || props.conversation?.user?.name || '未知用戶')
const initial = computed(() => initialOf(customerName.value))
const platform = computed(() => props.conversation?.platform || props.conversation?.customer?.platform || '')
const platformLabel = computed(() => {
  const name = platformName(platform.value)
  return platform.value === 'line' ? 'LINE 官方帳號' : name
})
const customerId = computed(() => props.conversation?.customer?.id ?? props.conversation?.userId ?? '')
const status = computed(() => props.conversation ? statusOf(props.conversation) : { text: '', tone: 'pending' as const })

const timeOf = (m: { createdAt?: string | number | Date; timestamp?: number | Date }): number => {
  const raw = m.timestamp ?? m.createdAt
  const t = raw === undefined ? NaN : new Date(raw).getTime()
  return Number.isFinite(t) ? t : NaN
}

// Client-side tally over the messages already loaded (a partial history is labelled by the caller via hasMore)
const activity = computed(() => {
  const list = props.messages ?? []
  const customer = list.filter(m => m.senderType === 'customer')
  const agent = list.filter(m => m.senderType === 'agent')
  if (customer.length + agent.length === 0) { return null }
  let firstReply = ''
  const firstCustomer = customer.map(timeOf).filter(Number.isFinite).sort((a, b) => a - b)[0]
  const firstAgent = agent.map(timeOf).filter(t => Number.isFinite(t) && t >= (firstCustomer ?? 0)).sort((a, b) => a - b)[0]
  if (firstCustomer !== undefined && firstAgent !== undefined && !props.hasMore) {
    const minutes = Math.max(1, Math.round((firstAgent - firstCustomer) / 60000))
    firstReply = minutes >= 60 ? `${Math.floor(minutes / 60)} 小時 ${minutes % 60} 分` : `${minutes} 分鐘`
  }
  return { customer: customer.length, agent: agent.length, firstReply }
})

const clock = (t: number): string => new Date(t).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })

// First customer message, first reply, latest reply, latest customer message (only the steps that exist, in time order)
const timeline = computed(() => {
  const list = props.messages ?? []
  const of = (sender: string) => list.filter(m => m.senderType === sender).map(timeOf).filter(Number.isFinite).sort((a, b) => a - b)
  const customer = of('customer')
  const agent = of('agent')
  const steps: { key: string; at: number; label: string; side: 'is-customer' | 'is-agent' }[] = []
  if (customer[0] !== undefined) { steps.push({ key: 'c0', at: customer[0], label: props.hasMore ? '客戶來訊' : '客戶開始來訊', side: 'is-customer' }) }
  const firstAgent = agent.find(t => t >= (customer[0] ?? 0))
  if (firstAgent !== undefined) { steps.push({ key: 'a0', at: firstAgent, label: '客服首次回覆', side: 'is-agent' }) }
  const lastAgent = agent[agent.length - 1]
  if (lastAgent !== undefined && lastAgent !== firstAgent) { steps.push({ key: 'a1', at: lastAgent, label: '客服最近回覆', side: 'is-agent' }) }
  const lastCustomer = customer[customer.length - 1]
  if (lastCustomer !== undefined && lastCustomer !== customer[0]) { steps.push({ key: 'c1', at: lastCustomer, label: '客戶最後來訊', side: 'is-customer' }) }
  return steps.sort((a, b) => a.at - b.at).map(s => ({ ...s, time: clock(s.at) }))
})

const lastInboundText = computed(() => {
  const times = (props.messages ?? []).filter(m => m.senderType === 'customer').map(timeOf).filter(Number.isFinite)
  return times.length > 0 ? relativeTime(Math.max(...times), Date.now()) : ''
})

const customerSinceText = computed(() => {
  const created = props.conversation?.customer?.createdAt
  const d = created ? new Date(created) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }) : ''
})

const createdAtText = computed(() => {
  const created = props.conversation?.createdAt
  if (!created) { return '' }
  const d = new Date(created)
  if (Number.isNaN(d.getTime())) { return '' }
  return d.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
})
</script>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 22px 16px 16px;
  overflow-y: auto;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-bottom: 8px;
  text-align: center;
}

.avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin-bottom: 8px;
  border-radius: 50%;
  color: #fff;
  font: 600 28px var(--ui-font-display);
}

.avatar .ch {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  box-shadow: 0 0 0 3px var(--ui-surface);
}

.avatar .ch svg {
  width: 13px;
  height: 13px;
}

.name {
  max-width: 100%;
  overflow: hidden;
  font: 700 20px var(--ui-font-display);
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.block {
  margin-top: 16px;
  padding: 14px 4px 0;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.block h3 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ui-ink-2);
}

.block h3 small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

/* At a glance: a 2x2 of the numbers split by hairlines (no grey slabs), the numerals carry the weight */
.glance {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 12px 0 0;
}

.glance > div {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  justify-content: flex-end;
  min-width: 0;
  padding: 12px 8px 12px 4px;
}

.glance > div:nth-child(odd) {
  box-shadow: inset -0.5px 0 0 var(--ui-sep);
}

.glance > div:nth-child(even) {
  padding-left: 16px;
}

.glance > div:nth-child(-n + 2) {
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
}

.glance > div:nth-child(1) {
  box-shadow: inset -0.5px -0.5px 0 var(--ui-sep);
}

.glance dd {
  margin: 0;
  font: 700 28px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.glance dd.glance-text {
  font-size: 18px;
  line-height: 30px;
  white-space: nowrap;
}

.glance dt {
  font-size: 13px;
  color: var(--ui-ink-2);
  white-space: nowrap;
}

/* Timeline: one rail, a dot per step (customer = grey, team = brand) */
.timeline {
  position: relative;
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0 0 0 18px;
  list-style: none;
}

.timeline::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 4px;
  width: 1.5px;
  border-radius: 1px;
  background: var(--ui-sep);
  content: '';
}

.timeline li {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 14px;
}

.timeline li::before {
  position: absolute;
  top: 6px;
  left: -18px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-faint);
  box-shadow: 0 0 0 3px var(--ui-surface);
  content: '';
}

.timeline li.is-agent::before {
  background: var(--ui-accent);
}

.t-time {
  min-width: 42px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.t-label {
  color: var(--ui-ink-2);
}

.assign-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.assign-row + .tag-row {
  margin-top: 12px;
  padding-top: 12px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.kv-k {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tag, var(--ui-muted)) 16%, var(--ui-surface));
  color: var(--ui-ink);
  font-size: 13px;
  font-weight: 600;
}

.tag i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--tag, var(--ui-muted));
}

.kv {
  display: grid;
  gap: 12px;
  margin: 0;
  font-size: 14px;
}

.kv > div {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.kv dt {
  color: var(--ui-ink-2);
}

.kv dd {
  margin: 0;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.kv-tight {
  gap: 10px;
}

.skeleton {
  display: grid;
  gap: 12px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: var(--ui-fill);
}

.sk-a {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  border-radius: 50%;
}

.sk-b {
  width: 60%;
  height: 16px;
  margin: 0 auto;
}

.sk-c {
  height: 80px;
}
</style>
