<!--
  GeneralSettingsPage.vue
  The settings home: a slim status lead, then the identity form, then the read-only parameters in force
  (service latency lives on the health page).
-->

<template>
  <div class="general">
    <GeneralSettingsOverview
      class="g-head"
      part="head"
    />

    <GeneralSettingsForm
      :settings="controller.settings.general"
      :saving="controller.saving.value"
      @save="controller.saveGeneralSettings"
      @update:settings="(data) => Object.assign(controller.settings.general, data)"
    />

    <div class="g-side">
      <SettingsGroup title="連線與備份">
        <GeneralSettingsOverview part="list" />
      </SettingsGroup>

      <SettingsGroup title="目前生效的進階參數">
        <div class="adv-grid">
          <dl class="adv-list">
            <div
              v-for="item in advancedRows"
              :key="item.label"
              class="adv-item"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
          <router-link
            class="ui-link adv-edit"
            to="/settings/advanced"
          >
            調整進階設定
          </router-link>
        </div>
      </SettingsGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'
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
/* bento: slim status line on top; the form (two stacked groups) beside the live status and parameters */
.general {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  min-width: 0;
  min-height: calc(100dvh - 250px);
}

.general :deep(.general-form) {
  grid-template-rows: auto minmax(0, 1fr);
}

.g-head {
  grid-column: 1 / -1;
}

.g-side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 20px;
  min-width: 0;
}

/* the parameters card takes the leftover height so both columns end level */
.g-side :deep(.settings-group:last-child),
.general :deep(.general-form .settings-group:last-child) {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

/* read-only values: label over value in a 2x2 grid, no row chrome, so nothing here looks like a field */
.adv-grid {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 16px;
  height: 100%;
  padding: 18px 22px 20px;
}

.adv-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.adv-item {
  display: grid;
  align-content: center;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--ui-fill);
}

.adv-item dt {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.adv-edit {
  justify-self: start;
  font-size: 14px;
  font-weight: 600;
}

.adv-item dd {
  margin: 4px 0 0;
  font: 600 26px / 1.15 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1024px) {
  .general {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .adv-item dd {
    font-size: 22px;
  }
}
</style>
