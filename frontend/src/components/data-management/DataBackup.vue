<template>
  <div class="ui-page data-backup">
    <UiPageHead
      title="資料備份"
      subtitle="整個資料庫備份在雲端儲存（Cloudflare R2），可隨時下載備份檔。"
    />

    <!-- Lead: the newest automatic backup, the 30-day coverage arc and the one primary action -->
    <RingLead
      kicker="最近自動備份"
      :value="leadValue"
      :tone="statusTone === 'warn' ? 'warn' : (statusTone === 'ok' ? '' : 'none')"
      :meaning="leadMeaning"
      :busy="loading && !data"
    >
      <span
        v-if="data && data.lastAuto"
        class="ui-pill lead-state"
        :class="statusPill.className"
      >{{ statusPill.label }}</span>
      <p
        v-if="message"
        class="message"
        :class="messageType"
        role="status"
      >
        {{ message }}
      </p>
      <template #actions>
        <div class="lead-act">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="running"
            @click="onBackupNow"
          >
            <svg
              class="btn-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M12 16V5M7 9l5-5 5 5M4 20h16" /></svg>
            {{ running ? '備份中...' : '立即備份到雲端' }}
          </button>
          <span
            v-if="policy"
            class="act-note"
          >手動備份保留 {{ policy.retentionDays.manual }} 天</span>
        </div>
      </template>
    </RingLead>

    <div class="list-row">
      <section class="list-card">
        <h2 class="ui-group-label">
          備份檔案
          <span
            v-if="data"
            class="label-note"
          >共 {{ data.count.toLocaleString() }} 份，依日期分組、新到舊</span>
          <button
            type="button"
            class="ui-link label-act"
            :disabled="loading"
            @click="load"
          >
            重新整理
          </button>
        </h2>
        <div class="ui-group list-body">
          <div
            v-if="data && tierChips.length > 1"
            class="chips"
            role="group"
            aria-label="依類型篩選"
          >
            <button
              v-for="chip in tierChips"
              :key="chip.key"
              type="button"
              class="ui-chip"
              :aria-pressed="tierFilter === chip.key"
              @click="setTier(chip.key)"
            >
              {{ chip.label }} <span class="chip-n">{{ chip.count.toLocaleString() }}</span>
            </button>
          </div>

          <p
            v-if="data && data.incompletePrefixes.length > 0"
            class="warn"
          >
            部分類型的備份數量過多，列表可能不完整。
          </p>

          <UiEmptyState
            v-if="loading && !data"
            description="載入中..."
          />
          <UiEmptyState
            v-else-if="!data"
            title="無法載入備份列表"
            :description="loadError || '請稍後再試。'"
          >
            <template #action>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="load"
              >
                重試
              </button>
            </template>
          </UiEmptyState>
          <UiEmptyState
            v-else-if="visibleItems.length === 0"
            title="尚無備份檔"
            description="按「立即備份到雲端」建立第一份備份。"
          />
          <template v-else>
            <div class="day-groups">
              <component
                :is="section.kind === 'week' ? 'details' : 'div'"
                v-for="section in sections"
                :key="section.key"
                class="section"
                :class="section.kind === 'week' ? 'section-week' : 'section-open'"
                :open="section.kind === 'week' && dayFilter ? true : undefined"
              >
                <summary
                  v-if="section.kind === 'week'"
                  class="week-head"
                >
                  <svg
                    class="week-chev"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  ><path d="m9 6 6 6-6 6" /></svg>
                  <span class="week-title">{{ section.label }}</span>
                  <span class="day-sum">{{ section.count }} 份 · {{ formatBytes(section.size) }}</span>
                </summary>
                <section
                  v-for="group in section.days"
                  :key="group.key"
                  class="day"
                >
                  <header class="day-head">
                    <h3>
                      {{ group.label }}
                      <small v-if="group.date">{{ group.date }}</small>
                    </h3>
                    <span class="day-sum">{{ group.items.length }} 份 · {{ formatBytes(group.size) }}</span>
                  </header>
                  <ul class="brow-list">
                    <li
                      v-for="item in group.items"
                      :key="item.key"
                      class="brow"
                    >
                      <span
                        class="ui-pill brow-type"
                        :class="tierPill(item.tier)"
                      >{{ tierLabel(item.tier) }}</span>
                      <div class="brow-main">
                        <div class="brow-name">
                          {{ itemName(item) }}
                        </div>
                        <div
                          class="brow-file"
                          :title="fileName(item.key)"
                        >
                          {{ fileName(item.key) }}
                        </div>
                      </div>
                      <span class="brow-stat">
                        <b>{{ formatBytes(item.size) }}</b>
                        <small>{{ formatClock(item.uploaded) }}</small>
                      </span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm brow-dl"
                        :aria-label="`下載 ${itemLabel(item)}`"
                        :aria-busy="downloadingKey === item.key"
                        :disabled="downloadingKey === item.key"
                        @click="onDownload(item)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        ><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
                      </button>
                    </li>
                  </ul>
                </section>
              </component>
            </div>
            <div
              v-if="visibleItems.length > shownItems.length"
              class="more"
            >
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="showCount += PAGE_SIZE"
              >
                顯示更多（{{ shownItems.length }} / {{ visibleItems.length }}）
              </button>
            </div>
          </template>
        </div>
      </section>

      <div class="side-col">
        <!-- Calendar: one tile per day under its weekday (green = has a backup, orange = none) -->
        <section
          v-if="data"
          class="cal"
          aria-label="每日備份"
        >
          <h2 class="ui-group-label">
            近 {{ strip.length }} 天備份
            <button
              v-if="dayFilter"
              type="button"
              class="ui-chip label-chip"
              @click="dayFilter = ''"
            >
              {{ dayFilterLabel }} ✕
            </button>
          </h2>
          <div class="ui-group cal-card">
            <p class="cal-sum">
              <b>{{ coverageDays.have }}</b><span> / {{ coverageDays.total }} 天有備份</span>
            </p>
            <div
              class="cal-week"
              aria-hidden="true"
            >
              <span
                v-for="w in WEEKDAYS"
                :key="w"
              >{{ w }}</span>
            </div>
            <ol
              class="strip"
              aria-label="每日備份狀態，點選可只看該日"
            >
              <li
                v-for="(cell, i) in strip"
                :key="cell.key"
                :style="i === 0 ? { gridColumnStart: cell.col + 1 } : undefined"
              >
                <button
                  type="button"
                  class="cell"
                  :class="{ has: cell.count > 0, on: dayFilter === cell.key, today: cell.today }"
                  :title="cell.aria"
                  :aria-pressed="dayFilter === cell.key"
                  :aria-label="cell.aria"
                  :disabled="cell.count === 0"
                  @click="dayFilter = dayFilter === cell.key ? '' : cell.key"
                >
                  <span class="num">{{ cell.label }}</span>
                </button>
              </li>
            </ol>
            <p class="cal-key">
              <span><i class="k-has" />有備份</span>
              <span><i class="k-miss" />沒有備份</span>
              <span><i class="k-today" />今天</span>
            </p>
          </div>
        </section>

        <aside
          v-if="data && summary.total > 0"
          aria-label="備份概覽"
        >
          <h2 class="ui-group-label">
            備份概覽
          </h2>
          <div class="ui-group sum-card">
            <div class="sum-big">
              {{ formatBytes(summary.size) }}<small>{{ summary.total.toLocaleString() }} 份</small>
            </div>
            <p class="sum-span">
              {{ summary.span }}
            </p>
            <ul class="sum-list">
              <li
                v-for="row in summary.tiers"
                :key="row.key"
              >
                <span class="sum-row">
                  <span>{{ row.label }}<small v-if="row.keep"> 保留 {{ row.keep }} 天</small></span>
                  <span class="sum-n">{{ row.count }} 份 · {{ formatBytes(row.size) }}</span>
                </span>
                <span
                  class="sum-bar"
                  aria-hidden="true"
                ><i :style="{ width: row.share + '%' }" /></span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiPageHead from '@/components/ui/UiPageHead.vue'
import RingLead from '@/components/lead/RingLead.vue'
import { computed, onMounted, ref } from 'vue'
import { listBackups, runBackup, downloadBackup, type BackupItem, type BackupList } from '@/api/backup'

const PAGE_SIZE = 24
/** The daily job should land within a day; allow slack before calling it overdue. */
const OVERDUE_AFTER_MS = 36 * 60 * 60 * 1000
const TAIPEI = 'Asia/Taipei'

const loading = ref(true)
const running = ref(false)
const downloadingKey = ref<string | null>(null)
const data = ref<BackupList | null>(null)
const loadError = ref('')
const message = ref('')
const messageType = ref<'ok' | 'error'>('ok')
const tierFilter = ref<string>('all')
const showCount = ref(PAGE_SIZE)
const dayFilter = ref('')

const TIER_LABELS: Record<string, string> = {
  daily: '每日',
  monthly: '每月',
  members: '人員',
  tags: '標籤',
  assignments: '指派',
  manual: '手動'
}
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const TIER_ORDER = ['manual', 'daily', 'monthly', 'members', 'tags', 'assignments']
interface DayGroup {
  key: string
  label: string
  date: string
  size: number
  items: BackupItem[]
}

interface StripCell {
  key: string
  day: number
  count: number
  size: number
  today: boolean
  /** 0 = Monday ... 6 = Sunday */
  col: number
  /** the day number, or month/day on the 1st and on the first tile */
  label: string
  aria: string
}

function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier)
  return index === -1 ? TIER_ORDER.length : index
}

const tierLabel = (t: string) => TIER_LABELS[t] || t
const fileName = (key: string) => key.split('/').pop() || key

function tierPill(tier: string): string {
  if (tier === 'manual') {
    return 'ui-pill-blue'
  }
  if (tier === 'monthly') {
    return 'ui-pill-orange'
  }
  if (tier === 'members' || tier === 'tags' || tier === 'assignments') {
    return 'ui-pill-green'
  }
  return ''
}

const policy = computed(() => data.value?.policy ?? null)

const scheduleText = computed(() => {
  const p = policy.value
  if (!p) {
    return ''
  }
  const zone = p.schedule.timezone === TAIPEI ? '台北時間' : p.schedule.timezone
  return `每日 ${p.schedule.localTime}（${zone}）自動執行`
})

/** Healthy when the newest automatic backup is recent; derived from the real timestamp. */
const statusPill = computed(() => {
  const last = data.value?.lastAuto
  if (!last) {
    return { label: '尚無紀錄', className: '' }
  }
  const age = Date.now() - new Date(last.uploaded).getTime()
  return age > OVERDUE_AFTER_MS
    ? { label: '已逾期', className: 'ui-pill-orange' }
    : { label: '正常', className: 'ui-pill-green' }
})

const statusTone = computed(() => {
  if (statusPill.value.className === 'ui-pill-green') {
    return 'ok'
  }
  return statusPill.value.className === 'ui-pill-orange' ? 'warn' : 'none'
})

const tierChips = computed(() => {
  const counts = data.value?.countsByTier ?? {}
  const keys = Object.keys(counts)
    .filter(key => (counts[key] ?? 0) > 0)
    .sort((a, b) => tierRank(a) - tierRank(b))
  return [
    { key: 'all', label: '全部', count: data.value?.count ?? 0 },
    ...keys.map(key => ({ key, label: tierLabel(key), count: counts[key] ?? 0 }))
  ]
})

const visibleItems = computed(() => {
  const items = data.value?.items ?? []
  const filtered = tierFilter.value === 'all' ? items : items.filter(item => item.tier === tierFilter.value)
  // The API lists per type; the day groups below need one newest-first sequence
  const byDay = dayFilter.value ? filtered.filter(item => dayKey(new Date(item.uploaded)) === dayFilter.value) : filtered
  return [...byDay].sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())
})

const shownItems = computed(() => visibleItems.value.slice(0, showCount.value))

/** Files grouped by Taipei calendar day (the list is already newest first) */
const groups = computed<DayGroup[]>(() => {
  const out: DayGroup[] = []
  for (const item of shownItems.value) {
    const d = new Date(item.uploaded)
    const key = dayKey(d)
    let group = out[out.length - 1]
    if (!group || group.key !== key) {
      const label = dayLabel(d)
      group = { key, label, date: label === dayDate(d) ? '' : dayDate(d), size: 0, items: [] }
      out.push(group)
    }
    group.items.push(item)
    group.size += item.size
  }
  return out
})

interface Section {
  key: string
  kind: 'open' | 'week'
  label: string
  count: number
  size: number
  days: DayGroup[]
}

/** Monday of the Taipei week containing the date, as a Date at Taipei noon */
function weekStart(d: Date): Date {
  const day = new Date(`${dayKey(d)}T12:00:00+08:00`)
  const offset = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - offset * 24 * 3600 * 1000)
}

function shortDate(d: Date): string {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: 'numeric', day: 'numeric' }).format(d)
}

/** Today and yesterday stay open; every older day folds into its week (collapsed, with count and size) */
const sections = computed<Section[]>(() => {
  const out: Section[] = []
  const isRecent = (g: DayGroup) => g.label === '今天' || g.label === '昨天'
  const recent = groups.value.filter(isRecent)
  if (recent.length > 0) {
    out.push({ key: 'recent', kind: 'open', label: '', count: 0, size: 0, days: recent })
  }
  const weeks = new Map<string, Section>()
  for (const group of groups.value) {
    if (isRecent(group)) {
      continue
    }
    const start = weekStart(new Date(`${group.key}T12:00:00+08:00`))
    const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000)
    const key = dayKey(start)
    let week = weeks.get(key)
    if (!week) {
      week = { key, kind: 'week', label: `${shortDate(start)} - ${shortDate(end)}`, count: 0, size: 0, days: [] }
      weeks.set(key, week)
      out.push(week)
    }
    week.days.push(group)
    week.count += group.items.length
    week.size += group.size
  }
  return out
})

/** Totals over every listed file (not just the page shown), grouped by type */
const summary = computed(() => {
  const items = data.value?.items ?? []
  const size = items.reduce((sum, item) => sum + item.size, 0)
  const byTier = new Map<string, { count: number; size: number }>()
  let oldest = Infinity
  let newest = -Infinity
  for (const item of items) {
    const entry = byTier.get(item.tier) ?? { count: 0, size: 0 }
    entry.count += 1
    entry.size += item.size
    byTier.set(item.tier, entry)
    const at = new Date(item.uploaded).getTime()
    oldest = Math.min(oldest, at)
    newest = Math.max(newest, at)
  }
  const tiers = Array.from(byTier.entries())
    .sort((a, b) => tierRank(a[0]) - tierRank(b[0]))
    .map(([key, entry]) => ({
      key,
      label: tierLabel(key),
      keep: policy.value?.retentionDays[key as keyof NonNullable<typeof policy.value>['retentionDays']] ?? 0,
      count: entry.count,
      size: entry.size,
      share: size > 0 ? Math.max(3, Math.round((entry.size / size) * 100)) : 0
    }))
  const span = items.length > 0 ? `${shortDate(new Date(oldest))} 至 ${shortDate(new Date(newest))}，共 ${tiers.length} 種類型` : ''
  return { total: items.length, size, span, tiers }
})

/** The last N calendar days (N = daily retention, at most 30), oldest to newest, from the real file list */
const strip = computed<StripCell[]>(() => {
  const items = data.value?.items ?? []
  const span = Math.min(30, policy.value?.retentionDays.daily ?? 30)
  const perDay = new Map<string, { count: number; size: number }>()
  for (const item of items) {
    const key = dayKey(new Date(item.uploaded))
    const entry = perDay.get(key) ?? { count: 0, size: 0 }
    entry.count += 1
    entry.size += item.size
    perDay.set(key, entry)
  }
  const cells: StripCell[] = []
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    const key = dayKey(d)
    const dow = (new Date(`${key}T12:00:00+08:00`).getUTCDay() + 6) % 7
    const entry = perDay.get(key)
    const count = entry?.count ?? 0
    const size = entry?.size ?? 0
    cells.push({
      key,
      day: Number(key.slice(8, 10)),
      count,
      size,
      today: i === 0,
      col: dow,
      label: i === span - 1 || Number(key.slice(8, 10)) === 1 ? `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}` : String(Number(key.slice(8, 10))),
      aria: entry ? `${dayLabel(d)} ${dayDate(d)}，${count} 份，${formatBytes(size)}` : `${dayDate(d)}，沒有備份`
    })
  }
  return cells
})

const leadValue = computed(() => {
  const last = data.value?.lastAuto
  return last ? formatDate(last.uploaded) : '尚無紀錄'
})

const leadMeaning = computed(() => {
  if (!data.value) { return '' }
  if (!data.value.lastAuto) { return '尚未有自動備份記錄' }
  const auto = new Date(data.value.lastAuto.uploaded).getTime()
  const manual = data.value.items.find(item => item.tier === 'manual')
  const newer = manual && new Date(manual.uploaded).getTime() > auto ? `之後有手動備份 ${formatDate(manual.uploaded)}` : ''
  return [scheduleText.value, newer, statusPill.value.label === '已逾期' ? '已逾期' : ''].filter(Boolean).join(' · ')
})

/** One arc: days of the last 30 (or the daily retention) that have at least one backup */
const coverageDays = computed(() => ({
  have: strip.value.filter(cell => cell.count > 0).length,
  total: strip.value.length
}))

const dayFilterLabel = computed(() => {
  if (!dayFilter.value) {
    return ''
  }
  const d = new Date(`${dayFilter.value}T12:00:00+08:00`)
  return `${dayLabel(d)} ${dayDate(d)}`
})

/** 「10/28 週三」: always numeric, so it never repeats the 今天/昨天 label */
function dayDate(d: Date): string {
  const md = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: 'numeric', day: 'numeric' }).format(d)
  const weekday = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, weekday: 'short' }).format(d)
  return `${md} ${weekday}`
}

/** What the file is, in words; the file name stays as a caption */
function itemName(item: BackupItem): string {
  if (item.tier === 'monthly') {
    return '每月資料庫備份'
  }
  if (item.tier === 'members' || item.tier === 'tags' || item.tier === 'assignments') {
    return `${tierLabel(item.tier)}資料匯出`
  }
  return `${tierLabel(item.tier)}資料庫備份`
}

function dayLabel(d: Date): string {
  const today = new Date()
  if (dayKey(d) === dayKey(today)) {
    return '今天'
  }
  if (dayKey(d) === dayKey(new Date(today.getTime() - 24 * 3600 * 1000))) {
    return '昨天'
  }
  return dayDate(d)
}

/** 「每日備份 · 10/25」: what it is and which day; the file name stays as a caption. */
function itemLabel(item: BackupItem): string {
  const d = new Date(item.uploaded)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TAIPEI, month: 'numeric', day: 'numeric' }).formatToParts(d)
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  const name = `${tierLabel(item.tier)}備份`
  if (item.tier === 'monthly') {
    return `${name} · ${month} 月`
  }
  if (item.tier === 'manual') {
    return `${name} · ${month}/${day} ${formatClock(item.uploaded)}`
  }
  return `${name} · ${month}/${day}`
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) { return iso }
  return new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

function setTier(key: string) {
  tierFilter.value = key
  dayFilter.value = ''
  showCount.value = PAGE_SIZE
}

function formatBytes(n: number): string {
  if (!n) { return '0 B' }
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TAIPEI }).format(date)
}

/** 今天 03:00 / 10/28 03:00 in Taipei time. */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) { return iso }
  const time = new Intl.DateTimeFormat('zh-TW', {
    timeZone: TAIPEI,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d)
  if (dayKey(d) === dayKey(new Date())) {
    return `今天 ${time}`
  }
  const day = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: '2-digit', day: '2-digit' }).format(d)
  return `${day} ${time}`
}

function setMessage(text: string, type: 'ok' | 'error') {
  message.value = text
  messageType.value = type
}

async function load() {
  loading.value = true
  const res = await listBackups()
  if (res.success && res.data) {
    data.value = res.data
    loadError.value = ''
  } else {
    loadError.value = res.error || '無法載入備份列表'
    setMessage(loadError.value, 'error')
  }
  loading.value = false
}

async function onBackupNow() {
  running.value = true
  setMessage('', 'ok')
  const res = await runBackup()
  if (res.success) {
    setMessage('備份已建立並上傳至雲端。', 'ok')
    await load()
  } else {
    setMessage(res.error || '備份失敗', 'error')
  }
  running.value = false
}

async function onDownload(item: BackupItem) {
  downloadingKey.value = item.key
  const res = await downloadBackup(item.key)
  if (res.success && res.data) {
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName(item.key)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else {
    setMessage(res.error || '下載失敗', 'error')
  }
  downloadingKey.value = null
}

onMounted(load)
</script>

<style scoped>
.lead-act {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
}

.label-note {
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}

.label-chip {
  margin-left: 8px;
}

.label-act {
  margin-left: auto;
  border: 0;
  background: none;
}

.act-note {
  font-size: 13px;
  color: var(--ui-muted);
}

.btn-ico {
  width: 16px;
  height: 16px;
}

.message {
  margin: 8px 0 0;
  padding: 10px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-green-soft);
  font-size: 13.5px;
  color: var(--ui-green-ink);
}

.message.error {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

/* Calendar: weekday columns, one tile per day (green = has a backup, orange = none) */
.cal-card {
  padding: 16px 18px 14px;
}

.cal-sum {
  margin: 0 0 12px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.cal-sum b {
  font: 600 26px var(--ui-font-display);
  letter-spacing: -0.02em;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.cal-week,
.strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}

.cal-week {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  color: var(--ui-muted);
}

.strip {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cal-key {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.cal-key span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.cal-key i {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.k-has {
  background: var(--ui-green-soft);
}

.k-miss {
  background: var(--ui-orange-soft);
  box-shadow: inset 0 0 0 1.5px var(--ui-orange);
}

.k-today {
  background: var(--ui-green-soft);
  box-shadow: inset 0 0 0 2px var(--ui-green-ink);
}

.cell {
  display: grid;
  place-items: center;
  width: 100%;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
  font: inherit;
  cursor: default;
}

.cell.has {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease), color var(--ui-dur) var(--ui-ease);
}

.cell.has:hover {
  background: var(--ui-fill-strong);
}

.cell.today {
  box-shadow: inset 0 0 0 2px var(--ui-green-ink);
}

.cell.on,
.cell.on:hover {
  background: var(--ui-accent);
  color: #fff;
}

.cell:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.num {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.lead-state {
  margin-top: 10px;
}

.list-body {
  padding-top: 16px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 22px 14px;
}

.chip-n {
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
}

.ui-chip.is-on .chip-n,
.ui-chip[aria-pressed="true"] .chip-n {
  color: inherit;
  opacity: 1;
}

.warn {
  margin: 0 22px 12px;
  padding: 10px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-orange-soft);
  font-size: 13px;
  color: var(--ui-orange-ink);
}

/* Recent days stay open; older days fold into weeks. The list sits beside a sticky summary. */
.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.day-groups {
  display: grid;
  gap: 12px;
  padding: 0 22px 8px;
}

.section-open {
  display: grid;
  gap: 12px;
}

.section-week {
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.week-head {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 14px 16px;
  font: 600 15px / 1.3 var(--ui-font-display);
  cursor: pointer;
  list-style: none;
}

.week-head::-webkit-details-marker {
  display: none;
}

.week-title {
  flex: 1;
}

.week-chev {
  width: 16px;
  height: 16px;
  color: var(--ui-muted);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.section-week[open] .week-chev {
  transform: rotate(90deg);
}

.week-head:focus-visible {
  border-radius: var(--ui-r-inner);
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.section-week .day {
  margin: 0 8px;
  background: none;
}

.section-week .day:last-child {
  padding-bottom: 8px;
}

.day {
  padding: 4px 14px 6px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

/* Sticky summary */
.side-col {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 16px;
}

.sum-card {
  padding: 20px 22px;
}

.sum-big {
  font: 600 28px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.sum-big small {
  margin-left: 8px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.sum-span {
  margin: 4px 0 14px;
  font-size: 13px;
  color: var(--ui-muted);
}

.sum-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sum-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 500;
}

.sum-row small {
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}

.sum-n {
  font-weight: 400;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.sum-bar {
  display: block;
  height: 6px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.sum-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ui-accent);
}

.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 2px 8px;
}

.day-head h3 {
  margin: 0;
  font: 600 15px / 1.3 var(--ui-font-display);
}

.day-head small {
  margin-left: 8px;
  font: 500 13px var(--ui-font-ui);
  color: var(--ui-muted);
}

.day-sum {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.brow-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.brow {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto 36px;
  gap: 12px;
  align-items: center;
  min-height: 52px;
  padding: 8px 0;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.brow-type {
  justify-content: center;
  width: 100%;
}

.brow-name {
  font-size: 14px;
  font-weight: 600;
}

.brow-file {
  overflow: hidden;
  font: 12px / 1.4 var(--ui-font-mono);
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brow-stat {
  display: grid;
  justify-items: end;
  font-variant-numeric: tabular-nums;
}

.brow-stat b {
  font-size: 13.5px;
  font-weight: 600;
}

.brow-stat small {
  font-size: 13px;
  color: var(--ui-muted);
}

.brow-dl {
  width: 36px;
  padding: 0;
}

.brow-dl svg {
  width: 18px;
  height: 18px;
}

.more {
  display: flex;
  justify-content: center;
  padding: 6px 14px 18px;
}

@media (max-width: 1280px) {
  .list-row {
    grid-template-columns: minmax(0, 1fr);
  }

  /* the calendar and the totals come first: they say how the backups are doing before the file list does */
  .side-col {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    order: -1;
  }
}

@media (max-width: 768px) {
  .lead-act .btn {
    width: 100%;
    justify-content: center;
  }

  .side-col {
    grid-template-columns: minmax(0, 1fr);
  }

  .cal-card {
    padding: 14px 14px 12px;
  }

  .cell {
    height: 40px;
  }

  /* the file list below carries the per-type counts; the phone keeps the headline totals */
  .sum-list {
    display: none;
  }

  .sum-span {
    margin-bottom: 0;
  }

  .chips,
  .day-groups {
    padding-right: 12px;
    padding-left: 12px;
  }

  .day {
    padding-right: 10px;
    padding-left: 10px;
  }

  /* the type is already in the name; the file name ends in an ellipsis (full name on hover) */
  .brow {
    grid-template-columns: minmax(0, 1fr) auto 36px;
    gap: 8px;
  }

  .brow-type {
    display: none;
  }

}
</style>
