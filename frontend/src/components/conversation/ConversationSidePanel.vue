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
            往來節奏<span class="legend"><i class="k-customer" />客戶<i class="k-agent" />客服</span>
          </h3>
          <div
            class="rhythm"
            role="img"
            :aria-label="rhythm.aria"
            :style="{ '--n': rhythm.cols.length }"
          >
            <span
              v-for="col in rhythm.cols"
              :key="col.key"
              class="bar"
              :class="col.side"
              :style="{ gridColumn: col.index + 1 }"
            />
            <span
              v-for="link in rhythm.links"
              :key="link.key"
              class="link"
              :class="{ 'is-pending': link.pending }"
              :style="{ gridColumn: `${link.from + 1} / ${link.to + 2}` }"
            ><em>{{ link.text }}</em></span>
          </div>
          <div
            class="rhythm-axis"
            aria-hidden="true"
          >
            <span>{{ rhythm.first }}</span><span v-if="rhythm.capped || hasMore">最近 {{ rhythm.cols.length }} 則</span><span>{{ rhythm.last }}</span>
          </div>
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

const RHYTHM_MAX = 9

type Side = 'is-customer' | 'is-agent'

/**
 * The shape of the conversation: the latest messages in order, customer above the line and the team below it.
 * A bridge joins the first unanswered customer message of a run to the reply that answered it and says how long
 * that took; a dashed bridge at the end is the wait that is still open. Built from the messages already loaded.
 */
const rhythm = computed(() => {
  const all = (props.messages ?? [])
    .map(m => ({ side: (m.senderType === 'customer' ? 'is-customer' : m.senderType === 'agent' ? 'is-agent' : '') as Side | '', t: timeOf(m) }))
    .filter((m): m is { side: Side; t: number } => m.side !== '' && Number.isFinite(m.t))
    .sort((a, b) => a.t - b.t)
  if (all.length < 2) { return null }
  const picked = all.slice(-RHYTHM_MAX)
  const cols = picked.map((m, index) => ({ key: `${index}-${m.t}`, index, side: m.side, t: m.t }))
  const links: { key: string; from: number; to: number; text: string; pending: boolean }[] = []
  let runStart = -1
  for (const col of cols) {
    if (col.side === 'is-customer') {
      if (runStart < 0) { runStart = col.index }
    } else if (runStart >= 0) {
      const start = cols[runStart]
      if (start) { links.push({ key: `l${runStart}`, from: runStart, to: col.index, text: gapText(col.t - start.t), pending: false }) }
      runStart = -1
    }
  }
  const startOpen = runStart >= 0 ? cols[runStart] : undefined
  if (startOpen && props.conversation?.status !== 'closed') {
    links.push({ key: 'open', from: runStart, to: cols.length - 1, text: `已等 ${gapText(Math.max(0, now.value - startOpen.t))}`, pending: true })
  }
  const first = cols[0]?.t ?? 0
  const last = cols[cols.length - 1]?.t ?? 0
  const sameDay = new Date(first).toDateString() === new Date(last).toDateString()
  return {
    cols,
    links,
    capped: all.length > picked.length,
    first: stamp(first, !sameDay),
    last: stamp(last, !sameDay),
    aria: `最近 ${cols.length} 則往來，客服回覆 ${links.filter(l => !l.pending).length} 次${links.some(l => l.pending) ? '，客戶仍在等待回覆' : ''}`
  }
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

.sp-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ui-ink-2);
}

.legend {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.legend i {
  width: 14px;
  height: 8px;
  border-radius: 4px;
}

.legend .k-agent {
  margin-left: 6px;
  background: var(--ui-accent);
}

.legend .k-customer {
  background: var(--ui-faint);
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

/* ---- the rhythm strip ---- */
.rhythm {
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  grid-template-rows: 20px 46px 20px;
  column-gap: 4px;
}

.bar {
  width: 100%;
  height: 16px;
  border-radius: 8px;
}

.bar.is-customer {
  grid-row: 1;
  align-self: end;
  background: var(--ui-faint);
}

.bar.is-agent {
  grid-row: 3;
  align-self: start;
  background: var(--ui-accent);
}

/* a bridge from the customer's first unanswered message to the reply, labelled with how long it took */
.link {
  position: relative;
  display: flex;
  grid-row: 2;
  align-items: center;
  justify-content: center;
}

.link::before {
  position: absolute;
  inset: 50% 10px auto;
  height: 2px;
  margin-top: -1px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--ui-accent) 55%, transparent);
  content: '';
}

.link em {
  position: relative;
  z-index: 1;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--ui-surface);
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--ui-accent) 40%, transparent);
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-accent-ink, var(--ui-accent));
  white-space: nowrap;
}

.link.is-pending {
  justify-content: flex-end;
}

.link.is-pending::before {
  background: repeating-linear-gradient(90deg, var(--ui-orange-ink) 0 5px, transparent 5px 9px);
}

.link.is-pending em {
  background: var(--ui-orange-soft);
  box-shadow: none;
  color: var(--ui-orange-ink);
}

.rhythm-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
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
