<template>
  <div
    class="mosaic"
    role="group"
    aria-label="依類型篩選通知"
  >
    <div
      v-for="(row, r) in bands"
      :key="r"
      class="band"
      :style="{ flexGrow: row.weight }"
    >
      <button
        v-for="tile in row.tiles"
        :key="tile.value"
        type="button"
        class="tile"
        :class="[`tone-${tile.tone}`, { 'is-selected': selected === tile.value, 'is-dim': selected !== '' && selected !== tile.value }]"
        :style="{ flexGrow: tile.grow }"
        :aria-pressed="selected === tile.value"
        :aria-label="`${tile.label} ${tile.total} 則${tile.unread > 0 ? `，${tile.unread} 則未讀` : ''}`"
        @click="emit('toggle', tile.value)"
      >
        <span class="tile-name">{{ tile.label }}</span>
        <span class="tile-total">{{ tile.total }}</span>
        <span
          v-if="tile.unread > 0"
          class="tile-unread"
        >{{ tile.unread }} 未讀</span>
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

// Hue per notification type: the same pastel family as the icon tile on every notification card
const TONES: Record<string, string> = {
  new_message: 'red',
  'new_conversation': 'red',
  'agent_removed_from_team': 'red',
  customer_responded: 'green',
  conversation_assigned: 'blue',
  'customer_followed': 'blue',
  conversation_transferred: 'lavender',
  mention: 'orange',
  task_reminder: 'orange'
}

const TOP_ROW = 3

/**
 * Tile area follows how many notifications of that type are in the inbox. The three biggest sit in the top band,
 * the rest in a lower one; a floor keeps the smallest tile wide enough to read its own number.
 */
const bands = computed(() => {
  const sorted = [...props.rows].filter(r => r.total > 0).sort((a, b) => b.total - a.total)
  const sum = sorted.reduce((n, r) => n + r.total, 0)
  const floor = Math.max(1, Math.ceil(sum * 0.1))
  const tiles = sorted.map(r => ({ ...r, tone: TONES[r.value] ?? 'grey', grow: Math.max(r.total, floor) }))
  const top = tiles.slice(0, TOP_ROW)
  const rest = tiles.slice(TOP_ROW)
  const bandsOut = [top, rest].filter(t => t.length > 0)
  return bandsOut.map((t, i) => ({ tiles: t, weight: i === 0 && bandsOut.length > 1 ? 3 : 2 }))
})
</script>

<style scoped>
.mosaic {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 190px;
}

.band {
  display: flex;
  flex: 1 1 0;
  gap: 8px;
  min-height: 0;
}

.tile {
  position: relative;
  display: grid;
  flex-basis: 0;
  align-content: space-between;
  gap: 2px;
  min-width: 96px;
  min-height: 72px;
  padding: 12px 14px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: var(--tile-bg);
  color: var(--ui-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: opacity var(--ui-dur) var(--ui-ease), box-shadow var(--ui-dur) var(--ui-ease);
}

.tile:hover {
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--tile-ink) 45%, transparent);
}

.tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.tile.is-selected {
  box-shadow: inset 0 0 0 2px var(--tile-ink);
}

.tile.is-dim {
  opacity: 0.55;
}

.tile-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.tile-total {
  font: 700 28px / 1.1 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--tile-ink);
}

.tile-unread {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--tile-ink);
}

.tone-red {
  --tile-bg: var(--ui-red-soft);
  --tile-ink: var(--ui-red-ink);
}

.tone-green {
  --tile-bg: var(--ui-green-soft);
  --tile-ink: var(--ui-green-ink);
}

.tone-blue {
  --tile-bg: var(--ui-accent-soft);
  --tile-ink: var(--ui-accent);
}

.tone-lavender {
  --tile-bg: var(--ui-p-lavender);
  --tile-ink: var(--ui-p-lavender-ink);
}

.tone-orange {
  --tile-bg: var(--ui-orange-soft);
  --tile-ink: var(--ui-orange-ink);
}

.tone-grey {
  --tile-bg: var(--ui-fill);
  --tile-ink: var(--ui-ink-2);
}

/* Phone: the same buttons become one swipeable row of chips, the biggest types first */
@media (max-width: 768px) {
  .mosaic {
    display: flex;
    flex-direction: row;
    gap: 8px;
    min-height: 0;
    padding: 12px 16px 2px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent);
  }

  .mosaic::-webkit-scrollbar {
    display: none;
  }

  .mosaic::after {
    flex: 0 0 24px;
    content: '';
  }

  .band {
    display: contents;
  }

  .tile {
    display: inline-flex;
    flex: 0 0 auto !important;
    gap: 8px;
    align-items: center;
    min-width: 0;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .tile-name {
    font-size: 14px;
  }

  .tile-total {
    font-size: 15px;
    font-weight: 700;
    color: var(--ui-ink);
  }

  /* the count is in the button's label; on a chip it is a dot */
  .tile-unread {
    position: static;
    width: 8px;
    height: 8px;
    padding: 0;
    overflow: hidden;
    background: var(--tile-ink);
    font-size: 0;
  }
}
</style>
