<!-- 報表模板選擇器組件 -->
<!-- Usable templates first (one 使用 button each); unsupported ones sit behind a disclosure -->

<template>
  <div class="ui-page report-templates">
    <UiPageHead
      title="報表模板"
      :subtitle="templatesSubtitle"
    >
      <template
        v-if="popularTemplates.length > 0"
        #actions
      >
        <div
          class="quick-row"
          role="group"
          aria-label="常用模板，一鍵以預設值產生"
        >
          <span
            class="quick-label"
            aria-hidden="true"
          >常用</span>
          <button
            v-for="quick in popularTemplates"
            :key="quick.name"
            type="button"
            class="ui-chip"
            :disabled="generating"
            @click="useTemplate(quick)"
          >
            {{ quick.name }}
          </button>
        </div>
      </template>
    </UiPageHead>
    <UiSectionNav section="reports" />

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
      :class="{ 'has-side': !!selectedTemplate }"
    >
      <div class="templates-main">
        <div
          v-if="usableTemplates.length > 0"
          class="templates-grid"
        >
          <TemplateCard
            v-for="template in usableTemplates"
            :key="template.name"
            :template="template"
            :generating="generating"
            :is-selected="selectedTemplate?.name === template.name"
            @select="selectTemplate"
            @use="useTemplate"
          />
        </div>

        <UiEmptyState
          v-else-if="comingSoonTemplates.length === 0"
          class="ui-card"
          title="找不到符合的模板"
          description="請嘗試調整篩選條件或搜尋關鍵字"
        >
          <template #icon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><circle
              cx="11"
              cy="11"
              r="7"
            /><path d="m21 21-4.3-4.3" /></svg>
          </template>
        </UiEmptyState>

        <details
          v-if="comingSoonTemplates.length > 0"
          class="ui-card soon"
        >
          <summary class="soon-summary">
            <span class="soon-title">即將推出</span>
            <span class="ui-pill">{{ comingSoonTemplates.length }}</span>
            <span class="soon-hint">後端尚未支援這些報表類型，暫時無法產生</span>
            <svg
              class="soon-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <ul class="soon-list">
            <li
              v-for="template in comingSoonTemplates"
              :key="template.name"
              class="soon-row"
            >
              <span class="soon-name">{{ template.name }}</span>
              <span class="soon-desc">{{ template.description }}</span>
              <span
                class="ui-tag soon-tag"
                :class="template.category"
              >{{ getCategoryLabel(template.category) }}</span>
            </li>
          </ul>
        </details>
      </div>

      <aside
        v-if="selectedTemplate"
        class="templates-side"
      >
        <TemplateDetailsPanel
          :template="selectedTemplate"
          :generating="generating"
          @close="selectedTemplate = null"
          @use="useTemplate"
          @customize="customizeTemplate"
        />
      </aside>
    </div>
  </div>
</template>


<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';
import TemplateFilters from './templates/TemplateFilters.vue';
import TemplateCard from './templates/TemplateCard.vue';
import TemplateDetailsPanel from './templates/TemplateDetailsPanel.vue';
import { DEFAULT_TEMPLATES, getCategoryLabel } from './templates/templateHelpers';

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
const templatesSubtitle = computed(() => {
  if (templates.value.length === 0) { return '' }
  const unsupported = unsupportedCount.value > 0 ? `，其中 ${unsupportedCount.value} 組尚未支援產生` : ''
  return `${templates.value.length} 組預設模板${unsupported}`
});

const usableTemplates = computed(() => filteredTemplates.value.filter(isSupported));
const comingSoonTemplates = computed(() => filteredTemplates.value.filter(t => !isSupported(t)));

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
.quick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.quick-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.quick-row .ui-chip:disabled {
  opacity: 0.5;
}

.templates-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.templates-layout.has-side {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}

.templates-main {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.templates-side {
  position: sticky;
  top: 16px;
}

.error-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.soon-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  list-style: none;
  cursor: pointer;
}

.soon-summary::-webkit-details-marker {
  display: none;
}

.soon-title {
  font: 600 15px var(--ui-font-display);
}

.soon-hint {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.soon-chevron {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--ui-muted);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.soon[open] .soon-chevron {
  transform: rotate(180deg);
}

.soon-list {
  margin: 0;
  padding: 0 20px 8px;
  list-style: none;
}

.soon-row {
  display: grid;
  grid-template-columns: minmax(120px, 200px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
  font-size: 13px;
}

.soon-name {
  font-weight: 600;
  color: var(--ui-ink-2);
}

.soon-desc {
  min-width: 0;
  color: var(--ui-muted);
}

.soon-tag.enterprise {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.soon-tag.basic {
  background: var(--ui-p-sky);
  color: var(--ui-p-sky-ink);
}

.soon-tag.business_intelligence {
  background: var(--ui-p-mint);
  color: var(--ui-p-mint-ink);
}

.soon-tag.advanced_analytics {
  background: var(--ui-p-peach);
  color: var(--ui-p-peach-ink);
}

@media (max-width: 1280px) {
  .templates-layout.has-side {
    grid-template-columns: minmax(0, 1fr);
  }

  .templates-side {
    position: static;
    order: -1;
  }
}

@media (max-width: 768px) {
  .quick-row {
    display: none;
  }

  .templates-grid {
    grid-template-columns: 1fr;
  }

  .soon-hint {
    display: none;
  }

  .soon-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .soon-desc {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
