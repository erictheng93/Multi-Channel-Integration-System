<template>
  <!-- Four compact status chips under the lead number; the first three open the endpoint list for that status -->
  <div class="stat-row">
    <button
      v-for="tile in tiles"
      :key="tile.key"
      type="button"
      class="tile"
      :class="[{ 'is-static': !tile.clickable }, tile.tone]"
      @click="$emit('stat-click', tile.key)"
    >
      <span
        class="tile-ico"
        aria-hidden="true"
      >
        <!-- eslint-disable vue/no-v-html -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="tile.icon"
        />
        <!-- eslint-enable vue/no-v-html -->
      </span>
      <span class="tile-label">{{ tile.label }}</span>
      <span class="tile-value">{{ tile.value }}<small>{{ tile.unit }}</small></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiStatistics } from '@/types/api-monitor'

const props = defineProps<{
  stats: ApiStatistics
}>()

defineEmits<{
  (_e: 'stat-click', _type: string): void
}>()

// Inner SVG markup below is static, never user input
const tiles = computed(() => [
  {
    key: 'healthy',
    label: '正常',
    tone: 'green',
    value: props.stats.healthyCount,
    unit: ` / ${props.stats.totalEndpoints}`,
    clickable: true,
    icon: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  },
  {
    key: 'warning',
    label: '警告',
    tone: 'orange',
    value: props.stats.warningCount,
    unit: ` / ${props.stats.totalEndpoints}`,
    clickable: true,
    icon: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17h.01"/>',
  },
  {
    key: 'error',
    label: '錯誤',
    tone: 'red',
    value: props.stats.errorCount,
    unit: ` / ${props.stats.totalEndpoints}`,
    clickable: true,
    icon: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  },
  {
    key: 'all',
    label: '平均回應',
    tone: 'blue',
    value: props.stats.avgResponseTime,
    unit: ' ms',
    clickable: false,
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  },
])
</script>

<style scoped>
.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tile {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px 0 8px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-fill);
  font: inherit;
  font-size: 13px;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.tile:hover {
  background: var(--ui-fill-strong);
}

.tile.is-static {
  cursor: default;
}

.tile.is-static:hover {
  background: var(--ui-fill);
}

.tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.tile-ico {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
}

.tile-ico svg {
  width: 14px;
  height: 14px;
}

.green .tile-ico {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.orange .tile-ico {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.red .tile-ico {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.blue .tile-ico {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.tile-label {
  font-weight: 500;
}

.tile-value {
  font: 600 14px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.tile-value small {
  margin-left: 2px;
  font: 500 13px var(--ui-font-ui);
  color: var(--ui-muted);
}
</style>
