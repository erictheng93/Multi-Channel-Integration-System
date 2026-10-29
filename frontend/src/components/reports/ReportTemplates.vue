<!-- 報表模板選擇器組件 -->
<!-- Report Templates Selector Component with comprehensive preset configurations -->

<template>
  <div class="report-templates">
    <header class="header-wrap">
      <div class="ui-page-head">
        <div>
          <div class="ui-eyebrow">
            報表
          </div>
          <h1 class="ui-page-title">
            報表模板
          </h1>
          <p class="ui-page-sub">
            {{ templates.length }} 組預設模板，已預先設定圖表與欄位；選一個直接產生，或帶到產生頁再微調。
            <template v-if="unsupportedCount > 0">
              其中 {{ unsupportedCount }} 組的報表類型尚未支援產生。
            </template>
          </p>
        </div>
      </div>
      <ReportsNav />
    </header>

    <TemplateFilters
      v-model:search-query="searchQuery"
      v-model:selected-category="selectedCategory"
    />

    <div
      v-if="error"
      class="ui-card error-state"
      role="alert"
    >
      <h3>載入失敗</h3>
      <p>{{ error }}</p>
      <button
        class="btn btn-secondary retry-btn"
        @click="loadTemplates"
      >
        重試
      </button>
    </div>

    <div
      v-else
      class="templates-layout"
    >
      <div class="templates-main">
        <div
          v-if="filteredTemplates.length > 0"
          class="templates-grid"
        >
          <TemplateCard
            v-for="template in filteredTemplates"
            :key="template.name"
            :template="template"
            :supported="isSupported(template)"
            :is-selected="selectedTemplate?.name === template.name"
            @select="selectTemplate"
          />
        </div>

        <div
          v-else
          class="ui-card ui-empty"
        >
          <div class="ui-empty-art">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><circle
              cx="11"
              cy="11"
              r="7"
            /><path d="m21 21-4.3-4.3" /></svg>
          </div>
          <h3>找不到符合的模板</h3>
          <p>請嘗試調整篩選條件或搜尋關鍵字</p>
        </div>
      </div>

      <aside class="templates-side">
        <TemplateDetailsPanel
          v-if="selectedTemplate"
          :template="selectedTemplate"
          :generating="generating"
          @close="selectedTemplate = null"
          @use="useTemplate"
          @customize="customizeTemplate"
        />
        <TemplateQuickActions
          :popular-templates="popularTemplates"
          :generating="generating"
          @use="useTemplate"
        />
      </aside>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';
import ReportsNav from './ReportsNav.vue';
import TemplateFilters from './templates/TemplateFilters.vue';
import TemplateCard from './templates/TemplateCard.vue';
import TemplateDetailsPanel from './templates/TemplateDetailsPanel.vue';
import TemplateQuickActions from './templates/TemplateQuickActions.vue';
import { DEFAULT_TEMPLATES } from './templates/templateHelpers';

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

// 載入模板資料
const loadTemplates = async () => {
  loading.value = true;
  error.value = null;

  try {
    templates.value = DEFAULT_TEMPLATES;
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
  return filtered;
});

// 熱門模板（用於快速動作）
// Only report types the backend can generate may be used; the rest are shown disabled
const generatableTypes = ReportsAPI.getGeneratableOptions().types.map(option => option.value);
const isSupported = (template: ReportTemplate) => generatableTypes.includes(template.type);
const unsupportedCount = computed(() => templates.value.filter(t => !isSupported(t)).length);

const popularTemplates = computed(() =>
  templates.value.filter(isSupported).slice(0, 3)
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
      format: 'json' as const,
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

// 組件掛載
onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.report-templates {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px;
}

.header-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.templates-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.templates-main {
  min-width: 0;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.templates-side {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 16px;
}

.error-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

@media (max-width: 1280px) {
  .templates-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .templates-side {
    position: static;
    order: -1;
  }
}

@media (max-width: 768px) {
  .report-templates {
    padding: 16px;
  }

  .templates-grid {
    grid-template-columns: 1fr;
  }
}
</style>
