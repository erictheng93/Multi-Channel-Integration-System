<!-- 報表模板：only templates the backend can generate. Signature: the chosen template is drawn as a report sheet, its contents as a numbered outline filled with the real figures of the latest report -->

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
      <div class="tpl-picks">
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
      </div>

      <ReportSheet
        :template="selected"
        :state="latestState"
        :loading="latestLoading"
      >
        <template #side>
          <section
            v-if="earlier.length"
            class="tpl-hist"
            aria-label="更早的產出"
          >
            <h3 class="tpl-cap">
              更早的產出
            </h3>
            <ul>
              <li
                v-for="item in earlier"
                :key="item.id"
              >
                <router-link
                  :to="`/reports/${item.id}`"
                  class="tpl-hrow"
                >
                  <span class="tpl-hname">{{ item.title }}</span>
                  <span class="tpl-hmeta">{{ item.format.toUpperCase() }} ・ {{ relativeTime(item.completedAt ?? item.createdAt) }}</span>
                  <span
                    class="ui-pill"
                    :class="statusClass(item.status)"
                  >{{ statusText[item.status] ?? item.status }}</span>
                </router-link>
              </li>
            </ul>
          </section>

          <div class="tpl-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="customizeTemplate(selected)"
            >
              調整後產生
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :aria-busy="generating"
              @click="useTemplate(selected)"
            >
              {{ generating ? '產生中...' : '直接產生' }}
            </button>
          </div>
        </template>
      </ReportSheet>
    </div>

    <UiActionBar
      v-if="selected"
      class="tpl-bar"
      label="使用模板"
    >
      <button
        type="button"
        class="btn btn-secondary"
        @click="customizeTemplate(selected)"
      >
        調整後產生
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :aria-busy="generating"
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
import ReportSheet from './templates/ReportSheet.vue';
import { useLatestReport, relativeTime } from './templates/latestReport';
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
const { state: latestState, loading: latestLoading } = useLatestReport(computed(() => selected.value?.type));
const earlier = computed(() => (latestState.value?.recent ?? []).filter(item => item.id !== latestState.value?.report?.id).slice(0, 3));
const statusText: Record<string, string> = { completed: '已完成', generating: '生成中', pending: '待處理', failed: '失敗', expired: '已過期' };
const statusClass = (status: string) => ({ completed: 'ui-pill-green', generating: 'ui-pill-blue', pending: 'ui-pill-blue', failed: 'ui-pill-red' }[status] ?? '');

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
  if (generating.value) { return; }
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
  gap: 16px;
}

.tpl-picks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.tpl-list {
  display: grid;
  grid-column: span 2;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tpl-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tpl-hist {
  display: grid;
  gap: 4px;
}

.tpl-cap {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.tpl-hist ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tpl-hist li + li {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.tpl-hrow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 12px;
  align-items: center;
  padding: 10px 0;
  color: var(--ui-ink);
  font-size: 14px;
  text-decoration: none;
}

.tpl-hname {
  grid-column: 1;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpl-hrow .ui-pill {
  grid-column: 2;
  grid-row: 1 / span 2;
}

.tpl-hmeta {
  grid-column: 1;
  color: var(--ui-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.tpl-hrow:hover .tpl-hname {
  color: var(--ui-accent);
}

.custom-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  border-radius: var(--ui-r-group);
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ui-sep);
  color: var(--ui-ink);
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.custom-row:hover {
  background: var(--ui-surface);
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
  .tpl-picks {
    grid-template-columns: minmax(0, 1fr);
  }

  .tpl-list {
    grid-column: auto;
  }
}

@media (max-width: 768px) {
  .tpl-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* picker first, then the sheet, then the quiet custom entry */
  .tpl-picks {
    display: contents;
  }

  .tpl-list {
    order: 1;
    gap: 10px;
  }

  .tpl-grid > :deep(.sheet) {
    order: 2;
  }

  .custom-row {
    order: 3;
  }

  .tpl-actions {
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
