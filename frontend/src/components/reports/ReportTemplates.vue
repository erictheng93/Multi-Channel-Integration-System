<!-- 報表模板：only templates the backend can generate; the chosen one shows the real output of its latest report -->

<template>
  <div class="ui-page report-templates ui-rise">
    <UiPageHead
      title="報表模板"
      :subtitle="templatesSubtitle"
    />
    <UiSectionNav section="reports" />

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
      v-else-if="selected"
      class="tpl-grid"
    >
      <section
        class="tpl-pick"
        aria-label="選擇模板"
      >
        <h2 class="ui-group-label">
          現成模板
          <span class="tpl-count">{{ usableTemplates.length }}</span>
        </h2>
        <div
          class="ui-group tpl-list"
          role="radiogroup"
          aria-label="現成模板"
        >
          <TemplateCard
            v-for="template in usableTemplates"
            :key="template.name"
            :template="template"
            :selected="selected.name === template.name"
            @select="selected = $event"
          />
        </div>

        <router-link
          to="/reports/generate"
          class="ui-group custom-row"
        >
          <span
            class="custom-ico"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span class="custom-main">
            <b>自訂報表</b>
            <span>自選類型、時間範圍與格式</span>
          </span>
          <svg
            class="custom-chev"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="m9 6 6 6-6 6" /></svg>
        </router-link>
      </section>

      <section
        class="ui-lead tpl-out"
        :aria-label="`${selected.name}的最近產出`"
      >
        <header>
          <h2 class="out-name">
            {{ selected.name }}
          </h2>
          <p class="out-kicker">
            產出內容預覽
          </p>
        </header>
        <ReportOutputPreview :type="selected.type" />
        <footer class="out-foot">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="generating"
            @click="customizeTemplate(selected)"
          >
            調整後產生
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="generating"
            @click="useTemplate(selected)"
          >
            {{ generating ? '產生中...' : '直接產生' }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>


<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';
import TemplateCard from './templates/TemplateCard.vue';
import ReportOutputPreview from './templates/ReportOutputPreview.vue';
import { DEFAULT_TEMPLATES } from './templates/templateHelpers';

const router = useRouter();

const loading = ref(false);
const error = ref<string | null>(null);
const generating = ref(false);
const templates = ref<ReportTemplate[]>([]);

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

// Only report types the backend can generate are offered; the roadmap templates stay in the data model, not in the UI
const generatable = ReportsAPI.getGeneratableOptions();
const generatableTypes = generatable.types.map(option => option.value);
const isSupported = (template: ReportTemplate) => generatableTypes.includes(template.type);
const usableTemplates = computed(() => templates.value.filter(isSupported));
const selected = ref<ReportTemplate | null>(null);
watch(usableTemplates, list => {
  if (!selected.value || !list.includes(selected.value)) {
    selected.value = list[0] ?? null;
  }
}, { immediate: true });
const templatesSubtitle = computed(() =>
  usableTemplates.value.length === 0 ? '' : `${usableTemplates.value.length} 組可直接使用的模板，或自訂報表`
);

// 使用模板生成報告
const useTemplate = async (template: ReportTemplate) => {
  generating.value = true;

  try {
    const params = {
      type: template.type,
      title: `${template.name} - ${new Date().toLocaleDateString('zh-TW')}`,
      description: template.description,
      format: 'json' as const,
      timeRange: 'last_30_days' as const,
      options: template.presetOptions,
      filters: {}
    };

    const report = await ReportsAPI.generateReport(params);
    router.push(`/reports/${report.id}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成報表失敗';
  } finally {
    generating.value = false;
  }
};

// 導航到報表生成器，並預填模板設定
const customizeTemplate = (template: ReportTemplate) => {
  router.push({
    name: 'ReportGenerator',
    query: {
      template: template.name,
      type: template.type
    }
  });
};

onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.tpl-grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 20px;
  align-items: start;
}

.tpl-pick {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.tpl-pick .ui-group-label {
  margin-bottom: -8px;
}

.tpl-list {
  display: grid;
  gap: 4px;
  padding: 8px;
}

.tpl-count {
  min-width: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--section-hue-soft);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  color: var(--section-ink);
  font-variant-numeric: tabular-nums;
}

.custom-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 18px;
  color: var(--ui-ink);
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.custom-row:hover {
  background: var(--ui-fill);
}

.custom-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.custom-ico {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.custom-ico svg {
  width: 20px;
  height: 20px;
}

.custom-main {
  display: grid;
  gap: 2px;
}

.custom-main b {
  font: 600 16px / 1.3 var(--ui-font-display);
}

.custom-main span {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.custom-chev {
  width: 18px;
  height: 18px;
  color: var(--ui-muted);
}

.tpl-out {
  display: grid;
  gap: 18px;
  padding: 26px 30px 22px;
}

.out-name {
  margin: 0;
  font: 700 26px / 1.2 var(--ui-font-display);
  letter-spacing: -0.025em;
}

.out-kicker {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.out-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 16px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.error-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

@media (max-width: 1024px) {
  .tpl-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .tpl-out {
    padding: 20px;
  }

  .out-name {
    font-size: 22px;
  }

  .out-foot .btn {
    flex: 1;
  }
}
</style>
