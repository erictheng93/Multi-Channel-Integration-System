<template>
  <article class="ui-lead topo-card">
    <!-- Signature: the request path. Channels come in on the left, the API answers in the middle,
         Cloudflare services sit behind it on the right. A fault shows as a coloured line. -->
    <div class="topo">
      <div class="core">
        <div class="core-kicker">
          整體狀態
        </div>
        <div
          class="core-verdict"
          :class="`is-${tone}`"
          :aria-busy="busy || undefined"
        >
          <span
            v-if="busy"
            class="core-skel"
            aria-hidden="true"
          />
          <template v-else>
            {{ verdict ?? '—' }}
          </template>
        </div>
        <p
          v-if="meaning"
          class="core-meaning"
        >
          {{ meaning }}
        </p>

        <figure
          v-if="rows.length > 0"
          class="p95"
          role="img"
          :aria-label="aria"
        >
          <figcaption>
            <span>端點 P95 回應時間</span>
            <span>每條共用同一刻度</span>
          </figcaption>
          <ol>
            <li
              v-for="row in rows"
              :key="row.key"
              :class="`is-${row.tone}`"
            >
              <span class="p95-path">{{ row.path }}</span>
              <b>{{ row.display }}</b>
              <span class="p95-track">
                <i :style="{ width: row.pct }" />
                <u
                  v-if="ceiling.mark !== null"
                  :style="{ left: ceiling.mark }"
                />
              </span>
            </li>
          </ol>
          <div
            v-if="ceiling.mark !== null"
            class="p95-axis"
            aria-hidden="true"
          >
            <span class="ax-0">0</span>
            <span
              class="ax-mark"
              :style="{ left: ceiling.mark }"
            >500 ms 警戒線</span>
            <span
              v-if="ceiling.showTop"
              class="ax-top"
            >{{ ceiling.label }}</span>
          </div>
          <p
            v-if="avgMs"
            class="p95-note"
          >
            <span>全部端點平均回應 {{ avgMs }} ms</span>
          </p>
        </figure>
      </div>

      <div class="side">
        <div class="col col-in">
          <h2 class="col-title">
            頻道進線
          </h2>
          <div class="nodes">
            <div
              v-for="n in inNodes"
              :key="n.id"
              class="node"
              :class="`is-${n.tone}`"
            >
              <span
                class="node-ico"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path :d="n.icon" /></svg>
              </span>
              <span class="node-main">
                <b>{{ n.name }}</b>
                <small :title="n.title">{{ n.state }}</small>
              </span>
              <span
                v-if="n.ms !== null"
                class="node-ms"
              >{{ n.ms }}<small> ms</small></span>
            </div>
            <p
              v-if="inNodes.length === 0"
              class="node-none"
            >
              尚無資料
            </p>
          </div>
        </div>


        <div class="col col-out">
          <h2 class="col-title">
            後端服務
          </h2>
          <div class="nodes">
            <div
              v-for="n in outNodes"
              :key="n.id"
              class="node"
              :class="`is-${n.tone}`"
            >
              <span
                class="node-ico"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path
                  v-for="(d, i) in n.paths"
                  :key="i"
                  :d="d"
                /></svg>
              </span>
              <span class="node-main">
                <b>{{ n.name }}</b>
                <small>{{ n.state }}</small>
              </span>
              <span class="node-ms">{{ n.ms }}<small> ms</small></span>
            </div>
            <p
              v-if="outNodes.length === 0"
              class="node-none"
            >
              尚無資料
            </p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="events.length > 0"
      class="events"
    >
      <h2>近期事件</h2>
      <ul>
        <li
          v-for="e in events.slice(0, 3)"
          :key="e.id"
          :class="`is-${e.type}`"
        >
          <span
            class="ev-dot"
            aria-hidden="true"
          />
          <time :datetime="e.timestamp">{{ formatRelativeTime(e.timestamp) }}</time>
          <span class="ev-msg">{{ e.message }}</span>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint, ChannelItem, InfrastructureItem, MonitorEvent } from '@/types/api-monitor'
import { formatRelativeTime, translateChannelDetail, translateChannelName, translateInfraName } from '@/utils/monitor-helpers'

type Tone = 'good' | 'warn' | 'bad' | 'none'

const props = defineProps<{
  channels: ChannelItem[]
  infrastructure: InfrastructureItem[]
  /** Endpoint rows for the P95 bars; empty until endpoint metrics are configured */
  endpoints: ApiEndpoint[]
  events: MonitorEvent[]
  /** Average response time across the endpoints, ms */
  avgMs?: number
  verdict: string | null
  tone: Tone
  meaning?: string
  busy?: boolean
}>()

const WARN_MS = 500

// ---- left: channels (webhook delivery can only be fine when every channel is) ----
const CHAT = 'M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z'
const LINK = 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'

const inNodes = computed(() =>
  props.channels.map((c) => {
    const others = props.channels.filter(o => o.id !== c.id)
    const degraded = c.id === 'webhook-delivery' && c.status === 'connected' && others.some(o => o.status !== 'connected')
    const tone: Tone = degraded ? 'warn' : c.status === 'connected' ? 'good' : c.status === 'error' ? 'bad' : 'warn'
    const word = degraded ? '部分可用' : c.status === 'connected' ? '已連線' : c.status === 'error' ? '錯誤' : '未連線'
    const detail = degraded
      ? translateChannelDetail('Some webhook channels unavailable', c.status)
      : translateChannelDetail(c.details ?? '', c.status)
    const brand = /line|facebook|messenger/i.test(c.name)
    return {
      id: c.id,
      name: translateChannelName(c.id, c.name),
      state: tone === 'good' ? word : `${word}，${detail}`,
      title: detail,
      tone,
      icon: brand ? CHAT : LINK,
      ms: c.latencyMs > 0 ? c.latencyMs : null,
    }
  }),
)

// ---- right: Cloudflare services; the server reports latency bands as colours ----
const ICON_PATHS: Record<string, string[]> = {
  d1: ['M12 2C6.5 2 2 3.8 2 6v12c0 2.2 4.5 4 10 4s10-1.8 10-4V6c0-2.2-4.5-4-10-4Z', 'M2 6c0 2.2 4.5 4 10 4s10-1.8 10-4', 'M2 12c0 2.2 4.5 4 10 4s10-1.8 10-4'],
  kv: ['M4 7h16M4 12h16M4 17h16'],
  r2: ['M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8'],
  'durable-objects': ['M12 2 3 7v10l9 5 9-5V7ZM12 12l9-5M12 12 3 7M12 12v10'],
  queue: ['M3 6h18M3 12h18M3 18h12'],
}
const DEFAULT_PATHS = ICON_PATHS.d1 ?? []

const outNodes = computed(() =>
  props.infrastructure.map((item) => {
    const tone: Tone = item.latencyMs < 0 ? 'bad' : item.latencyMs < 50 ? 'good' : item.latencyMs < 200 ? 'warn' : 'bad'
    return {
      id: item.id,
      name: translateInfraName(item.id, item.name),
      state: item.latencyMs < 0 ? '無回應' : tone === 'good' ? '回應快' : tone === 'warn' ? '偏慢' : '很慢',
      tone,
      paths: ICON_PATHS[item.id] ?? DEFAULT_PATHS,
      ms: item.latencyMs < 0 ? 0 : item.latencyMs,
    }
  }),
)

// ---- centre: the slowest endpoints, worst state first ----
const STATUS_TONE = { healthy: 'good', warning: 'warn', error: 'bad' } as const
const STATUS_ORDER = { error: 0, warning: 1, healthy: 2 } as const
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`)

const source = computed(() =>
  [...props.endpoints]
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || b.responseTime - a.responseTime)
    .slice(0, 5),
)
const top = computed(() => Math.max(WARN_MS, ...source.value.map(e => e.responseTime)))
const ceiling = computed(() => ({
  label: fmtMs(top.value),
  mark: top.value > WARN_MS ? `${(WARN_MS / top.value) * 100}%` : null,
  // the right-hand end label would collide with the warning label when the line sits near the end
  showTop: top.value > WARN_MS * 1.5,
}))
const rows = computed(() =>
  source.value.map(e => ({
    key: e.id,
    path: e.endpoint,
    pct: e.responseTime <= 0 ? '2px' : `${Math.max(2, Math.round((e.responseTime / top.value) * 100))}%`,
    display: fmtMs(e.responseTime),
    tone: STATUS_TONE[e.status] ?? 'good',
  })),
)
const aria = computed(() => `端點 P95 回應時間：${rows.value.map(r => `${r.path} ${r.display}`).join('；')}`)
</script>

<style scoped>
.topo-card {
  display: grid;
  gap: 18px;
  padding: 26px 32px 22px;
}

.topo {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 0 36px;
  align-items: stretch;
}

/* the lists sit on one soft panel instead of beside a hairline */
.side {
  display: grid;
  align-content: start;
  gap: 16px;
  min-width: 0;
  padding: 18px 22px 8px;
  border-radius: 22px;
  background: color-mix(in srgb, var(--ui-fill) 42%, var(--ui-surface));
}

.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.col-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-muted);
}

.nodes {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.node {
  --c: var(--ui-green);
  display: flex;
  flex: 1;
  gap: 12px;
  align-items: center;
  min-height: 50px;
  padding: 7px 0;
  border-top: 0.5px solid var(--ui-sep);
}

.node.is-warn { --c: var(--ui-orange); }
.node.is-bad { --c: var(--ui-red); }


.node-ico {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: color-mix(in srgb, var(--c) 12%, var(--ui-surface));
  color: var(--c);
}

.node-ico svg {
  width: 19px;
  height: 19px;
}

.node-main {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.node-main b {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-main small {
  display: -webkit-box;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.3;
  color: var(--ui-ink-2);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.node.is-warn .node-main small {
  color: var(--ui-orange-ink);
}

.node.is-bad .node-main small {
  color: var(--ui-red-ink);
}

.node-ms {
  flex: none;
  font: 600 16px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.node-ms small {
  font: 400 13px var(--ui-font-ui);
  color: var(--ui-muted);
}

.node-none {
  margin: 0;
  font-size: 14px;
  color: var(--ui-muted);
}

/* ---- centre ---- */

.core {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
}

.core-kicker {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--section-ink);
}

.core-verdict {
  font: 600 40px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
}

.core-verdict {
  --c: var(--ui-muted);
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--ui-ink);
}

/* status colour is the dot only; the words stay ink */
.core-verdict::before {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--c);
  content: '';
}

.core-verdict[aria-busy]::before { display: none; }
.core-verdict.is-good { --c: var(--ui-green); }
.core-verdict.is-warn { --c: var(--ui-orange); }
.core-verdict.is-bad { --c: var(--ui-red); }

.core-skel {
  display: inline-block;
  width: 180px;
  height: 40px;
  border-radius: 10px;
  background: var(--ui-fill);
}

.core-meaning {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ui-ink-2);
}

.p95 {
  display: grid;
  gap: 8px;
  margin: 18px 0 0;
  padding-top: 16px;
  border-top: 0.5px solid var(--ui-sep);
}

.p95 figcaption,
.p95-note {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.p95 figcaption span:first-child {
  font-weight: 600;
  color: var(--ui-ink);
}

.p95 ol {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.p95 li {
  --c: var(--ui-green);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 12px;
  align-items: baseline;
  font-size: 13px;
}

.p95 li.is-warn { --c: var(--ui-orange); }
.p95 li.is-bad { --c: var(--ui-red); }

.p95-path {
  overflow: hidden;
  font: 13px var(--ui-font-mono);
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p95-track {
  position: relative;
  grid-column: 1 / -1;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-fill) 55%, transparent);
}

/* shared axis under the bars: where zero is, where the 500 ms line sits, where the full bar ends */
.p95-axis {
  position: relative;
  height: 18px;
  margin-top: -2px;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.p95-axis span {
  position: absolute;
  top: 0;
  white-space: nowrap;
}

.ax-0 { left: 0; }
.ax-top { right: 0; }
.ax-mark { transform: translateX(-50%); }

/* state colour stays, softened: a slow endpoint reads as a longer bar, not a siren */
.p95-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--c) 52%, var(--ui-surface));
}

.p95-track u {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--ui-ink-2);
}

.p95 li b {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.p95-note {
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px 20px;
  color: var(--ui-ink-2);
}

/* ---- events ---- */
.events {
  display: grid;
  gap: 10px;
  padding-top: 16px;
  border-top: 0.5px solid var(--ui-sep);
}

.events h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-muted);
}

.events ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* each event is a small card-less column: time on the first line, the message under it */
.events li {
  --c: var(--ui-muted);
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 4px 10px;
  align-items: center;
  padding: 10px 14px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--c) 9%, var(--ui-surface));
  font-size: 14px;
  line-height: 1.4;
}

.events li.is-error { --c: var(--ui-red); }
.events li.is-warning { --c: var(--ui-orange); }
.events li.is-recovery { --c: var(--ui-green); }

.ev-dot {
  width: 8px;
  height: 8px;
  grid-row: 1;
  border-radius: 50%;
  background: var(--c);
}

.ev-msg {
  text-wrap: balance;
  grid-column: 1 / -1;
  grid-row: 2;
  overflow-wrap: anywhere;
  color: var(--ui-ink);
}

.events time {
  grid-column: 2;
  grid-row: 1;
  font-size: 13px;
  color: var(--ui-ink-2);
}

@media (max-width: 1280px) {
  .topo {
    gap: 0 28px;
  }

}

@media (max-width: 1024px) {
  .topo-card {
    padding: 22px 20px 18px;
  }

  /* below the lines' room: the verdict leads, then the two lists side by side */
  .topo {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }

  .side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 28px;
  }

  .events ul {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .topo-card {
    gap: 14px;
    padding: 20px 16px 16px;
  }

  .core-verdict {
    font-size: 34px;
  }

  /* phone order: verdict and bars, then what just happened, then the lists */
  .topo {
    display: contents;
  }

  .core { order: 1; }
  .events { order: 2; }
  .side { order: 3; }

  .side {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding: 14px 14px 6px;
    border-radius: 18px;
  }

  /* the three backend services fit one row of tiles */
  .col-out .nodes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .col-out .node {
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    padding: 10px 0 8px;
  }

  .col-out .node-main small {
    white-space: nowrap;
  }

  /* phone: events are flat rows, not three grey blocks */
  .events ul {
    gap: 0;
  }

  .events li {
    padding: 9px 0 10px;
    border-radius: 0;
    background: none;
    border-top: 0.5px solid var(--ui-sep);
  }

  .node-ico {
    width: 32px;
    height: 32px;
  }

  .node {
    min-height: 46px;
    padding: 6px 0;
  }

  .node-ms small {
    display: inline;
  }
}
</style>
