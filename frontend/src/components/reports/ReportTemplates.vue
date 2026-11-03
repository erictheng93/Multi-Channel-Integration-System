<!-- 報表模板：only templates the backend can generate. Signature: the chosen template is drawn as a report sheet, its contents as a numbered outline filled with the real figures of the latest report -->

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
      class="tpl-grid"
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

      <ReportSheet
        :template="selected"
        :state="latestState"
        :loading="latestLoading"
      />

      <aside
        class="ui-card tpl-rail"
        aria-label="產生設定"
      >
        <dl class="tpl-props">
          <div
            v-for="prop in docProps"
            :key="prop.k"
          >
            <dt>{{ prop.k }}</dt>
            <dd>{{ prop.v }}</dd>
          </div>
        </dl>

        <p
          class="tpl-src"
          :class="{ 'is-warn': latestState?.failed }"
          :role="latestState?.failed ? 'alert' : 'status'"
        >
          <template v-if="latestLoading">
            正在讀取最近一份報表…
          </template>
          <template v-else-if="latestState?.failed">
            無法讀取最近一份報表的內容，你仍可直接產生新的報表。
          </template>
          <template v-else-if="!latestState?.report">
            還沒有產生過。以 JSON 產生第一份後，樣張會填入實際數值。
          </template>
          <template v-else>
            樣張數值取自
            <router-link
              :to="`/reports/${latestState.report.id}`"
              class="tpl-src-link"
            >
              {{ latestState.report.title }}
            </router-link>
            <span class="tpl-src-ago"> ・ {{ relativeTime(latestState.report.completedAt ?? latestState.report.createdAt) }}</span>
          </template>
        </p>

        <section
          class="tpl-hist"
          aria-label="報表內容"
        >
          <h3 class="tpl-cap">
            報表內容
          </h3>
          <ul class="tpl-inc">
            <li
              v-for="item in contents"
              :key="item.label"
            >
              <b>{{ item.label }}</b>
              <span>{{ item.hint }}</span>
            </li>
          </ul>
        </section>

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
      </aside>
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
const { state: latestState, loading: latestLoading } = useLatestReport(computed(() => selected.value?.type));
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
.tpl-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: stretch;
}

.tpl-list {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

/* the rail beside the sheet: how it will be generated, where the figures come from, what came before, then the actions */
.tpl-rail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
}

.tpl-props {
  display: grid;
  margin: 0;
}

.tpl-props div {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 0;
}

.tpl-props div + div {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.tpl-props div:first-child {
  padding-top: 0;
}

.tpl-props dt {
  font-size: 14px;
  color: var(--ui-muted);
}

.tpl-props dd {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.tpl-src {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  font-size: 14px;
  color: var(--ui-ink-2);
}

.tpl-src.is-warn {
  color: var(--ui-red-ink);
}

.tpl-src-link {
  font-weight: 600;
  color: var(--ui-accent);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.tpl-src-link:hover {
  text-decoration: underline;
}

.tpl-src-ago {
  color: var(--ui-muted);
}

.tpl-inc {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tpl-inc li {
  display: grid;
  gap: 1px;
  padding: 9px 0;
  font-size: 14px;
}

.tpl-inc li + li {
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.tpl-inc b {
  font-weight: 600;
}

.tpl-inc span {
  font-size: 13px;
  color: var(--ui-muted);
}

.tpl-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: auto;
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
  .tpl-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .tpl-grid {
    gap: 12px;
  }

  .tpl-list {
    gap: 10px;
  }

  .tpl-rail {
    gap: 16px;
    padding: 18px;
  }

  /* the settings read as one wrapping line of facts, not a three-row table */
  .tpl-props {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
  }

  .tpl-props div,
  .tpl-props div:first-child {
    flex-direction: column;
    gap: 0;
    padding: 0;
  }

  .tpl-props div + div {
    box-shadow: none;
  }

  .tpl-hist[aria-label="報表內容"] {
    display: none;
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
