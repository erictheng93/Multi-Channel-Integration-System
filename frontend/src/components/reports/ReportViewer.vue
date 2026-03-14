<template>
  <div class="report-viewer">
    <!-- 載入狀態 -->
    <div
      v-if="loading"
      class="loading-container"
    >
      <div class="loading-spinner">
        
      </div>
      <div class="loading-text">
        正在載入報表...
      </div>
    </div>

    <!-- 錯誤狀態 -->
    <div
      v-else-if="error"
      class="error-container"
    >
      <div class="error-icon">
        
      </div>
      <div class="error-title">
        無法載入報表
      </div>
      <div class="error-message">
        {{ error }}
      </div>
      <button
        class="btn btn-primary"
        @click="loadReport"
      >
         重新載入
      </button>
    </div>

    <!-- 報表內容 -->
    <div
      v-else-if="report"
      class="report-content"
    >
      <!-- 報表標題列 -->
      <ReportViewerHeader
        :report="report"
        :downloading="downloading"
        :regenerating="regenerating"
        :show-action-menu="showActionMenu"
        :can-download="canDownload"
        :can-regenerate="canRegenerate"
        :can-share="canShare"
        :can-export="canExport"
        :can-schedule="canSchedule"
        :can-delete="canDelete"
        @download="downloadReport"
        @regenerate="regenerateReport"
        @toggle-menu="showActionMenu = !showActionMenu"
        @share="shareReport"
        @export="exportReport"
        @schedule="scheduleReport"
        @delete="deleteReport"
      />

      <!-- 報表內容區域 -->
      <ReportViewerBody
        v-model:view-mode="viewMode"
        :report="report"
        :report-data="reportData"
        :progress="progress"
        :estimated-time-remaining="estimatedTimeRemaining"
        :downloading="downloading"
        @regenerate="regenerateReport"
        @back="emit('back')"
        @download="downloadReport"
      />

      <!-- 報表統計資訊 -->
      <ReportViewerMetadata :report="report" />
    </div>

    <!-- 分享對話框 -->
    <!-- TODO: 實現 ShareDialog 組件
    <ShareDialog
      v-if="showShareDialog"
      :report="report"
      @close="showShareDialog = false"
      @shared="onReportShared"
    />
    -->

    <!-- 匯出對話框 -->
    <!-- TODO: 實現 ExportDialog 組件
    <ExportDialog
      v-if="showExportDialog"
      :report="report"
      @close="showExportDialog = false"
      @exported="onReportExported"
    />
    -->

    <!-- 刪除確認對話框 -->
    <ConfirmDialog
      v-if="showDeleteDialog"
      title="刪除報表"
      message="確定要刪除這個報表嗎？此操作無法復原。"
      confirm-text="刪除"
      confirm-class="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import ReportsAPI from '@/api/reports';
import type { ReportDetails } from '@/types/reports';

// Child components
import ReportViewerHeader from './ReportViewerHeader.vue';
import ReportViewerBody from './ReportViewerBody.vue';
import ReportViewerMetadata from './ReportViewerMetadata.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

// Props
interface Props {
  reportId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // seconds
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true,
  refreshInterval: 5
});

// Emits
const emit = defineEmits<{
  'report-updated': [report: ReportDetails];
  'report-deleted': [reportId: string];
  'back': [];
}>();

// Router
const router = useRouter();

// 響應式資料
const loading = ref(true);
const error = ref<string | null>(null);
const report = ref<ReportDetails | null>(null);
const reportData = ref<Record<string, unknown> | null>(null);

// UI 狀態
const downloading = ref(false);
const regenerating = ref(false);
const viewMode = ref<'formatted' | 'raw'>('formatted');
const showActionMenu = ref(false);
const showShareDialog = ref(false);
const showExportDialog = ref(false);
const showDeleteDialog = ref(false);

// 進度狀態
const progress = ref(0);
const estimatedTimeRemaining = ref<number | null>(null);

// 自動刷新
let refreshTimer: NodeJS.Timeout | null = null;

// 計算屬性
const canDownload = computed(() => {
  return !!(report.value?.status === 'completed' && report.value?.downloadUrl);
});

const canRegenerate = computed(() => {
  return !!(report.value && ['failed', 'expired'].includes(report.value.status));
});

const canShare = computed(() => {
  return report.value?.status === 'completed';
});

const canExport = computed(() => {
  return report.value?.status === 'completed';
});

const canSchedule = computed(() => {
  return !!(report.value?.type && report.value.type !== 'custom');
});

const canDelete = computed(() => {
  return !!(report.value && !['generating'].includes(report.value.status));
});

// 方法
const loadReport = async () => {
  if (!props.reportId) { return; }

  loading.value = true;
  error.value = null;

  try {
    const reportDetails = await ReportsAPI.getReportDetails(props.reportId);
    report.value = reportDetails;

    // 如果是 JSON 格式且已完成，載入報表資料
    if (reportDetails.status === 'completed' && reportDetails.format === 'json') {
      await loadReportData();
    }

    // 如果正在生成中，開始輪詢
    if (reportDetails.status === 'generating' && props.autoRefresh) {
      startPolling();
    }

    emit('report-updated', reportDetails);

  } catch (err) {
    console.error('載入報表失敗:', err);
    error.value = err instanceof Error ? err.message : '載入報表失敗';
  } finally {
    loading.value = false;
  }
};

const loadReportData = async () => {
  if (!report.value?.downloadUrl) { return; }

  try {
    const response = await fetch(report.value.downloadUrl);
    if (response.ok) {
      reportData.value = await response.json();
    }
  } catch (err) {
    console.error('載入報表資料失敗:', err);
  }
};

const downloadReport = async () => {
  if (!report.value?.downloadUrl) { return; }

  downloading.value = true;

  try {
    const downloadInfo = await ReportsAPI.downloadReport(report.value.id);

    // 創建下載連結
    const link = document.createElement('a');
    link.href = downloadInfo.url;
    link.download = downloadInfo.filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error('下載報表失敗:', err);
  } finally {
    downloading.value = false;
  }
};

const regenerateReport = async () => {
  if (!report.value) { return; }

  regenerating.value = true;

  try {
    const newReport = await ReportsAPI.generateReport({
      type: report.value.type,
      title: `${report.value.title} (重新生成)`,
      description: report.value.description,
      format: report.value.format,
      timeRange: 'last_30_days',
      filters: report.value.dataSource?.filters || {},
      options: report.value.metadata?.options || {}
    });

    router.push(`/reports/${newReport.id}`);

  } catch (err) {
    console.error('重新生成報表失敗:', err);
  } finally {
    regenerating.value = false;
  }
};

const shareReport = () => {
  showShareDialog.value = true;
  showActionMenu.value = false;
};

const exportReport = () => {
  showExportDialog.value = true;
  showActionMenu.value = false;
};

const scheduleReport = () => {
  if (report.value) {
    router.push(`/reports/schedule?type=${report.value.type}`);
  }
  showActionMenu.value = false;
};

const deleteReport = () => {
  showDeleteDialog.value = true;
  showActionMenu.value = false;
};

const confirmDelete = async () => {
  if (!report.value) { return; }

  try {
    await ReportsAPI.deleteReport(report.value.id);
    emit('report-deleted', report.value.id);
    router.push('/reports');
  } catch (err) {
    console.error('刪除報表失敗:', err);
  } finally {
    showDeleteDialog.value = false;
  }
};

const startPolling = () => {
  if (refreshTimer) { return; }

  refreshTimer = setInterval(async () => {
    if (!report.value || report.value.status !== 'generating') {
      stopPolling();
      return;
    }

    try {
      const updatedReport = await ReportsAPI.getReportStatus(report.value.id);
      report.value = { ...report.value, ...updatedReport };

      if (updatedReport.status === 'generating') {
        progress.value = Math.min(progress.value + Math.random() * 10, 95);
      } else if (updatedReport.status === 'completed') {
        progress.value = 100;
        stopPolling();
        await loadReportData();
      } else {
        stopPolling();
      }

      emit('report-updated', report.value);

    } catch (err) {
      console.error('輪詢報表狀態失敗:', err);
      stopPolling();
    }
  }, props.refreshInterval * 1000);
};

const stopPolling = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 全域點擊事件監聽（關閉下拉選單）
const handleGlobalClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.action-dropdown')) {
    showActionMenu.value = false;
  }
};

// 生命週期
onMounted(() => {
  loadReport();
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  stopPolling();
  document.removeEventListener('click', handleGlobalClick);
});

// 監聽器
watch(() => props.reportId, () => {
  stopPolling();
  loadReport();
});

watch(() => report.value?.status, (newStatus) => {
  if (newStatus === 'generating' && props.autoRefresh) {
    startPolling();
  } else {
    stopPolling();
  }
});
</script>

<style scoped>
.report-viewer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.loading-spinner {
  font-size: 3rem;
  animation: spin 2s linear infinite;
  margin-bottom: 1rem;
}

.loading-text {
  font-size: 1.2rem;
  color: #6b7280;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.error-message {
  color: #6b7280;
  margin-bottom: 2rem;
}

.report-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Shared button styles (used by loading/error states) */
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .report-viewer {
    padding: 1rem;
  }
}
</style>
