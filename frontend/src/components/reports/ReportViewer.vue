<template>
  <div class="report-viewer">
    <!-- 載入狀態 -->
    <div
      v-if="loading"
      class="loading-container"
    >
      <div class="loading-spinner">
        ⚙️
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
        ❌
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
        🔄 重新載入
      </button>
    </div>

    <!-- 報表內容 -->
    <div
      v-else-if="report"
      class="report-content"
    >
      <!-- 報表標題列 -->
      <div class="report-header">
        <div class="header-info">
          <div
            class="report-type-badge"
            :class="getTypeBadgeClass(report.type)"
          >
            {{ getReportTypeIcon(report.type) }} {{ getReportTypeLabel(report.type) }}
          </div>
          <h1 class="report-title">
            {{ report.title }}
          </h1>
          <p
            v-if="report.description"
            class="report-description"
          >
            {{ report.description }}
          </p>
          <div class="report-meta">
            <div class="meta-item">
              <span class="meta-label">狀態：</span>
              <span
                class="status-badge"
                :class="getStatusClass(report.status)"
              >
                {{ getStatusIcon(report.status) }} {{ getStatusLabel(report.status) }}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">格式：</span>
              <span class="format-badge">
                {{ getFormatIcon(report.format) }} {{ getFormatLabel(report.format) }}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">建立時間：</span>
              <span class="time-text">{{ formatDateTime(report.createdAt) }}</span>
            </div>
            <div
              v-if="report.completedAt"
              class="meta-item"
            >
              <span class="meta-label">完成時間：</span>
              <span class="time-text">{{ formatDateTime(report.completedAt) }}</span>
            </div>
            <div
              v-if="report.fileSize"
              class="meta-item"
            >
              <span class="meta-label">檔案大小：</span>
              <span class="size-text">{{ formatFileSize(report.fileSize) }}</span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <!-- 主要動作按鈕 -->
          <div class="primary-actions">
            <button
              v-if="canDownload"
              class="btn btn-primary"
              :disabled="downloading"
              @click="downloadReport"
            >
              <span v-if="downloading">⏳ 下載中...</span>
              <span v-else>📥 下載報表</span>
            </button>

            <button
              v-if="canRegenerate"
              class="btn btn-secondary"
              :disabled="regenerating"
              @click="regenerateReport"
            >
              <span v-if="regenerating">⚙️ 重新生成中...</span>
              <span v-else>🔄 重新生成</span>
            </button>
          </div>

          <!-- 次要動作選單 -->
          <div class="secondary-actions">
            <div
              class="action-dropdown"
              :class="{ 'open': showActionMenu }"
            >
              <button
                class="dropdown-toggle"
                @click="showActionMenu = !showActionMenu"
              >
                ⋯
              </button>
              <div class="dropdown-menu">
                <button
                  class="dropdown-item"
                  :disabled="!canShare"
                  @click="shareReport"
                >
                  🔗 分享連結
                </button>
                <button
                  class="dropdown-item"
                  :disabled="!canExport"
                  @click="exportReport"
                >
                  📤 匯出其他格式
                </button>
                <button
                  class="dropdown-item"
                  :disabled="!canSchedule"
                  @click="scheduleReport"
                >
                  ⏰ 建立排程
                </button>
                <div class="dropdown-divider" />
                <button
                  class="dropdown-item danger"
                  :disabled="!canDelete"
                  @click="deleteReport"
                >
                  🗑️ 刪除報表
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 報表內容區域 -->
      <div class="report-body">
        <!-- 生成中狀態 -->
        <div
          v-if="report.status === 'generating'"
          class="generating-status"
        >
          <div class="progress-section">
            <div class="progress-icon">
              ⚙️
            </div>
            <div class="progress-info">
              <h3 class="progress-title">
                報表生成中
              </h3>
              <p class="progress-description">
                正在處理您的資料，請稍候...
              </p>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${progress}%` }"
                />
              </div>
              <div class="progress-text">
                {{ progress }}% 完成
              </div>
            </div>
          </div>
          <div
            v-if="estimatedTimeRemaining"
            class="estimated-time"
          >
            預估剩餘時間：{{ formatTime(estimatedTimeRemaining) }}
          </div>
        </div>

        <!-- 失敗狀態 -->
        <div
          v-else-if="report.status === 'failed'"
          class="failed-status"
        >
          <div class="failure-section">
            <div class="failure-icon">
              ❌
            </div>
            <div class="failure-info">
              <h3 class="failure-title">
                報表生成失敗
              </h3>
              <p class="failure-description">
                很抱歉，報表生成過程中發生錯誤
              </p>
              <div
                v-if="report.errorMessage"
                class="error-details"
              >
                <details>
                  <summary>錯誤詳情</summary>
                  <pre class="error-message">{{ report.errorMessage }}</pre>
                </details>
              </div>
              <div class="failure-actions">
                <button
                  class="btn btn-primary"
                  @click="regenerateReport"
                >
                  🔄 重新生成
                </button>
                <button
                  class="btn btn-secondary"
                  @click="$emit('back')"
                >
                  ← 返回
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 已完成 - 顯示報表內容 -->
        <div
          v-else-if="report.status === 'completed'"
          class="completed-report"
        >
          <!-- JSON 格式預覽 -->
          <div
            v-if="report.format === 'json' && reportData"
            class="json-preview"
          >
            <div class="preview-header">
              <h3 class="preview-title">
                📊 資料預覽
              </h3>
              <div class="preview-actions">
                <button
                  class="view-toggle"
                  :class="{ 'active': viewMode === 'formatted' }"
                  @click="viewMode = 'formatted'"
                >
                  🎨 格式化檢視
                </button>
                <button
                  class="view-toggle"
                  :class="{ 'active': viewMode === 'raw' }"
                  @click="viewMode = 'raw'"
                >
                  📝 原始資料
                </button>
              </div>
            </div>

            <!-- 格式化檢視 -->
            <div
              v-if="viewMode === 'formatted'"
              class="formatted-view"
            >
              <component
                :is="getDataVisualizationComponent()"
                :data="reportData"
                :options="report.metadata?.options"
              />
            </div>

            <!-- 原始資料檢視 -->
            <div
              v-else
              class="raw-view"
            >
              <pre class="json-data">{{ JSON.stringify(reportData, null, 2) }}</pre>
            </div>
          </div>

          <!-- HTML 格式預覽 -->
          <div
            v-else-if="report.format === 'html'"
            class="html-preview"
          >
            <div class="preview-header">
              <h3 class="preview-title">
                🌐 HTML 預覽
              </h3>
            </div>
            <div class="html-content">
              <iframe
                :src="report.downloadUrl"
                class="html-frame"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          <!-- 其他格式 - 顯示下載選項 -->
          <div
            v-else
            class="download-preview"
          >
            <div class="download-card">
              <div class="download-icon">
                {{ getFormatIcon(report.format) }}
              </div>
              <div class="download-info">
                <h3 class="download-title">
                  {{ getFormatLabel(report.format) }} 報表已準備就緒
                </h3>
                <p class="download-description">
                  點擊下方按鈕下載您的報表檔案
                </p>
                <div class="download-meta">
                  <span class="file-size">檔案大小：{{ formatFileSize(report.fileSize || 0) }}</span>
                  <span class="file-type">格式：{{ report.format.toUpperCase() }}</span>
                </div>
              </div>
              <div class="download-actions">
                <button
                  class="btn btn-primary large"
                  :disabled="downloading"
                  @click="downloadReport"
                >
                  <span v-if="downloading">⏳ 下載中...</span>
                  <span v-else>📥 立即下載</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 生成記錄 -->
          <div
            v-if="report.generationLog && report.generationLog.length > 0"
            class="generation-log"
          >
            <details>
              <summary class="log-toggle">
                📝 查看生成記錄
              </summary>
              <div class="log-content">
                <div
                  v-for="(log, index) in report.generationLog"
                  :key="index"
                  class="log-entry"
                >
                  {{ log }}
                </div>
              </div>
            </details>
          </div>
        </div>

        <!-- 已過期狀態 -->
        <div
          v-else-if="report.status === 'expired'"
          class="expired-status"
        >
          <div class="expired-section">
            <div class="expired-icon">
              ⏰
            </div>
            <div class="expired-info">
              <h3 class="expired-title">
                報表已過期
              </h3>
              <p class="expired-description">
                此報表已超過保存期限，請重新生成
              </p>
              <div class="expired-actions">
                <button
                  class="btn btn-primary"
                  @click="regenerateReport"
                >
                  🔄 重新生成
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 報表統計資訊 -->
      <div
        v-if="report.metadata"
        class="report-metadata"
      >
        <div class="metadata-header">
          <h3 class="metadata-title">
            📈 統計資訊
          </h3>
        </div>
        <div class="metadata-grid">
          <div
            v-if="report.executionTime"
            class="metadata-item"
          >
            <span class="metadata-label">執行時間：</span>
            <span class="metadata-value">{{ formatTime(report.executionTime) }}</span>
          </div>
          <div
            v-if="report.metadata.recordCount"
            class="metadata-item"
          >
            <span class="metadata-label">記錄數量：</span>
            <span class="metadata-value">{{ report.metadata.recordCount.toLocaleString() }}</span>
          </div>
          <div
            v-if="report.metadata.generatedBy"
            class="metadata-item"
          >
            <span class="metadata-label">生成者：</span>
            <span class="metadata-value">{{ report.metadata.generatedBy }}</span>
          </div>
          <div
            v-if="report.metadata.version"
            class="metadata-item"
          >
            <span class="metadata-label">版本：</span>
            <span class="metadata-value">{{ report.metadata.version }}</span>
          </div>
        </div>
      </div>
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
import type { ReportDetails, ReportType, ReportFormat, ReportStatus } from '@/types/reports';

// 導入子組件（假設已存在）
// import ShareDialog from './ShareDialog.vue';
// import ExportDialog from './ExportDialog.vue';
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
  return report.value?.status === 'completed' && report.value?.downloadUrl;
});

const canRegenerate = computed(() => {
  return report.value && ['failed', 'expired'].includes(report.value.status);
});

const canShare = computed(() => {
  return report.value?.status === 'completed';
});

const canExport = computed(() => {
  return report.value?.status === 'completed';
});

const canSchedule = computed(() => {
  return report.value?.type && report.value.type !== 'custom';
});

const canDelete = computed(() => {
  return report.value && !['generating'].includes(report.value.status);
});

// 方法
const loadReport = async () => {
  if (!props.reportId) {return;}

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
  if (!report.value?.downloadUrl) {return;}

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
  if (!report.value?.downloadUrl) {return;}

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
    // 可以顯示錯誤提示
  } finally {
    downloading.value = false;
  }
};

const regenerateReport = async () => {
  if (!report.value) {return;}

  regenerating.value = true;

  try {
    // 使用原始參數重新生成報表
    const newReport = await ReportsAPI.generateReport({
      type: report.value.type,
      title: `${report.value.title} (重新生成)`,
      description: report.value.description,
      format: report.value.format,
      timeRange: 'last_30_days', // 預設時間範圍
      filters: report.value.dataSource?.filters || {},
      options: report.value.metadata?.options || {}
    });

    // 導航到新報表
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
  if (!report.value) {return;}

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
  if (refreshTimer) {return;}

  refreshTimer = setInterval(async () => {
    if (!report.value || report.value.status !== 'generating') {
      stopPolling();
      return;
    }

    try {
      const updatedReport = await ReportsAPI.getReportStatus(report.value.id);
      report.value = { ...report.value, ...updatedReport };

      // 模擬進度更新
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

// 移除未使用的函數

// 輔助方法
const getReportTypeIcon = (type: ReportType): string => {
  const iconMap: Record<ReportType, string> = {
    'conversation_summary': '💬',
    'agent_performance': '👤',
    'team_analytics': '👥',
    'customer_satisfaction': '😊',
    'platform_usage': '📱',
    'message_statistics': '📊',
    'response_time_analysis': '⏱️',
    'workload_distribution': '⚖️',
    'system_health': '🏥',
    'custom': '🔧',
    'cost_analysis': '💰',
    'sla_compliance': '⚖️',
    'anomaly_detection': '🚨',
    'audit_trail': '📋',
    'resource_utilization': '⚡',
    'trend_forecast': '📈',
    'customer_insights': '💡',
    'channel_integration': '🌐',
    'goal_achievement': '🎯',
    'automation_effectiveness': '🤖',
    'security_risk': '🔒',
    'knowledge_base': '📚',
    'call_quality': '📞',
    'executive_summary': '💼'
  };
  return iconMap[type] || '📊';
};

const getReportTypeLabel = (type: ReportType): string => {
  return ReportsAPI.formatReportType(type);
};

const getTypeBadgeClass = (type: ReportType): string => {
  if (['cost_analysis', 'sla_compliance', 'anomaly_detection', 'audit_trail', 'resource_utilization'].includes(type)) {
    return 'enterprise';
  }
  if (['trend_forecast', 'customer_insights', 'channel_integration', 'goal_achievement', 'automation_effectiveness'].includes(type)) {
    return 'business-intelligence';
  }
  if (['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(type)) {
    return 'advanced';
  }
  return 'basic';
};

const getStatusIcon = (status: ReportStatus): string => {
  const statusMap = {
    'pending': '⏳',
    'generating': '⚙️',
    'completed': '✅',
    'failed': '❌',
    'expired': '⏰'
  };
  return statusMap[status] || '❓';
};

const getStatusLabel = (status: ReportStatus): string => {
  const statusMap = {
    'pending': '待處理',
    'generating': '生成中',
    'completed': '已完成',
    'failed': '失敗',
    'expired': '已過期'
  };
  return statusMap[status] || status;
};

const getStatusClass = (status: ReportStatus): string => {
  const classMap = {
    'pending': 'pending',
    'generating': 'generating',
    'completed': 'completed',
    'failed': 'failed',
    'expired': 'expired'
  };
  return classMap[status] || '';
};

const getFormatIcon = (format: ReportFormat): string => {
  const formatMap = {
    'json': '📄',
    'csv': '📊',
    'excel': '📗',
    'pdf': '📕',
    'html': '🌐'
  };
  return formatMap[format] || '📄';
};

const getFormatLabel = (format: ReportFormat): string => {
  const formatMap = {
    'json': 'JSON 資料',
    'csv': 'CSV 試算表',
    'excel': 'Excel 檔案',
    'pdf': 'PDF 文件',
    'html': 'HTML 網頁'
  };
  return formatMap[format] || format.toUpperCase();
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('zh-TW');
};

const formatFileSize = (bytes: number): string => {
  return ReportsAPI.formatFileSize(bytes);
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)} 秒`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} 分鐘`;
  } else {
    return `${Math.round(seconds / 3600)} 小時`;
  }
};

const getDataVisualizationComponent = (): string => {
  // 返回對應的資料視覺化組件名稱
  // 這裡需要根據實際實現的組件來調整
  return 'ReportDataVisualization';
};

// 生命週期
onMounted(() => {
  loadReport();
});

onUnmounted(() => {
  stopPolling();
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

// 全域點擊事件監聽（關閉下拉選單）
const handleGlobalClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.action-dropdown')) {
    showActionMenu.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
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

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.header-info {
  flex: 1;
}

.report-type-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.report-type-badge.basic {
  background: #dbeafe;
  color: #1e40af;
}

.report-type-badge.enterprise {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.report-type-badge.business-intelligence {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
}

.report-type-badge.advanced {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.report-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.report-description {
  color: #6b7280;
  font-size: 1.1rem;
  margin: 0 0 1.5rem 0;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-label {
  font-weight: 500;
  color: #6b7280;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.generating {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.completed {
  background: #dcfce7;
  color: #166534;
}

.status-badge.failed {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.expired {
  background: #f3f4f6;
  color: #374151;
}

.format-badge {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
}

.time-text,
.size-text {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  color: #374151;
}

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
}

.primary-actions {
  display: flex;
  gap: 1rem;
}

.secondary-actions {
  position: relative;
}

.action-dropdown {
  position: relative;
}

.dropdown-toggle {
  width: 40px;
  height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 1.2rem;
  color: #6b7280;
  transition: all 0.2s;
}

.dropdown-toggle:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.2s;
}

.action-dropdown.open .dropdown-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
}

.dropdown-item:hover:not(:disabled) {
  background: #f9fafb;
}

.dropdown-item:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.dropdown-item.danger {
  color: #dc2626;
}

.dropdown-item.danger:hover:not(:disabled) {
  background: #fef2f2;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.5rem 0;
}

.report-body {
  padding: 2rem;
}

.generating-status,
.failed-status,
.expired-status {
  text-align: center;
  padding: 3rem 2rem;
}

.progress-section,
.failure-section,
.expired-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 500px;
  margin: 0 auto;
}

.progress-icon,
.failure-icon,
.expired-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.progress-icon {
  animation: spin 2s linear infinite;
}

.progress-title,
.failure-title,
.expired-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.progress-description,
.failure-description,
.expired-description {
  color: #6b7280;
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.estimated-time {
  color: #6b7280;
  font-style: italic;
}

.error-details {
  margin: 1rem 0;
  text-align: left;
  width: 100%;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
}

.error-message {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 0.5rem;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.failure-actions,
.expired-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.completed-report {
  margin-bottom: 2rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.preview-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.view-toggle {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.view-toggle:hover {
  background: #f9fafb;
}

.view-toggle.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.formatted-view {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  min-height: 400px;
}

.raw-view {
  background: #1f2937;
  border-radius: 8px;
  overflow: hidden;
}

.json-data {
  color: #e5e7eb;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  padding: 1.5rem;
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  max-height: 600px;
  overflow-y: auto;
}

.html-content {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.html-frame {
  width: 100%;
  height: 600px;
  border: none;
}

.download-preview {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.download-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  padding: 3rem 2rem;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #f9fafb;
}

.download-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.7;
}

.download-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.download-description {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.download-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
  color: #6b7280;
  font-size: 0.9rem;
}

.download-actions .btn.large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

.generation-log {
  margin-top: 2rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 2rem;
}

.log-toggle {
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
}

.log-content {
  margin-top: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  color: #374151;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.log-entry:last-child {
  border-bottom: none;
}

.report-metadata {
  margin-top: 2rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 2rem;
}

.metadata-header {
  margin-bottom: 1rem;
}

.metadata-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.metadata-label {
  font-weight: 500;
  color: #6b7280;
}

.metadata-value {
  font-weight: 600;
  color: #1f2937;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .report-viewer {
    padding: 1rem;
  }

  .report-header {
    flex-direction: column;
    gap: 1.5rem;
  }

  .header-actions {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }

  .report-meta {
    flex-direction: column;
    gap: 0.75rem;
  }

  .metadata-grid {
    grid-template-columns: 1fr;
  }

  .failure-actions,
  .expired-actions {
    flex-direction: column;
    width: 100%;
  }

  .failure-actions .btn,
  .expired-actions .btn {
    width: 100%;
  }
}

/* 共用樣式 */
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

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}
</style>