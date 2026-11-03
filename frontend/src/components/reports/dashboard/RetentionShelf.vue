<template>
  <article
    class="ui-lead shelf"
    role="group"
    aria-label="報表保留期"
    :aria-busy="!loaded || undefined"
  >
    <header class="sh-head">
      <div class="sh-lead">
        <p class="sh-kicker">
          報表保留期
        </p>
        <h2
          class="sh-title"
          :class="{ 'is-dim': !loaded || rows.length === 0 }"
        >
          <template v-if="!loaded">
            讀取中
          </template>
          <template v-else-if="rows.length === 0">
            還沒有報表
          </template>
          <template v-else-if="downloadable > 0">
            <b>{{ downloadable }}</b> 份可下載<span v-if="nextExpiry">，最早 {{ nextExpiry.label }} 到期</span>
          </template>
          <template v-else>
            目前沒有可下載的報表
          </template>
        </h2>
        <p
          v-if="loaded && stats.totalReports > 0"
          class="sh-meta"
        >
          本月產出 <b>{{ stats.thisMonthGenerated }}</b> 份，累計 {{ stats.totalReports }} 份，完成率 <b>{{ completionRate }}%</b>
          <button
            v-if="stats.failedReports > 0"
            type="button"
            class="ui-link sh-fail"
            @click="$emit('show-failed-reports')"
          >
            查看 {{ stats.failedReports }} 份失敗
          </button>
        </p>
      </div>
      <ul
        v-if="rows.length > 0"
        class="sh-legend"
        aria-hidden="true"
      >
        <li><i class="k-kept" />已保留</li>
        <li><i class="k-left" />剩餘保留期</li>
        <li><i class="k-run" />生成中</li>
        <li><i class="k-fail" />失敗</li>
      </ul>
    </header>

    <div
      v-if="rows.length > 0"
      class="sh-body"
    >
      <div
        class="sh-axis"
        aria-hidden="true"
      >
        <span
          v-for="tick in ticks"
          :key="tick.at"
          class="sh-tick"
          :class="{ 'is-today': tick.today }"
          :style="{ left: tick.pos }"
        >{{ tick.label }}</span>
      </div>
      <div
        class="sh-grid"
        aria-hidden="true"
      >
        <i
          v-for="tick in ticks"
          :key="tick.at"
          :style="{ left: tick.pos }"
        />
      </div>
      <ul
        class="sh-rows"
        aria-label="報表與保留期"
      >
        <li
          v-for="row in rows"
          :key="row.id"
        >
          <button
            type="button"
            class="sh-row"
            :aria-label="row.aria"
            @click="$emit('open', row.id)"
          >
            <span class="sh-name">
              <b>{{ row.title }}</b>
              <span>{{ row.note }}</span>
            </span>
            <span
              class="sh-track"
              aria-hidden="true"
            >
              <span
                class="sh-today"
                :style="{ left: todayPos }"
              />
              <template v-if="row.span">
                <i
                  class="sh-kept"
                  :style="{ left: row.span.left, width: row.span.kept }"
                />
                <i
                  class="sh-left"
                  :style="{ left: row.span.mid, width: row.span.rest }"
                />
              </template>
              <i
                class="sh-dot"
                :class="row.tone"
                :style="{ left: row.dot }"
              />
              <em
                v-if="row.tone !== 'ok'"
                class="sh-state"
                :class="row.tone"
                :style="{ left: row.dot }"
              >{{ row.tone === 'fail' ? '失敗' : '生成中' }}</em>
            </span>
          </button>
        </li>
      </ul>
    </div>
    <p
      v-if="expiredCount > 0"
      class="sh-foot"
    >
      另有 {{ expiredCount }} 份已過期，檔案已清除，只保留紀錄。
    </p>
  </article>
</template>

<script setup lang="ts">
/**
 * RetentionShelf: the page's lead object. Every report is a bar on one shared day axis, from
 * the day it was created to the day its download link expires, so the first question on this
 * page (what is still downloadable, and for how long) is answered by position alone.
 * Built only from the loaded list: createdAt, expiresAt, status, type.
 */
import { computed } from 'vue'
import type { DashboardStats, ReportBase } from '@/types/reports'

const props = withDefaults(defineProps<{
  stats: DashboardStats
  loaded: boolean
  reports?: ReportBase[]
  getReportTypeLabel: (_type: ReportBase['type']) => string
}>(), { reports: () => [] })

defineEmits<{
  'show-failed-reports': []
  open: [id: string]
}>()

const DAY = 864e5
const MAX_ROWS = 7

const dayLabel = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' })
const startOfDay = (ms: number): number => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const completionRate = computed(() =>
  props.stats.totalReports === 0 ? 0 : Math.round((props.stats.completedReports / props.stats.totalReports) * 100)
)

const live = computed(() =>
  [...props.reports]
    .filter(r => r.status !== 'expired')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_ROWS)
)

const expiredCount = computed(() => props.reports.filter(r => r.status === 'expired').length)

const downloadable = computed(() =>
  props.reports.filter(r => r.status === 'completed' && r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()).length
)

const nextExpiry = computed(() => {
  const stamps = props.reports
    .filter(r => r.status === 'completed' && r.expiresAt && new Date(r.expiresAt).getTime() > Date.now())
    .map(r => new Date(r.expiresAt as string).getTime())
  return stamps.length > 0 ? { label: dayLabel.format(new Date(Math.min(...stamps))) } : null
})

// One shared axis: from the earliest creation (at least 5 days back) to the latest expiry (at least 3 days ahead)
const axis = computed(() => {
  const now = Date.now()
  let from = startOfDay(now - 5 * DAY)
  let to = startOfDay(now + 4 * DAY)
  for (const r of live.value) {
    from = Math.min(from, startOfDay(new Date(r.createdAt).getTime()))
    if (r.expiresAt) { to = Math.max(to, startOfDay(new Date(r.expiresAt).getTime()) + DAY) }
  }
  return { from, to, span: to - from }
})

const pct = (ms: number): number => Math.min(100, Math.max(0, ((ms - axis.value.from) / axis.value.span) * 100))
const todayPos = computed(() => `${pct(Date.now())}%`)

const ticks = computed(() => {
  const { from, span } = axis.value
  const days = Math.round(span / DAY)
  const step = Math.max(1, Math.ceil(days / 5))
  const today = startOfDay(Date.now())
  const out: Array<{ at: number; label: string; pos: string; today: boolean }> = []
  for (let i = 0; i < days; i += 1) {
    const at = from + i * DAY
    const isToday = at === today
    if (i % step === 0 || isToday) {
      if (!isToday && Math.abs(at - today) < step * DAY * 0.6) { continue }
      out.push({ at, label: isToday ? `今天 ${dayLabel.format(new Date(at))}` : dayLabel.format(new Date(at)), pos: `${isToday ? pct(Date.now()) : pct(at)}%`, today: isToday })
    }
  }
  return out
})

const rows = computed(() => live.value.map(r => {
  const created = new Date(r.createdAt).getTime()
  const when = dayLabel.format(new Date(created))
  const type = props.getReportTypeLabel(r.type)
  const now = Date.now()
  if (r.status === 'failed') {
    return { id: r.id, title: r.title, note: `${type} ・ ${when} 產生失敗`, tone: 'fail', dot: `${pct(created)}%`, span: null, aria: `${r.title}，${when} 產生失敗` }
  }
  if (r.status === 'generating' || r.status === 'pending') {
    return { id: r.id, title: r.title, note: `${type} ・ ${when} 開始生成`, tone: 'run', dot: `${pct(created)}%`, span: null, aria: `${r.title}，生成中` }
  }
  const expires = r.expiresAt ? new Date(r.expiresAt).getTime() : null
  const left = pct(created)
  const mid = expires ? Math.min(pct(now), pct(expires)) : pct(now)
  const end = expires ? pct(expires) : pct(now)
  const expiry = expires ? `${dayLabel.format(new Date(expires))} 到期` : '無到期日'
  return {
    id: r.id,
    title: r.title,
    note: `${type} ・ ${expiry}`,
    tone: 'ok',
    dot: `${left}%`,
    span: { left: `${left}%`, kept: `${Math.max(mid - left, 0)}%`, mid: `${mid}%`, rest: `${Math.max(end - mid, 0)}%` },
    aria: `${r.title}，${when} 產生，${expiry}`
  }
}))
</script>

<style scoped>
.shelf {
  display: grid;
  gap: 18px;
  padding: 26px 32px 22px;
}

.sh-head {
  display: flex;
  gap: 16px 32px;
  align-items: flex-end;
  justify-content: space-between;
}

.sh-lead {
  min-width: 0;
}

.sh-kicker {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.sh-title {
  margin: 4px 0 0;
  font: 400 24px / 1.25 var(--ui-font-display);
  letter-spacing: -0.02em;
  color: var(--ui-ink-2);
}

.sh-title b {
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.sh-title.is-dim {
  color: var(--ui-muted);
}

.sh-meta {
  margin: 8px 0 0;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.sh-meta b {
  font-weight: 600;
  color: var(--ui-ink);
}

.sh-fail {
  margin-left: 12px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 14px;
}

.sh-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.sh-legend li {
  display: flex;
  gap: 7px;
  align-items: center;
  white-space: nowrap;
}

.sh-legend i {
  display: block;
  width: 18px;
  height: 8px;
  border-radius: 999px;
}

.k-kept {
  background: var(--ui-green);
}

.k-left {
  background: color-mix(in srgb, var(--ui-green) 10%, var(--ui-surface));
  box-shadow: inset 0 0 0 2px var(--ui-green);
}

.k-run,
.k-fail {
  width: 8px !important;
  border-radius: 50% !important;
}

.k-run {
  background: var(--ui-orange);
}

.k-fail {
  background: var(--ui-red);
}

.sh-body {
  --name-w: 232px;
  position: relative;
}

.sh-axis {
  position: relative;
  height: 28px;
  margin-left: var(--name-w);
}

/* a hairline under every axis label, so each bar's start and end can be read against a date */
.sh-grid {
  position: absolute;
  top: 24px;
  right: 0;
  bottom: 0;
  left: var(--name-w);
  pointer-events: none;
}

.sh-grid i {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 0.5px solid var(--ui-sep);
}

.sh-rows {
  position: relative;
}

.sh-tick {
  position: absolute;
  top: 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
  transform: translateX(-50%);
  white-space: nowrap;
}

.sh-tick:first-child {
  transform: none;
}

.sh-tick.is-today {
  font-weight: 700;
  color: var(--ui-accent);
}

.sh-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.sh-rows li + li {
  border-top: 0.5px solid var(--ui-sep);
}

.sh-row {
  display: grid;
  grid-template-columns: var(--name-w) minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.sh-row:hover {
  background: var(--ui-surface-2);
}

.sh-name {
  display: grid;
  min-width: 0;
  padding-right: 16px;
}

.sh-name b {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sh-name span {
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sh-track {
  position: relative;
  align-self: stretch;
}

.sh-today {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1.5px dashed var(--ui-accent);
  opacity: 0.55;
}

.sh-kept,
.sh-left {
  position: absolute;
  top: 50%;
  height: 10px;
  margin-top: -5px;
}

.sh-kept {
  border-radius: 999px 0 0 999px;
  background: var(--ui-green);
}

.sh-left {
  border-radius: 0 999px 999px 0;
  background: color-mix(in srgb, var(--ui-green) 10%, var(--ui-surface));
  box-shadow: inset 0 0 0 2px var(--ui-green);
}

.sh-dot {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: var(--ui-green);
  box-shadow: 0 0 0 3px var(--ui-surface);
}

.sh-dot.run {
  background: var(--ui-orange);
  animation: sh-pulse 1.8s var(--ui-ease) infinite;
}

.sh-dot.fail {
  background: var(--ui-red);
}

/* the dot names itself, so a lone mark on the axis is never a mystery */
.sh-state {
  position: absolute;
  top: 50%;
  margin-left: 16px;
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  white-space: nowrap;
  transform: translateY(-50%);
}

.sh-state.fail {
  color: var(--ui-red-ink);
}

.sh-state.run {
  color: var(--ui-orange-ink);
}

.sh-foot {
  margin: 0;
  font-size: 14px;
  color: var(--ui-muted);
}

@keyframes sh-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px var(--ui-surface), 0 0 0 3px transparent;
  }

  50% {
    box-shadow: 0 0 0 3px var(--ui-surface), 0 0 0 8px color-mix(in srgb, var(--ui-orange) 30%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sh-dot.run {
    animation: none;
  }
}

@media (max-width: 1024px) {
  .sh-head {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .shelf {
    gap: 14px;
    padding: 22px 20px 18px;
  }

  .sh-title {
    font-size: 22px;
  }

  .sh-title b {
    font-size: 36px;
  }

  .sh-meta {
    font-size: 14px;
  }

  .sh-fail {
    display: block;
    margin: 6px 0 0;
  }

  .sh-body {
    --name-w: 0px;
  }

  .sh-axis {
    margin-left: 0;
  }

  .sh-grid {
    top: 24px;
  }

  .sh-row {
    grid-template-columns: minmax(0, 1fr);
    min-height: 62px;
    padding: 8px 0 4px;
  }

  .sh-name {
    padding-right: 0;
  }

  .sh-track {
    height: 24px;
  }

  .sh-kept,
  .sh-left {
    height: 12px;
    margin-top: -6px;
  }

  .sh-rows li:nth-child(n + 7) {
    display: none;
  }
}
</style>
