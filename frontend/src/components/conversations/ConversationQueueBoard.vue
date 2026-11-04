<template>
  <section
    class="queue ui-lead"
    :class="{ 'is-calm': total === 0 }"
    aria-labelledby="queue-title"
  >
    <header class="queue-head">
      <div class="queue-lead">
        <h2
          id="queue-title"
          class="queue-label"
          :title="WAITING_HINT"
        >
          待回覆
        </h2>
        <p class="queue-num">
          <span class="ui-num">{{ total }}</span><small>件</small>
        </p>
        <p
          v-if="oldest"
          class="queue-meta"
        >
          最久等 <strong :class="{ 'is-hot': oldest.hot }">{{ oldest.text }}</strong><template v-if="oldest.name">
            ・ {{ oldest.name }}
          </template>
        </p>
        <p
          v-else
          class="queue-meta"
        >
          客戶來訊後都有人回覆了
        </p>
      </div>
      <div class="queue-actions">
        <button
          v-if="oldest"
          type="button"
          class="btn btn-primary btn-sm"
          @click="emit('open', oldest.id)"
        >
          先處理最久的
        </button>
        <button
          v-if="staleCount > 0 && !staleOpen"
          type="button"
          class="btn btn-secondary btn-sm"
          @click="emit('stale')"
        >
          逾期 {{ staleCount }} 件
        </button>
        <span
          v-if="unread > 0"
          class="queue-unread"
          :title="UNREAD_HINT"
        >我的未讀 <b>{{ unread }}</b></span>
      </div>
    </header>

    <div
      v-if="lanes.length > 0"
      class="board"
      role="group"
      aria-label="待回覆的客戶，依等待時間排列"
    >
      <div class="lanes">
        <div
          v-for="lane in lanes"
          :key="lane.key"
          class="lane"
        >
          <button
            type="button"
            class="lane-name"
            :class="{ 'is-selected': selectedTeam === lane.filterId }"
            :aria-pressed="selectedTeam === lane.filterId"
            :title="`只看${lane.name}的對話`"
            @click="emit('team', lane.filterId)"
          >
            <span class="lane-title">{{ lane.name }}</span>
            <span class="lane-open">處理中 {{ lane.open }}</span>
          </button>
          <div
            class="lane-track"
            :style="{ height: `${lane.height}px` }"
          >
            <button
              v-for="dot in lane.dots"
              :key="dot.id"
              type="button"
              class="dot"
              :class="[`ui-av-${dot.tone}`, { 'is-hot': dot.hot }]"
              :style="{ left: `${dot.x}px`, top: `${dot.y}px` }"
              :title="dot.title"
              :aria-label="dot.label"
              @click="emit('open', dot.id)"
            >
              {{ dot.initial }}
              <span
                v-if="dot.channel"
                class="ui-ch dot-ch"
                :class="dot.channel === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
                aria-hidden="true"
              ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
            </button>
          </div>
        </div>
        <!-- One shared time axis: hairlines run through every lane and the zone past 30 minutes is tinted -->
        <div
          class="overlay"
          aria-hidden="true"
        >
          <i
            class="hot-zone"
            :style="{ left: `${hotLeft - 8}px` }"
          />
          <i
            v-for="tick in ticks"
            :key="tick.label"
            class="hair"
            :style="{ left: `${tick.x}px` }"
          />
        </div>
      </div>
      <div class="axis">
        <div
          ref="axisEl"
          class="axis-track"
          aria-hidden="true"
        >
          <span
            v-for="tick in ticks"
            :key="tick.label"
            class="tick"
            :class="{ 'is-hot': tick.hot }"
            :style="{ left: `${tick.x}px` }"
          >{{ tick.label }}</span>
        </div>
      </div>
      <p
        v-if="total > items.length"
        class="board-note"
      >
        圖中是等最久的 {{ items.length }} 件，其餘 {{ total - items.length }} 件在下方列表
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { WaitingConversation } from '@shared/api-contracts'
import { formatWaitText } from '@/composables/dashboard/useDashboardOverview'
import { UNREAD_HINT, WAITING_HINT, avatarToneOf, initialOf, platformName } from '@/composables/conversation/useConversationRowMeta'

const props = defineProps<{
  items: readonly WaitingConversation[]
  /** Waiting conversations in all (the items are only the longest-waiting page of them) */
  total: number
  staleCount: number
  staleOpen: boolean
  unread: number
  /** Epoch ms the waits are measured against */
  now: number
  /** Team id (0 = unassigned) -> name / open count; ids not present fall back to a generic name */
  teamNames: ReadonlyMap<number, string>
  teamOpen: ReadonlyMap<number, number>
  selectedTeam?: number
}>()

const emit = defineEmits<{
  open: [id: string]
  team: [filterId: number]
  stale: []
}>()

// The ruler is bent on purpose: equal steps between 5 / 15 / 30 min / 1 h / 2 h so the fresh waits (the
// ones an agent can still save) get room, and anything past two hours piles up at the end.
const STEPS: readonly number[] = [0, 300, 900, 1800, 3600, 7200]
const LAST = STEPS.length - 1
const HOT_SECONDS = 1800
const at = (i: number): number => STEPS[i] ?? 0
const TICK_LABELS = ['現在', '5 分', '15 分', '30 分', '1 小時', '2 小時+']
const HOT_STEP = 3

const DOT = 34
const PAD = 22 // keeps the first and last dot inside the track
const ROW = 38

const trackW = ref(640)
const axisEl = ref<HTMLElement | null>(null)
let observer: globalThis.ResizeObserver | null = null
const measure = () => { if (axisEl.value) { trackW.value = Math.max(240, axisEl.value.clientWidth) } }
// The axis lives under v-if="lanes.length > 0", so it can appear, disappear and reappear after mount
watch(axisEl, (el, old) => {
  if (old) { observer?.unobserve(old) }
  if (!el) { return }
  measure()
  if (typeof window.ResizeObserver !== 'undefined') {
    observer ??= new window.ResizeObserver(measure)
    observer.observe(el)
  }
}, { flush: 'post', immediate: true })
onBeforeUnmount(() => observer?.disconnect())

const xOfStep = (step: number): number => PAD + (step / LAST) * (trackW.value - 2 * PAD)

/** seconds -> 0..5 (fractional step on the bent ruler) */
const stepOf = (seconds: number): number => {
  const s = Math.max(0, seconds)
  if (s >= at(LAST)) { return LAST }
  for (let i = 1; i < STEPS.length; i++) {
    if (s <= at(i)) { return i - 1 + (s - at(i - 1)) / (at(i) - at(i - 1)) }
  }
  return LAST
}

const ticks = computed(() => TICK_LABELS.map((label, i) => ({ label, x: xOfStep(i), hot: i >= HOT_STEP })))
const hotLeft = computed(() => xOfStep(HOT_STEP))

const waitedSeconds = (item: WaitingConversation): number => Math.max(0, (props.now - Date.parse(item.waitingSince)) / 1000)

const oldest = computed(() => {
  const top = [...props.items].sort((a, b) => waitedSeconds(b) - waitedSeconds(a))[0]
  if (!top) { return null }
  const secs = waitedSeconds(top)
  return { id: top.conversationId, name: top.customerName ?? '', text: formatWaitText(secs), hot: secs >= HOT_SECONDS }
})

const laneName = (id: number): string => (id === 0 ? '未指派' : (props.teamNames.get(id) ?? `團隊 ${id}`))

const lanes = computed(() => {
  const byLane = new Map<number, WaitingConversation[]>()
  for (const item of props.items) {
    const key = item.assignedTeamId ?? 0
    byLane.set(key, [...(byLane.get(key) ?? []), item])
  }
  const built = [...byLane.entries()].map(([filterId, list]) => {
    const placed: { x: number; row: number }[] = []
    const dots = [...list]
      .sort((a, b) => waitedSeconds(a) - waitedSeconds(b))
      .map((item) => {
        const secs = waitedSeconds(item)
        const x = xOfStep(stepOf(secs)) - DOT / 2
        // Beeswarm: a dot that would sit on a neighbour drops to the next free row
        let row = 0
        while (placed.some(p => p.row === row && Math.abs(p.x - x) < DOT + 2)) { row++ }
        placed.push({ x, row })
        const name = item.customerName ?? '客戶'
        const ch = item.platform === 'line' || item.platform === 'facebook' ? item.platform : null
        const waited = formatWaitText(secs)
        return {
          id: item.conversationId,
          x,
          y: 2 + row * ROW,
          row,
          tone: avatarToneOf(name),
          initial: initialOf(name),
          channel: ch,
          hot: secs >= HOT_SECONDS,
          secs,
          title: `${name}・已等 ${waited}`,
          label: `${name}，${platformName(item.platform ?? undefined) || '客戶'}，已等 ${waited}，開啟對話`
        }
      })
    const rows = Math.max(...dots.map(d => d.row)) + 1
    return {
      key: String(filterId),
      filterId,
      name: laneName(filterId),
      open: props.teamOpen.get(filterId) ?? 0,
      dots,
      height: rows * ROW,
      longest: Math.max(...dots.map(d => d.secs))
    }
  })
  return built.sort((a, b) => b.longest - a.longest)
})
</script>

<style scoped>
.queue {
  display: grid;
  gap: 18px;
  padding: 24px 28px 22px;
}

.queue.is-calm {
  gap: 0;
  padding-block: 18px;
}

.queue.is-calm .queue-num {
  font-size: 30px;
}

.queue-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px 24px;
}

.queue-lead {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.queue-label {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.queue-num {
  margin: 0;
  font: 600 40px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.queue-num small {
  margin-left: 4px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.queue-meta {
  margin: 0;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.queue-meta strong {
  font-weight: 600;
}

.queue-meta strong.is-hot {
  color: var(--ui-red-ink);
}

.queue-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.queue-unread {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.queue-unread b {
  font-weight: 700;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

/* ---- the board ---- */
.board {
  display: grid;
  gap: 0;
}

.lane {
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}

.lane-name,
.axis::before {
  min-width: 0;
}

.lane-name {
  display: grid;
  gap: 1px;
  justify-items: start;
  min-height: 44px;
  padding: 4px 10px;
  margin-left: -10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.lane-name:hover {
  background: var(--ui-fill);
}

.lane-name:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.lane-name.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

.lane-title {
  max-width: 100%;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane-open {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.lane-track {
  position: relative;
  min-width: 0;
}

.dot {
  position: absolute;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  font: 600 14px var(--ui-font-display);
  cursor: pointer;
  transition: transform var(--ui-dur) var(--ui-ease);
}

.dot:hover {
  z-index: 2;
  transform: scale(1.12);
}

.dot:focus-visible {
  z-index: 2;
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

/* Past 30 minutes: a red ring (the same threshold the list pills turn red at) */
.dot.is-hot {
  box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 4px var(--ui-red-ink);
}

.dot-ch {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 15px;
  height: 15px;
  border-radius: 5px;
  box-shadow: 0 0 0 2px var(--ui-surface);
}

.dot-ch svg {
  width: 9px;
  height: 9px;
}

/* ---- shared axis: sits under the lanes, its ticks stretch up through them ---- */
.axis {
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  gap: 16px;
}

.axis::before {
  content: '';
}

.axis-track {
  position: relative;
  height: 26px;
  border-top: 0.5px solid var(--ui-sep);
}

.tick {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
  white-space: nowrap;
}

.tick:first-of-type {
  transform: translateX(-30%);
}

.tick:last-of-type {
  transform: translateX(-80%);
}

.tick.is-hot {
  color: var(--ui-red-ink);
}

.lanes {
  position: relative;
  display: grid;
  gap: 0;
}

.lanes > .lane {
  position: relative;
  z-index: 1;
  padding: 6px 0;
}

.lanes > .lane + .lane {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 140px;
  z-index: 0;
  pointer-events: none;
}

.hair {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.5px;
  background: var(--ui-sep);
}

.hot-zone {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 14px;
  background: color-mix(in srgb, var(--ui-red-ink) 5%, transparent);
}

.board-note {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .queue {
    gap: 14px;
    padding: 18px 16px 14px;
  }

  .queue-head {
    align-items: flex-start;
  }

  .queue-num {
    font-size: 34px;
  }

  .lane,
  .axis {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .axis::before {
    display: none;
  }

  .overlay {
    left: 0;
  }

  .lane-name {
    display: flex;
    gap: 8px;
    align-items: baseline;
    min-height: 32px;
    padding: 4px 8px;
    margin-left: -8px;
  }

  .tick:nth-of-type(2),
  .tick:nth-of-type(5) {
    display: none;
  }
}
</style>
