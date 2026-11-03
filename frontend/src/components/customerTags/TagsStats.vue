<template>
  <article class="ui-lead lead">
    <div class="lead-main">
      <div class="lead-kicker">
        已標記對話
      </div>
      <div class="lead-num">
        {{ stats.totalConversations.toLocaleString('en-US') }}<small>個</small>
      </div>
      <div class="lead-meaning">
        同一對話可套用多個標籤
      </div>
      <dl class="lead-facts">
        <div>
          <dt>標籤數</dt>
          <dd>{{ stats.totalTags }}</dd>
        </div>
        <div>
          <dt>最常用</dt>
          <dd>{{ top[0]?.name ?? '-' }}</dd>
        </div>
      </dl>
    </div>

    <!-- Signature: the tag map. Every tag in use is a tile whose area is its share of tagged
         conversations, in the tag's own colour. A tile opens that tag's customers. -->
    <div class="lead-map">
      <div class="map-head">
        <h2>標籤地圖</h2>
        <span v-if="tiles.length > 0">面積代表對話數，前 {{ Math.min(5, tiles.length) }} 名佔 {{ coverage }}%</span>
      </div>
      <div
        v-if="tiles.length > 0"
        ref="boxEl"
        class="map"
        role="group"
        aria-label="標籤地圖，點選查看該標籤的對話"
      >
        <component
          :is="t.other ? 'div' : 'button'"
          v-for="t in tiles"
          :key="t.id"
          :type="t.other ? undefined : 'button'"
          class="tile"
          :class="{ 'is-active': activeTagId === t.id, 'is-tall': t.tall, 'is-other': t.other }"
          :style="t.style"
          :aria-label="`${t.name}，${t.count} 個對話`"
          :aria-pressed="t.other ? undefined : activeTagId === t.id"
          :title="t.title ?? `${t.name}：${t.count} 個對話（${t.share}%）`"
          @click="!t.other && emit('select', t.id)"
        >
          <span class="tile-name">{{ t.name }}</span>
          <b class="tile-n">{{ t.count }}</b>
        </component>
      </div>
      <p
        v-else
        class="map-empty"
      >
        還沒有標籤被套用到對話。在對話裡加上標籤後，這裡會依用量排出每個標籤的大小。
      </p>
      <p
        v-if="unused.length > 0"
        class="map-unused"
      >
        <span>尚未套用</span>
        <i
          v-for="u in unused"
          :key="u.id"
          class="ui-pill"
        >{{ u.name }}</i>
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Tag } from '@/types/tag'
import { squarify } from '@/utils/treemap'

const props = defineProps<{
  stats: {
    totalTags: number
    totalConversations: number
    activeTags: number
  }
  tags: Tag[]
  /** Tag open in the detail panel */
  activeTagId?: number | null
}>()

const emit = defineEmits<{ select: [id: number] }>()

// The map is laid out for the box it is drawn in, so tiles stay square on a phone too
const boxEl = ref<HTMLElement | null>(null)
const box = ref({ w: 640, h: 240 })
let observer: globalThis.ResizeObserver | null = null

// The box only exists once tags have loaded, so it is observed whenever it appears
onMounted(() => {
  if (typeof window.ResizeObserver === 'undefined') { return }
  observer = new window.ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect && rect.width > 0 && rect.height > 0) {
      box.value = { w: rect.width, h: rect.height }
    }
  })
  watch(boxEl, (el, previous) => {
    if (previous) { observer?.unobserve(previous) }
    if (el) { observer?.observe(el) }
  }, { immediate: true, flush: 'post' })
})
onBeforeUnmount(() => observer?.disconnect())

const used = computed(() =>
  [...props.tags]
    .filter((t) => (t.conversationCount || 0) > 0)
    .sort((a, b) => (b.conversationCount || 0) - (a.conversationCount || 0)),
)

const total = computed(() => used.value.reduce((n, t) => n + (t.conversationCount || 0), 0))
const top = used

const unused = computed(() => props.tags.filter((t) => !(t.conversationCount || 0)))

const coverage = computed(() => {
  if (total.value <= 0) { return 0 }
  const five = used.value.slice(0, 5).reduce((n, t) => n + (t.conversationCount || 0), 0)
  return Math.round((five / total.value) * 100)
})

/** A tile smaller than this cannot carry its name and count legibly */
const MIN_W = 84
const MIN_H = 48
const OTHER_ID = -1

/** Lay the tags out; tags whose tile would be too small to read are folded into one 「其他」 tile (re-laid out until every tile fits) */
const layout = computed(() => {
  const byId = new Map(used.value.map((t) => [t.id, t]))
  // smallest first: the tags folded away are always the least used
  const ascending = [...used.value].sort((a, b) => (a.conversationCount || 0) - (b.conversationCount || 0))
  const build = (foldedCount: number) => {
    const keep = ascending.slice(foldedCount)
    const gone = ascending.slice(0, foldedCount)
    const items = keep.map((t) => ({ id: t.id, value: t.conversationCount || 0 }))
    if (gone.length > 0) { items.push({ id: OTHER_ID, value: gone.reduce((n, t) => n + (t.conversationCount || 0), 0) }) }
    return { rects: squarify(items, box.value.w, box.value.h), folded: gone.map((t) => t.id) }
  }
  let n = 0
  let result = build(n)
  // fold one more tag while any tile (the 「其他」 tile included) is too small to read, keeping at least two real tiles
  while (n < ascending.length - 2 && result.rects.some((r) => r.w < MIN_W || r.h < MIN_H)) {
    n += 1
    result = build(n)
  }
  return { ...result, byId }
})

const tiles = computed(() => {
  const { rects, folded, byId } = layout.value
  return rects.flatMap((r) => {
    const other = r.id === OTHER_ID
    const tag = other ? null : byId.get(r.id as number)
    if (!other && !tag) { return [] }
    const names = folded.map((id) => byId.get(id)?.name).filter(Boolean).join('、')
    const count = other ? folded.reduce((n, id) => n + (byId.get(id)?.conversationCount || 0), 0) : (tag?.conversationCount || 0)
    return [{
      id: other ? OTHER_ID : (tag as Tag).id,
      other,
      name: other ? `其他 ${folded.length} 個標籤` : (tag as Tag).name,
      count,
      share: total.value > 0 ? Math.round((count / total.value) * 100) : 0,
      title: other ? `${names}：共 ${count} 個對話` : undefined,
      tall: r.h >= 74,
      style: {
        left: `${(r.x / box.value.w) * 100}%`,
        top: `${(r.y / box.value.h) * 100}%`,
        width: `${(r.w / box.value.w) * 100}%`,
        height: `${(r.h / box.value.h) * 100}%`,
        '--tag-c': other ? 'var(--ui-muted)' : (tag as Tag).color,
      },
    }]
  })
})
</script>

<style scoped>
.lead {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 20px 44px;
  align-items: stretch;
  padding: 26px 36px;
}

.lead-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.lead-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.lead-num {
  margin-top: 4px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.lead-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.lead-meaning {
  margin-top: 6px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.lead-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 32px;
  margin: auto 0 0;
  padding-top: 22px;
}

.lead-facts dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.lead-facts dd {
  margin: 2px 0 0;
  font: 600 18px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.lead-map {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-left: 44px;
}

.lead-map::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.map-head {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.map-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.map-head span {
  font-size: 13px;
  color: var(--ui-muted);
}

.map {
  position: relative;
  flex: 1;
  min-height: 196px;
}

.tile {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: color-mix(in srgb, var(--tag-c) 62%, #000);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

/* the tile body is inset so neighbours are separated by the page surface, not by outlines */
.tile::before {
  position: absolute;
  inset: 2px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--tag-c) 20%, var(--ui-surface));
  content: '';
  transition: background var(--ui-dur) var(--ui-ease);
}

.tile:hover::before {
  background: color-mix(in srgb, var(--tag-c) 30%, var(--ui-surface));
}

.tile.is-active::before {
  background: color-mix(in srgb, var(--tag-c) 34%, var(--ui-surface));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--tag-c) 70%, #000);
}

.tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -1px;
}

.tile > * {
  position: relative;
}

.is-tall .tile-n {
  font-size: 24px;
}

.tile-name {
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}

.tile:not(.is-tall) {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tile.is-other {
  cursor: default;
  color: var(--ui-ink-2);
}

.tile.is-other::before {
  background: var(--ui-fill);
}

.tile-n {
  font: 600 18px / 1 var(--ui-font-display);
  letter-spacing: -0.02em;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.map-empty {
  margin: 0;
  padding: 24px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

.map-unused {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.map-unused i {
  font-style: normal;
}

@media (max-width: 1024px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-map {
    padding-left: 0;
  }

  .lead-map::before {
    display: none;
  }

  .lead-facts {
    margin: 0;
    padding-top: 14px;
  }
}

@media (max-width: 768px) {
  .lead-num {
    font-size: 48px;
  }

  .map {
    min-height: 280px;
  }

  .tile {
    padding: 6px 8px;
  }
}
</style>
