<template>
  <article class="ui-lead hero">
    <div class="hero-main">
      <div class="hero-kicker">
        {{ kicker }}
      </div>
      <div
        class="hero-value"
        :class="tone ? `is-${tone}` : ''"
        :aria-busy="busy || undefined"
      >
        <span
          v-if="busy"
          class="hero-skel"
          aria-hidden="true"
        />
        <template v-else>
          {{ value }}
        </template>
      </div>
      <p
        v-if="meaning"
        class="hero-meaning"
      >
        {{ meaning }}
      </p>
      <slot />
      <dl
        v-if="totals.files > 0"
        class="hero-facts"
      >
        <div>
          <dt>備份總量</dt>
          <dd>{{ totals.size }}</dd>
        </div>
        <div>
          <dt>檔案</dt>
          <dd>{{ totals.files.toLocaleString('en-US') }} 份</dd>
        </div>
        <div>
          <dt>最早</dt>
          <dd>{{ totals.since }}</dd>
        </div>
      </dl>
      <div
        v-if="$slots.actions"
        class="hero-actions"
      >
        <slot name="actions" />
      </div>
    </div>

    <!-- Signature: how long each kind of backup is kept. Every file is a tick placed by its age
         (today on the right), inside the shaded window the retention policy keeps it for. -->
    <div
      v-if="lanes.length > 0"
      class="hero-lanes"
    >
      <div class="lanes-head">
        <h2>保留期間</h2>
        <span>每個刻度是一份備份，底色是保留視窗</span>
      </div>
      <div
        class="lanes"
        role="img"
        :aria-label="aria"
      >
        <div
          v-for="lane in lanes"
          :key="lane.key"
          class="lane"
          :style="{ '--lane': lane.color }"
        >
          <div class="lane-name">
            <b>{{ lane.label }}</b>
            <small>{{ lane.keep ? `保留 ${lane.keep} 天` : '' }}</small>
          </div>
          <div class="lane-track">
            <span
              v-if="lane.keep"
              class="lane-window"
              :style="{ left: lane.windowLeft + '%' }"
            />
            <i
              v-for="(x, i) in lane.ticks"
              :key="i"
              class="lane-tick"
              :style="{ left: x + '%' }"
            />
          </div>
          <div class="lane-n">
            {{ lane.count }} 份
            <small>{{ lane.size }}</small>
          </div>
        </div>
        <div
          class="axis"
          aria-hidden="true"
        >
          <span
            v-for="t in axis"
            :key="t.label"
            :style="{ left: t.x + '%' }"
          >{{ t.label }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BackupItem, BackupPolicy } from '@/api/backup'

const props = defineProps<{
  kicker: string
  value: string
  meaning?: string
  tone?: 'warn' | ''
  busy?: boolean
  items: BackupItem[]
  policy: BackupPolicy | null
}>()

const DAY = 24 * 3600 * 1000
const TAIPEI = 'Asia/Taipei'

const LANES: Array<{ key: string; label: string; tiers: string[]; color: string }> = [
  { key: 'daily', label: '每日', tiers: ['daily'], color: 'var(--ui-green)' },
  { key: 'manual', label: '手動', tiers: ['manual'], color: 'var(--ui-accent)' },
  { key: 'monthly', label: '每月', tiers: ['monthly'], color: 'var(--ui-orange)' },
  { key: 'exports', label: '資料匯出', tiers: ['members', 'tags', 'assignments'], color: 'var(--ui-indigo)' },
]

function formatBytes(n: number): string {
  if (!n) { return '0 B' }
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const retention = (tiers: string[]): number => {
  const days = props.policy?.retentionDays as Record<string, number> | undefined
  return Math.max(0, ...tiers.map(t => days?.[t] ?? 0))
}

const ageDays = (iso: string) => Math.max(0, (Date.now() - new Date(iso).getTime()) / DAY)

/** The axis reaches as far back as the longest kept lane, or the oldest file, whichever is longer */
const span = computed(() => {
  const oldest = Math.max(0, ...props.items.map(i => ageDays(i.uploaded)))
  const keep = Math.max(0, ...LANES.map(l => (props.items.some(i => l.tiers.includes(i.tier)) ? retention(l.tiers) : 0)))
  const need = Math.max(oldest, keep, 30)
  return need <= 35 ? 30 : need <= 100 ? 90 : 365
})

/** Square-root scale: the recent days, where daily files crowd, keep room; a year still fits */
const at = (days: number) => (1 - Math.sqrt(Math.min(days, span.value) / span.value)) * 100

const lanes = computed(() => {
  if (props.items.length === 0) { return [] }
  return LANES
    .map((lane) => {
      const mine = props.items.filter(i => lane.tiers.includes(i.tier))
      const keep = retention(lane.tiers)
      return {
        key: lane.key,
        label: lane.label,
        color: lane.color,
        keep,
        count: mine.length,
        size: formatBytes(mine.reduce((n, i) => n + i.size, 0)),
        windowLeft: keep ? at(keep) : 0,
        ticks: mine.map(i => at(ageDays(i.uploaded))),
      }
    })
    .filter(l => l.count > 0)
})

const axis = computed(() => {
  // oldest first, so the labels read left to right and today closes the row
  const marks = span.value === 30 ? [30, 14, 7, 0] : span.value === 90 ? [90, 30, 7, 0] : [365, 90, 30, 7, 0]
  const names: Record<number, string> = { 0: '今天', 7: '7 天', 14: '14 天', 30: '30 天', 90: '90 天', 365: '1 年' }
  return marks.map(d => ({ label: names[d] ?? `${d} 天`, x: at(d) }))
})

const totals = computed(() => {
  const items = props.items
  if (items.length === 0) { return { files: 0, size: '', since: '' } }
  const oldest = Math.min(...items.map(i => new Date(i.uploaded).getTime()))
  const since = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: 'numeric', day: 'numeric' }).format(new Date(oldest))
  return { files: items.length, size: formatBytes(items.reduce((n, i) => n + i.size, 0)), since }
})

const aria = computed(() =>
  `各類備份的保留期間：${lanes.value.map(l => `${l.label} ${l.count} 份${l.keep ? `，保留 ${l.keep} 天` : ''}`).join('；')}`,
)
</script>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 20px 44px;
  align-items: stretch;
  padding: 28px 36px;
}

.hero-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.hero-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.hero-value {
  margin-top: 4px;
  font: 600 40px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.hero-value.is-warn {
  color: var(--ui-orange-ink);
}

.hero-skel {
  display: inline-block;
  width: 200px;
  height: 40px;
  border-radius: 10px;
  background: var(--ui-fill);
}

.hero-meaning {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ui-ink-2);
}

.hero-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  width: 100%;
  margin: 18px 0 0;
  padding-top: 16px;
  border-top: 0.5px solid var(--ui-sep);
}

.hero-facts dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.hero-facts dd {
  margin: 2px 0 0;
  font: 600 18px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.hero-actions {
  margin-top: auto;
  padding-top: 18px;
}

.hero-lanes {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-left: 44px;
}

.hero-lanes::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.lanes-head {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  align-items: baseline;
  justify-content: space-between;
}

.lanes-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.lanes-head span {
  font-size: 13px;
  color: var(--ui-muted);
}

.lanes {
  --name: 96px;
  --count: 112px;
  display: grid;
  flex: 1;
  align-content: center;
  gap: 10px;
  margin-top: 14px;
}

.lane {
  display: grid;
  grid-template-columns: var(--name) minmax(0, 1fr) var(--count);
  gap: 14px;
  align-items: center;
  min-height: 52px;
}

.lane-name b {
  display: block;
  font-size: 15px;
  font-weight: 600;
}

.lane-name small,
.lane-n small {
  display: block;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.lane-n {
  font-size: 15px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.lane-track {
  position: relative;
  height: 36px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--ui-fill);
}

.lane-window {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--lane) 16%, var(--ui-surface));
}

.lane-tick {
  position: absolute;
  top: 7px;
  bottom: 7px;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: var(--lane);
}

.axis {
  position: relative;
  height: 20px;
  margin: 0 calc(var(--count) + 14px) 0 calc(var(--name) + 14px);
  font-size: 13px;
  color: var(--ui-muted);
}

.axis span {
  position: absolute;
  top: 0;
  white-space: nowrap;
  transform: translateX(-50%);
}

.axis span:first-child {
  transform: none;
}

.axis span:last-child {
  transform: translateX(-100%);
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
    padding: 24px 24px 22px;
  }

  .hero-lanes {
    padding-left: 0;
  }

  .hero-lanes::before {
    display: none;
  }

  .hero-actions {
    padding-top: 16px;
  }
}

@media (max-width: 768px) {
  .hero {
    gap: 18px;
    padding: 20px 16px 18px;
  }

  .hero-value {
    font-size: 34px;
  }

  .hero-actions,
  .hero-actions :deep(.lead-act),
  .hero-actions :deep(.btn) {
    width: 100%;
  }

  .lanes {
    gap: 6px;
  }

  /* name and count share a line above the track, so the track keeps the full width */
  .lane {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 10px;
    min-height: 0;
    padding-top: 6px;
  }

  .lane-name {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .lane-n {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 14px;
  }

  .lane-track {
    order: 3;
    grid-column: 1 / -1;
    height: 28px;
    border-radius: 10px;
  }

  .lane-tick {
    top: 5px;
    bottom: 5px;
  }

  .axis {
    margin: 4px 0 0;
  }
}
</style>
