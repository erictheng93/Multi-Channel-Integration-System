<template>
  <aside
    class="side-panel"
    aria-label="客戶資訊"
  >
    <template v-if="conversation">
      <!-- Who, and the shape of the conversation: the anchor of the panel -->
      <section class="sp-card sp-lead">
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
          <div class="who-text">
            <div class="name">
              {{ customerName }}
            </div>
            <div class="sub">
              {{ platformLabel }}<template v-if="customerId">
                · ID {{ customerId }}
              </template>
            </div>
          </div>
        </div>

        <template v-if="rhythm">
          <h3 class="sp-h">
            回覆速度
          </h3>
          <p class="sp-note">
            客戶來訊到客服回覆花了多久{{ rhythm.capped || hasMore ? '（最近幾輪）' : '' }}
          </p>
          <ul
            class="waits"
            :aria-label="rhythm.aria"
          >
            <li
              v-for="row in rhythm.rows"
              :key="row.key"
              class="wait"
              :class="{ 'is-pending': row.pending }"
            >
              <span class="wait-at">{{ row.at }}</span>
              <span
                class="wait-track"
                aria-hidden="true"
              ><i :style="{ width: `${row.pct}%` }" /></span>
              <span class="wait-val">{{ row.text }}</span>
            </li>
          </ul>
          <dl
            class="glance"
            :aria-label="`往來 共 ${totalMessages} 則`"
          >
            <div>
              <dt>客戶來訊</dt>
              <dd>{{ activity?.customer ?? 0 }}</dd>
            </div>
            <div>
              <dt>客服回覆</dt>
              <dd>{{ activity?.agent ?? 0 }}</dd>
            </div>
            <div v-if="activity?.firstReply">
              <dt>首次回覆</dt>
              <dd>{{ activity.firstReply }}</dd>
            </div>
          </dl>
        </template>
      </section>

      <section class="sp-card">
        <h3 class="sp-h">
          歸屬
        </h3>
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

      <section class="sp-card">
        <h3 class="sp-h">
          對話
        </h3>
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
          <div v-if="totalMessages > 0">
            <dt>{{ hasMore ? '已載入訊息' : '訊息數' }}</dt>
            <dd>{{ totalMessages }} 則</dd>
          </div>
          <div v-if="lastMessageText">
            <dt>最後訊息</dt>
            <dd>{{ lastMessageText }}</dd>
          </div>
          <div v-if="rhythm?.avgText">
            <dt>平均回覆</dt>
            <dd>{{ rhythm.avgText }}</dd>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Conversation } from '@/types'
import type { Tag } from '@/api/tags'
import { avatarToneOf, initialOf, platformName, statusOf } from '@/composables/conversation/useConversationRowMeta'

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

const totalMessages = computed(() => (activity.value?.customer ?? 0) + (activity.value?.agent ?? 0))

const gapText = (ms: number): string => {
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) { return '< 1 分' }
  if (minutes < 60) { return `${minutes} 分` }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) { return minutes % 60 === 0 ? `${hours} 小時` : `${hours} 小時 ${minutes % 60} 分` }
  return `${Math.floor(hours / 24)} 天`
}

const stamp = (t: number, withDate: boolean): string => {
  const d = new Date(t)
  const time = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return withDate ? `${d.getMonth() + 1}/${d.getDate()} ${time}` : time
}

// A clock for the "已等" end of the strip; half a minute is fine-grained enough for a label in minutes
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => { if (timer) { clearInterval(timer) } })

const WAIT_ROWS = 4

/**
 * How fast the team answered: every run of customer messages is one row, from its first message to the
 * reply that answered it. Bars share one scale (the longest wait), so rows compare honestly; a wait that
 * is still open on an open conversation is the last row, in orange. Built from the messages already loaded.
 */
const rhythm = computed(() => {
  const all = (props.messages ?? [])
    .map(m => ({ side: m.senderType === 'customer' ? 'customer' : m.senderType === 'agent' ? 'agent' : '', t: timeOf(m) }))
    .filter(m => m.side !== '' && Number.isFinite(m.t))
    .sort((a, b) => a.t - b.t)
  if (all.length < 2) { return null }
  const waits: { key: string; ms: number; at: number; pending: boolean }[] = []
  let runStart: number | null = null
  for (const m of all) {
    if (m.side === 'customer') {
      if (runStart === null) { runStart = m.t }
    } else if (runStart !== null) {
      waits.push({ key: `w${runStart}`, ms: m.t - runStart, at: runStart, pending: false })
      runStart = null
    }
  }
  if (runStart !== null && props.conversation?.status !== 'closed') {
    waits.push({ key: 'open', ms: Math.max(0, now.value - runStart), at: runStart, pending: true })
  }
  if (waits.length === 0) { return null }
  const picked = waits.slice(-WAIT_ROWS)
  const longest = Math.max(...picked.map(w => w.ms), 1)
  const answered = waits.filter(w => !w.pending)
  const first = all[0]?.t ?? 0
  const last = all[all.length - 1]?.t ?? 0
  const sameDay = new Date(first).toDateString() === new Date(last).toDateString()
  return {
    rows: picked.map(w => ({
      key: w.key,
      at: stamp(w.at, !sameDay),
      pct: Math.max(4, Math.round((w.ms / longest) * 100)),
      text: w.pending ? `已等 ${gapText(w.ms)}` : gapText(w.ms),
      pending: w.pending
    })),
    capped: waits.length > picked.length,
    avgText: answered.length > 0 ? gapText(answered.reduce((sum, w) => sum + w.ms, 0) / answered.length) : '',
    aria: `客服回覆速度，最近 ${picked.length} 輪${picked.some(w => w.pending) ? '，客戶仍在等待回覆' : ''}`
  }
})

const lastMessageText = computed(() => {
  const times = (props.messages ?? []).filter(m => m.senderType === 'customer' || m.senderType === 'agent').map(timeOf).filter(Number.isFinite)
  if (times.length === 0) { return '' }
  const last = Math.max(...times)
  return stamp(last, new Date(last).toDateString() !== new Date().toDateString())
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
/* A grey well holding three white cards: the shape of the conversation leads, the rest is reference */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  overflow-y: auto;
}

.sp-card {
  flex: none;
  padding: 16px 16px 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
}

/* The last card takes the rest of the rail, so the column ends flush with the chat instead of floating */
.sp-card:last-child {
  flex: 1 0 auto;
}

.sp-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ui-ink-2);
}

.sp-h small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.who {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 18px;
}

.avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: #fff;
  font: 600 22px var(--ui-font-display);
}

.avatar .ch {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 20px;
  height: 20px;
  border-radius: 7px;
  box-shadow: 0 0 0 3px var(--ui-surface);
}

.avatar .ch svg {
  width: 12px;
  height: 12px;
}

.who-text {
  min-width: 0;
}

.name {
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

/* ---- reply speed: one bar per customer-to-reply wait, all on the same scale ---- */
.sp-note {
  margin: -6px 0 12px;
  font-size: 13px;
  line-height: 18px;
  color: var(--ui-muted);
}

.waits {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wait {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.wait-at {
  color: var(--ui-muted);
}

.wait-track {
  height: 10px;
  border-radius: 5px;
  background: var(--ui-fill);
  overflow: hidden;
}

.wait-track i {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: var(--ui-accent);
}

.wait-val {
  min-width: 52px;
  font-weight: 600;
  text-align: right;
  color: var(--ui-ink);
}

.wait.is-pending .wait-track i {
  background: var(--ui-orange-ink);
}

.wait.is-pending .wait-val {
  color: var(--ui-orange-ink);
}

.glance {
  display: flex;
  gap: 8px;
  margin: 14px 0 0;
  padding-top: 14px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.glance > div {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.glance dt {
  font-size: 13px;
  color: var(--ui-ink-2);
  white-space: nowrap;
}

.glance dd {
  margin: 0;
  font: 700 20px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.assign-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
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

.skeleton {
  display: grid;
  gap: 12px;
  padding: 10px;
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
