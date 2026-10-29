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
        class="sd"
        :class="endpoint.status"
        :title="statusText"
      />

      <span
        class="meth"
        :class="endpoint.method.toLowerCase()"
      >{{ endpoint.method }}</span>

      <div class="ep-main">
        <div class="path">
          {{ endpoint.endpoint }}
        </div>
        <div class="desc">
          {{ endpoint.description }}
        </div>
      </div>

      <span
        class="m"
        :class="p95Class"
      >{{ endpoint.responseTime }}<small> ms</small></span>
      <span
        class="m hide-m"
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
}>()

defineEmits<{
  (_e: 'toggle'): void
}>()

const statusText = computed(() => {
  const map: Record<string, string> = { healthy: '正常', warning: '警告', error: '錯誤' }
  return map[props.endpoint.status] ?? props.endpoint.status
})

const p95Class = computed(() => {
  if (props.endpoint.responseTime >= 1000) { return 'bad' }
  return props.endpoint.responseTime >= 400 ? 'warn' : ''
})

const successClass = computed(() => {
  if (props.endpoint.successRate < 95) { return 'bad' }
  return props.endpoint.successRate < 99 ? 'warn' : ''
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
  right: 0;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.ep-wrap.open {
  background: color-mix(in srgb, var(--ui-fill) 30%, transparent);
}

.ep {
  display: grid;
  grid-template-columns: 10px 52px minmax(0, 1fr) 84px 76px 84px 16px;
  gap: 12px;
  align-items: center;
  padding: 12px 22px;
}

.ep:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.sd {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-muted);
}

.sd.healthy {
  background: var(--ui-green);
}

.sd.warning {
  background: var(--ui-orange);
}

.sd.error {
  background: var(--ui-red);
}

.meth {
  display: inline-grid;
  place-items: center;
  height: 22px;
  border-radius: 999px;
  background: var(--ui-fill);
  font: 700 11px var(--ui-font-ui);
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
  font-size: 12px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.m {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.m small {
  font-size: 11px;
  font-weight: 400;
  color: var(--ui-muted);
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

@media (max-width: 768px) {
  .ep {
    grid-template-columns: 10px 48px minmax(0, 1fr) 76px 16px;
    gap: 10px;
    padding: 12px 16px;
  }

  .hide-m {
    display: none;
  }

  .ep-wrap + .ep-wrap::before {
    left: 16px;
  }
}
</style>
