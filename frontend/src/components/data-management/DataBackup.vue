<template>
  <div class="ui-page data-backup">
    <UiPageHead
      title="資料備份"
      subtitle="整個資料庫備份在雲端儲存（Cloudflare R2），可隨時下載備份檔。"
    />

    <!-- Automatic backup status -->
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
      <p
        v-if="message"
        class="message"
        :class="messageType"
        role="status"
      >
        {{ message }}
      </p>
    </article>

    <article class="ui-card list-card">
      <div class="ui-card-head">
        <div>
          <h2 class="ui-card-title">
            最近備份
          </h2>
          <div class="ui-card-sub">
            <template v-if="data">
              共 {{ data.count.toLocaleString() }} 份，依時間由新到舊
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

      <p
        v-if="policySummary"
        class="policy-line"
        :title="policyDetail"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        ><circle
          cx="12"
          cy="12"
          r="9"
        /><path d="M12 8v5M12 16.5h.01" /></svg>
        <span>{{ policySummary }}</span>
      </p>

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
        <section
          v-for="group in groups"
          :key="group.key"
          class="day"
        >
          <h3 class="day-head">
            {{ group.label }}<span>{{ group.items.length }} 份</span>
          </h3>
          <ul class="brow-list">
            <li
              v-for="item in group.items"
              :key="item.key"
              class="brow"
            >
              <span
                class="tier-dot"
                :class="tierTone(item.tier)"
                aria-hidden="true"
              />
              <div class="brow-main">
                <div class="brow-title">
                  {{ itemLabel(item) }}
                </div>
                <div
                  class="brow-file"
                  :title="fileName(item.key)"
                >
                  {{ fileName(item.key) }}
                </div>
                <div class="brow-meta">
                  {{ formatClock(item.uploaded) }} · {{ formatBytes(item.size) }}
                </div>
              </div>
              <span class="brow-time">{{ formatClock(item.uploaded) }}</span>
              <span class="brow-size">{{ formatBytes(item.size) }}</span>
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

const PAGE_SIZE = 20
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

interface BackupGroup {
  key: string
  label: string
  items: BackupItem[]
}

function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier)
  return index === -1 ? TIER_ORDER.length : index
}

const tierLabel = (t: string) => TIER_LABELS[t] || t
const fileName = (key: string) => key.split('/').pop() || key

function tierTone(tier: string): string {
  if (tier === 'manual') {
    return 'blue'
  }
  if (tier === 'monthly') {
    return 'orange'
  }
  if (tier === 'members' || tier === 'tags' || tier === 'assignments') {
    return 'green'
  }
  return 'grey'
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

/** One line above the list: schedule and the retention that matters most. Full list in the tooltip. */
const policySummary = computed(() => {
  const p = policy.value
  if (!p) {
    return ''
  }
  const k = p.retentionDays
  return `保留期限：每日備份 ${k.daily} 天 · 每月備份 ${k.monthly} 天 · 手動備份 ${k.manual} 天（設定值）`
})

const policyDetail = computed(() => {
  const p = policy.value
  if (!p) {
    return ''
  }
  const rules = (Object.keys(RETENTION_LABELS) as Array<keyof typeof p.retentionDays>)
    .filter(key => typeof p.retentionDays[key] === 'number')
    .map(key => `${RETENTION_LABELS[key]} ${p.retentionDays[key]} 天`)
  return `${rules.join('、')}。排程與保留天數為系統設定值，不是即時讀數；人員、標籤、指派為各自獨立的備份檔。`
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
  return [...filtered].sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())
})

const shownItems = computed(() => visibleItems.value.slice(0, showCount.value))

const groups = computed<BackupGroup[]>(() => {
  const out: BackupGroup[] = []
  for (const item of shownItems.value) {
    const key = dayKey(new Date(item.uploaded))
    const last = out[out.length - 1]
    if (last && last.key === key) {
      last.items.push(item)
    } else {
      out.push({ key, label: dayLabel(new Date(item.uploaded)), items: [item] })
    }
  }
  return out
})

function dayLabel(d: Date): string {
  const md = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, month: 'numeric', day: 'numeric' }).format(d)
  const weekday = new Intl.DateTimeFormat('zh-TW', { timeZone: TAIPEI, weekday: 'short' }).format(d)
  const today = new Date()
  if (dayKey(d) === dayKey(today)) {
    return `今天 · ${md}`
  }
  if (dayKey(d) === dayKey(new Date(today.getTime() - 24 * 3600 * 1000))) {
    return `昨天 · ${md}`
  }
  return `${md} ${weekday}`
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

.status-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 22px;
}

.status-ico {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 17px;
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
  width: 26px;
  height: 26px;
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
  font: 600 22px / 1.25 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.big small {
  margin-left: 6px;
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 22px 12px;
}

.chip-n {
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
}

/* On the selected (accent wash) chip the count follows the chip ink */
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

.policy-line {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  padding: 0 22px 12px;
  font-size: 13px;
  color: var(--ui-muted);
}

.policy-line svg {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--ui-faint);
}

.day-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  padding: 8px 22px;
  background: var(--ui-glass);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
  box-shadow: inset 0 0.5px 0 var(--ui-sep), inset 0 -0.5px 0 var(--ui-sep);
}

.day-head span {
  font-weight: 500;
  color: var(--ui-muted);
}

.brow-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.brow {
  position: relative;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 64px 84px 40px;
  gap: 14px;
  align-items: center;
  min-height: 60px;
  padding: 8px 22px;
}

.brow + .brow::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 46px;
  height: 0.5px;
  background: var(--ui-sep);
}

.tier-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.tier-dot.blue {
  background: var(--ui-accent);
}

.tier-dot.orange {
  background: var(--ui-orange);
}

.tier-dot.green {
  background: var(--ui-green);
}

.brow-title {
  font-size: 14.5px;
  font-weight: 500;
}

.brow-file {
  overflow: hidden;
  font: 12px / 1.4 var(--ui-font-mono);
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brow-meta {
  display: none;
  font-size: 13px;
  color: var(--ui-muted);
}

.brow-time,
.brow-size {
  font-size: 13px;
  color: var(--ui-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.brow-dl {
  width: 40px;
  padding: 0;
}

.brow-dl svg {
  width: 18px;
  height: 18px;
}

.more {
  display: flex;
  justify-content: center;
  padding: 14px;
}

@media (max-width: 768px) {
  .status-card {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 18px 16px;
  }

  .status-card .btn {
    grid-column: span 2;
  }

  .chips,
  .policy-line,
  .day-head {
    padding-right: 16px;
    padding-left: 16px;
  }

  /* Two-line rows: what, then when and how big; the file name stays on desktop */
  .brow {
    grid-template-columns: 10px minmax(0, 1fr) 40px;
    gap: 12px;
    padding: 8px 12px 8px 16px;
  }

  .brow + .brow::before {
    right: 16px;
    left: 38px;
  }

  .brow-file,
  .brow-time,
  .brow-size {
    display: none;
  }

  .brow-meta {
    display: block;
  }
}
</style>
