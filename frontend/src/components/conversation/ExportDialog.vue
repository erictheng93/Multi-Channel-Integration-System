<template>
  <Modal
    :show="show"
    title="匯出對話記錄"
    size="lg"
    @close="handleClose"
  >
    <div class="export-form">
      <!-- 對話資訊（從對話詳情頁進入時顯示） -->
      <div
        v-if="conversationTitle"
        class="export-info-banner"
      >
        <div class="info-icon">
          <ChatIcon :size="16" />
        </div>
        <div class="info-text">
          <span class="info-label">匯出對話：</span>
          <span class="info-value">{{ conversationTitle }}</span>
        </div>
      </div>

      <!-- 格式選擇 -->
      <div class="form-group">
        <label class="form-label">匯出格式</label>
        <select
          v-model="filters.format"
          class="form-select"
        >
          <option value="json">JSON - 結構化資料</option>
          <option value="csv">CSV - 試算表格式</option>
          <option value="txt">TXT - 純文字聊天記錄</option>
        </select>
        <p class="form-hint">
          {{ formatHints[filters.format] }}
        </p>
      </div>

      <!-- 日期範圍 -->
      <div class="form-group">
        <label class="form-label">日期範圍</label>
        <div class="date-range">
          <div class="date-field">
            <label class="date-label">起始日期</label>
            <input
              v-model="filters.dateFrom"
              type="datetime-local"
              class="form-input"
            >
          </div>
          <span class="date-separator">至</span>
          <div class="date-field">
            <label class="date-label">結束日期</label>
            <input
              v-model="filters.dateTo"
              type="datetime-local"
              class="form-input"
            >
          </div>
        </div>
      </div>

      <!-- LINE 用戶篩選（從對話列表進入時才顯示） -->
      <div
        v-if="!conversationId"
        class="form-group"
      >
        <label class="form-label">LINE 用戶</label>
        <select
          v-model="filters.customerId"
          class="form-select"
          :disabled="loadingOptions"
        >
          <option value="">全部用戶</option>
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
      </div>

      <!-- 客服人員篩選 -->
      <div class="form-group">
        <label class="form-label">客服人員</label>
        <select
          v-model="filters.agentId"
          class="form-select"
          :disabled="loadingOptions"
        >
          <option value="">全部客服</option>
          <option
            v-for="agent in agentOptions"
            :key="agent.id"
            :value="agent.id"
          >
            {{ agent.displayName || '未知客服' }}
            <template v-if="agent.role">
              ({{ agent.role === 'admin' ? '管理員' : '客服' }})
            </template>
          </option>
        </select>
      </div>

      <!-- 最大筆數 -->
      <div class="form-group">
        <label class="form-label">最大筆數</label>
        <select
          v-model="filters.limit"
          class="form-select"
        >
          <option :value="100">100 筆</option>
          <option :value="500">500 筆</option>
          <option :value="1000">1000 筆</option>
        </select>
      </div>
    </div>

    <template #footer>
      <button
        class="btn btn-secondary"
        :disabled="exporting"
        @click="handleClose"
      >
        取消
      </button>
      <button
        class="btn btn-primary"
        :disabled="exporting"
        @click="handleExport"
      >
        <template v-if="exporting">
          <span class="spinner" />
          匯出中...
        </template>
        <template v-else>
          <DownloadIcon :size="16" />
          匯出
        </template>
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { DownloadIcon, ChatIcon } from '@/components/icons'
import { useToast } from '@/composables/useToast'
import {
  exportMessages,
  getExportCustomers,
  getExportAgents,
  type ExportFormat,
  type ExportCustomerOption,
  type ExportAgentOption
} from '@/api/export'

interface Props {
  show: boolean
  conversationId?: string
  conversationTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  conversationId: undefined,
  conversationTitle: undefined
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
}>()

const { showSuccess, showError } = useToast()

// 狀態
const exporting = ref(false)
const loadingOptions = ref(false)
const customerOptions = ref<ExportCustomerOption[]>([])
const agentOptions = ref<ExportAgentOption[]>([])

const filters = reactive({
  format: 'json' as ExportFormat,
  dateFrom: '',
  dateTo: '',
  customerId: '',
  agentId: '',
  limit: 100
})

const formatHints: Record<ExportFormat, string> = {
  json: '適合程式處理和資料分析，包含完整結構化資訊',
  csv: '適合在 Excel 或 Google Sheets 中開啟和分析',
  txt: '適合直接閱讀的純文字聊天記錄格式'
}

// 載入篩選選項
async function loadFilterOptions() {
  loadingOptions.value = true
  try {
    const [customersResult, agentsResult] = await Promise.all([
      getExportCustomers(),
      getExportAgents()
    ])

    if (customersResult.success && customersResult.data) {
      customerOptions.value = customersResult.data
    }

    if (agentsResult.success && agentsResult.data) {
      agentOptions.value = agentsResult.data
    }
  } catch (error) {
    console.error('Failed to load export filter options:', error)
  } finally {
    loadingOptions.value = false
  }
}

// 匯出處理
async function handleExport() {
  exporting.value = true

  try {
    const exportFilters = {
      format: filters.format,
      conversationId: props.conversationId || undefined,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : undefined,
      customerId: filters.customerId || undefined,
      agentId: filters.agentId || undefined,
      limit: filters.limit
    }

    const result = await exportMessages(exportFilters)

    if (!result.success || !result.data) {
      showError('匯出失敗', result.error || '無法匯出對話記錄')
      return
    }

    // 下載檔案（參考 ActivityLog.vue 的 Blob 下載模式）
    const blob = result.data
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // 生成檔案名稱
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

// 重置篩選條件
function resetFilters() {
  filters.format = 'json'
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.customerId = ''
  filters.agentId = ''
  filters.limit = 100
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
.export-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.export-info-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--primary-50, #eef2ff);
  border: 1px solid var(--primary-200, #c7d2fe);
  border-radius: 0.5rem;
}

.info-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--primary-100, #e0e7ff);
  border-radius: 50%;
  color: var(--primary-600, #4f46e5);
  flex-shrink: 0;
}

.info-text {
  font-size: 0.875rem;
}

.info-label {
  color: var(--gray-600, #4b5563);
}

.info-value {
  font-weight: 600;
  color: var(--gray-900, #111827);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-700, #374151);
}

.form-select,
.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--gray-300, #d1d5db);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--gray-900, #111827);
  background-color: white;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-select:disabled {
  background-color: var(--gray-100, #f3f4f6);
  cursor: not-allowed;
  opacity: 0.7;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--gray-500, #6b7280);
  margin: 0;
}

.date-range {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.date-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.date-label {
  font-size: 0.75rem;
  color: var(--gray-500, #6b7280);
}

.date-separator {
  font-size: 0.875rem;
  color: var(--gray-400, #9ca3af);
  padding-bottom: 0.625rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--primary-600, #4f46e5);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-700, #4338ca);
}

.btn-secondary {
  background-color: white;
  color: var(--gray-700, #374151);
  border-color: var(--gray-300, #d1d5db);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--gray-50, #f9fafb);
}

/* Loading Spinner */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 響應式設計 */
@media (max-width: 640px) {
  .date-range {
    flex-direction: column;
    gap: 0.5rem;
  }

  .date-separator {
    display: none;
  }
}
</style>
