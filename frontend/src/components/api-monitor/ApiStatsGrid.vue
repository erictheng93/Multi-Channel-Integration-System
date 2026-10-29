<template>
  <!-- Four peer tiles that take part in the parent grid; the first three open the endpoint list for that status -->
  <button
    v-for="tile in tiles"
    :key="tile.key"
    type="button"
    class="ui-card tile"
    :class="{ 'is-static': !tile.clickable }"
    @click="$emit('stat-click', tile.key)"
  >
    <div class="tile-top">
      <span
        class="tile-ico"
        :class="tile.tone"
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
      {{ tile.label }}
    </div>
    <div
      class="tile-value"
      :class="tile.tone"
    >
      {{ tile.value }}<small>{{ tile.unit }}</small>
    </div>
  </button>
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
.tile {
  display: block;
  padding: 18px 20px 16px;
  border: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.tile:hover {
  box-shadow: var(--ui-shadow-raised);
}

.tile.is-static {
  cursor: default;
}

.tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.tile-top {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.tile-ico {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
}

.tile-ico svg {
  width: 16px;
  height: 16px;
}

.tile-ico.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.tile-ico.orange {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.tile-ico.red {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.tile-ico.blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.tile-value {
  margin: 12px 0 0;
  font: 600 34px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.tile-value.orange {
  color: var(--ui-orange-ink);
}

.tile-value.red {
  color: var(--ui-red-ink);
}

.tile-value small {
  margin-left: 4px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}
</style>
