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

    <!-- Signature: how much of each kind's retention window is in use. Every bar is that kind's own
         window (full width = how long it is kept, today on the right); the colour reaches back as far as
         the oldest file stored. -->
    <div
      v-if="lanes.length > 0"
      class="hero-lanes"
    >
      <div class="lanes-head">
        <h2>保留期間</h2>
        <span>每條以該類型的保留天數為滿格；<i
          class="lg-dot"
          aria-hidden="true"
        />一份備份，細線為已涵蓋的期間</span>
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
            <small>{{ lane.used }}</small>
          </div>
          <div class="lane-track">
            <span class="lane-in">
              <span
                class="lane-span"
                :style="{ width: lane.span + '%' }"
              />
              <i
                v-for="(d, i) in lane.dots"
                :key="i"
                class="lane-dot"
                :style="{ right: d + '%' }"
              />
            </span>
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
          <span>到期刪除</span>
          <span>今天</span>
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

/** One mark per stored file: its age as a share of the lane's window (0 = today, on the right) */
function dotsFor(mine: BackupItem[], window: number): number[] {
  return mine.map(i => Math.min(100, (ageDays(i.uploaded) / Math.max(1, window)) * 100))
}

const lanes = computed(() => {
  if (props.items.length === 0) { return [] }
  return LANES
    .map((lane) => {
      const mine = props.items.filter(i => lane.tiers.includes(i.tier))
      const keep = retention(lane.tiers)
      const oldest = Math.max(0, ...mine.map(i => ageDays(i.uploaded)))
      const days = Math.max(1, Math.round(oldest))
      return {
        key: lane.key,
        label: lane.label,
        color: lane.color,
        keep,
        count: mine.length,
        size: formatBytes(mine.reduce((n, i) => n + i.size, 0)),
        used: keep ? `已存 ${Math.min(days, keep)} / ${keep} 天` : `最早 ${days} 天前`,
        fill: keep ? Math.min(100, Math.max(3, (days / keep) * 100)) : 100,
        dots: dotsFor(mine, keep || days),
        span: Math.round(Math.min(100, (oldest / Math.max(1, keep || days)) * 100) * 10) / 10,
      }
    })
    .filter(l => l.count > 0)
})

const totals = computed(() => {
  const items = props.items
  if (items.length === 0) { return { files: 0, size: '', since: '' } }
  const oldest = Math.min(...items.map(i => new Date(i.uploaded).getTime()))
  const since = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: 'numeric', day: 'numeric' }).format(new Date(oldest))
  return { files: items.length, size: formatBytes(items.reduce((n, i) => n + i.size, 0)), since }
})

const aria = computed(() =>
  `各類備份的保留期間：${lanes.value.map(l => `${l.label} ${l.count} 份，${l.used}`).join('；')}`,
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
  --name: 132px;
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
  border-radius: 12px;
  background: var(--ui-fill);
}

/* the stretch from the oldest stored file to today */
.lane-in {
  position: absolute;
  inset: 0 14px;
}

.lane-span {
  position: absolute;
  top: 50%;
  right: 0;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--lane) 45%, var(--ui-surface));
}

.lane-dot {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px -5px 0 0;
  border-radius: 50%;
  background: var(--lane);
  box-shadow: 0 0 0 2px var(--ui-fill);
}

.lanes-head .lg-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin: 0 4px 0 2px;
  border-radius: 50%;
  background: var(--ui-ink-2);
  vertical-align: 0;
}

.axis {
  display: flex;
  justify-content: space-between;
  margin: 0 calc(var(--count) + 14px) 0 calc(var(--name) + 14px);
  font-size: 13px;
  color: var(--ui-ink-2);
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

  .axis {
    margin: 4px 0 0;
  }
}
</style>
