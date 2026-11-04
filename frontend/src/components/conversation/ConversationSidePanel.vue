<template>
  <aside
    class="side-panel"
    aria-label="客戶資訊"
  >
    <template v-if="conversation">
      <!-- Who: only where the thread header is not visible (the phone sheet) -->
      <div
        v-if="showWho"
        class="who"
      >
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

      <!-- The anchor: where the reply stands right now, and the round counts behind it -->
      <section
        v-if="hold"
        class="hold"
        :class="`hold-${hold.tone}`"
        aria-label="回覆狀態"
      >
        <span class="hold-k">{{ hold.label }}</span>
        <div
          class="hold-fig"
          :aria-label="hold.aria"
        >
          <template
            v-for="(part, i) in hold.parts"
            :key="i"
          >
            <b>{{ part.n }}</b><i>{{ part.u }}</i>
          </template>
        </div>
        <span class="hold-sub">{{ hold.sub }}</span>
        <dl
          v-if="activity"
          class="glance"
          :aria-label="`往來 共 ${totalMessages} 則`"
        >
          <div>
            <dt>客戶來訊</dt>
            <dd>{{ activity.customer }}</dd>
          </div>
          <div>
            <dt>客服回覆</dt>
            <dd>{{ activity.agent }}</dd>
          </div>
          <div v-if="activity.firstReply">
            <dt>首次回覆</dt>
            <dd>{{ activity.firstReply }}</dd>
          </div>
        </dl>
      </section>

      <section
        v-if="rhythm"
        class="sp-sec"
      >
        <h3 class="sp-h">
          回覆速度
          <small>{{ rhythm.capped || hasMore ? '最近幾輪' : '每一輪' }}</small>
        </h3>
        <div
          class="legend"
          aria-hidden="true"
        >
          <span><i class="sw sw-c" />客戶來訊</span>
          <span><i class="sw sw-a" />客服回覆</span>
        </div>
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
            <span class="wait-t">{{ row.at }}</span>
            <span
              class="wait-line"
              aria-hidden="true"
            >
              <i class="dot dot-c" />
              <b>{{ row.text }}</b>
              <i
                class="dot"
                :class="row.pending ? 'dot-p' : 'dot-a'"
              />
            </span>
            <span class="wait-t wait-end">{{ row.pending ? '待回覆' : row.endAt }}</span>
          </li>
        </ul>
      </section>

      <section class="sp-sec">
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

      <section class="sp-sec sp-last">
        <h3 class="sp-h">
          對話
        </h3>
        <dl class="kv">
          <div v-if="!showWho">
            <dt>來源</dt>
            <dd>{{ platformLabel }}</dd>
          </div>
          <div v-if="!showWho && customerId">
            <dt>客戶 ID</dt>
            <dd>{{ customerId }}</dd>
          </div>
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
import { withoutSignOffs } from '@/utils/waiting-messages'

const props = defineProps<{
  conversation?: Conversation
  tags: Tag[]
  /** Messages currently loaded for this conversation (null while unknown) */
  messageCount: number | null
  /** More history exists on the server, so messageCount is only what is loaded */
  hasMore: boolean
  /** Loaded messages, used for the customer/agent split and the first-reply time */
  messages?: ReadonlyArray<{ senderType?: string; content?: string; messageType?: string; createdAt?: string | number | Date; timestamp?: number | Date }>
  /** Show the customer's name and avatar (the thread header already does on desktop) */
  showWho?: boolean
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
    firstReply = gapText(Math.max(60000, firstAgent - firstCustomer))
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

/** A duration split into figure and unit pairs, so the anchor can set the number large and the unit small */
const gapParts = (ms: number): { n: string; u: string }[] => {
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) { return [{ n: '<1', u: '分' }] }
  if (minutes < 60) { return [{ n: String(minutes), u: '分' }] }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return minutes % 60 === 0
      ? [{ n: String(hours), u: '小時' }]
      : [{ n: String(hours), u: '小時' }, { n: String(minutes % 60), u: '分' }]
  }
  return [{ n: String(Math.floor(hours / 24)), u: '天' }]
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

/** The thread as a time-ordered list of who spoke when (customer / agent only) */
const sides = computed(() =>
  withoutSignOffs(
    (props.messages ?? [])
      .filter(m => (m.senderType === 'customer' || m.senderType === 'agent') && Number.isFinite(timeOf(m)))
      .sort((a, b) => timeOf(a) - timeOf(b))
  ).map(m => ({ side: m.senderType === 'customer' ? 'customer' : 'agent', t: timeOf(m) }))
)

/**
 * How fast the team answered: every run of customer messages is one row, from its first message to the
 * reply that answered it. A wait that is still open on an open conversation is the last row, in orange.
 * Built from the messages already loaded.
 */
const waitList = computed(() => {
  const all = sides.value
  const waits: { key: string; ms: number; at: number; end: number; pending: boolean; count: number }[] = []
  let runStart: number | null = null
  let runCount = 0
  for (const m of all) {
    if (m.side === 'customer') {
      if (runStart === null) { runStart = m.t }
      runCount += 1
    } else if (runStart !== null) {
      waits.push({ key: `w${runStart}`, ms: m.t - runStart, at: runStart, end: m.t, pending: false, count: runCount })
      runStart = null
      runCount = 0
    }
  }
  if (runStart !== null && props.conversation?.status !== 'closed') {
    waits.push({ key: 'open', ms: Math.max(0, now.value - runStart), at: runStart, end: now.value, pending: true, count: runCount })
  }
  return waits
})

const rhythm = computed(() => {
  const all = sides.value
  if (all.length < 2) { return null }
  const waits = waitList.value
  if (waits.length === 0) { return null }
  const picked = waits.slice(-WAIT_ROWS)
  const first = all[0]?.t ?? 0
  const last = all[all.length - 1]?.t ?? 0
  const sameDay = new Date(first).toDateString() === new Date(last).toDateString()
  return {
    rows: picked.map(w => ({
      key: w.key,
      at: stamp(w.at, !sameDay),
      endAt: stamp(w.end, !sameDay),
      text: w.pending ? `已等 ${gapText(w.ms)}` : gapText(w.ms),
      pending: w.pending
    })),
    capped: waits.length > picked.length,
    aria: `客服回覆速度，最近 ${picked.length} 輪${picked.some(w => w.pending) ? '，客戶仍在等待回覆' : ''}`
  }
})

/**
 * The anchor of the panel: one state, one figure. Waiting (orange) counts the open wait up; answered (green)
 * shows how long the last round took; closed reads as settled. Nothing is shown before anyone has spoken.
 */
const hold = computed(() => {
  const all = sides.value
  if (all.length === 0) { return null }
  const waits = waitList.value
  const open = waits.find(w => w.pending)
  if (open) {
    return {
      tone: 'waiting' as const,
      label: '客戶在等回覆',
      parts: gapParts(open.ms),
      aria: `客戶已等 ${gapText(open.ms)}`,
      sub: `${open.count} 則來訊未回，自 ${stamp(open.at, new Date(open.at).toDateString() !== new Date().toDateString())} 起`
    }
  }
  if (props.conversation?.status === 'closed') {
    return {
      tone: 'closed' as const,
      label: '已結案',
      parts: [{ n: String(totalMessages.value), u: '則往來' }],
      aria: `已結案，共 ${totalMessages.value} 則往來`,
      sub: sides.value[sides.value.length - 1]?.side === 'customer' ? '最後一則來訊未回覆就結案了' : '客服回覆後結案'
    }
  }
  const lastDone = waits[waits.length - 1]
  if (lastDone) {
    return {
      tone: 'answered' as const,
      label: '客服已回覆',
      parts: gapParts(lastDone.ms),
      aria: `上一輪回覆用了 ${gapText(lastDone.ms)}`,
      sub: '上一輪的回覆用時，客戶尚未再來訊'
    }
  }
  return {
    tone: 'answered' as const,
    label: '客服已發話',
    parts: [{ n: String(totalMessages.value), u: '則往來' }],
    aria: `共 ${totalMessages.value} 則往來`,
    sub: '客戶尚未來訊'
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
/* One continuous column: the reply state leads as a tinted panel, then the rounds, the routing and the facts.
   The facts sit at the foot so the column always ends where the thread ends. */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  padding: 14px 14px 6px;
  overflow-y: auto;
}

.sp-sec {
  flex: none;
  padding: 18px 8px 20px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.sp-last {
  flex: 1;
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

/* ---- who (phone sheet only) ---- */
.who {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 8px 8px 16px;
}

.avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  color: #fff;
  font: 600 20px var(--ui-font-display);
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

/* ---- the anchor: the state of the reply, tinted by its tone ---- */
.hold {
  --hold-bg: var(--ui-fill);
  --hold-ink: var(--ui-ink);
  display: grid;
  gap: 2px;
  padding: 18px 18px 16px;
  border-radius: 20px;
  background: var(--hold-bg);
  color: var(--hold-ink);
}

.hold-waiting {
  --hold-bg: var(--ui-orange-soft);
  --hold-ink: var(--ui-orange-ink);
}

.hold-answered {
  --hold-bg: var(--ui-green-soft);
  --hold-ink: var(--ui-green-ink);
}

.hold-k {
  font-size: 14px;
  font-weight: 700;
}

.hold-fig {
  display: flex;
  gap: 3px;
  align-items: baseline;
  margin: 2px 0 4px;
  font-variant-numeric: tabular-nums;
}

.hold-fig b {
  font: 700 48px / 1.05 var(--ui-font-display);
  letter-spacing: -0.03em;
}

.hold-fig i {
  margin-right: 6px;
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
}

.hold-sub {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.glance {
  display: flex;
  gap: 8px;
  margin: 14px 0 0;
  padding-top: 12px;
  box-shadow: inset 0 0.5px 0 color-mix(in srgb, var(--hold-ink) 22%, transparent);
}

.glance > div {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.glance dt {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.glance dd {
  margin: 0;
  font: 700 20px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ---- reply speed: one row per customer-to-reply round, "customer time --- wait --- reply time" ---- */
.legend {
  display: flex;
  gap: 16px;
  margin: -4px 0 12px;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.sw {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 6px;
  border-radius: 50%;
}

.sw-c {
  background: color-mix(in srgb, var(--ui-ink) 30%, var(--ui-surface));
}

.sw-a {
  background: var(--ui-accent);
}

.waits {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wait {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.wait-t {
  min-width: 44px;
  color: var(--ui-ink-2);
}

.wait-end {
  text-align: right;
}

.wait-line {
  position: relative;
  display: flex;
  gap: 0;
  align-items: center;
  justify-content: space-between;
  height: 24px;
}

.wait-line::before {
  position: absolute;
  inset: 50% 5px auto;
  height: 2px;
  border-radius: 1px;
  background: var(--ui-accent);
  opacity: 0.35;
  content: '';
  transform: translateY(-50%);
}

.wait-line b {
  position: relative;
  padding: 0 8px;
  background: var(--ui-surface);
  color: var(--ui-ink);
  font-weight: 700;
  white-space: nowrap;
}

.wait-line .dot {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-c {
  background: color-mix(in srgb, var(--ui-ink) 30%, var(--ui-surface));
}

.dot-a {
  background: var(--ui-accent);
}

.dot-p {
  background: var(--ui-surface);
  box-shadow: inset 0 0 0 2px var(--ui-orange-ink);
}

.wait.is-pending .wait-line::before {
  background: var(--ui-orange-ink);
  opacity: 0.45;
}

.wait.is-pending .wait-line b,
.wait.is-pending .wait-end {
  color: var(--ui-orange-ink);
  font-weight: 700;
}

/* ---- routing ---- */
.assign-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.assign-row + .tag-row {
  margin-top: 12px;
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

/* ---- facts ---- */
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
