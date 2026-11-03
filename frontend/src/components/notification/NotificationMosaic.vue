<template>
  <div
    class="types"
    role="group"
    aria-label="依類型篩選通知"
  >
    <p
      class="types-head"
      aria-hidden="true"
    >
      <span>依類型</span><span>{{ total }} 則</span>
    </p>
    <!-- One bar for the whole inbox: each type is a stretch of it, as wide as its share -->
    <div
      class="mix"
      aria-hidden="true"
    >
      <i
        v-for="row in list"
        :key="row.value"
        :class="[`hue-${row.hue}`, { 'is-dim': selected !== '' && selected !== row.value }]"
        :style="{ flex: `${row.total} 1 0` }"
      />
    </div>
    <div class="legend-grid">
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
        <i
          class="type-sw"
          :class="`hue-${row.hue}`"
          aria-hidden="true"
        />
        <span class="type-name">{{ row.label }}</span>
        <span class="type-total">{{ row.total }}</span>
        <span
          class="type-unread"
          :class="{ 'is-none': row.unread === 0 }"
        >{{ row.unread > 0 ? `${row.unread} 未讀` : '' }}</span>
      </button>
    </div>
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

/** Four soft families, so seven types stay readable: conversation, routing, attention, system */
const HUE: Record<string, 'blue' | 'indigo' | 'orange' | 'grey'> = {
  new_message: 'blue',
  customer_responded: 'blue',
  conversation_assigned: 'indigo',
  conversation_transferred: 'indigo',
  mention: 'orange',
  task_reminder: 'orange'
}

/** Biggest type first; the bar and the legend share the order, the share of the bar is the count */
const list = computed(() =>
  [...props.rows]
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map(r => ({ ...r, hue: HUE[r.value] ?? 'grey' }))
)

const total = computed(() => list.value.reduce((sum, r) => sum + r.total, 0))
</script>

<style scoped>
.types {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.types-head {
  display: flex;
  justify-content: space-between;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

/* the composition bar: tinted stretches with a hairline gap, one hue per family */
.mix {
  display: flex;
  gap: 3px;
  height: 16px;
}

.mix i {
  min-width: 6px;
  border-radius: 5px;
  transition: opacity var(--ui-dur) var(--ui-ease);
}

.mix i:first-child {
  border-radius: 8px 5px 5px 8px;
}

.mix i:last-child {
  border-radius: 5px 8px 8px 5px;
}

.hue-blue {
  background: color-mix(in srgb, var(--ui-blue) 62%, var(--ui-surface));
}

.hue-indigo {
  background: color-mix(in srgb, var(--ui-indigo) 52%, var(--ui-surface));
}

.hue-orange {
  background: color-mix(in srgb, var(--ui-orange) 62%, var(--ui-surface));
}

.hue-grey {
  background: color-mix(in srgb, var(--ui-ink) 28%, var(--ui-surface));
}

.is-dim {
  opacity: 0.35;
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 2px 8px;
}

.type {
  display: grid;
  grid-template-columns: 10px auto 1fr auto;
  gap: 8px;
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

.type-sw {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.type-name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.type-total {
  font: 700 15px / 1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--ui-ink-2);
}

.type-unread {
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--ui-accent);
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.type-unread.is-none {
  display: none;
}

/* Phone: the bar stays, the types become one swipeable row of chips (fade at the edge says there is more) */
@media (max-width: 768px) {
  .types {
    gap: 10px;
    padding: 0 16px;
  }

  .types-head {
    display: none;
  }

  .mix {
    height: 12px;
  }

  .legend-grid {
    display: flex;
    gap: 8px;
    margin: 0 -16px;
    padding: 0 16px 4px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent);
  }

  .legend-grid::-webkit-scrollbar {
    display: none;
  }

  .type {
    display: inline-flex;
    flex: none;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow-pill);
  }

  .type.is-selected {
    background: var(--ui-accent);
    color: #fff;
  }

  .type.is-selected .type-total {
    color: #fff;
  }

  .type-name {
    font-size: 14px;
  }

  .type-total {
    font-size: 14px;
  }

  .type.is-selected .type-unread {
    background: #fff;
    color: var(--ui-accent);
  }
}
</style>
