<template>
  <aside
    class="rail ui-lead"
    :class="{ 'is-open': open }"
    aria-label="通知概況"
  >
    <!-- What needs you: the unread count, the urgent share, and where the rest of the inbox sits in time -->
    <div class="rail-fig">
      <h2 class="rail-label">
        未讀通知
      </h2>
      <p class="rail-num">
        <span
          class="ui-num"
          :class="{ 'is-clear': unread === 0 }"
        >{{ unread }}</span><small v-if="unread > 0">則</small><small
          v-else
          class="rail-clear"
        >全部已讀</small>
      </p>
      <p
        v-if="urgentUnread > 0"
        class="rail-hot"
      >
        含 {{ urgentUnread }} 則緊急
      </p>
      <dl class="rail-time">
        <div
          v-for="t in times"
          :key="t.label"
        >
          <dt>{{ t.label }}</dt>
          <dd>{{ t.value }}</dd>
        </div>
      </dl>
    </div>

    <!-- Phone: the filters fold into one row that says what is applied -->
    <button
      type="button"
      class="rail-toggle"
      :aria-expanded="open"
      aria-controls="rail-body"
      @click="open = !open"
    >
      <span class="rail-toggle-text">
        <strong>依類型與優先級篩選</strong>
        <span>{{ appliedText }}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <div
      class="mix"
      aria-hidden="true"
    >
      <i
        v-for="row in typeList"
        :key="row.value"
        :class="[`hue-${row.hue}`, { 'is-dim': selectedType !== '' && selectedType !== row.value }]"
        :style="{ flex: `${row.total} 1 0` }"
      />
    </div>

    <div
      id="rail-body"
      class="rail-body"
    >
      <section
        class="group"
        aria-label="依類型篩選通知"
      >
        <p class="group-head">
          <span>依類型</span><span>{{ typeTotal }} 則</span>
        </p>
        <button
          v-for="row in typeList"
          :key="row.value"
          type="button"
          class="row"
          :class="{ 'is-selected': selectedType === row.value, 'is-dim': selectedType !== '' && selectedType !== row.value }"
          :aria-pressed="selectedType === row.value"
          :aria-label="`${row.label} ${row.total} 則${row.unread > 0 ? `，${row.unread} 則未讀` : ''}`"
          @click="pick('type', row.value)"
        >
          <i
            class="sw"
            :class="`hue-${row.hue}`"
            aria-hidden="true"
          />
          <span class="name">{{ row.label }}</span>
          <span
            class="track"
            aria-hidden="true"
          ><i
            :class="`hue-${row.hue}`"
            :style="{ width: `${Math.max(4, (row.total / typeMax) * 100)}%` }"
          ><b :style="{ width: `${(row.unread / row.total) * 100}%` }" /></i></span>
          <span class="count">{{ row.total }}</span>
          <span
            class="unread"
            :class="{ 'is-none': row.unread === 0 }"
          >{{ row.unread > 0 ? `${row.unread} 未讀` : '' }}</span>
        </button>
      </section>

      <section
        class="group"
        aria-label="依優先級篩選通知"
      >
        <p class="group-head">
          <span>依優先級</span>
        </p>
        <button
          v-for="row in priorityList"
          :key="row.value"
          type="button"
          class="row row-pri"
          :class="{ 'is-selected': selectedPriority === row.value, 'is-dim': selectedPriority !== '' && selectedPriority !== row.value }"
          :aria-pressed="selectedPriority === row.value"
          :aria-label="`${row.label}優先級 ${row.total} 則${row.unread > 0 ? `，${row.unread} 則未讀` : ''}`"
          @click="pick('priority', row.value)"
        >
          <i
            class="sw"
            :class="`pri-${row.value}`"
            aria-hidden="true"
          />
          <span class="name">{{ row.label }}</span>
          <span
            class="track"
            aria-hidden="true"
          ><i
            :class="`pri-${row.value}`"
            :style="{ width: `${Math.max(4, (row.total / priorityMax) * 100)}%` }"
          ><b :style="{ width: `${(row.unread / row.total) * 100}%` }" /></i></span>
          <span class="count">{{ row.total }}</span>
          <span
            class="unread"
            :class="{ 'is-none': row.unread === 0 }"
          >{{ row.unread > 0 ? `${row.unread} 未讀` : '' }}</span>
        </button>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export interface RailRow {
  value: string
  label: string
  total: number
  unread: number
}

const props = defineProps<{
  unread: number
  urgentUnread: number
  times: ReadonlyArray<{ label: string; value: number }>
  types: readonly RailRow[]
  priorities: readonly RailRow[]
  /** The type / priority currently filtered on ('' = none) */
  selectedType: string
  selectedPriority: string
}>()

const emit = defineEmits<{
  'toggle-type': [value: string]
  'toggle-priority': [value: string]
}>()

const open = ref(false)

/** A pick on the phone folds the panel away so the filtered list is what you see */
function pick(kind: 'type' | 'priority', value: string): void {
  if (kind === 'type') { emit('toggle-type', value) } else { emit('toggle-priority', value) }
  open.value = false
}

/** Four soft families, so seven types stay readable: conversation, routing, attention, system */
const HUE: Record<string, 'blue' | 'indigo' | 'orange' | 'grey'> = {
  new_message: 'blue',
  customer_responded: 'blue',
  conversation_assigned: 'indigo',
  conversation_transferred: 'indigo',
  mention: 'orange',
  task_reminder: 'orange'
}

/** Biggest type first, one shared scale: the bar of each row is its count over the biggest count */
const typeList = computed(() =>
  [...props.types]
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map(r => ({ ...r, hue: HUE[r.value] ?? 'grey' }))
)
const typeTotal = computed(() => typeList.value.reduce((sum, r) => sum + r.total, 0))
const typeMax = computed(() => Math.max(1, ...typeList.value.map(r => r.total)))

const priorityList = computed(() => props.priorities.filter(r => r.total > 0))
const priorityMax = computed(() => Math.max(1, ...priorityList.value.map(r => r.total)))

const appliedText = computed(() => {
  const parts: string[] = []
  const t = props.types.find(r => r.value === props.selectedType)
  const p = props.priorities.find(r => r.value === props.selectedPriority)
  if (t) { parts.push(t.label) }
  if (p) { parts.push(`${p.label}優先級`) }
  return parts.length > 0 ? parts.join(' · ') : `全部 ${typeTotal.value} 則`
})
</script>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 24px;
}

.rail-fig {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rail-label {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rail-num {
  margin: 0;
  font: 600 64px / 1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.rail-num small {
  margin-left: 4px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-ink-2);
}

.rail-num .rail-clear {
  margin-left: 10px;
  color: var(--ui-green-ink);
  font-weight: 700;
}

.rail-hot {
  margin: 0;
  font: 600 14px var(--ui-font-display);
  color: var(--ui-red-ink);
}

.rail-time {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 10px 0 0;
  padding-top: 14px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.rail-time > div {
  display: grid;
  gap: 2px;
}

.rail-time dt {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.rail-time dd {
  margin: 0;
  font: 700 20px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.rail-toggle,
.mix {
  display: none;
}

.rail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-head {
  display: flex;
  justify-content: space-between;
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.row {
  display: grid;
  grid-template-columns: 10px 4.2em minmax(0, 1fr) 2.4ch 58px;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  margin: 0 -10px;
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

.row:hover {
  background: var(--ui-fill);
}

.row:focus-visible,
.rail-toggle:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.row.is-selected {
  background: var(--ui-accent-soft);
}

.row.is-dim {
  opacity: 0.6;
}

.sw {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}

/* the solid stretch at the start of a bar is the unread share of that row */
.track b {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ui-accent);
}

.count {
  font: 700 15px / 1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--ui-ink-2);
}

.unread {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-self: end;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
  white-space: nowrap;
}

.unread:not(.is-none)::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-accent);
}

.unread.is-none {
  visibility: hidden;
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

.pri-urgent {
  background: var(--ui-red);
}

.pri-high {
  background: var(--ui-orange);
}

.pri-normal {
  background: var(--ui-blue);
}

.pri-low {
  background: color-mix(in srgb, var(--ui-ink) 28%, var(--ui-surface));
}

/* Phone: no hero. One row says what is applied, the bar shows the mix, and the filters unfold on tap */
@media (max-width: 768px) {
  .rail {
    gap: 0;
    padding: 0;
    border-radius: var(--ui-r-card);
    box-shadow: none;
    background: var(--ui-surface);
    overflow: hidden;
  }

  .rail-fig {
    display: none;
  }

  .rail-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 8px 16px;
    border: 0;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .rail-toggle-text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .rail-toggle-text strong {
    font-size: 15px;
    font-weight: 600;
  }

  .rail-toggle-text span {
    font-size: 13px;
    color: var(--ui-ink-2);
  }

  .rail-toggle svg {
    flex: none;
    width: 20px;
    height: 20px;
    color: var(--ui-ink-2);
    transition: transform var(--ui-dur) var(--ui-ease);
  }

  .is-open .rail-toggle svg {
    transform: rotate(180deg);
  }

  .mix {
    display: flex;
    gap: 3px;
    height: 8px;
    margin: 0 16px 14px;
  }

  .mix i {
    min-width: 6px;
    border-radius: 999px;
    transition: opacity var(--ui-dur) var(--ui-ease);
  }

  .mix i.is-dim {
    opacity: 0.35;
  }

  .rail-body {
    display: none;
    padding: 12px 16px 16px;
  }

  .is-open .rail-body {
    display: flex;
  }

  .row {
    min-height: 44px;
  }
}

@media (pointer: coarse) {
  .row {
    min-height: 44px;
  }
}
</style>
