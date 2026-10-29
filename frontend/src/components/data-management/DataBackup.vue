<template>
  <div class="ui-page data-backup">
    <UiPageHead
      title="資料備份"
      subtitle="整個資料庫備份在雲端儲存（Cloudflare R2），可隨時下載備份檔。"
    />

    <section class="top-row">
      <!-- Automatic backup status and the one primary action -->
      <article class="ui-card status-card">
        <span
          class="status-ico"
          :class="statusTone"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.3 9.5 4 4 0 0 0 7 19Z" /><path d="m9 14 2 2 4-4" /></svg>
        </span>
        <div class="status-main">
          <div class="lbl">
            自動備份
            <span
              v-if="!loading && data"
              class="ui-pill ui-pill-dot"
              :class="statusPill.className"
            >{{ statusPill.label }}</span>
          </div>
          <div class="big">
            <template v-if="loading">
              載入中...
            </template>
            <template v-else-if="data && data.lastAuto">
              {{ formatDate(data.lastAuto.uploaded) }}<small>{{ formatBytes(data.lastAuto.size) }}</small>
            </template>
            <template v-else>
              尚未有自動備份記錄
            </template>
          </div>
          <div
            v-if="policy"
            class="hint"
          >
            {{ scheduleText }}
          </div>
        </div>
        <div class="status-act">
          <button
            type="button"
            class="btn btn-primary btn-lg"
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
        <p
          v-if="message"
          class="message"
          :class="messageType"
          role="status"
        >
          {{ message }}
        </p>
      </article>

      <article
        v-if="policy"
        class="ui-card keep-card"
        aria-label="保留期限"
      >
        <h2 class="keep-title">
          保留期限
          <span class="keep-tag">設定值</span>
        </h2>
        <dl class="keep-list">
          <div
            v-for="row in retentionRows"
            :key="row.key"
          >
            <dt>{{ row.label }}</dt>
            <dd>{{ row.days }} 天</dd>
          </div>
        </dl>
      </article>
    </section>

    <!-- Retention strip: one cell per day, bar height = that day's total size -->
    <article
      v-if="data"
      class="ui-card strip-card"
    >
      <div class="ui-card-head">
        <div>
          <h2 class="ui-card-title">
            近 {{ strip.length }} 天備份
          </h2>
          <div class="ui-card-sub">
            {{ stripSummary }}
          </div>
        </div>
        <div
          v-if="dayFilter"
          class="ui-card-end"
        >
          <button
            type="button"
            class="ui-chip"
            @click="dayFilter = ''"
          >
            {{ dayFilterLabel }} ✕
          </button>
        </div>
      </div>
      <ol
        class="strip"
        aria-label="每日備份狀態，點選可只看該日"
      >
        <li
          v-for="cell in strip"
          :key="cell.key"
        >
          <button
            type="button"
            class="cell"
            :class="{ has: cell.count > 0, on: dayFilter === cell.key }"
            :aria-pressed="dayFilter === cell.key"
            :aria-label="cell.aria"
            :disabled="cell.count === 0"
            @click="dayFilter = dayFilter === cell.key ? '' : cell.key"
          >
            <span class="bar">
              <i :style="{ height: cell.height + '%' }" />
            </span>
            <span class="num">{{ cell.day }}</span>
          </button>
        </li>
      </ol>
    </article>

    <article class="ui-card list-card">
      <div class="ui-card-head">
        <div>
          <h2 class="ui-card-title">
            備份檔案
          </h2>
          <div class="ui-card-sub">
            <template v-if="data">
              共 {{ data.count.toLocaleString() }} 份，依日期分組、新到舊
            </template>
            <template v-else>
              &nbsp;
            </template>
          </div>
        </div>
        <div class="ui-card-end">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="loading"
            @click="load"
          >
            重新整理
          </button>
        </div>
      </div>

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
          <section
            v-for="group in groups"
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
    </article>
  </div>
</template>

<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiPageHead from '@/components/ui/UiPageHead.vue'
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
const TIER_ORDER = ['manual', 'daily', 'monthly', 'members', 'tags', 'assignments']
const RETENTION_LABELS: Record<string, string> = {
  daily: '每日備份保留',
  monthly: '每月備份保留',
  manual: '手動備份保留',
  members: '人員備份保留',
  tags: '標籤備份保留',
  assignments: '指派備份保留'
}

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
  height: number
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

const retentionRows = computed(() => {
  const p = policy.value
  if (!p) {
    return []
  }
  return (Object.keys(RETENTION_LABELS) as Array<keyof typeof p.retentionDays>)
    .filter(key => typeof p.retentionDays[key] === 'number')
    .map(key => ({ key, label: (RETENTION_LABELS[key] ?? key).replace('保留', ''), days: p.retentionDays[key] }))
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
  const max = Math.max(1, ...Array.from(perDay.values()).map(entry => entry.size))
  const cells: StripCell[] = []
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    const key = dayKey(d)
    const entry = perDay.get(key)
    const count = entry?.count ?? 0
    const size = entry?.size ?? 0
    cells.push({
      key,
      day: Number(key.slice(8, 10)),
      count,
      size,
      height: size > 0 ? Math.max(18, Math.round((size / max) * 100)) : 0,
      aria: entry ? `${dayLabel(d)} ${dayDate(d)}，${count} 份，${formatBytes(size)}` : `${dayDate(d)}，沒有備份`
    })
  }
  return cells
})

const stripSummary = computed(() => {
  const cells = strip.value
  const have = cells.filter(cell => cell.count > 0).length
  const missing = cells.length - have
  return missing === 0 ? `每天都有備份，共 ${cells.length} 天` : `${cells.length} 天中有 ${have} 天有備份，${missing} 天沒有`
})

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
.top-row {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.status-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 24px;
}

.status-ico {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.status-ico.ok {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.status-ico.warn {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.status-ico svg {
  width: 28px;
  height: 28px;
}

.status-act {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.act-note {
  font-size: 12.5px;
  color: var(--ui-muted);
}

.btn-ico {
  width: 16px;
  height: 16px;
}

.lbl {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.big {
  margin-top: 2px;
  font: 600 24px / 1.25 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.big small {
  margin-left: 8px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-muted);
}

.hint {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ui-muted);
}

.message {
  grid-column: 1 / -1;
  margin: 0;
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

/* Retention policy: configuration constants, listed as a compact two-column key/value block */
.keep-card {
  padding: 20px 22px;
}

.keep-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 10px;
  font: 600 var(--ui-t-title) / 1.25 var(--ui-font-display);
}

.keep-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ui-fill);
  font: 500 12px var(--ui-font-ui);
  color: var(--ui-muted);
}

.keep-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 24px;
  margin: 0;
}

.keep-list > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 0;
  font-size: 13.5px;
  box-shadow: 0 0.5px 0 var(--ui-sep);
}

.keep-list dt {
  color: var(--ui-muted);
}

.keep-list dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Day strip */
.strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  grid-auto-flow: column;
  gap: 6px;
  margin: 0;
  padding: 4px 22px 20px;
  list-style: none;
}

.cell {
  display: grid;
  width: 100%;
  gap: 6px;
  justify-items: center;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ui-muted);
  font: inherit;
  cursor: pointer;
}

.cell:disabled {
  cursor: default;
}

.bar {
  position: relative;
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 64px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ui-fill);
}

.cell:not(.has) .bar {
  background: none;
  box-shadow: inset 0 0 0 1.5px var(--ui-fill-strong);
}

.bar i {
  display: block;
  width: 100%;
  border-radius: 6px 6px 0 0;
  background: color-mix(in srgb, var(--ui-green) 70%, var(--ui-surface));
  transition: background var(--ui-dur) var(--ui-ease);
}

.cell.has:hover .bar i,
.cell.on .bar i {
  background: var(--ui-accent);
}

.cell.on .bar {
  box-shadow: 0 0 0 2px var(--ui-accent);
}

.cell:focus-visible .bar {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.num {
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.cell.on .num {
  font-weight: 700;
  color: var(--ui-accent);
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

/* Days are cards flowing in two columns; each owns its date, so every file sits under a visible day */
.day-groups {
  columns: 2;
  column-gap: 16px;
  padding: 0 22px 8px;
}

.day {
  break-inside: avoid;
  margin-bottom: 16px;
  padding: 4px 14px 6px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
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
  font-size: 12.5px;
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
  font-size: 12px;
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
  .top-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .day-groups {
    columns: 1;
  }
}

@media (max-width: 768px) {
  .status-card {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 18px 16px;
  }

  .status-act {
    grid-column: 1 / -1;
  }

  .status-act .btn {
    width: 100%;
    justify-content: center;
  }

  .strip {
    grid-auto-flow: row;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 8px 4px;
    padding: 4px 16px 18px;
  }

  .bar {
    height: 40px;
  }

  .chips,
  .day-groups {
    padding-right: 16px;
    padding-left: 16px;
  }

  .keep-list {
    gap: 2px 16px;
  }
}
</style>
