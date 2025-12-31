<template>
  <div class="metrics-comparison-dashboard">
    <!-- 標題與時間範圍選擇 -->
    <div class="dashboard-header">
      <h2 class="dashboard-title">
        {{ title }}
      </h2>

      <div class="period-selector">
        <button
          v-for="presetOption in periodPresets"
          :key="presetOption.value"
          class="period-button"
          :class="{ 'active': selectedPreset === presetOption.value }"
          @click="selectPreset(presetOption.value)"
        >
          {{ presetOption.label }}
        </button>
        <button
          class="period-button"
          :class="{ 'active': selectedPreset === 'custom' }"
          @click="showCustomPeriodModal = true"
        >
          自訂期間
        </button>
      </div>
    </div>

    <!-- 載入狀態 -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <div class="spinner" />
      <p>正在載入比較數據...</p>
    </div>

    <!-- 錯誤狀態 -->
    <div
      v-else-if="error"
      class="error-state"
    >
      <div class="error-icon">
        ⚠️
      </div>
      <p class="error-message">
        {{ error }}
      </p>
      <button
        class="retry-button"
        @click="loadData"
      >
        重試
      </button>
    </div>

    <!-- 比較指標網格 -->
    <div
      v-else
      class="metrics-grid"
    >
      <MetricComparison
        v-for="(comparison, metricKey) in comparisonData?.metrics"
        :key="metricKey"
        :label="getMetricLabel(metricKey)"
        :data="comparison"
        :expandable="true"
        :show-tooltip="true"
        :value-formatter="getValueFormatter(metricKey)"
      >
        <template #history>
          <div class="metric-history">
            <!-- 可以在這裡添加歷史趨勢圖 -->
            <p class="history-note">
              歷史數據功能將在未來版本中提供
            </p>
          </div>
        </template>
      </MetricComparison>
    </div>

    <!-- 總體趨勢摘要 -->
    <div
      v-if="comparisonData?.summary"
      class="summary-section"
    >
      <div class="summary-card">
        <h3 class="summary-title">
          總體趨勢摘要
        </h3>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">總指標數</span>
            <span class="stat-value">{{ comparisonData.summary.totalMetrics }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">改善指標</span>
            <span class="stat-value text-up">{{ comparisonData.summary.improvedMetrics }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">下降指標</span>
            <span class="stat-value text-down">{{ comparisonData.summary.declinedMetrics }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">穩定指標</span>
            <span class="stat-value text-stable">{{ comparisonData.summary.stableMetrics }}</span>
          </div>
          <div class="stat-item overall-trend">
            <span class="stat-label">整體趨勢</span>
            <span
              class="stat-value trend-badge"
              :class="`trend-${comparisonData.summary.overallTrend}`"
            >
              {{ getTrendLabel(comparisonData.summary.overallTrend) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快取狀態資訊 -->
    <div
      v-if="cacheStats"
      class="cache-info"
    >
      <button
        class="cache-toggle"
        @click="showCacheStats = !showCacheStats"
      >
        <span>快取統計</span>
        <span class="toggle-icon">{{ showCacheStats ? '▼' : '▶' }}</span>
      </button>
      <transition name="slide-down">
        <div
          v-if="showCacheStats"
          class="cache-details"
        >
          <div class="cache-stat">
            <span>命中率:</span>
            <span class="cache-value">{{ cacheStats.hitRate.toFixed(2) }}%</span>
          </div>
          <div class="cache-stat">
            <span>命中次數:</span>
            <span class="cache-value">{{ cacheStats.hits }}</span>
          </div>
          <div class="cache-stat">
            <span>未命中:</span>
            <span class="cache-value">{{ cacheStats.misses }}</span>
          </div>
          <div class="cache-stat">
            <span>總請求:</span>
            <span class="cache-value">{{ cacheStats.totalRequests }}</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 自訂期間選擇 Modal (簡化版) -->
    <div
      v-if="showCustomPeriodModal"
      class="modal-overlay"
      @click="showCustomPeriodModal = false"
    >
      <div
        class="modal-content"
        @click.stop
      >
        <h3>選擇自訂期間</h3>
        <div class="date-inputs">
          <div class="input-group">
            <label>開始時間</label>
            <input
              v-model="customPeriod.start"
              type="datetime-local"
            >
          </div>
          <div class="input-group">
            <label>結束時間</label>
            <input
              v-model="customPeriod.end"
              type="datetime-local"
            >
          </div>
        </div>
        <div class="modal-actions">
          <button
            class="btn-cancel"
            @click="showCustomPeriodModal = false"
          >
            取消
          </button>
          <button
            class="btn-apply"
            @click="applyCustomPeriod"
          >
            套用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import MetricComparison from './MetricComparison.vue';
import type { MultiMetricComparison } from '../../types/analytics';
import { getBackendUrl } from '@/config/runtime';

interface Props {
  title?: string;
  preset?: 'conversation' | 'message' | 'user-activity' | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  title: '指標比較儀表板',
  preset: null,
  autoRefresh: false,
  refreshInterval: 30000
});

// 狀態管理
const loading = ref(false);
const error = ref<string | null>(null);
const comparisonData = ref<MultiMetricComparison | null>(null);
const cacheStats = ref<{
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
} | null>(null);
const showCacheStats = ref(false);
const selectedPreset = ref('7d');
const showCustomPeriodModal = ref(false);
const customPeriod = ref({
  start: '',
  end: ''
});

// ⚡ LCP 優化：本地快取機制
interface LocalCache {
  data: MultiMetricComparison;
  timestamp: number;
  preset: string;
}

const CACHE_KEY = 'analytics_comparison_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取

function getLocalCache(): LocalCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {return null;}

    const parsed = JSON.parse(cached) as LocalCache;
    const isExpired = Date.now() - parsed.timestamp > CACHE_TTL;
    const isSamePreset = parsed.preset === selectedPreset.value;

    if (isExpired || !isSamePreset) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setLocalCache(data: MultiMetricComparison): void {
  try {
    const cache: LocalCache = {
      data,
      timestamp: Date.now(),
      preset: selectedPreset.value
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('無法儲存快取:', err);
  }
}

// 期間預設選項
const periodPresets = [
  { label: '過去 1 小時', value: '1h' },
  { label: '今天', value: '1d' },
  { label: '過去 7 天', value: '7d' },
  { label: '過去 30 天', value: '30d' },
  { label: '過去 90 天', value: '90d' }
];

// 指標標籤映射
const metricLabels: Record<string, string> = {
  totalConversations: '總對話數',
  activeConversations: '活躍對話',
  closedConversations: '已關閉對話',
  totalMessages: '總消息數',
  customerMessages: '客戶消息',
  agentMessages: '客服消息',
  activeUsers: '活躍用戶',
  totalActivities: '總活動數',
  averageResponseTime: '平均回應時間',
  firstResponseTime: '首次回應時間'
};

// 計算當前與上一期間
const currentPeriod = computed(() => {
  const end = new Date();
  const start = new Date();

  switch (selectedPreset.value) {
    case '1h':
      start.setHours(start.getHours() - 1);
      break;
    case '1d':
      start.setHours(0, 0, 0, 0);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'custom':
      return {
        start: customPeriod.value.start,
        end: customPeriod.value.end
      };
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
});

// 載入數據
async function loadData() {
  // ⚡ LCP 優化：先嘗試從本地快取獲取數據
  const cachedData = getLocalCache();
  if (cachedData) {
    console.log('⚡ [Analytics] 使用本地快取數據');
    comparisonData.value = cachedData.data;
    // 在背景更新數據
    loadDataFromAPI(true);
    return;
  }

  await loadDataFromAPI(false);
}

// 從 API 載入數據
async function loadDataFromAPI(isBackground: boolean) {
  if (!isBackground) {
    loading.value = true;
  }
  error.value = null;

  try {
    const apiUrl = getBackendUrl();

    // 根據 preset 決定使用哪個 API endpoint
    let endpoint = '/api/analytics/comparison/metrics';
    const params = new URLSearchParams({
      currentStart: currentPeriod.value.start,
      currentEnd: currentPeriod.value.end
    });

    if (props.preset) {
      endpoint = `/api/analytics/comparison/preset/${props.preset}`;
    } else {
      // 預設查詢所有常用指標
      params.append('metrics', 'total_conversations,active_conversations,closed_conversations,total_messages');
    }

    const response = await fetch(`${apiUrl}${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '載入數據失敗');
    }

    comparisonData.value = result.data;

    // ⚡ LCP 優化：儲存到本地快取
    setLocalCache(result.data);
    console.log('⚡ [Analytics] 數據已更新並快取');

    // 載入快取統計（非阻塞）
    loadCacheStats().catch(err => console.warn('快取統計載入失敗:', err));

  } catch (err) {
    console.error('載入比較數據失敗:', err);
    if (!isBackground) {
      error.value = err instanceof Error ? err.message : '未知錯誤';
    }
  } finally {
    if (!isBackground) {
      loading.value = false;
    }
  }
}

// 載入快取統計
async function loadCacheStats() {
  try {
    const apiUrl = getBackendUrl();
    const response = await fetch(`${apiUrl}/api/analytics/comparison/cache/stats`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        cacheStats.value = result.data;
      }
    }
  } catch (err) {
    console.error('載入快取統計失敗:', err);
  }
}

// 選擇預設期間
function selectPreset(preset: string) {
  selectedPreset.value = preset;
  loadData();
}

// 套用自訂期間
function applyCustomPeriod() {
  if (!customPeriod.value.start || !customPeriod.value.end) {
    error.value = '請選擇開始和結束時間';
    return;
  }

  selectedPreset.value = 'custom';
  showCustomPeriodModal.value = false;
  loadData();
}

// 取得指標標籤
function getMetricLabel(metricKey: string): string {
  return metricLabels[metricKey] || metricKey;
}

// 取得趨勢標籤
function getTrendLabel(trend: string): string {
  const labels: Record<string, string> = {
    positive: '正向',
    negative: '負向',
    neutral: '中性',
    mixed: '混合'
  };
  return labels[trend] || trend;
}

// 取得數值格式化函數
function getValueFormatter(metricKey: string): (_value: number) => string {
  // 時間相關指標使用不同格式
  if (metricKey.includes('time')) {
    return (_value: number) => {
      if (_value < 60) {return `${_value.toFixed(0)}秒`;}
      if (_value < 3600) {return `${(_value / 60).toFixed(1)}分鐘`;}
      return `${(_value / 3600).toFixed(1)}小時`;
    };
  }

  // 預設數值格式
  return (_value: number) => _value.toLocaleString();
}

// ⚡ LCP 優化：延遲加載數據
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  // ⚡ LCP 優化：使用 requestIdleCallback 延遲加載，避免阻塞首次渲染
  // 這確保 Dashboard 主要內容先顯示，Analytics 數據在瀏覽器空閒時加載
  const scheduleDataLoad = () => {
    loadData();

    // 自動刷新
    if (props.autoRefresh) {
      refreshIntervalId = setInterval(loadData, props.refreshInterval);
    }
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(scheduleDataLoad, { timeout: 2000 });
  } else {
    // Fallback: 延遲 300ms 讓 LCP 優先完成
    setTimeout(scheduleDataLoad, 300);
  }
});

// 清理定時器
onBeforeUnmount(() => {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
});
</script>

<style scoped>
.metrics-comparison-dashboard {
  padding: 24px;
  background: #f9fafb;
  min-height: 100vh;
}

/* 標題與選擇器 */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.dashboard-title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.period-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.period-button {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.period-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.period-button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

/* 載入與錯誤狀態 */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  color: #ef4444;
  font-size: 16px;
  margin-bottom: 16px;
}

.retry-button {
  padding: 10px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-button:hover {
  background: #2563eb;
}

/* 指標網格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

/* 總體摘要 */
.summary-section {
  margin-bottom: 32px;
}

.summary-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.summary-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 20px 0;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.stat-value.text-up {
  color: #10b981;
}

.stat-value.text-down {
  color: #ef4444;
}

.stat-value.text-stable {
  color: #6b7280;
}

.trend-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
}

.trend-badge.trend-positive {
  background: #d1fae5;
  color: #065f46;
}

.trend-badge.trend-negative {
  background: #fee2e2;
  color: #991b1b;
}

.trend-badge.trend-neutral,
.trend-badge.trend-mixed {
  background: #f3f4f6;
  color: #374151;
}

/* 快取資訊 */
.cache-info {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.cache-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  padding: 0;
}

.toggle-icon {
  color: #9ca3af;
}

.cache-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.cache-stat {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #6b7280;
}

.cache-value {
  font-weight: 600;
  color: #111827;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
}

.date-inputs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 20px 0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.input-group input {
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-cancel,
.btn-apply {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-apply {
  background: #3b82f6;
  color: white;
}

.btn-apply:hover {
  background: #2563eb;
}

/* 動畫 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 300px;
  opacity: 1;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .metrics-comparison-dashboard {
    padding: 16px;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: stretch;
  }

  .period-selector {
    justify-content: stretch;
  }

  .period-button {
    flex: 1;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .summary-stats {
    grid-template-columns: 1fr;
  }
}
</style>