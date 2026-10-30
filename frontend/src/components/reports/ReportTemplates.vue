<!-- 報表模板：only templates the backend can generate, plus the custom report entry -->

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

    <template v-else>
      <!-- Lead: the free-form entry; the ready-made templates follow as a labelled group -->
      <section class="ui-lead custom-lead">
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
        <div class="custom-main">
          <h2 class="custom-name">
            自訂報表
          </h2>
          <p class="custom-desc">
            不套用模板，自行選擇報表類型、時間範圍與輸出格式。
          </p>
          <ul
            class="custom-types"
            aria-label="可選的報表類型"
          >
            <li
              v-for="option in generatable.types"
              :key="option.value"
              class="ui-chip"
            >
              {{ option.label }}
            </li>
          </ul>
        </div>
        <dl class="custom-formats">
          <dt>輸出格式</dt>
          <dd>{{ generatable.formats.map(f => f.label).join(' / ') }}</dd>
        </dl>
        <router-link
          to="/reports/generate"
          class="btn btn-primary custom-go"
        >
          前往產生報表
        </router-link>
      </section>

      <div
        v-if="usableTemplates.length > 0"
        class="catalogue-wrap"
      >
        <h2 class="ui-group-label">
          現成模板
          <span class="tpl-count">{{ usableTemplates.length }}</span>
        </h2>
        <div class="catalogue">
          <TemplateCard
            v-for="template in usableTemplates"
            :key="template.name"
            :template="template"
            :generating="generating"
            @use="useTemplate"
            @customize="customizeTemplate"
          />
        </div>
      </div>
    </template>
  </div>
</template>


<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { ReportTemplate } from '@/types/reports';
import ReportsAPI from '@/api/reports';
import TemplateCard from './templates/TemplateCard.vue';
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
.catalogue {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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

.custom-lead {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 24px;
  align-items: center;
  padding: 28px 36px;
}

.custom-ico {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--section-hue) 82%, #fff), var(--section-hue));
  color: #fff;
}

.custom-ico svg {
  width: 26px;
  height: 26px;
}

.custom-name {
  margin: 0;
  font: 700 28px / 1.2 var(--ui-font-display);
  letter-spacing: -0.025em;
}

.custom-desc {
  margin: 4px 0 14px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.custom-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.custom-formats {
  margin: 0;
  padding-left: 24px;
  border-left: 0.5px solid var(--ui-sep);
}

.custom-formats dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.custom-formats dd {
  margin: 2px 0 0;
  font-size: 15px;
  font-weight: 600;
}

.error-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

@media (max-width: 1024px) {
  .catalogue {
    grid-template-columns: minmax(0, 1fr);
  }

  .custom-lead {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .custom-formats {
    padding-left: 0;
    border-left: 0;
  }

  .custom-formats,
  .custom-go {
    grid-column: 1 / -1;
  }

  .custom-go {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .catalogue {
    gap: 12px;
  }

  .custom-lead {
    gap: 16px;
    padding: 22px 20px;
  }

  .custom-name {
    font-size: 24px;
  }
}
</style>
