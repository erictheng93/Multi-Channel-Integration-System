<!-- 匯出對話記錄 - 資料管理子頁面 -->
<!-- Format, scope filters (date, customer, agent) and a live match count on one page; the conversation list keeps its own export dialog -->

<template>
  <div class="ui-page rl-page data-export">
    <UiPageHead
      title="匯出對話"
      :subtitle="`選擇格式與範圍後匯出，單次最多 ${EXPORT_LIMIT.toLocaleString()} 筆。`"
    />
    <UiSectionNav section="data" />


    <section
      class="ui-lead ex-result"
      :class="{ 'is-over': willTruncate }"
      aria-label="匯出筆數"
    >
      <div
        class="res-count foot-count"
        role="status"
      >
        <template v-if="count === null">
          <p class="res-label">
            將匯出
          </p>
          <p class="res-wait">
            正在計算符合條件的筆數…
          </p>
        </template>
        <template v-else>
          <p class="res-label">
            {{ willTruncate ? '本次只會匯出' : '將匯出' }}
            <span
              v-if="willTruncate"
              class="ui-pill ui-pill-orange"
            >超過上限</span>
          </p>
          <p class="res-num">
            {{ exportCount.toLocaleString() }}<span> 筆</span>
          </p>
        </template>
      </div>

      <div
        class="res-gauge"
        role="img"
        :aria-label="gaugeLabel"
      >
        <div class="g-track">
          <i
            v-if="totalAll !== null"
            class="g-all"
            :style="{ width: gaugePct(totalAll) }"
          />
          <i
            v-if="count !== null"
            class="g-pick"
            :style="{ width: gaugePct(exportCount) }"
          />
          <i
            v-if="count !== null && willTruncate"
            class="g-over"
            :style="{ left: gaugePct(EXPORT_LIMIT), width: gaugePct(count.count - EXPORT_LIMIT) }"
          />
          <span
            class="g-limit"
            :style="{ left: gaugePct(EXPORT_LIMIT) }"
          />
        </div>
        <p class="g-cap">
          <span v-if="count !== null"><i class="k-pick" />這份檔案 <b>{{ exportCount.toLocaleString() }}</b> 筆<template v-if="sharePct"> ，佔全部 {{ sharePct }}</template></span>
          <span><i class="k-limit" />單次上限 <b>{{ EXPORT_LIMIT.toLocaleString() }}</b> 筆</span>
          <span v-if="totalAll !== null"><i class="k-all" />全部對話 <b>{{ totalAll.toLocaleString() }}</b> 筆</span>
        </p>
        <p
          v-if="willTruncate && count"
          class="res-warn"
        >
          另有 {{ (count.count - EXPORT_LIMIT).toLocaleString() }} 筆不會匯出，縮小期間或指定客戶就能完整匯出。
        </p>
      </div>

      <div class="res-cta">
        <button
          type="button"
          class="btn btn-primary lead-cta"
          :aria-busy="exporting"
          @click="runExport"
        >
          <DownloadIcon :size="16" />
          {{ exporting ? '匯出中…' : `開始匯出 ${selectedName}` }}
        </button>
        <p class="res-file">
          {{ fileName }}
        </p>
      </div>
    </section>

    <div class="ex-grid">
      <form
        class="ui-card ex-scope"
        aria-label="匯出範圍"
        @submit.prevent="runExport"
      >
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title">
              匯出範圍
            </h2>
            <p class="ui-card-sub">
              不選就是全部，下方筆數會即時更新
            </p>
          </div>
        </div>
        <div class="scope-grid">
          <div class="ui-field scope-period">
            <span
              id="ex-period-label"
              class="field-label"
            >期間</span>
            <div
              class="ui-seg period-seg"
              role="group"
              aria-labelledby="ex-period-label"
            >
              <button
                v-for="option in periods"
                :key="option.id"
                type="button"
                :aria-pressed="period === option.id"
                @click="pickPeriod(option.id)"
              >
                {{ option.label }}
              </button>
            </div>
            <p
              v-if="period !== 'custom'"
              class="period-note"
            >
              {{ periodNote }}
            </p>
          </div>
          <div
            v-show="period === 'custom'"
            class="ui-field"
          >
            <label for="ex-from">起始日期</label>
            <input
              id="ex-from"
              v-model="filters.dateFrom"
              type="date"
              class="ui-input"
              :max="filters.dateTo || undefined"
            >
          </div>
          <div
            v-show="period === 'custom'"
            class="ui-field"
          >
            <label for="ex-to">結束日期</label>
            <input
              id="ex-to"
              v-model="filters.dateTo"
              type="date"
              class="ui-input"
              :min="filters.dateFrom || undefined"
            >
          </div>
          <div class="ui-field">
            <label for="ex-customer">客戶</label>
            <select
              id="ex-customer"
              v-model="filters.customerId"
              class="ui-select"
            >
              <option value="">
                全部客戶
              </option>
              <option
                v-for="customer in customers"
                :key="customer.id"
                :value="String(customer.id)"
              >
                {{ customer.displayName || '未知用戶' }}
              </option>
            </select>
          </div>
          <div class="ui-field">
            <label for="ex-agent">客服人員</label>
            <select
              id="ex-agent"
              v-model="filters.agentId"
              class="ui-select"
            >
              <option value="">
                全部客服
              </option>
              <option
                v-for="agent in agents"
                :key="agent.id"
                :value="agent.id"
              >
                {{ agent.displayName || '未知客服' }}
              </option>
            </select>
          </div>
        </div>
        <ul class="scope-rules">
          <li>僅含你有權限查看的對話</li>
          <li>已收回的訊息不匯出</li>
          <li>單次最多 {{ EXPORT_LIMIT.toLocaleString() }} 筆，超過的部分不會匯出</li>
        </ul>
      </form>
      <section
        class="ui-card ex-pick"
        aria-label="選擇格式"
      >
        <div class="ui-card-head">
          <div>
            <h2 class="ui-card-title">
              檔案格式與內容
            </h2>
            <p class="ui-card-sub">
              選格式，下方就是檔案裡會有的欄位
            </p>
          </div>
        </div>
        <div
          class="ui-seg fmt-seg"
          role="group"
          aria-label="匯出格式"
        >
          <button
            v-for="format in formats"
            :key="format.id"
            type="button"
            :aria-pressed="selectedFormat === format.id"
            @click="selectFormat(format.id)"
          >
            {{ format.name }}
          </button>
        </div>
        <div
          class="fmt-sheet"
          aria-live="polite"
        >
          <p class="fmt-title">
            <b>{{ current.name }}</b>
            <span>{{ current.tagline }}，{{ selectedUnit }}</span>
          </p>
          <p class="fmt-use">
            適合：{{ current.usecases.join('、') }}
          </p>
          <code class="sheet-shape">{{ shape }}</code>
          <dl class="sheet-rows">
            <div
              v-for="row in selectedRows"
              :key="row.note"
              class="sheet-row"
            >
              <dt v-if="row.key">
                {{ row.key }}
              </dt>
              <dd :class="{ 'is-wide': !row.key }">
                {{ row.note }}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>

    <UiActionBar
      class="export-actions"
      label="匯出"
    >
      <p
        class="bar-count"
        :class="{ 'is-over': willTruncate }"
        role="status"
      >
        {{ barCount }}
      </p>
      <button
        type="button"
        class="btn btn-primary"
        :aria-busy="exporting"
        @click="runExport"
      >
        <DownloadIcon :size="16" />
        {{ exporting ? '匯出中…' : `開始匯出 ${selectedName}` }}
      </button>
    </UiActionBar>
  </div>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import UiActionBar from '@/components/ui/UiActionBar.vue'
import { DownloadIcon } from '@/components/icons'
import { useToast } from '@/composables/useToast'
import {
  exportMessages,
  fetchExportData,
  getExportAgents,
  getExportCount,
  getExportCustomers,
  type ExportAgentOption,
  type ExportCountResult,
  type ExportCustomerOption,
  type ExportFilters
} from '@/api/export'
import { generatePdfExport } from '@/services/pdfExportService'


type FormatId = 'json' | 'csv' | 'txt' | 'pdf'

/** Server-side cap per export (see the backend export handler); the dialog warns about it too. */
const EXPORT_LIMIT = 5000

const selectedFormat = ref<FormatId>('json')
type Row = { key?: string; note: string }

const formats: Array<{
  id: FormatId
  name: string
  tagline: string
  icon: string
  tone: string
  unit: string
  shape: string
  usecases: string[]
  rows: Row[]
}> = [
  {
    id: 'json',
    name: 'JSON',
    tagline: '結構化資料',
    icon: '{ }',
    tone: 'blue',
    unit: '一則訊息一筆物件',
    shape: '{ "exportInfo": {…}, "messages": [ {…}, {…} ] }',
    usecases: ['API 整合', '資料分析', '系統備份'],
    rows: [
      { key: 'id', note: '訊息編號' },
      { key: 'conversationId', note: '對話編號' },
      { key: 'senderType', note: '寄件者類型' },
      { key: 'senderName', note: '寄件者名稱' },
      { key: 'content', note: '訊息內容' },
      { key: 'messageType', note: '訊息類型' },
      { key: 'sentAt', note: '傳送時間' },
      { note: '傳送狀態、建立時間、附加資料（metadata）' },
      { note: '檔頭另含匯出資訊：時間、匯出者、篩選條件' }
    ]
  },
  {
    id: 'csv',
    name: 'CSV',
    tagline: '試算表格式',
    icon: 'CSV',
    tone: 'green',
    unit: '一則訊息一列',
    shape: 'Message ID,Conversation ID,Sender Type,Sender Name,Content,…',
    usecases: ['Excel 報表', '統計分析', '團隊共享'],
    rows: [
      { key: 'Message ID', note: '訊息編號' },
      { key: 'Conversation ID', note: '對話編號' },
      { key: 'Sender Type', note: '寄件者類型' },
      { key: 'Sender Name', note: '寄件者名稱' },
      { key: 'Content', note: '訊息內容' },
      { note: '訊息類型、傳送時間、傳送狀態、建立時間' }
    ]
  },
  {
    id: 'txt',
    name: 'TXT',
    tagline: '純文字聊天記錄',
    icon: 'TXT',
    tone: 'lavender',
    unit: '一則訊息一行',
    shape: '[時間] 寄件者: 內容',
    usecases: ['直接閱讀', '品質審查', '列印備份'],
    rows: [
      { key: '[時間] 寄件者: 內容', note: '每則訊息一行' },
      { note: '檔頭：匯出時間、總筆數、使用的篩選條件' },
      { note: '依對話分組，組內依時間由舊到新' }
    ]
  },
  {
    id: 'pdf',
    name: 'PDF',
    tagline: '可攜式報告',
    icon: 'PDF',
    tone: 'red',
    unit: '依對話分組排版',
    shape: '標題 → 匯出資訊 → 篩選條件 → 依對話分組的訊息',
    usecases: ['列印報告', '正式存檔', '對外分享'],
    rows: [
      { note: '標題與匯出資訊' },
      { note: '使用的篩選條件' },
      { note: '依對話分組的訊息內容' },
      { note: '在瀏覽器內依 JSON 資料排版產生' }
    ]
  }
]

const current = computed(() => formats.find(f => f.id === selectedFormat.value) ?? formats[0])
const selectedRows = computed(() => current.value?.rows ?? [])
const selectedUnit = computed(() => current.value?.unit ?? '')
const selectedName = computed(() => current.value?.name ?? '')
const shape = computed(() => current.value?.shape ?? '')
const fileName = computed(() => `chat_export_${new Date().toISOString().slice(0, 10)}.${selectedFormat.value}`)

function selectFormat(format: FormatId) {
  selectedFormat.value = format
}

// --- scope filters (the same ones the conversation list export offers) ---
const filters = reactive({ dateFrom: '', dateTo: '', customerId: '', agentId: '' })
const customers = ref<ExportCustomerOption[]>([])
const agents = ref<ExportAgentOption[]>([])
const count = ref<ExportCountResult | null>(null)
/** Everything the signed-in agent could export (no filters), the scale the file is drawn against */
const totalAll = ref<number | null>(null)
const exporting = ref(false)
const willTruncate = computed(() => !!count.value?.willBeTruncated)
/** What the file will really hold: the match count, capped at the server limit */
const exportCount = computed(() => Math.min(count.value?.count ?? 0, EXPORT_LIMIT))
const barCount = computed(() => {
  if (count.value === null) { return '計算筆數中…' }
  return willTruncate.value
    ? `${EXPORT_LIMIT.toLocaleString()} 筆，超過上限`
    : `${count.value.count.toLocaleString()} 筆`
})

// The bar runs from 0 to the largest of: the whole archive, this match, the server cap
const gaugeScale = computed(() => Math.max(totalAll.value ?? 0, count.value?.count ?? 0, EXPORT_LIMIT))
const gaugePct = (n: number): string => `${Math.min(100, (Math.max(n, 0) / gaugeScale.value) * 100)}%`
const sharePct = computed(() => {
  if (count.value === null || !totalAll.value) { return '' }
  const pct = (exportCount.value / totalAll.value) * 100
  return pct > 0 && pct < 1 ? '不到 1%' : `${Math.round(pct)}%`
})
const gaugeLabel = computed(() =>
  count.value === null ? '計算筆數中' : `這份檔案 ${exportCount.value.toLocaleString()} 筆，${totalAll.value !== null ? `全部對話 ${totalAll.value.toLocaleString()} 筆，` : ''}單次上限 ${EXPORT_LIMIT.toLocaleString()} 筆`
)

// Period presets set the two dates; the raw date inputs only show for 自訂
type PeriodId = 'all' | 'd7' | 'd30' | 'custom'
const periods: Array<{ id: PeriodId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'd7', label: '近 7 天' },
  { id: 'd30', label: '近 30 天' },
  { id: 'custom', label: '自訂' }
]
const period = ref<PeriodId>('d30')
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const mdLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
const spanDays = (id: PeriodId) => (id === 'd7' ? 6 : id === 'd30' ? 29 : -1)
const periodNote = computed(() => {
  const days = spanDays(period.value)
  if (days < 0) { return '不限日期，匯出所有符合的訊息' }
  const from = new Date()
  from.setDate(from.getDate() - days)
  return `${mdLabel(from)} 至 ${mdLabel(new Date())}（含今天）`
})
function pickPeriod(id: PeriodId) {
  period.value = id
  if (id === 'custom') { return }
  const days = spanDays(id)
  if (days < 0) {
    filters.dateFrom = ''
    filters.dateTo = ''
    return
  }
  const from = new Date()
  from.setDate(from.getDate() - days)
  filters.dateFrom = ymd(from)
  filters.dateTo = ymd(new Date())
}
pickPeriod('d30') // start from a valid range (the last 30 days) instead of an over-limit 'all'
const { showSuccess, showError } = useToast()

/** Date inputs are whole days: the range runs from 00:00 of the first day to the end of the last (local time) */
function buildFilters(): ExportFilters {
  return {
    format: selectedFormat.value,
    dateFrom: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).toISOString() : undefined,
    dateTo: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).toISOString() : undefined,
    customerId: filters.customerId || undefined,
    agentId: filters.agentId || undefined
  }
}

let countTimer: ReturnType<typeof setTimeout> | undefined
let countToken = 0
function refreshCount() {
  clearTimeout(countTimer)
  count.value = null
  const mine = ++countToken
  countTimer = setTimeout(async () => {
    try {
      const result = await getExportCount(buildFilters())
      if (mine === countToken && result.success && result.data) { count.value = result.data }
    } catch {
      /* the count is a hint; the export itself still works */
    }
  }, 250)
}
watch(filters, refreshCount)

onMounted(async () => {
  refreshCount()
  try {
    const all = await getExportCount({ format: selectedFormat.value })
    totalAll.value = all.success && all.data ? all.data.count : null
  } catch { totalAll.value = null }
  try {
    const result = await getExportCustomers()
    customers.value = result.success && result.data ? result.data : []
  } catch { customers.value = [] }
  try {
    const result = await getExportAgents()
    agents.value = result.success && result.data ? result.data : []
  } catch { agents.value = [] }
})

async function runExport() {
  if (exporting.value) { return }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    showError('日期範圍不正確', '結束日期不能早於起始日期')
    return
  }
  exporting.value = true
  try {
    let blob: Blob
    if (selectedFormat.value === 'pdf') {
      const data = await fetchExportData(buildFilters())
      if (!data.success || !data.data) {
        showError('匯出失敗', data.error || '無法取得匯出資料')
        return
      }
      blob = await generatePdfExport(data.data, { title: '對話記錄匯出報告' })
    } else {
      const result = await exportMessages(buildFilters())
      if (!result.success || !result.data) {
        showError('匯出失敗', result.error || '無法匯出對話記錄')
        return
      }
      blob = result.data
    }
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.value
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    showSuccess('匯出成功', '對話記錄已開始下載')
  } catch {
    showError('匯出失敗', '匯出過程中發生錯誤，請稍後再試')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.ex-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
  align-items: stretch;
}

.ex-pick {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.fmt-seg {
  display: flex;
  margin: 4px 22px 0;
}

.fmt-seg > button {
  flex: 1 1 0;
  justify-content: center;
}

.fmt-sheet {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  padding: 18px 22px 20px;
}

.fmt-title {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  align-items: baseline;
  margin: 0;
}

.fmt-title b {
  font: 600 22px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.fmt-title span {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.fmt-use {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.sheet-shape {
  display: block;
  margin: 0 0 6px;
  padding: 12px 14px;
  overflow-wrap: anywhere;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  font: 500 13px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink);
}

.sheet-rows {
  display: grid;
  margin: 0;
  padding: 0;
}

.sheet-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 12px;
  padding: 5px 2px;
  font-size: 14px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.sheet-row:first-child {
  box-shadow: none;
}

.sheet-row dt {
  min-width: 0;
  overflow-wrap: anywhere;
  font: 600 13px / 1.6 var(--ui-font-mono);
  color: var(--ui-ink);
}

.sheet-row dd {
  margin: 0;
  color: var(--ui-ink-2);
}

.sheet-row dd.is-wide {
  grid-column: 1 / -1;
  color: var(--ui-ink-2);
}

.ex-scope {
  display: flex;
  flex-direction: column;
  padding-bottom: 22px;
}

.scope-rules {
  display: grid;
  margin: auto 22px 0;
  padding: 0 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  list-style: none;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.scope-rules li {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 10px 0;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.scope-rules li:first-child {
  box-shadow: none;
}

.scope-rules li::before {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-accent);
  content: '';
}

.scope-grid {
  margin-bottom: 24px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 30px 16px;
  padding: 8px 22px 0;
}

.ex-result {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px 48px;
  align-items: center;
  padding: 26px 36px;
}

.res-gauge {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding-top: 8px;
}

.g-track {
  position: relative;
  height: 20px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.g-track i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
}

.g-all {
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-accent) 16%, var(--ui-surface));
}

.g-pick {
  min-width: 10px;
  border-radius: 999px;
  background: var(--ui-accent);
}

.g-over {
  border-radius: 0 999px 999px 0;
  background: color-mix(in srgb, var(--ui-orange) 45%, var(--ui-surface));
}

.g-limit {
  position: absolute;
  top: -8px;
  bottom: -8px;
  width: 0;
  border-left: 2px solid var(--ui-ink-2);
}

.g-cap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 0;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.g-cap span {
  display: flex;
  gap: 8px;
  align-items: center;
}

.g-cap b {
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.g-cap i {
  width: 12px;
  height: 8px;
  border-radius: 999px;
}

.k-pick {
  background: var(--ui-accent);
}

.g-cap .k-limit {
  width: 2px;
  height: 16px;
  border-radius: 0;
  background: var(--ui-ink-2);
}

.k-all {
  background: color-mix(in srgb, var(--ui-accent) 16%, var(--ui-surface));
}

.res-cta {
  display: grid;
  gap: 8px;
  justify-items: stretch;
}

.res-file {
  max-width: 220px;
  margin: 0;
  overflow-wrap: anywhere;
  font: 500 13px / 1.4 var(--ui-font-mono);
  text-align: center;
  color: var(--ui-muted);
}

.res-count > p {
  margin: 0;
}

.res-label {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.res-num {
  font: 700 44px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.res-num span {
  margin-left: 4px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}

.res-wait,
.res-ok {
  margin-top: 4px;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.res-warn {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--ui-orange-ink);
}

.res-warn b {
  font-weight: 600;
}

.res-scope {
  margin: -4px 0 0;
  font-size: 13px;
  color: var(--ui-ink-2);
}

.lead-cta {
  min-width: 200px;
}

.period-seg {
  display: flex;
  width: 100%;
}

.period-seg > button {
  flex: 1 1 0;
  justify-content: center;
}

.scope-period {
  grid-column: 1 / -1;
}

.period-note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ui-ink-2);
}

/* The sheet carries the CTA on larger screens; phones get the sticky action bar */
.export-actions {
  display: none;
}

.bar-count.is-over {
  color: var(--ui-orange-ink);
}

.bar-count {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink);
}

@media (max-width: 1280px) {
  .ex-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ex-result {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .res-cta {
    grid-column: 1 / -1;
    justify-items: start;
  }

  .res-file {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 768px) {
  .res-cta {
    display: none;
  }

  .res-gauge {
    padding-top: 18px;
  }

  .ex-result {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 18px 20px 20px;
  }

  .res-num {
    font-size: 36px;
  }

  .fmt-seg {
    margin: 4px 16px 0;
  }

  .fmt-sheet {
    padding: 16px 16px 18px;
  }

  .sheet-row {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 12px;
  }

  .scope-rules li {
    min-height: 48px;
  }

  .scope-grid {
    padding: 4px 16px 0;
  }

      .export-actions {
    display: flex;
  }

}
</style>
