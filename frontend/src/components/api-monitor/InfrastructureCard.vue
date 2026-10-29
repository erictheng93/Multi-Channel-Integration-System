<template>
  <article class="ui-card">
    <div class="ui-card-head">
      <div>
        <h2 class="ui-card-title">
          基礎設施
        </h2>
        <div class="ui-card-sub">
          Cloudflare 服務延遲
        </div>
      </div>
    </div>
    <div class="list">
      <div
        v-for="item in infrastructure"
        :key="item.id"
        class="inf"
      >
        <span
          class="t"
          :class="tone(item)"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-for="(d, pi) in iconPaths(item.id)"
              :key="pi"
              :d="d"
            />
          </svg>
        </span>
        <div class="inf-name">
          <b>{{ item.name }}</b>
        </div>
        <span
          class="ms"
          :class="tone(item)"
        >
          <template v-if="item.latencyMs >= 0">{{ item.latencyMs }}<small>ms</small></template>
          <template v-else>無回應</template>
        </span>
      </div>
      <div
        v-if="infrastructure.length === 0"
        class="none"
      >
        尚無資料
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { InfrastructureItem } from '@/types/api-monitor'

defineProps<{
  infrastructure: InfrastructureItem[]
}>()

const ICON_PATHS: Record<string, string[]> = {
  d1: [
    'M12 2C6.5 2 2 3.8 2 6v12c0 2.2 4.5 4 10 4s10-1.8 10-4V6c0-2.2-4.5-4-10-4Z',
    'M2 6c0 2.2 4.5 4 10 4s10-1.8 10-4',
    'M2 12c0 2.2 4.5 4 10 4s10-1.8 10-4',
  ],
  kv: ['M4 7h16M4 12h16M4 17h16'],
  r2: ['M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8'],
  'durable-objects': ['M12 2 3 7v10l9 5 9-5V7ZM12 12l9-5M12 12 3 7M12 12v10'],
  queue: ['M3 6h18M3 12h18M3 18h12'],
}

const DEFAULT_PATHS = ICON_PATHS.d1 ?? []

function iconPaths(id: string): string[] {
  return ICON_PATHS[id] ?? DEFAULT_PATHS
}

/** The server reports latency bands as status colours: green < 50 ms, orange < 200 ms, else red. */
function tone(item: InfrastructureItem): 'ok' | 'mid' | 'bad' {
  if (item.latencyMs < 0) { return 'bad' }
  if (item.latencyMs < 50) { return 'ok' }
  return item.latencyMs < 200 ? 'mid' : 'bad'
}
</script>

<style scoped>
.list {
  padding-bottom: 8px;
}

.inf {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 22px;
}

.t {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.t svg {
  width: 16px;
  height: 16px;
}

.t.ok {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.t.mid {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.t.bad {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.inf-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
}

.ms {
  font: 600 14px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.ms small {
  margin-left: 2px;
  font-size: 11px;
  font-weight: 500;
}

.ms.ok {
  color: var(--ui-green-ink);
}

.ms.mid {
  color: var(--ui-orange-ink);
}

.ms.bad {
  color: var(--ui-red-ink);
}

.none {
  padding: 12px 22px;
  font-size: 13px;
  color: var(--ui-muted);
}
</style>
