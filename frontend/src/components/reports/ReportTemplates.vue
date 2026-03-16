<!-- 報表模板選擇器組件 -->
<!-- Report Templates Selector Component with comprehensive preset configurations -->

<template>
  <div class="report-templates">
    <!-- 標題區 -->
    <div class="templates-header">
      <h1 class="page-title">
        <i class="icon" />
        報表模板
      </h1>
      <p class="page-description">
        選擇預設模板快速生成報表，或自定義配置
      </p>
    </div>

    <!-- 搜尋和篩選 -->
    <TemplateFilters
      v-model:search-query="searchQuery"
      v-model:selected-category="selectedCategory"
      v-model:selected-time-range="selectedTimeRange"
    />

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
      <div class="error-icon" />
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
      <TemplateCard
        v-for="template in filteredTemplates"
        :key="template.name"
        :template="template"
        :is-selected="selectedTemplate?.name === template.name"
        @select="selectTemplate"
      />
    </div>

    <!-- 空狀態 -->
    <div
      v-if="!loading && !error && filteredTemplates.length === 0"
      class="empty-state"
    >
      <div class="empty-icon" />
      <h3>找不到符合條件的模板</h3>
      <p>請嘗試調整篩選條件或搜尋關鍵字</p>
    </div>

    <!-- 選中模板詳情 -->
    <TemplateDetailsPanel
      v-if="selectedTemplate"
      :template="selectedTemplate"
      :generating="generating"
      @close="selectedTemplate = null"
      @use="useTemplate"
      @customize="customizeTemplate"
    />

    <!-- 快速動作工具列 -->
    <TemplateQuickActions
      v-if="!selectedTemplate"
      :popular-templates="popularTemplates"
      :generating="generating"
      @use="useTemplate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';
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
const selectedTimeRange = ref('');

// 載入模板資料
const loadTemplates = async () => {
  loading.value = true;
  error.value = null;

  try {
    // 模擬 API 調用，實際應該從後端獲取
    await new Promise(resolve => setTimeout(resolve, 800));

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

/* 載入和錯誤狀態 */
.loading-state,
.error-state {
  text-align: center;
  padding: 4rem 2rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
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

  .templates-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 1.8rem;
  }

  .templates-grid {
    gap: 1rem;
  }
}
</style>
