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
        <ul class="adv-list">
          <li
            v-for="item in advancedRows"
            :key="item.label"
          >
            <router-link
              class="adv-item"
              to="/settings/advanced"
            >
              <span class="adv-label">{{ item.label }}</span>
              <span class="adv-value">{{ item.value }}</span>
              <svg
                class="adv-chev"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m9 6 6 6-6 6" /></svg>
            </router-link>
          </li>
        </ul>
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

/* read-only values: one row each, label left and value right, every row opens the advanced page */
.adv-list {
  display: grid;
  grid-template-rows: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0 22px;
  list-style: none;
}

.adv-list li + li {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.adv-item {
  display: flex;
  gap: 14px;
  align-items: center;
  height: 100%;
  min-height: 48px;
  color: inherit;
  text-decoration: none;
}

.adv-item:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.adv-label {
  flex: 1;
  font-size: 15px;
  color: var(--ui-ink);
}

.adv-value {
  font: 600 17px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.adv-chev {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--ui-faint);
}

@media (max-width: 1024px) {
  .general {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
  }
}

</style>
