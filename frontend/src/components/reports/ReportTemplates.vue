<!-- 報表模板：only templates the backend can generate. One workbench: the picker and generation settings on a tinted side, the chosen template drawn as a report sheet (real figures of the latest report) beside it, earlier outputs and the actions under the picker -->

<template>
  <div class="ui-page report-templates ui-rise">
    <UiPageHead
      title="報表模板"
      :subtitle="templatesSubtitle"
    >
      <template #actions>
        <router-link
          to="/reports/generate"
          class="btn btn-secondary"
        >
          自訂報表
        </router-link>
      </template>
    </UiPageHead>
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
      class="ui-lead wb"
    >
      <section
        class="wb-pick"
        aria-label="選擇模板"
      >
        <h2 class="tpl-cap">
          現成模板
        </h2>
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
            :state="states[template.type] ?? null"
            @select="onSelect"
          />
        </div>

        <h2 class="tpl-cap tpl-cap-spec">
          產生設定
        </h2>
        <dl class="tpl-props">
          <div
            v-for="prop in docProps"
            :key="prop.k"
          >
            <dt>{{ prop.k }}</dt>
            <dd>{{ prop.v }}</dd>
          </div>
        </dl>
      </section>

      <ReportSheet
        class="wb-main"
        :template="selected"
        :state="latestState"
        :loading="latestLoading"
        :contents="contents"
      />

      <section
        class="wb-meta"
        aria-label="產出與操作"
      >
        <div
          v-if="earlier.length"
          class="tpl-hist"
        >
          <h2 class="tpl-cap">
            更早的產出
          </h2>
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
        </div>

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
      </section>
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
import { useLatestByType, relativeTime } from './templates/latestReport';
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
const states = useLatestByType(computed(() => usableTemplates.value.map(template => template.type)));
const latestState = computed(() => (selected.value ? states.value[selected.value.type] ?? null : null));
const latestLoading = computed(() => !!selected.value && !latestState.value);
const earlier = computed(() => (latestState.value?.recent ?? []).filter(item => item.id !== latestState.value?.report?.id).slice(0, 3));
const docProps = computed(() => {
  const list = [{ k: '時間範圍', v: '近 30 天' }, { k: '輸出格式', v: 'JSON' }];
  const seconds = selected.value?.estimatedTime;
  if (seconds) { list.push({ k: '預估耗時', v: `約 ${formatEstimatedTime(seconds)}` }); }
  return list;
});
const contents = computed(() => (selected.value ? REPORT_CONTENTS[selected.value.type] ?? [] : []));
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
  usableTemplates.value.length === 0 ? '' : `${usableTemplates.value.length} 組現成模板，樣張為最近一份報表的真實數值`
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
/* one workbench: picker + settings on a tinted side, the report sheet beside it, earlier outputs and actions under the picker */
.wb {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  grid-template-areas:
    'pick main'
    'meta main';
  grid-template-rows: auto 1fr;
  overflow: hidden;
}

.wb-pick,
.wb-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--ui-surface-2);
}

.wb-pick {
  grid-area: pick;
  padding: 24px 24px 20px;
}

.wb-meta {
  grid-area: meta;
  gap: 20px;
  padding: 4px 24px 24px;
}

.wb-main {
  grid-area: main;
}

.tpl-list {
  display: grid;
  gap: 10px;
}

.tpl-cap {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.tpl-cap-spec {
  margin-top: 10px;
}

.tpl-props {
  display: grid;
  margin: 0;
  padding: 0 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
}

.tpl-props div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}

.tpl-props div + div {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.tpl-props dt {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.tpl-props dd {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tpl-props div:last-child dd {
  color: var(--ui-accent-ink, var(--ui-accent));
}

.tpl-hist {
  display: grid;
  gap: 8px;
}

.tpl-hist ul {
  display: grid;
  margin: 0;
  padding: 0 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
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

.tpl-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: auto;
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
  .wb {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'pick'
      'main'
      'meta';
    grid-template-rows: none;
  }

  .wb-meta {
    padding-top: 20px;
  }
}

/* phone: switch template, read the sheet, glance at earlier outputs; the actions live in the pinned bar */
@media (max-width: 768px) {
  .wb {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: visible;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .wb-pick,
  .wb-meta {
    padding: 0;
    background: transparent;
  }

  .wb-pick {
    gap: 10px;
  }

  .wb-pick > .tpl-cap {
    display: none;
  }

  .tpl-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  /* the settings become one line */
  .tpl-cap-spec {
    display: none;
  }

  .tpl-props {
    display: flex;
    padding: 10px 4px;
  }

  .tpl-props div {
    flex: 1;
    flex-direction: column-reverse;
    gap: 1px;
    padding: 0 4px;
    text-align: center;
  }

  .tpl-props div + div {
    box-shadow: inset 0.5px 0 0 var(--ui-sep);
  }

  .tpl-props dd {
    font-size: 14px;
  }

  .wb-main {
    border-radius: var(--ui-r-lead);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow-card);
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
