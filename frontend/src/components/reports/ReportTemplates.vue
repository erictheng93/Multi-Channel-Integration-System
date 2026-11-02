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
      <aside class="tpl-side">
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

        <div class="tpl-actions">
          <button
            type="button"
            class="btn btn-primary"
            :aria-busy="generating"
            @click="useTemplate(selected)"
          >
            {{ generating ? '產生中...' : '直接產生' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            @click="customizeTemplate(selected)"
          >
            調整後產生
          </button>
        </div>

        <section
          v-if="earlier.length"
          class="ui-card tpl-hist"
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
      </aside>

      <div class="tpl-stack">
        <ReportSheet
          :template="selected"
          :state="latestState"
          :loading="latestLoading"
        />
        <!-- one paper edge per earlier output of this type: the stack behind the sheet is that history -->
        <i
          v-for="n in earlier.length"
          :key="n"
          class="tpl-edge"
          :style="{ '--n': n }"
          aria-hidden="true"
        />
      </div>
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
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.tpl-stack {
  min-width: 0;
}

.tpl-stack > .sheet {
  position: relative;
  z-index: 4;
}

.tpl-edge {
  position: relative;
  z-index: calc(4 - var(--n));
  display: block;
  height: 24px;
  margin: -12px calc(var(--n) * 20px) 0;
  border-radius: 0 0 var(--ui-r-group) var(--ui-r-group);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-card), 0 0 0 0.5px var(--ui-sep);
}

.tpl-side {
  position: sticky;
  top: calc(var(--ui-topbar-h) + 20px);
  display: grid;
  gap: 16px;
  min-width: 0;
}

.tpl-list {
  display: grid;
  gap: 12px;
}

.tpl-actions {
  display: grid;
  gap: 8px;
}

.tpl-actions .btn {
  width: 100%;
}

.tpl-hist {
  display: grid;
  gap: 4px;
  padding: 18px 20px 10px;
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
  padding: 16px 20px;
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

  .tpl-side {
    position: static;
  }

  .tpl-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .tpl-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  /* the side column dissolves: picker first, then the sheet, then the quiet extras */
  .tpl-side {
    position: static;
    display: contents;
  }

  .tpl-list {
    order: 1;
    gap: 10px;
  }

  .tpl-stack {
    order: 2;
  }

  .tpl-edge {
    margin-inline: calc(var(--n) * 12px);
  }

  .tpl-hist {
    order: 3;
  }

  .custom-row {
    order: 4;
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
