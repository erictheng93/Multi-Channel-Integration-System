<!--
  GeneralSettingsPage.vue
  The settings home: a live overview strip (each tile links to its section), then the identity form
  beside a context column (name preview, clock in the chosen time zone, measured service latency).
  Below the form, a read-only glance at the advanced parameters currently in force.
-->

<template>
  <div class="general">
    <GeneralSettingsOverview />

    <div class="general-split">
      <div class="general-main">
        <GeneralSettingsForm
          :settings="controller.settings.general"
          :saving="controller.saving.value"
          @save="controller.saveGeneralSettings"
          @update:settings="(data) => Object.assign(controller.settings.general, data)"
        />

        <SettingsGroup title="目前生效的進階參數">
          <ul class="ui-list">
            <li
              v-for="item in advancedRows"
              :key="item.label"
              class="ui-row is-flush"
            >
              <div class="ui-row-main">
                <div class="ui-row-title">
                  {{ item.label }}
                </div>
              </div>
              <span class="adv-val">{{ item.value }}</span>
            </li>
          </ul>
          <template #note>
            <router-link
              class="ui-link"
              to="/settings/advanced"
            >
              前往進階設定調整
            </router-link>
          </template>
        </SettingsGroup>
      </div>

      <aside
        class="general-aside"
        aria-label="說明與預覽"
      >
        <GeneralSettingsAside
          :system-name="controller.settings.general.systemName"
          :timezone="controller.settings.general.timezone"
        />

        <article class="ui-card lat-card">
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                服務延遲
              </h2>
              <div class="ui-card-sub">
                最近一次健康檢查的實測值
              </div>
            </div>
          </div>
          <ul
            v-if="controller.healthCheckResults.value.length > 0"
            class="ui-list"
          >
            <li
              v-for="row in controller.healthCheckResults.value"
              :key="row.key"
              class="ui-row is-flush lat-row"
            >
              <span
                class="lat-dot"
                :class="row.status"
                aria-hidden="true"
              />
              <span class="ui-row-main">
                <span class="ui-row-title">{{ row.name }}</span>
              </span>
              <span class="lat-ms">{{ row.responseTime ?? '—' }}<small v-if="row.responseTime !== undefined"> ms</small></span>
            </li>
          </ul>
          <p
            v-else
            class="lat-empty"
          >
            {{ controller.processing.value ? '正在檢查服務...' : '尚無檢查結果' }}
          </p>
        </article>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'
import GeneralSettingsAside from '@/components/system-settings/GeneralSettingsAside.vue'
import GeneralSettingsOverview from '@/components/system-settings/GeneralSettingsOverview.vue'
import SettingsGroup from '@/components/system-settings/SettingsGroup.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

/** Same unit conversions the advanced form uses (ms, seconds -> seconds, minutes, hours) */
const advancedRows = computed(() => {
  const a = controller.settings.advanced
  return [
    { label: '訊息可撤回時間', value: a.recallWindowSeconds > 0 ? `${a.recallWindowSeconds} 秒` : '關閉' },
    { label: '訊息處理逾時', value: `${Math.round(a.messageTimeout / 1000)} 秒` },
    { label: '登入有效期限', value: `${Math.round(a.sessionExpiry / 3600)} 小時` },
    { label: '速率限制', value: a.enableRateLimit ? '已開啟' : '已關閉' },
  ]
})
</script>

<style scoped>
.general {
  display: grid;
  gap: 22px;
  min-width: 0;
}

/* Spans the full page grid: the context column ends on the same right edge as every other page */
.general-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 400px);
  gap: 22px;
  align-items: start;
  min-width: 0;
}

.general-main {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.general-aside {
  display: grid;
  gap: 16px;
  min-width: 0;
  /* line the first card up with the first form card, below its group caption */
  padding-top: 28px;
}

.adv-val {
  flex: none;
  font: 600 15px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.lat-card {
  padding-bottom: 8px;
}

.lat-row {
  padding-top: 10px;
  padding-bottom: 10px;
}

.lat-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-muted);
}

.lat-dot.healthy {
  background: var(--ui-green);
}

.lat-dot.warning {
  background: var(--ui-orange);
}

.lat-dot.critical {
  background: var(--ui-red);
}

.lat-ms {
  font: 600 14px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.lat-ms small {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.lat-empty {
  margin: 0;
  padding: 4px 22px 18px;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 1024px) {
  .general-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .general-aside {
    padding-top: 0;
  }
}
</style>
