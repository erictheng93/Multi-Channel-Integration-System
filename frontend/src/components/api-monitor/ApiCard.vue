<template>
  <div
    class="ep-wrap"
    :class="{ open: expanded }"
    @click="$emit('toggle')"
  >
    <div
      class="ep"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @keydown.enter.prevent="$emit('toggle')"
      @keydown.space.prevent="$emit('toggle')"
    >
      <span
        class="meth"
        :class="endpoint.method.toLowerCase()"
      >{{ endpoint.method }}</span>

      <div class="ep-main">
        <div class="path">
          <template
            v-for="(seg, i) in pathSegments"
            :key="i"
          >
            <span class="seg">{{ seg }}</span><wbr>
          </template>
          <span
            v-if="endpoint.status !== 'healthy'"
            class="flag"
            :class="endpoint.status"
          >{{ statusText }}</span>
        </div>
        <div class="desc">
          {{ endpoint.description }}
        </div>
      </div>
      <div
        class="sr"
        :class="successClass"
      >
        <span class="sr-l">成功率 </span>{{ endpoint.successRate }}%<span class="sr-n"> 成功 · {{ endpoint.requestCount.toLocaleString() }} 次/時</span>
      </div>

      <span
        v-if="scaleMs"
        class="range"
        :class="endpoint.status"
        role="img"
        :aria-label="`P50 ${endpoint.p50ResponseTime} 毫秒至 P95 ${endpoint.responseTime} 毫秒`"
      >
        <i :style="rangeStyle" />
      </span>

      <span class="m m-p95"><span class="m-k">P95 </span>{{ latency.value }}<small>{{ latency.unit }}</small></span>
      <span
        class="m m-rate hide-m"
        :class="successClass"
      >{{ endpoint.successRate }}%</span>
      <span class="m hide-m">{{ endpoint.requestCount.toLocaleString() }}<small>/時</small></span>

      <svg
        class="chev"
        :class="{ 'rotate-90': expanded }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="m9 18 6-6-6-6" /></svg>
    </div>

    <EndpointDetailPanel
      v-if="expanded"
      :endpoint="endpoint"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint } from '@/types/api-monitor'
import EndpointDetailPanel from './EndpointDetailPanel.vue'

const props = defineProps<{
  endpoint: ApiEndpoint
  expanded: boolean
  /** Shared right-hand end of the latency band, ms (the slowest P95 across all endpoints) */
  scaleMs?: number
}>()

defineEmits<{
  (_e: 'toggle'): void
}>()

/** Path split after each slash ("/api/", "auth/", "login"): the only places a phone may wrap a path */
const pathSegments = computed(() => {
  const raw = props.endpoint.endpoint
  const lead = raw.startsWith('/') ? '/' : ''
  const parts = raw.slice(lead.length).split(/(?<=\/)/)
  return parts.map((part, i) => (i === 0 ? lead + part : part))
})

const latency = computed(() => {
  const ms = props.endpoint.responseTime
  return ms >= 1000 ? { value: (ms / 1000).toFixed(2), unit: 's' } : { value: String(Math.round(ms)), unit: 'ms' }
})

/** The band runs from P50 to P95 on one scale for every row, so rows compare by eye */
const rangeStyle = computed(() => {
  const max = props.scaleMs || 1
  const lo = Math.min(props.endpoint.p50ResponseTime, props.endpoint.responseTime)
  const hi = props.endpoint.responseTime
  const left = Math.min(98, (lo / max) * 100)
  const width = Math.max(2, Math.min(100 - left, ((hi - lo) / max) * 100))
  return { left: `${left}%`, width: `${width}%` }
})

const statusText = computed(() => {
  const map: Record<string, string> = { healthy: '正常', warning: '警告', error: '錯誤' }
  return map[props.endpoint.status] ?? props.endpoint.status
})

/** Measurements (P95, requests) stay ink; only the success rate carries health colour, always one weight */
const successClass = computed(() => {
  if (props.endpoint.successRate < 95) { return 'bad' }
  return props.endpoint.successRate < 99 ? 'warn' : 'ok'
})
</script>

<style scoped>
.ep-wrap {
  position: relative;
  cursor: pointer;
}

.ep-wrap + .ep-wrap::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.ep-wrap.open {
  background: color-mix(in srgb, var(--ui-fill) 30%, transparent);
}

.ep {
  display: grid;
  grid-template-columns: 52px minmax(260px, 1.25fr) repeat(3, minmax(0, 1fr)) 16px;
  gap: 12px;
  align-items: center;
  padding: 12px 22px;
}

.m-k {
  display: none;
}

.range {
  display: none;
}

@media (min-width: 1281px) {
  .ep.has-range,
  .ep:has(.range) {
    grid-template-columns: 52px 290px minmax(0, 1fr) 150px 90px 90px 110px 16px;
  }

  .range {
    position: relative;
    display: block;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ui-fill) 55%, transparent);
  }

  .range i {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ui-accent) 38%, var(--ui-surface));
  }

  .range.warning i {
    background: color-mix(in srgb, var(--ui-orange) 50%, var(--ui-surface));
  }

  .range.error i {
    background: color-mix(in srgb, var(--ui-red) 45%, var(--ui-surface));
  }
}

@media (min-width: 1025px) {
  .ep {
    grid-template-columns: 52px 290px minmax(0, 1fr) 90px 90px 110px 16px;
    padding-top: 14px;
    padding-bottom: 14px;
  }

  .ep-main {
    display: contents;
  }

  .desc {
    grid-column: 3;
    grid-row: 1;
    padding-right: 12px;
  }

  .path {
    grid-column: 2;
    grid-row: 1;
  }

  .m {
    text-align: right;
  }
}

.ep:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

/* Only a problem is flagged, in words; healthy rows stay quiet */
.flag {
  display: inline-block;
  margin-left: 8px;
  padding: 0 8px;
  border-radius: 999px;
  font: 600 13px / 20px var(--ui-font-ui);
  vertical-align: 1px;
}

.flag.warning {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.flag.error {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.meth {
  display: inline-grid;
  place-items: center;
  height: 22px;
  border-radius: 999px;
  background: var(--ui-fill);
  font: 700 13px var(--ui-font-ui);
  color: var(--ui-muted);
}

.meth.get {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.meth.post {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.meth.put,
.meth.patch {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.meth.delete {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.ep-main {
  min-width: 0;
}

.path {
  overflow: hidden;
  font: 13px var(--ui-font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc {
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sr {
  display: none;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sr.warn {
  color: var(--ui-orange-ink);
}

.sr.bad {
  color: var(--ui-red-ink);
}

.sr:not(.warn, .bad) {
  color: var(--ui-green-ink);
}

.m {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.m small {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}

.m.ok {
  color: var(--ui-green-ink);
}

.m.warn {
  color: var(--ui-orange-ink);
}

.m.bad {
  color: var(--ui-red-ink);
}

.chev {
  width: 16px;
  height: 16px;
  color: var(--ui-muted);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.chev.rotate-90 {
  transform: rotate(90deg);
}

/* the request count joins the success line on a phone (its own column is hidden there) */
.sr-n {
  display: none;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .sr-n {
    display: inline;
  }

  .sr-l {
    display: none;
  }

  /* Phone: the first line is the measurement strip (method, P95, success, requests), then the path, then the description */
  .ep {
    grid-template-areas:
      'meth m sr chev'
      'main main main main';
    grid-template-columns: auto auto minmax(0, 1fr) 16px;
    gap: 6px 12px;
    padding: 12px 16px;
  }

  .m-k {
    display: inline;
    font-weight: 400;
    color: var(--ui-muted);
  }

  .m {
    text-align: left;
    white-space: nowrap;
  }

  .meth {
    grid-area: meth;
    justify-self: start;
    padding: 0 9px;
    height: 20px;
    font-size: 13px;
  }

  .ep-main {
    grid-area: main;
  }

  .m-p95 {
    grid-area: m;
  }

  .chev {
    grid-area: chev;
  }

  .hide-m {
    display: none;
  }

  /* Phone: nothing is cut. Paths wrap only after a slash (the segments never break), descriptions wrap,
     and the success rate keeps a line of its own */
  .path {
    overflow: visible;
    font-size: 13px;
    text-overflow: clip;
    white-space: normal;
  }

  .seg {
    white-space: nowrap;
  }

  .desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sr {
    display: block;
    grid-area: sr;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ep-wrap + .ep-wrap::before {
    left: 16px;
  }
}
</style>
