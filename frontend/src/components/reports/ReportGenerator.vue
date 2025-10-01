<template>
  <div class="report-generator">
    <!-- 頁面標題 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          📊 報表生成器
        </h1>
        <p class="page-subtitle">
          建立自訂報表以分析您的客服資料
        </p>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          :disabled="isGenerating"
          @click="resetForm"
        >
          🔄 重置
        </button>
        <button
          class="btn btn-primary"
          :disabled="!isFormValid || isGenerating"
          @click="generateReport"
        >
          <span v-if="isGenerating">
            ⚙️ 生成中...
          </span>
          <span v-else>
            🚀 生成報表
          </span>
        </button>
      </div>
    </div>

    <div class="generator-container">
      <!-- 左側：表單 -->
      <div class="form-section">
        <form
          class="report-form"
          @submit.prevent="generateReport"
        >
          <!-- 報表類型選擇 -->
          <div class="form-group">
            <label class="form-label required">報表類型</label>
            <div class="report-type-grid">
              <div
                v-for="typeGroup in groupedReportTypes"
                :key="typeGroup.category"
                class="type-category"
              >
                <h3 class="category-title">
                  {{ typeGroup.title }}
                </h3>
                <div class="type-options">
                  <div
                    v-for="option in typeGroup.types"
                    :key="option.value"
                    class="type-option"
                    :class="{ 'selected': formData.type === option.value }"
                    @click="selectReportType(option.value)"
                  >
                    <div class="type-icon">
                      {{ getReportTypeIcon(option.value) }}
                    </div>
                    <div class="type-info">
                      <div class="type-name">
                        {{ option.label }}
                      </div>
                      <div class="type-desc">
                        {{ option.description }}
                      </div>
                    </div>
                    <div
                      v-if="getTypeBadgeClass(option.value) === 'enterprise'"
                      class="type-badge"
                    >
                      👑 Enterprise
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="errors.type"
              class="error-message"
            >
              {{ errors.type }}
            </div>
          </div>

          <!-- 基本資訊 -->
          <div class="form-group">
            <label
              for="title"
              class="form-label required"
            >報表標題</label>
            <input
              id="title"
              v-model="formData.title"
              type="text"
              class="form-input"
              placeholder="輸入報表標題"
              :class="{ 'error': errors.title }"
            >
            <div
              v-if="errors.title"
              class="error-message"
            >
              {{ errors.title }}
            </div>
          </div>

          <div class="form-group">
            <label
              for="description"
              class="form-label"
            >報表描述</label>
            <textarea
              id="description"
              v-model="formData.description"
              class="form-textarea"
              placeholder="輸入報表描述（可選）"
              rows="3"
            />
          </div>

          <!-- 格式選擇 -->
          <div class="form-group">
            <label class="form-label required">輸出格式</label>
            <div class="format-options">
              <div
                v-for="format in availableFormats"
                :key="format.value"
                class="format-option"
                :class="{ 'selected': formData.format === format.value }"
                @click="formData.format = format.value"
              >
                <div class="format-icon">
                  {{ format.icon }}
                </div>
                <div class="format-label">
                  {{ format.label }}
                </div>
              </div>
            </div>
            <div
              v-if="errors.format"
              class="error-message"
            >
              {{ errors.format }}
            </div>
          </div>

          <!-- 時間範圍 -->
          <div class="form-group">
            <label class="form-label required">時間範圍</label>
            <select
              v-model="formData.timeRange"
              class="form-select"
              :class="{ 'error': errors.timeRange }"
            >
              <option value="">
                請選擇時間範圍
              </option>
              <option
                v-for="range in timeRangeOptions"
                :key="range.value"
                :value="range.value"
              >
                {{ range.label }}
              </option>
            </select>
            <div
              v-if="errors.timeRange"
              class="error-message"
            >
              {{ errors.timeRange }}
            </div>
          </div>

          <!-- 自定義日期範圍 -->
          <div
            v-if="formData.timeRange === 'custom'"
            class="form-group"
          >
            <label class="form-label">自定義日期範圍</label>
            <div class="date-range">
              <div class="date-input">
                <label
                  for="startDate"
                  class="date-label"
                >開始日期</label>
                <input
                  id="startDate"
                  v-model="formData.startDate"
                  type="date"
                  class="form-input"
                  :max="formData.endDate || today"
                >
              </div>
              <div class="date-separator">
                至
              </div>
              <div class="date-input">
                <label
                  for="endDate"
                  class="date-label"
                >結束日期</label>
                <input
                  id="endDate"
                  v-model="formData.endDate"
                  type="date"
                  class="form-input"
                  :min="formData.startDate"
                  :max="today"
                >
              </div>
            </div>
          </div>

          <!-- 進階選項 -->
          <div class="form-group">
            <details class="advanced-options">
              <summary class="options-toggle">
                🔧 進階選項
              </summary>
              <div class="options-content">
                <!-- 圖表選項 -->
                <div class="option-row">
                  <label class="checkbox-label">
                    <input
                      v-model="formData.options.includeCharts"
                      type="checkbox"
                      class="checkbox"
                    >
                    <span class="checkmark" />
                    包含圖表
                  </label>
                </div>

                <div class="option-row">
                  <label class="checkbox-label">
                    <input
                      v-model="formData.options.includeSummary"
                      type="checkbox"
                      class="checkbox"
                    >
                    <span class="checkmark" />
                    包含摘要
                  </label>
                </div>

                <div class="option-row">
                  <label class="checkbox-label">
                    <input
                      v-model="formData.options.includeDetails"
                      type="checkbox"
                      class="checkbox"
                    >
                    <span class="checkmark" />
                    包含詳細資料
                  </label>
                </div>

                <!-- 圖表類型 -->
                <div
                  v-if="formData.options.includeCharts"
                  class="option-row"
                >
                  <label
                    for="chartType"
                    class="option-label"
                  >圖表類型</label>
                  <select
                    id="chartType"
                    v-model="formData.options.chartType"
                    class="form-select small"
                  >
                    <option value="line">
                      線圖
                    </option>
                    <option value="bar">
                      長條圖
                    </option>
                    <option value="pie">
                      圓餅圖
                    </option>
                    <option value="donut">
                      甜甜圈圖
                    </option>
                    <option value="area">
                      面積圖
                    </option>
                  </select>
                </div>

                <!-- 記錄限制 -->
                <div class="option-row">
                  <label
                    for="maxRecords"
                    class="option-label"
                  >最大記錄數</label>
                  <input
                    id="maxRecords"
                    v-model.number="formData.options.maxRecords"
                    type="number"
                    class="form-input small"
                    placeholder="例如: 1000"
                    min="1"
                    max="50000"
                  >
                </div>

                <!-- 語言選擇 -->
                <div class="option-row">
                  <label
                    for="language"
                    class="option-label"
                  >語言</label>
                  <select
                    id="language"
                    v-model="formData.options.language"
                    class="form-select small"
                  >
                    <option value="zh-TW">
                      繁體中文
                    </option>
                    <option value="en-US">
                      English
                    </option>
                  </select>
                </div>
              </div>
            </details>
          </div>
        </form>
      </div>

      <!-- 右側：預覽和進度 -->
      <div class="preview-section">
        <!-- 報表預覽卡片 -->
        <div
          v-if="formData.type"
          class="preview-card"
        >
          <div class="preview-header">
            <h3 class="preview-title">
              📋 報表預覽
            </h3>
          </div>
          <div class="preview-content">
            <div class="preview-item">
              <span class="preview-label">類型：</span>
              <span class="preview-value">{{ getReportTypeLabel(formData.type) }}</span>
            </div>
            <div
              v-if="formData.title"
              class="preview-item"
            >
              <span class="preview-label">標題：</span>
              <span class="preview-value">{{ formData.title }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">格式：</span>
              <span class="preview-value">{{ getFormatLabel(formData.format) }}</span>
            </div>
            <div
              v-if="formData.timeRange"
              class="preview-item"
            >
              <span class="preview-label">時間範圍：</span>
              <span class="preview-value">{{ getTimeRangeLabel(formData.timeRange) }}</span>
            </div>
            <div
              v-if="estimatedTime"
              class="preview-item"
            >
              <span class="preview-label">預估時間：</span>
              <span class="preview-value">{{ estimatedTime }} 秒</span>
            </div>
          </div>
        </div>

        <!-- 生成進度 -->
        <div
          v-if="isGenerating"
          class="progress-card"
        >
          <div class="progress-header">
            <h3 class="progress-title">
              ⚙️ 生成進度
            </h3>
          </div>
          <div class="progress-content">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${generationProgress}%` }"
              />
            </div>
            <div class="progress-text">
              {{ generationProgress }}% 完成
            </div>
            <div
              v-if="currentStep"
              class="progress-status"
            >
              {{ currentStep }}
            </div>
          </div>
        </div>

        <!-- 最近生成的報表 -->
        <div
          v-if="recentReports.length > 0"
          class="recent-reports"
        >
          <div class="recent-header">
            <h3 class="recent-title">
              📚 最近的報表
            </h3>
          </div>
          <div class="recent-list">
            <div
              v-for="report in recentReports.slice(0, 3)"
              :key="report.id"
              class="recent-item"
              @click="$emit('view-report', report.id)"
            >
              <div class="recent-icon">
                {{ getReportTypeIcon(report.type) }}
              </div>
              <div class="recent-info">
                <div class="recent-name">
                  {{ report.title }}
                </div>
                <div class="recent-meta">
                  {{ formatDate(report.createdAt) }}
                </div>
              </div>
              <div class="recent-status">
                {{ getStatusIcon(report.status) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 成功提示 -->
    <div
      v-if="showSuccess"
      class="success-toast"
    >
      <div class="toast-content">
        <div class="toast-icon">
          ✅
        </div>
        <div class="toast-message">
          <div class="toast-title">
            報表生成成功！
          </div>
          <div class="toast-text">
            報表正在後台處理中
          </div>
        </div>
        <button
          class="toast-close"
          @click="showSuccess = false"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import ReportsAPI from '@/api/reports';
import type {
  ReportType,
  ReportFormat,
  ReportTimeRange,
  ReportFormState,
  ReportBase
} from '@/types/reports';

// Props 和 Emits
interface Props {
  initialType?: ReportType;
}

const props = withDefaults(defineProps<Props>(), {
  initialType: undefined
});

const emit = defineEmits<{
  'report-generated': [reportId: string];
  'view-report': [reportId: string];
  'error': [error: Error];
}>();

// Router removed as it was not used

// 響應式資料
const formData = reactive<ReportFormState>({
  type: props.initialType || null,
  title: '',
  description: '',
  format: 'json',
  timeRange: 'last_30_days',
  startDate: '',
  endDate: '',
  filters: {},
  options: {
    includeCharts: true,
    includeSummary: true,
    includeDetails: false,
    chartType: 'line',
    maxRecords: 10000,
    language: 'zh-TW'
  },
  isGenerating: false,
  errors: {}
});

const isGenerating = ref(false);
const generationProgress = ref(0);
const currentStep = ref('');
const showSuccess = ref(false);
const errors = reactive<Record<string, string>>({});
const recentReports = ref<ReportBase[]>([]);

// 計算屬性
const today = computed(() => {
  return new Date().toISOString().split('T')[0];
});

const isFormValid = computed(() => {
  return formData.type &&
         formData.title.trim() &&
         formData.format &&
         formData.timeRange &&
         (formData.timeRange !== 'custom' ||
          (formData.startDate && formData.endDate));
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

const availableFormats = computed(() => {
  return ReportsAPI.getAvailableFormats() || [];
});

const timeRangeOptions = computed(() => {
  return ReportsAPI.getTimeRangeOptions() || [];
});

const estimatedTime = computed(() => {
  if (!formData.type) {return null;}

  const typeMap: Record<ReportType, number> = {
    'conversation_summary': 30,
    'agent_performance': 45,
    'team_analytics': 60,
    'customer_satisfaction': 40,
    'platform_usage': 25,
    'message_statistics': 35,
    'response_time_analysis': 50,
    'workload_distribution': 40,
    'system_health': 20,
    'custom': 120,
    'cost_analysis': 90,
    'sla_compliance': 75,
    'anomaly_detection': 120,
    'audit_trail': 100,
    'resource_utilization': 80,
    'trend_forecast': 150,
    'customer_insights': 135,
    'channel_integration': 110,
    'goal_achievement': 95,
    'automation_effectiveness': 125,
    'security_risk': 180,
    'knowledge_base': 105,
    'call_quality': 140,
    'executive_summary': 200
  };

  return typeMap[formData.type] || 60;
});

// 方法
const selectReportType = (type: ReportType) => {
  formData.type = type;

  // 根據類型自動填入標題
  const typeLabel = getReportTypeLabel(type);
  if (!formData.title) {
    formData.title = `${typeLabel} - ${formatDate(new Date().toISOString())}`;
  }

  // 清除相關錯誤
  delete errors.type;
};

const validateForm = (): boolean => {
  const newErrors: Record<string, string> = {};

  if (!formData.type) {
    newErrors.type = '請選擇報表類型';
  }

  if (!formData.title.trim()) {
    newErrors.title = '請輸入報表標題';
  }

  if (!formData.format) {
    newErrors.format = '請選擇輸出格式';
  }

  if (!formData.timeRange) {
    newErrors.timeRange = '請選擇時間範圍';
  }

  if (formData.timeRange === 'custom') {
    if (!formData.startDate) {
      newErrors.startDate = '請選擇開始日期';
    }
    if (!formData.endDate) {
      newErrors.endDate = '請選擇結束日期';
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      newErrors.dateRange = '結束日期不能早於開始日期';
    }
  }

  Object.assign(errors, newErrors);

  // 清除沒有錯誤的欄位
  Object.keys(errors).forEach(key => {
    if (!newErrors[key]) {
      delete errors[key];
    }
  });

  return Object.keys(newErrors).length === 0;
};

const generateReport = async () => {
  if (!validateForm()) {
    return;
  }

  isGenerating.value = true;
  generationProgress.value = 0;
  currentStep.value = '正在準備報表生成...';

  try {
    // 模擬進度更新
    const progressInterval = setInterval(() => {
      if (generationProgress.value < 90) {
        generationProgress.value += Math.random() * 10;

        if (generationProgress.value < 30) {
          currentStep.value = '正在收集資料...';
        } else if (generationProgress.value < 60) {
          currentStep.value = '正在處理資料...';
        } else if (generationProgress.value < 90) {
          currentStep.value = '正在生成報表...';
        }
      }
    }, 500);

    if (!formData.type) {
      emit('error', new Error('請選擇報表類型'));
      return;
    }

    const reportParams = {
      type: formData.type,
      title: formData.title,
      description: formData.description,
      format: formData.format,
      timeRange: formData.timeRange,
      startDate: formData.startDate,
      endDate: formData.endDate,
      filters: formData.filters,
      options: formData.options
    };

    const report = await ReportsAPI.generateReport(reportParams);

    // 完成進度
    clearInterval(progressInterval);
    generationProgress.value = 100;
    currentStep.value = '報表生成完成！';

    // 顯示成功提示
    showSuccess.value = true;
    setTimeout(() => {
      showSuccess.value = false;
    }, 5000);

    // 發送事件
    emit('report-generated', report.id);

    // 重新載入最近報表
    await loadRecentReports();

  } catch (error) {
    console.error('報表生成失敗:', error);
    currentStep.value = '報表生成失敗';

    // 清理進度
    setTimeout(() => {
      isGenerating.value = false;
      generationProgress.value = 0;
      currentStep.value = '';
    }, 2000);
  } finally {
    setTimeout(() => {
      isGenerating.value = false;
      generationProgress.value = 0;
      currentStep.value = '';
    }, 1500);
  }
};

const resetForm = () => {
  formData.type = null;
  formData.title = '';
  formData.description = '';
  formData.format = 'json';
  formData.timeRange = 'last_30_days';
  formData.startDate = '';
  formData.endDate = '';
  formData.filters = {};
  formData.options = {
    includeCharts: true,
    includeSummary: true,
    includeDetails: false,
    chartType: 'line',
    maxRecords: 10000,
    language: 'zh-TW'
  };

  // 清除錯誤
  Object.keys(errors).forEach(key => delete errors[key]);
};

const loadRecentReports = async () => {
  try {
    const response = await ReportsAPI.listReports({
      page: 1,
      pageSize: 5,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    recentReports.value = response?.reports || [];
  } catch (error) {
    console.error('載入最近報表失敗:', error);
  }
};

// 輔助方法
const getReportTypeLabel = (type: ReportType): string => {
  return ReportsAPI.formatReportType(type);
};

const getFormatLabel = (format: ReportFormat): string => {
  const formatOption = availableFormats.value.find(f => f.value === format);
  return formatOption?.label || format;
};

const getTimeRangeLabel = (timeRange: ReportTimeRange): string => {
  const rangeOption = timeRangeOptions.value.find(r => r.value === timeRange);
  return rangeOption?.label || timeRange;
};

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

const getStatusIcon = (status: string): string => {
  const statusMap = {
    'pending': '⏳',
    'generating': '⚙️',
    'completed': '✅',
    'failed': '❌',
    'expired': '⏰'
  };
  return statusMap[status as keyof typeof statusMap] || '❓';
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('zh-TW');
};

// 生命週期
onMounted(() => {
  loadRecentReports();

  // 如果有初始類型，自動選擇
  if (props.initialType) {
    selectReportType(props.initialType);
  }
});

// 監聽器
watch(() => formData.timeRange, (newRange) => {
  if (newRange !== 'custom') {
    formData.startDate = '';
    formData.endDate = '';
  }
});
</script>

<style scoped>
.report-generator {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
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

.page-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  color: #6b7280;
  font-size: 1.1rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.generator-container {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.form-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.report-type-grid {
  margin-top: 1rem;
}

.type-category {
  margin-bottom: 2rem;
}

.category-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.type-option {
  display: flex;
  align-items: center;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.type-option:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.type-option.selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.type-icon {
  font-size: 1.5rem;
  margin-right: 0.75rem;
}

.type-info {
  flex: 1;
}

.type-name {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.type-desc {
  font-size: 0.9rem;
  color: #6b7280;
}

.type-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.format-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
}

.format-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-option:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.format-option.selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.format-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.format-label {
  font-weight: 500;
  text-align: center;
}

.advanced-options {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}

.options-toggle {
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  list-style: none;
}

.options-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox {
  margin-right: 0.5rem;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.date-input {
  flex: 1;
}

.date-label {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.date-separator {
  font-weight: 500;
  color: #6b7280;
}

.preview-card,
.progress-card,
.recent-reports {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.preview-header,
.progress-header,
.recent-header {
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.preview-title,
.progress-title,
.recent-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.preview-label {
  font-weight: 500;
  color: #6b7280;
}

.preview-value {
  font-weight: 600;
  color: #1f2937;
  text-align: right;
  flex: 1;
  margin-left: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.progress-status {
  text-align: center;
  color: #6b7280;
  font-style: italic;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.recent-item:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.recent-icon {
  font-size: 1.25rem;
  margin-right: 0.75rem;
}

.recent-info {
  flex: 1;
}

.recent-name {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.recent-meta {
  font-size: 0.9rem;
  color: #6b7280;
}

.recent-status {
  font-size: 1.1rem;
}

.success-toast {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1000;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #10b981;
  animation: slideIn 0.3s ease-out;
}

.toast-content {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
}

.toast-icon {
  font-size: 1.5rem;
  margin-right: 1rem;
}

.toast-message {
  flex: 1;
}

.toast-title {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.toast-text {
  color: #6b7280;
  font-size: 0.9rem;
}

.toast-close {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 1.2rem;
  margin-left: 1rem;
}

.toast-close:hover {
  color: #374151;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 響應式設計 */
@media (max-width: 1024px) {
  .generator-container {
    grid-template-columns: 1fr;
  }

  .type-options {
    grid-template-columns: 1fr;
  }

  .format-options {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .report-generator {
    padding: 1rem;
  }

  .page-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .date-range {
    flex-direction: column;
    align-items: stretch;
  }

  .date-separator {
    text-align: center;
    padding: 0.5rem 0;
  }

  .success-toast {
    top: 1rem;
    right: 1rem;
    left: 1rem;
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

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.error,
.form-select.error {
  border-color: #ef4444;
}

.form-input.small,
.form-select.small {
  width: auto;
  min-width: 120px;
}

.error-message {
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}
</style>