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
          v-if="usableTemplates.length > 0 || comingSoonTemplates.length > 0 || showCustom"
          class="catalogue"
        >
          <TemplateCard
            v-for="template in usableTemplates"
            :key="template.name"
            class="cat-primary"
            :template="template"
            :generating="generating"
            :is-selected="selectedTemplate?.name === template.name"
            @select="selectTemplate"
            @use="useTemplate"
          />

          <router-link
            v-if="showCustom"
            to="/reports/generate"
            class="ui-card cat-primary custom-card"
          >
            <span class="custom-ico">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span class="custom-name">自訂報表</span>
            <span class="custom-desc">自選類型、時間範圍與輸出格式，不套用模板</span>
            <span class="custom-go">前往產生報表</span>
          </router-link>

          <h2
            v-if="comingSoonTemplates.length > 0"
            class="cat-heading"
          >
            即將推出
            <span class="ui-pill">{{ comingSoonTemplates.length }}</span>
            <span class="cat-heading-hint">後端尚未支援這些報表類型，暫時無法產生</span>
          </h2>

          <article
            v-for="template in comingSoonTemplates"
            :key="template.name"
            class="soon-tile"
            aria-disabled="true"
          >
            <span class="soon-top">
              <span class="soon-name">{{ template.name }}</span>
              <span
                class="ui-tag soon-tag"
                :class="template.category"
              >{{ getCategoryLabel(template.category) }}</span>
            </span>
            <span class="soon-desc">{{ template.description }}</span>
          </article>
        </div>

        <UiEmptyState
          v-else
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
// The custom-report card belongs to the catalogue unless the user is searching for something else
const showCustom = computed(() => !searchQuery.value && (!selectedCategory.value || selectedCategory.value === 'basic'));

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

.catalogue {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}

.cat-primary {
  grid-column: span 4;
}

.custom-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: flex-end;
  padding: 22px;
  color: inherit;
  text-decoration: none;
  background: linear-gradient(160deg, var(--ui-accent-soft), var(--ui-surface) 75%);
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.custom-card:hover {
  box-shadow: var(--ui-shadow-raised);
}

.custom-ico {
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: auto;
  place-items: center;
  border-radius: 14px;
  background: var(--ui-surface);
  color: var(--ui-accent);
  box-shadow: var(--ui-shadow-pill);
}

.custom-ico svg {
  width: 20px;
  height: 20px;
}

.custom-name {
  font: 600 17px var(--ui-font-display);
}

.custom-desc {
  font-size: var(--ui-t-meta);
  line-height: 1.5;
  color: var(--ui-muted);
}

.custom-go {
  font-size: var(--ui-t-meta);
  font-weight: 600;
  color: var(--ui-accent);
}

.cat-heading {
  display: flex;
  grid-column: 1 / -1;
  gap: 10px;
  align-items: center;
  margin: 12px 0 0;
  font: 600 var(--ui-t-title) / 1.25 var(--ui-font-display);
}

.cat-heading-hint {
  font: 400 var(--ui-t-meta) var(--ui-font-ui);
  color: var(--ui-muted);
}

.soon-tile {
  display: grid;
  grid-column: span 3;
  gap: 6px;
  align-content: start;
  padding: 16px 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-fill);
  cursor: not-allowed;
}

.soon-top {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.soon-name {
  min-width: 0;
  font-size: var(--ui-t-body);
  font-weight: 600;
  color: var(--ui-ink-2);
}

.soon-desc {
  font-size: var(--ui-t-meta);
  line-height: 1.45;
  color: var(--ui-muted);
}

.soon-tag {
  flex: none;
  opacity: 0.75;
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

@media (max-width: 1280px) {
  .cat-primary {
    grid-column: span 6;
  }

  .soon-tile {
    grid-column: span 4;
  }

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

  .catalogue {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .cat-primary,
  .cat-heading {
    grid-column: 1 / -1;
  }

  .soon-tile {
    grid-column: span 1;
    padding: 14px;
  }

  .soon-top {
    flex-direction: column-reverse;
    gap: 6px;
    align-items: flex-start;
  }

  .custom-card {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    padding: 18px;
  }

  .custom-ico {
    margin: 0 4px 0 0;
  }

  .custom-name {
    flex: 1;
  }

  .custom-desc,
  .custom-go {
    flex: 1 1 100%;
  }

  .cat-heading-hint {
    display: none;
  }
}
</style>
