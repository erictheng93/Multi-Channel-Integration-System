<template>
  <div class="data-backup">
    <header class="ui-page-head">
      <div>
        <div class="ui-eyebrow">
          資料 · 僅限管理員
        </div>
        <h1 class="ui-page-title">
          資料備份
        </h1>
        <p class="ui-page-sub">
          整個資料庫備份在雲端儲存（Cloudflare R2），可隨時下載備份檔。
        </p>
        <DataSubnav />
      </div>
    </header>

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

    <section class="bento">
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

        <div
          v-if="loading && !data"
          class="ui-empty"
        >
          <p>載入中...</p>
        </div>
        <div
          v-else-if="!data"
          class="ui-empty"
        >
          <h3>無法載入備份列表</h3>
          <p>{{ loadError || '請稍後再試。' }}</p>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="load"
          >
            重試
          </button>
        </div>
        <div
          v-else-if="visibleItems.length === 0"
          class="ui-empty"
        >
          <h3>尚無備份檔</h3>
          <p>按「立即備份到雲端」建立第一份備份。</p>
        </div>
        <template v-else>
          <div class="ui-table-wrap">
            <table class="ui-table">
              <thead>
                <tr>
                  <th>類型</th>
                  <th>檔案</th>
                  <th class="hide-s">
                    備份時間
                  </th>
                  <th class="num hide-s">
                    大小
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in shownItems"
                  :key="item.key"
                >
                  <td>
                    <span
                      class="ui-pill tier"
                      :class="tierPill(item.tier)"
                    >{{ tierLabel(item.tier) }}</span>
                  </td>
                  <td class="file">
                    <span
                      class="fn"
                      :title="fileName(item.key)"
                    >{{ fileName(item.key) }}</span>
                  </td>
                  <td class="hide-s">
                    {{ formatDate(item.uploaded) }}
                  </td>
                  <td class="num hide-s">
                    {{ formatBytes(item.size) }}
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      :disabled="downloadingKey === item.key"
                      @click="onDownload(item)"
                    >
                      {{ downloadingKey === item.key ? '下載中...' : '下載' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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

      <aside
        v-if="policy"
        class="ui-card policy-card"
      >
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title">
              保留政策
            </h2>
            <div class="ui-card-sub">
              設定值，超過期限的備份會自動清除
            </div>
          </div>
        </div>
        <div class="rule">
          <span>排程時間</span><b>每日 {{ policy.schedule.localTime }}</b>
        </div>
        <div
          v-for="rule in retentionRules"
          :key="rule.key"
          class="rule"
        >
          <span>{{ rule.label }}</span><b>{{ rule.days }} 天</b>
        </div>
        <div class="rule">
          <span>儲存位置</span><b>Cloudflare R2</b>
        </div>
        <div class="note">
          排程與保留天數為系統設定值，不是即時讀數。列表中的「人員」「標籤」「指派」為各自獨立的備份檔，可分別下載。
        </div>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listBackups, runBackup, downloadBackup, type BackupItem, type BackupList } from '@/api/backup'
import DataSubnav from '@/components/data-management/DataSubnav.vue'

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
  const keep = p.retentionDays
  return `每日 ${p.schedule.localTime}（${zone}）自動執行 · 保留：每日 ${keep.daily} 天 / 每月 ${keep.monthly} 天`
})

const retentionRules = computed(() => {
  const p = policy.value
  if (!p) {
    return []
  }
  return (Object.keys(RETENTION_LABELS) as Array<keyof typeof p.retentionDays>)
    .filter(key => typeof p.retentionDays[key] === 'number')
    .map(key => ({ key, label: RETENTION_LABELS[key] ?? key, days: p.retentionDays[key] }))
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
  return tierFilter.value === 'all' ? items : items.filter(item => item.tier === tierFilter.value)
})

const shownItems = computed(() => visibleItems.value.slice(0, showCount.value))

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
.data-backup {
  /* width: 100% — .page-content is a flex column, so with margin: 0 auto this would size to
     its content and overflow (clipped) on narrow screens */
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

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
  font-size: 12.5px;
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

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.list-card {
  grid-column: span 8;
}

.policy-card {
  grid-column: span 4;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 22px 12px;
}

.chip-n {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}

.warn {
  margin: 0 22px 12px;
  padding: 10px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-orange-soft);
  font-size: 13px;
  color: var(--ui-orange-ink);
}

.tier {
  justify-content: center;
  min-width: 48px;
}

.ui-table td {
  white-space: nowrap;
}

.ui-table td.file {
  width: 100%;
  max-width: 0;
  font-family: var(--ui-font-mono);
  font-size: 12.5px;
}

.fn {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-table th.num,
.ui-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.more {
  display: flex;
  justify-content: center;
  padding: 14px;
}

.rule {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 22px;
  font-size: 13.5px;
}

.rule + .rule::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.rule b {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.rule span {
  color: var(--ui-muted);
}

.note {
  margin: 4px 22px 20px;
  padding: 12px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  font-size: 12.5px;
  color: var(--ui-muted);
}

@media (max-width: 1280px) {
  .list-card,
  .policy-card {
    grid-column: span 12;
  }
}

@media (max-width: 768px) {
  .status-card {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 18px 16px;
  }

  .status-card .btn {
    grid-column: span 2;
  }

  .hide-s {
    display: none;
  }

  .chips {
    padding: 0 16px 12px;
  }

  .ui-table th:first-child,
  .ui-table td:first-child {
    padding-left: 16px;
  }

  .ui-table th:last-child,
  .ui-table td:last-child {
    padding-right: 16px;
  }

  .rule {
    padding: 12px 16px;
  }

  .rule + .rule::before {
    right: 16px;
    left: 16px;
  }

  .note {
    margin: 4px 16px 18px;
  }
}
</style>
