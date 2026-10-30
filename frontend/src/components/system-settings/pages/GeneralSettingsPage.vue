<!--
  GeneralSettingsPage.vue
  The settings home: a slim status lead, then the identity form, then the read-only parameters in force
  (service latency lives on the health page).
-->

<template>
  <div class="general">
    <GeneralSettingsOverview />

    <GeneralSettingsForm
      :settings="controller.settings.general"
      :saving="controller.saving.value"
      @save="controller.saveGeneralSettings"
      @update:settings="(data) => Object.assign(controller.settings.general, data)"
    />

    <SettingsGroup
      class="adv-group"
      title="目前生效的進階參數"
    >
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
.general {
  display: grid;
  gap: 20px;
  min-width: 0;
}

/* read-only values: label over value, no row chrome, so nothing here looks like a field */
.adv-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 24px;
  align-items: center;
  padding: 16px 22px;
}

.adv-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 24px;
  margin: 0;
}

.adv-item dt {
  font-size: 13px;
  color: var(--ui-muted);
}

.adv-edit {
  justify-self: end;
  font-size: 14px;
  font-weight: 600;
}

.adv-item dd {
  margin: 4px 0 0;
  font: 600 17px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}



@media (max-width: 1024px) {
  .adv-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .adv-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .adv-edit {
    justify-self: start;
  }
}

</style>
