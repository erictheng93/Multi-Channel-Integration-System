<!-- 報表模板選擇器組件 -->
<!-- Report Templates Selector Component with comprehensive preset configurations -->

<template>
  <div class="report-templates">
    <!-- 標題區 -->
    <div class="templates-header">
      <h1 class="page-title">
        <i class="icon">📋</i>
        報表模板
      </h1>
      <p class="page-description">
        選擇預設模板快速生成報表，或自定義配置
      </p>
    </div>

    <!-- 搜尋和篩選 -->
    <div class="filters-section">
      <div class="filter-controls">
        <div class="search-box">
          <i class="search-icon">🔍</i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋模板..."
            class="search-input"
          >
        </div>

        <div class="category-filter">
          <label>類別：</label>
          <select
            v-model="selectedCategory"
            class="category-select"
          >
            <option value="">
              全部類別
            </option>
            <option value="basic">
              基礎報表
            </option>
            <option value="enterprise">
              企業級
            </option>
            <option value="business_intelligence">
              商業智能
            </option>
            <option value="advanced_analytics">
              高級分析
            </option>
          </select>
        </div>

        <div class="time-filter">
          <label>預估時間：</label>
          <select
            v-model="selectedTimeRange"
            class="time-select"
          >
            <option value="">
              不限
            </option>
            <option value="fast">
              快速 (&lt; 30秒)
            </option>
            <option value="medium">
              中等 (30秒-2分鐘)
            </option>
            <option value="slow">
              較慢 (> 2分鐘)
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- 載入狀態 -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <div class="loading-spinner" />
      <p>載入模板中...</p>
    </div>

    <!-- 錯誤狀態 -->
    <div
      v-else-if="error"
      class="error-state"
    >
      <div class="error-icon">
        ❌
      </div>
      <h3>載入失敗</h3>
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadTemplates"
      >
        重試
      </button>
    </div>

    <!-- 模板網格 -->
    <div
      v-else
      class="templates-grid"
    >
      <div
        v-for="template in filteredTemplates"
        :key="template.name"
        class="template-card"
        :class="{ selected: selectedTemplate?.name === template.name }"
        @click="selectTemplate(template)"
      >
        <!-- 模板圖標和基本資訊 -->
        <div class="template-header">
          <div class="template-icon">
            {{ template.icon }}
          </div>
          <div class="template-basic-info">
            <h3 class="template-name">
              {{ template.name }}
            </h3>
            <p class="template-description">
              {{ template.description }}
            </p>
          </div>
          <div class="template-category">
            <span
              class="category-badge"
              :class="template.category"
            >
              {{ getCategoryLabel(template.category) }}
            </span>
          </div>
        </div>

        <!-- 模板詳細資訊 -->
        <div class="template-details">
          <div class="template-type">
            <strong>報表類型：</strong>
            <span class="type-label">{{ getReportTypeLabel(template.type) }}</span>
          </div>

          <div class="template-time">
            <strong>預估時間：</strong>
            <span class="time-estimate">{{ formatEstimatedTime(template.estimatedTime) }}</span>
          </div>

          <div class="template-filters">
            <strong>必需篩選：</strong>
            <div class="required-filters">
              <span
                v-for="filter in template.requiredFilters"
                :key="filter"
                class="filter-tag required"
              >
                {{ getFilterLabel(filter) }}
              </span>
              <span
                v-if="template.requiredFilters.length === 0"
                class="no-filters"
              >
                無必需篩選
              </span>
            </div>
          </div>

          <div
            v-if="template.optionalFilters.length > 0"
            class="template-optional-filters"
          >
            <strong>可選篩選：</strong>
            <div class="optional-filters">
              <span
                v-for="filter in template.optionalFilters"
                :key="filter"
                class="filter-tag optional"
              >
                {{ getFilterLabel(filter) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 選擇指示器 -->
        <div
          v-if="selectedTemplate?.name === template.name"
          class="selection-indicator"
        >
          <i class="check-icon">✓</i>
        </div>
      </div>
    </div>

    <!-- 空狀態 -->
    <div
      v-if="!loading && !error && filteredTemplates.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        📭
      </div>
      <h3>找不到符合條件的模板</h3>
      <p>請嘗試調整篩選條件或搜尋關鍵字</p>
    </div>

    <!-- 選中模板詳情 -->
    <div
      v-if="selectedTemplate"
      class="selected-template-details"
    >
      <div class="details-header">
        <h2>模板詳情</h2>
        <button
          class="close-details"
          @click="selectedTemplate = null"
        >
          ✕
        </button>
      </div>

      <div class="details-content">
        <div class="template-summary">
          <div class="summary-icon">
            {{ selectedTemplate.icon }}
          </div>
          <div class="summary-info">
            <h3>{{ selectedTemplate.name }}</h3>
            <p>{{ selectedTemplate.description }}</p>
            <div class="summary-meta">
              <span class="meta-item">
                類別：{{ getCategoryLabel(selectedTemplate.category) }}
              </span>
              <span class="meta-item">
                預估時間：{{ formatEstimatedTime(selectedTemplate.estimatedTime) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 預設選項預覽 -->
        <div class="preset-options">
          <h4>預設選項</h4>
          <div class="options-grid">
            <div class="option-item">
              <strong>包含圖表：</strong>
              <span>{{ selectedTemplate.presetOptions.includeCharts ? '是' : '否' }}</span>
            </div>
            <div class="option-item">
              <strong>包含摘要：</strong>
              <span>{{ selectedTemplate.presetOptions.includeSummary ? '是' : '否' }}</span>
            </div>
            <div class="option-item">
              <strong>包含詳細資料：</strong>
              <span>{{ selectedTemplate.presetOptions.includeDetails ? '是' : '否' }}</span>
            </div>
            <div
              v-if="selectedTemplate.presetOptions.chartType"
              class="option-item"
            >
              <strong>圖表類型：</strong>
              <span>{{ getChartTypeLabel(selectedTemplate.presetOptions.chartType) }}</span>
            </div>
            <div
              v-if="selectedTemplate.presetOptions.maxRecords"
              class="option-item"
            >
              <strong>最大記錄數：</strong>
              <span>{{ selectedTemplate.presetOptions.maxRecords.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <!-- 動作按鈕 -->
        <div class="template-actions">
          <button
            class="use-template-btn primary"
            :disabled="generating"
            @click="useTemplate(selectedTemplate)"
          >
            <span v-if="!generating">使用此模板</span>
            <span v-else>
              <div class="button-spinner" />
              生成中...
            </span>
          </button>

          <button
            class="customize-template-btn secondary"
            @click="customizeTemplate(selectedTemplate)"
          >
            自定義設定
          </button>
        </div>
      </div>
    </div>

    <!-- 快速動作工具列 -->
    <div
      v-if="!selectedTemplate"
      class="quick-actions"
    >
      <div class="quick-actions-content">
        <h3>快速動作</h3>
        <div class="quick-buttons">
          <button
            v-for="quickTemplate in popularTemplates"
            :key="quickTemplate.name"
            class="quick-btn"
            :disabled="generating"
            @click="useTemplate(quickTemplate)"
          >
            <span class="quick-icon">{{ quickTemplate.icon }}</span>
            <span class="quick-label">{{ quickTemplate.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate, ReportType } from '@/types/reports';
import ReportsAPI from '@/api/reports';

// 路由器
const router = useRouter();

// 組件狀態
const loading = ref(false);
const error = ref<string | null>(null);
const generating = ref(false);
const templates = ref<ReportTemplate[]>([]);
const selectedTemplate = ref<ReportTemplate | null>(null);

// 篩選狀態
const searchQuery = ref('');
const selectedCategory = ref('');
const selectedTimeRange = ref('');

// 載入模板資料
const loadTemplates = async () => {
  loading.value = true;
  error.value = null;

  try {
    // 模擬 API 調用，實際應該從後端獲取
    await new Promise(resolve => setTimeout(resolve, 800));

    templates.value = [
      // 基礎報表模板
      {
        name: '每日對話摘要',
        description: '快速查看每日對話統計和關鍵指標',
        type: 'conversation_summary',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: false,
          chartType: 'line',
          maxRecords: 1000,
          timezone: 'Asia/Taipei'
        },
        requiredFilters: [],
        optionalFilters: ['teamIds', 'agentIds', 'platforms'],
        estimatedTime: 15,
        icon: '📊',
        category: 'basic'
      },
      {
        name: '客服績效月報',
        description: '客服人員月度績效評估和排名',
        type: 'agent_performance',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'bar',
          maxRecords: 500,
          groupBy: ['agentId'],
          sortBy: 'responseTime',
          sortOrder: 'asc'
        },
        requiredFilters: ['agentIds'],
        optionalFilters: ['teamIds', 'priority'],
        estimatedTime: 45,
        icon: '👥',
        category: 'basic'
      },
      {
        name: '客戶滿意度調查',
        description: '分析客戶滿意度評分和意見回饋',
        type: 'customer_satisfaction',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'donut',
          maxRecords: 2000
        },
        requiredFilters: [],
        optionalFilters: ['platforms', 'teamIds', 'priority'],
        estimatedTime: 30,
        icon: '😊',
        category: 'basic'
      },

      // 企業級模板
      {
        name: '成本效益分析',
        description: '完整的營運成本分析和ROI計算',
        type: 'cost_analysis',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'area',
          maxRecords: 5000,
          includeRawData: true
        },
        requiredFilters: ['teamIds'],
        optionalFilters: ['platforms', 'customFields'],
        estimatedTime: 120,
        icon: '💰',
        category: 'enterprise'
      },
      {
        name: 'SLA 合規性監控',
        description: '服務水準協議執行狀況和合規性報告',
        type: 'sla_compliance',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'line',
          maxRecords: 10000
        },
        requiredFilters: ['teamIds'],
        optionalFilters: ['agentIds', 'priority'],
        estimatedTime: 90,
        icon: '⚖️',
        category: 'enterprise'
      },
      {
        name: '異常檢測警報',
        description: '系統異常檢測和風險評估報告',
        type: 'anomaly_detection',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'line',
          includeRawData: true
        },
        requiredFilters: [],
        optionalFilters: ['platforms', 'messageTypes'],
        estimatedTime: 180,
        icon: '🚨',
        category: 'enterprise'
      },

      // 商業智能模板
      {
        name: '30天趨勢預測',
        description: '基於歷史資料的趨勢分析和預測',
        type: 'trend_forecast',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'area',
          maxRecords: 15000
        },
        requiredFilters: [],
        optionalFilters: ['platforms', 'teamIds', 'messageTypes'],
        estimatedTime: 240,
        icon: '📈',
        category: 'enterprise'
      },
      {
        name: '客戶洞察分析',
        description: '深度客戶行為分析和區段劃分',
        type: 'customer_insights',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: true,
          chartType: 'pie',
          maxRecords: 20000,
          groupBy: ['customerSegment', 'platform']
        },
        requiredFilters: [],
        optionalFilters: ['platforms', 'customFields'],
        estimatedTime: 300,
        icon: '💡',
        category: 'enterprise'
      },

      // 高級分析模板
      {
        name: '高管戰略摘要',
        description: '高層決策支援的戰略分析報告',
        type: 'executive_summary',
        presetOptions: {
          includeCharts: true,
          includeSummary: true,
          includeDetails: false,
          chartType: 'area',
          maxRecords: 50000
        },
        requiredFilters: ['teamIds'],
        optionalFilters: ['platforms'],
        estimatedTime: 600,
        icon: '💼',
        category: 'advanced'
      }
    ];
  } catch (err) {
    error.value = err instanceof Error ? err.message : '載入模板失敗';
  } finally {
    loading.value = false;
  }
};

// 篩選模板
const filteredTemplates = computed(() => {
  let filtered = templates.value;

  // 搜尋篩選
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(template =>
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query)
    );
  }

  // 類別篩選
  if (selectedCategory.value) {
    filtered = filtered.filter(template => template.category === selectedCategory.value);
  }

  // 時間篩選
  if (selectedTimeRange.value) {
    filtered = filtered.filter(template => {
      switch (selectedTimeRange.value) {
        case 'fast':
          return template.estimatedTime < 30;
        case 'medium':
          return template.estimatedTime >= 30 && template.estimatedTime <= 120;
        case 'slow':
          return template.estimatedTime > 120;
        default:
          return true;
      }
    });
  }

  return filtered;
});

// 熱門模板（用於快速動作）
const popularTemplates = computed(() =>
  templates.value
    .filter(t => ['conversation_summary', 'agent_performance', 'customer_satisfaction'].includes(t.type))
    .slice(0, 3)
);

// 選擇模板
const selectTemplate = (template: ReportTemplate) => {
  selectedTemplate.value = template;
};

// 使用模板生成報告
const useTemplate = async (template: ReportTemplate) => {
  generating.value = true;

  try {
    // 構建報表生成參數
    const params = {
      type: template.type,
      title: `${template.name} - ${new Date().toLocaleDateString('zh-TW')}`,
      description: template.description,
      format: 'pdf' as const,
      timeRange: 'last_30_days' as const,
      options: template.presetOptions,
      filters: {}
    };

    // 調用 API 生成報表
    const report = await ReportsAPI.generateReport(params);

    // 導航到報表查看頁面
    router.push(`/reports/${report.id}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成報表失敗';
  } finally {
    generating.value = false;
  }
};

// 自定義模板設定
const customizeTemplate = (template: ReportTemplate) => {
  // 導航到報表生成器，並預填模板設定
  router.push({
    name: 'ReportGenerator',
    query: {
      template: template.name,
      type: template.type
    }
  });
};

// 輔助函數
const getCategoryLabel = (category: string): string => {
  /* eslint-disable camelcase */
  const labels = {
    basic: '基礎',
    enterprise: '企業級',
    business_intelligence: '商業智能',
    advanced_analytics: '高級分析'
  };
  /* eslint-enable camelcase */
  return labels[category as keyof typeof labels] || category;
};

const getReportTypeLabel = (type: ReportType): string => {
  const types = ReportsAPI.getAvailableReportTypes();
  return types.find(t => t.value === type)?.label || type;
};

const getFilterLabel = (filter: string): string => {
  const labels = {
    teamIds: '團隊',
    agentIds: '客服',
    customerIds: '客戶',
    platforms: '平台',
    messageTypes: '訊息類型',
    priority: '優先級',
    tags: '標籤',
    customFields: '自定義欄位'
  };
  return labels[filter as keyof typeof labels] || filter;
};

const getChartTypeLabel = (chartType: string): string => {
  const labels = {
    line: '折線圖',
    bar: '柱狀圖',
    pie: '圓餅圖',
    donut: '環狀圖',
    area: '面積圖'
  };
  return labels[chartType as keyof typeof labels] || chartType;
};

const formatEstimatedTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} 秒`;
  } else if (seconds < 3600) {
    return `${Math.ceil(seconds / 60)} 分鐘`;
  } else {
    return `${Math.ceil(seconds / 3600)} 小時`;
  }
};

// 組件掛載
onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.report-templates {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 標題區 */
.templates-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-title {
  font-size: 2.5rem;
  color: #1a1a1a;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.page-title .icon {
  font-size: 2.2rem;
}

.page-description {
  font-size: 1.1rem;
  color: #666;
  max-width: 600px;
  margin: 0 auto;
}

/* 篩選區 */
.filters-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-controls {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 300px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
}

.category-filter,
.time-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-filter label,
.time-filter label {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.category-select,
.time-select {
  padding: 0.5rem;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  font-size: 0.9rem;
  min-width: 120px;
}

/* 載入和錯誤狀態 */
.loading-state,
.error-state {
  text-align: center;
  padding: 4rem 2rem;
}

.loading-spinner,
.button-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.button-spinner {
  width: 1rem;
  height: 1rem;
  border-width: 2px;
  margin: 0 0.5rem 0 0;
  display: inline-block;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.retry-btn {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background: #0056b3;
}

/* 模板網格 */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.template-card {
  background: white;
  border: 2px solid #e1e5e9;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.template-card:hover {
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
  transform: translateY(-2px);
}

.template-card.selected {
  border-color: #007bff;
  background: #f8f9ff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
}

.template-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.template-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.template-basic-info {
  flex: 1;
}

.template-name {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.template-description {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.4;
}

.category-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.category-badge.basic {
  background: #e3f2fd;
  color: #1565c0;
}

.category-badge.enterprise {
  background: #fff3e0;
  color: #e65100;
}

.category-badge.business_intelligence {
  background: #f3e5f5;
  color: #7b1fa2;
}

.category-badge.advanced_analytics {
  background: #e8f5e8;
  color: #2e7d32;
}

.template-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.template-type,
.template-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.template-type strong,
.template-time strong {
  color: #333;
  min-width: 80px;
}

.type-label {
  background: #f0f4f8;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.time-estimate {
  color: #007bff;
  font-weight: 500;
}

.template-filters,
.template-optional-filters {
  font-size: 0.9rem;
}

.template-filters strong,
.template-optional-filters strong {
  color: #333;
  display: block;
  margin-bottom: 0.5rem;
}

.required-filters,
.optional-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-tag {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.filter-tag.required {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.filter-tag.optional {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.no-filters {
  color: #999;
  font-style: italic;
}

.selection-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2rem;
  height: 2rem;
  background: #007bff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

/* 選中模板詳情 */
.selected-template-details {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 2px solid #007bff;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f4f8;
}

.details-header h2 {
  color: #1a1a1a;
  font-size: 1.5rem;
  margin: 0;
}

.close-details {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-details:hover {
  background: #f0f4f8;
}

.template-summary {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9ff;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.summary-icon {
  font-size: 3rem;
}

.summary-info h3 {
  font-size: 1.4rem;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.summary-info p {
  color: #666;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.summary-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #333;
  border: 1px solid #e1e5e9;
}

.preset-options h4 {
  color: #1a1a1a;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.option-item {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  border-left: 3px solid #007bff;
}

.option-item strong {
  display: block;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.option-item span {
  color: #007bff;
  font-weight: 500;
}

.template-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.use-template-btn,
.customize-template-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  min-width: 150px;
  justify-content: center;
}

.use-template-btn.primary {
  background: #007bff;
  color: white;
}

.use-template-btn.primary:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.use-template-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.customize-template-btn.secondary {
  background: white;
  color: #007bff;
  border: 2px solid #007bff;
}

.customize-template-btn.secondary:hover {
  background: #007bff;
  color: white;
  transform: translateY(-1px);
}

/* 快速動作 */
.quick-actions {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 2rem;
  color: white;
  text-align: center;
}

.quick-actions-content h3 {
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.quick-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.quick-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
}

.quick-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-icon {
  font-size: 1.5rem;
}

.quick-label {
  font-size: 0.9rem;
  font-weight: 500;
}

/* 空狀態 */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: #333;
  margin-bottom: 1rem;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .report-templates {
    padding: 1rem;
  }

  .page-title {
    font-size: 2rem;
  }

  .filter-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    min-width: auto;
  }

  .templates-grid {
    grid-template-columns: 1fr;
  }

  .template-header {
    flex-direction: column;
    text-align: center;
  }

  .template-summary {
    flex-direction: column;
    text-align: center;
  }

  .template-actions {
    flex-direction: column;
  }

  .quick-buttons {
    flex-direction: column;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }

  .summary-meta {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 1.8rem;
  }

  .templates-grid {
    gap: 1rem;
  }

  .template-card {
    padding: 1rem;
  }

  .selected-template-details {
    padding: 1rem;
  }
}
</style>