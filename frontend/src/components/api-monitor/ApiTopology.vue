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

        <div
          v-if="total > 0"
          class="mix"
        >
          <div class="mix-head">
            <span>端點健康</span>
            <span v-if="avgMs">平均回應 <b>{{ avgMs }} ms</b></span>
          </div>
          <div
            class="mix-bar"
            role="img"
            :aria-label="`${total} 個端點：` + segs.map(x => `${x.n} ${x.label}`).join('、')"
          >
            <i
              v-for="seg in segs"
              :key="seg.key"
              :class="seg.key"
              :style="{ flexGrow: seg.n }"
            />
          </div>
          <ul class="mix-key">
            <li
              v-for="seg in segs"
              :key="seg.key"
              :class="seg.key"
            >
              <b>{{ seg.n }}</b> {{ seg.label }}
            </li>
          </ul>
        </div>

        <div
          v-if="events.length > 0"
          class="events"
        >
          <h2>近期事件</h2>
          <ol>
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
          </ol>
        </div>
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
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChannelItem, InfrastructureItem, MonitorEvent } from '@/types/api-monitor'
import { formatRelativeTime, translateChannelDetail, translateChannelName, translateInfraName } from '@/utils/monitor-helpers'

type Tone = 'good' | 'warn' | 'bad' | 'none'

const props = defineProps<{
  channels: ChannelItem[]
  infrastructure: InfrastructureItem[]
  events: MonitorEvent[]
  /** Average response time across the endpoints, ms */
  avgMs?: number
  /** Endpoint count per state; absent until endpoint metrics exist */
  counts?: { healthy: number; warning: number; error: number }
  verdict: string | null
  tone: Tone
  meaning?: string
  busy?: boolean
}>()

// ---- left: channels (webhook delivery can only be fine when every channel is) ----
const CHAT = 'M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z'
const LINK = 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'

const total = computed(() => (props.counts ? props.counts.healthy + props.counts.warning + props.counts.error : 0))
const segs = computed(() => {
  const c = props.counts ?? { healthy: 0, warning: 0, error: 0 }
  return [
    { key: 'healthy', label: '正常', n: c.healthy },
    { key: 'warning', label: '警告', n: c.warning },
    { key: 'error', label: '錯誤', n: c.error },
  ].filter(x => x.n > 0)
})

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
  padding: 0;
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
  background: var(--ui-fill);
  color: var(--ui-ink-2);
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

.node-main small::before {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--c);
  content: '';
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
  min-width: 64px;
  text-align: right;
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

.mix {
  display: grid;
  gap: 8px;
  margin-top: 22px;
}

.mix-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-muted);
}

.mix-head span + span {
  font-weight: 400;
  color: var(--ui-ink-2);
}

.mix-head b {
  font-weight: 600;
  color: var(--ui-ink);
}

.mix-bar {
  display: flex;
  gap: 3px;
  height: 14px;
}

.mix-bar i {
  flex-basis: 0;
  min-width: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-green) 55%, var(--ui-surface));
}

.mix-bar i.warning { background: color-mix(in srgb, var(--ui-orange) 60%, var(--ui-surface)); }
.mix-bar i.error { background: color-mix(in srgb, var(--ui-red) 55%, var(--ui-surface)); }

.mix-key {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.mix-key li::before {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--ui-green);
  content: '';
}

.mix-key li.warning::before { background: var(--ui-orange); }
.mix-key li.error::before { background: var(--ui-red); }

.mix-key b {
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

/* ---- events: a quiet timeline under the verdict; colour is the dot only ---- */
.events {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 0.5px solid var(--ui-sep);
}

.events h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-muted);
}

.events ol {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.events li {
  --c: var(--ui-muted);
  display: grid;
  grid-template-columns: 10px 64px minmax(0, 1fr);
  gap: 0 10px;
  align-items: baseline;
  padding: 9px 0;
  font-size: 14px;
  line-height: 1.4;
}

.events li + li {
  border-top: 0.5px solid var(--ui-sep);
}

.events li.is-error { --c: var(--ui-red); }
.events li.is-warning { --c: var(--ui-orange); }
.events li.is-recovery { --c: var(--ui-green); }

.ev-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
}

.events time {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.ev-msg {
  overflow-wrap: anywhere;
  color: var(--ui-ink);
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

}

@media (max-width: 768px) {
  .topo-card {
    gap: 14px;
    padding: 20px 16px 16px;
  }

  .core-verdict {
    font-size: 34px;
  }

  /* phone order: verdict, then the services (what to act on), then what just happened */
  .topo {
    display: contents;
  }

  .core {
    display: contents;
  }

  .core-kicker { order: 1; margin-bottom: -8px; }
  .core-verdict { order: 2; }
  .core-meaning { order: 3; margin-top: -8px; }
  .mix { order: 4; margin-top: 4px; }
  .side { order: 5; grid-template-columns: minmax(0, 1fr); gap: 14px; padding-top: 4px; }
  .events { order: 6; margin-top: 0; }

  .events li {
    grid-template-columns: 10px minmax(0, 1fr);
    gap: 2px 10px;
  }

  .events time {
    grid-column: 2;
  }

  .ev-msg {
    grid-column: 2;
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
