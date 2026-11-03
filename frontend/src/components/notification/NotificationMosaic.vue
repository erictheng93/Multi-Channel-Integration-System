<template>
  <div
    class="types"
    role="group"
    aria-label="依類型篩選通知"
  >
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
      ><i :style="{ width: `${row.pct}%` }" /></span>
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
  return sorted.map(r => ({ ...r, pct: Math.max(3, Math.round((r.total / max) * 100)) }))
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
  min-height: 36px;
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
  height: 8px;
  border-radius: 4px;
  background: var(--ui-fill);
  overflow: hidden;
}

.type-bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--ui-accent);
}

.type-total {
  font: 700 16px / 1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.type-unread {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent-ink, var(--ui-accent));
  white-space: nowrap;
}

/* Phone: the same buttons wrap into chips (all of them visible, none clipped), biggest type first */
@media (max-width: 768px) {
  .types {
    flex-flow: row wrap;
    gap: 8px;
    padding: 12px 16px 4px;
  }

  .type {
    display: inline-flex;
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
