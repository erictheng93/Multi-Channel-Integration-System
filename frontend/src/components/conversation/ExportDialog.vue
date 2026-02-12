<template>
  <Modal
    :show="show"
    title="匯出對話記錄"
    size="md"
    @close="handleClose"
  >
    <div class="export-form">
      <!-- 對話資訊（從對話詳情頁進入時顯示） -->
      <div
        v-if="conversationTitle"
        class="export-info-card"
      >
        <div class="info-icon-wrap">
          <ChatIcon :size="18" />
        </div>
        <div class="info-content">
          <span class="info-eyebrow">匯出對話</span>
          <span class="info-title">{{ conversationTitle }}</span>
        </div>
      </div>

      <!-- 格式選擇 — Segmented Control -->
      <div class="form-section">
        <label class="section-label">匯出格式</label>
        <div class="segmented-control">
          <button
            v-for="option in formatOptions"
            :key="option.value"
            class="segment"
            :class="{ active: filters.format === option.value }"
            @click="filters.format = option.value"
          >
            <component
              :is="option.icon"
              :size="16"
              class="segment-icon"
            />
            <span class="segment-label">{{ option.label }}</span>
          </button>
        </div>
        <p class="section-hint">
          {{ formatHints[filters.format] }}
        </p>
      </div>

      <!-- 日期範圍 -->
      <div class="form-section">
        <label class="section-label">日期範圍</label>
        <div class="date-range">
          <div class="date-pill">
            <label class="date-eyebrow">起始日期</label>
            <input
              v-model="filters.dateFrom"
              type="datetime-local"
              class="date-input"
            >
          </div>
          <div class="date-arrow">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div class="date-pill">
            <label class="date-eyebrow">結束日期</label>
            <input
              v-model="filters.dateTo"
              type="datetime-local"
              class="date-input"
            >
          </div>
        </div>
      </div>

      <!-- LINE 用戶篩選（從對話列表進入時才顯示） -->
      <div
        v-if="!conversationId"
        class="form-section"
      >
        <label class="section-label">LINE 用戶</label>
        <div class="select-wrap">
          <select
            v-model="filters.customerId"
            class="apple-select"
            :disabled="loadingOptions"
          >
            <option
              value=""
              disabled
              hidden
            >
              {{ loadingOptions ? '載入中...' : '請選擇用戶' }}
            </option>
            <option value="__all__">
              全部用戶
            </option>
            <option
              v-for="customer in customerOptions"
              :key="customer.id"
              :value="customer.id.toString()"
            >
              {{ customer.displayName || '未知用戶' }}
              <template v-if="customer.platform">
                ({{ customer.platform }})
              </template>
            </option>
          </select>
          <div class="select-chevron">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
        <p
          v-if="customerLoadError"
          class="section-error"
        >
          {{ customerLoadError }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="apple-footer">
        <button
          class="btn-apple-primary"
          :disabled="exporting"
          @click="handleExport"
        >
          <template v-if="exporting">
            <span class="apple-spinner" />
            匯出中...
          </template>
          <template v-else>
            <DownloadIcon :size="18" />
            匯出對話記錄
          </template>
        </button>
        <button
          class="btn-apple-text"
          :disabled="exporting"
          @click="handleClose"
        >
          取消
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, defineComponent, h, type Component, type VNode } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { DownloadIcon, ChatIcon } from '@/components/icons'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import {
  exportMessages,
  getExportCustomers,
  getExportCount,
  type ExportFormat,
  type ExportCustomerOption
} from '@/api/export'

interface Props {
  show: boolean
  conversationId?: string
  conversationTitle?: string
  initialFormat?: ExportFormat
}

const props = withDefaults(defineProps<Props>(), {
  conversationId: undefined,
  conversationTitle: undefined,
  initialFormat: undefined
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
}>()

// SVG icon helper — uses defineComponent for proper TypeScript typing
function createSvgIcon(children: () => VNode[]): Component {
  return defineComponent({
    props: { size: { type: Number, default: 16 } },
    render(): VNode {
      return h('svg', {
        width: this.size, height: this.size,
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }, children())
    }
  })
}

const JsonIcon = createSvgIcon(() => [
  h('path', { d: 'M4 6h2a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 0-2 2v1a2 2 0 0 1-2 2H4' }),
  h('path', { d: 'M20 6h-2a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2 2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h2' })
])

const CsvIcon = createSvgIcon(() => [
  h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
  h('line', { x1: '3', y1: '9', x2: '21', y2: '9' }),
  h('line', { x1: '3', y1: '15', x2: '21', y2: '15' }),
  h('line', { x1: '9', y1: '3', x2: '9', y2: '21' }),
  h('line', { x1: '15', y1: '3', x2: '15', y2: '21' })
])

const TxtIcon = createSvgIcon(() => [
  h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
  h('polyline', { points: '14 2 14 8 20 8' }),
  h('line', { x1: '8', y1: '13', x2: '16', y2: '13' }),
  h('line', { x1: '8', y1: '17', x2: '12', y2: '17' })
])

const { showSuccess, showError } = useToast()
const { showWarning } = useConfirmDialog()

// 狀態
const exporting = ref(false)
const loadingOptions = ref(false)
const customerLoadError = ref('')
const customerOptions = ref<ExportCustomerOption[]>([])

const filters = reactive({
  format: 'json' as ExportFormat,
  dateFrom: '',
  dateTo: '',
  customerId: ''
})

const formatOptions = [
  { value: 'json' as ExportFormat, label: 'JSON', icon: JsonIcon },
  { value: 'csv' as ExportFormat, label: 'CSV', icon: CsvIcon },
  { value: 'txt' as ExportFormat, label: 'TXT', icon: TxtIcon }
]

const formatHints: Record<ExportFormat, string> = {
  json: '適合程式處理和資料分析，包含完整結構化資訊',
  csv: '適合在 Excel 或 Google Sheets 中開啟和分析',
  txt: '適合直接閱讀的純文字聊天記錄格式'
}

// 載入篩選選項
async function loadFilterOptions() {
  loadingOptions.value = true
  customerLoadError.value = ''
  try {
    const customersResult = await getExportCustomers()
    if (customersResult.success && customersResult.data) {
      customerOptions.value = customersResult.data
    } else {
      customerLoadError.value = customersResult.error || '無法載入用戶列表'
      console.warn('Export customers API returned:', customersResult)
    }
  } catch (error) {
    customerLoadError.value = '載入用戶列表失敗，請稍後再試'
    console.error('Failed to load export filter options:', error)
  } finally {
    loadingOptions.value = false
  }
}

// 篩選判斷
const hasCustomerFilter = computed(() =>
  filters.customerId !== '' && filters.customerId !== '__all__'
)

const hasDateFilter = computed(() =>
  filters.dateFrom !== '' || filters.dateTo !== ''
)

const hasAnyFilter = computed(() =>
  hasCustomerFilter.value || hasDateFilter.value
)

// 構建 API 篩選參數
function buildExportFilters() {
  return {
    format: filters.format,
    conversationId: props.conversationId || undefined,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : undefined,
    // __all__ 表示使用者明確選擇全部，傳 undefined 給 API（不篩選）
    customerId: hasCustomerFilter.value ? filters.customerId : undefined
  }
}

// 匯出驗證入口
async function handleExport() {
  // 從對話詳情頁進入 → 單一對話，直接匯出
  if (props.conversationId) {
    return doExport()
  }

  // 從列表進入 + 有篩選條件 → 直接匯出
  if (hasAnyFilter.value) {
    return doExport()
  }

  // 從列表進入 + 無篩選 → 查詢數量並顯示確認
  exporting.value = true
  try {
    const countResult = await getExportCount(buildExportFilters())

    let message: string
    if (countResult.success && countResult.data) {
      const { count, willBeTruncated } = countResult.data
      message = `目前共有 ${count.toLocaleString()} 筆記錄。`
      if (willBeTruncated) {
        message += `\n系統最多匯出 5,000 筆，超出部分將被截斷。`
      }
    } else {
      // 計數 API 失敗，顯示通用警告
      message = '您尚未設定任何篩選條件，將匯出全部記錄（最多 5,000 筆）。'
    }

    const confirmed = await showWarning(
      '匯出全部記錄？',
      message,
      {
        confirmText: '確認匯出全部',
        cancelText: '返回設定篩選'
      }
    )

    if (!confirmed) {
      exporting.value = false
      return
    }

    await doExport()
  } catch (error) {
    console.error('Export validation failed:', error)
    exporting.value = false
    showError('匯出失敗', '匯出過程中發生錯誤，請稍後再試')
  }
}

// 實際匯出邏輯
async function doExport() {
  exporting.value = true

  try {
    const result = await exportMessages(buildExportFilters())

    if (!result.success || !result.data) {
      showError('匯出失敗', result.error || '無法匯出對話記錄')
      return
    }

    // 下載檔案
    const blob = result.data
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const extensions: Record<ExportFormat, string> = {
      json: 'json',
      csv: 'csv',
      txt: 'txt'
    }
    link.download = `chat_export_${dateStr}.${extensions[filters.format]}`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess('匯出成功', '對話記錄已開始下載')
    handleClose()
  } catch (error) {
    console.error('Export failed:', error)
    showError('匯出失敗', '匯出過程中發生錯誤，請稍後再試')
  } finally {
    exporting.value = false
  }
}

function handleClose() {
  emit('close')
  emit('update:show', false)
}

function resetFilters() {
  filters.format = props.initialFormat || 'json'
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.customerId = ''
  customerLoadError.value = ''
}

// 打開時載入篩選選項
watch(() => props.show, (isShow) => {
  if (isShow) {
    resetFilters()
    loadFilterOptions()
  }
}, { immediate: true })
</script>

<style scoped>
/* ─── Apple Design System ─── */
.export-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ─── Conversation Info Card ─── */
.export-info-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.06) 0%, rgba(88, 86, 214, 0.06) 100%);
  border: 1px solid rgba(0, 122, 255, 0.12);
  border-radius: 0.875rem;
}

.info-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  border-radius: 0.625rem;
  color: white;
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.info-eyebrow {
  font-size: 0.6875rem;
  font-weight: 500;
  color: rgba(0, 122, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900, #1d1d1f);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Form Sections ─── */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--gray-500, #86868b);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.section-hint {
  font-size: 0.75rem;
  color: var(--gray-400, #aeaeb2);
  margin: 0;
  line-height: 1.4;
}

.section-error {
  font-size: 0.75rem;
  color: #ff3b30;
  margin: 0;
  line-height: 1.4;
}

/* ─── Segmented Control ─── */
.segmented-control {
  display: flex;
  background: var(--gray-100, #f5f5f7);
  border-radius: 0.625rem;
  padding: 0.1875rem;
  gap: 0.125rem;
}

.segment {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5625rem 0.75rem;
  border: none;
  background: transparent;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--gray-500, #86868b);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  position: relative;
}

.segment:hover:not(.active) {
  color: var(--gray-700, #1d1d1f);
}

.segment.active {
  background: white;
  color: var(--gray-900, #1d1d1f);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 1px 2px rgba(0, 0, 0, 0.06);
  font-weight: 600;
}

.segment-icon {
  opacity: 0.5;
  transition: opacity 0.2s;
}

.segment.active .segment-icon {
  opacity: 1;
  color: #007AFF;
}

.segment-label {
  line-height: 1;
}

/* ─── Date Range ─── */
.date-range {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.date-pill {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.date-eyebrow {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--gray-400, #aeaeb2);
  padding-left: 0.125rem;
}

.date-input {
  width: 100%;
  padding: 0.5625rem 0.75rem;
  border: 1px solid var(--gray-200, #e5e5ea);
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  color: var(--gray-900, #1d1d1f);
  background-color: var(--gray-50, #fafafa);
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
}

.date-input:focus {
  outline: none;
  border-color: #007AFF;
  background-color: white;
  box-shadow: 0 0 0 3.5px rgba(0, 122, 255, 0.15);
}

.date-arrow {
  color: var(--gray-300, #d1d1d6);
  flex-shrink: 0;
  padding-top: 1.125rem;
}

/* ─── Custom Select ─── */
.select-wrap {
  position: relative;
}

.apple-select {
  width: 100%;
  padding: 0.5625rem 2.25rem 0.5625rem 0.75rem;
  border: 1px solid var(--gray-200, #e5e5ea);
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  color: var(--gray-900, #1d1d1f);
  background-color: var(--gray-50, #fafafa);
  appearance: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  font-family: inherit;
}

.apple-select:focus {
  outline: none;
  border-color: #007AFF;
  background-color: white;
  box-shadow: 0 0 0 3.5px rgba(0, 122, 255, 0.15);
}

.apple-select:disabled {
  background-color: var(--gray-100, #f5f5f7);
  color: var(--gray-400, #aeaeb2);
  cursor: not-allowed;
}

.select-chevron {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-400, #aeaeb2);
  pointer-events: none;
}

/* ─── Footer ─── */
.apple-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.btn-apple-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.8125rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(180deg, #3395FF 0%, #007AFF 100%);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  letter-spacing: -0.01em;
}

.btn-apple-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #007AFF 0%, #0066D6 100%);
  transform: scale(0.985);
}

.btn-apple-primary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-apple-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-apple-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  font-size: 0.875rem;
  font-weight: 500;
  color: #007AFF;
  cursor: pointer;
  border-radius: 0.625rem;
  transition: all 0.15s;
}

.btn-apple-text:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.06);
}

.btn-apple-text:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ─── Loading Spinner ─── */
.apple-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255, 255, 255, 0.25);
  border-top-color: white;
  border-radius: 50%;
  animation: apple-spin 0.75s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

@keyframes apple-spin {
  to { transform: rotate(360deg); }
}

/* ─── Responsive ─── */
@media (max-width: 640px) {
  .date-range {
    flex-direction: column;
    gap: 0.5rem;
  }

  .date-arrow {
    display: none;
  }

  .segmented-control {
    border-radius: 0.5rem;
  }

  .segment {
    padding: 0.5rem 0.5rem;
    font-size: 0.75rem;
  }
}
</style>
