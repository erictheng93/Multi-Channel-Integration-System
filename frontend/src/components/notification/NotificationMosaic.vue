<template>
  <div
    class="types"
    role="group"
    aria-label="依類型篩選通知"
  >
    <p
      class="legend"
      aria-hidden="true"
    >
      <span>依類型</span><span class="legend-keys"><i class="lg-all" />全部<i class="lg-unread" />未讀</span>
    </p>
    <button
      v-for="row in list"
      :key="row.value"
      type="button"
      class="type"
      :class="{ 'is-selected': selected === row.value, 'is-dim': selected !== '' && selected !== row.value }"
      :aria-pressed="selected === row.value"
      :aria-label="`${row.label} ${row.total} 則${row.unread > 0 ? `，${row.unread} 則未讀` : ''}`"
      @click="emit('toggle', row.value)"
    >
      <span class="type-name">{{ row.label }}</span>
      <span
        class="type-bar"
        aria-hidden="true"
      ><i :style="{ width: `${row.pct}%` }"><b :style="{ width: `${row.unreadPct}%` }" /></i></span>
      <span class="type-total">{{ row.total }}</span>
      <span
        class="type-unread"
        :class="{ 'is-none': row.unread === 0 }"
      >{{ row.unread > 0 ? `${row.unread} 未讀` : '' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface MosaicRow {
  value: string
  label: string
  total: number
  unread: number
}

const props = defineProps<{
  rows: readonly MosaicRow[]
  /** The type currently filtered on ('' = none) */
  selected: string
}>()

const emit = defineEmits<{ toggle: [value: string] }>()

/**
 * One quiet row per type, biggest first. The bars share one scale (the biggest type), so the rows compare
 * honestly; the only colour is the accent, and unread is the only thing that gets a second one.
 */
const list = computed(() => {
  const sorted = [...props.rows].filter(r => r.total > 0).sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...sorted.map(r => r.total))
  return sorted.map(r => ({ ...r, pct: Math.max(3, Math.round((r.total / max) * 100)), unreadPct: r.unread > 0 ? Math.max(8, Math.round((r.unread / r.total) * 100)) : 0 }))
})
</script>

<style scoped>
.types {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.type {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 32px 64px;
  gap: 12px;
  align-items: center;
  min-height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease), opacity var(--ui-dur) var(--ui-ease);
}

.type:hover {
  background: var(--ui-fill);
}

.type:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.type.is-selected {
  background: var(--ui-accent-soft);
}

.type.is-dim {
  opacity: 0.6;
}

.type-name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.type-bar {
  height: 10px;
  border-radius: 5px;
  background: var(--ui-fill);
  overflow: hidden;
}

/* the soft bar is everything of this type, the solid head of it is what is still unread */
.type-bar i {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: color-mix(in srgb, var(--ui-accent) 26%, var(--ui-surface));
}

.type-bar b {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: var(--ui-accent);
}

/* column heads: what the rows are, and what the two tones of a bar mean */
.legend {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin: 0 10px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.legend-keys {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.legend i {
  width: 18px;
  height: 8px;
  margin-left: 8px;
  border-radius: 4px;
}

.legend-keys i:first-child {
  margin-left: 0;
}

.lg-all {
  background: color-mix(in srgb, var(--ui-accent) 26%, var(--ui-surface));
}

.lg-unread {
  background: var(--ui-accent);
}

.type-total {
  font: 700 16px / 1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.type-unread {
  justify-self: start;
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--ui-accent-soft);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent-ink, var(--ui-accent));
  white-space: nowrap;
}

.type-unread.is-none {
  background: transparent;
}

/* Phone: the same buttons wrap into chips (all of them visible, none clipped), biggest type first */
@media (max-width: 768px) {
  .types {
    flex-flow: row wrap;
    gap: 8px;
    padding: 4px 0 4px;
  }

  .legend {
    display: none;
  }

  .type {
    display: inline-flex;
    flex: none;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--ui-fill);
  }

  .type.is-selected {
    background: var(--ui-accent);
    color: #fff;
  }

  .type-bar {
    display: none;
  }

  .type-name {
    font-size: 14px;
  }

  .type-total {
    font-size: 14px;
  }

  /* the count is in the button's label; on a chip it is a dot */
  .type-unread {
    width: 8px;
    height: 8px;
    padding: 0;
    border-radius: 50%;
    background: var(--ui-accent);
    font-size: 0;
  }

  .type-unread.is-none {
    display: none;
  }

  .type.is-selected .type-unread {
    background: #fff;
  }
}
</style>
