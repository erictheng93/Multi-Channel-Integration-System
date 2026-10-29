<template>
  <div class="ui-page report-generator">
    <UiPageHead
      title="產生報表"
      subtitle="依序選擇類型、內容、時間與格式，確認後產生。"
    >
      <template
        v-if="isDirty"
        #actions
      >
        <button
          class="btn btn-secondary"
          :disabled="isGenerating"
          @click="resetForm"
        >
          重置
        </button>
      </template>
    </UiPageHead>
    <UiSectionNav section="reports" />

    <div class="generator-container">
      <div class="form-section">
        <form
          class="report-form report-generator-form"
          @submit.prevent="generateReport"
        >
          <ReportTypeSelector
            :selected-type="formData.type"
            :error="errors.type"
            @select="selectReportType"
          />

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

      <div class="side-section">
        <ReportPreviewPanel
          :report-type="formData.type"
          :title="formData.title"
          :format="formData.format"
          :time-range="formData.timeRange"
          :options="formData.options"
          :is-generating="isGenerating"
          :current-step="currentStep"
          :recent-reports="recentReports"
          @view-report="(id) => emit('view-report', id)"
        >
          <template #action>
            <div class="generate-action">
              <button
                class="btn btn-primary"
                type="button"
                :disabled="isGenerating"
                @click="generateReport"
              >
                {{ isGenerating ? '產生中...' : '產生報表' }}
              </button>
            </div>
          </template>
        </ReportPreviewPanel>
      </div>
    </div>

    <UiActionBar
      class="generate-bar"
      label="產生報表"
    >
      <p
        v-if="!isFormValid"
        class="generate-hint"
        role="status"
      >
        {{ missingHint }}
      </p>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="isGenerating"
        @click="generateReport"
      >
        {{ isGenerating ? '產生中...' : '產生報表' }}
      </button>
    </UiActionBar>

    <ReportSuccessToast
      :visible="showSuccess"
      @close="showSuccess = false"
    />
  </div>
</template>


<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import UiActionBar from '@/components/ui/UiActionBar.vue'
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
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

const defaultOptions = () => ({
  includeCharts: true,
  includeSummary: true,
  includeDetails: false,
  chartType: 'line' as const,
  maxRecords: 10000,
  language: 'zh-TW' as const
});

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
const currentStep = ref('');
const showSuccess = ref(false);
const errors = reactive<Record<string, string>>({});
const recentReports = ref<ReportBase[]>([]);

// 重置 only appears once there is something to reset
const isDirty = computed(() =>
  !!formData.type || !!formData.title.trim() || !!formData.description.trim() ||
  formData.format !== 'json' || formData.timeRange !== 'last_30_days' ||
  JSON.stringify(formData.options) !== JSON.stringify(defaultOptions())
);

// Computed
const isFormValid = computed(() => {
  return formData.type &&
         formData.title.trim() &&
         formData.format &&
         formData.timeRange &&
         (formData.timeRange !== 'custom' ||
          (formData.startDate && formData.endDate));
});

// What still blocks the primary action (shown beside the phone action bar)
const missingHint = computed(() => {
  const missing = [
    !formData.type && '報表類型',
    !formData.title.trim() && '標題',
    formData.timeRange === 'custom' && !(formData.startDate && formData.endDate) && '日期範圍'
  ].filter(Boolean);
  return missing.length > 0 ? `還需要：${missing.join('、')}` : '';
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

// Bring the first unmet step into view and put the keyboard on it
const focusFirstInvalid = async () => {
  await nextTick();
  const target = errors.type
    ? document.querySelector<HTMLElement>('.report-type-selector [role="radio"][tabindex="0"]')
    : errors.title
      ? document.getElementById('title')
      : document.getElementById('startDate');
  if (!target) { return; }
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.focus({ preventScroll: true });
};

const generateReport = async () => {
  if (!validateForm()) {
    await focusFirstInvalid();
    return;
  }

  isGenerating.value = true;
  currentStep.value = '正在產生報表，完成後會自動開啟';

  try {
    // Simulate progress updates
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
      currentStep.value = '';
    }, 2000);
  } finally {
    setTimeout(() => {
      isGenerating.value = false;
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

.generator-container {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.form-section {
  min-width: 0;
}

.report-form {
  display: grid;
  gap: 16px;
}

.side-section {
  position: sticky;
  top: 16px;
}

.generate-action {
  padding: 8px 22px 22px;
}

.generate-action .btn {
  width: 100%;
}

@media (max-width: 1280px) {
  .generator-container {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-section {
    position: static;
  }
}

.generate-bar {
  display: none;
}

.generate-hint {
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  /* The action bar replaces the in-card button so the primary action never scrolls away */
  .generate-bar {
    display: flex;
  }

  .generate-action,
  .side-section :deep(.preview-card) {
    display: none;
  }

  .generate-bar .btn {
    flex: 0 0 auto;
    min-width: 140px;
  }
}
</style>
