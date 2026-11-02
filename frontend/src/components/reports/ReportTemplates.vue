<!-- 報表模板：only templates the backend can generate; the chosen one lists what it contains and the real output of its latest report -->

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

    <template v-else-if="selected">
      <section
        class="tpl-pick"
        aria-label="選擇模板"
      >
        <div
          class="tpl-list"
          role="radiogroup"
          aria-label="現成模板"
        >
          <TemplateCard
            v-for="template in usableTemplates"
            :key="template.name"
            :template="template"
            :selected="selected.name === template.name"
            @select="onSelect"
          />
        </div>

        <router-link
          to="/reports/generate"
          class="custom-row"
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
        :aria-label="`${selected.name}的內容與最近產出`"
      >
        <header class="out-head">
          <div class="out-title">
            <h2 class="out-name">
              {{ selected.name }}
            </h2>
            <p class="out-desc">
              {{ selected.description }}
            </p>
          </div>
          <div class="out-actions">
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
          </div>
        </header>

        <div class="out-body">
          <div class="out-has">
            <h3 class="out-cap">
              這份報表包含
            </h3>
            <ol class="has-list">
              <li
                v-for="(item, index) in contents"
                :key="item.label"
              >
                <span
                  class="has-n"
                  aria-hidden="true"
                >{{ index + 1 }}</span>
                <span class="has-t"><b>{{ item.label }}</b><span>{{ item.hint }}</span></span>
              </li>
            </ol>
          </div>
          <div class="out-last">
            <ReportOutputPreview :type="selected.type" />
          </div>
        </div>
        <dl class="out-foot">
          <div
            v-for="chip in presetChips"
            :key="chip.k"
          >
            <dt>{{ chip.k }}</dt>
            <dd>{{ chip.v }}</dd>
          </div>
        </dl>
      </section>
    </template>

    <UiActionBar
      v-if="selected"
      class="tpl-bar"
      label="使用模板"
    >
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
    </UiActionBar>
  </div>
</template>


<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import UiActionBar from '@/components/ui/UiActionBar.vue'
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';
import TemplateCard from './templates/TemplateCard.vue';
import ReportOutputPreview from './templates/ReportOutputPreview.vue';
import { DEFAULT_TEMPLATES, REPORT_CONTENTS, formatEstimatedTime } from './templates/templateHelpers';

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
const contents = computed(() => (selected.value ? REPORT_CONTENTS[selected.value.type] ?? [] : []));
const presetChips = computed(() => {
  const chips = [{ k: '時間範圍', v: '近 30 天' }, { k: '輸出格式', v: 'JSON' }];
  const seconds = selected.value?.estimatedTime;
  if (seconds) { chips.push({ k: '預估耗時', v: `約 ${formatEstimatedTime(seconds)}` }); }
  return chips;
});

const onSelect = (template: ReportTemplate) => {
  selected.value = template;
};
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
.tpl-pick {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.tpl-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.custom-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  border-radius: var(--ui-r-group);
  background: var(--ui-surface);
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
  overflow: hidden;
}

.out-head {
  display: flex;
  gap: 16px 24px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 26px 32px 22px;
}

.out-title {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.out-name {
  margin: 0;
  font: 700 28px / 1.2 var(--ui-font-display);
  letter-spacing: -0.025em;
}

.out-desc {
  margin: 0;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.out-actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.out-body {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.out-has,
.out-last {
  min-width: 0;
  padding: 24px 32px 28px;
}

.out-last {
  box-shadow: -0.5px 0 0 var(--ui-sep);
}

.out-cap {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.has-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.has-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 12px 0;
}

.has-list li + li {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.out-foot {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  background: var(--ui-surface-2);
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.out-foot div {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 16px 32px;
}

.out-foot div + div {
  box-shadow: -0.5px 0 0 var(--ui-sep);
}

.out-foot dt {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.out-foot dd {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.has-n {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--section-hue-soft);
  font-size: 14px;
  font-weight: 700;
  color: var(--section-ink);
  font-variant-numeric: tabular-nums;
}

.has-t {
  display: grid;
  gap: 2px;
}

.has-t b {
  font: 600 16px / 1.3 var(--ui-font-display);
}

.has-t span {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.tpl-bar {
  display: none;
}

.error-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

@media (max-width: 1024px) {
  .tpl-pick {
    grid-template-columns: minmax(0, 1fr);
  }

  .out-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .out-last {
    box-shadow: 0 -0.5px 0 var(--ui-sep);
  }

  .out-foot {
    grid-template-columns: minmax(0, 1fr);
  }

  .out-foot div {
    padding: 12px 20px;
  }

  .out-foot div + div {
    box-shadow: 0 -0.5px 0 var(--ui-sep);
  }
}

@media (max-width: 768px) {
  .tpl-list {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .out-head {
    padding: 20px 20px 16px;
  }

  .out-has,
  .out-last {
    padding: 18px 20px 22px;
  }

  .out-name {
    font-size: 24px;
  }

  .out-actions {
    display: none;
  }

  .tpl-bar {
    display: flex;
  }

  .tpl-bar .btn {
    flex: 1;
  }
}
</style>
