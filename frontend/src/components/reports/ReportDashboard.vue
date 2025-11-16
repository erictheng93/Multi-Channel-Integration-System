<template>
  <div class="report-dashboard">
    <!-- 頁面標題和快速動作 -->
    <div class="dashboard-header">
      <div class="header-content">
        <h1 class="dashboard-title">
          📊 報表儀表板
        </h1>
        <p class="dashboard-subtitle">
          管理和監控您的報表生成與使用情況
        </p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          :disabled="loading"
          @click="refreshData"
        >
          <span v-if="loading">⚙️ 載入中...</span>
          <span v-else>🔄 重新整理</span>
        </button>
        <button
          class="btn btn-primary"
          @click="$emit('create-report')"
        >
          ✨ 建立報表
        </button>
      </div>
    </div>

    <!-- 統計卡片區域 -->
    <div class="stats-section">
      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-icon">
            📊
          </div>
          <div class="stat-content">
            <div class="stat-number">
              {{ stats.totalReports }}
            </div>
            <div class="stat-label">
              總報表數
            </div>
          </div>
          <div
            v-if="stats.thisMonthGenerated > 0"
            class="stat-trend"
          >
            <span class="trend-indicator up">↗</span>
            <span class="trend-text">本月 +{{ stats.thisMonthGenerated }}</span>
          </div>
        </div>

        <div class="stat-card completed">
          <div class="stat-icon">
            ✅
          </div>
          <div class="stat-content">
            <div class="stat-number">
              {{ stats.completedReports }}
            </div>
            <div class="stat-label">
              已完成
            </div>
          </div>
          <div class="stat-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${completionRate}%` }"
              />
            </div>
            <span class="progress-text">{{ completionRate }}%</span>
          </div>
        </div>

        <div class="stat-card generating">
          <div class="stat-icon">
            ⚙️
          </div>
          <div class="stat-content">
            <div class="stat-number">
              {{ stats.pendingReports }}
            </div>
            <div class="stat-label">
              處理中
            </div>
          </div>
          <div
            v-if="stats.pendingReports > 0"
            class="stat-indicator"
          >
            <span class="indicator-dot" />
            <span class="indicator-text">進行中</span>
          </div>
        </div>

        <div class="stat-card failed">
          <div class="stat-icon">
            ❌
          </div>
          <div class="stat-content">
            <div class="stat-number">
              {{ stats.failedReports }}
            </div>
            <div class="stat-label">
              失敗
            </div>
          </div>
          <div
            v-if="stats.failedReports > 0"
            class="stat-action"
          >
            <button
              class="action-link"
              @click="showFailedReports"
            >
              查看詳情
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區域 -->
    <div class="main-content">
      <!-- 左側：篩選和報表列表 -->
      <div class="content-left">
        <!-- 篩選控制 -->
        <div class="filter-section filters-section">
          <div class="filter-header">
            <h3 class="filter-title">
              🔍 篩選器
            </h3>
            <button
              v-if="hasActiveFilters"
              class="filter-reset"
              @click="resetFilters"
            >
              清除篩選
            </button>
          </div>

          <div class="filter-controls">
            <!-- 報表類型篩選 -->
            <div class="filter-group">
              <label class="filter-label">報表類型</label>
              <select
                v-model="filters.type"
                class="filter-select"
                @change="applyFilters"
              >
                <option value="">
                  全部類型
                </option>
                <optgroup
                  v-for="group in groupedReportTypes"
                  :key="group.category"
                  :label="group.title"
                >
                  <option
                    v-for="type in group.types"
                    :key="type.value"
                    :value="type.value"
                  >
                    {{ getReportTypeIcon(type.value) }} {{ type.label }}
                  </option>
                </optgroup>
              </select>
            </div>

            <!-- 狀態篩選 -->
            <div class="filter-group">
              <label class="filter-label">狀態</label>
              <select
                v-model="filters.status"
                class="filter-select"
                @change="applyFilters"
              >
                <option value="">
                  全部狀態
                </option>
                <option value="pending">
                  ⏳ 待處理
                </option>
                <option value="generating">
                  ⚙️ 生成中
                </option>
                <option value="completed">
                  ✅ 已完成
                </option>
                <option value="failed">
                  ❌ 失敗
                </option>
                <option value="expired">
                  ⏰ 已過期
                </option>
              </select>
            </div>

            <!-- 格式篩選 -->
            <div class="filter-group">
              <label class="filter-label">格式</label>
              <select
                v-model="filters.format"
                class="filter-select"
                @change="applyFilters"
              >
                <option value="">
                  全部格式
                </option>
                <option value="json">
                  📄 JSON
                </option>
                <option value="csv">
                  📊 CSV
                </option>
                <option value="excel">
                  📗 Excel
                </option>
                <option value="pdf">
                  📕 PDF
                </option>
                <option value="html">
                  🌐 HTML
                </option>
              </select>
            </div>

            <!-- 日期範圍篩選 -->
            <div class="filter-group">
              <label class="filter-label">建立時間</label>
              <div class="date-filters">
                <input
                  v-model="filters.startDate"
                  type="date"
                  class="filter-date"
                  @change="applyFilters"
                >
                <span class="date-separator">至</span>
                <input
                  v-model="filters.endDate"
                  type="date"
                  class="filter-date"
                  @change="applyFilters"
                >
              </div>
            </div>

            <!-- 搜尋 -->
            <div class="filter-group">
              <label class="filter-label">搜尋</label>
              <div class="search-input-wrapper">
                <input
                  v-model="searchQuery"
                  type="text"
                  class="search-input"
                  placeholder="搜尋報表標題..."
                  @input="debounceSearch"
                >
                <div class="search-icon">
                  🔍
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 報表列表 -->
        <div class="reports-section">
          <div class="reports-header">
            <h3 class="reports-title">
              📋 報表列表
            </h3>
            <div class="reports-controls">
              <div class="view-options">
                <button
                  class="view-toggle"
                  :class="{ 'active': viewMode === 'grid' }"
                  title="網格檢視"
                  @click="viewMode = 'grid'"
                >
                  ⊞
                </button>
                <button
                  class="view-toggle"
                  :class="{ 'active': viewMode === 'list' }"
                  title="列表檢視"
                  @click="viewMode = 'list'"
                >
                  ☰
                </button>
              </div>
              <div class="sort-options">
                <select
                  v-model="sortBy"
                  class="sort-select"
                  @change="applySort"
                >
                  <option value="createdAt">
                    建立時間
                  </option>
                  <option value="title">
                    標題
                  </option>
                  <option value="type">
                    類型
                  </option>
                  <option value="status">
                    狀態
                  </option>
                  <option value="fileSize">
                    檔案大小
                  </option>
                </select>
                <button
                  class="sort-direction"
                  :title="sortOrder === 'desc' ? '降序' : '升序'"
                  @click="toggleSortDirection"
                >
                  {{ sortOrder === 'desc' ? '↓' : '↑' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 載入狀態 -->
          <div
            v-if="loading"
            class="reports-loading"
          >
            <div class="loading-spinner">
              ⚙️
            </div>
            <div class="loading-text">
              載入報表列表...
            </div>
          </div>

          <!-- 錯誤狀態 -->
          <div
            v-else-if="error"
            class="reports-error"
          >
            <div class="error-icon">
              ❌
            </div>
            <div class="error-message">
              {{ error }}
            </div>
            <button
              class="btn btn-secondary"
              @click="loadReports"
            >
              重新載入
            </button>
          </div>

          <!-- 空狀態 -->
          <div
            v-else-if="reports.length === 0"
            class="reports-empty"
          >
            <div class="empty-icon">
              📊
            </div>
            <div class="empty-title">
              沒有找到報表
            </div>
            <div class="empty-message">
              <span v-if="hasActiveFilters">
                嘗試調整篩選條件或
                <button
                  class="link-button"
                  @click="resetFilters"
                >清除篩選</button>
              </span>
              <span v-else>
                開始建立您的第一個報表
              </span>
            </div>
            <button
              class="btn btn-primary"
              @click="$emit('create-report')"
            >
              ✨ 建立報表
            </button>
          </div>

          <!-- 報表列表 -->
          <div
            v-else
            class="reports-list"
            :class="viewMode"
          >
            <div
              v-for="report in reports"
              :key="report.id"
              class="report-item"
              @click="$emit('view-report', report.id)"
            >
              <!-- 網格檢視 -->
              <div
                v-if="viewMode === 'grid'"
                class="report-card"
              >
                <div class="card-header">
                  <div
                    class="report-type-badge"
                    :class="getTypeBadgeClass(report.type)"
                  >
                    {{ getReportTypeIcon(report.type) }}
                  </div>
                  <div class="card-actions">
                    <button
                      class="action-btn"
                      :disabled="!canDownload(report)"
                      title="下載"
                      @click.stop="downloadReport(report)"
                    >
                      📥
                    </button>
                    <button
                      class="action-btn"
                      :disabled="!canDelete(report)"
                      title="刪除"
                      @click.stop="deleteReport(report)"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="card-content">
                  <h4 class="report-title">
                    {{ report.title }}
                  </h4>
                  <p
                    v-if="report.description"
                    class="report-description"
                  >
                    {{ truncateText(report.description, 100) }}
                  </p>
                  <div class="report-meta">
                    <div class="meta-row">
                      <span class="meta-label">狀態：</span>
                      <span
                        class="status-badge"
                        :class="getStatusClass(report.status)"
                      >
                        {{ getStatusIcon(report.status) }} {{ getStatusLabel(report.status) }}
                      </span>
                    </div>
                    <div class="meta-row">
                      <span class="meta-label">格式：</span>
                      <span class="format-text">
                        {{ getFormatIcon(report.format) }} {{ getFormatLabel(report.format) }}
                      </span>
                    </div>
                    <div class="meta-row">
                      <span class="meta-label">建立：</span>
                      <span class="time-text">{{ formatRelativeTime(report.createdAt) }}</span>
                    </div>
                    <div
                      v-if="report.fileSize"
                      class="meta-row"
                    >
                      <span class="meta-label">大小：</span>
                      <span class="size-text">{{ formatFileSize(report.fileSize) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 列表檢視 -->
              <div
                v-else
                class="report-row"
              >
                <div class="row-main">
                  <div class="report-icon">
                    {{ getReportTypeIcon(report.type) }}
                  </div>
                  <div class="report-info">
                    <h4 class="report-title">
                      {{ report.title }}
                    </h4>
                    <div class="report-details">
                      <span class="detail-item">{{ getReportTypeLabel(report.type) }}</span>
                      <span class="detail-separator">•</span>
                      <span class="detail-item">{{ getFormatLabel(report.format) }}</span>
                      <span class="detail-separator">•</span>
                      <span class="detail-item">{{ formatRelativeTime(report.createdAt) }}</span>
                      <span
                        v-if="report.fileSize"
                        class="detail-separator"
                      >•</span>
                      <span
                        v-if="report.fileSize"
                        class="detail-item"
                      >{{ formatFileSize(report.fileSize) }}</span>
                    </div>
                  </div>
                </div>
                <div class="row-status">
                  <span
                    class="status-badge"
                    :class="getStatusClass(report.status)"
                  >
                    {{ getStatusIcon(report.status) }} {{ getStatusLabel(report.status) }}
                  </span>
                </div>
                <div class="row-actions">
                  <button
                    class="action-btn"
                    :disabled="!canDownload(report)"
                    title="下載"
                    @click.stop="downloadReport(report)"
                  >
                    📥
                  </button>
                  <button
                    class="action-btn"
                    :disabled="!canRegenerate(report)"
                    title="重新生成"
                    @click.stop="regenerateReport(report)"
                  >
                    🔄
                  </button>
                  <button
                    class="action-btn"
                    :disabled="!canDelete(report)"
                    title="刪除"
                    @click.stop="deleteReport(report)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 分頁控制 -->
          <div
            v-if="pagination.totalPages > 1"
            class="pagination-section"
          >
            <div class="pagination-info">
              顯示 {{ (pagination.page - 1) * pagination.pageSize + 1 }} -
              {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }}
              共 {{ pagination.total }} 項
            </div>
            <div class="pagination-controls">
              <button
                class="pagination-btn"
                :disabled="!pagination.hasPrev"
                @click="changePage(pagination.page - 1)"
              >
                ← 上一頁
              </button>
              <div class="page-numbers">
                <button
                  v-for="page in visiblePages"
                  :key="page"
                  class="page-btn"
                  :class="{ 'active': page === pagination.page }"
                  @click="changePage(page)"
                >
                  {{ page }}
                </button>
              </div>
              <button
                class="pagination-btn"
                :disabled="!pagination.hasNext"
                @click="changePage(pagination.page + 1)"
              >
                下一頁 →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：統計圖表和活動 -->
      <div class="content-right">
        <!-- 熱門報表類型 -->
        <div class="widget-card">
          <div class="widget-header">
            <h3 class="widget-title">
              🔥 熱門報表類型
            </h3>
          </div>
          <div class="widget-content">
            <div class="popular-types">
              <div
                v-for="type in stats.popularTypes"
                :key="type.type"
                class="popular-item"
              >
                <div class="popular-icon">
                  {{ getReportTypeIcon(type.type) }}
                </div>
                <div class="popular-info">
                  <div class="popular-name">
                    {{ type.label }}
                  </div>
                  <div class="popular-stats">
                    {{ type.count }} 次生成
                  </div>
                </div>
                <div class="popular-percentage">
                  {{ type.percentage }}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 最近活動 -->
        <div class="widget-card">
          <div class="widget-header">
            <h3 class="widget-title">
              ⚡ 最近活動
            </h3>
          </div>
          <div class="widget-content">
            <div class="activity-list">
              <div
                v-for="activity in stats.recentActivity"
                :key="activity.id"
                class="activity-item"
              >
                <div class="activity-icon">
                  {{ getActivityIcon(activity.action) }}
                </div>
                <div class="activity-info">
                  <div class="activity-text">
                    <span class="activity-action">{{ activity.action }}</span>
                    <span class="activity-target">{{ activity.reportTitle }}</span>
                  </div>
                  <div class="activity-meta">
                    <span class="activity-user">{{ activity.user }}</span>
                    <span class="activity-time">{{ formatRelativeTime(activity.timestamp) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 快速動作 -->
        <div class="widget-card">
          <div class="widget-header">
            <h3 class="widget-title">
              ⚡ 快速動作
            </h3>
          </div>
          <div class="widget-content">
            <div class="quick-actions">
              <button
                class="quick-action-btn"
                @click="$emit('create-report', 'conversation_summary')"
              >
                <div class="action-icon">
                  💬
                </div>
                <div class="action-text">
                  對話摘要
                </div>
              </button>
              <button
                class="quick-action-btn"
                @click="$emit('create-report', 'agent_performance')"
              >
                <div class="action-icon">
                  👤
                </div>
                <div class="action-text">
                  客服績效
                </div>
              </button>
              <button
                class="quick-action-btn"
                @click="$emit('create-report', 'team_analytics')"
              >
                <div class="action-icon">
                  👥
                </div>
                <div class="action-text">
                  團隊分析
                </div>
              </button>
              <button
                class="quick-action-btn"
                @click="$emit('view-templates')"
              >
                <div class="action-icon">
                  📋
                </div>
                <div class="action-text">
                  瀏覽模板
                </div>
              </button>
              <button
                class="quick-action-btn"
                @click="$emit('view-scheduled')"
              >
                <div class="action-icon">
                  ⏰
                </div>
                <div class="action-text">
                  排程報表
                </div>
              </button>
              <button
                class="quick-action-btn"
                @click="exportAllReports"
              >
                <div class="action-icon">
                  📤
                </div>
                <div class="action-text">
                  批量匯出
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 刪除確認對話框 -->
    <ConfirmDialog
      v-if="showDeleteDialog"
      :title="`刪除報表`"
      :message="`確定要刪除「${reportToDelete?.title}」嗎？此操作無法復原。`"
      confirm-text="刪除"
      confirm-class="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import ReportsAPI from '@/api/reports';
import type {
  ReportBase,
  ReportListQuery,
  DashboardStats,
  ReportType,
  ReportFormat,
  ReportStatus
} from '@/types/reports';

// 導入子組件
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

// Emits
const emit = defineEmits<{
  'create-report': [initialType?: ReportType];
  'view-report': [reportId: string];
  'view-templates': [];
  'view-scheduled': [];
}>();

// Router removed as it was not used

// 響應式資料
const loading = ref(true);
const error = ref<string | null>(null);
const reports = ref<ReportBase[]>([]);
const stats = reactive<DashboardStats>({
  totalReports: 0,
  pendingReports: 0,
  completedReports: 0,
  failedReports: 0,
  todayGenerated: 0,
  thisWeekGenerated: 0,
  thisMonthGenerated: 0,
  popularTypes: [],
  recentActivity: []
});

// 分頁資料
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
});

// 篩選和排序
const filters = reactive<ReportListQuery>({
  type: undefined,
  status: undefined,
  format: undefined,
  startDate: undefined,
  endDate: undefined
});

const sortBy = ref('createdAt');
const sortOrder = ref<'asc' | 'desc'>('desc');
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');

// UI 狀態
const showDeleteDialog = ref(false);
const reportToDelete = ref<ReportBase | null>(null);

// 搜尋防抖
let searchTimeout: NodeJS.Timeout | null = null;

// 計算屬性
const completionRate = computed(() => {
  if (stats.totalReports === 0) {return 0;}
  return Math.round((stats.completedReports / stats.totalReports) * 100);
});

const hasActiveFilters = computed(() => {
  return filters.type ||
         filters.status ||
         filters.format ||
         filters.startDate ||
         filters.endDate ||
         searchQuery.value;
});

const groupedReportTypes = computed(() => {
  const types = ReportsAPI.getAvailableReportTypes() || [];

  return [
    {
      category: 'basic',
      title: '📊 基礎報表',
      types: types.filter(t => ['conversation_summary', 'agent_performance', 'team_analytics', 'customer_satisfaction', 'platform_usage', 'message_statistics', 'response_time_analysis', 'workload_distribution', 'system_health', 'custom'].includes(t.value))
    },
    {
      category: 'enterprise',
      title: '👑 企業級報表',
      types: types.filter(t => ['cost_analysis', 'sla_compliance', 'anomaly_detection', 'audit_trail', 'resource_utilization'].includes(t.value))
    },
    {
      category: 'business_intelligence',
      title: '📈 商業智能',
      types: types.filter(t => ['trend_forecast', 'customer_insights', 'channel_integration', 'goal_achievement', 'automation_effectiveness'].includes(t.value))
    },
    {
      category: 'advanced_analytics',
      title: '🔬 高級分析',
      types: types.filter(t => ['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(t.value))
    }
  ];
});

const visiblePages = computed(() => {
  const pages: number[] = [];
  const totalPages = pagination.totalPages;
  const currentPage = pagination.page;

  // 最多顯示7個頁碼
  let start = Math.max(1, currentPage - 3);
  const end = Math.min(totalPages, start + 6);

  // 調整開始位置
  if (end - start < 6) {
    start = Math.max(1, end - 6);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

// 方法
const loadReports = async () => {
  loading.value = true;
  error.value = null;

  try {
    const query: ReportListQuery = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...filters
    };

    // 添加搜尋查詢
    if (searchQuery.value.trim()) {
      // 搜尋功能暫時通過客戶端過濾實現
      // query.search = searchQuery.value.trim();
    }

    const response = await ReportsAPI.listReports(query);

    reports.value = response.reports;

    // 更新分頁資料
    Object.assign(pagination, response.pagination);

  } catch (err) {
    console.error('載入報表列表失敗:', err);
    error.value = err instanceof Error ? err.message : '載入報表列表失敗';
  } finally {
    loading.value = false;
  }
};

const loadStatistics = async () => {
  try {
    const statistics = await ReportsAPI.getReportStatistics('last_30_days');

    // 更新統計資料
    stats.totalReports = statistics.totalReports;
    stats.pendingReports = statistics.reportsByStatus.pending || 0;
    stats.completedReports = statistics.reportsByStatus.completed || 0;
    stats.failedReports = statistics.reportsByStatus.failed || 0;

    // 計算熱門類型
    stats.popularTypes = Object.entries(statistics.reportsByType)
      .map(([type, count]) => ({
        type: type as ReportType,
        label: getReportTypeLabel(type as ReportType),
        count,
        percentage: Math.round((count / statistics.totalReports) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 模擬最近活動（在實際實現中應該從API獲取）
    stats.recentActivity = [
      {
        id: '1',
        action: '已生成',
        reportTitle: '客服績效報告',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        user: '張小明'
      },
      {
        id: '2',
        action: '已下載',
        reportTitle: '對話摘要報告',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        user: '李小華'
      },
      {
        id: '3',
        action: '已刪除',
        reportTitle: '系統健康報告',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        user: '王小美'
      }
    ];

    // 計算本月生成數量
    const thisMonth = new Date().getMonth();
    const thisMonthData = statistics.monthlyTrends?.find(trend =>
      new Date(trend.month).getMonth() === thisMonth
    );
    stats.thisMonthGenerated = thisMonthData?.reportsGenerated || 0;

  } catch (err) {
    console.error('載入統計資料失敗:', err);
  }
};

const refreshData = async () => {
  await Promise.all([
    loadReports(),
    loadStatistics()
  ]);
};

const applyFilters = () => {
  pagination.page = 1; // 重置到第一頁
  loadReports();
};

const resetFilters = () => {
  filters.type = undefined;
  filters.status = undefined;
  filters.format = undefined;
  filters.startDate = undefined;
  filters.endDate = undefined;
  searchQuery.value = '';
  applyFilters();
};

const applySort = () => {
  pagination.page = 1; // 重置到第一頁
  loadReports();
};

const toggleSortDirection = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  applySort();
};

const debounceSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    applyFilters();
  }, 500);
};

const changePage = (page: number) => {
  if (page >= 1 && page <= pagination.totalPages) {
    pagination.page = page;
    loadReports();
  }
};

const showFailedReports = () => {
  filters.status = 'failed';
  applyFilters();
};

// 報表操作方法
const canDownload = (report: ReportBase): boolean => {
  return report.status === 'completed' && !!report.downloadUrl;
};

const canRegenerate = (report: ReportBase): boolean => {
  return ['failed', 'expired'].includes(report.status);
};

const canDelete = (report: ReportBase): boolean => {
  return !['generating'].includes(report.status);
};

const downloadReport = async (report: ReportBase) => {
  if (!canDownload(report)) {return;}

  try {
    const downloadInfo = await ReportsAPI.downloadReport(report.id);

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
  }
};

const regenerateReport = (report: ReportBase) => {
  if (!canRegenerate(report)) {return;}

  // 導航到報表生成器，預填報表類型
  emit('create-report', report.type);
};

const deleteReport = (report: ReportBase) => {
  if (!canDelete(report)) {return;}

  reportToDelete.value = report;
  showDeleteDialog.value = true;
};

const confirmDelete = async () => {
  if (!reportToDelete.value) {return;}

  try {
    await ReportsAPI.deleteReport(reportToDelete.value.id);

    // 從列表中移除
    const reportId = reportToDelete.value.id;
    const index = reports.value.findIndex(r => r.id === reportId);
    if (index !== -1) {
      reports.value.splice(index, 1);
    }

    // 更新統計
    stats.totalReports--;
    if (reportToDelete.value.status === 'completed') {
      stats.completedReports--;
    }

  } catch (err) {
    console.error('刪除報表失敗:', err);
  } finally {
    showDeleteDialog.value = false;
    reportToDelete.value = null;
  }
};

const exportAllReports = async () => {
  try {
    const batchOperation = {
      reportIds: (reports.value || [])
        .filter(r => r.status === 'completed')
        .map(r => r.id),
      action: 'export' as const,
      options: {
        format: 'csv' as ReportFormat,
        mergeReports: true
      }
    };

    const result = await ReportsAPI.batchOperation(batchOperation);

    if (result.success) {
      // 處理批量匯出成功
      console.log('批量匯出成功:', result);
    }

  } catch (err) {
    console.error('批量匯出失敗:', err);
  }
};

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
    'json': 'JSON',
    'csv': 'CSV',
    'excel': 'Excel',
    'pdf': 'PDF',
    'html': 'HTML'
  };
  return formatMap[format] || format.toUpperCase();
};

const getActivityIcon = (action: string): string => {
  const actionMap: Record<string, string> = {
    '已生成': '✨',
    '已下載': '📥',
    '已刪除': '🗑️',
    '已分享': '🔗',
    '已匯出': '📤'
  };
  return actionMap[action] || '📋';
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return '剛剛';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小時前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return date.toLocaleDateString('zh-TW');
  }
};

const formatFileSize = (bytes: number): string => {
  return ReportsAPI.formatFileSize(bytes);
};

const truncateText = (text: string, length: number): string => {
  if (text.length <= length) {return text;}
  return `${text.substring(0, length)  }...`;
};

// 生命週期
onMounted(() => {
  refreshData();
});

// 監聽器
watch([sortBy, sortOrder], () => {
  applySort();
});
</script>

<style scoped>
.report-dashboard {
  max-width: 1600px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.header-content {
  flex: 1;
}

.dashboard-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.dashboard-subtitle {
  color: #6b7280;
  font-size: 1.2rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.stats-section {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.1);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  position: relative;
}

.stat-icon {
  font-size: 3rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #6b7280;
  font-size: 1.1rem;
  font-weight: 500;
}

.stat-trend {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.trend-indicator.up {
  color: #10b981;
}

.trend-text {
  color: #6b7280;
}

.stat-progress {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  width: 80px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-indicator {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  animation: pulse 2s infinite;
}

.indicator-text {
  color: #3b82f6;
  font-weight: 500;
}

.stat-action {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
}

.action-link {
  color: #ef4444;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: underline;
}

.action-link:hover {
  color: #dc2626;
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filter-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.filter-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.filter-reset {
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
}

.filter-reset:hover {
  color: #374151;
}

.filter-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  font-weight: 500;
  color: #374151;
  font-size: 0.9rem;
}

.filter-select,
.filter-date,
.search-input {
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.filter-select:focus,
.filter-date:focus,
.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.date-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-separator {
  color: #6b7280;
  font-size: 0.9rem;
}

.search-input-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
  padding-right: 2.5rem;
}

.search-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  pointer-events: none;
}

.reports-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.reports-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.reports-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-options {
  display: flex;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
}

.view-toggle {
  padding: 0.5rem 0.75rem;
  background: white;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.view-toggle:hover {
  background: #f3f4f6;
}

.view-toggle.active {
  background: #3b82f6;
  color: white;
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.sort-direction {
  width: 32px;
  height: 32px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.sort-direction:hover {
  background: #f3f4f6;
}

.reports-loading,
.reports-error,
.reports-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
}

.loading-spinner {
  font-size: 3rem;
  animation: spin 2s linear infinite;
  margin-bottom: 1rem;
}

.loading-text {
  color: #6b7280;
  font-size: 1.1rem;
}

.error-icon,
.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.error-message,
.empty-title {
  color: #1f2937;
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.empty-message {
  color: #6b7280;
  margin-bottom: 2rem;
}

.link-button {
  color: #3b82f6;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.link-button:hover {
  color: #2563eb;
}

.reports-list {
  min-height: 400px;
}

.reports-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}

.reports-list.list {
  display: flex;
  flex-direction: column;
}

.report-item {
  cursor: pointer;
  transition: all 0.2s;
}

.report-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.report-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.report-type-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 1.2rem;
}

.report-type-badge.basic {
  background: #dbeafe;
}

.report-type-badge.enterprise {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.report-type-badge.business-intelligence {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.report-type-badge.advanced {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-content {
  flex: 1;
}

.report-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.report-description {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.report-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.meta-label {
  color: #6b7280;
  font-weight: 500;
  min-width: 40px;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
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

.format-text,
.time-text,
.size-text {
  color: #374151;
  font-weight: 500;
}

.report-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s;
}

.report-row:hover {
  background: #f8fafc;
}

.report-row:last-child {
  border-bottom: none;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.report-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 8px;
}

.report-info {
  flex: 1;
}

.report-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.detail-item {
  color: #6b7280;
}

.detail-separator {
  color: #d1d5db;
}

.row-status {
  margin-right: 1rem;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
}

.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
}

.pagination-info {
  color: #6b7280;
  font-size: 0.9rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.page-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.page-btn:hover {
  background: #f3f4f6;
}

.page-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.content-right {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.widget-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.widget-header {
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.widget-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.widget-content {
  padding: 1.5rem;
}

.popular-types {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.popular-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.popular-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 8px;
}

.popular-info {
  flex: 1;
}

.popular-name {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.popular-stats {
  font-size: 0.9rem;
  color: #6b7280;
}

.popular-percentage {
  font-weight: 600;
  color: #3b82f6;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.activity-icon {
  font-size: 1.25rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 8px;
}

.activity-info {
  flex: 1;
}

.activity-text {
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.activity-action {
  font-weight: 500;
}

.activity-target {
  color: #6b7280;
}

.activity-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #9ca3af;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.quick-action-btn:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.action-icon {
  font-size: 1.5rem;
}

.action-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 響應式設計 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .content-right {
    order: -1;
  }

  .quick-actions {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .report-dashboard {
    padding: 1rem;
  }

  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .filter-controls {
    grid-template-columns: 1fr;
  }

  .reports-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .reports-controls {
    justify-content: space-between;
  }

  .reports-list.grid {
    grid-template-columns: 1fr;
  }

  .report-row {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .row-main {
    flex-direction: column;
    align-items: stretch;
  }

  .report-details {
    flex-wrap: wrap;
  }

  .pagination-section {
    flex-direction: column;
    gap: 1rem;
  }

  .pagination-controls {
    flex-wrap: wrap;
  }

  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
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