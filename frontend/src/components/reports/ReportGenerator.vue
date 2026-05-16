<template>
  <div class="report-generator">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          報表生成器
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
          重置
        </button>
        <button
          class="btn btn-primary"
          :disabled="!isFormValid || isGenerating"
          @click="generateReport"
        >
          <span v-if="isGenerating">
            生成中...
          </span>
          <span v-else>
            生成報表
          </span>
        </button>
      </div>
    </div>

    <div class="generator-container">
      <!-- Left side: Form -->
      <div class="form-section">
        <form
          class="report-form report-generator-form"
          @submit.prevent="generateReport"
        >
          <!-- Report Type Selector -->
          <ReportTypeSelector
            :selected-type="formData.type"
            :error="errors.type"
            @select="selectReportType"
          />

          <!-- Parameters Form: title, description, format, time range, advanced options -->
          <ReportParameterForm
            :title="formData.title"
            :description="formData.description"
            :format="formData.format"
            :time-range="formData.timeRange"
            :start-date="formData.startDate"
            :end-date="formData.endDate"
            :options="formData.options"
            :errors="errors"
            @update:title="formData.title = $event"
            @update:description="formData.description = $event"
            @update:format="formData.format = $event"
            @update:time-range="onTimeRangeUpdate($event)"
            @update:start-date="formData.startDate = $event"
            @update:end-date="formData.endDate = $event"
            @update:options="formData.options = $event"
          />
        </form>
      </div>

      <!-- Right side: Preview and Progress -->
      <ReportPreviewPanel
        :report-type="formData.type"
        :title="formData.title"
        :format="formData.format"
        :time-range="formData.timeRange"
        :is-generating="isGenerating"
        :progress="generationProgress"
        :current-step="currentStep"
        :recent-reports="recentReports"
        @view-report="(id) => emit('view-report', id)"
      />
    </div>

    <!-- Success Toast -->
    <ReportSuccessToast
      :visible="showSuccess"
      @close="showSuccess = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ReportsAPI from '@/api/reports';
import ReportTypeSelector from './ReportTypeSelector.vue';
import ReportParameterForm from './ReportParameterForm.vue';
import ReportPreviewPanel from './ReportPreviewPanel.vue';
import ReportSuccessToast from './ReportSuccessToast.vue';
import type {
  ReportType,
  ReportTimeRange,
  ReportFormState,
  ReportBase
} from '@/types/reports';

// Props and Emits
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

const router = useRouter();

// Reactive state
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

// Computed
const isFormValid = computed(() => {
  return formData.type &&
         formData.title.trim() &&
         formData.format &&
         formData.timeRange &&
         (formData.timeRange !== 'custom' ||
          (formData.startDate && formData.endDate));
});

// Methods
const selectReportType = (type: ReportType) => {
  formData.type = type;

  // Auto-fill title based on type
  const typeLabel = ReportsAPI.formatReportType(type);
  if (!formData.title) {
    formData.title = `${typeLabel} - ${new Date().toLocaleDateString('zh-TW')}`;
  }

  // Clear related error
  delete errors.type;
};

const onTimeRangeUpdate = (value: ReportTimeRange | '') => {
  formData.timeRange = value as ReportTimeRange;
  if (value !== 'custom') {
    formData.startDate = '';
    formData.endDate = '';
  }
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

  // Clear fields without errors
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
    // Simulate progress updates
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

    // Complete progress
    clearInterval(progressInterval);
    generationProgress.value = 100;
    currentStep.value = '報表生成完成！';

    // Show success toast
    showSuccess.value = true;
    setTimeout(() => {
      showSuccess.value = false;
    }, 5000);

    // Emit event
    emit('report-generated', report.id);
    emit('view-report', report.id);

    // Reload recent reports
    await loadRecentReports();
    await router.push(`/reports/${report.id}`);

  } catch (error) {
    console.error('報表生成失敗:', error);
    currentStep.value = '報表生成失敗';

    // Clean up progress
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

  // Clear errors
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

// Lifecycle
onMounted(() => {
  loadRecentReports();

  // If there's an initial type, auto-select it
  if (props.initialType) {
    selectReportType(props.initialType);
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

/* Responsive design */
@media (max-width: 1024px) {
  .generator-container {
    grid-template-columns: 1fr;
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
}
</style>
