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

      <section class="block">
        <h3>指派</h3>
        <div class="assign-row">
          <span
            v-if="conversation.assignedTeam?.name"
            class="ui-pill ui-pill-blue"
          >{{ conversation.assignedTeam.name }}</span>
          <span
            v-else
            class="ui-pill ui-pill-orange"
          >未指派</span>
        </div>
      </section>

      <section
        v-if="tags.length > 0"
        class="block"
      >
        <h3>客戶標籤</h3>
        <div class="tag-row">
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

      <section
        v-if="activity"
        class="block"
      >
        <h3>往來</h3>
        <div
          class="split"
          role="img"
          :aria-label="`客戶 ${activity.customer} 則，客服 ${activity.agent} 則`"
        >
          <span
            class="split-c"
            :style="{ flexGrow: activity.customer }"
          />
          <span
            class="split-a"
            :style="{ flexGrow: activity.agent }"
          />
        </div>
        <dl class="stats">
          <div>
            <dd>{{ activity.customer }}</dd>
            <dt><i class="dot dot-c" />客戶來訊</dt>
          </div>
          <div>
            <dd>{{ activity.agent }}</dd>
            <dt><i class="dot dot-a" />客服回覆</dt>
          </div>
          <div v-if="activity.firstReply">
            <dd class="stat-text">
              {{ activity.firstReply }}
            </dd>
            <dt>首次回覆</dt>
          </div>
        </dl>
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
          <div v-if="lastInboundText">
            <dt>客戶最後來訊</dt>
            <dd>{{ lastInboundText }}</dd>
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
  padding: 28px 22px 22px;
  overflow-y: auto;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-bottom: 18px;
  text-align: center;
}

.avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 80px;
  height: 80px;
  margin-bottom: 10px;
  border-radius: 50%;
  color: #fff;
  font: 600 30px var(--ui-font-display);
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
  padding: 20px 0;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.block h3 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ui-muted);
}

/* Customer / agent counts: the numerals carry the weight, the labels sit under them */
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 12px;
  margin: 14px 0 0;
}

.stats > div {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}

.stats dd {
  margin: 0;
  font: 600 26px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.stats dd.stat-text {
  font-size: 18px;
  line-height: 26px;
}

.stats dt {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  color: var(--ui-ink-2);
  white-space: nowrap;
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
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tag, var(--ui-muted)) 14%, var(--ui-surface));
  color: var(--ui-ink-2);
  font-size: 13px;
  font-weight: 500;
}

.tag i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--tag, var(--ui-muted));
}

.kv {
  display: grid;
  gap: 14px;
  margin: 0;
  font-size: 14px;
}

.kv > div {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.kv dt {
  color: var(--ui-muted);
}

.kv dd {
  margin: 0;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.split {
  display: flex;
  gap: 3px;
  height: 10px;
  margin-bottom: 14px;
}

.split span {
  min-width: 6px;
  flex-basis: 0;
  border-radius: 999px;
}

.split-c {
  background: var(--ui-faint);
}

.split-a {
  background: var(--section-hue, var(--ui-accent));
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-c {
  background: var(--ui-faint);
}

.dot-a {
  background: var(--section-hue, var(--ui-accent));
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
