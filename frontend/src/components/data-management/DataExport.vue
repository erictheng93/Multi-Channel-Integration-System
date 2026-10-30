<!-- 匯出對話記錄 - 資料管理子頁面 -->
<!-- Format, scope filters (date, customer, agent) and a live match count on one page; the conversation list keeps its own export dialog -->

<template>
  <div class="ui-page rl-page data-export">
    <UiPageHead
      title="匯出對話"
      :subtitle="`選擇格式與範圍後匯出，單次最多 ${EXPORT_LIMIT.toLocaleString()} 筆。`"
    />

    <div class="ex-grid">
      <div class="ex-left">
        <section
          class="ex-pick"
          aria-label="選擇格式"
        >
          <h2 class="ui-group-label">
            檔案格式
          </h2>
          <div
            class="ui-group ex-list"
            role="radiogroup"
            aria-label="匯出格式"
          >
            <button
              v-for="format in formats"
              :key="format.id"
              type="button"
              class="ex-row"
              :class="{ 'is-on': selectedFormat === format.id }"
              role="radio"
              :aria-checked="selectedFormat === format.id"
              @click="selectFormat(format.id)"
            >
              <span
                class="fmt-ico"
                :class="format.tone"
                aria-hidden="true"
              >{{ format.icon }}</span>
              <span class="ex-main">
                <b class="ex-name">{{ format.name }}<span class="ex-tag">{{ format.tagline }}</span></b>
                <span class="ex-use">{{ format.usecases.join('、') }}</span>
              </span>
              <i
                class="radio"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

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
        </form>
      </div>

      <div class="ex-right">
        <section
          class="ui-card ex-result"
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
              <div
                v-if="willTruncate"
                class="res-warn"
              >
                <b>符合條件共 {{ count.count.toLocaleString() }} 筆，其餘 {{ (count.count - EXPORT_LIMIT).toLocaleString() }} 筆不會匯出</b>
                <span>縮小期間或指定客戶，就能完整匯出。</span>
              </div>
              <p
                v-else
                class="res-ok"
              >
                符合目前條件的全部對話訊息
              </p>
            </template>
          </div>
          <p class="res-scope">
            僅含你有權限查看的對話，已收回的訊息不匯出。
          </p>
          <button
            type="button"
            class="btn btn-primary lead-cta"
            :aria-busy="exporting"
            @click="runExport"
          >
            <DownloadIcon :size="16" />
            {{ exporting ? '匯出中…' : `開始匯出 ${selectedName}` }}
          </button>
        </section>

        <section
          class="ui-lead ex-sheet"
          :aria-label="`${selectedName} 匯出設定`"
        >
          <header class="sheet-bar">
            <div>
              <h2 class="sheet-file">
                {{ selectedName }} 檔案內容
              </h2>
              <p class="sheet-name">
                {{ fileName }}
              </p>
            </div>
            <span class="sheet-unit">{{ selectedUnit }}</span>
          </header>

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
        </section>
      </div>
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

// Period presets set the two dates; the raw date inputs only show for 自訂
type PeriodId = 'all' | 'd7' | 'd30' | 'custom'
const periods: Array<{ id: PeriodId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'd7', label: '近 7 天' },
  { id: 'd30', label: '近 30 天' },
  { id: 'custom', label: '自訂' }
]
const period = ref<PeriodId>('all')
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
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 20px;
  align-items: start;
}

.ex-left {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.ex-pick {
  min-width: 0;
}

.ex-list {
  display: grid;
  gap: 4px;
  padding: 8px;
}

.ex-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 17px 16px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: transparent;
  color: var(--ui-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.ex-row:hover {
  background: var(--ui-fill);
}

.ex-row.is-on {
  background: var(--ui-sel-tint);
  box-shadow: inset 0 0 0 2px var(--ui-accent);
}

.ex-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.ex-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ex-name {
  font: 600 20px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.ex-tag {
  margin-left: 10px;
  font: 500 14px var(--ui-font-ui);
  letter-spacing: 0;
  color: var(--ui-ink-2);
}

.ex-use {
  font-size: 13px;
  color: var(--ui-muted);
}

.ex-sheet {
  display: grid;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.sheet-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  padding: 22px 28px 14px;
}

.sheet-file {
  margin: 0;
  font: 700 22px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.sheet-name {
  margin: 2px 0 0;
  font: 500 13px var(--ui-font-mono);
  color: var(--ui-muted);
}

.sheet-unit {
  align-self: start;
  padding: 4px 12px;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.sheet-shape {
  display: block;
  margin: 0 28px 8px;
  padding: 12px 18px;
  overflow-wrap: anywhere;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  font: 500 13px / 1.5 var(--ui-font-mono);
  color: var(--ui-ink);
}

.sheet-rows {
  display: grid;
  margin: 0 28px;
  padding: 2px 0 24px;
}

.sheet-row {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 16px;
  padding: 7px 18px;
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

.sheet-row dd.is-wide {
  grid-column: 1 / -1;
  color: var(--ui-muted);
}

.sheet-row dd {
  margin: 0;
  color: var(--ui-ink-2);
}

.ex-scope {
  padding-bottom: 22px;
}

.scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  padding: 4px 22px 0;
}

.ex-right {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.ex-result {
  display: grid;
  gap: 16px;
  padding: 22px 28px 24px;
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
  display: grid;
  gap: 2px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-orange-soft);
  font-size: 14px;
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
  width: 100%;
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

.fmt-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font: 600 12px var(--ui-font-mono);
}

.fmt-ico.blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.fmt-ico.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.fmt-ico.lavender {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.fmt-ico.red {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.radio {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-field-edge);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.is-on .radio {
  box-shadow: inset 0 0 0 6px var(--ui-accent);
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
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

@media (max-width: 1024px) {
  .ex-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ex-left,
  .ex-right {
    display: contents;
  }

  .ex-pick {
    order: 0;
  }

  .ex-scope {
    order: 1;
  }

  .ex-result {
    order: 2;
  }

  .ex-sheet {
    order: 3;
  }
}

@media (max-width: 768px) {
  .ex-result .lead-cta {
    display: none;
  }

  .ex-result {
    padding: 18px 20px 20px;
  }

  .res-num {
    font-size: 36px;
  }

  .sheet-bar {
    padding: 18px 20px 12px;
  }

  .sheet-shape {
    margin: 0 20px 8px;
  }

  .sheet-rows {
    margin: 0 20px;
    padding-bottom: 18px;
  }

  .sheet-row {
    grid-template-columns: 124px minmax(0, 1fr);
    gap: 12px;
    padding: 7px 14px;
  }

  .sheet-row dt {
    font-size: 12px;
  }

  .scope-grid {
    padding: 4px 16px 0;
  }

      .export-actions {
    display: flex;
  }

}
</style>
