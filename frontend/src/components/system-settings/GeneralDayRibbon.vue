<!--
  GeneralDayRibbon.vue
  The signature of the general settings page: today, as a 24 hour ribbon in the system's time zone.
  The marker is "now"; the pins are things that really happened or are scheduled (the last automatic
  backup, the last LINE test, the next backup) placed at their own instants. Picking another time zone
  re-reads the same instants on that zone's day, so the select is the control of the picture it drives.
  Every instant comes from data the settings page already loads; nothing is invented.
-->
<template>
  <section
    class="ui-lead rb"
    aria-label="今天的系統時間"
  >
    <div class="rb-head">
      <div class="rb-id">
        <p class="rb-status">
          <span
            class="rb-dot"
            :class="status.tone"
            aria-hidden="true"
          />
          <span class="rb-status-t">{{ status.text }}</span>
          <router-link
            class="ui-link rb-link"
            :to="status.to"
          >
            健康檢查
          </router-link>
        </p>
        <h2 class="rb-city">
          {{ zone.name }}時間
        </h2>
        <p class="rb-date">
          {{ dateText }} · {{ modelValue }}<span
            v-if="restText"
            class="rb-rest"
            :class="{ late: nowFrac >= 0.8 }"
          > · 今天還剩 {{ restText }}</span>
        </p>
      </div>
      <div class="rb-pick">
        <label
          class="rb-pick-l"
          for="timezone"
        >時區</label>
        <select
          id="timezone"
          :value="modelValue"
          class="ui-select"
          :form="formId"
          required
          @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="z in ZONES"
            :key="z.value"
            :value="z.value"
          >
            {{ z.label }}
          </option>
        </select>
      </div>
    </div>

    <div
      class="rb-body"
      role="img"
      :aria-label="ariaLabel"
    >
      <div class="rb-stage">
        <div
          class="rb-now"
          :style="{ left: pct(nowFrac) }"
        >
          <span class="rb-bubble">{{ nowText }}</span>
          <span
            class="rb-needle"
            aria-hidden="true"
          />
        </div>
        <ol
          class="rb-grid"
          aria-hidden="true"
        >
          <li
            v-for="h in HOURS"
            :key="h"
            :style="{ left: pct(h / 24) }"
          />
        </ol>
        <div class="rb-track">
          <span
            class="rb-elapsed"
            :style="{ width: pct(nowFrac) }"
          />
          <span
            v-if="restText && nowFrac < 0.8"
            class="rb-rest-in"
          >今天還剩 {{ restText }}</span>
        </div>
        <span
          v-for="pin in pins"
          :key="pin.key"
          class="rb-pin"
          :class="[pin.tone, { future: pin.future }]"
          :style="{ left: pct(pin.frac) }"
        >
          <!-- eslint-disable vue/no-v-html -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="pin.icon"
          />
          <!-- eslint-enable vue/no-v-html -->
        </span>
      </div>
      <ol
        class="rb-ticks"
        aria-hidden="true"
      >
        <li
          v-for="h in HOURS"
          :key="h"
          :class="{ minor: h % 6 !== 0 }"
          :style="{ left: pct(h / 24) }"
        >
          {{ String(h).padStart(2, '0') }}
        </li>
      </ol>
    </div>

    <ul
      v-if="legend.length > 0"
      class="rb-legend"
      aria-label="今天的事件"
    >
      <li
        v-for="item in legend"
        :key="item.key"
        :class="[item.tone, { future: item.future }]"
      >
        <span
          class="rb-chip"
          aria-hidden="true"
        >
          <!-- eslint-disable vue/no-v-html -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="item.icon"
          />
          <!-- eslint-enable vue/no-v-html -->
        </span>
        <span class="rb-leg-t">
          <span class="rb-leg-when">{{ item.when }}</span>
          <span class="rb-leg-what">{{ item.what }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export interface RibbonEvent {
  key: string
  /** The instant, as epoch ms */
  at: number
  what: string
  icon: string
  tone: 'green' | 'red' | 'accent'
  /** Scheduled, not happened yet: drawn hollow */
  future?: boolean
}

interface Status {
  tone: 'green' | 'orange' | 'red' | 'muted'
  text: string
  to: string
}

const props = defineProps<{
  modelValue: string
  formId: string
  status: Status
  events: RibbonEvent[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const ZONES = [
  { value: 'Asia/Taipei', label: 'Asia/Taipei (UTC+8)', name: '台北' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)', name: '東京' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)', name: '上海' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (UTC+8)', name: '香港' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)', name: '新加坡' },
  { value: 'UTC', label: 'UTC (UTC+0)', name: '世界標準' },
]
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
const DAY = 86_400_000

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
// the marker moves once a minute; it stops with the page
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60_000) })
onUnmounted(() => { if (timer) { clearInterval(timer) } })

const tz = computed(() => props.modelValue || 'Asia/Taipei')
const zone = computed(() => ZONES.find(z => z.value === tz.value) ?? { value: tz.value, label: tz.value, name: tz.value })

function safeFormat<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

/** Milliseconds since the zone's midnight for an instant */
function intoDay(ms: number): number {
  return safeFormat(() => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz.value, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ms))
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0)
    return ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000
  }, 0)
}

function clock(ms: number): string {
  return safeFormat(() => new Intl.DateTimeFormat('zh-TW', { timeZone: tz.value, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)), '--:--')
}

const dayStart = computed(() => now.value - intoDay(now.value))
const nowFrac = computed(() => Math.min(1, Math.max(0, intoDay(now.value) / DAY)))
const nowText = computed(() => clock(now.value))
/** Time left until the zone's next midnight, in words: the empty part of the track, said once */
const restText = computed(() => {
  const left = Math.max(0, DAY - intoDay(now.value))
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  if (h === 0 && m === 0) { return '' }
  return h > 0 ? `${h} 小時 ${m} 分` : `${m} 分`
})
const dateText = computed(() => safeFormat(() => new Intl.DateTimeFormat('zh-TW', { timeZone: tz.value, month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(now.value)), ''))

function pct(f: number): string {
  return `${(f * 100).toFixed(3)}%`
}

function dayWord(ms: number): string {
  const diff = Math.floor((ms - dayStart.value) / DAY)
  if (diff === 0) { return '今天' }
  if (diff === -1) { return '昨天' }
  if (diff === 1) { return '明天' }
  return safeFormat(() => new Intl.DateTimeFormat('zh-TW', { timeZone: tz.value, month: 'numeric', day: 'numeric' }).format(new Date(ms)), '')
}

const sorted = computed(() => [...props.events].sort((a, b) => a.at - b.at))

const pins = computed(() => sorted.value
  .map(e => ({ ...e, frac: (e.at - dayStart.value) / DAY, future: !!e.future }))
  .filter(e => e.frac >= 0 && e.frac <= 1))

const legend = computed(() => sorted.value.map(e => ({
  key: e.key,
  when: `${dayWord(e.at)} ${clock(e.at)}`,
  what: e.what,
  icon: e.icon,
  tone: e.tone,
  future: !!e.future,
})))

const ariaLabel = computed(() => {
  const marks = pins.value.map(p => `${clock(p.at)} ${p.what}`).join('，')
  return `${zone.value.name}時間現在 ${nowText.value}${marks ? `，今天：${marks}` : ''}`
})
</script>

<style scoped>
.rb {
  display: grid;
  gap: 18px;
  padding: 24px 32px 26px;
}

.rb-head {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
}

.rb-status {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  margin: 0 0 10px;
  padding: 6px 14px 6px 12px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.rb-status-t {
  min-width: 0;
}

.rb-link {
  flex: none;
  margin-left: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.rb-dot {
  flex: none;
  align-self: center;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ui-muted);
}

.rb-dot.green {
  background: var(--ui-green);
  box-shadow: 0 0 0 4px var(--ui-green-soft);
}

.rb-dot.orange {
  background: var(--ui-orange);
}

.rb-dot.red {
  background: var(--ui-red);
}

.rb-city {
  margin: 0;
  font: 700 30px / 1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
  color: var(--ui-ink);
}

.rb-date {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--ui-muted);
}

.rb-pick {
  display: grid;
  gap: 6px;
  width: 260px;
  flex: none;
}

.rb-pick-l {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

/* the picture: bubble zone, track, pins, hour labels */
.rb-body {
  padding: 0 14px;
}

.rb-stage {
  position: relative;
  height: 96px;
}

.rb-track {
  position: absolute;
  top: 48px;
  right: 0;
  left: 0;
  height: 26px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.rb-elapsed {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-blue) 42%, var(--ui-fill));
}

.rb-rest {
  display: none;
}

.rb-rest.late {
  display: inline;
}

/* the empty part of the track says what is left of the day, inside the picture */
.rb-rest-in {
  position: absolute;
  top: 50%;
  right: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
}

.rb-grid {
  position: absolute;
  inset: 44px 0 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rb-grid li {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.5px;
  background: var(--ui-sep);
}

.rb-now {
  position: absolute;
  top: 0;
  z-index: 3;
  display: grid;
  justify-items: center;
  transform: translateX(-50%);
}

.rb-bubble {
  padding: 5px 13px;
  border-radius: 999px;
  background: var(--ui-ink);
  font: 700 17px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-surface);
}

.rb-needle {
  position: relative;
  width: 2px;
  height: 8px;
  background: var(--ui-ink);
}

.rb-pin {
  position: absolute;
  top: 61px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--ui-surface);
  box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 3px currentcolor;
  transform: translate(-50%, -50%);
  color: var(--ui-green-ink);
}

.rb-pin.red {
  color: var(--ui-red-ink);
}

.rb-pin.accent {
  color: var(--ui-accent);
}

.rb-pin.future {
  box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 3px var(--ui-sep-strong, var(--ui-faint));
  color: var(--ui-muted);
}

.rb-pin svg {
  width: 16px;
  height: 16px;
}

.rb-ticks {
  position: relative;
  height: 22px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.rb-ticks li {
  position: absolute;
  top: 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
  transform: translateX(-50%);
}

/* events: the same marks, said in words, as one plain key under the ribbon */
.rb-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px 24px;
  margin: 0;
  padding: 14px 14px 0;
  list-style: none;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.rb-legend li {
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--ui-green-ink);
}

.rb-legend li.red {
  color: var(--ui-red-ink);
}

.rb-legend li.accent {
  color: var(--ui-accent);
}

.rb-legend li.future {
  color: var(--ui-muted);
}

.rb-chip {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ui-surface);
  box-shadow: inset 0 0 0 1.5px currentcolor;
}

.rb-legend li.future .rb-chip {
  box-shadow: inset 0 0 0 1.5px var(--ui-faint);
}

.rb-chip svg {
  width: 17px;
  height: 17px;
}

.rb-leg-t {
  display: grid;
  min-width: 0;
}

.rb-leg-when {
  font: 600 16px / 1.3 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.rb-leg-what {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-ink-2);
}

@media (max-width: 768px) {
  .rb {
    gap: 14px;
    padding: 18px 18px 18px;
  }

  .rb-head {
    flex-direction: column;
    gap: 14px;
  }

  .rb-city {
    font-size: 26px;
  }

  .rb-rest {
    display: inline;
  }

  .rb-rest-in {
    display: none;
  }

  .rb-pick {
    width: 100%;
  }

  .rb-body {
    padding: 0 10px;
  }

  .rb-ticks li.minor {
    display: none;
  }

  .rb-legend {
    flex-direction: column;
    gap: 10px;
    padding: 14px 4px 0;
  }
}
</style>
